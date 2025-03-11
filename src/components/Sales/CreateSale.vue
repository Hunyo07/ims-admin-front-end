<script setup lang="ts">
import { ref, onMounted, computed, watch } from 'vue'
import axios from 'axios'
import { useAuthStore } from '@/stores/auth'
import Swal from 'sweetalert2'
import { inject } from 'vue'
const placeholderImage = inject('placeholderImage', '/images/no-image.png')
const authStore = useAuthStore()

// Interfaces
interface Product {
  _id: string
  name: string
  sku: string
  price: number
  currentStock: number
  image?: string
}

interface CartItem {
  productId: string
  name: string
  price: number
  quantity: number
  maxQuantity: number
  total: number
}

interface Branch {
  _id: string
  name: string
}

// State
const products = ref<Product[]>([])
const filteredProducts = ref<Product[]>([])
const searchQuery = ref('')
const isLoading = ref(true)
const cart = ref<CartItem[]>([])
const customerName = ref('Walk-in Customer')
const customerPhone = ref('')
const paymentMethod = ref('cash')
const paymentAmount = ref(0)
const isProcessing = ref(false)
const deliveryMode = ref('walk-in')
const deliveryAddress = ref('')
const deliveryFee = ref(0)

// Computed properties
const subtotal = computed(() => {
  return cart.value.reduce((sum, item) => sum + item.total, 0)
})

// Update the total computed property to include delivery fee
const total = computed(() => {
  return subtotal.value + (deliveryMode.value === 'delivery' ? deliveryFee.value : 0)
})

const change = computed(() => {
  return Math.max(0, paymentAmount.value - total.value)
})

const insufficientPayment = computed(() => {
  return paymentAmount.value < total.value
})

// Methods
const fetchProducts = async () => {
  try {
    isLoading.value = true
    const response = await axios.get('http://localhost:5000/api/products', {
      headers: {
        Authorization: `Bearer ${authStore.token}`
      }
    })
    products.value = response.data.products || response.data
    filteredProducts.value = [...products.value]
  } catch (error) {
    console.error('Error fetching products:', error)
    Swal.fire({
      icon: 'error',
      title: 'Error',
      text: error.response?.data?.message || 'Failed to fetch products'
    })
  } finally {
    isLoading.value = false
  }
}

const fetchBranches = async () => {
  try {
    const response = await axios.get('http://localhost:5000/api/branches', {
      headers: {
        Authorization: `Bearer ${authStore.token}`
      }
    })
    branches.value = response.data.data || response.data
    if (branches.value.length > 0) {
      selectedBranch.value = branches.value[0]._id
    }
  } catch (error) {
    console.error('Error fetching branches:', error)
  }
}

const filterProducts = () => {
  if (!searchQuery.value) {
    filteredProducts.value = [...products.value]
    return
  }
  
  const query = searchQuery.value.toLowerCase()
  filteredProducts.value = products.value.filter(product => 
    product.name.toLowerCase().includes(query) || 
    product.sku.toLowerCase().includes(query)
  )
}

const addToCart = (product: Product) => {
  const existingItem = cart.value.find(item => item.productId === product._id)
  
  if (existingItem) {
    if (existingItem.quantity < existingItem.maxQuantity) {
      existingItem.quantity++
      existingItem.total = existingItem.price * existingItem.quantity
    } else {
      Swal.fire({
        icon: 'warning',
        title: 'Stock Limit Reached',
        text: `Only ${existingItem.maxQuantity} units available for ${product.name}`
      })
    }
  } else {
    cart.value.push({
      productId: product._id,
      name: product.name,
      price: product.price,
      quantity: 1,
      maxQuantity: product.currentStock,
      total: product.price
    })
  }
  
  // Update payment amount to match total automatically
  paymentAmount.value = total.value
}

const removeFromCart = (index: number) => {
  cart.value.splice(index, 1)
  
  // Update payment amount to match total automatically
  paymentAmount.value = total.value
}

const updateQuantity = (index: number, newQuantity: number) => {
  const item = cart.value[index]
  
  if (newQuantity <= 0) {
    cart.value.splice(index, 1)
  } else if (newQuantity <= item.maxQuantity) {
    item.quantity = newQuantity
    item.total = item.price * newQuantity
  } else {
    Swal.fire({
      icon: 'warning',
      title: 'Stock Limit Reached',
      text: `Only ${item.maxQuantity} units available for ${item.name}`
    })
    item.quantity = item.maxQuantity
    item.total = item.price * item.maxQuantity
  }
  
  // Update payment amount to match total automatically
  paymentAmount.value = total.value
}

const clearCart = () => {
  cart.value = []
  paymentAmount.value = 0
}

const processSale = async () => {
  if (cart.value.length === 0) {
    Swal.fire({
      icon: 'warning',
      title: 'Empty Cart',
      text: 'Please add items to the cart before processing the sale'
    })
    return
  }
  
  if (insufficientPayment.value) {
    Swal.fire({
      icon: 'warning',
      title: 'Insufficient Payment',
      text: `Payment amount must be at least ${formatCurrency(total.value)}`
    })
    return
  }
  
  try {
    isProcessing.value = true
    
    const saleData = {
      items: cart.value.map(item => ({
        productId: item.productId,
        quantity: item.quantity
      })),
      customerName: customerName.value,
      customerPhone: customerPhone.value,
      customerId: selectedCustomer.value?._id, // Add this line
      paymentMethod: paymentMethod.value,
      paymentAmount: paymentAmount.value,
      deliveryMode: deliveryMode.value,
      deliveryAddress: deliveryMode.value === 'delivery' ? deliveryAddress.value : '',
      deliveryFee: deliveryMode.value === 'delivery' ? deliveryFee.value : 0
    }
    
    const response = await axios.post('http://localhost:5000/api/sales', saleData, {
      headers: {
        Authorization: `Bearer ${authStore.token}`
      }
    })
    
    Swal.fire({
      icon: 'success',
      title: 'Sale Completed',
      text: `Total: ${formatCurrency(response.data.sale.total)}, Change: ${formatCurrency(response.data.sale.change)}`
    })
    
    // Reset form
    clearCart()
    customerName.value = 'Walk-in Customer'
    customerPhone.value = ''
    customerSearchQuery.value = ''
    selectedCustomer.value = null
    paymentMethod.value = 'cash'
    paymentAmount.value = 0
    deliveryMode.value = 'walk-in'
    deliveryAddress.value = ''
    deliveryFee.value = 0
    
    // Refresh product list to get updated stock levels
    fetchProducts()
    
  } catch (error) {
    console.error('Error processing sale:', error)
    Swal.fire({
      icon: 'error',
      title: 'Error',
      text: error.response?.data?.message || 'Failed to process sale'
    })
  } finally {
    isProcessing.value = false
  }
}

const formatCurrency = (amount: number) => {
  return new Intl.NumberFormat('en-PH', {
    style: 'currency',
    currency: 'PHP'
  }).format(amount)
}

// Watch for search query changes
watch(searchQuery, filterProducts)

// Initialize component
onMounted(() => {
  fetchProducts()
  // Remove fetchBranches() call
})
// Add these to your state variables
const customers = ref([])
const selectedCustomer = ref(null)
const isLoadingCustomers = ref(false)
const customerSearchQuery = ref('')
const showCustomerDropdown = ref(false)
const filteredCustomers = ref([])

// Add this method to fetch customers
// Update the fetchCustomers method to use a different endpoint if needed
const fetchCustomers = async (query = '') => {
  try {
    isLoadingCustomers.value = true
    // Use the main customers endpoint with search parameter instead
    const response = await axios.get(`http://localhost:5000/api/customers?search=${query}&limit=10`, {
      headers: {
        Authorization: `Bearer ${authStore.token}`
      }
    })
    
    // Transform the data to match the expected format
    const customerData = response.data.customers || []
    customers.value = customerData.map(customer => ({
      _id: customer._id,
      name: `${customer.firstName} ${customer.lastName}`,
      phone: customer.phoneNumber,
      email: customer.email,
      address: customer.address
    }))
    
    filteredCustomers.value = [...customers.value]
  } catch (error) {
    console.error('Error fetching customers:', error)
    // Fallback to local filtering if API fails
    customers.value = []
    filteredCustomers.value = []
  } finally {
    isLoadingCustomers.value = false
  }
}

// Add this method to filter customers based on search query
const filterCustomers = () => {
  if (!customerSearchQuery.value) {
    filteredCustomers.value = [...customers.value]
    return
  }
  
  const query = customerSearchQuery.value.toLowerCase()
  filteredCustomers.value = customers.value.filter(customer => 
    customer.name.toLowerCase().includes(query) || 
    (customer.phone && customer.phone.includes(query))
  )
}

// Update the selectCustomer method to also populate the delivery address
const selectCustomer = (customer) => {
  selectedCustomer.value = customer
  customerName.value = customer.name
  customerPhone.value = customer.phone || ''
  
  // Auto-populate delivery address if available
  if (customer.address) {
    // Format the address based on available fields
    const addressParts = []
    if (customer.address.street) addressParts.push(customer.address.street)
    if (customer.address.barangay) addressParts.push(customer.address.barangay)
    if (customer.address.city) addressParts.push(customer.address.city)
    if (customer.address.province) addressParts.push(customer.address.province)
    
    deliveryAddress.value = addressParts.join(', ')
  }
  
  showCustomerDropdown.value = false
}

// Add this to your onMounted
onMounted(() => {
  fetchProducts()
  fetchCustomers()
})

// Add this watch for customer search
watch(customerSearchQuery, () => {
  filterCustomers()
  showCustomerDropdown.value = true
})
</script>

<template>
  <div class="grid grid-cols-1 gap-6 md:grid-cols-3">
    <!-- Product Selection -->
    <div class="md:col-span-2 rounded-sm border border-stroke bg-white p-5 shadow-default dark:border-strokedark dark:bg-boxdark">
      <div class="mb-6">
        <h4 class="text-xl font-semibold text-black dark:text-white mb-3">Products</h4>
        <div class="relative">
          <input
            type="text"
            v-model="searchQuery"
            placeholder="Search products by name or SKU..."
            class="w-full rounded-lg border-[1.5px] border-stroke bg-transparent pl-10 pr-5 py-3 outline-none transition focus:border-primary active:border-primary dark:border-form-strokedark dark:bg-form-input"
          />
          <span class="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">
            <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </span>
        </div>
      </div>
      
      <!-- Loading, empty states and product grid with improved styling -->
      <div v-if="isLoading" class="flex justify-center py-12">
        <div class="animate-spin h-10 w-10 border-4 border-primary border-t-transparent rounded-full"></div>
      </div>
      
      <div v-else-if="filteredProducts.length === 0" class="flex flex-col items-center justify-center py-12">
        <svg xmlns="http://www.w3.org/2000/svg" class="h-16 w-16 text-gray-400 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        <p class="text-gray-500 dark:text-gray-400 text-lg">No products found</p>
      </div>
      
      <div v-else class="grid grid-cols-2 md:grid-cols-3 gap-4">
        <div
          v-for="product in filteredProducts"
          :key="product._id"
          class="rounded-lg border border-stroke bg-white p-3 shadow-sm dark:border-strokedark dark:bg-boxdark cursor-pointer hover:shadow-lg transition-all transform hover:-translate-y-1"
          @click="addToCart(product)"
          :class="{ 'opacity-60 cursor-not-allowed': product.currentStock <= 0 }"
        >
          <div class="flex flex-col h-full">
            <div class="mb-3 h-28 overflow-hidden rounded-lg relative">
              <img
                :src="product.images[0].url || placeholderImage"
                :alt="product.name"
                class="h-full w-full object-cover"
              />
              <span 
                v-if="product.currentStock <= 0" 
                class="absolute inset-0 bg-black bg-opacity-50 flex items-center justify-center text-white font-medium"
              >
                Out of Stock
              </span>
            </div>
            <h5 class="text-sm font-medium text-black dark:text-white truncate">{{ product.name }}</h5>
            <p class="text-xs text-gray-500 dark:text-gray-400">SKU: {{ product.sku }}</p>
            <div class="mt-auto pt-3 flex justify-between items-center">
              <p class="text-sm font-semibold text-black dark:text-white">{{ formatCurrency(product.price) }}</p>
              <span 
                class="text-xs px-2 py-1 rounded-full" 
                :class="product.currentStock > 0 ? 'bg-success bg-opacity-10 text-success' : 'bg-danger bg-opacity-10 text-danger'"
              >
                {{ product.currentStock > 0 ? `${product.currentStock} in stock` : 'Out of stock' }}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
    
    <!-- Cart and Checkout with improved styling -->
    <div class="rounded-sm border border-stroke bg-white p-5 shadow-default dark:border-strokedark dark:bg-boxdark">
      <div class="mb-6 flex items-center justify-between">
        <h4 class="text-xl font-semibold text-black dark:text-white">Cart</h4>
        <button
          @click="clearCart"
          class="text-sm text-danger hover:underline flex items-center"
          :disabled="cart.length === 0"
        >
          <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
          </svg>
          Clear All
        </button>
      </div>
      
      <!-- Empty cart state with improved styling -->
      <div v-if="cart.length === 0" class="flex flex-col items-center justify-center py-10">
        <svg xmlns="http://www.w3.org/2000/svg" class="h-16 w-16 text-gray-400 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" />
        </svg>
        <p class="text-gray-500 dark:text-gray-400 text-lg">Cart is empty</p>
      </div>
      
      <!-- Cart items with improved styling -->
      <div v-else class="space-y-4 max-h-80 overflow-y-auto mb-4 pr-1">
        <div
          v-for="(item, index) in cart"
          :key="index"
          class="flex items-center justify-between border-b border-stroke pb-3 dark:border-strokedark"
        >
          <div class="flex-1">
            <h5 class="text-sm font-medium text-black dark:text-white truncate">{{ item.name }}</h5>
            <p class="text-xs text-gray-500 dark:text-gray-400">{{ formatCurrency(item.price) }} each</p>
          </div>
          
          <div class="flex items-center gap-2">
            <button
              @click="updateQuantity(index, item.quantity - 1)"
              class="flex h-6 w-6 items-center justify-center rounded-full border border-stroke bg-gray-100 hover:bg-gray-200 dark:border-strokedark dark:bg-meta-4"
            >
              -
            </button>
            <input
              type="number"
              :value="item.quantity"
              @input="updateQuantity(index, parseInt($event.target.value) || 0)"
              class="h-7 w-12 rounded border border-stroke bg-transparent text-center text-xs outline-none dark:border-strokedark"
              min="1"
              :max="item.maxQuantity"
            />
            <button
              @click="updateQuantity(index, item.quantity + 1)"
              class="flex h-6 w-6 items-center justify-center rounded-full border border-stroke bg-gray-100 hover:bg-gray-200 dark:border-strokedark dark:bg-meta-4"
              :disabled="item.quantity >= item.maxQuantity"
            >
              +
            </button>
          </div>
          
          <div class="ml-4 flex items-center gap-2">
            <p class="text-sm font-medium text-black dark:text-white">{{ formatCurrency(item.total) }}</p>
            <button
              @click="removeFromCart(index)"
              class="text-danger hover:text-opacity-80 p-1 rounded-full hover:bg-danger hover:bg-opacity-10"
            >
              <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>
      </div>
      
      <!-- Checkout Form with improved styling -->
      <div class="space-y-5 mt-6">
        <!-- Replace the customer name and phone inputs with this -->
        <div>
          <label class="mb-2.5 block text-sm font-medium text-black dark:text-white">Customer</label>
          <div class="relative">
            <input
              type="text"
              v-model="customerSearchQuery"
              placeholder="Search customer by name or phone..."
              class="w-full rounded-lg border-[1.5px] border-stroke bg-transparent px-4 py-2.5 outline-none transition focus:border-primary active:border-primary dark:border-form-strokedark dark:bg-form-input"
              @focus="showCustomerDropdown = true"
            />
            <button 
              v-if="customerSearchQuery" 
              @click="customerSearchQuery = ''; selectedCustomer = null; customerName = 'Walk-in Customer'; customerPhone = ''"
              class="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700"
            >
              <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
            
            <!-- Customer dropdown -->
            <div 
              v-if="showCustomerDropdown && customerSearchQuery" 
              class="absolute z-10 mt-1 w-full rounded-md bg-white shadow-lg dark:bg-boxdark border border-stroke dark:border-strokedark max-h-60 overflow-y-auto"
            >
              <div v-if="isLoadingCustomers" class="p-3 text-center">
                <div class="animate-spin h-5 w-5 border-2 border-primary border-t-transparent rounded-full mx-auto"></div>
              </div>
              <div v-else-if="filteredCustomers.length === 0" class="p-3 text-center text-gray-500">
                No customers found. Enter details below.
              </div>
              <ul v-else class="py-1">
                <li 
                  v-for="customer in filteredCustomers" 
                  :key="customer._id"
                  @click="selectCustomer(customer)"
                  class="px-4 py-2 hover:bg-gray-100 dark:hover:bg-meta-4 cursor-pointer"
                >
                  <div class="font-medium">{{ customer.name }}</div>
                  <div class="text-xs text-gray-500">{{ customer.phone || 'No phone' }}</div>
                </li>
              </ul>
            </div>
          </div>
          
          <!-- Customer details fields -->
          <div class="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
            <div>
              <label class="mb-2.5 block text-sm font-medium text-black dark:text-white">Customer Name</label>
              <input
                type="text"
                v-model="customerName"
                class="w-full rounded-lg border-[1.5px] border-stroke bg-transparent px-4 py-2.5 outline-none transition focus:border-primary active:border-primary dark:border-form-strokedark dark:bg-form-input"
              />
            </div>
            
            <div>
              <label class="mb-2.5 block text-sm font-medium text-black dark:text-white">Customer Phone</label>
              <input
                type="text"
                v-model="customerPhone"
                placeholder="Enter customer phone number"
                class="w-full rounded-lg border-[1.5px] border-stroke bg-transparent px-4 py-2.5 outline-none transition focus:border-primary active:border-primary dark:border-form-strokedark dark:bg-form-input"
              />
            </div>
          </div>
        </div>
        
        <div>
          <label class="mb-2.5 block text-sm font-medium text-black dark:text-white">Delivery Mode</label>
          <div class="flex gap-6 mt-2">
            <label class="flex items-center cursor-pointer">
              <input
                type="radio"
                v-model="deliveryMode"
                value="walk-in"
                class="mr-2 accent-primary"
              />
              <span>Walk-in</span>
            </label>
            <label class="flex items-center cursor-pointer">
              <input
                type="radio"
                v-model="deliveryMode"
                value="delivery"
                class="mr-2 accent-primary"
              />
              <span>Delivery</span>
            </label>
          </div>
        </div>
          
        <!-- Delivery options with improved styling -->
        <div v-if="deliveryMode === 'delivery'" class="space-y-5 pt-2 border-t border-dashed border-stroke dark:border-strokedark">
          <div>
            <label class="mb-2.5 block text-sm font-medium text-black dark:text-white">Delivery Address</label>
            <textarea
              v-model="deliveryAddress"
              rows="2"
              placeholder="Enter delivery address"
              class="w-full rounded-lg border-[1.5px] border-stroke bg-transparent px-4 py-2.5 outline-none transition focus:border-primary active:border-primary dark:border-form-strokedark dark:bg-form-input"
            ></textarea>
          </div>
          
          <div>
            <label class="mb-2.5 block text-sm font-medium text-black dark:text-white">Delivery Fee</label>
            <div class="relative">
              <input
                type="number"
                v-model="deliveryFee"
                min="0"
                step="10"
                class="w-full rounded-lg border-[1.5px] border-stroke bg-transparent pl-10 pr-4 py-2.5 outline-none transition focus:border-primary active:border-primary dark:border-form-strokedark dark:bg-form-input"
              />
              <span class="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">₱</span>
            </div>
          </div>
        </div>
        
        <div>
          <label class="mb-2.5 block text-sm font-medium text-black dark:text-white">Payment Method</label>
          <select
            v-model="paymentMethod"
            class="w-full rounded-lg border-[1.5px] border-stroke bg-transparent px-4 py-2.5 outline-none transition focus:border-primary active:border-primary dark:border-form-strokedark dark:bg-form-input"
          >
            <option value="cash">Cash</option>
            <option value="gcash">GCash</option>
            <option value="card">Card</option>
          </select>
        </div>
        
        <div>
          <label class="mb-2.5 block text-sm font-medium text-black dark:text-white">Payment Amount</label>
          <div class="relative">
            <input
              type="number"
              v-model="paymentAmount"
              class="w-full rounded-lg border-[1.5px] border-stroke bg-transparent pl-10 pr-4 py-2.5 outline-none transition focus:border-primary active:border-primary dark:border-form-strokedark dark:bg-form-input"
              :class="{ 'border-danger': insufficientPayment }"
            />
            <span class="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">₱</span>
          </div>
          <p v-if="insufficientPayment" class="mt-1 text-xs text-danger">
            Payment amount must be at least {{ formatCurrency(total) }}
          </p>
        </div>
      </div>
      
         <!-- Order Summary -->
         <div class="mt-6 space-y-2 border-t border-stroke pt-4 dark:border-strokedark">
        <div class="flex justify-between">
          <p class="text-sm">Subtotal:</p>
          <p class="text-sm font-medium">{{ formatCurrency(subtotal) }}</p>
        </div>
        
        <div v-if="deliveryMode === 'delivery'" class="flex justify-between">
          <p class="text-sm">Delivery Fee:</p>
          <p class="text-sm font-medium">{{ formatCurrency(deliveryFee) }}</p>
        </div>
        
        <div class="flex justify-between text-primary">
          <p class="text-sm font-semibold">Total:</p>
          <p class="text-sm font-semibold">{{ formatCurrency(total) }}</p>
        </div>
        
        <div class="flex justify-between">
          <p class="text-sm">Payment:</p>
          <p class="text-sm font-medium">{{ formatCurrency(paymentAmount) }}</p>
        </div>
        
        <div class="flex justify-between text-success">
          <p class="text-sm font-medium">Change:</p>
          <p class="text-sm font-medium">{{ formatCurrency(change) }}</p>
        </div>
      </div>
      
      <!-- Checkout Button -->
      <div class="mt-6">
        <button
          @click="processSale"
          :disabled="cart.length === 0 || insufficientPayment || isProcessing"
          class="w-full rounded-lg bg-primary py-3 px-6 text-white transition hover:bg-opacity-90 disabled:bg-opacity-50 flex items-center justify-center"
        >
          <span v-if="isProcessing" class="flex items-center">
            <svg class="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
              <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
            Processing...
          </span>
          <span v-else class="flex items-center">
            <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            Complete Sale
          </span>
        </button>
      </div>
    </div>
  </div>
</template>