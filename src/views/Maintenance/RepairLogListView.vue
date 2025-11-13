<script setup>
import { onMounted, ref, computed } from 'vue'
import { useAuthStore } from '@/stores'
import DefaultLayout from '@/layouts/DefaultLayout.vue'

const auth = useAuthStore()
const apiBase = import.meta.env.VITE_API_URL || 'http://localhost:5001/api'
const loading = ref(false)
const error = ref('')
const logs = ref([])
const search = ref('')
const statusFilter = ref('')

const fetchLogs = async () => {
  loading.value = true
  error.value = ''
  try {
    const url = new URL(`${apiBase}/maintenance/logs`)
    if (statusFilter.value) url.searchParams.set('status', statusFilter.value)
    const res = await fetch(url.toString(), {
      headers: { Authorization: `Bearer ${auth.token}` }
    })
    const data = await res.json()
    if (!data.success) throw new Error(data.message || 'Failed to fetch logs')
    logs.value = Array.isArray(data.logs) ? data.logs : []
  } catch (e) {
    error.value = e.message || String(e)
  } finally {
    loading.value = false
  }
}

const filteredLogs = computed(() => {
  const q = search.value.trim().toLowerCase()
  return logs.value.filter((l) => {
    const s = `${l.logNumber || ''} ${l.acn || ''} ${l.serialNumber || ''} ${
      l.status || ''
    }`.toLowerCase()
    return !q || s.includes(q)
  })
})

onMounted(fetchLogs)
</script>

<template>
  <DefaultLayout>
    <div class="p-6">
      <!-- Header -->
      <div class="flex items-center justify-between mb-6">
        <div>
          <h1 class="text-2xl font-bold text-black dark:text-white">Repair Logs</h1>
          <p class="text-sm text-bodydark2 mt-1">Track and manage repair and maintenance logs</p>
        </div>
        <router-link
          class="rounded bg-primary text-white px-4 py-2 text-sm font-medium hover:bg-opacity-90 transition"
          to="/maintenance/logs/create"
        >
          + New Repair Log
        </router-link>
      </div>

      <!-- Main Card -->
      <div class="rounded-sm border border-stroke bg-white shadow-default dark:border-strokedark dark:bg-boxdark">
        <!-- Filters -->
        <div class="border-b border-stroke dark:border-strokedark p-4">
          <div class="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-3">
            <input
              v-model="search"
              class="w-full border border-stroke rounded px-3 py-2 bg-white"
              placeholder="Search log #, ACN, or serial"
            />
            <select v-model="statusFilter" class="w-full border border-stroke rounded px-3 py-2 bg-white">
              <option value="">All statuses</option>
              <option value="for_inspection">For inspection</option>
              <option value="under_repair">Under repair</option>
              <option value="pending_replacement">Pending replacement</option>
              <option value="repaired">Repaired</option>
              <option value="for_disposal">For disposal</option>
            </select>
            <div class="flex gap-2">
              <button @click="fetchLogs" class="rounded border border-primary bg-primary/10 text-primary px-4 py-2 text-sm font-medium hover:bg-primary/20 transition">Apply</button>
              <button @click="() => { search = ''; statusFilter = ''; fetchLogs() }" class="rounded border border-stroke px-4 py-2 text-sm font-medium hover:bg-gray-50 dark:hover:bg-meta-4 transition">Clear</button>
            </div>
          </div>
          <div v-if="error" class="text-red-600 mt-3 text-sm">{{ error }}</div>
        </div>

        <!-- Table -->
        <div class="overflow-x-auto">
          <table class="w-full table-auto">
            <thead>
              <tr class="bg-gray-2 text-left dark:bg-meta-4">
                <th class="py-3 px-4 font-semibold text-sm">Log #</th>
                <th class="py-3 px-4 font-semibold text-sm">Date</th>
                <th class="py-3 px-4 font-semibold text-sm">Status</th>
                <th class="py-3 px-4 font-semibold text-sm">ACN</th>
                <th class="py-3 px-4 font-semibold text-sm">Serial</th>
                <th class="py-3 px-4 font-semibold text-sm">Technician</th>
                <th class="py-3 px-4 font-semibold text-sm">Requester</th>
                <th class="py-3 px-4 font-semibold text-sm">RIS</th>
                <th class="py-3 px-4 font-semibold text-sm">Actions</th>
              </tr>
            </thead>
            <tbody>
              <!-- Loading State -->
              <tr v-if="loading">
                <td colspan="9" class="text-center py-8">
                  <div class="flex items-center justify-center gap-2">
                    <div class="h-4 w-4 rounded-full border-2 border-primary border-t-transparent animate-spin"></div>
                    <span class="text-sm text-bodydark2">Loading repair logs...</span>
                  </div>
                </td>
              </tr>

              <!-- Empty State -->
              <tr v-else-if="filteredLogs.length === 0">
                <td colspan="9" class="text-center py-8">
                  <div class="flex flex-col items-center gap-2">
                    <svg class="h-12 w-12 text-bodydark2 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                    <span class="text-sm text-bodydark2">No repair logs found</span>
                  </div>
                </td>
              </tr>

              <!-- Data Rows -->
              <tr v-for="l in filteredLogs" :key="l._id" class="border-b border-stroke dark:border-strokedark hover:bg-gray-50 dark:hover:bg-meta-4 transition">
                <td class="py-3 px-4"><span class="font-medium text-sm">{{ l.logNumber }}</span></td>
                <td class="py-3 px-4"><span class="text-sm">{{ new Date(l.date || l.createdAt).toLocaleDateString() }}</span></td>
                <td class="py-3 px-4">
                  <span class="inline-block px-2 py-1 rounded text-xs font-medium bg-bodydark/10 text-bodydark">{{ l.status }}</span>
                </td>
                <td class="py-3 px-4"><span class="text-sm font-mono text-success">{{ l.acn || '—' }}</span></td>
                <td class="py-3 px-4"><span class="text-sm font-mono">{{ l.serialNumber || '—' }}</span></td>
                <td class="py-3 px-4"><span class="text-sm">{{ l.technician?.name || '—' }}</span></td>
                <td class="py-3 px-4"><span class="text-sm">{{ l.broughtBy?.name || '—' }}</span></td>
                <td class="py-3 px-4"><span class="text-sm">{{ l.risGenerated ? 'Generated' : '—' }}</span></td>
                <td class="py-3 px-4">
                  <router-link :to="`/maintenance/logs/${l._id}`" class="inline-flex items-center gap-1 text-primary text-sm font-medium hover:underline">
                    View
                    <svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
                    </svg>
                  </router-link>
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <!-- Footer Summary -->
        <div v-if="filteredLogs.length > 0" class="border-t border-stroke dark:border-strokedark p-4 bg-gray-50 dark:bg-meta-4">
          <p class="text-xs text-bodydark2">Showing <span class="font-semibold">{{ filteredLogs.length }}</span> repair log{{ filteredLogs.length !== 1 ? 's' : '' }}</p>
        </div>
      </div>
    </div>
  </DefaultLayout>
</template>

<style scoped>
.bg-primary {
  background-color: #1a56db;
}
.text-primary {
  color: #1a56db;
}
</style>
