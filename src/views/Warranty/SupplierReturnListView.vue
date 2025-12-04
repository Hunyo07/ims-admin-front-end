<template>
  <DefaultLayout>
    <Breadcrumb
      :breadcrumbs="[{ title: 'Supplier Returns', to: '/warranty/supplier-returns' }]"
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
              <option value="pending">Pending</option>
              <option value="scheduled_for_pickup">Scheduled for Pickup</option>
              <option value="picked_up">Picked Up</option>
              <option value="sent_to_supplier">Sent to Supplier</option>
              <option value="under_review">Under Review</option>
              <option value="approved">Approved</option>
              <option value="rejected">Rejected</option>
              <option value="for_replacement">For Replacement</option>
              <option value="repaired">Repaired</option>
              <option value="replaced">Replaced</option>
              <option value="ready_to_claim">Ready to Claim</option>
              <option value="completed">Completed</option>
              <option value="cancelled">Cancelled</option>
            </select>
            <button class="btn btn-outline-secondary" @click="fetchReturns">Refresh</button>
          </div>
          <div>
            <input
              v-model="search"
              type="text"
              class="form-input"
              placeholder="Search by ACN/Serial/Return #"
            />
          </div>
        </div>

        <div v-if="loading" class="py-6 text-center">
          <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
        </div>

        <div
          v-else-if="
            (statusFilter !== 'for_warranty' && filteredReturns.length === 0) ||
            (statusFilter === 'for_warranty' && filteredWarrantyLogs.length === 0)
          "
          class="py-12 text-center"
        >
          <p class="text-gray-500">
            No {{ statusFilter === 'for_warranty' ? 'warranty intake' : 'supplier returns' }} found
          </p>
          <p class="text-sm text-gray-400 mt-2">
            {{
              statusFilter === 'for_warranty'
                ? 'Technicians can tag repair logs as For Warranty to appear here'
                : 'Create a new return to get started'
            }}
          </p>
        </div>

        <div v-else>
          <table class="min-w-full divide-y divide-gray-200">
            <thead class="bg-gray-50">
              <tr>
                <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  {{ statusFilter === 'for_warranty' ? 'Repair Log #' : 'Return #' }}
                </th>
                <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">ACN</th>
                <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Serial
                </th>
                <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Product
                </th>
                <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Supplier
                </th>
                <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Status
                </th>
                <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Created
                </th>
                <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Action
                </th>
              </tr>
            </thead>
            <tbody class="bg-white divide-y divide-gray-200">
              <!-- Intake mode: show Repair Logs marked For Warranty -->
              <tr v-if="statusFilter === 'for_warranty' && filteredWarrantyLogs.length === 0">
                <td colspan="8" class="px-6 py-4 text-center text-sm text-gray-500">
                  No items awaiting warranty intake
                </td>
              </tr>
              <tr
                v-else-if="statusFilter === 'for_warranty'"
                v-for="log in filteredWarrantyLogs"
                :key="log._id"
                class="hover:bg-gray-50"
              >
                <td class="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                  {{ log.logNumber }}
                </td>
                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  {{ log.acn || '—' }}
                </td>
                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  {{ log.serialNumber || '—' }}
                </td>
                <td class="px-6 py-4 text-sm text-gray-500">
                  {{
                    log.product?.name ||
                    log.productName ||
                    log.inventoryRecordId?.items?.find(
                      (i) => i.acn === log.acn || i.serialNumber === log.serialNumber
                    )?.description ||
                    '—'
                  }}
                </td>
                <td class="px-6 py-4 text-sm text-gray-500">
                  {{
                    log.supplier?.name ||
                    log.inventoryRecordId?.items?.find(
                      (i) => i.acn === log.acn || i.serialNumber === log.serialNumber
                    )?.warranty?.supplierId?.name ||
                    '—'
                  }}
                </td>
                <td class="px-6 py-4 whitespace-nowrap">
                  <span class="px-2 py-1 text-xs rounded-full bg-blue-100 text-blue-800"
                    >For Warranty</span
                  >
                </td>
                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  {{ formatDate(log.createdAt) }}
                </td>
                <td class="px-6 py-4 whitespace-nowrap text-right text-sm font-medium" @click.stop>
                  <div class="flex items-center justify-end gap-2">
                    <button
                      class="px-3 py-1 bg-primary text-white rounded text-xs hover:bg-primary/90"
                      @click="openWarrantyPickupModal(log)"
                    >
                      {{ log.status === 'for_warranty_picked_up' ? 'Action' : 'Pick-up' }}
                    </button>
                  </div>
                </td>
              </tr>

              <!-- Normal mode: Supplier Returns -->
              <tr v-else v-for="ret in filteredReturns" :key="ret._id" class="hover:bg-gray-50">
                <td class="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                  {{ ret.returnNumber || ret.logNumber || ret._id }}
                </td>
                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  {{ ret.acn || '—' }}
                </td>
                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  {{ ret.serialNumber || '—' }}
                </td>
                <td class="px-6 py-4 text-sm text-gray-500">
                  {{ ret.productId?.name || ret.itemName || '—' }}
                </td>
                <td class="px-6 py-4 text-sm text-gray-500">
                  {{ ret.supplierId?.name || (ret.isWarrantyClaim ? 'Warranty Claim' : '—') }}
                </td>
                <td class="px-6 py-4 whitespace-nowrap">
                  <span
                    :class="getStatusClass(ret.status, ret)"
                    class="px-2 py-1 text-xs rounded-full"
                    >{{ ret.isWarrantyClaim ? 'For Warranty' : formatStatus(ret.status) }}</span
                  >
                </td>
                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  {{ formatDate(ret.createdAt) }}
                </td>
                <td
                  class="px-6 py-4 whitespace-nowrap text-right text-sm font-medium space-x-2"
                  @click.stop
                >
                  <div class="flex items-center justify-end gap-2">
                    <button
                      v-if="ret.isWarrantyClaim && ret.status === 'pending'"
                      @click="openPickupModal(ret)"
                      :disabled="actionLoading === ret._id"
                      class="px-3 py-1 bg-blue-500 text-white rounded text-xs hover:bg-blue-600 disabled:opacity-50"
                    >
                      {{ actionLoading === ret._id ? '...' : 'Pick-up' }}
                    </button>
                    <button
                      v-if="['picked_up', 'sent_to_supplier'].includes(ret.status)"
                      @click="router.push(`/warranty/supplier-returns/${ret._id}`)"
                      class="px-3 py-1 bg-purple-500 text-white rounded text-xs hover:bg-purple-600"
                    >
                      For Replacement
                    </button>
                    <router-link
                      :to="`/warranty/supplier-returns/${ret._id}`"
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

    <!-- Warranty Intake Pick-up Modal (from Repair Log marked For Warranty) -->
    <div
      v-if="showWarrantyPickupModal"
      class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50"
    >
      <div class="bg-white rounded-lg shadow-xl w-full max-w-md">
        <div class="p-5">
          <div class="flex justify-between items-center mb-4">
            <h3 class="text-lg font-medium">
              {{
                selectedWarrantyLog?.status === 'for_warranty_picked_up'
                  ? 'Warranty Action'
                  : 'Pick-up'
              }}
            </h3>
            <button @click="closeWarrantyPickupModal" class="text-gray-500 hover:text-gray-700">
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

          <div v-if="selectedWarrantyLog" class="mb-4 bg-gray-50 rounded p-3 text-sm">
            <div class="grid grid-cols-2 gap-3">
              <div>
                <div class="text-gray-500">Repair Log #</div>
                <div class="font-medium">{{ selectedWarrantyLog.logNumber }}</div>
              </div>
              <div>
                <div class="text-gray-500">ACN</div>
                <div class="font-medium">{{ selectedWarrantyLog.acn || '—' }}</div>
              </div>
              <div>
                <div class="text-gray-500">Serial</div>
                <div class="font-medium">{{ selectedWarrantyLog.serialNumber || '—' }}</div>
              </div>
              <div>
                <div class="text-gray-500">Supplier</div>
                <div class="font-medium">
                  {{ selectedWarrantyLog.supplier?.name || '—' }}
                </div>
              </div>
            </div>
          </div>

          <form @submit.prevent="submitWarrantyPickup">
            <div class="space-y-4">
              <div>
                <label class="block text-sm font-medium text-gray-700 mb-1">
                  Pickup Date & Time <span class="text-red-500">*</span>
                </label>
                <input
                  v-model="warrantyPickupData.pickupDate"
                  type="datetime-local"
                  class="form-input w-full"
                  required
                />
              </div>

              <div>
                <label class="block text-sm font-medium text-gray-700 mb-1">
                  Contact Person <span class="text-red-500">*</span>
                </label>
                <input
                  v-model="warrantyPickupData.contactPerson"
                  type="text"
                  class="form-input w-full"
                  placeholder="Enter contact person name"
                  required
                />
              </div>

              <div>
                <label class="block text-sm font-medium text-gray-700 mb-1"> Supplier </label>
                <input
                  :value="selectedWarrantyLog?.supplier?.name || ''"
                  type="text"
                  class="form-input w-full bg-gray-100"
                  disabled
                />
              </div>

              <div>
                <label class="block text-sm font-medium text-gray-700 mb-1"> Notes </label>
                <textarea
                  v-model="warrantyPickupData.notes"
                  rows="3"
                  class="form-textarea w-full"
                  placeholder="Add any pickup instructions or notes..."
                ></textarea>
              </div>
            </div>

            <div class="mt-6 flex justify-end space-x-3">
              <button
                type="button"
                @click="closeWarrantyPickupModal"
                class="btn btn-outline-secondary"
                :disabled="processingWarrantyPickup"
              >
                Cancel
              </button>
              <button type="submit" class="btn btn-primary" :disabled="processingWarrantyPickup">
                <span v-if="processingWarrantyPickup" class="inline-flex items-center">
                  <svg
                    class="animate-spin -ml-1 mr-2 h-4 w-4 text-white"
                    xmlns="http://www.w3.org/2000/svg"
                    fill="none"
                    viewBox="0 0 24 24"
                  >
                    <circle
                      class="opacity-25"
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      stroke-width="4"
                    ></circle>
                    <path
                      class="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                    ></path>
                  </svg>
                  Processing...
                </span>
                <span v-else>
                  {{
                    selectedWarrantyLog?.status === 'for_warranty_picked_up'
                      ? 'Save'
                      : 'Confirm Pick-up'
                  }}
                </span>
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>

    <!-- Pickup Modal -->
    <div
      v-if="showPickupModal"
      class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50"
    >
      <div class="bg-white rounded-lg shadow-xl w-full max-w-md">
        <div class="p-5">
          <div class="flex justify-between items-center mb-4">
            <h3 class="text-lg font-medium">Schedule Pick-up</h3>
            <button @click="closePickupModal" class="text-gray-500 hover:text-gray-700">
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

          <form @submit.prevent="submitPickup">
            <div class="space-y-4">
              <div>
                <label class="block text-sm font-medium text-gray-700 mb-1">
                  Pickup Date & Time <span class="text-red-500">*</span>
                </label>
                <input
                  v-model="pickupData.pickupDate"
                  type="datetime-local"
                  class="form-input w-full"
                  required
                />
              </div>

              <div>
                <label class="block text-sm font-medium text-gray-700 mb-1">
                  Courier <span class="text-red-500">*</span>
                </label>
                <input
                  v-model="pickupData.supplier"
                  type="text"
                  class="form-input w-full"
                  placeholder="Enter courier name"
                  required
                />
              </div>

              <div>
                <label class="block text-sm font-medium text-gray-700 mb-1">
                  Contact Person <span class="text-red-500">*</span>
                </label>
                <input
                  v-model="pickupData.contactPerson"
                  type="text"
                  class="form-input w-full"
                  placeholder="Enter contact person name"
                  required
                />
              </div>

              <div>
                <label class="block text-sm font-medium text-gray-700 mb-1"> Notes </label>
                <textarea
                  v-model="pickupData.notes"
                  rows="3"
                  class="form-textarea w-full"
                  placeholder="Add any pickup instructions or notes..."
                ></textarea>
              </div>
            </div>

            <div class="mt-6 flex justify-end space-x-3">
              <button
                type="button"
                @click="closePickupModal"
                class="btn btn-outline-secondary"
                :disabled="processingPickup"
              >
                Cancel
              </button>
              <button type="submit" class="btn btn-primary" :disabled="processingPickup">
                <span v-if="processingPickup" class="inline-flex items-center">
                  <svg
                    class="animate-spin -ml-1 mr-2 h-4 w-4 text-white"
                    xmlns="http://www.w3.org/2000/svg"
                    fill="none"
                    viewBox="0 0 24 24"
                  >
                    <circle
                      class="opacity-25"
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      stroke-width="4"
                    ></circle>
                    <path
                      class="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                    ></path>
                  </svg>
                  Scheduling...
                </span>
                <span v-else>Schedule Pick-up</span>
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>

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
import Swal from 'sweetalert2'
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
// Existing pickup modal for Supplier Return rows
const showPickupModal = ref(false)
const itemSearch = ref('')
const actionLoading = ref(null)
const processingPickup = ref(false)
const selectedReturn = ref(null)

// Warranty intake (Repair Log) pick-up state
const showWarrantyPickupModal = ref(false)
const selectedWarrantyLog = ref(null)
const processingWarrantyPickup = ref(false)
const warrantyPickupData = ref({
  pickupDate: '',
  contactPerson: '',
  notes: ''
})

// Pickup form data
const pickupData = ref({
  pickupDate: '',
  supplier: '',
  contactPerson: '',
  notes: ''
})

const fetchReturns = async () => {
  try {
    loading.value = true

    console.log('Fetching supplier returns...')

    const returnsRes = await axios.get('supplier-returns', {
      params: { page: 1, limit: 100 }
    })

    console.log('Returns response:', returnsRes.data)

    returns.value = returnsRes.data?.returns || []
    // Also fetch intake items (repair logs marked for warranty)
    await fetchWarrantyLogs()

    console.log('Total supplier returns:', returns.value.length)

    // If there are no supplier returns yet but there are intake logs,
    // auto-switch the view to the For Warranty intake to avoid showing an empty list
    if (
      (!returns.value || returns.value.length === 0) &&
      warrantyLogs.value &&
      warrantyLogs.value.length > 0
    ) {
      statusFilter.value = 'for_warranty'
    }
  } catch (error) {
    console.error('Error loading returns:', error)
    console.error('Error details:', error.response?.data)

    await Swal.fire({
      icon: 'error',
      title: 'Error Loading Data',
      text: error.response?.data?.message || 'Failed to load supplier returns'
    })

    returns.value = []
    warrantyLogs.value = []
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
    pending: 'bg-yellow-100 text-yellow-800',
    scheduled_for_pickup: 'bg-blue-100 text-blue-800',
    picked_up: 'bg-indigo-100 text-indigo-800',
    sent_to_supplier: 'bg-blue-100 text-blue-800',
    under_review: 'bg-purple-100 text-purple-800',
    approved: 'bg-green-100 text-green-800',
    rejected: 'bg-red-100 text-red-800',
    for_replacement: 'bg-orange-100 text-orange-800',
    deployed: 'bg-green-100 text-green-800',
    under_repair: 'bg-yellow-100 text-yellow-800',
    warranty_return: 'bg-blue-100 text-blue-800',
    for_disposal: 'bg-red-100 text-red-800',
    returned: 'bg-purple-100 text-purple-800',
    repaired: 'bg-teal-100 text-teal-800',
    replaced: 'bg-indigo-100 text-indigo-800',
    ready_to_claim: 'bg-cyan-100 text-cyan-800',
    refunded: 'bg-pink-100 text-pink-800',
    completed: 'bg-green-100 text-green-800',
    cancelled: 'bg-gray-100 text-gray-800'
  }
  return classes[status] || 'bg-gray-100 text-gray-800'
}

const filteredReturns = computed(() => {
  let items = returns.value

  // Filter by status if selected
  if (statusFilter.value) {
    if (statusFilter.value === 'for_warranty') {
      items = items.filter((r) => r.isWarrantyClaim)
    } else {
      items = items.filter((r) => r.status === statusFilter.value)
    }
  }

  // Filter by search query
  const q = search.value.trim().toLowerCase()
  if (!q) return items

  return items.filter((r) => {
    return (
      (r.returnNumber || '').toLowerCase().includes(q) ||
      (r.acn || '').toLowerCase().includes(q) ||
      (r.serialNumber || '').toLowerCase().includes(q)
    )
  })
})

const filteredItems = computed(() => {
  return []
})

// Fetch Repair Logs and filter locally for warranty intake statuses
const fetchWarrantyLogs = async () => {
  try {
    // Fetch without status filter then filter locally (more resilient to API variations)
    const res = await axios.get('maintenance/logs', {
      params: { page: 1, limit: 100 }
    })
    // listRepairLogs typically returns { success, logs } — but also support raw array variants
    const raw = res.data?.logs || res.data?.data || res.data || []
    const list = Array.isArray(raw) ? raw : raw.logs || []
    // Keep only logs tagged for warranty intake
    const intakeStatuses = new Set(['for_warranty', 'for_warranty_picked_up'])
    warrantyLogs.value = list.filter((l) =>
      intakeStatuses.has(String(l?.status || '').toLowerCase())
    )
    console.log('Warranty intake logs:', warrantyLogs.value.length)
  } catch (e) {
    console.error('Failed to load warranty intake logs', e)
    warrantyLogs.value = []
  }
}

// Filter intake logs by search query
const filteredWarrantyLogs = computed(() => {
  const q = search.value.trim().toLowerCase()
  if (!q) return warrantyLogs.value
  return warrantyLogs.value.filter(
    (l) =>
      (l.logNumber || '').toLowerCase().includes(q) ||
      (l.acn || '').toLowerCase().includes(q) ||
      (l.serialNumber || '').toLowerCase().includes(q)
  )
})

// Warranty pickup from Repair Log flow
const openWarrantyPickupModal = (log) => {
  selectedWarrantyLog.value = log
  warrantyPickupData.value = {
    pickupDate: '',
    contactPerson: log.contactPerson || log.broughtBy?.name || '',
    notes: ''
  }
  showWarrantyPickupModal.value = true
}

const closeWarrantyPickupModal = () => {
  showWarrantyPickupModal.value = false
  selectedWarrantyLog.value = null
  warrantyPickupData.value = {
    pickupDate: '',
    contactPerson: '',
    notes: ''
  }
}

const submitWarrantyPickup = async () => {
  if (!selectedWarrantyLog.value) return

  try {
    processingWarrantyPickup.value = true

    const log = selectedWarrantyLog.value

    // Step 1: create a supplier return if not yet created
    const createPayload = {
      acn: log.acn,
      serialNumber: log.serialNumber,
      isWarrantyClaim: true,
      repairLogId: log._id,
      reason: 'warranty_claim',
      issueDescription:
        log.reportedIssue ||
        `Warranty claim created from Repair Log #${log.logNumber || ''}`.trim(),
      notes: warrantyPickupData.value.notes || undefined
    }

    // Try to get supplierId from various sources
    if (log.supplier?._id) {
      createPayload.supplierId = log.supplier._id
    } else if (log.supplier && typeof log.supplier === 'string') {
      createPayload.supplierId = log.supplier
    } else if (log.inventoryRecordId?.items) {
      // Find matching item in inventory record
      const item = log.inventoryRecordId.items.find(
        (i) => i.acn === log.acn || i.serialNumber === log.serialNumber
      )
      if (item?.warranty?.supplierId) {
        createPayload.supplierId =
          typeof item.warranty.supplierId === 'object'
            ? item.warranty.supplierId._id || item.warranty.supplierId
            : item.warranty.supplierId
      } else if (item?.supplierId) {
        createPayload.supplierId =
          typeof item.supplierId === 'object'
            ? item.supplierId._id || item.supplierId
            : item.supplierId
      }
    }

    // Also include productId if available
    if (log.product?._id) {
      createPayload.productId = log.product._id
    } else if (log.product && typeof log.product === 'string') {
      createPayload.productId = log.product
    } else if (log.inventoryRecordId?.items) {
      const item = log.inventoryRecordId.items.find(
        (i) => i.acn === log.acn || i.serialNumber === log.serialNumber
      )
      if (item?.productId) {
        createPayload.productId =
          typeof item.productId === 'object' ? item.productId._id || item.productId : item.productId
      }
    }

    const createRes = await axios.post('supplier-returns', createPayload)
    const created = createRes.data?.supplierReturn || createRes.data
    const returnId = created?._id

    if (!returnId) {
      throw new Error('Supplier return was created but no ID was returned')
    }

    const pickupCourier = created?.supplierId?.name || log.supplier?.name || 'Supplier'
    const pickupNotes = `Contact Person: ${warrantyPickupData.value.contactPerson}\n${
      warrantyPickupData.value.notes || ''
    }`
    const pickupDate = warrantyPickupData.value.pickupDate || new Date().toISOString()

    // Step 2: mark pickup scheduled (required before confirm)
    await axios.post(`supplier-returns/${returnId}/schedule-pickup`, {
      scheduledPickupDate: pickupDate,
      pickupCourier,
      pickupNotes
    })

    // Step 3: immediately confirm pick-up
    await axios.post(`supplier-returns/${returnId}/confirm-pickup`, {
      actualPickupDate: pickupDate,
      pickupTrackingNumber: '',
      pickupNotes
    })

    // Step 4: update repair log details
    await axios.patch(`maintenance/logs/${log._id}`, {
      status: 'for_warranty_picked_up',
      warrantyPickup: {
        pickupDate: pickupDate,
        contactPerson: warrantyPickupData.value.contactPerson,
        notes: warrantyPickupData.value.notes,
        supplierReturnId: returnId
      }
    })

    await Swal.fire({
      icon: 'success',
      title: 'Success',
      text: 'Warranty pick-up recorded successfully!'
    })

    closeWarrantyPickupModal()
    await fetchReturns()
  } catch (error) {
    console.error('Error processing warranty pick-up:', error)
    await Swal.fire({
      icon: 'error',
      title: 'Error',
      text: error.response?.data?.message || 'Failed to schedule warranty pick-up'
    })
  } finally {
    processingWarrantyPickup.value = false
  }
}

const openPickupModal = (item) => {
  selectedReturn.value = item
  // Pre-fill notes with supplier info if available
  pickupData.value.supplier = ''
  pickupData.value.contactPerson = item.supplierId?.contactPerson || ''
  showPickupModal.value = true
}

const closePickupModal = () => {
  showPickupModal.value = false
  selectedReturn.value = null
  // Reset form
  pickupData.value = {
    pickupDate: '',
    supplier: '',
    contactPerson: '',
    notes: ''
  }
}

const submitPickup = async () => {
  if (!selectedReturn.value) return

  try {
    processingPickup.value = true

    const payload = {
      scheduledPickupDate: pickupData.value.pickupDate,
      pickupCourier: pickupData.value.supplier,
      pickupNotes: `Contact Person: ${pickupData.value.contactPerson}\n${
        pickupData.value.notes || ''
      }`
    }

    console.log('Submitting pickup:', payload)

    // Schedule pickup using dedicated endpoint
    await axios.post(`supplier-returns/${selectedReturn.value._id}/schedule-pickup`, payload)

    await Swal.fire({
      icon: 'success',
      title: 'Success',
      text: 'Pickup scheduled successfully!'
    })

    closePickupModal()
    await fetchReturns()
  } catch (error) {
    console.error('Error processing pickup:', error)
    await Swal.fire({
      icon: 'error',
      title: 'Error',
      text: error.response?.data?.message || 'Failed to process pick-up'
    })
  } finally {
    processingPickup.value = false
  }
}

onMounted(() => {
  fetchReturns()
})
</script>
