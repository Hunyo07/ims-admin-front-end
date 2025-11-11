<script setup>
import { ref, onMounted, computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import axios from '@/utils/axios'
import DefaultLayout from '@/layouts/DefaultLayout.vue'

const route = useRoute()
const router = useRouter()

const mr = ref(null)
const loading = ref(false)
const error = ref('')

const id = computed(() => String(route.params.id || ''))

async function fetchMR() {
  if (!id.value) return
  loading.value = true
  error.value = ''
  try {
    const { data } = await axios.get(`/mr/${id.value}`)
    mr.value = data?.mr || null
  } catch (e) {
    error.value = e?.response?.data?.message || e.message || 'Failed to load MR'
  } finally {
    loading.value = false
  }
}

onMounted(fetchMR)

function statusBadgeClass(status) {
  switch (status) {
    case 'active':
      return 'bg-success/10 text-success'
    case 'returned':
      return 'bg-primary/10 text-primary'
    case 'cancelled':
      return 'bg-danger/10 text-danger'
    default:
      return 'bg-bodydark/10 text-bodydark'
  }
}

function formatDate(d) {
  if (!d) return '—'
  try {
    return new Date(d).toLocaleString()
  } catch (_) {
    return String(d)
  }
}
</script>

<template>
  <DefaultLayout>
    <div class="mb-6 flex items-center justify-between">
      <div>
        <h1 class="text-2xl font-bold text-black dark:text-white">Memorandum Receipt</h1>
        <p class="text-sm text-bodydark2 mt-1">View MR details and items</p>
      </div>
      <button
        class="rounded border border-stroke px-4 py-2 text-sm hover:bg-gray-50 dark:hover:bg-meta-4"
        @click="router.push('/mr')"
      >
        ← Back to List
      </button>
    </div>

    <div
      class="rounded-sm border border-stroke bg-white shadow-default dark:border-strokedark dark:bg-boxdark"
    >
      <div class="border-b border-stroke dark:border-strokedark p-6">
        <div class="flex items-start justify-between">
          <div>
            <h2 class="text-xl font-semibold">{{ mr?.mrNumber || '—' }}</h2>
            <p class="text-xs text-bodydark2 mt-1">MR ID: {{ id }}</p>
          </div>
          <span
            v-if="mr"
            :class="`inline-block px-3 py-1 rounded text-xs font-medium ${statusBadgeClass(mr.status)}`"
          >
            {{ mr.status || '—' }}
          </span>
        </div>
      </div>

      <div class="p-6">
        <div v-if="loading" class="text-sm">Loading MR...</div>
        <div v-else-if="error" class="text-danger text-sm">{{ error }}</div>

        <div v-else-if="mr" class="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <div>
            <div class="text-xs text-bodydark2 mb-1">MR Holder</div>
            <div class="text-sm font-medium">{{ mr.mrHolder || '—' }}</div>
          </div>
          <div>
            <div class="text-xs text-bodydark2 mb-1">End User</div>
            <div class="text-sm font-medium">{{ mr.endUser || '—' }}</div>
          </div>
          <div>
            <div class="text-xs text-bodydark2 mb-1">Department</div>
            <div class="text-sm font-medium">{{ mr.endUserDepartment || '—' }}</div>
          </div>
          <div>
            <div class="text-xs text-bodydark2 mb-1">Issued Date</div>
            <div class="text-sm font-medium">{{ formatDate(mr.issuedDate) }}</div>
          </div>
          <div>
            <div class="text-xs text-bodydark2 mb-1">Returned Date</div>
            <div class="text-sm font-medium">{{ formatDate(mr.returnedDate) }}</div>
          </div>
          <div>
            <div class="text-xs text-bodydark2 mb-1">Created By</div>
            <div class="text-sm font-medium">{{ mr.createdBy?.name || '—' }}</div>
          </div>
        </div>

        <div v-if="mr?.notes" class="mb-6">
          <div class="text-xs text-bodydark2 mb-1">Notes</div>
          <div class="text-sm bg-gray-50 dark:bg-meta-4 p-3 rounded">{{ mr.notes }}</div>
        </div>

        <div>
          <h3 class="text-lg font-semibold mb-3">Items ({{ mr?.items?.length || 0 }})</h3>
          <div class="overflow-x-auto">
            <table class="w-full table-auto">
              <thead>
                <tr class="bg-gray-2 text-left dark:bg-meta-4">
                  <th class="py-3 px-4 font-semibold text-sm">Description</th>
                  <th class="py-3 px-4 font-semibold text-sm">ACN</th>
                  <th class="py-3 px-4 font-semibold text-sm">Serial</th>
                  <th class="py-3 px-4 font-semibold text-sm">Property #</th>
                  <th class="py-3 px-4 font-semibold text-sm">Status</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="(it, idx) in mr?.items || []" :key="it.itemId || idx" class="border-t border-stroke dark:border-strokedark">
                  <td class="py-3 px-4 text-sm">{{ it.description || '—' }}</td>
                  <td class="py-3 px-4 text-sm">{{ it.acn || '—' }}</td>
                  <td class="py-3 px-4 text-sm">{{ it.serialNumber || '—' }}</td>
                  <td class="py-3 px-4 text-sm">{{ it.propertyNumber || '—' }}</td>
                  <td class="py-3 px-4 text-sm">{{ it.status || '—' }}</td>
                </tr>
              </tbody>
            </table>
          </div>
          <div v-if="(mr?.items?.length || 0) === 0" class="text-sm text-bodydark2 p-4">No items in this MR</div>
        </div>
      </div>
    </div>
  </DefaultLayout>
</template>