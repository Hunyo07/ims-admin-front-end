<script setup>
import { ref, onMounted } from 'vue'
import axios from 'axios'
import { useAuthStore } from '../../stores/auth'
import Swal from 'sweetalert2'

const props = defineProps({
  modalVisible: {
    type: Boolean,
    required: true
  }
})

const emit = defineEmits(['close', 'adjustment-created'])

const authStore = useAuthStore()
const products = ref([])
const isLoading = ref(false)

// Form data for creating stock adjustments with multiple items
const adjustmentItems = ref([
  {
    productId: '',
    adjustmentType: 'damage', // Default to damage, other options: loss, return, receive, reduction
    newQuantity: 0,
    previousQuantity: 0,
    adjustmentQuantity: 0,
    reason: '',
    notes: '',
    selectedProduct: null
  }
])

// Common fields for all items
const commonFields = ref({
  adjustmentType: 'damage', // Default to damage, other options: loss, return, receive, reduction
  reason: '',
  notes: ''
})

// Fetch products
const fetchProducts = async () => {
  try {
    isLoading.value = true
    const response = await axios.get('https://ims-api-id38.onrender.com/api/products', {
      headers: {
        Authorization: `Bearer ${authStore.token}`
      }
    })
    products.value = response.data.products
  } catch (error) {
    console.error('Error fetching products:', error)
    Swal.fire({
      icon: 'error',
      title: 'Error',
      text: 'Failed to fetch products'
    })
  } finally {
    isLoading.value = false
  }
}

// Add a new item to the adjustment
const addItem = () => {
  adjustmentItems.value.push({
    productId: '',
    adjustmentType: commonFields.value.adjustmentType,
    newQuantity: 0,
    previousQuantity: 0,
    adjustmentQuantity: 0,
    reason: commonFields.value.reason,
    notes: commonFields.value.notes,
    selectedProduct: null
  })
}

// Remove an item from the adjustment
const removeItem = (index) => {
  if (adjustmentItems.value.length > 1) {
    adjustmentItems.value.splice(index, 1)
  } else {
    Swal.fire({
      icon: 'warning',
      title: 'Cannot Remove',
      text: 'At least one item is required'
    })
  }
}

// Update all items when common fields change
const updateAllItems = () => {
  adjustmentItems.value.forEach((item) => {
    item.adjustmentType = commonFields.value.adjustmentType
    item.reason = commonFields.value.reason
    item.notes = commonFields.value.notes
  })
}

// Set product details when product is selected
const setProductDetails = async (index) => {
  const item = adjustmentItems.value[index]
  if (item.productId) {
    try {
      const response = await axios.get(`https://ims-api-id38.onrender.com/api/products/${item.productId}`, {
        headers: {
          Authorization: `Bearer ${authStore.token}`
        }
      })
      item.selectedProduct = response.data.product
      item.previousQuantity = item.selectedProduct.currentStock
      if (item.adjustmentType !== 'receive') {
        item.newQuantity = item.selectedProduct.currentStock
      }
      calculateAdjustmentQuantity(index)
    } catch (error) {
      console.error('Error fetching product details:', error)
      item.selectedProduct = null
    }
  } else {
    item.selectedProduct = null
  }
}
// Calculate adjustment quantity
// const calculateAdjustmentQuantity = (index) => {
//   const item = adjustmentItems.value[index]
//   if (item.selectedProduct) {
//     item.adjustmentQuantity = item.newQuantity - item.previousQuantity
//   }
// }
const calculateAdjustmentQuantity = (index) => {
  const item = adjustmentItems.value[index]
  if (item.selectedProduct) {
    if (item.adjustmentType === 'receive') {
      item.adjustmentQuantity = item.newQuantity // Quantity received
    } else {
      item.adjustmentQuantity = item.newQuantity - item.previousQuantity
    }
  }
}
const createStockAdjustment = async () => {
  try {
    // Validate form
    const invalidItems = adjustmentItems.value.filter((item) => !item.productId || !item.reason)
    if (invalidItems.length > 0) {
      Swal.fire({
        icon: 'warning',
        title: 'Missing Information',
        text: 'Please select a product and provide a reason for all adjustment items'
      })
      return
    }

    // Validate quantities based on adjustment type
    for (const item of adjustmentItems.value) {
      if (item.adjustmentType === 'damage' || item.adjustmentType === 'loss') {
        if (item.newQuantity >= item.selectedProduct.currentStock) {
          Swal.fire({
            icon: 'warning',
            title: 'Invalid Quantity',
            text: `For damage or loss, the new quantity must be less than the current stock for ${item.selectedProduct.name}`
          })
          return
        }
      } else if (item.adjustmentType === 'return') {
        if (item.newQuantity <= item.selectedProduct.currentStock) {
          Swal.fire({
            icon: 'warning',
            title: 'Invalid Quantity',
            text: `For returns, the new quantity must be greater than the current stock for ${item.selectedProduct.name}`
          })
          return
        }
      } else if (item.adjustmentType === 'receive') {
        if (item.adjustmentQuantity <= 0) {
          Swal.fire({
            icon: 'warning',
            title: 'Invalid Quantity',
            text: `For receives, the quantity must be greater than zero for ${item.selectedProduct.name}`
          })
          return
        }
      }
    }

    isLoading.value = true

    // Process each adjustment item
    const adjustmentPromises = adjustmentItems.value.map((item) => {
      return axios.post(
        'https://ims-api-id38.onrender.com/api/inventory/adjustments',
        {
          productId: item.productId,
          adjustmentType: item.adjustmentType,
          newQuantity:
            item.adjustmentType === 'receive'
              ? item.previousQuantity + item.adjustmentQuantity
              : item.newQuantity,
          reason: item.reason,
          notes: item.notes
        },
        {
          headers: {
            Authorization: `Bearer ${authStore.token}`
          }
        }
      )
    })

    await Promise.all(adjustmentPromises)

    Swal.fire({
      icon: 'success',
      title: 'Success',
      text: 'Stock adjustments created successfully'
    })

    // Reset form and close modal
    resetForm()
    emit('adjustment-created')
    emit('close')
  } catch (error) {
    console.error('Error creating stock adjustments:', error)
    Swal.fire({
      icon: 'error',
      title: 'Error',
      text: error.response?.data?.message || 'Failed to create stock adjustments'
    })
  } finally {
    isLoading.value = false
  }
}

// Reset the form
const resetForm = () => {
  adjustmentItems.value = [
    {
      productId: '',
      adjustmentType: 'damage',
      newQuantity: 0,
      previousQuantity: 0,
      adjustmentQuantity: 0,
      reason: '',
      notes: '',
      selectedProduct: null
    }
  ]

  commonFields.value = {
    adjustmentType: 'damage',
    reason: '',
    notes: ''
  }
}

// Handle cancel button click
const handleCancel = () => {
  resetForm()
  emit('close')
}

onMounted(async () => {
  await fetchProducts()
})
</script>

<template>
  <div
    v-if="props.modalVisible"
    class="fixed inset-0 z-999 flex items-center justify-center bg-black bg-opacity-50"
  >
    <div
      class="w-full max-w-4xl max-h-[90vh] overflow-y-auto bg-white dark:bg-boxdark rounded-lg shadow-lg"
    >
      <div class="border-b border-stroke px-4 py-3 dark:border-strokedark">
        <div class="flex items-center justify-between">
          <h3 class="text-lg font-semibold text-black dark:text-white">Create Stock Adjustment</h3>
          <button @click="emit('close')" class="text-gray-500 hover:text-red-500">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              class="h-5 w-5"
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

      <div class="p-4">
        <!-- Common Fields - More compact layout -->
        <div class="mb-4 p-3 bg-gray-1 dark:bg-meta-4 rounded-md">
          <h4 class="font-medium mb-2 text-sm">Common Settings</h4>
          <div class="grid grid-cols-3 gap-3">
            <div>
              <label class="mb-1 block text-sm text-black dark:text-white">
                Type <span class="text-meta-1">*</span>
              </label>
              <select
                v-model="commonFields.adjustmentType"
                @change="updateAllItems"
                class="w-full rounded border-[1.5px] border-stroke bg-transparent py-2 px-3 text-sm font-medium outline-none transition focus:border-primary active:border-primary disabled:cursor-default disabled:bg-whiter dark:border-form-strokedark dark:bg-form-input dark:focus:border-primary"
              >
                <option value="damage">Damage</option>
                <option value="loss">Loss</option>
                <option value="return">Return</option>
                <option value="receive">Receive</option>
                <option value="reduction">Reduction</option>
              </select>
            </div>

            <!-- <div>
              <label class="mb-1 block text-sm text-black dark:text-white">
                Reason <span class="text-meta-1">*</span>
              </label>
              <input
                type="text"
                v-model="commonFields.reason"
                @input="updateAllItems"
                class="w-full rounded border-[1.5px] border-stroke bg-transparent py-2 px-3 text-sm font-medium outline-none transition focus:border-primary active:border-primary disabled:cursor-default disabled:bg-whiter dark:border-form-strokedark dark:bg-form-input dark:focus:border-primary"
                placeholder="Common reason"
              />
            </div>

            <div>
              <label class="mb-1 block text-sm text-black dark:text-white">Notes</label>
              <input
                type="text"
                v-model="commonFields.notes"
                @input="updateAllItems"
                class="w-full rounded border-[1.5px] border-stroke bg-transparent py-2 px-3 text-sm font-medium outline-none transition focus:border-primary active:border-primary disabled:cursor-default disabled:bg-whiter dark:border-form-strokedark dark:bg-form-input dark:focus:border-primary"
                placeholder="Common notes"
              />
            </div> -->
          </div>
        </div>

        <!-- Adjustment Items - More compact layout -->
        <div
          v-for="(item, index) in adjustmentItems"
          :key="index"
          class="mb-3 p-3 border border-stroke dark:border-strokedark rounded-md"
        >
          <div class="flex justify-between items-center mb-2">
            <h4 class="font-medium text-sm">Item #{{ index + 1 }}</h4>
            <button
              @click="removeItem(index)"
              class="text-danger hover:text-meta-1 p-1"
              :disabled="adjustmentItems.length === 1"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                class="h-4 w-4"
                viewBox="0 0 20 20"
                fill="currentColor"
              >
                <path
                  fill-rule="evenodd"
                  d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z"
                  clip-rule="evenodd"
                />
              </svg>
            </button>
          </div>

          <!-- Product selection and info in a more compact layout -->
          <div class="grid grid-cols-1 md:grid-cols-2 gap-3 mb-3">
            <div>
              <label class="mb-1 block text-sm text-black dark:text-white">
                Product <span class="text-meta-1">*</span>
              </label>
              <select
                v-model="item.productId"
                @change="setProductDetails(index)"
                class="w-full rounded border-[1.5px] border-stroke bg-transparent py-2 px-3 text-sm font-medium outline-none transition focus:border-primary active:border-primary disabled:cursor-default disabled:bg-whiter dark:border-form-strokedark dark:bg-form-input dark:focus:border-primary"
              >
                <option value="" disabled>Select Product</option>
                <option v-for="product in products" :key="product._id" :value="product._id">
                  {{ product.name }} ({{ product.sku }})
                </option>
              </select>
            </div>

            <div v-if="item.selectedProduct" class="flex flex-col justify-center">
              <div class="flex flex-wrap text-xs gap-x-4">
                <span><strong>SKU:</strong> {{ item.selectedProduct.sku }}</span>
                <span><strong>Stock:</strong> {{ item.selectedProduct.currentStock }}</span>
                <span
                  ><strong>Category:</strong>
                  {{ item.selectedProduct.category?.name || 'N/A' }}</span
                >
              </div>
            </div>
          </div>

          <!-- Quantity, reason and notes in a more compact layout -->
          <div class="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div>
              <label class="mb-1 block text-sm text-black dark:text-white">
                {{ item.adjustmentType === 'receive' ? 'Quantity Received' : 'New Quantity' }}
                <span class="text-meta-1">*</span>
              </label>
              <div class="flex items-center">
                <input
                  type="number"
                  v-model.number="item.newQuantity"
                  @input="calculateAdjustmentQuantity(index)"
                  min="0"
                  :max="
                    item.adjustmentType === 'return'
                      ? 9999
                      : item.selectedProduct?.currentStock || 0
                  "
                  class="w-full rounded border-[1.5px] border-stroke bg-transparent py-2 px-3 text-sm font-medium outline-none transition focus:border-primary active:border-primary disabled:cursor-default disabled:bg-whiter dark:border-form-strokedark dark:bg-form-input dark:focus:border-primary"
                  :placeholder="
                    item.adjustmentType === 'receive'
                      ? 'Enter quantity received'
                      : 'Enter new quantity'
                  "
                />
                <span
                  v-if="item.selectedProduct && item.adjustmentType !== 'receive'"
                  class="ml-2 text-xs whitespace-nowrap"
                >
                  <span
                    v-if="item.adjustmentType === 'damage' || item.adjustmentType === 'loss'"
                    class="text-meta-1"
                  >
                    (-{{ item.selectedProduct.currentStock - item.newQuantity }})
                  </span>
                  <span v-else-if="item.adjustmentType === 'return'" class="text-meta-3">
                    (+{{ item.newQuantity - item.selectedProduct.currentStock }})
                  </span>
                </span>
              </div>
            </div>

            <div>
              <label class="mb-1 block text-sm text-black dark:text-white">
                Reason <span class="text-meta-1">*</span>
              </label>
              <input
                type="text"
                v-model="item.reason"
                class="w-full rounded border-[1.5px] border-stroke bg-transparent py-2 px-3 text-sm font-medium outline-none transition focus:border-primary active:border-primary disabled:cursor-default disabled:bg-whiter dark:border-form-strokedark dark:bg-form-input dark:focus:border-primary"
                placeholder="Reason"
              />
            </div>

            <div>
              <label class="mb-1 block text-sm text-black dark:text-white">Notes</label>
              <input
                type="text"
                v-model="item.notes"
                class="w-full rounded border-[1.5px] border-stroke bg-transparent py-2 px-3 text-sm font-medium outline-none transition focus:border-primary active:border-primary disabled:cursor-default disabled:bg-whiter dark:border-form-strokedark dark:bg-form-input dark:focus:border-primary"
                placeholder="Notes"
              />
            </div>
          </div>
        </div>

        <!-- Add Item Button - More compact -->
        <div class="mb-4">
          <button
            @click="addItem"
            class="inline-flex items-center justify-center rounded-md border border-primary py-1.5 px-4 text-center text-sm font-medium text-primary hover:bg-opacity-90"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              class="h-4 w-4 mr-1"
              viewBox="0 0 20 20"
              fill="currentColor"
            >
              <path
                fill-rule="evenodd"
                d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z"
                clip-rule="evenodd"
              />
            </svg>
            Add Item
          </button>
        </div>

        <div class="flex items-center justify-end gap-3">
          <button
            @click="handleCancel"
            class="inline-flex items-center justify-center rounded-md border border-stroke py-1.5 px-4 text-center text-sm font-medium text-black hover:border-primary hover:bg-primary hover:text-white dark:border-strokedark dark:text-white"
          >
            Cancel
          </button>
          <button
            @click="createStockAdjustment"
            class="inline-flex items-center justify-center rounded-md bg-primary py-1.5 px-4 text-center text-sm font-medium text-white hover:bg-opacity-90"
            :disabled="isLoading"
          >
            <span v-if="isLoading" class="mr-1">
              <svg
                class="animate-spin h-4 w-4 text-white"
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
            Create Adjustments
          </button>
        </div>
      </div>
    </div>
  </div>
</template>
