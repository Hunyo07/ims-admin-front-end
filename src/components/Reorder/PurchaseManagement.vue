<script setup>
import { ref, onMounted, computed } from 'vue'
import axios from 'axios'
import { useAuthStore } from '@/stores/auth'
import Swal from 'sweetalert2'
import Datepicker from '@vuepic/vue-datepicker'
import '@vuepic/vue-datepicker/dist/main.css'

const authStore = useAuthStore()
const purchaseOrders = ref([])
const suppliers = ref([])
const products = ref([])
const isLoading = ref(false)
const showCreateModal = ref(false)
const showDetailsModal = ref(false)
const selectedOrder = ref(null)
const searchQuery = ref('')
const statusFilter = ref('all')

// Form data for creating a new purchase order
const newOrder = ref({
  supplierId: '',
  items: [{ productId: '', quantity: 1, unitPrice: 0 }],
  expectedDeliveryDate: null,
  notes: ''
})

// Fetch all purchase orders
const fetchPurchaseOrders = async () => {
  try {
    isLoading.value = true
    const response = await axios.get('http://localhost:5000/api/purchase-orders', {
      headers: {
        Authorization: `Bearer ${authStore.token}`
      }
    })
    purchaseOrders.value = response.data
  } catch (error) {
    console.error('Error fetching purchase orders:', error)
    Swal.fire({
      icon: 'error',
      title: 'Error',
      text: 'Failed to fetch purchase orders'
    })
  } finally {
    isLoading.value = false
  }
}

// Fetch suppliers
const fetchSuppliers = async () => {
  try {
    const response = await axios.get('http://localhost:5000/api/suppliers/suppliers', {
      headers: {
        Authorization: `Bearer ${authStore.token}`
      }
    })
    suppliers.value = response.data
  } catch (error) {
    console.error('Error fetching suppliers:', error)
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

// Add item to purchase order
const addItem = () => {
  newOrder.value.items.push({ productId: '', quantity: 1, unitPrice: 0 })
}

// Remove item from purchase order
const removeItem = (index) => {
  newOrder.value.items.splice(index, 1)
}

// Calculate total for an item
const calculateItemTotal = (item) => {
  return item.quantity * item.unitPrice
}

// Calculate total for the entire order
const calculateOrderTotal = computed(() => {
  return newOrder.value.items.reduce((total, item) => {
    return total + calculateItemTotal(item)
  }, 0)
})

// Set product price when product is selected
const setProductPrice = (index) => {
  const productId = newOrder.value.items[index].productId
  if (productId) {
    const product = products.value.find((p) => p._id === productId)
    if (product) {
      newOrder.value.items[index].unitPrice = product.costPrice || product.price * 0.7
    }
  }
}

// Create a new purchase order
const createPurchaseOrder = async () => {
  try {
    if (!newOrder.value.supplierId) {
      Swal.fire({
        icon: 'warning',
        title: 'Missing Information',
        text: 'Please select a supplier'
      })
      return
    }

    if (newOrder.value.items.some((item) => !item.productId || item.quantity <= 0)) {
      Swal.fire({
        icon: 'warning',
        title: 'Invalid Items',
        text: 'Please ensure all items have a product selected and a valid quantity'
      })
      return
    }

    isLoading.value = true
    const response = await axios.post('http://localhost:5000/api/purchase-orders', newOrder.value, {
      headers: {
        Authorization: `Bearer ${authStore.token}`
      }
    })

    Swal.fire({
      icon: 'success',
      title: 'Success',
      text: 'Purchase order created successfully'
    })

    // Reset form and close modal
    resetForm()
    showCreateModal.value = false

    // Refresh purchase orders list
    await fetchPurchaseOrders()
  } catch (error) {
    console.error('Error creating purchase order:', error)
    Swal.fire({
      icon: 'error',
      title: 'Error',
      text: error.response?.data?.message || 'Failed to create purchase order'
    })
  } finally {
    isLoading.value = false
  }
}

// Reset the form
const resetForm = () => {
  newOrder.value = {
    supplierId: '',
    items: [{ productId: '', quantity: 1, unitPrice: 0 }],
    expectedDeliveryDate: null,
    notes: ''
  }
}

// View purchase order details
const viewOrderDetails = async (orderId) => {
  try {
    isLoading.value = true
    const response = await axios.get(`http://localhost:5000/api/purchase-orders/${orderId}`, {
      headers: {
        Authorization: `Bearer ${authStore.token}`
      }
    })
    selectedOrder.value = response.data
    showDetailsModal.value = true
  } catch (error) {
    console.error('Error fetching purchase order details:', error)
    Swal.fire({
      icon: 'error',
      title: 'Error',
      text: 'Failed to fetch purchase order details'
    })
  } finally {
    isLoading.value = false
  }
}

// Update purchase order status
const updateOrderStatus = async (orderId, newStatus) => {
  try {
    isLoading.value = true
    await axios.patch(
      `http://localhost:5000/api/purchase-orders/${orderId}/status`,
      { status: newStatus },
      {
        headers: {
          Authorization: `Bearer ${authStore.token}`
        }
      }
    )

    Swal.fire({
      icon: 'success',
      title: 'Success',
      text: 'Purchase order status updated successfully'
    })

    // Refresh purchase orders list and details if modal is open
    await fetchPurchaseOrders()
    if (selectedOrder.value && selectedOrder.value._id === orderId) {
      await viewOrderDetails(orderId)
    }
  } catch (error) {
    console.error('Error updating purchase order status:', error)
    Swal.fire({
      icon: 'error',
      title: 'Error',
      text: 'Failed to update purchase order status'
    })
  } finally {
    isLoading.value = false
  }
}

// Generate purchase orders from reorder points
const generateFromReorderPoints = async () => {
  try {
    isLoading.value = true
    const response = await axios.post(
      'http://localhost:5000/api/purchase-orders/from-reorder-points',
      {}, // Removed branchId from request body
      {
        headers: {
          Authorization: `Bearer ${authStore.token}`
        }
      }
    )

    Swal.fire({
      icon: 'success',
      title: 'Success',
      text: response.data.message
    })

    // Refresh purchase orders list
    await fetchPurchaseOrders()
  } catch (error) {
    console.error('Error generating purchase orders:', error)
    Swal.fire({
      icon: 'error',
      title: 'Error',
      text: error.response?.data?.message || 'Failed to generate purchase orders'
    })
  } finally {
    isLoading.value = false
  }
}

// Filter purchase orders by status and search query
const filteredPurchaseOrders = computed(() => {
  let filtered = purchaseOrders.value

  // Filter by status
  if (statusFilter.value !== 'all') {
    filtered = filtered.filter((order) => order.status === statusFilter.value)
  }

  // Filter by search query
  if (searchQuery.value) {
    const query = searchQuery.value.toLowerCase()
    filtered = filtered.filter(
      (order) =>
        order.orderNumber.toLowerCase().includes(query) ||
        order.supplier.name.toLowerCase().includes(query)
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

// Format currency
const formatCurrency = (amount) => {
  return new Intl.NumberFormat('en-PH', {
    style: 'currency',
    currency: 'PHP'
  }).format(amount)
}

// Get status badge class
const getStatusBadgeClass = (status) => {
  switch (status) {
    case 'pending':
      return 'bg-warning text-white'
    case 'approved':
      return 'bg-info text-white'
    case 'shipped':
      return 'bg-primary text-white'
    case 'received':
      return 'bg-success text-white'
    case 'cancelled':
      return 'bg-danger text-white'
    default:
      return 'bg-gray-500 text-white'
  }
}

onMounted(async () => {
  await Promise.all([fetchPurchaseOrders(), fetchSuppliers(), fetchProducts()])
})
</script>

<template>
  <div
    class="rounded-sm border border-stroke bg-white shadow-default dark:border-strokedark dark:bg-boxdark"
  >
    <!-- Header -->
    <div class="border-b border-stroke py-4 px-6.5 dark:border-strokedark">
      <div class="flex flex-wrap items-center justify-between gap-4">
        <h3 class="text-xl font-semibold text-black dark:text-white">Purchase Orders Management</h3>
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
            Create Purchase Order
          </button>
          <button
            @click="generateFromReorderPoints"
            class="inline-flex items-center justify-center rounded-md bg-success py-2 px-4 text-white hover:bg-opacity-90"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              class="h-5 w-5 mr-1"
              viewBox="0 0 20 20"
              fill="currentColor"
            >
              <path
                fill-rule="evenodd"
                d="M5 2a1 1 0 011 1v1h1a1 1 0 010 2H6v1a1 1 0 01-2 0V6H3a1 1 0 010-2h1V3a1 1 0 011-1zm0 10a1 1 0 011 1v1h1a1 1 0 110 2H6v1a1 1 0 11-2 0v-1H3a1 1 0 110-2h1v-1a1 1 0 011-1zm7-10a1 1 0 01.707.293l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414-1.414L13.586 9H10a1 1 0 110-2h3.586l-2.293-2.293A1 1 0 0112 2z"
                clip-rule="evenodd"
              />
            </svg>
            Generate from Reorder Points
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
            placeholder="Search by order number or supplier..."
            class="w-full rounded-lg border border-stroke bg-transparent py-2 pl-4 pr-4 outline-none focus:border-primary dark:border-strokedark"
          />
        </div>
        <div>
          <select
            v-model="statusFilter"
            class="rounded-lg border border-stroke bg-transparent py-2 px-4 outline-none focus:border-primary dark:border-strokedark"
          >
            <option value="all">All Statuses</option>
            <option value="pending">Pending</option>
            <option value="approved">Approved</option>
            <option value="shipped">Shipped</option>
            <option value="received">Received</option>
            <option value="cancelled">Cancelled</option>
          </select>
        </div>
      </div>
    </div>

    <!-- Purchase Orders Table -->
    <div class="p-4">
      <div v-if="isLoading" class="flex justify-center items-center py-10">
        <div class="animate-spin rounded-full h-10 w-10 border-b-2 border-primary"></div>
      </div>

      <div v-else-if="filteredPurchaseOrders.length === 0" class="text-center py-10">
        <p class="text-lg text-gray-500 dark:text-gray-400">No purchase orders found</p>
      </div>

      <div v-else class="overflow-x-auto">
        <table class="w-full table-auto">
          <thead>
            <tr class="bg-gray-2 text-left dark:bg-meta-4">
              <th class="py-4 px-4 font-medium text-black dark:text-white">Order #</th>
              <th class="py-4 px-4 font-medium text-black dark:text-white">Supplier</th>
              <th class="py-4 px-4 font-medium text-black dark:text-white">Total</th>
              <th class="py-4 px-4 font-medium text-black dark:text-white">Status</th>
              <th class="py-4 px-4 font-medium text-black dark:text-white">Created</th>
              <th class="py-4 px-4 font-medium text-black dark:text-white">Actions</th>
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="order in filteredPurchaseOrders"
              :key="order._id"
              class="border-b border-stroke dark:border-strokedark"
            >
              <td class="py-3 px-4">{{ order.orderNumber }}</td>
              <td class="py-3 px-4">{{ order.supplier.name }}</td>
              <td class="py-3 px-4">{{ formatCurrency(order.totalAmount) }}</td>
              <td class="py-3 px-4">
                <span
                  :class="`px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusBadgeClass(
                    order.status
                  )}`"
                >
                  {{ order.status.charAt(0).toUpperCase() + order.status.slice(1) }}
                </span>
              </td>
              <td class="py-3 px-4">{{ formatDate(order.createdAt) }}</td>
              <td class="py-3 px-4">
                <div class="flex items-center space-x-2">
                  <button
                    @click="viewOrderDetails(order._id)"
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

                  <button
                    v-if="order.status === 'pending'"
                    @click="updateOrderStatus(order._id, 'approved')"
                    class="hover:text-success"
                    title="Approve"
                  >
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      class="h-5 w-5"
                      viewBox="0 0 20 20"
                      fill="currentColor"
                    >
                      <path
                        fill-rule="evenodd"
                        d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                        clip-rule="evenodd"
                      />
                    </svg>
                  </button>

                  <button
                    v-if="order.status === 'approved'"
                    @click="updateOrderStatus(order._id, 'shipped')"
                    class="hover:text-info"
                    title="Mark as Shipped"
                  >
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      class="h-5 w-5"
                      viewBox="0 0 20 20"
                      fill="currentColor"
                    >
                      <path
                        d="M8 16.5a1.5 1.5 0 11-3 0 1.5 1.5 0 013 0zM15 16.5a1.5 1.5 0 11-3 0 1.5 1.5 0 013 0z"
                      />
                      <path
                        d="M3 4a1 1 0 00-1 1v10a1 1 0 001 1h1.05a2.5 2.5 0 014.9 0H10a1 1 0 001-1v-5h2.05a2.5 2.5 0 014.9 0H19a1 1 0 001-1v-4a1 1 0 00-1-1h-8a1 1 0 00-.8.4L8.65 8H4a1 1 0 00-1-1V4z"
                      />
                    </svg>
                  </button>

                  <button
                    v-if="order.status === 'shipped'"
                    @click="updateOrderStatus(order._id, 'received')"
                    class="hover:text-success"
                    title="Mark as Received"
                  >
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      class="h-5 w-5"
                      viewBox="0 0 20 20"
                      fill="currentColor"
                    >
                      <path
                        d="M5 3a2 2 0 00-2 2v2a2 2 0 002 2h2a2 2 0 002-2V5a2 2 0 00-2-2H5zM5 11a2 2 0 00-2 2v2a2 2 0 002 2h2a2 2 0 002-2v-2a2 2 0 00-2-2H5zM11 5a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V5zM14 11a1 1 0 011 1v1h1a1 1 0 110 2h-1v1a1 1 0 11-2 0v-1h-1a1 1 0 110-2h1v-1a1 1 0 011-1z"
                      />
                    </svg>
                  </button>

                  <button
                    v-if="['pending', 'approved'].includes(order.status)"
                    @click="updateOrderStatus(order._id, 'cancelled')"
                    class="hover:text-danger"
                    title="Cancel"
                  >
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      class="h-5 w-5"
                      viewBox="0 0 20 20"
                      fill="currentColor"
                    >
                      <path
                        fill-rule="evenodd"
                        d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
                        clip-rule="evenodd"
                      />
                    </svg>
                  </button>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  </div>

  <!-- Create Purchase Order Modal -->
  <div
    v-if="showCreateModal"
    class="fixed inset-0 z-999 flex items-center justify-center bg-black bg-opacity-50"
  >
    <div
      class="w-full max-w-4xl max-h-[90vh] overflow-y-auto bg-white dark:bg-boxdark rounded-lg shadow-lg"
    >
      <div class="border-b border-stroke px-6.5 py-4 dark:border-strokedark">
        <div class="flex items-center justify-between">
          <h3 class="text-xl font-semibold text-black dark:text-white">Create Purchase Order</h3>
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
        <div class="mb-4.5 grid grid-cols-2 gap-6">
          <div class="col-span-1">
            <label class="mb-2.5 block text-black dark:text-white">
              Supplier <span class="text-meta-1">*</span>
            </label>
            <select
              v-model="newOrder.supplierId"
              class="w-full rounded border-[1.5px] border-stroke bg-transparent py-3 px-5 font-medium outline-none transition focus:border-primary active:border-primary disabled:cursor-default disabled:bg-whiter dark:border-form-strokedark dark:bg-form-input dark:focus:border-primary"
            >
              <option value="" disabled>Select Supplier</option>
              <option v-for="supplier in suppliers" :key="supplier._id" :value="supplier._id">
                {{ supplier.name }}
              </option>
            </select>
          </div>
        </div>

        <div class="mb-4.5">
          <label class="mb-2.5 block text-black dark:text-white"> Expected Delivery Date </label>
          <Datepicker
            v-model="newOrder.expectedDeliveryDate"
            class="w-full"
            :enable-time-picker="false"
            :min-date="new Date()"
            placeholder="Select delivery date"
          />
        </div>

        <div class="mb-4.5">
          <label class="mb-2.5 block text-black dark:text-white"> Notes </label>
          <textarea
            v-model="newOrder.notes"
            rows="3"
            class="w-full rounded border-[1.5px] border-stroke bg-transparent py-3 px-5 font-medium outline-none transition focus:border-primary active:border-primary disabled:cursor-default disabled:bg-whiter dark:border-form-strokedark dark:bg-form-input dark:focus:border-primary"
            placeholder="Add notes about this order"
          ></textarea>
        </div>

        <div class="mb-4.5">
          <div class="flex items-center justify-between mb-2.5">
            <label class="block text-black dark:text-white">
              Order Items <span class="text-meta-1">*</span>
            </label>
            <button
              @click="addItem"
              class="inline-flex items-center justify-center rounded-md bg-primary py-1 px-3 text-white hover:bg-opacity-90"
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

          <div
            v-for="(item, index) in newOrder.items"
            :key="index"
            class="mb-3 p-3 border border-stroke rounded-md dark:border-strokedark"
          >
            <div class="grid grid-cols-12 gap-3">
              <div class="col-span-5">
                <label class="mb-1 block text-sm text-black dark:text-white">
                  Product <span class="text-meta-1">*</span>
                </label>
                <select
                  v-model="item.productId"
                  @change="setProductPrice(index)"
                  class="w-full rounded border-[1.5px] border-stroke bg-transparent py-2 px-3 font-medium outline-none transition focus:border-primary active:border-primary disabled:cursor-default disabled:bg-whiter dark:border-form-strokedark dark:bg-form-input dark:focus:border-primary"
                >
                  <option value="" disabled>Select Product</option>
                  <option v-for="product in products" :key="product._id" :value="product._id">
                    {{ product.name }} ({{ product.sku }})
                  </option>
                </select>
              </div>

              <div class="col-span-2">
                <label class="mb-1 block text-sm text-black dark:text-white">
                  Quantity <span class="text-meta-1">*</span>
                </label>
                <input
                  type="number"
                  v-model.number="item.quantity"
                  min="1"
                  class="w-full rounded border-[1.5px] border-stroke bg-transparent py-2 px-3 font-medium outline-none transition focus:border-primary active:border-primary disabled:cursor-default disabled:bg-whiter dark:border-form-strokedark dark:bg-form-input dark:focus:border-primary"
                />
              </div>

              <div class="col-span-2">
                <label class="mb-1 block text-sm text-black dark:text-white">
                  Unit Price <span class="text-meta-1">*</span>
                </label>
                <input
                  type="number"
                  v-model.number="item.unitPrice"
                  min="0"
                  step="0.01"
                  class="w-full rounded border-[1.5px] border-stroke bg-transparent py-2 px-3 font-medium outline-none transition focus:border-primary active:border-primary disabled:cursor-default disabled:bg-whiter dark:border-form-strokedark dark:bg-form-input dark:focus:border-primary"
                />
              </div>

              <div class="col-span-2">
                <label class="mb-1 block text-sm text-black dark:text-white"> Total </label>
                <div
                  class="w-full rounded border-[1.5px] border-stroke bg-transparent py-2 px-3 font-medium dark:border-form-strokedark dark:bg-form-input"
                >
                  ₱{{ calculateItemTotal(item).toFixed(2) }}
                </div>
              </div>

              <div class="col-span-1 flex items-end justify-center">
                <button
                  @click="removeItem(index)"
                  class="text-danger hover:text-meta-1"
                  :disabled="newOrder.items.length === 1"
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

        <div class="mb-6 flex justify-end">
          <div class="text-lg font-semibold">Total: {{ formatCurrency(calculateOrderTotal) }}</div>
        </div>

        <div class="flex items-center justify-end gap-4">
          <button
            @click="showCreateModal = false"
            class="inline-flex items-center justify-center rounded-md border border-stroke py-2 px-6 text-center font-medium text-black hover:border-primary hover:bg-primary hover:text-white dark:border-strokedark dark:text-white"
          >
            Cancel
          </button>
          <button
            @click="createPurchaseOrder"
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
            Create Purchase Order
          </button>
        </div>
      </div>
    </div>
  </div>

  <!-- Purchase Order Details Modal -->
  <div
    v-if="showDetailsModal && selectedOrder"
    class="fixed inset-0 z-999 flex items-center justify-center bg-black bg-opacity-50"
  >
    <div
      class="w-full max-w-4xl max-h-[90vh] overflow-y-auto bg-white dark:bg-boxdark rounded-lg shadow-lg"
    >
      <div class="border-b border-stroke px-6.5 py-4 dark:border-strokedark">
        <div class="flex items-center justify-between">
          <h3 class="text-xl font-semibold text-black dark:text-white">Purchase Order Details</h3>
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
            <h4 class="text-lg font-semibold mb-3">Order Information</h4>
            <div class="space-y-2">
              <p><span class="font-medium">Order Number:</span> {{ selectedOrder.orderNumber }}</p>
              <p>
                <span class="font-medium">Status:</span>
                <span
                  :class="`px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusBadgeClass(
                    selectedOrder.status
                  )}`"
                >
                  {{ selectedOrder.status.charAt(0).toUpperCase() + selectedOrder.status.slice(1) }}
                </span>
              </p>
              <p>
                <span class="font-medium">Created:</span> {{ formatDate(selectedOrder.createdAt) }}
              </p>
              <p>
                <span class="font-medium">Expected Delivery:</span>
                {{ formatDate(selectedOrder.expectedDeliveryDate) }}
              </p>
              <p v-if="selectedOrder.receivedDate">
                <span class="font-medium">Received:</span>
                {{ formatDate(selectedOrder.receivedDate) }}
              </p>
              <p>
                <span class="font-medium">Total Amount:</span>
                {{ formatCurrency(selectedOrder.totalAmount) }}
              </p>
            </div>
          </div>

          <div class="col-span-1">
            <h4 class="text-lg font-semibold mb-3">Supplier & Branch</h4>
            <div class="space-y-2">
              <p><span class="font-medium">Supplier:</span> {{ selectedOrder.supplier.name }}</p>
              <p>
                <span class="font-medium">Contact:</span>
                {{ selectedOrder.supplier.contactPerson || 'N/A' }}
              </p>
              <p>
                <span class="font-medium">Phone:</span> {{ selectedOrder.supplier.phone || 'N/A' }}
              </p>
              <p>
                <span class="font-medium">Email:</span> {{ selectedOrder.supplier.email || 'N/A' }}
              </p>
            </div>
          </div>
        </div>

        <div class="mb-6">
          <h4 class="text-lg font-semibold mb-3">Order Items</h4>
          <div class="overflow-x-auto">
            <table class="w-full table-auto">
              <thead>
                <tr class="bg-gray-2 text-left dark:bg-meta-4">
                  <th class="py-3 px-4 font-medium text-black dark:text-white">Product</th>
                  <th class="py-3 px-4 font-medium text-black dark:text-white">SKU</th>
                  <th class="py-3 px-4 font-medium text-black dark:text-white">Quantity</th>
                  <th class="py-3 px-4 font-medium text-black dark:text-white">Unit Price</th>
                  <th class="py-3 px-4 font-medium text-black dark:text-white">Total</th>
                </tr>
              </thead>
              <tbody>
                <tr
                  v-for="item in selectedOrder.items"
                  :key="item._id"
                  class="border-b border-stroke dark:border-strokedark"
                >
                  <td class="py-3 px-4">{{ item.product.name }}</td>
                  <td class="py-3 px-4">{{ item.product.sku }}</td>
                  <td class="py-3 px-4">{{ item.quantity }}</td>
                  <td class="py-3 px-4">{{ formatCurrency(item.unitPrice) }}</td>
                  <td class="py-3 px-4">{{ formatCurrency(item.total) }}</td>
                </tr>
              </tbody>
              <tfoot>
                <tr>
                  <td colspan="4" class="py-3 px-4 text-right font-semibold">Total:</td>
                  <td class="py-3 px-4 font-semibold">
                    {{ formatCurrency(selectedOrder.totalAmount) }}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>

        <div v-if="selectedOrder.notes" class="mb-6">
          <h4 class="text-lg font-semibold mb-2">Notes</h4>
          <div class="p-4 bg-gray-1 dark:bg-meta-4 rounded-md">
            {{ selectedOrder.notes }}
          </div>
        </div>

        <div class="flex items-center justify-between">
          <div>
            <p class="text-sm text-gray-500 dark:text-gray-400">
              Created by: {{ selectedOrder.createdBy?.name || 'Unknown' }}
            </p>
          </div>

          <div class="flex items-center gap-3">
            <button
              v-if="selectedOrder.status === 'pending'"
              @click="updateOrderStatus(selectedOrder._id, 'approved')"
              class="inline-flex items-center justify-center rounded-md bg-success py-2 px-4 text-white hover:bg-opacity-90"
            >
              Approve Order
            </button>

            <button
              v-if="selectedOrder.status === 'approved'"
              @click="updateOrderStatus(selectedOrder._id, 'shipped')"
              class="inline-flex items-center justify-center rounded-md bg-info py-2 px-4 text-white hover:bg-opacity-90"
            >
              Mark as Shipped
            </button>

            <button
              v-if="selectedOrder.status === 'shipped'"
              @click="updateOrderStatus(selectedOrder._id, 'received')"
              class="inline-flex items-center justify-center rounded-md bg-success py-2 px-4 text-white hover:bg-opacity-90"
            >
              Mark as Received
            </button>

            <button
              v-if="['pending', 'approved'].includes(selectedOrder.status)"
              @click="updateOrderStatus(selectedOrder._id, 'cancelled')"
              class="inline-flex items-center justify-center rounded-md bg-danger py-2 px-4 text-white hover:bg-opacity-90"
            >
              Cancel Order
            </button>

            <button
              @click="showDetailsModal = false"
              class="inline-flex items-center justify-center rounded-md border border-stroke py-2 px-4 text-center font-medium text-black hover:border-primary hover:bg-primary hover:text-white dark:border-strokedark dark:text-white"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
