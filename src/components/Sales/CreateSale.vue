<script setup lang="ts">
import { ref, onMounted, computed, watch } from 'vue'
import axios from 'axios'
import { useAuthStore } from '@/stores/auth'
import Swal from 'sweetalert2'
import { inject } from 'vue'
import { jsPDF } from 'jspdf'
import autoTable from 'jspdf-autotable'
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

interface LastSale {
  cart: any[];
  subtotal: number;
  total: number;
  paymentAmount: number;
  change: number;
  customerName: string;
  deliveryFee: number;
  deliveryMode: string;
  date: string;
  orderNumber?: string;
  notes?: string;
}

// Add a type for customers returned from the backend
interface BackendCustomer {
  _id: string;
  name: string;
  phone: string;
  email: string;
  address: {
    street: string;
    barangay: string;
    city: string;
    province: string;
    zipCode: string;
    deliveryInstructions?: string;
    landmarkNotes?: string;
  };
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
const showReceipt = ref(false)
const lastSale = ref<LastSale | null>(null)

const closeReceipt = () => {
  showReceipt.value = false
  lastSale.value = null
}

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
    const response = await axios.get('https://ims-api-id38.onrender.com/api/products', {
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

const printReceipt = () => {
  const printContents = document.getElementById('receipt-section').innerHTML
  const originalContents = document.body.innerHTML
  document.body.innerHTML = printContents
  window.print()
  document.body.innerHTML = originalContents
  window.location.reload()
}

const saveReceiptAsPDF = () => {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const marginLeft = 20;
  const marginRight = 20;
  const pageWidth = doc.internal.pageSize.width;
  const contentWidth = pageWidth - marginLeft - marginRight;
  let y = 20;

  // Title
  doc.setFontSize(22);
  doc.setFont('helvetica', 'bold');
  doc.text('Sales Receipt', pageWidth / 2, y, { align: 'center' });
  y += 12;

  // Order Number and Date
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  if (lastSale.value && lastSale.value.orderNumber) {
    doc.text(`Order #: ${lastSale.value.orderNumber}`, marginLeft, y);
  }
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.text(`Date: ${lastSale.value?.date || new Date().toLocaleString()}`, pageWidth - marginRight, y, { align: 'right' });
  y += 15;

  // Info Boxes (Order Info, Customer Info, Cashier)
  doc.setDrawColor(240, 240, 240);
  doc.setFillColor(250, 250, 250);
  doc.roundedRect(marginLeft, y, contentWidth / 2 - 5, 32, 2, 2, 'FD');
  doc.roundedRect(marginLeft + contentWidth / 2 + 5, y, contentWidth / 2 - 5, 32, 2, 2, 'FD');

  // Order Info
  let infoY = y + 7;
  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(60, 60, 60);
  doc.text('Order Information', marginLeft + 5, infoY);
  infoY += 6;
  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(0, 0, 0);
  doc.text(`Status: Completed`, marginLeft + 5, infoY);
  infoY += 5;
  doc.text(`Total: ${formatCurrencyForPDF(lastSale.value?.total ?? total.value)}`, marginLeft + 5, infoY);
  infoY += 5;
  doc.text(`Payment: ${formatCurrencyForPDF(lastSale.value?.paymentAmount ?? paymentAmount.value)}`, marginLeft + 5, infoY);
  infoY += 5;
  doc.text(`Change: ${formatCurrencyForPDF(lastSale.value?.change ?? change.value)}`, marginLeft + 5, infoY);
  if ((lastSale.value?.deliveryMode ?? deliveryMode.value) === 'delivery') {
    infoY += 5;
    doc.text(`Delivery Fee: ${formatCurrencyForPDF(lastSale.value?.deliveryFee ?? deliveryFee.value)}`, marginLeft + 5, infoY);
  }

  // Customer Info & Cashier
  let custY = y + 7;
  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.text('Customer Information', marginLeft + contentWidth / 2 + 10, custY);
  custY += 6;
  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.text(`Name: ${lastSale.value?.customerName || customerName.value}`, marginLeft + contentWidth / 2 + 10, custY);
  custY += 5;
  doc.text(`Phone: ${customerPhone.value || 'N/A'}`, marginLeft + contentWidth / 2 + 10, custY);
  custY += 5;
  doc.text(`Cashier: ${authStore.user?.firstName || ''} ${authStore.user?.lastName || ''}`.trim(), marginLeft + contentWidth / 2 + 10, custY);

  y += 32 + 10;

  // Items Table
  const isDelivery = (lastSale.value?.deliveryMode ?? deliveryMode.value) === 'delivery';
  autoTable(doc, {
    startY: y,
    head: [['Product', 'SKU', 'Quantity', 'Unit Price', 'Total']],
    body: (lastSale.value?.cart || cart.value).map(item => [
      item.name,
      item.sku || '',
      String(item.quantity),
      formatCurrencyForPDF(item.price),
      formatCurrencyForPDF(item.price * item.quantity)
    ]),
    theme: 'grid',
    headStyles: { fillColor: [240, 240, 240], textColor: [0, 0, 0], fontStyle: 'bold' },
    styles: { fontSize: 9, cellPadding: 3 },
    columnStyles: {
      0: { cellWidth: 60 },
      1: { cellWidth: 30 },
      2: { cellWidth: 20, halign: 'center' },
      3: { cellWidth: 30, halign: 'right' },
      4: { cellWidth: 30, halign: 'right' }
    },
    foot: [
      ...(isDelivery ? [[
        { content: '', colSpan: 3 },
        { content: 'Delivery Fee:', styles: { fontStyle: 'bold' as const, halign: 'right' as const } },
        { content: formatCurrencyForPDF(lastSale.value?.deliveryFee ?? deliveryFee.value), styles: { fontStyle: 'bold' as const, halign: 'right' as const } }
      ]] : []),
      [
        { content: '', colSpan: 3 },
        { content: 'Total:', styles: { fontStyle: 'bold' as const, halign: 'right' as const } },
        { content: formatCurrencyForPDF(lastSale.value?.total ?? total.value), styles: { fontStyle: 'bold' as const, halign: 'right' as const } }
      ]
    ],
    margin: { left: marginLeft, right: marginRight }
  });
  // Fix for jsPDF lastAutoTable type error
  y = ((doc as any).lastAutoTable && (doc as any).lastAutoTable.finalY) ? (doc as any).lastAutoTable.finalY + 10 : y + 10;

  // Notes (if any)
  if (lastSale.value && lastSale.value.notes) {
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.text('Notes', marginLeft, y);
    y += 7;
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.setDrawColor(240, 240, 240);
    doc.setFillColor(250, 250, 250);
    doc.roundedRect(marginLeft, y, contentWidth, 20, 2, 2, 'FD');
    const splitNotes = doc.splitTextToSize(lastSale.value.notes, contentWidth - 10);
    doc.text(splitNotes, marginLeft + 5, y + 5);
    y += 25;
  }

  // Thank you message
  doc.setFont('helvetica', 'italic');
  doc.setFontSize(12);
  doc.text('Thank you for your purchase!', pageWidth / 2, y, { align: 'center' });
  doc.save('receipt.pdf');
}
const formatCurrencyForPDF = (amount: number) => {
  // Format without using Intl.NumberFormat to avoid compatibility issues with jsPDF
  return 'PHP ' + amount.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',')
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
    
    const response = await axios.post('https://ims-api-id38.onrender.com/api/sales', saleData, {
      headers: {
        Authorization: `Bearer ${authStore.token}`
      }
    })
    
    // Swal.fire({
    //   icon: 'success',
    //   title: 'Sale Completed',
    //   text: `Total: ${formatCurrency(response.data.sale.total)}, Change: ${formatCurrency(response.data.sale.change)}`
    // })
    
    // Set receipt data BEFORE clearing cart/resetting form
    lastSale.value = {
      cart: JSON.parse(JSON.stringify(cart.value)),
      subtotal: subtotal.value,
      total: total.value,
      paymentAmount: paymentAmount.value,
      change: change.value,
      customerName: customerName.value,
      deliveryFee: deliveryFee.value,
      deliveryMode: deliveryMode.value,
      date: new Date().toLocaleString()
    }
    showReceipt.value = true
    
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
    let message = 'Failed to process sale'
  if (axios.isAxiosError && axios.isAxiosError(error)) {
    message = error.response?.data?.message || error.message
  } else if (error instanceof Error) {
    message = error.message
  }
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
const customers = ref<BackendCustomer[]>([])
const selectedCustomer = ref<BackendCustomer | null>(null)
const isLoadingCustomers = ref(false)
const customerSearchQuery = ref('')
const showCustomerDropdown = ref(false)
const filteredCustomers = ref<BackendCustomer[]>([])

// Add this method to fetch customers
// Update the fetchCustomers method to use a different endpoint if needed
const fetchCustomers = async (query = '') => {
  try {
    isLoadingCustomers.value = true;
    const response = await axios.get(`https://ims-api-id38.onrender.com/api/customers/pos-search?search=${query}&limit=10`, {
      headers: {
        Authorization: `Bearer ${authStore.token}`
      }
    });

    const customerData: BackendCustomer[] = response.data.customers || [];
    customers.value = customerData.map((customer: BackendCustomer) => ({
      _id: customer._id,
      name: customer.name,
      phone: customer.phone,
      email: customer.email,
      address: customer.address
    }));

    filteredCustomers.value = [...customers.value];
  } catch (error: unknown) {
    let message = 'Failed to fetch customers.';
    if (axios.isAxiosError(error)) {
      message = error.response?.data?.message || error.message;
    } else if (error instanceof Error) {
      message = error.message;
    }
    Swal.fire({
      icon: 'error',
      title: 'Error',
      text: message
    });
    customers.value = [];
    filteredCustomers.value = [];
  } finally {
    isLoadingCustomers.value = false;
  }
}

// Add this method to filter customers based on search query
const filterCustomers = () => {
  if (!customerSearchQuery.value) {
    filteredCustomers.value = [...customers.value]
    return
  }
  
  const query = customerSearchQuery.value.toLowerCase()
  filteredCustomers.value = customers.value.filter((customer: BackendCustomer) => 
    customer.name.toLowerCase().includes(query) || 
    (customer.phone && customer.phone.includes(query))
  )
}

// Update the selectCustomer method to also populate the delivery address
const selectCustomer = (customer: BackendCustomer) => {
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
                :src="Array.isArray((product as any).images) && (product as any).images.length > 0 ? (product as any).images[0].url : placeholderImage"
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
              @input="updateQuantity(index, $event.target && ($event.target as HTMLInputElement).value ? parseInt(($event.target as HTMLInputElement).value) || 0 : 0)"
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
          
          <!-- Delivery Fee input -->
          <div>
            <label class="mb-2.5 block text-sm font-medium text-black dark:text-white">Delivery Fee</label>
            <div class="relative">
              <input
                type="number"
                v-model="deliveryFee"
                min="0"
                step="10"
                class="w-full rounded-lg border-[1.5px] border-stroke bg-transparent pr-4 py-2.5 outline-none transition focus:border-primary active:border-primary dark:border-form-strokedark dark:bg-form-input"
              />
              <!-- Show formatted value below input -->
              <div class="text-xs text-gray-500 mt-1">{{ formatCurrency(deliveryFee) }}</div>
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
        
        <!-- Payment Amount input -->
        <div>
          <label class="mb-2.5 block text-sm font-medium text-black dark:text-white">Payment Amount</label>
          <div class="relative">
            <input
              type="number"
              v-model="paymentAmount"
              class="w-full rounded-lg border-[1.5px] border-stroke bg-transparent pr-4 py-2.5 outline-none transition focus:border-primary active:border-primary dark:border-form-strokedark dark:bg-form-input"
              :class="{ 'border-danger': insufficientPayment }"
            />
            <!-- Show formatted value below input -->
            <div class="text-xs text-gray-500 mt-1">{{ formatCurrency(paymentAmount) }}</div>
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
          v-if="authStore.hasPermission('process_sales')"
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
  <div v-if="showReceipt" class="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
    <div class="bg-white p-6 rounded shadow max-w-md w-full relative">
      <button @click="closeReceipt" class="absolute top-2 right-2 text-gray-400 hover:text-danger">&times;</button>
      <div id="receipt-section">
        <h2 class="text-lg font-bold text-center mb-2">Books & Clothes House</h2>
        <div class="text-xs text-center mb-2">{{ lastSale?.date }}</div>
        <div class="mb-2">Customer: {{ lastSale?.customerName }}</div>
        <div class="border-t border-b py-2 my-2">
          <div v-for="item in lastSale?.cart" :key="item.productId" class="flex justify-between text-sm">
            <span>{{ item.name }} x{{ item.quantity }}</span>
            <span>₱{{ item.price.toFixed(2) }}</span>
          </div>
        </div>
        <div class="flex justify-between text-sm">
          <span>Subtotal:</span>
          <span>₱{{ lastSale?.subtotal.toFixed(2) }}</span>
        </div>
        <div v-if="lastSale?.deliveryMode === 'delivery'" class="flex justify-between text-sm">
          <span>Delivery Fee:</span>
          <span>₱{{ lastSale?.deliveryFee.toFixed(2) }}</span>
        </div>
        <div class="flex justify-between text-sm font-bold">
          <span>Total:</span>
          <span>₱{{ lastSale?.total.toFixed(2) }}</span>
        </div>
        <div class="flex justify-between text-sm">
          <span>Payment:</span>
          <span>₱{{ lastSale?.paymentAmount.toFixed(2) }}</span>
        </div>
        <div class="flex justify-between text-sm">
          <span>Change:</span>
          <span>₱{{ lastSale?.change.toFixed(2) }}</span>
        </div>
        <div class="text-center mt-4 text-xs">Thank you for your purchase!</div>
      </div>
      <div class="flex justify-center gap-4 mt-4">
        <button @click="printReceipt" class="bg-primary text-white px-4 py-2 rounded">Print Receipt</button>
        <button @click="saveReceiptAsPDF" class="bg-success text-white px-4 py-2 rounded">Save as PDF</button>
      </div>
    </div>
  </div>
</template>