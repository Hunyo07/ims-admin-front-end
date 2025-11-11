<script setup>
import { ref, onMounted, computed } from 'vue'
import axios from '../../utils/axios'
import { useAuthStore } from '../../stores/auth'
import DefaultLayout from '../../layouts/DefaultLayout.vue'

const authStore = useAuthStore()
const isLoading = ref(false)
const drs = ref([])
const suppliers = ref([])

const filters = ref({
  search: '',
  purpose: '',
  supplierId: '',
  from: '',
  to: ''
})

const fetchSuppliers = async () => {
  try {
    const { data } = await axios.get('/suppliers/suppliers')
    suppliers.value = (data || []).filter((s) => s?.isActive)
  } catch (_) {
    suppliers.value = []
  }
}

const fetchDRs = async () => {
  try {
    isLoading.value = true
    const params = {}
    if (filters.value.search) params.search = filters.value.search
    if (filters.value.purpose) params.purpose = filters.value.purpose
    if (filters.value.supplierId) params.supplierId = filters.value.supplierId
    if (filters.value.from) params.from = filters.value.from
    if (filters.value.to) params.to = filters.value.to

    const { data } = await axios.get('/delivery-receipts', { params })
    // Populate department info for items
    const receipts = data?.deliveryReceipts || []
    drs.value = receipts
  } catch (e) {
    drs.value = []
  } finally {
    isLoading.value = false
  }
}

const clearFilters = () => {
  filters.value = { search: '', purpose: '', supplierId: '', from: '', to: '' }
  fetchDRs()
}

const getPurposeBadgeClass = () => {
  // DRs are now stock-only
  return 'bg-success/10 text-success'
}

const getStatusBadgeClass = (status) => {
  return status === 'posted' ? 'bg-primary/10 text-primary' : 'bg-bodydark/10 text-bodydark'
}

const filtered = computed(() => drs.value)

onMounted(() => {
  fetchSuppliers()
  fetchDRs()
})
</script>

<template>
  <DefaultLayout>
    <!-- Header Section -->
    <div class="mb-6">
      <div class="flex items-center justify-between mb-4">
        <div>
          <h1 class="text-2xl font-bold text-black dark:text-white">Delivery Receipts</h1>
          <p class="text-sm text-bodydark2 mt-1">
            Manage incoming deliveries and track receipt status
          </p>
        </div>
        <router-link
          v-if="authStore.hasPermission('manage_products')"
          to="/inventory/delivery-receipts/new"
          class="rounded bg-primary text-white px-4 py-2 text-sm font-medium hover:bg-opacity-90 transition"
        >
          + New DR
        </router-link>
      </div>
    </div>

    <!-- Main Card -->
    <div
      class="rounded-sm border border-stroke bg-white shadow-default dark:border-strokedark dark:bg-boxdark"
    >
      <!-- Filters Section -->
      <div class="border-b border-stroke dark:border-strokedark p-4">
        <div class="mb-3">
          <h3 class="text-sm font-semibold mb-3">Filters</h3>
        </div>

        <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-3 mb-3">
          <div>
            <input
              v-model="filters.search"
              type="text"
              placeholder="Search DR number..."
              class="w-full rounded border border-stroke p-2 text-sm dark:border-strokedark dark:bg-form-input"
            />
          </div>

          <div>
            <select
              v-model="filters.purpose"
              class="w-full rounded border border-stroke p-2 text-sm dark:border-strokedark dark:bg-form-input"
            >
              <option value="">All</option>
              <option value="stock">For Stocks</option>
            </select>
          </div>

          <div>
            <select
              v-model="filters.supplierId"
              class="w-full rounded border border-stroke p-2 text-sm dark:border-strokedark dark:bg-form-input"
            >
              <option value="">All Suppliers</option>
              <option v-for="s in suppliers" :key="s._id" :value="s._id">{{ s.name }}</option>
            </select>
          </div>

          <div>
            <input
              type="date"
              v-model="filters.from"
              class="w-full rounded border border-stroke p-2 text-sm dark:border-strokedark dark:bg-form-input"
            />
          </div>

          <div>
            <input
              type="date"
              v-model="filters.to"
              class="w-full rounded border border-stroke p-2 text-sm dark:border-strokedark dark:bg-form-input"
            />
          </div>
        </div>

        <div class="flex gap-2">
          <button
            @click="fetchDRs"
            class="rounded border border-primary bg-primary/10 text-primary px-4 py-2 text-sm font-medium hover:bg-primary/20 transition"
          >
            Apply
          </button>
          <button
            @click="clearFilters"
            class="rounded border border-stroke px-4 py-2 text-sm font-medium hover:bg-gray-50 dark:hover:bg-meta-4 transition"
          >
            Clear
          </button>
        </div>
      </div>

      <!-- Table Section -->
      <div class="overflow-x-auto">
        <table class="w-full table-auto">
          <thead>
            <tr class="bg-gray-2 text-left dark:bg-meta-4">
              <th class="py-3 px-4 font-semibold text-sm">DR Number</th>
              <th class="py-3 px-4 font-semibold text-sm">Supplier</th>
              <th class="py-3 px-4 font-semibold text-sm">Date Received</th>
              <th class="py-3 px-4 font-semibold text-sm">Purpose</th>
              <th class="py-3 px-4 font-semibold text-sm">Items & Departments</th>
              <th class="py-3 px-4 font-semibold text-sm">Status</th>
              <th class="py-3 px-4 font-semibold text-sm">Actions</th>
            </tr>
          </thead>
          <tbody>
            <!-- Loading State -->
            <tr v-if="isLoading">
              <td colspan="7" class="text-center py-8">
                <div class="flex items-center justify-center gap-2">
                  <div
                    class="h-4 w-4 rounded-full border-2 border-primary border-t-transparent animate-spin"
                  ></div>
                  <span class="text-sm text-bodydark2">Loading delivery receipts...</span>
                </div>
              </td>
            </tr>

            <!-- Empty State -->
            <tr v-else-if="!filtered.length">
              <td colspan="7" class="text-center py-8">
                <div class="flex flex-col items-center gap-2">
                  <svg
                    class="h-12 w-12 text-bodydark2 opacity-50"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      stroke-linecap="round"
                      stroke-linejoin="round"
                      stroke-width="2"
                      d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                    />
                  </svg>
                  <span class="text-sm text-bodydark2">No delivery receipts found</span>
                </div>
              </td>
            </tr>

            <!-- Data Rows -->
            <tr
              v-for="r in filtered"
              :key="r._id"
              class="border-b border-stroke dark:border-strokedark hover:bg-gray-50 dark:hover:bg-meta-4 transition"
            >
              <td class="py-3 px-4">
                <span class="font-medium text-sm">{{ r.drNumber }}</span>
              </td>
              <td class="py-3 px-4">
                <span class="text-sm">{{ r.supplier?.name || '—' }}</span>
              </td>
              <td class="py-3 px-4">
                <span class="text-sm">{{ new Date(r.dateReceived).toLocaleDateString() }}</span>
              </td>
              <td class="py-3 px-4">
                <span
                  :class="`inline-block px-2 py-1 rounded text-xs font-medium ${getPurposeBadgeClass()}`"
                >
                  For Stocks
                </span>
              </td>
              <td class="py-3 px-4">
                <div class="space-y-1">
                  <div v-if="!r.items || r.items.length === 0" class="text-sm text-bodydark2">
                    No items
                  </div>
                  <div v-else-if="r.items.length <= 3">
                    <div
                      v-for="(item, idx) in r.items"
                      :key="idx"
                      class="text-xs py-1 border-b border-stroke dark:border-strokedark last:border-0"
                    >
                      <span class="font-medium">{{ item.product?.name || 'Unknown' }}</span>
                      <span class="text-bodydark2 ml-1">({{ item.qty }})</span>
                      <span v-if="item.department" class="ml-2 text-primary">
                        → {{ item.department?.name }}
                      </span>
                    </div>
                  </div>
                  <div v-else>
                    <div
                      v-for="(item, idx) in r.items.slice(0, 2)"
                      :key="idx"
                      class="text-xs py-1 border-b border-stroke dark:border-strokedark"
                    >
                      <span class="font-medium">{{ item.product?.name || 'Unknown' }}</span>
                      <span class="text-bodydark2 ml-1">({{ item.qty }})</span>
                      <span v-if="item.department" class="ml-2 text-primary">
                        → {{ item.department?.name }}
                      </span>
                    </div>
                    <div class="text-xs text-bodydark2 mt-1">
                      +{{ r.items.length - 2 }} more items
                    </div>
                  </div>
                </div>
              </td>
              <td class="py-3 px-4">
                <span
                  :class="`inline-block px-2 py-1 rounded text-xs font-medium ${getStatusBadgeClass(
                    r.status
                  )}`"
                >
                  {{ r.status === 'posted' ? 'Posted' : 'Received' }}
                </span>
              </td>
              <td class="py-3 px-4">
                <router-link
                  :to="`/inventory/delivery-receipts/${r._id}`"
                  class="inline-flex items-center gap-1 text-primary text-sm font-medium hover:underline"
                >
                  View
                  <svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path
                      stroke-linecap="round"
                      stroke-linejoin="round"
                      stroke-width="2"
                      d="M9 5l7 7-7 7"
                    />
                  </svg>
                </router-link>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <!-- Footer Summary -->
      <div
        v-if="filtered.length > 0"
        class="border-t border-stroke dark:border-strokedark p-4 bg-gray-50 dark:bg-meta-4"
      >
        <p class="text-xs text-bodydark2">
          Showing <span class="font-semibold">{{ filtered.length }}</span> delivery receipt{{
            filtered.length !== 1 ? 's' : ''
          }}
        </p>
      </div>
    </div>
  </DefaultLayout>
</template>
