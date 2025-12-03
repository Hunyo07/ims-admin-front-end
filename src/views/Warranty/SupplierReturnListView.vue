<template>
  <DefaultLayout>
    <Breadcrumb
      :breadcrumbs="[
        { title: 'Supplier Returns', to: '/warranty/supplier-returns' }
      ]"
      pageTitle="Supplier Returns"
    >
      <template #actions>
        <router-link to="/warranty/supplier-returns/new" class="btn btn-primary">
          New Return
        </router-link>
      </template>
    </Breadcrumb>

    <Card>
      <div class="p-5">
        <div class="flex items-center justify-between mb-4">
          <div class="flex items-center space-x-3">
            <select v-model="statusFilter" class="form-select">
              <option value="">All Statuses</option>
              <option value="for_warranty">For Warranty</option>
              <option value="pending_supplier_pickup">Pending Supplier Pickup</option>
              <option value="sent_to_supplier">Sent to Supplier</option>
              <option value="under_review">Under Review</option>
              <option value="approved">Approved</option>
              <option value="rejected">Rejected</option>
              <option value="repaired">Repaired</option>
              <option value="replaced">Replaced</option>
              <option value="refunded">Refunded</option>
              <option value="completed">Completed</option>
              <option value="cancelled">Cancelled</option>
            </select>
            <button class="btn btn-outline-secondary" @click="fetchReturns">Refresh</button>
          </div>
          <div>
            <input v-model="search" type="text" class="form-input" placeholder="Search by ACN/Serial/Return #" />
          </div>
        </div>

        <div v-if="loading" class="py-6 text-center">
          <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
        </div>

        <div v-else>
          <table class="min-w-full divide-y divide-gray-200">
            <thead class="bg-gray-50">
              <tr>
                <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Return #</th>
                <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">ACN</th>
                <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Serial</th>
                <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Product</th>
                <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Supplier</th>
                <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Created</th>
                <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Action</th>
              </tr>
            </thead>
            <tbody class="bg-white divide-y divide-gray-200">
              <tr v-for="ret in filteredReturns" :key="ret._id" class="hover:bg-gray-50">
                <td class="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{{ ret.returnNumber || ret.logNumber || ret._id }}</td>
                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{{ ret.acn || '—' }}</td>
                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{{ ret.serialNumber || '—' }}</td>
                <td class="px-6 py-4 text-sm text-gray-500">{{ ret.productId?.name || ret.itemName || '—' }}</td>
                <td class="px-6 py-4 text-sm text-gray-500">{{ ret.supplierId?.name || (ret.isWarrantyClaim ? 'Warranty Claim' : '—') }}</td>
                <td class="px-6 py-4 whitespace-nowrap">
                  <span :class="getStatusClass(ret.status, ret)" class="px-2 py-1 text-xs rounded-full">{{ ret.isWarrantyClaim ? 'For Warranty' : formatStatus(ret.status) }}</span>
                </td>
                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{{ formatDate(ret.createdAt) }}</td>
                <td class="px-6 py-4 whitespace-nowrap text-right text-sm font-medium space-x-2" @click.stop>
                  <div class="flex items-center justify-end gap-2">
                    <template v-if="ret.isWarrantyClaim">
                      <button 
                        v-if="ret.status === 'for_warranty'"
                        @click="markPickedUp(ret)" 
                        :disabled="actionLoading === ret._id"
                        class="px-3 py-1 bg-blue-500 text-white rounded text-xs hover:bg-blue-600 disabled:opacity-50"
                      >
                        {{ actionLoading === ret._id ? 'Processing...' : 'Supplier Pick-up' }}
                      </button>
                    </template>
                    <template v-else>
                      <button 
                        v-if="['pending', 'pending_supplier_pickup'].includes(ret.status)"
                        @click="markResolution(ret, 'repaired')" 
                        :disabled="actionLoading === ret._id"
                        class="px-3 py-1 bg-green-500 text-white rounded text-xs hover:bg-green-600 disabled:opacity-50"
                      >
                        {{ actionLoading === ret._id ? '...' : 'Repaired' }}
                      </button>
                      <button 
                        v-if="['pending', 'pending_supplier_pickup'].includes(ret.status)"
                        @click="markResolution(ret, 'replaced')" 
                        :disabled="actionLoading === ret._id"
                        class="px-3 py-1 bg-blue-500 text-white rounded text-xs hover:bg-blue-600 disabled:opacity-50"
                      >
                        {{ actionLoading === ret._id ? '...' : 'Replaced' }}
                      </button>
                      <button 
                        v-if="['pending', 'pending_supplier_pickup'].includes(ret.status)"
                        @click="markResolution(ret, 'refunded')" 
                        :disabled="actionLoading === ret._id"
                        class="px-3 py-1 bg-purple-500 text-white rounded text-xs hover:bg-purple-600 disabled:opacity-50"
                      >
                        {{ actionLoading === ret._id ? '...' : 'Refunded' }}
                      </button>
                    </template>
                    <router-link 
                      :to="ret.isWarrantyClaim ? `/maintenance/logs/${ret._id}` : `/warranty/supplier-returns/${ret._id}`" 
                      class="px-3 py-1 text-gray-600 hover:text-gray-900 border rounded text-xs"
                    >
                      View
                    </router-link>
                  </div>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </Card>

    <!-- Item Selector Modal -->
    <div
      v-if="showItemSelector"
      class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50"
    >
      <div class="bg-white rounded-lg shadow-xl w-full max-w-3xl max-h-[80vh] flex flex-col">
        <div class="p-4 border-b flex justify-between items-center">
          <h3 class="text-lg font-medium">Select Item to Return</h3>
          <button @click="showItemSelector = false" class="text-gray-500 hover:text-gray-700">
            <svg class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>
        <div class="p-4 border-b">
          <input
            v-model="itemSearch"
            type="text"
            placeholder="Search by ACN, serial, or description..."
            class="form-input w-full"
          />
        </div>
        <div class="flex-1 overflow-auto">
          <table class="min-w-full divide-y divide-gray-200">
            <thead class="bg-gray-50">
              <tr>
                <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">ACN</th>
                <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Serial
                </th>
                <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Description
                </th>
                <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Status
                </th>
                <th class="px-6 py-3"></th>
              </tr>
            </thead>
            <tbody class="bg-white divide-y divide-gray-200">
              <tr v-for="item in filteredItems" :key="item._id" class="hover:bg-gray-50">
                <td class="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                  {{ item.acn }}
                </td>
                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  {{ item.serialNumber }}
                </td>
                <td class="px-6 py-4 text-sm text-gray-500">
                  <div class="font-medium">{{ item.productName }}</div>
                  <div class="text-xs text-gray-500">{{ item.model || 'N/A' }}</div>
                </td>
                <td class="px-6 py-4 whitespace-nowrap">
                  <span :class="getStatusClass(item.status)" class="px-2 py-1 text-xs rounded-full">
                    {{ formatStatus(item.status) }}
                  </span>
                </td>
                <td class="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                  <button @click="selectItem(item)" class="text-primary hover:text-primary-dark">
                    Select
                  </button>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
        <div class="p-4 border-t flex justify-end">
          <button @click="showItemSelector = false" class="btn btn-outline-secondary">
            Cancel
          </button>
        </div>
      </div>
    </div>
  </DefaultLayout>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import DefaultLayout from '../../layouts/DefaultLayout.vue'
import Breadcrumb from '@/components/Breadcrumbs/Breadcrumb.vue'
import Card from '@/components/Card/Card.vue'
import axios from '../../utils/axios'
import { format } from 'date-fns'

const router = useRouter()

// List state
const loading = ref(true)
const returns = ref([])
const warrantyLogs = ref([])
const statusFilter = ref('')
const search = ref('')
const showItemSelector = ref(false)
const itemSearch = ref('')
const actionLoading = ref(null)

const fetchReturns = async () => {
  try {
    loading.value = true
    
    const [returnsRes, warrantyRes] = await Promise.all([
      axios.get('/supplier-returns', {
        params: { page: 1, limit: 20 }
      }),
      axios.get('/maintenance/logs', {
        params: { status: 'for_warranty' }
      })
    ])
    
    returns.value = returnsRes.data?.returns || []
    
    const warrantyList = Array.isArray(warrantyRes.data?.logs) ? warrantyRes.data.logs : []
    warrantyLogs.value = warrantyList.map(log => ({
      ...log,
      returnNumber: log.logNumber || log._id,
      isWarrantyClaim: true
    }))
  } catch (error) {
    console.error('Error loading returns:', error)
  } finally {
    loading.value = false
  }
}

const formatDate = (dateString) => {
  if (!dateString) return 'N/A'
  return format(new Date(dateString), 'MMM d, yyyy')
}

const formatStatus = (status) => {
  return status
    .split('_')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ')
}

const getStatusClass = (status, item) => {
  if (item?.isWarrantyClaim) return 'bg-blue-100 text-blue-800'
  
  const classes = {
    for_warranty: 'bg-blue-100 text-blue-800',
    pending_supplier_pickup: 'bg-orange-100 text-orange-800',
    deployed: 'bg-green-100 text-green-800',
    under_repair: 'bg-yellow-100 text-yellow-800',
    warranty_return: 'bg-blue-100 text-blue-800',
    for_disposal: 'bg-red-100 text-red-800',
    returned: 'bg-purple-100 text-purple-800',
    repaired: 'bg-green-100 text-green-800',
    replaced: 'bg-green-100 text-green-800',
    refunded: 'bg-purple-100 text-purple-800',
    completed: 'bg-green-100 text-green-800',
    cancelled: 'bg-red-100 text-red-800'
  }
  return classes[status] || 'bg-gray-100 text-gray-800'
}

const filteredReturns = computed(() => {
  let items = returns.value
  
  if (statusFilter.value === 'for_warranty') {
    items = warrantyLogs.value
  } else if (statusFilter.value) {
    items = returns.value.filter(r => r.status === statusFilter.value)
  } else {
    items = [...returns.value, ...warrantyLogs.value]
  }
  
  const q = search.value.trim().toLowerCase()
  if (!q) return items
  
  return items.filter((r) => {
    return (
      (r.returnNumber || '').toLowerCase().includes(q) ||
      (r.acn || '').toLowerCase().includes(q) ||
      (r.serialNumber || '').toLowerCase().includes(q) ||
      (r.logNumber || '').toLowerCase().includes(q)
    )
  })
})

const filteredItems = computed(() => {
  return []
})

const markPickedUp = async (warranty) => {
  try {
    actionLoading.value = warranty._id
    await axios.patch(`/maintenance/logs/${warranty._id}`, {
      status: 'for_warranty_picked_up',
      remarks: `Warranty claim picked up by supplier`
    })
    await fetchReturns()
  } catch (error) {
    console.error('Error marking pick-up:', error)
    alert('Failed to mark pick-up')
  } finally {
    actionLoading.value = null
  }
}

const markResolution = async (item, resolution) => {
  try {
    actionLoading.value = item._id
    const payload = {
      resolution,
      resolutionDate: new Date().toISOString(),
      status: resolution === 'repaired' ? 'repaired' : resolution === 'replaced' ? 'replaced' : 'refunded'
    }
    await axios.patch(`/supplier-returns/${item._id}`, payload)
    await fetchReturns()
  } catch (error) {
    console.error('Error updating resolution:', error)
    alert('Failed to update resolution')
  } finally {
    actionLoading.value = null
  }
}

onMounted(() => {
  fetchReturns()
})
</script>
