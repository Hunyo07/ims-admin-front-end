<template>
  <DefaultLayout>
    <Breadcrumb
      :breadcrumbs="[
        { title: 'Supplier Returns', to: '/warranty/supplier-returns' },
        { title: 'New Return' }
      ]"
      pageTitle="Create Supplier Return"
    />

    <div class="grid grid-cols-12 gap-5">
      <div class="col-span-12 lg:col-span-8">
        <Card>
          <div class="p-5">
            <h2 class="text-lg font-medium mb-5">Return Details</h2>

            <form @submit.prevent="submitForm">
              <!-- Item Selection -->
              <div class="mb-6">
                <label class="block text-sm font-medium text-gray-700 mb-1">
                  Item to Return <span class="text-red-500">*</span>
                </label>
                <div class="flex space-x-2">
                  <input
                    v-model="form.acn"
                    type="text"
                    placeholder="Enter ACN or Serial Number"
                    class="form-input flex-1"
                    @blur="fetchItemDetails"
                  />
                  <button
                    type="button"
                    class="btn btn-outline-primary"
                    @click="showItemSelector = true"
                  >
                    Browse
                  </button>
                </div>
                <div v-if="itemError" class="mt-1 text-sm text-red-600">
                  {{ itemError }}
                </div>
              </div>

              <!-- Item Details -->
              <div v-if="itemDetails" class="bg-gray-50 p-4 rounded-lg mb-6">
                <div class="flex justify-between items-start">
                  <div>
                    <h4 class="font-medium">{{ itemDetails.productName }}</h4>
                    <div class="text-sm text-gray-600">
                      <div>ACN: {{ itemDetails.acn || '—' }}</div>
                      <div>Serial: {{ itemDetails.serialNumber }}</div>
                      <div>Status: {{ itemDetails.status }}</div>
                    </div>
                  </div>
                  <div v-if="itemDetails.warranty" class="text-right">
                    <div
                      :class="
                        itemDetails.warranty.isUnderWarranty ? 'text-green-600' : 'text-red-600'
                      "
                      class="font-medium"
                    >
                      {{
                        itemDetails.warranty.isUnderWarranty ? 'Under Warranty' : 'Out of Warranty'
                      }}
                    </div>
                    <div class="text-sm text-gray-600">
                      Expires: {{ formatDate(itemDetails.warranty.expiryDate) }}
                    </div>
                  </div>
                </div>
              </div>

              <!-- Return Details -->
              <div class="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                <div>
                  <label class="block text-sm font-medium text-gray-700 mb-1">
                    Return Type <span class="text-red-500">*</span>
                  </label>
                  <select v-model="form.returnType" class="form-select w-full" required>
                    <option value="warranty">Warranty Return</option>
                    <option value="non_warranty">Non-Warranty Return</option>
                  </select>
                </div>

                <div v-if="form.returnType === 'warranty'">
                  <label class="block text-sm font-medium text-gray-700 mb-1">
                    Warranty Number
                  </label>
                  <input
                    v-model="form.warrantyNumber"
                    type="text"
                    class="form-input w-full"
                    :required="form.returnType === 'warranty'"
                  />
                </div>
              </div>

              <div class="mb-6">
                <label class="block text-sm font-medium text-gray-700 mb-1">
                  Reason for Return <span class="text-red-500">*</span>
                </label>
                <select v-model="form.reason" class="form-select w-full mb-3" required>
                  <option value="">Select a reason</option>
                  <option value="defective">Defective Item</option>
                  <option value="wrong_item">Wrong Item Shipped</option>
                  <option value="damaged">Damaged in Transit</option>
                  <option value="not_as_described">Not as Described</option>
                  <option value="other">Other</option>
                </select>

                <label class="block text-sm font-medium text-gray-700 mb-1">
                  Issue Description <span class="text-red-500">*</span>
                </label>
                <textarea
                  v-model="form.issueDescription"
                  rows="3"
                  class="form-textarea w-full"
                  placeholder="Please describe the issue in detail..."
                  required
                ></textarea>
              </div>

              <div class="mb-6">
                <label class="flex items-center">
                  <input
                    type="checkbox"
                    v-model="form.includeAccessories"
                    class="rounded border-gray-300 text-primary focus:ring-primary"
                  />
                  <span class="ml-2 text-sm text-gray-700">
                    Include all accessories and original packaging
                  </span>
                </label>
              </div>

              <div class="flex justify-end space-x-3">
                <router-link to="/warranty/supplier-returns" class="btn btn-outline-secondary">
                  Cancel
                </router-link>
                <button type="submit" class="btn btn-primary" :disabled="!formValid || submitting">
                  <span v-if="submitting" class="inline-flex items-center">
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
                  <span v-else>Submit Return Request</span>
                </button>
              </div>
            </form>
          </div>
        </Card>
      </div>

      <!-- Sidebar -->
      <div class="col-span-12 lg:col-span-4">
        <Card>
          <div class="p-5">
            <h3 class="text-md font-medium mb-3">Return Instructions</h3>
            <div class="prose prose-sm text-gray-600">
              <ol class="list-decimal pl-5 space-y-2">
                <li>
                  Ensure the item is properly packaged to prevent damage during return shipping.
                </li>
                <li>Include all original accessories, manuals, and packaging if available.</li>
                <li>Print and include the return authorization form with your package.</li>
                <li>Use a trackable shipping method and retain the tracking number.</li>
                <li>Returns typically take 7-10 business days to process after receipt.</li>
              </ol>

              <div class="mt-4 p-3 bg-blue-50 rounded-md">
                <h4 class="font-medium text-blue-800">Warranty Returns</h4>
                <p class="text-sm text-blue-700 mt-1">
                  For warranty returns, please ensure the item is still within the warranty period.
                  You may be required to provide proof of purchase.
                </p>
              </div>
            </div>
          </div>
        </Card>
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
                  {{ item.acn || '—' }}
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
import { useRouter, useRoute } from 'vue-router'
import Swal from 'sweetalert2'
import DefaultLayout from '../../layouts/DefaultLayout.vue'
import Breadcrumb from '@/components/Breadcrumbs/Breadcrumb.vue'
import Card from '@/components/Card/Card.vue'
import axios from '../../utils/axios'
import { format } from 'date-fns'

const router = useRouter()
const route = useRoute()

// Form state
const form = ref({
  acn: '',
  serialNumber: '',
  returnType: 'warranty',
  warrantyNumber: '',
  reason: '',
  issueDescription: '',
  includeAccessories: true,
  notes: ''
})

// UI state
const submitting = ref(false)
const showItemSelector = ref(false)
const itemSearch = ref('')
const itemError = ref('')
const itemDetails = ref(null)

// Items browsing placeholder; will be wired later
const items = ref([])

// Computed properties
const filteredItems = computed(() => {
  if (!itemSearch.value) return items.value
  const search = itemSearch.value.toLowerCase()
  return items.value.filter(
    (item) =>
      item.acn.toLowerCase().includes(search) ||
      item.serialNumber.toLowerCase().includes(search) ||
      item.productName.toLowerCase().includes(search) ||
      (item.model && item.model.toLowerCase().includes(search))
  )
})

const formValid = computed(() => {
  return (
    form.value.acn &&
    form.value.reason &&
    form.value.issueDescription &&
    (form.value.returnType !== 'warranty' || form.value.warrantyNumber)
  )
})

// Methods
const fetchItemDetails = async () => {
  const query = (form.value.acn || '').trim()
  if (!query) return

  try {
    const response = await axios.get('warranty/check', {
      params: { acn: query, serialNumber: query }
    })

    const data = response.data
    const itm = data.item || {}
    itemDetails.value = {
      _id: data.itemId,
      acn: itm.acn,
      serialNumber: itm.serialNumber,
      productName: itm.description || 'Item',
      model: '',
      status: itm.status,
      warranty: {
        isUnderWarranty: data.isUnderWarranty,
        expiryDate: data.warranty?.expiryDate,
        warrantyNumber: data.warranty?.warrantyNumber
      },
      inventoryRecordId: data.inventoryRecordId
    }
    form.value.serialNumber = itm.serialNumber || ''
    form.value.warrantyNumber = data.warranty?.warrantyNumber || ''
    itemError.value = ''
  } catch (error) {
    itemDetails.value = null
    console.error('Error fetching item details:', error)
    const msg = error.response?.data?.message || 'Failed to fetch item details'
    itemError.value = msg
    Swal.fire({ icon: 'error', title: 'Error', text: msg })
  }
}

const fetchItems = async () => {
  try {
    const response = await axios.get('warranty/items')
    const list = response.data?.items || []
    items.value = list.map((it) => ({
      _id: it.itemId,
      acn: it.acn,
      serialNumber: it.serialNumber,
      productName: it.productName || 'Item',
      model: it.model || '',
      status: it.status,
      warranty: {
        isUnderWarranty: it.warranty?.isUnderWarranty,
        expiryDate: it.warranty?.expiryDate,
        warrantyNumber: it.warranty?.warrantyNumber
      },
      inventoryRecordId: it.inventoryRecordId
    }))
  } catch (error) {
    console.error('Error fetching warranty items:', error)
    Swal.fire({ icon: 'error', title: 'Error', text: error.response?.data?.message || 'Failed to load warranty items' })
  }
}

const selectItem = (item) => {
  form.value.acn = item.acn
  form.value.serialNumber = item.serialNumber
  itemDetails.value = { ...item }
  form.value.warrantyNumber = item.warranty?.warrantyNumber || ''
  showItemSelector.value = false
  itemError.value = ''
}

const submitForm = async () => {
  if (!formValid.value || !itemDetails.value) return

  submitting.value = true

  try {
    const payload = {
      acn: itemDetails.value.acn,
      serialNumber: itemDetails.value.serialNumber,
      inventoryRecordId: itemDetails.value.inventoryRecordId,
      warrantyNumber: form.value.warrantyNumber || undefined,
      warrantyExpiryDate: itemDetails.value.warranty?.expiryDate || undefined,
      isWarrantyClaim: form.value.returnType === 'warranty',
      reason: form.value.reason,
      issueDescription: form.value.issueDescription,
      notes: form.value.notes || undefined
    }

    // include repairLogId from route query when present
    const repairLogId = route?.query?.repairLogId
    if (repairLogId) {
      payload.repairLogId = repairLogId
    }

    const response = await axios.post('supplier-returns', payload)

    await Swal.fire({ icon: 'success', title: 'Success', text: 'Return request submitted successfully' })
    const createdId = response.data?.supplierReturn?._id
    if (createdId) {
      const pickup = route?.query?.pickup === '1' ? '?pickup=1' : ''
      router.push(`/warranty/supplier-returns/${createdId}${pickup}`)
    } else {
      router.push('/warranty/supplier-returns')
    }
  } catch (error) {
    console.error('Error submitting return:', error)
    Swal.fire({ icon: 'error', title: 'Error', text: error.response?.data?.message || 'Failed to submit return request' })
  } finally {
    submitting.value = false
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

const getStatusClass = (status) => {
  const classes = {
    deployed: 'bg-green-100 text-green-800',
    under_repair: 'bg-yellow-100 text-yellow-800',
    warranty_return: 'bg-blue-100 text-blue-800',
    for_disposal: 'bg-red-100 text-red-800',
    returned: 'bg-purple-100 text-purple-800'
  }
  return classes[status] || 'bg-gray-100 text-gray-800'
}

// Lifecycle
onMounted(() => {
  // Prefill from query params when coming from a Repair Log
  const q = route?.query || {}
  if (q.acn) form.value.acn = String(q.acn)
  if (q.serialNumber) form.value.serialNumber = String(q.serialNumber)
  // Try to fetch item details when ACN provided
  if (form.value.acn) {
    fetchItemDetails()
  }
  fetchItems()
})
</script>
