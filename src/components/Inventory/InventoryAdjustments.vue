<script setup>
import { ref, onMounted, computed } from 'vue'
import axios from 'axios'
import { useAuthStore } from '@/stores/auth'
import Swal from 'sweetalert2'
import Datepicker from '@vuepic/vue-datepicker'
import '@vuepic/vue-datepicker/dist/main.css'

const authStore = useAuthStore()
const adjustments = ref([])
const products = ref([])
const isLoading = ref(false)
const showCreateModal = ref(false)
const showDetailsModal = ref(false)
const selectedAdjustment = ref(null)
const searchQuery = ref('')
const adjustmentTypeFilter = ref('all')

// Form data for creating a new adjustment
const newAdjustment = ref({
  productId: '',
  adjustmentType: 'addition', // Default type
  newQuantity: 0,
  reason: '',
  notes: '',
  reference: ''
})

// Fetch all stock adjustments
const fetchAdjustments = async () => {
  try {
    isLoading.value = true
    const response = await axios.get('http://localhost:5000/api/inventory/adjustments', {
      headers: {
        Authorization: `Bearer ${authStore.token}`
      }
    })

    adjustments.value = response.data.adjustments
  } catch (error) {
    console.error('Error fetching stock adjustments:', error)
    Swal.fire({
      icon: 'error',
      title: 'Error',
      text: 'Failed to fetch stock adjustments'
    })
  } finally {
    isLoading.value = false
  }
}

// Fetch products
const fetchProducts = async () => {
  try {
    const response = await axios.get('http://localhost:5000/api/products', {
      headers: {
        Authorization: `Bearer ${authStore.token}`
      }
    })
    products.value = response.data.products
  } catch (error) {
    console.error('Error fetching products:', error)
  }
}

// Set current quantity when product is selected
const setCurrentQuantity = async () => {
  const productId = newAdjustment.value.productId
  if (productId) {
    try {
      const response = await axios.get(`http://localhost:5000/api/products/${productId}`, {
        headers: {
          Authorization: `Bearer ${authStore.token}`
        }
      })

      // Store the current quantity for reference
      newAdjustment.value.currentQuantity = response.data.product.currentStock || 0
      newAdjustment.value.newQuantity = response.data.product.currentStock || 0
    } catch (error) {
      console.error('Error fetching product inventory:', error)
    }
  }
}

// Create a new stock adjustment
const createAdjustment = async () => {
  try {
    // Validate form
    if (!newAdjustment.value.productId) {
      Swal.fire({
        icon: 'warning',
        title: 'Missing Information',
        text: 'Please select a product'
      })
      return
    }

    if (!newAdjustment.value.reason) {
      Swal.fire({
        icon: 'warning',
        title: 'Missing Information',
        text: 'Please provide a reason for this adjustment'
      })
      return
    }

    isLoading.value = true

    // Prepare the payload
    const payload = {
      productId: newAdjustment.value.productId,
      adjustmentType: newAdjustment.value.adjustmentType,
      newQuantity: newAdjustment.value.newQuantity,
      reason: newAdjustment.value.reason,
      notes: newAdjustment.value.notes,
      reference: newAdjustment.value.reference
    }

    const response = await axios.post('http://localhost:5000/api/inventory/adjustments', payload, {
      headers: {
        Authorization: `Bearer ${authStore.token}`
      }
    })

    Swal.fire({
      icon: 'success',
      title: 'Success',
      text: 'Stock adjustment created successfully'
    })

    // Reset form and close modal
    resetForm()
    showCreateModal.value = false

    // Refresh adjustments list
    await fetchAdjustments()
  } catch (error) {
    console.error('Error creating stock adjustment:', error)
    Swal.fire({
      icon: 'error',
      title: 'Error',
      text: error.response?.data?.message || 'Failed to create stock adjustment'
    })
  } finally {
    isLoading.value = false
  }
}

// Reset the form
const resetForm = () => {
  newAdjustment.value = {
    productId: '',
    adjustmentType: 'addition',
    newQuantity: 0,
    currentQuantity: 0,
    reason: '',
    notes: '',
    reference: ''
  }
}

// View adjustment details
const viewAdjustmentDetails = async (adjustmentId) => {
  try {
    isLoading.value = true
    const response = await axios.get(
      `http://localhost:5000/api/inventory/adjustments/${adjustmentId}`,
      {
        headers: {
          Authorization: `Bearer ${authStore.token}`
        }
      }
    )
    selectedAdjustment.value = response.data.adjustment
    showDetailsModal.value = true
  } catch (error) {
    console.error('Error fetching adjustment details:', error)
    Swal.fire({
      icon: 'error',
      title: 'Error',
      text: 'Failed to fetch adjustment details'
    })
  } finally {
    isLoading.value = false
  }
}

// Filter adjustments by type and search query
const filteredAdjustments = computed(() => {
  let filtered = adjustments.value || []

  // Filter by adjustment type
  if (adjustmentTypeFilter.value !== 'all') {
    filtered = filtered.filter((adj) => adj.adjustmentType === adjustmentTypeFilter.value)
  }

  // Filter by search query
  if (searchQuery.value) {
    const query = searchQuery.value.toLowerCase()
    filtered = filtered.filter(
      (adj) =>
        adj.product.name.toLowerCase().includes(query) ||
        adj.product.sku.toLowerCase().includes(query) ||
        adj.reason.toLowerCase().includes(query)
    )
  }

  return filtered
})

// Format date
const formatDate = (dateString) => {
  if (!dateString) return 'N/A'
  return new Date(dateString).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric'
  })
}

// Get adjustment type badge class
const getAdjustmentTypeClass = (type) => {
  switch (type) {
    case 'addition':
      return 'bg-success text-white'
    case 'reduction':
      return 'bg-warning text-white'
    case 'damage':
      return 'bg-danger text-white'
    case 'loss':
      return 'bg-danger text-white'
    case 'count':
      return 'bg-info text-white'
    case 'return':
      return 'bg-primary text-white'
    default:
      return 'bg-gray-500 text-white'
  }
}

// Get formatted adjustment type name
const getAdjustmentTypeName = (type) => {
  switch (type) {
    case 'addition':
      return 'Addition'
    case 'reduction':
      return 'Reduction'
    case 'damage':
      return 'Damage'
    case 'loss':
      return 'Loss'
    case 'count':
      return 'Count'
    case 'return':
      return 'Return'
    default:
      return type.charAt(0).toUpperCase() + type.slice(1)
  }
}

onMounted(async () => {
  await Promise.all([fetchAdjustments(), fetchProducts()])
})
</script>

<template>
  <div
    class="rounded-sm border border-stroke bg-white shadow-default dark:border-strokedark dark:bg-boxdark"
  >
    <!-- Header -->
    <div class="border-b border-stroke py-4 px-6.5 dark:border-strokedark">
      <div class="flex flex-wrap items-center justify-between gap-4">
        <h3 class="text-xl font-semibold text-black dark:text-white">Stock Adjustments</h3>
        <div class="flex items-center gap-3">
          <button
            @click="showCreateModal = true"
            class="inline-flex items-center justify-center rounded-md bg-primary py-2 px-4 text-white hover:bg-opacity-90"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              class="h-5 w-5 mr-1"
              viewBox="0 0 20 20"
              fill="currentColor"
            >
              <path
                fill-rule="evenodd"
                d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z"
                clip-rule="evenodd"
              />
            </svg>
            New Adjustment
          </button>
        </div>
      </div>
    </div>

    <!-- Filter and Search -->
    <div class="p-4 border-b border-stroke dark:border-strokedark">
      <div class="flex flex-wrap items-center gap-4">
        <div class="flex-1">
          <input
            type="text"
            v-model="searchQuery"
            placeholder="Search by product, SKU, or reason..."
            class="w-full rounded-lg border border-stroke bg-transparent py-2 pl-4 pr-4 outline-none focus:border-primary dark:border-strokedark"
          />
        </div>
        <div>
          <select
            v-model="adjustmentTypeFilter"
            class="rounded-lg border border-stroke bg-transparent py-2 px-4 outline-none focus:border-primary dark:border-strokedark"
          >
            <option value="all">All Types</option>
            <option value="addition">Addition</option>
            <option value="reduction">Reduction</option>
            <option value="damage">Damage</option>
            <option value="loss">Loss</option>
            <option value="count">Count</option>
            <option value="return">Return</option>
          </select>
        </div>
      </div>
    </div>

    <!-- Adjustments Table -->
    <div class="p-4">
      <div v-if="isLoading" class="flex justify-center items-center py-10">
        <div class="animate-spin rounded-full h-10 w-10 border-b-2 border-primary"></div>
      </div>

      <div v-else-if="filteredAdjustments.length === 0" class="text-center py-10">
        <p class="text-lg text-gray-500 dark:text-gray-400">No stock adjustments found</p>
      </div>

      <div v-else class="overflow-x-auto">
        <table class="w-full table-auto">
          <thead>
            <tr class="bg-gray-2 text-left dark:bg-meta-4">
              <th class="py-4 px-4 font-medium text-black dark:text-white">Product</th>
              <th class="py-4 px-4 font-medium text-black dark:text-white">Type</th>
              <th class="py-4 px-4 font-medium text-black dark:text-white">Previous Qty</th>
              <th class="py-4 px-4 font-medium text-black dark:text-white">New Qty</th>
              <th class="py-4 px-4 font-medium text-black dark:text-white">Change</th>
              <th class="py-4 px-4 font-medium text-black dark:text-white">Reason</th>
              <th class="py-4 px-4 font-medium text-black dark:text-white">Date</th>
              <th class="py-4 px-4 font-medium text-black dark:text-white">Actions</th>
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="adjustment in filteredAdjustments"
              :key="adjustment._id"
              class="border-b border-stroke dark:border-strokedark"
            >
              <td class="py-3 px-4">
                {{ adjustment.product.name }}
                <div class="text-xs text-gray-500">{{ adjustment.product.sku }}</div>
              </td>
              <td class="py-3 px-4">
                <span
                  :class="`px-2.5 py-0.5 rounded-full text-xs font-medium ${getAdjustmentTypeClass(
                    adjustment.adjustmentType
                  )}`"
                >
                  {{ getAdjustmentTypeName(adjustment.adjustmentType) }}
                </span>
              </td>
              <td class="py-3 px-4">{{ adjustment.previousQuantity }}</td>
              <td class="py-3 px-4">{{ adjustment.newQuantity }}</td>
              <td class="py-3 px-4">
                <span
                  :class="`${adjustment.adjustmentQuantity > 0 ? 'text-success' : 'text-danger'}`"
                >
                  {{ adjustment.adjustmentQuantity > 0 ? '+' : ''
                  }}{{ adjustment.adjustmentQuantity }}
                </span>
              </td>
              <td class="py-3 px-4">{{ adjustment.reason }}</td>
              <td class="py-3 px-4">{{ formatDate(adjustment.createdAt) }}</td>
              <td class="py-3 px-4">
                <button
                  @click="viewAdjustmentDetails(adjustment._id)"
                  class="hover:text-primary"
                  title="View Details"
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    class="h-5 w-5"
                    viewBox="0 0 20 20"
                    fill="currentColor"
                  >
                    <path d="M10 12a2 2 0 100-4 2 2 0 000 4z" />
                    <path
                      fill-rule="evenodd"
                      d="M.458 10C1.732 5.943 5.522 3 10 3s8.268 2.943 9.542 7c-1.274 4.057-5.064 7-9.542 7S1.732 14.057.458 10zM14 10a4 4 0 11-8 0 4 4 0 018 0z"
                      clip-rule="evenodd"
                    />
                  </svg>
                </button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  </div>

  <!-- Create Adjustment Modal -->
  <div
    v-if="showCreateModal"
    class="fixed inset-0 z-999 flex items-center justify-center bg-black bg-opacity-50"
  >
    <div
      class="w-full max-w-xl max-h-[90vh] overflow-y-auto bg-white dark:bg-boxdark rounded-lg shadow-lg"
    >
      <div class="border-b border-stroke px-6.5 py-4 dark:border-strokedark">
        <div class="flex items-center justify-between">
          <h3 class="text-xl font-semibold text-black dark:text-white">New Stock Adjustment</h3>
          <button @click="showCreateModal = false" class="text-gray-500 hover:text-red-500">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              class="h-6 w-6"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>
      </div>

      <div class="p-6.5">
        <div class="mb-4.5">
          <label class="mb-2.5 block text-black dark:text-white">
            Product <span class="text-meta-1">*</span>
          </label>
          <select
            v-model="newAdjustment.productId"
            @change="setCurrentQuantity"
            class="w-full rounded border-[1.5px] border-stroke bg-transparent py-3 px-5 font-medium outline-none transition focus:border-primary active:border-primary disabled:cursor-default disabled:bg-whiter dark:border-form-strokedark dark:bg-form-input dark:focus:border-primary"
          >
            <option value="" disabled>Select Product</option>
            <option v-for="product in products" :key="product._id" :value="product._id">
              {{ product.name }} ({{ product.sku }}) - Current Stock: {{ product.currentStock }}
            </option>
          </select>
        </div>

        <div class="mb-4.5">
          <label class="mb-2.5 block text-black dark:text-white">
            Adjustment Type <span class="text-meta-1">*</span>
          </label>
          <select
            v-model="newAdjustment.adjustmentType"
            class="w-full rounded border-[1.5px] border-stroke bg-transparent py-3 px-5 font-medium outline-none transition focus:border-primary active:border-primary disabled:cursor-default disabled:bg-whiter dark:border-form-strokedark dark:bg-form-input dark:focus:border-primary"
          >
            <option value="addition">Addition</option>
            <option value="reduction">Reduction</option>
            <option value="damage">Damage</option>
            <option value="loss">Loss</option>
            <option value="return">Return</option>
          </select>
        </div>

        <div class="mb-4.5 grid grid-cols-2 gap-6">
          <div>
            <label class="mb-2.5 block text-black dark:text-white">Current Quantity</label>
            <input
              type="number"
              v-model="newAdjustment.currentQuantity"
              readonly
              class="w-full rounded border-[1.5px] border-stroke bg-transparent py-3 px-5 font-medium outline-none transition focus:border-primary active:border-primary disabled:cursor-default disabled:bg-whiter dark:border-form-strokedark dark:bg-form-input dark:focus:border-primary"
            />
          </div>
          <div>
            <label class="mb-2.5 block text-black dark:text-white">
              New Quantity <span class="text-meta-1">*</span>
            </label>
            <input
              type="number"
              v-model.number="newAdjustment.newQuantity"
              min="0"
              class="w-full rounded border-[1.5px] border-stroke bg-transparent py-3 px-5 font-medium outline-none transition focus:border-primary active:border-primary disabled:cursor-default disabled:bg-whiter dark:border-form-strokedark dark:bg-form-input dark:focus:border-primary"
            />
          </div>
        </div>

        <div class="mb-4.5">
          <label class="mb-2.5 block text-black dark:text-white">
            Reason <span class="text-meta-1">*</span>
          </label>
          <input
            type="text"
            v-model="newAdjustment.reason"
            class="w-full rounded border-[1.5px] border-stroke bg-transparent py-3 px-5 font-medium outline-none transition focus:border-primary active:border-primary disabled:cursor-default disabled:bg-whiter dark:border-form-strokedark dark:bg-form-input dark:focus:border-primary"
            placeholder="Reason for adjustment"
          />
        </div>

        <div class="mb-4.5">
          <label class="mb-2.5 block text-black dark:text-white">Reference</label>
          <input
            type="text"
            v-model="newAdjustment.reference"
            class="w-full rounded border-[1.5px] border-stroke bg-transparent py-3 px-5 font-medium outline-none transition focus:border-primary active:border-primary disabled:cursor-default disabled:bg-whiter dark:border-form-strokedark dark:bg-form-input dark:focus:border-primary"
            placeholder="Optional reference number or document"
          />
        </div>

        <div class="mb-4.5">
          <label class="mb-2.5 block text-black dark:text-white">Notes</label>
          <textarea
            v-model="newAdjustment.notes"
            rows="3"
            class="w-full rounded border-[1.5px] border-stroke bg-transparent py-3 px-5 font-medium outline-none transition focus:border-primary active:border-primary disabled:cursor-default disabled:bg-whiter dark:border-form-strokedark dark:bg-form-input dark:focus:border-primary"
            placeholder="Additional notes about this adjustment"
          ></textarea>
        </div>

        <div class="flex items-center justify-end gap-4">
          <button
            @click="showCreateModal = false"
            class="inline-flex items-center justify-center rounded-md border border-stroke py-2 px-6 text-center font-medium text-black hover:border-primary hover:bg-primary hover:text-white dark:border-strokedark dark:text-white"
          >
            Cancel
          </button>
          <button
            @click="createAdjustment"
            class="inline-flex items-center justify-center rounded-md bg-primary py-2 px-6 text-center font-medium text-white hover:bg-opacity-90"
            :disabled="isLoading"
          >
            <span v-if="isLoading" class="mr-2">
              <svg
                class="animate-spin h-5 w-5 text-white"
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
            </span>
            Create Adjustment
          </button>
        </div>
      </div>
    </div>
  </div>

  <!-- Adjustment Details Modal -->
  <div
    v-if="showDetailsModal && selectedAdjustment"
    class="fixed inset-0 z-999 flex items-center justify-center bg-black bg-opacity-50"
  >
    <div
      class="w-full max-w-xl max-h-[90vh] overflow-y-auto bg-white dark:bg-boxdark rounded-lg shadow-lg"
    >
      <div class="border-b border-stroke px-6.5 py-4 dark:border-strokedark">
        <div class="flex items-center justify-between">
          <h3 class="text-xl font-semibold text-black dark:text-white">Adjustment Details</h3>
          <button @click="showDetailsModal = false" class="text-gray-500 hover:text-red-500">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              class="h-6 w-6"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>
      </div>

      <div class="p-6.5">
        <div class="grid grid-cols-2 gap-6 mb-6">
          <div class="col-span-1">
            <h4 class="text-lg font-semibold mb-3">Adjustment Information</h4>
            <div class="space-y-2">
              <p>
                <span class="font-medium">Product:</span>
                {{ selectedAdjustment.product.name }} ({{ selectedAdjustment.product.sku }})
              </p>
              <p>
                <span class="font-medium">Type:</span>
                <span
                  :class="`px-2.5 py-0.5 rounded-full text-xs font-medium ${getAdjustmentTypeClass(
                    selectedAdjustment.adjustmentType
                  )}`"
                >
                  {{ getAdjustmentTypeName(selectedAdjustment.adjustmentType) }}
                </span>
              </p>
              <p>
                <span class="font-medium">Previous Quantity:</span>
                {{ selectedAdjustment.previousQuantity }}
              </p>
              <p>
                <span class="font-medium">New Quantity:</span>
                {{ selectedAdjustment.newQuantity }}
              </p>
              <p>
                <span class="font-medium">Change:</span>
                <span
                  :class="`${
                    selectedAdjustment.adjustmentQuantity > 0 ? 'text-success' : 'text-danger'
                  }`"
                >
                  {{ selectedAdjustment.adjustmentQuantity > 0 ? '+' : ''
                  }}{{ selectedAdjustment.adjustmentQuantity }}
                </span>
              </p>
              <p>
                <span class="font-medium">Reason:</span>
                {{ selectedAdjustment.reason }}
              </p>
              <p v-if="selectedAdjustment.reference">
                <span class="font-medium">Reference:</span>
                {{ selectedAdjustment.reference }}
              </p>
              <p>
                <span class="font-medium">Created:</span>
                {{ formatDate(selectedAdjustment.createdAt) }}
              </p>
              <p>
                <span class="font-medium">Created By:</span>
                {{ selectedAdjustment.createdBy?.user.firstName || 'Unknown' }}
                {{ selectedAdjustment.createdBy?.user.lastName || '' }}
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
