<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import axios from 'axios'
import { useAuthStore } from '@/stores/auth'
import Swal from 'sweetalert2'

const authStore = useAuthStore()

// Interface for product data
interface Product {
  _id: string
  name: string
  sku: string
  currentStock: number
  reorderLevel: number
  maxStock: number
  reorderQuantity: number
  reorderPointId?: string // Add this field
  supplier: {
    _id: string
    name: string
  }
  category: {
    _id: string
    name: string
  }
}

// State
const products = ref<Product[]>([])
const isLoading = ref(true)
const selectedProduct = ref<Product | null>(null)
const showEditModal = ref(false)

// Form data for editing
const editForm = ref({
  reorderLevel: 0,
  maxStock: 0,
  reorderQuantity: 0
})

// Fetch all products
const fetchProducts = async () => {
  try {
    isLoading.value = true
    const response = await axios.get('http://localhost:5000/api/products/', {
      headers: {
        Authorization: `Bearer ${authStore.token}`
      }
    })

    // Handle the specific response format from your API
    if (response.data && response.data.products && Array.isArray(response.data.products)) {
      products.value = response.data.products
    } else if (response.data && Array.isArray(response.data.data)) {
      products.value = response.data.data
    } else if (response.data && Array.isArray(response.data)) {
      products.value = response.data
    } else {
      console.error('Unexpected API response format:', response.data)
      products.value = []
    }

    // Fetch reorder points and associate them with products
    await fetchReorderPoints()
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

// Add this new function to fetch reorder points
const fetchReorderPoints = async () => {
  try {
    const response = await axios.get('http://localhost:5000/api/reorder-points', {
      headers: {
        Authorization: `Bearer ${authStore.token}`
      }
    })

    const reorderPoints = response.data

    // Associate reorder points with products
    if (Array.isArray(reorderPoints)) {
      products.value = products.value.map((product) => {
        const reorderPoint = reorderPoints.find((rp) => rp.product._id === product._id)
        if (reorderPoint) {
          return {
            ...product,
            reorderPointId: reorderPoint._id,
            reorderLevel: reorderPoint.minimumStock,
            reorderQuantity: reorderPoint.reorderQuantity
          }
        }
        return product
      })
    }
  } catch (error) {
    console.error('Error fetching reorder points:', error)
  }
}

// Open edit modal for a product
const openEditModal = (product: Product) => {
  selectedProduct.value = product
  editForm.value = {
    reorderLevel: product.reorderLevel || 5,
    maxStock: product.maxStock || 50,
    reorderQuantity: product.reorderQuantity || 10
  }
  showEditModal.value = true
}

// Save reorder settings
const saveReorderSettings = async () => {
  if (!selectedProduct.value) return

  try {
    let response

    // Check if the product already has a reorder point ID
    if (selectedProduct.value.reorderPointId) {
      // Update existing reorder point
      response = await axios.put(
        `http://localhost:5000/api/reorder-points/${selectedProduct.value.reorderPointId}`,
        {
          minimumStock: editForm.value.reorderLevel,
          reorderQuantity: editForm.value.reorderQuantity,
          supplierId: selectedProduct.value.supplier?._id
        },
        {
          headers: {
            Authorization: `Bearer ${authStore.token}`
          }
        }
      )
    } else {
      // Create new reorder point
      // Make sure all required fields are present and valid
      if (!selectedProduct.value._id || !selectedProduct.value.supplier?._id) {
        throw new Error('Missing required product or supplier information')
      }

      // Create new reorder point
      const requestData = {
        productId: selectedProduct.value._id,
        minimumStock: editForm.value.reorderLevel,
        reorderQuantity: editForm.value.reorderQuantity,
        supplierId: selectedProduct.value.supplier?._id
      }
      console.log('Sending data to create reorder point:', requestData)

      response = await axios.post('http://localhost:5000/api/reorder-points', requestData, {
        headers: {
          Authorization: `Bearer ${authStore.token}`
        }
      })

      // Store the new reorder point ID
      if (response.data && response.data.reorderPoint) {
        selectedProduct.value.reorderPointId = response.data.reorderPoint._id
      }
    }

    // Update product in the list
    const index = products.value.findIndex((p) => p._id === selectedProduct.value?._id)
    if (index !== -1) {
      products.value[index] = {
        ...products.value[index],
        reorderLevel: editForm.value.reorderLevel,
        maxStock: editForm.value.maxStock,
        reorderQuantity: editForm.value.reorderQuantity,
        reorderPointId: selectedProduct.value.reorderPointId
      }
    }

    showEditModal.value = false
    Swal.fire({
      icon: 'success',
      title: 'Success',
      text: 'Reorder settings updated successfully',
      toast: true,
      position: 'top-end',
      showConfirmButton: false,
      timer: 3000
    })
  } catch (error) {
    console.error('Error updating reorder settings:', error)
    Swal.fire({
      icon: 'error',
      title: 'Error',
      text: 'Failed to update reorder settings'
    })
  }
}
// Stock status indicator
const getStockStatus = (product: Product) => {
  if (!product.reorderLevel) return 'normal'
  if (product.currentStock <= 0) return 'out'
  if (product.currentStock <= product.reorderLevel) return 'low'
  return 'normal'
}

// Filter products by stock status
const stockFilter = ref('all')
const filteredProducts = computed(() => {
  if (stockFilter.value === 'all') return products.value
  if (stockFilter.value === 'low') {
    return products.value.filter((p) => getStockStatus(p) === 'low')
  }
  if (stockFilter.value === 'out') {
    return products.value.filter((p) => getStockStatus(p) === 'out')
  }
  return products.value
})

// Search functionality
const searchQuery = ref('')
const searchedProducts = computed(() => {
  if (!searchQuery.value) return filteredProducts.value

  const query = searchQuery.value.toLowerCase()
  return filteredProducts.value.filter(
    (p) =>
      p.name.toLowerCase().includes(query) ||
      p.sku.toLowerCase().includes(query) ||
      (p.supplier?.name && p.supplier.name.toLowerCase().includes(query))
  )
})

// Bulk update functionality
const showBulkModal = ref(false)
const bulkForm = ref({
  categoryId: '',
  reorderLevel: 5,
  maxStock: 50,
  reorderQuantity: 10
})
const categories = ref([])

// Fetch categories for bulk update
const fetchCategories = async () => {
  try {
    const response = await axios.get('http://localhost:5000/api/categories', {
      headers: {
        Authorization: `Bearer ${authStore.token}`
      }
    })
    categories.value = response.data.data || response.data
  } catch (error) {
    console.error('Error fetching categories:', error)
  }
}

// Apply bulk update
const applyBulkUpdate = async () => {
  try {
    if (!bulkForm.value.categoryId) {
      Swal.fire({
        icon: 'warning',
        title: 'Warning',
        text: 'Please select a category'
      })
      return
    }

    const response = await axios.post(
      'http://localhost:5000/api/reorder-points/bulk-update',
      {
        products: products.value
          .filter((p) => p.category?._id === bulkForm.value.categoryId)
          .map((p) => ({
            id: p._id,
            minimumStock: bulkForm.value.reorderLevel,
            reorderQuantity: bulkForm.value.reorderQuantity,
            supplierId: p.supplier?._id
          }))
      },
      {
        headers: {
          Authorization: `Bearer ${authStore.token}`
        }
      }
    )

    showBulkModal.value = false
    await fetchProducts()

    Swal.fire({
      icon: 'success',
      title: 'Success',
      text: `Updated reorder settings for ${response.data.results?.length || 'multiple'} products`,
      toast: true,
      position: 'top-end',
      showConfirmButton: false,
      timer: 3000
    })
  } catch (error) {
    console.error('Error applying bulk update:', error)
    Swal.fire({
      icon: 'error',
      title: 'Error',
      text: 'Failed to apply bulk update'
    })
  }
}
const triggerReorderCheck = async () => {
  try {
    Swal.fire({
      title: 'Processing',
      text: 'Checking stock levels and creating reorder requests...',
      allowOutsideClick: false,
      didOpen: () => {
        Swal.showLoading()
      }
    })

    const response = await axios.get('http://localhost:5000/api/reorder-points/check', {
      headers: {
        Authorization: `Bearer ${authStore.token}`
      }
    })

    Swal.fire({
      icon: 'success',
      title: 'Success',
      text: `Found ${response.data.reorderRequests?.length || 0} products that need reordering`,
      confirmButtonText: 'OK'
    })
  } catch (error) {
    console.error('Error triggering reorder check:', error)
    Swal.fire({
      icon: 'error',
      title: 'Error',
      text: 'Failed to process reorder check'
    })
  }
}
// Initialize component
onMounted(() => {
  fetchProducts()
  fetchCategories()
})
// Add this function to your component
const triggerAutoReorder = async () => {
  try {
    Swal.fire({
      title: 'Processing',
      text: 'Checking stock levels and creating purchase orders...',
      allowOutsideClick: false,
      didOpen: () => {
        Swal.showLoading()
      }
    })

    const response = await axios.post(
      'http://localhost:5000/api/reorder-points/auto-reorder',
      {},
      {
        headers: {
          Authorization: `Bearer ${authStore.token}`
        }
      }
    )

    Swal.fire({
      icon: 'success',
      title: 'Auto Reorder Complete',
      text: `Created ${
        response.data.ordersCreated || 0
      } purchase orders for products that need reordering`,
      confirmButtonText: 'OK'
    })
  } catch (error) {
    console.error('Error triggering auto reorder:', error)
    Swal.fire({
      icon: 'error',
      title: 'Error',
      text: 'Failed to process auto reorder'
    })
  }
}
</script>

<template>
  <div
    class="rounded-sm border border-stroke bg-white px-5 pt-6 pb-2.5 shadow-default dark:border-strokedark dark:bg-boxdark sm:px-7.5 xl:pb-1"
  >
    <div class="mb-6 flex flex-wrap items-center justify-between gap-4">
      <h4 class="text-xl font-semibold text-black dark:text-white">Reorder Point Settings</h4>

      <div class="flex flex-wrap gap-3">
        <div class="relative">
          <input
            type="text"
            placeholder="Search products..."
            v-model="searchQuery"
            class="rounded-lg border border-stroke bg-transparent py-2 pl-10 pr-4 outline-none focus:border-primary dark:border-form-strokedark dark:bg-form-input"
          />
          <span class="absolute left-3 top-2.5">
            <svg class="fill-body h-5 w-5" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">
              <path
                d="M18.031 16.617l4.283 4.282-1.415 1.415-4.282-4.283A8.96 8.96 0 0 1 11 20c-4.968 0-9-4.032-9-9s4.032-9 9-9 9 4.032 9 9a8.96 8.96 0 0 1-1.969 5.617zm-2.006-.742A6.977 6.977 0 0 0 18 11c0-3.868-3.133-7-7-7-3.868 0-7 3.132-7 7 0 3.867 3.132 7 7 7a6.977 6.977 0 0 0 4.875-1.975l.15-.15z"
              />
            </svg>
          </span>
        </div>

        <select
          v-model="stockFilter"
          class="rounded-lg border border-stroke bg-transparent py-2 px-4 outline-none focus:border-primary dark:border-form-strokedark dark:bg-form-input"
        >
          <option value="all">All Products</option>
          <option value="low">Low Stock</option>
          <option value="out">Out of Stock</option>
        </select>

        <button
          @click="showBulkModal = true"
          class="rounded-lg bg-primary py-2 px-4 text-white hover:bg-opacity-90"
        >
          Bulk Update
        </button>

        <button
          @click="triggerReorderCheck"
          class="rounded-lg bg-success py-2 px-4 text-white hover:bg-opacity-90"
        >
          Run Reorder Check
        </button>
      </div>
    </div>

    <div class="max-w-full overflow-x-auto">
      <div v-if="isLoading" class="flex justify-center py-8">
        <div
          class="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full"
        ></div>
      </div>

      <div v-else-if="products.length === 0" class="py-8 text-center">
        <p class="text-gray-500">No products found. Please check your API connection.</p>
        <pre class="mt-4 text-xs text-left bg-gray-100 p-4 rounded max-w-lg mx-auto overflow-auto">
          Debug info:
          Products array length: {{ products.length }}
          Filtered products length: {{ filteredProducts.length }}
          Searched products length: {{ searchedProducts.length }}
        </pre>
      </div>

      <table v-else class="w-full table-auto">
        <thead>
          <tr class="bg-gray-2 text-left dark:bg-meta-4">
            <th class="py-4 px-4 font-medium text-black dark:text-white">Product</th>
            <th class="py-4 px-4 font-medium text-black dark:text-white">SKU</th>
            <th class="py-4 px-4 font-medium text-black dark:text-white">Supplier</th>
            <th class="py-4 px-4 font-medium text-black dark:text-white">Current Stock</th>
            <th class="py-4 px-4 font-medium text-black dark:text-white">Reorder Level</th>
            <th class="py-4 px-4 font-medium text-black dark:text-white">Reorder Quantity</th>
            <th class="py-4 px-4 font-medium text-black dark:text-white">Status</th>
            <th class="py-4 px-4 font-medium text-black dark:text-white">Actions</th>
          </tr>
        </thead>
        <tbody>
          <tr v-if="searchedProducts.length === 0">
            <td colspan="9" class="py-4 px-4 text-center text-gray-500">No products found</td>
          </tr>
          <tr
            v-for="product in searchedProducts"
            :key="product._id"
            class="border-b border-[#eee] dark:border-strokedark"
          >
            <td class="py-4 px-4">
              <h5 class="font-medium text-black dark:text-white">{{ product.name }}</h5>
              <p class="text-sm">{{ product.category?.name || 'N/A' }}</p>
            </td>
            <td class="py-4 px-4">{{ product.sku }}</td>
            <td class="py-4 px-4">{{ product.supplier?.name || 'N/A' }}</td>
            <td class="py-4 px-4">{{ product.currentStock }}</td>
            <td class="py-4 px-4">{{ product.reorderLevel || 'Not set' }}</td>
            <td class="py-4 px-4">{{ product.reorderQuantity || 'Not set' }}</td>
            <td class="py-4 px-4">
              <span
                class="inline-flex rounded-full px-3 py-1 text-sm font-medium"
                :class="{
                  'bg-success bg-opacity-10 text-success': getStockStatus(product) === 'normal',
                  'bg-warning bg-opacity-10 text-warning': getStockStatus(product) === 'low',
                  'bg-danger bg-opacity-10 text-danger': getStockStatus(product) === 'out'
                }"
              >
                {{
                  getStockStatus(product) === 'normal'
                    ? 'Normal'
                    : getStockStatus(product) === 'low'
                      ? 'Low Stock'
                      : 'Out of Stock'
                }}
              </span>
            </td>
            <td class="py-4 px-4">
              <button @click="openEditModal(product)" class="hover:text-primary">
                <svg
                  class="h-5 w-5"
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    stroke-width="2"
                    d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
                  />
                </svg>
              </button>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>

  <!-- Edit Modal -->
  <div
    v-if="showEditModal"
    class="fixed inset-0 z-999 flex items-center justify-center overflow-y-auto bg-black bg-opacity-50"
  >
    <div class="relative w-full max-w-lg rounded-lg bg-white p-8 dark:bg-boxdark">
      <div class="mb-6 flex items-center justify-between">
        <h3 class="text-xl font-semibold">Edit Reorder Settings</h3>
        <button @click="showEditModal = false" class="hover:text-danger">
          <svg class="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d="M6 18L18 6M6 6l12 12"
            />
          </svg>
        </button>
      </div>

      <div v-if="selectedProduct" class="space-y-4">
        <div>
          <h4 class="font-medium">{{ selectedProduct.name }}</h4>
          <p class="text-sm text-gray-500">SKU: {{ selectedProduct.sku }}</p>
          <p class="text-sm text-gray-500">Current Stock: {{ selectedProduct.currentStock }}</p>
        </div>

        <div>
          <label class="mb-2.5 block text-black dark:text-white">Reorder Level</label>
          <input
            type="number"
            v-model="editForm.reorderLevel"
            min="0"
            class="w-full rounded border-[1.5px] border-stroke bg-transparent px-5 py-3 outline-none transition focus:border-primary active:border-primary dark:border-form-strokedark dark:bg-form-input"
          />
          <p class="mt-1 text-xs text-gray-500">Stock level at which to trigger a reorder</p>
        </div>

        <div>
          <label class="mb-2.5 block text-black dark:text-white">Maximum Stock</label>
          <input
            type="number"
            v-model="editForm.maxStock"
            min="0"
            class="w-full rounded border-[1.5px] border-stroke bg-transparent px-5 py-3 outline-none transition focus:border-primary active:border-primary dark:border-form-strokedark dark:bg-form-input"
          />
          <p class="mt-1 text-xs text-gray-500">Maximum stock level to maintain</p>
        </div>

        <div>
          <label class="mb-2.5 block text-black dark:text-white">Reorder Quantity</label>
          <input
            type="number"
            v-model="editForm.reorderQuantity"
            min="1"
            class="w-full rounded border-[1.5px] border-stroke bg-transparent px-5 py-3 outline-none transition focus:border-primary active:border-primary dark:border-form-strokedark dark:bg-form-input"
          />
          <p class="mt-1 text-xs text-gray-500">
            Default quantity to reorder if maximum stock is not set
          </p>
        </div>

        <div class="mt-6 flex justify-end space-x-4">
          <button
            @click="showEditModal = false"
            class="rounded border border-stroke px-6 py-2 text-black hover:border-gray-300 dark:border-strokedark dark:text-white dark:hover:border-gray-600"
          >
            Cancel
          </button>
          <button
            @click="saveReorderSettings"
            class="rounded bg-primary px-6 py-2 text-white hover:bg-opacity-90"
          >
            Save Changes
          </button>
        </div>
      </div>
    </div>
  </div>

  <!-- Bulk Update Modal -->
  <div
    v-if="showBulkModal"
    class="fixed inset-0 z-999 flex items-center justify-center overflow-y-auto bg-black bg-opacity-50"
  >
    <div class="relative w-full max-w-lg rounded-lg bg-white p-8 dark:bg-boxdark">
      <div class="mb-6 flex items-center justify-between">
        <h3 class="text-xl font-semibold">Bulk Update Reorder Settings</h3>
        <button @click="showBulkModal = false" class="hover:text-danger">
          <svg class="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d="M6 18L18 6M6 6l12 12"
            />
          </svg>
        </button>
      </div>

      <div class="space-y-4">
        <div>
          <label class="mb-2.5 block text-black dark:text-white">Category</label>
          <select
            v-model="bulkForm.categoryId"
            class="w-full rounded border-[1.5px] border-stroke bg-transparent px-5 py-3 outline-none transition focus:border-primary active:border-primary dark:border-form-strokedark dark:bg-form-input"
          >
            <option value="">Select a category</option>
            <option v-for="category in categories" :key="category._id" :value="category._id">
              {{ category.name }}
            </option>
          </select>
          <p class="mt-1 text-xs text-gray-500">All products in this category will be updated</p>
        </div>

        <div>
          <label class="mb-2.5 block text-black dark:text-white">Reorder Level</label>
          <input
            type="number"
            v-model="bulkForm.reorderLevel"
            min="0"
            class="w-full rounded border-[1.5px] border-stroke bg-transparent px-5 py-3 outline-none transition focus:border-primary active:border-primary dark:border-form-strokedark dark:bg-form-input"
          />
        </div>

        <div>
          <label class="mb-2.5 block text-black dark:text-white">Maximum Stock</label>
          <input
            type="number"
            v-model="bulkForm.maxStock"
            min="0"
            class="w-full rounded border-[1.5px] border-stroke bg-transparent px-5 py-3 outline-none transition focus:border-primary active:border-primary dark:border-form-strokedark dark:bg-form-input"
          />
        </div>

        <div>
          <label class="mb-2.5 block text-black dark:text-white">Reorder Quantity</label>
          <input
            type="number"
            v-model="bulkForm.reorderQuantity"
            min="1"
            class="w-full rounded border-[1.5px] border-stroke bg-transparent px-5 py-3 outline-none transition focus:border-primary active:border-primary dark:border-form-strokedark dark:bg-form-input"
          />
        </div>

        <div class="mt-6 flex justify-end space-x-4">
          <button
            @click="showBulkModal = false"
            class="rounded border border-stroke px-6 py-2 text-black hover:border-gray-300 dark:border-strokedark dark:text-white dark:hover:border-gray-600"
          >
            Cancel
          </button>
          <button
            @click="applyBulkUpdate"
            class="rounded bg-primary px-6 py-2 text-white hover:bg-opacity-90"
          >
            Apply to All
          </button>
        </div>
      </div>
    </div>
  </div>
</template>
