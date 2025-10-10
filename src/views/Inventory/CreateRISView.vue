<script setup>
import { ref, onMounted, onUnmounted } from 'vue'
import { useRouter } from 'vue-router'
import axios from '../../utils/axios'
import { socket } from '../../socket'
import DefaultLayout from '../../layouts/DefaultLayout.vue'
import BreadcrumbDefault from '../../components/Breadcrumbs/BreadcrumbDefault.vue'

const pageTitle = ref('Create Requisition Issue Slip')
const router = useRouter()

// Form data
const purpose = ref('')
const requestor = ref('')
const department = ref('')
const notes = ref('')
const items = ref([
  {
    product: '',
    requestedQty: 1,
    remarks: ''
  }
])

// Products for selection
const products = ref([])
const loading = ref(true) // Start with loading true
const submitting = ref(false)
const error = ref(null)

// Fetch products for dropdown
async function fetchProducts() {
  loading.value = true
  try {
    const response = await axios.get('/products')
    products.value = response.data.products || []
  } catch (e) {
    error.value = e?.response?.data?.message || e.message
  } finally {
    loading.value = false
  }
}

// Add new item row
function addItem() {
  items.value.push({ product: '', requestedQty: 1, remarks: '' })
}

// Remove item row
function removeItem(index) {
  if (items.value.length > 1) {
    items.value.splice(index, 1)
  }
}

// Check if a product is selected more than once
function checkDuplicateProducts() {
  const productIds = items.value.map((item) => item.product).filter((id) => id !== '')
  return new Set(productIds).size !== productIds.length
}

// Submit form
async function submitRIS() {
  if (!purpose.value || !requestor.value || items.value.some((item) => !item.product)) {
    error.value = 'Please fill in all required fields'
    return
  }

  if (checkDuplicateProducts()) {
    error.value = 'Duplicate products selected. Please select each product only once.'
    return
  }

  submitting.value = true
  error.value = null

  try {
    const response = await axios.post('/ris', {
      purpose: purpose.value,
      requestor: requestor.value,
      department: department.value,
      notes: notes.value,
      items: items.value
    })

    if (response.data.success) {
      // Socket.IO will handle the update in the list view
      router.push({
        name: 'ris-detail',
        params: { id: response.data.ris._id },
        query: {
          success: 'true',
          message: `RIS #${response.data.ris.risNumber || ''} created successfully`
        }
      })
    }
  } catch (e) {
    error.value = e?.response?.data?.message || e.message
  } finally {
    submitting.value = false
  }
}

onMounted(() => {
  fetchProducts()

  // Listen for socket connection events
  socket.on('connect', () => {
    console.log('Socket connected in CreateRISView')
  })

  // Emit authentication event if user is logged in
  if (localStorage.getItem('user')) {
    const user = JSON.parse(localStorage.getItem('user'))
    if (user && user._id) {
      socket.emit('authenticate', user._id)
    }
  }
})

onUnmounted(() => {
  // Clean up socket listeners when component is unmounted
  socket.off('connect')
})
</script>

<template>
  <DefaultLayout>
    <div class="p-6">
      <BreadcrumbDefault :pageTitle="pageTitle" />

      <div class="bg-white dark:bg-boxdark rounded-sm border border-stroke shadow-default p-6 mt-4">
        <div v-if="loading" class="flex justify-center items-center p-8">
          <div class="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
        </div>

        <div v-else>
          <div
            v-if="error"
            class="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4"
          >
            {{ error }}
          </div>

          <form @submit.prevent="submitRIS">
            <div class="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
              <div>
                <label class="mb-2.5 block text-black dark:text-white">
                  Purpose <span class="text-meta-1">*</span>
                </label>
                <input
                  v-model="purpose"
                  type="text"
                  required
                  placeholder="Enter purpose"
                  class="w-full rounded border-[1.5px] border-stroke bg-transparent py-3 px-5 text-black outline-none transition focus:border-primary active:border-primary dark:border-form-strokedark dark:bg-form-input dark:text-white"
                />
              </div>

              <div>
                <label class="mb-2.5 block text-black dark:text-white">
                  Requestor <span class="text-meta-1">*</span>
                </label>
                <input
                  v-model="requestor"
                  type="text"
                  required
                  placeholder="Enter requestor name"
                  class="w-full rounded border-[1.5px] border-stroke bg-transparent py-3 px-5 text-black outline-none transition focus:border-primary active:border-primary dark:border-form-strokedark dark:bg-form-input dark:text-white"
                />
              </div>

              <div>
                <label class="mb-2.5 block text-black dark:text-white"> Department </label>
                <input
                  v-model="department"
                  type="text"
                  placeholder="Enter department"
                  class="w-full rounded border-[1.5px] border-stroke bg-transparent py-3 px-5 text-black outline-none transition focus:border-primary active:border-primary dark:border-form-strokedark dark:bg-form-input dark:text-white"
                />
              </div>

              <div>
                <label class="mb-2.5 block text-black dark:text-white"> Notes </label>
                <input
                  v-model="notes"
                  type="text"
                  placeholder="Additional notes"
                  class="w-full rounded border-[1.5px] border-stroke bg-transparent py-3 px-5 text-black outline-none transition focus:border-primary active:border-primary dark:border-form-strokedark dark:bg-form-input dark:text-white"
                />
              </div>
            </div>

            <div class="mb-6">
              <div class="flex justify-between items-center mb-4">
                <h3 class="text-lg font-semibold">Items</h3>
                <button
                  type="button"
                  @click="addItem"
                  class="bg-primary text-white px-4 py-2 rounded hover:bg-opacity-90 flex items-center"
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    class="h-5 w-5 mr-1"
                    viewBox="0 0 20 20"
                    fill="currentColor"
                  >
                    <path
                      fill-rule="evenodd"
                      d="M10 5a1 1 0 011 1v3h3a1 1 0 110 2h-3v3a1 1 0 11-2 0v-3H6a1 1 0 110-2h3V6a1 1 0 011-1z"
                      clip-rule="evenodd"
                    />
                  </svg>
                  Add Item
                </button>
              </div>

              <div class="bg-gray-50 dark:bg-meta-4 p-4 rounded-sm mb-4">
                <div
                  v-for="(item, index) in items"
                  :key="index"
                  class="grid grid-cols-1 md:grid-cols-12 gap-4 mb-4 items-end border-b border-stroke pb-4 last:border-0 last:pb-0"
                >
                  <div class="md:col-span-5">
                    <label class="mb-2.5 block text-black dark:text-white">
                      Product <span class="text-meta-1">*</span>
                    </label>
                    <select
                      v-model="item.product"
                      required
                      class="w-full rounded border-[1.5px] border-stroke bg-transparent py-3 px-5 text-black outline-none transition focus:border-primary active:border-primary dark:border-form-strokedark dark:bg-form-input dark:text-white"
                    >
                      <option value="">Select Product</option>
                      <option v-for="product in products" :key="product._id" :value="product._id">
                        {{ product.name }} ({{ product.sku }})
                      </option>
                    </select>
                  </div>

                  <div class="md:col-span-2">
                    <label class="mb-2.5 block text-black dark:text-white">
                      Quantity <span class="text-meta-1">*</span>
                    </label>
                    <input
                      v-model.number="item.requestedQty"
                      type="number"
                      min="1"
                      required
                      class="w-full rounded border-[1.5px] border-stroke bg-transparent py-3 px-5 text-black outline-none transition focus:border-primary active:border-primary dark:border-form-strokedark dark:bg-form-input dark:text-white"
                    />
                  </div>

                  <div class="md:col-span-4">
                    <label class="mb-2.5 block text-black dark:text-white"> Remarks </label>
                    <input
                      v-model="item.remarks"
                      type="text"
                      placeholder="Optional remarks"
                      class="w-full rounded border-[1.5px] border-stroke bg-transparent py-3 px-5 text-black outline-none transition focus:border-primary active:border-primary dark:border-form-strokedark dark:bg-form-input dark:text-white"
                    />
                  </div>

                  <div class="md:col-span-1">
                    <button
                      type="button"
                      @click="removeItem(index)"
                      class="bg-danger text-white p-2 rounded hover:bg-opacity-90 w-full h-12 flex items-center justify-center"
                      :disabled="items.length <= 1"
                    >
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        class="h-5 w-5"
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
                </div>
              </div>
            </div>

            <div class="flex justify-end gap-4">
              <button
                type="button"
                @click="router.push('/inventory/ris')"
                class="bg-gray-300 text-gray-700 px-6 py-2 rounded hover:bg-gray-400"
              >
                Cancel
              </button>
              <button
                type="submit"
                class="bg-primary text-white px-6 py-2 rounded hover:bg-opacity-90 flex items-center"
                :disabled="submitting"
              >
                <svg
                  v-if="submitting"
                  class="animate-spin -ml-1 mr-2 h-5 w-5 text-white"
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
                {{ submitting ? 'Submitting...' : 'Submit' }}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  </DefaultLayout>
</template>
