<script setup lang="ts">
import { ref, onMounted, computed, watch } from 'vue'
import axios from 'axios'
import { useAuthStore } from '@/stores/auth'
import { socket } from '@/socket'
import Swal from 'sweetalert2'

const authStore = useAuthStore()

// Update interfaces
interface Product {
  _id: string
  name: string
  description: string
  category: any
  subCategory: any
  supplier: any
  price: number
  costPrice: number
  unit: string
  branch: any
  currentStock: number
  images: string
  isActive: boolean
  createdAt: string
  updatedAt: string
}
// Update refs
const imagePreview = ref(null)
const isFetchingCategories = ref(false)
const isFetchingSuppliers = ref(false)
const isFetchingSubCategories = ref(false)
const suppliers = ref([])
const subCategories = ref([])
const categories = ref([])
const searchQuery = ref('')
const currentPage = ref(1)
const itemsPerPage = ref(10)
const isLoading = ref(false)
const showModal = ref(false)
const isEditing = ref(false)
const isSubmitting = ref(false)
const isDeleting = ref(false)
const products = ref<Product[]>([])
const selectedProductId = ref(null)
const editingProduct = ref(null)
const branches = ref([])
// Add these refs
const filters = ref({
  categoryId: '',
  status: '',
  priceRange: '',
  minPrice: 0,
  maxPrice: 0
})
const newProduct = ref({
  name: '',
  description: '',
  categoryId: '',
  subCategoryId: '',
  supplierId: '',
  price: '',
  costPrice: '',
  unit: '',
  branchId: '',
  currentStock: '',
  images: null
})
const handleImageChange = (event) => {
  const file = event.target.files[0]
  const maxSize = 5 * 1024 * 1024 // 5MB

  if (file.size > maxSize) {
    Swal.fire({
      icon: 'error',
      title: 'Error',
      text: 'Image size should not exceed 5MB'
    })
    event.target.value = ''
    return
  }

  const validTypes = ['image/jpeg', 'image/png', 'image/gif']
  if (!validTypes.includes(file.type)) {
    Swal.fire({
      icon: 'error',
      title: 'Error',
      text: 'Please upload a valid image file (JPEG, PNG, or GIF)'
    })
    event.target.value = ''
    return
  }

  newProduct.value.images = file
  imagePreview.value = URL.createObjectURL(file)
}
const hasUnsavedChanges = computed(() => {
  if (!showModal.value) return false
  return Object.keys(newProduct.value).some((key) => newProduct.value[key] !== '')
})
const handleCloseModal = async () => {
  if (hasUnsavedChanges.value) {
    const result = await Swal.fire({
      title: 'Unsaved Changes',
      text: 'You have unsaved changes. Are you sure you want to close?',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#3085d6',
      cancelButtonColor: '#64748b',
      confirmButtonText: 'Yes, discard changes',
      cancelButtonText: 'No, keep editing',
      customClass: {
        confirmButton:
          'swal2-confirm bg-primary text-white px-4 py-2 rounded-lg hover:bg-opacity-90',
        cancelButton:
          'swal2-cancel bg-gray-500 text-white px-4 py-2 rounded-lg hover:bg-opacity-90 ml-3'
      }
    })
    if (!result.isConfirmed) return
  }

  // Clear image preview
  if (imagePreview.value) {
    URL.revokeObjectURL(imagePreview.value)
    imagePreview.value = null
  }

  showModal.value = false
  resetForm()
}
const formatPrice = (price) => {
  return new Intl.NumberFormat('en-PH', {
    style: 'currency',
    currency: 'PHP'
  }).format(price)
}
const fetchBranches = async () => {
  try {
    const response = await axios.get('http://localhost:5000/api/superadmin/branches', {
      headers: {
        Authorization: `Bearer ${authStore.token}`
      }
    })
    branches.value = response.data?.filter((branch) => branch?.isActive) || []
  } catch (error) {
    console.error('Error fetching branches:', error)
    branches.value = [] // Set empty array on error
  }
}
const fetchProducts = async () => {
  try {
    isLoading.value = true
    const response = await axios.get('http://localhost:5000/api/products/', {
      headers: {
        Authorization: `Bearer ${authStore.token}`
      }
    })
    // Make sure we're setting an array
    products.value = response.data.products || []
  } catch (error) {
    console.error('Error fetching products:', error)
    products.value = []
    Swal.fire({
      icon: 'error',
      title: 'Error',
      text: error.response?.data?.message || 'Error fetching products'
    })
  } finally {
    isLoading.value = false
  }
}
// Add these fetch functions
const fetchSuppliers = async () => {
  try {
    const response = await axios.get('http://localhost:5000/api/suppliers/suppliers', {
      headers: {
        Authorization: `Bearer ${authStore.token}`
      }
    })
    suppliers.value = response.data?.filter((supplier) => supplier?.isActive) || []
  } catch (error) {
    console.error('Error fetching suppliers:', error)
    suppliers.value = []
  }
}
const fetchSubCategories = async () => {
  try {
    const response = await axios.get('http://localhost:5000/api/subcategories', {
      headers: {
        Authorization: `Bearer ${authStore.token}`
      }
    })
    subCategories.value = response.data?.filter((subCategory) => subCategory?.isActive) || []
  } catch (error) {
    console.error('Error fetching subcategories:', error)
    subCategories.value = []
  }
}
// Update fetch function
const fetchCategories = async () => {
  isFetchingCategories.value = true

  try {
    isLoading.value = true
    const response = await axios.get('http://localhost:5000/api/categories', {
      headers: {
        Authorization: `Bearer ${authStore.token}`
      }
    })
    categories.value = (response.data || []).map((category) => ({
      ...category,
      branch: category.branch || { name: 'Not Assigned' }
    }))
  } catch (error) {
    console.error('Error fetching categories:', error)
    categories.value = [] // Set empty array on error
    Swal.fire({
      icon: 'error',
      title: 'Error',
      text: error.response?.data?.message || 'Error fetching categories'
    })
  } finally {
    isFetchingCategories.value = false
    isLoading.value = false
  }
}
// Update computed properties

const filteredProducts = computed(() => {
  return products.value.filter((product) => {
    const searchLower = searchQuery.value.toLowerCase()
    const matchesSearch =
      product.name.toLowerCase().includes(searchLower) ||
      product.description.toLowerCase().includes(searchLower)

    const matchesCategory =
      !filters.value.categoryId || product.category?._id === filters.value.categoryId
    const matchesStatus =
      !filters.value.status || product.isActive === (filters.value.status === 'active')
    const matchesPrice =
      !filters.value.priceRange ||
      (filters.value.priceRange === 'custom'
        ? product.price >= filters.value.minPrice && product.price <= filters.value.maxPrice
        : matchPriceRange(product.price, filters.value.priceRange))

    return matchesSearch && matchesCategory && matchesStatus && matchesPrice
  })
})
const matchPriceRange = (price, range) => {
  switch (range) {
    case 'under1000':
      return price < 1000
    case '1000to5000':
      return price >= 1000 && price <= 5000
    case 'over5000':
      return price > 5000
    default:
      return true
  }
}
const totalPages = computed(() => {
  return Math.ceil(filteredProducts.value.length / itemsPerPage.value)
})
const isPriceValid = computed(() => {
  const price = Number(newProduct.value.price)
  const costPrice = Number(newProduct.value.costPrice)
  return price > costPrice
})
const filteredSubCategories = computed(() => {
  if (!newProduct.value.categoryId) return []
  return subCategories.value.filter((sub) => sub.category._id === newProduct.value.categoryId)
})
const paginatedProducts = computed(() => {
  const start = (currentPage.value - 1) * itemsPerPage.value
  const end = start + itemsPerPage.value
  return filteredProducts.value.slice(start, end)
})

const resetForm = () => {
  newProduct.value = {
    name: '',
    description: '',
    categoryId: '',
    subCategoryId: '',
    supplierId: '',
    price: '',
    costPrice: '',
    unit: '',
    branchId: '',
    currentStock: '',
    images: null
  }
  isEditing.value = false
  editingProduct.value = null
}
// Update CRUD functions

const handleEditProduct = (product) => {
  isEditing.value = true
  editingProduct.value = product
  newProduct.value = {
    name: product.name,
    description: product.description,
    categoryId: product.category?._id || '',
    subCategoryId: product.subCategory?._id || '',
    supplierId: product.supplier?._id || '',
    price: product.price,
    costPrice: product.costPrice,
    unit: product.unit,
    branchId: product.branch?._id || '',
    currentStock: product.currentStock
  }
  showModal.value = true
}
const handleUpdateProduct = async () => {
  try {
    isSubmitting.value = true
    // Don't use FormData since we're not handling files
    const response = await axios.put(
      `http://localhost:5000/api/products/${editingProduct.value._id}`,
      newProduct.value,
      {
        headers: {
          Authorization: `Bearer ${authStore.token}`,
          'Content-Type': 'application/json' // Changed to JSON
        }
      }
    )

    // Update local state
    products.value = products.value.map((product) =>
      product._id === editingProduct.value._id ? response.data.product : product
    )

    // Emit socket event
    socket.emit('updateProduct', response.data.product)

    showModal.value = false
    resetForm()
    Swal.fire({
      icon: 'success',
      title: 'Success!',
      text: 'Product updated successfully',
      timer: 1500
    })
  } catch (error) {
    Swal.fire({
      icon: 'error',
      title: 'Error',
      text: error.response?.data?.message || 'Error updating product'
    })
  } finally {
    isSubmitting.value = false
  }
}
const handleDeleteProduct = async (productId) => {
  const result = await Swal.fire({
    title: 'Are you sure?',
    text: "You won't be able to revert this!",
    icon: 'warning',
    showCancelButton: true,
    confirmButtonColor: '#3085d6',
    cancelButtonColor: '#d33',
    confirmButtonText: 'Yes, delete it!'
  })

  if (result.isConfirmed) {
    try {
      isDeleting.value = true
      selectedProductId.value = productId
      await axios.delete(`http://localhost:5000/api/products/${productId}`, {
        headers: {
          Authorization: `Bearer ${authStore.token}`
        }
      })

      // Update local state immediately
      products.value = products.value.filter((product) => product._id !== productId)
      socket.emit('deleteProduct', productId)

      Swal.fire({
        icon: 'success',
        title: 'Deleted!',
        text: 'Product has been deleted.',
        timer: 1500,
        showConfirmButton: false
      })
    } catch (error) {
      Swal.fire({
        icon: 'error',
        title: 'Error',
        text: error.response?.data?.message || 'Error deleting product'
      })
    } finally {
      isDeleting.value = false
      selectedProductId.value = null
    }
  }
}

const handleToggleStatus = async (productId, currentStatus) => {
  try {
    const result = await Swal.fire({
      title: `${currentStatus ? 'Deactivate' : 'Activate'} Product?`,
      text: `Are you sure you want to ${currentStatus ? 'deactivate' : 'activate'} this product?`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: currentStatus ? '#d33' : '#3085d6',
      cancelButtonColor: '#6B7280',
      confirmButtonText: `Yes, ${currentStatus ? 'deactivate' : 'activate'} it!`
    })

    if (result.isConfirmed) {
      const response = await axios.patch(
        `http://localhost:5000/api/products/${productId}/toggle-status`,
        {},
        {
          headers: {
            Authorization: `Bearer ${authStore.token}`
          }
        }
      )

      // Update local state
      products.value = products.value.map((product) =>
        product._id === productId ? { ...product, isActive: !currentStatus } : product
      )

      // Emit socket event
      socket.emit('updateProduct', response.data.product)

      Swal.fire({
        icon: 'success',
        title: 'Success!',
        text: `Product ${!currentStatus ? 'activated' : 'deactivated'} successfully`,
        timer: 1000,
        showConfirmButton: false
      })
    }
  } catch (error) {
    Swal.fire({
      icon: 'error',
      title: 'Error',
      text: error.response?.data?.message || 'Error toggling product status'
    })
  }
}
const handleAddProduct = async () => {
  try {
    isSubmitting.value = true
    const formData = new FormData()

    Object.keys(newProduct.value).forEach((key) => {
      if (newProduct.value[key] !== null && newProduct.value[key] !== undefined) {
        formData.append(key, newProduct.value[key])
      }
    })

    const response = await axios.post('http://localhost:5000/api/products', formData, {
      headers: {
        Authorization: `Bearer ${authStore.token}`,
        'Content-Type': 'multipart/form-data'
      }
    })

    // Only add to local state if it's for the current branch
    if (response.data.product.branch._id === authStore.user.branch) {
      products.value = [response.data.product, ...products.value]
    }

    // Emit socket event for other branches
    socket.emit('createProduct', response.data.product)
    showModal.value = false
    resetForm()
    Swal.fire({
      icon: 'success',
      title: 'Success!',
      text: 'Product created successfully',
      timer: 1500
    })
  } catch (error) {
    Swal.fire({
      icon: 'error',
      title: 'Error',
      text: error.response?.data?.message || 'Error creating product'
    })
  } finally {
    isSubmitting.value = false
  }
}

// Modify socket listener in onMounted
socket.on('productCreated', (newProduct) => {
  if (newProduct && newProduct._id) {
    const exists = products.value.some((product) => product._id === newProduct._id)
    // Only add products from other branches that don't exist in the local state
    if (!exists && newProduct.branch._id !== authStore.user.branch) {
      products.value = [newProduct, ...products.value]
    }
  }
})
// Update socket listeners
onMounted(() => {
  fetchProducts()
  fetchCategories()
  fetchBranches()
  fetchSuppliers()
  fetchSubCategories()

  socket.on('productCreated', (newProduct) => {
    if (newProduct && newProduct._id) {
      // Only add if it doesn't exist in the local state
      const exists = products.value.some((product) => product._id === newProduct._id)
      if (!exists && newProduct.branch._id !== authStore.user.branch) {
        products.value = [newProduct, ...products.value]
      }
    }
  })

  socket.on('productUpdated', (updatedProduct) => {
    if (updatedProduct && updatedProduct._id) {
      products.value = products.value.map((product) =>
        product._id === updatedProduct._id ? updatedProduct : product
      )
    }
  })

  socket.on('productDeleted', (productId) => {
    if (productId) {
      products.value = products.value.filter((product) => product._id !== productId)
    }
  })
  return () => {
    socket.off('productCreated')
    socket.off('productUpdated')
    socket.off('productDeleted')
  }
})
watch(
  () => filters.value.priceRange,
  (newValue) => {
    if (newValue !== 'custom') {
      filters.value.minPrice = 0
      filters.value.maxPrice = 0
    }
  }
)
</script>

<template>
  <div
    class="rounded-sm border border-stroke bg-white shadow-default dark:border-strokedark dark:bg-boxdark"
  >
    <!-- Header -->
    <div class="p-4 md:p-6 xl:p-7.5">
      <div class="flex flex-wrap items-center justify-between gap-4">
        <h4 class="text-xl font-bold text-black dark:text-white">Product List</h4>
        <div class="flex items-center gap-4">
          <div class="relative">
            <input
              type="text"
              v-model="searchQuery"
              placeholder="Search Products..."
              class="w-full rounded-lg border border-stroke bg-transparent py-2 pl-10 pr-4 outline-none focus:border-primary dark:border-strokedark"
            />
            <span class="absolute left-4 top-1/2 -translate-y-1/2">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                class="h-4 w-4 fill-current text-bodydark2"
                viewBox="0 0 20 20"
              >
                <path
                  fill-rule="evenodd"
                  d="M8 4a4 4 0 100 8 4 4 0 000-8zM2 8a6 6 0 1110.89 3.476l4.817 4.817a1 1 0 01-1.414 1.414l-4.816-4.816A6 6 0 012 8z"
                  clip-rule="evenodd"
                />
              </svg>
            </span>
          </div>

          <button
            @click="showModal = true"
            class="inline-flex items-center justify-center rounded-lg bg-primary px-6 py-2 text-sm font-medium text-white hover:bg-opacity-90"
          >
            Create Product
          </button>
        </div>
      </div>
    </div>
    <div class="border-b border-stroke dark:border-strokedark">
      <div class="p-4 flex flex-wrap items-center gap-4">
        <!-- Category Filter -->
        <div class="flex-1 min-w-[200px]">
          <label class="mb-2 block text-sm font-medium text-black dark:text-white">Category</label>
          <select
            v-model="filters.categoryId"
            class="w-full rounded-lg border-[1.5px] border-stroke bg-transparent px-4 py-2 outline-none focus:border-primary dark:border-strokedark"
          >
            <option value="">All Categories</option>
            <option v-for="category in categories" :key="category._id" :value="category._id">
              {{ category.name }}
            </option>
          </select>
        </div>

        <!-- Status Filter -->
        <div class="flex-1 min-w-[200px]">
          <label class="mb-2 block text-sm font-medium text-black dark:text-white">Status</label>
          <select
            v-model="filters.status"
            class="w-full rounded-lg border-[1.5px] border-stroke bg-transparent px-4 py-2 outline-none focus:border-primary dark:border-strokedark"
          >
            <option value="">All Status</option>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
          </select>
        </div>

        <!-- Price Range Filter -->
        <div class="flex-1 min-w-[200px]">
          <label class="mb-2 block text-sm font-medium text-black dark:text-white"
            >Price Range</label
          >
          <select
            v-model="filters.priceRange"
            class="w-full rounded-lg border-[1.5px] border-stroke bg-transparent px-4 py-2 outline-none focus:border-primary dark:border-strokedark"
          >
            <option value="">All Prices</option>
            <option value="under1000">Under ₱1,000</option>
            <option value="1000to5000">₱1,000 - ₱5,000</option>
            <option value="over5000">Over ₱5,000</option>
            <option value="custom">Custom Range</option>
          </select>
        </div>

        <!-- Clear Filters Button -->
        <div class="flex items-end pt-6">
          <button
            @click="
              filters = { categoryId: '', status: '', priceRange: '', minPrice: 0, maxPrice: 0 }
            "
            class="rounded-lg border border-stroke px-4 py-2 text-sm font-medium text-black hover:bg-gray-100 dark:border-strokedark dark:text-white dark:hover:bg-meta-4"
          >
            Clear Filters
          </button>
        </div>
      </div>

      <!-- Custom Price Range -->
      <div v-if="filters.priceRange === 'custom'" class="px-4 pb-4 grid grid-cols-2 gap-4 max-w-lg">
        <div>
          <label class="mb-2 block text-sm font-medium text-black dark:text-white">Min Price</label>
          <input
            v-model.number="filters.minPrice"
            type="number"
            min="0"
            placeholder="₱0"
            class="w-full rounded-lg border-[1.5px] border-stroke bg-transparent px-4 py-2 outline-none focus:border-primary dark:border-strokedark"
          />
        </div>
        <div>
          <label class="block text-sm font-medium text-black dark:text-white">Max Price</label>
          <input
            v-model.number="filters.maxPrice"
            type="number"
            min="0"
            placeholder="₱999999"
            class="w-full rounded-lg border-[1.5px] border-stroke bg-transparent px-4 py-2 outline-none focus:border-primary dark:border-strokedark"
          />
        </div>
      </div>
    </div>
    <!-- Table -->
    <div class="max-w-full overflow-x-auto">
      <table class="w-full table-auto">
        <!-- Update the table headers -->
        <thead>
          <tr class="bg-gray-2 text-left dark:bg-meta-4">
            <th class="py-4.5 px-4 font-medium text-black dark:text-white">Product Name</th>
            <th class="py-4.5 px-4 font-medium text-black dark:text-white">Description</th>
            <th class="py-4.5 px-4 font-medium text-black dark:text-white">Category</th>
            <th class="py-4.5 px-4 font-medium text-black dark:text-white">SubCategory</th>
            <th class="py-4.5 px-4 font-medium text-black dark:text-white">Price</th>
            <th class="py-4.5 px-4 font-medium text-black dark:text-white">Stock</th>
            <th class="py-4.5 px-4 font-medium text-black dark:text-white">Status</th>
            <th class="py-4.5 px-4 font-medium text-black dark:text-white">Actions</th>
          </tr>
        </thead>
        <tbody>
          <tr v-if="isLoading">
            <td colspan="8" class="text-center py-4">Loading...</td>
          </tr>
          <tr v-else-if="paginatedProducts.length === 0">
            <td colspan="8" class="text-center py-4">No products found</td>
          </tr>
          <tr
            v-for="product in paginatedProducts"
            :key="product._id"
            class="border-b border-stroke dark:border-strokedark"
          >
            <td class="py-4.5 px-4">
              <div class="flex items-center gap-3">
                <div class="flex h-10 w-10 items-center justify-center rounded-full bg-meta-2">
                  <img
                    v-if="product.images && product.images.length"
                    :src="product.images[0].url"
                    class="h-10 w-10 rounded-full object-cover"
                  />
                  <span v-else>{{ product.name.charAt(0).toUpperCase() }}</span>
                </div>
                <p class="text-black dark:text-white">{{ product.name }}</p>
              </div>
            </td>
            <td class="py-4.5 px-4">{{ product.description }}</td>
            <td class="py-4.5 px-4">{{ product.category?.name || 'Not Assigned' }}</td>
            <td class="py-4.5 px-4">{{ product.subCategory?.name || 'Not Assigned' }}</td>
            <td class="py-4.5 px-4">{{ formatPrice(product.price) }}</td>
            <td class="py-4.5 px-4">{{ product.currentStock }} {{ product.unit }}</td>
            <td class="py-4.5 px-4">
              <div class="flex items-center space-x-2">
                <div
                  :class="`h-3 w-3 rounded-full ${
                    product.isActive ? 'bg-success animate-pulse' : 'bg-danger'
                  }`"
                ></div>
                <button
                  @click="handleToggleStatus(product._id, product.isActive)"
                  :class="`text-sm font-medium ${
                    product.isActive
                      ? 'text-success hover:text-meta-5'
                      : 'text-danger hover:text-meta-8'
                  }`"
                >
                  {{ product.isActive ? 'Active' : 'Inactive' }}
                </button>
              </div>
            </td>
            <td class="py-4.5 px-4">
              <div class="flex items-center space-x-2">
                <button @click="handleEditProduct(product)" class="hover:text-primary">
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    class="h-5 w-5"
                    viewBox="0 0 20 20"
                    fill="currentColor"
                  >
                    <path
                      d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z"
                    />
                  </svg>
                </button>
                <button
                  @click="handleDeleteProduct(product._id)"
                  class="hover:text-danger"
                  :disabled="isDeleting && selectedProductId === product._id"
                >
                  <svg
                    v-if="!(isDeleting && selectedProductId === product._id)"
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
                  <svg
                    v-else
                    class="animate-spin h-5 w-5"
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
                </button>
              </div>
            </td>
          </tr>
        </tbody>
      </table>
      <div class="flex items-center justify-between p-4">
        <div class="flex items-center gap-2">
          <select
            v-model="itemsPerPage"
            class="rounded border border-stroke bg-transparent px-2 py-1"
          >
            <option value="5">5</option>
            <option value="10">10</option>
            <option value="20">20</option>
          </select>
          <span>Items per page</span>
        </div>
        <div class="flex items-center gap-2">
          <button
            @click="currentPage--"
            :disabled="currentPage === 1"
            class="rounded px-3 py-1 disabled:opacity-50"
          >
            Previous
          </button>
          <span>Page {{ currentPage }} of {{ totalPages }}</span>
          <button
            @click="currentPage++"
            :disabled="currentPage === totalPages"
            class="rounded px-3 py-1 disabled:opacity-50"
          >
            Next
          </button>
        </div>
      </div>
    </div>

    <div
      v-if="showModal"
      class="fixed inset-0 z-999 flex items-center justify-center overflow-y-auto bg-black bg-opacity-50"
    >
      <div class="relative w-full max-w-4xl rounded-lg bg-white p-8 dark:bg-boxdark">
        <!-- Header -->
        <div class="mb-6 flex items-center justify-between">
          <h3 class="text-xl font-semibold">
            {{ isEditing ? 'Update Product' : 'Create Product' }}
          </h3>
          <button
            @click="
              () => {
                handleCloseModal()
              }
            "
            class="hover:text-danger"
          >
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

        <!--  s Navigation -->

        <form
          @submit.prevent="isEditing ? handleUpdateProduct() : handleAddProduct()"
          class="space-y-6"
        >
          <div class="grid grid-cols-2 gap-4">
            <!-- Product Name -->
            <div>
              <label class="mb-2.5 block text-black dark:text-white">
                Product Name <span class="text-danger">*</span>
              </label>
              <input
                v-model="newProduct.name"
                type="text"
                required
                placeholder="Enter product name"
                class="w-full rounded border-[1.5px] border-stroke bg-transparent px-5 py-3 outline-none transition focus:border-primary active:border-primary dark:border-form-strokedark dark:bg-form-input"
              />
            </div>

            <!-- Description -->
            <div>
              <label class="mb-2.5 block text-black dark:text-white">
                Description <span class="text-danger">*</span>
              </label>
              <textarea
                v-model="newProduct.description"
                required
                placeholder="Enter product description"
                class="w-full rounded border-[1.5px] border-stroke bg-transparent px-5 py-3 outline-none transition focus:border-primary active:border-primary dark:border-form-strokedark dark:bg-form-input"
              ></textarea>
            </div>

            <!-- Category -->
            <div>
              <label class="mb-2.5 block text-black dark:text-white">
                Category <span class="text-danger">*</span>
              </label>
              <select
                v-model="newProduct.categoryId"
                required
                :disabled="isFetchingCategories"
                class="w-full rounded border-[1.5px] border-stroke bg-transparent px-5 py-3 outline-none transition focus:border-primary active:border-primary dark:border-form-strokedark dark:bg-form-input"
              >
                <option value="" disabled>
                  {{ isFetchingCategories ? 'Loading...' : 'Select a category' }}
                </option>
                <option v-for="category in categories" :key="category._id" :value="category._id">
                  {{ category.name }}
                </option>
              </select>
            </div>

            <!-- SubCategory -->
            <div>
              <label class="mb-2.5 block text-black dark:text-white">
                SubCategory <span class="text-danger">*</span>
              </label>
              <select
                class="w-full rounded border-[1.5px] border-stroke bg-transparent px-5 py-3 outline-none transition focus:border-primary active:border-primary dark:border-form-strokedark dark:bg-form-input"
                v-model="newProduct.subCategoryId"
                required
              >
                <option value="" disabled>Select a subcategory</option>
                <option
                  v-for="subCategory in filteredSubCategories"
                  :key="subCategory._id"
                  :value="subCategory._id"
                >
                  {{ subCategory.name }}
                </option>
              </select>
            </div>

            <!-- Supplier -->
            <div>
              <label class="mb-2.5 block text-black dark:text-white">
                Supplier <span class="text-danger">*</span>
              </label>
              <select
                v-model="newProduct.supplierId"
                required
                class="w-full rounded border-[1.5px] border-stroke bg-transparent px-5 py-3 outline-none transition focus:border-primary active:border-primary dark:border-form-strokedark dark:bg-form-input"
              >
                <option value="" disabled>Select a supplier</option>
                <option v-for="supplier in suppliers" :key="supplier._id" :value="supplier._id">
                  {{ supplier.name }}
                </option>
              </select>
            </div>

            <!-- Price -->
            <div>
              <label class="mb-2.5 block text-black dark:text-white">
                Price <span class="text-danger">*</span>
              </label>
              <input
                v-model="newProduct.price"
                type="number"
                required
                min="0"
                step="0.01"
                placeholder="Enter selling price"
                class="w-full rounded border-[1.5px] border-stroke bg-transparent px-5 py-3 outline-none transition focus:border-primary active:border-primary dark:border-form-strokedark dark:bg-form-input"
              />
            </div>

            <!-- Cost Price -->
            <div>
              <label class="mb-2.5 block text-black dark:text-white">
                Cost Price <span class="text-danger">*</span>
              </label>
              <input
                v-model="newProduct.costPrice"
                type="number"
                required
                min="0"
                step="0.01"
                placeholder="Enter cost price"
                class="w-full rounded border-[1.5px] border-stroke bg-transparent px-5 py-3 outline-none transition focus:border-primary active:border-primary dark:border-form-strokedark dark:bg-form-input"
              />
            </div>

            <!-- Unit -->
            <div>
              <label class="mb-2.5 block text-black dark:text-white">
                Unit <span class="text-danger">*</span>
              </label>
              <select
                v-model="newProduct.unit"
                required
                class="w-full rounded border-[1.5px] border-stroke bg-transparent px-5 py-3 outline-none transition focus:border-primary active:border-primary dark:border-form-strokedark dark:bg-form-input"
              >
                <option value="" disabled>Select a unit</option>
                <option value="pieces">Pieces</option>
                <option value="kg">Kilograms (kg)</option>
                <option value="liters">Liters</option>
                <option value="meters">Meters</option>
                <option value="boxes">Boxes</option>
              </select>
            </div>
            <!-- Branch -->
            <div>
              <label class="mb-2.5 block text-black dark:text-white">
                Branch <span class="text-danger">*</span>
              </label>
              <select
                v-model="newProduct.branchId"
                required
                class="w-full rounded border-[1.5px] border-stroke bg-transparent px-5 py-3 outline-none transition focus:border-primary active:border-primary dark:border-form-strokedark dark:bg-form-input"
              >
                <option value="" disabled>Select a branch</option>
                <option v-for="branch in branches" :key="branch._id" :value="branch._id">
                  {{ branch.name }}
                </option>
              </select>
            </div>

            <!-- Current Stock -->
            <div>
              <label class="mb-2.5 block text-black dark:text-white">
                Current Stock <span class="text-danger">*</span>
              </label>
              <input
                v-model="newProduct.currentStock"
                type="number"
                required
                min="0"
                placeholder="Enter current stock"
                class="w-full rounded border-[1.5px] border-stroke bg-transparent px-5 py-3 outline-none transition focus:border-primary active:border-primary dark:border-form-strokedark dark:bg-form-input"
              />
            </div>

            <!-- Image Upload -->
            <!-- <div v-if="!isEditing">
              <label class="mb-2.5 block text-black dark:text-white">
                Product Image <span class="text-danger">*</span>
              </label>
              <input
                type="file"
                @change="handleImageChange"
                accept="image/*"
                required
                class="w-full rounded border-[1.5px] border-stroke bg-transparent px-5 py-3 outline-none transition focus:border-primary active:border-primary dark:border-form-strokedark dark:bg-form-input"
              />
            </div> -->
            <div v-if="!isEditing" class="col-span-2">
              <label class="mb-2.5 block text-black dark:text-white">
                Product Image <span class="text-danger">*</span>
              </label>
              <div class="flex items-center gap-4">
                <input
                  type="file"
                  @change="handleImageChange"
                  accept="image/*"
                  required
                  class="w-full rounded border-[1.5px] border-stroke bg-transparent px-5 py-3 outline-none transition focus:border-primary active:border-primary dark:border-form-strokedark dark:bg-form-input"
                />
                <img
                  v-if="imagePreview"
                  :src="imagePreview"
                  class="h-20 w-20 object-cover rounded"
                />
              </div>
            </div>
          </div>

          <div
            v-if="!isPriceValid && newProduct.price && newProduct.costPrice"
            class="text-danger text-sm"
          >
            Selling price must be greater than cost price
          </div>
          <!-- Form Actions -->
          <div class="flex justify-end gap-4">
            <button
              type="button"
              @click="
                () => {
                  handleCloseModal()
                }
              "
              class="rounded border border-stroke px-6 py-2 text-black hover:shadow-1 dark:border-strokedark dark:text-white"
            >
              Cancel
            </button>
            <button
              type="submit"
              :disabled="isSubmitting || !isPriceValid"
              class="rounded bg-primary px-6 py-2 text-white hover:bg-opacity-90 disabled:opacity-50"
            >
              {{ isSubmitting ? 'Saving...' : isEditing ? 'Update' : 'Create' }}
            </button>
          </div>
        </form>
      </div>
    </div>
  </div>
</template>
