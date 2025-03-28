<script setup lang="ts">
import { ref, onMounted, computed, watch } from 'vue'
import axios from 'axios'
import { useAuthStore } from '@/stores/auth'
import { socket } from '@/socket'
import Swal from 'sweetalert2'
import { format } from 'date-fns'
const authStore = useAuthStore()
// Interfaces
interface SaleItem {
  product: string
  name: string
  quantity: number
  price: number
  total: number
}

interface Sale {
  _id: string
  items: SaleItem[]
  customerName: string
  customerPhone?: string
  subtotal: number
  total: number
  paymentMethod: string
  paymentAmount: number
  change: number
  deliveryMode: string
  deliveryFee?: number
  deliveryAddress?: string
  createdBy: {
    user: string
    role: string
  }
  createdAt: string
  updatedAt: string
}

interface SalesStats {
  overview: {
    totalSales: number
    totalRevenue: number
    averageOrderValue: number
    totalItems: number
  }
  paymentMethods: {
    _id: string
    count: number
    total: number
  }[]
}

// State
const sales = ref<Sale[]>([])
const stats = ref<SalesStats | null>(null)
const isLoading = ref(true)
const isLoadingStats = ref(true)
const currentPage = ref(1)
const totalPages = ref(1)
const totalItems = ref(0)
const itemsPerPage = ref(10)
const selectedSale = ref<Sale | null>(null)
const showSaleDetailsModal = ref(false)

// Filters
const filters = ref({
  startDate: '',
  endDate: '',
  minAmount: '',
  maxAmount: '',
  paymentMethod: '',
  deliveryMode: ''
})
// Branches for filter dropdown

// Fetch sales data
const fetchSales = async () => {
  try {
    isLoading.value = true
    
    const queryParams = new URLSearchParams({
      page: currentPage.value.toString(),
      limit: itemsPerPage.value.toString()
    })
    
    // Add filters if they exist and have values
    if (filters.value.startDate) {
      const startDate = new Date(filters.value.startDate)
      startDate.setHours(0, 0, 0, 0)
      queryParams.append('startDate', startDate.toISOString())
    }
    
    if (filters.value.endDate) {
      const endDate = new Date(filters.value.endDate)
      endDate.setHours(23, 59, 59, 999)
      queryParams.append('endDate', endDate.toISOString())
    }
    
    if (filters.value.minAmount && !isNaN(parseFloat(filters.value.minAmount))) {
      queryParams.append('minAmount', parseFloat(filters.value.minAmount).toString())
    }
    
    if (filters.value.maxAmount && !isNaN(parseFloat(filters.value.maxAmount))) {
      queryParams.append('maxAmount', parseFloat(filters.value.maxAmount).toString())
    }
    
    if (filters.value.paymentMethod) {
      queryParams.append('paymentMethod', filters.value.paymentMethod)
    }
    
    if (filters.value.deliveryMode) {
      queryParams.append('deliveryMode', filters.value.deliveryMode)
    }
    
    console.log('Fetching sales with params:', queryParams.toString())
    
    const response = await axios.get(`http://localhost:5000/api/sales?${queryParams.toString()}`, {
      headers: {
        Authorization: `Bearer ${authStore.token}`
      }
    })
    
    console.log('Sales response:', response.data)
    sales.value = response.data.sales
    currentPage.value = response.data.pagination.currentPage
    totalPages.value = response.data.pagination.totalPages
    totalItems.value = response.data.pagination.totalItems
  } catch (error) {
    console.error('Error fetching sales:', error)
    // More detailed error logging
    if (error.response) {
      console.error('Error response data:', error.response.data)
    }
    Swal.fire({
      icon: 'error',
      title: 'Error',
      text: error.response?.data?.message || 'Failed to fetch sales data'
    })
  } finally {
    isLoading.value = false
  }
}

// Fetch sales statistics
const fetchSalesStats = async () => {
  try {
    isLoadingStats.value = true
    
    const queryParams = new URLSearchParams()
    
    // Add filters if they exist and have values
    if (filters.value.startDate) {
      const startDate = new Date(filters.value.startDate)
      startDate.setHours(0, 0, 0, 0)
      queryParams.append('startDate', startDate.toISOString())
    }
    
    if (filters.value.endDate) {
      const endDate = new Date(filters.value.endDate)
      endDate.setHours(23, 59, 59, 999)
      queryParams.append('endDate', endDate.toISOString())
    }
    
    if (filters.value.deliveryMode) {
      queryParams.append('deliveryMode', filters.value.deliveryMode)
    }
    
    if (filters.value.paymentMethod) {
      queryParams.append('paymentMethod', filters.value.paymentMethod)
    }
    
    console.log('Fetching stats with params:', queryParams.toString())
    
    const response = await axios.get(`http://localhost:5000/api/sales/stats?${queryParams.toString()}`, {
      headers: {
        Authorization: `Bearer ${authStore.token}`
      }
    })
    
    console.log('Stats response:', response.data)
    stats.value = response.data
  } catch (error) {
    console.error('Error fetching sales statistics:', error)
    if (error.response) {
      console.error('Error response data:', error.response.data)
    }
    Swal.fire({
      icon: 'error',
      title: 'Error',
      text: error.response?.data?.message || 'Failed to fetch sales statistics'
    })
  } finally {
    isLoadingStats.value = false
  }
}

// Fetch branches for filter


// Apply filters
const applyFilters = () => {
  currentPage.value = 1
  fetchSales()
  fetchSalesStats()
}

// Reset filters
const resetFilters = () => {
  filters.value = {
    startDate: '',
    endDate: '',
    minAmount: '',
    maxAmount: '',
    paymentMethod: '',
    deliveryMode: ''
  }
  currentPage.value = 1
  fetchSales()
  fetchSalesStats()
}


// View sale details
const viewSaleDetails = (sale: Sale) => {
  selectedSale.value = sale
  showSaleDetailsModal.value = true
}

// Format date
const formatDate = (dateString: string) => {
  return format(new Date(dateString), 'MMM dd, yyyy h:mm a')
}

// Format currency
const formatCurrency = (amount: number) => {
  return new Intl.NumberFormat('en-PH', {
    style: 'currency',
    currency: 'PHP'
  }).format(amount)
}

// Watch for page changes
watch(currentPage, () => {
  fetchSales()
})

// Initialize component
onMounted(() => {
  fetchSales()
  fetchSalesStats()
  
  // Listen for real-time updates
  socket.on('newSale', (data) => {
    Swal.fire({
      icon: 'info',
      title: 'New Sale',
      text: `A new sale of ${formatCurrency(data.sale.total)} has been completed`,
      toast: true,
      position: 'top-end',
      showConfirmButton: false,
      timer: 3000
    })
    
    // Refresh data if we're on the first page
    if (currentPage.value === 1) {
      fetchSales()
      fetchSalesStats()
    }
  })
  
  // Clean up socket listener on component unmount
  return () => {
    socket.off('newSale')
  }
})
</script>

<template>
  <div class="grid grid-cols-1 gap-4 md:grid-cols-2 md:gap-6 xl:grid-cols-4 2xl:gap-7.5">
    <!-- Stats Cards -->
    <div class="rounded-sm border border-stroke bg-white py-6 px-7.5 shadow-default dark:border-strokedark dark:bg-boxdark">
      <div class="flex h-11.5 w-11.5 items-center justify-center rounded-full bg-meta-2 dark:bg-meta-4">
        <svg class="fill-primary dark:fill-white" width="22" height="16" viewBox="0 0 22 16" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M11 15.1156C4.19376 15.1156 0.825012 8.61876 0.687512 8.34376C0.584387 8.13751 0.584387 7.86251 0.687512 7.65626C0.825012 7.38126 4.19376 0.918762 11 0.918762C17.8063 0.918762 21.175 7.38126 21.3125 7.65626C21.4156 7.86251 21.4156 8.13751 21.3125 8.34376C21.175 8.61876 17.8063 15.1156 11 15.1156ZM2.26876 8.00001C3.02501 9.27189 5.98126 13.5688 11 13.5688C16.0188 13.5688 18.975 9.27189 19.7313 8.00001C18.975 6.72814 16.0188 2.43126 11 2.43126C5.98126 2.43126 3.02501 6.72814 2.26876 8.00001Z" fill=""></path>
          <path d="M11 10.9219C9.38438 10.9219 8.07812 9.61562 8.07812 8C8.07812 6.38438 9.38438 5.07812 11 5.07812C12.6156 5.07812 13.9219 6.38438 13.9219 8C13.9219 9.61562 12.6156 10.9219 11 10.9219ZM11 6.625C10.2437 6.625 9.625 7.24375 9.625 8C9.625 8.75625 10.2437 9.375 11 9.375C11.7563 9.375 12.375 8.75625 12.375 8C12.375 7.24375 11.7563 6.625 11 6.625Z" fill=""></path>
        </svg>
      </div>
      <div class="mt-4 flex items-end justify-between">
        <div>
          <h4 class="text-title-md font-bold text-black dark:text-white">
            {{ isLoadingStats ? '...' : stats?.overview?.totalSales || 0 }}
          </h4>
          <span class="text-sm font-medium">Total Sales</span>
        </div>
      </div>
    </div>

    <div class="rounded-sm border border-stroke bg-white py-6 px-7.5 shadow-default dark:border-strokedark dark:bg-boxdark">
      <div class="flex h-11.5 w-11.5 items-center justify-center rounded-full bg-meta-2 dark:bg-meta-4">
        <svg class="fill-primary dark:fill-white" width="20" height="22" viewBox="0 0 20 22" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M11.7531 16.4312C10.3781 16.4312 9.27808 17.5312 9.27808 18.9062C9.27808 20.2812 10.3781 21.3812 11.7531 21.3812C13.1281 21.3812 14.2281 20.2812 14.2281 18.9062C14.2281 17.5656 13.0937 16.4312 11.7531 16.4312ZM11.7531 19.8687C11.2375 19.8687 10.825 19.4562 10.825 18.9406C10.825 18.425 11.2375 18.0125 11.7531 18.0125C12.2687 18.0125 12.6812 18.425 12.6812 18.9406C12.6812 19.4219 12.2343 19.8687 11.7531 19.8687Z" fill=""></path>
          <path d="M5.22183 16.4312C3.84683 16.4312 2.74683 17.5312 2.74683 18.9062C2.74683 20.2812 3.84683 21.3812 5.22183 21.3812C6.59683 21.3812 7.69683 20.2812 7.69683 18.9062C7.69683 17.5656 6.56245 16.4312 5.22183 16.4312ZM5.22183 19.8687C4.7062 19.8687 4.2937 19.4562 4.2937 18.9406C4.2937 18.425 4.7062 18.0125 5.22183 18.0125C5.73745 18.0125 6.14995 18.425 6.14995 18.9406C6.14995 19.4219 5.73745 19.8687 5.22183 19.8687Z" fill=""></path>
          <path d="M19.0062 0.618744H17.15C16.325 0.618744 15.6031 1.23749 15.5 2.06249L14.95 6.01562H1.37185C1.0281 6.01562 0.684353 6.18749 0.443728 6.46249C0.237478 6.73749 0.134353 7.11562 0.237478 7.45937C0.237478 7.49374 0.237478 7.49374 0.237478 7.52812L2.36873 13.9562C2.50623 14.4375 2.9531 14.7812 3.46873 14.7812H12.9562C14.2281 14.7812 15.3281 13.8187 15.5 12.5469L16.9437 2.26874C16.9437 2.19999 17.0125 2.16562 17.0812 2.16562H18.9375C19.35 2.16562 19.7281 1.82187 19.7281 1.37499C19.7281 0.928119 19.4187 0.618744 19.0062 0.618744ZM14.0219 12.3062C13.9531 12.8219 13.5062 13.2 12.9906 13.2H3.7781L2.0281 7.56249H14.7094L14.0219 12.3062Z" fill=""></path>
        </svg>
      </div>
      <div class="mt-4 flex items-end justify-between">
        <div>
          <h4 class="text-title-md font-bold text-black dark:text-white">
            {{ isLoadingStats ? '...' : formatCurrency(stats?.overview?.totalRevenue || 0) }}
          </h4>
          <span class="text-sm font-medium">Total Revenue</span>
        </div>
      </div>
    </div>

    <div class="rounded-sm border border-stroke bg-white py-6 px-7.5 shadow-default dark:border-strokedark dark:bg-boxdark">
      <div class="flex h-11.5 w-11.5 items-center justify-center rounded-full bg-meta-2 dark:bg-meta-4">
        <svg class="fill-primary dark:fill-white" width="22" height="22" viewBox="0 0 22 22" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M21.1063 18.0469L19.3875 3.23126C19.2157 1.71876 17.9438 0.584381 16.3969 0.584381H5.56878C4.05628 0.584381 2.78441 1.71876 2.57816 3.23126L0.859406 18.0469C0.756281 18.9063 1.03128 19.7313 1.61566 20.3844C2.20003 21.0375 2.99066 21.3813 3.85003 21.3813H18.1157C18.975 21.3813 19.8 21.0031 20.35 20.3844C20.9 19.7656 21.2094 18.9063 21.1063 18.0469ZM19.2157 19.3531C18.9407 19.6625 18.5625 19.8344 18.15 19.8344H3.85003C3.43753 19.8344 3.05941 19.6625 2.78441 19.3531C2.50941 19.0438 2.37191 18.6313 2.44066 18.2188L4.12503 3.43751C4.19378 2.71563 4.81253 2.16563 5.56878 2.16563H16.4313C17.1532 2.16563 17.7719 2.71563 17.875 3.43751L19.5938 18.2531C19.6282 18.6656 19.4907 19.0438 19.2157 19.3531Z" fill=""></path>
          <path d="M14.3345 5.29375C13.922 5.39688 13.647 5.80938 13.7501 6.22188C13.7845 6.42813 13.8189 6.63438 13.8189 6.80625C13.8189 8.35313 12.547 9.625 11.0001 9.625C9.45327 9.625 8.1814 8.35313 8.1814 6.80625C8.1814 6.6 8.21577 6.42813 8.25015 6.22188C8.35327 5.80938 8.07827 5.39688 7.66577 5.29375C7.25327 5.19063 6.84077 5.46563 6.73765 5.87813C6.6689 6.1875 6.63452 6.49688 6.63452 6.80625C6.63452 9.2125 8.5939 11.1719 11.0001 11.1719C13.4064 11.1719 15.3658 9.2125 15.3658 6.80625C15.3658 6.49688 15.3314 6.1875 15.2626 5.87813C15.1595 5.46563 14.747 5.225 14.3345 5.29375Z" fill=""></path>
        </svg>
      </div>
      <div class="mt-4 flex items-end justify-between">
        <div>
          <h4 class="text-title-md font-bold text-black dark:text-white">
            {{ isLoadingStats ? '...' : formatCurrency(stats?.overview?.averageOrderValue || 0) }}
          </h4>
          <span class="text-sm font-medium">Average Order Value</span>
        </div>
      </div>
    </div>

    <div class="rounded-sm border border-stroke bg-white py-6 px-7.5 shadow-default dark:border-strokedark dark:bg-boxdark">
      <div class="flex h-11.5 w-11.5 items-center justify-center rounded-full bg-meta-2 dark:bg-meta-4">
        <svg class="fill-primary dark:fill-white" width="22" height="18" viewBox="0 0 22 18" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M7.18418 8.03751C9.31543 8.03751 11.0686 6.35313 11.0686 4.25626C11.0686 2.15938 9.31543 0.475006 7.18418 0.475006C5.05293 0.475006 3.2998 2.15938 3.2998 4.25626C3.2998 6.35313 5.05293 8.03751 7.18418 8.03751ZM7.18418 2.05626C8.45605 2.05626 9.52168 3.05313 9.52168 4.29063C9.52168 5.52813 8.49043 6.52501 7.18418 6.52501C5.87793 6.52501 4.84668 5.52813 4.84668 4.29063C4.84668 3.05313 5.9123 2.05626 7.18418 2.05626Z" fill=""></path>
          <path d="M15.8124 9.6875C17.6687 9.6875 19.1468 8.24375 19.1468 6.42188C19.1468 4.6 17.6343 3.15625 15.8124 3.15625C13.9905 3.15625 12.478 4.6 12.478 6.42188C12.478 8.24375 13.9905 9.6875 15.8124 9.6875ZM15.8124 4.7375C16.8093 4.7375 17.5999 5.49375 17.5999 6.45625C17.5999 7.41875 16.8093 8.175 15.8124 8.175C14.8155 8.175 14.0249 7.41875 14.0249 6.45625C14.0249 5.49375 14.8155 4.7375 15.8124 4.7375Z" fill=""></path>
          <path d="M15.9843 10.0313H15.6749C14.6437 10.0313 13.6468 10.3406 12.7874 10.8563C11.8593 9.61876 10.3812 8.79376 8.73115 8.79376H5.67178C2.85303 8.82814 0.618652 11.0625 0.618652 13.8469V16.3219C0.618652 16.975 1.13428 17.4906 1.7874 17.4906H20.2468C20.8999 17.4906 21.4499 16.9406 21.4499 16.2875V13.8469C21.4155 11.7188 19.0812 10.0313 15.9843 10.0313ZM2.16553 15.9438V13.8469C2.16553 11.9219 3.74678 10.3406 5.67178 10.3406H8.73115C10.6562 10.3406 12.2374 11.9219 12.2374 13.8469V15.9438H2.16553ZM19.8687 15.9438H13.7499V13.8469C13.7499 13.2969 13.6468 12.7469 13.4749 12.2313C14.0937 11.7844 14.8499 11.5781 15.6405 11.5781H15.9499C18.0437 11.5781 19.8343 12.6094 19.8343 13.8469V15.9438H19.8687Z" fill=""></path>
        </svg>
      </div>
      <div class="mt-4 flex items-end justify-between">
        <div>
          <h4 class="text-title-md font-bold text-black dark:text-white">
            {{ isLoadingStats ? '...' : stats?.overview?.totalItems || 0 }}
          </h4>
          <span class="text-sm font-medium">Total Items Sold</span>
        </div>
      </div>
    </div>
  </div>

  <!-- Filters -->
  <div class="mt-4 rounded-sm border border-stroke bg-white p-4 shadow-default dark:border-strokedark dark:bg-boxdark md:p-6 xl:p-7.5">
    <div class="mb-6 flex flex-wrap items-center justify-between gap-4">
      <h4 class="text-xl font-semibold text-black dark:text-white">Sales Filters</h4>
    </div>

    <div class="grid grid-cols-1 gap-4 md:grid-cols-3">
      <div>
        <label class="mb-2.5 block text-black dark:text-white">Start Date</label>
        <input
          type="date"
          v-model="filters.startDate"
          class="w-full rounded border-[1.5px] border-stroke bg-transparent px-5 py-3 outline-none transition focus:border-primary active:border-primary dark:border-form-strokedark dark:bg-form-input"
        />
      </div>
      <div>
        <label class="mb-2.5 block text-black dark:text-white">End Date</label>
        <input
          type="date"
          v-model="filters.endDate"
          class="w-full rounded border-[1.5px] border-stroke bg-transparent px-5 py-3 outline-none transition focus:border-primary active:border-primary dark:border-form-strokedark dark:bg-form-input"
        />
      </div>
      <div>
  <label class="mb-2.5 block text-black dark:text-white">Delivery Mode</label>
  <select
    v-model="filters.deliveryMode"
    class="w-full rounded border-[1.5px] border-stroke bg-transparent px-5 py-3 outline-none transition focus:border-primary active:border-primary dark:border-form-strokedark dark:bg-form-input"
  >
    <option value="">All Modes</option>
    <option value="walk-in">Walk-in</option>
    <option value="delivery">Delivery</option>
  </select>
</div>
      <div>
        <label class="mb-2.5 block text-black dark:text-white">Min Amount</label>
        <input
          type="number"
          v-model="filters.minAmount"
          placeholder="Min amount"
          class="w-full rounded border-[1.5px] border-stroke bg-transparent px-5 py-3 outline-none transition focus:border-primary active:border-primary dark:border-form-strokedark dark:bg-form-input"
        />
      </div>
      <div>
        <label class="mb-2.5 block text-black dark:text-white">Max Amount</label>
        <input
          type="number"
          v-model="filters.maxAmount"
          placeholder="Max amount"
          class="w-full rounded border-[1.5px] border-stroke bg-transparent px-5 py-3 outline-none transition focus:border-primary active:border-primary dark:border-form-strokedark dark:bg-form-input"
        />
      </div>
      <div>
        <label class="mb-2.5 block text-black dark:text-white">Payment Method</label>
        <select
          v-model="filters.paymentMethod"
          class="w-full rounded border-[1.5px] border-stroke bg-transparent px-5 py-3 outline-none transition focus:border-primary active:border-primary dark:border-form-strokedark dark:bg-form-input"
        >
          <option value="">All Methods</option>
          <option value="cash">Cash</option>
          <option value="gcash">GCash</option>
          <option value="card">Card</option>
        </select>
      </div>
    </div>

    <div class="mt-6 flex justify-end gap-4">
      <button
        @click="resetFilters"
        class="flex items-center justify-center rounded border border-stroke px-6 py-2 hover:shadow-1 dark:border-strokedark"
      >
        Reset
      </button>
      <button
        @click="applyFilters"
        class="flex items-center justify-center rounded bg-primary px-6 py-2 text-white hover:bg-opacity-90"
      >
        Apply Filters
      </button>
    </div>
  </div>

  <!-- Sales Table -->
  <div class="mt-4 rounded-sm border border-stroke bg-white shadow-default dark:border-strokedark dark:bg-boxdark">
    <div class="py-6 px-4 md:px-6 xl:px-7.5">
      <h4 class="text-xl font-semibold text-black dark:text-white">Sales Transactions</h4>
    </div>

    <div class="grid grid-cols-6 border-t border-stroke py-4.5 px-4 dark:border-strokedark md:px-6 2xl:px-7.5">
      <div class="col-span-1 flex items-center">
        <p class="font-medium">Date</p>
      </div>
      <div class="col-span-1 flex items-center">
        <p class="font-medium">Invoice</p>
      </div>
      <div class="col-span-1 flex items-center">
        <p class="font-medium">Customer</p>
      </div>
      <div class="col-span-1 flex items-center">
        <p class="font-medium">Items</p>
      </div>
      <div class="col-span-1 flex items-center">
        <p class="font-medium">Amount</p>
      </div>
      <div class="col-span-1 flex items-center">
        <p class="font-medium">Actions</p>
      </div>
    </div>

    <div v-if="isLoading" class="flex justify-center py-8">
      <div class="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full"></div>
    </div>

    <div v-else-if="sales.length === 0" class="flex justify-center py-8">
      <p class="text-gray-500 dark:text-gray-400">No sales found</p>
    </div>

    <div v-else>
      <div
        v-for="sale in sales"
        :key="sale._id"
        class="grid grid-cols-6 border-t border-stroke py-4.5 px-4 dark:border-strokedark md:px-6 2xl:px-7.5"
      >
      <div class="col-span-1 flex items-center">
          <p class="text-sm text-black dark:text-white">{{ formatDate(sale.createdAt) }}</p>
        </div>
        <div class="col-span-1 flex items-center">
          <p class="text-sm text-black dark:text-white">#{{ sale._id.substring(0, 8) }}</p>
        </div>
        <div class="col-span-1 flex items-center">
          <p class="text-sm text-black dark:text-white">{{ sale.customerName }}</p>
        </div>
        <div class="col-span-1 flex items-center">
          <p class="text-sm text-black dark:text-white">{{ sale.items.length }} items</p>
        </div>
        <div class="col-span-1 flex items-center">
          <p class="text-sm font-medium text-black dark:text-white">{{ formatCurrency(sale.total) }}</p>
        </div>
        <div class="col-span-1 flex items-center">
          <button
            @click="viewSaleDetails(sale)"
            class="hover:text-primary"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              class="h-5 w-5"
              viewBox="0 0 20 20"
              fill="currentColor"
            >
              <path d="M10 12a2 2 0 100-4 2 2 0 000 4z" />
              <path fill-rule="evenodd" d="M.458 10C1.732 5.943 5.522 3 10 3s8.268 2.943 9.542 7c-1.274 4.057-5.064 7-9.542 7S1.732 14.057.458 10zM14 10a4 4 0 11-8 0 4 4 0 018 0z" clip-rule="evenodd" />
            </svg>
          </button>
        </div>
      </div>
    </div>

    <!-- Pagination -->
    <div class="flex items-center justify-between border-t border-stroke px-4 py-4 dark:border-strokedark sm:px-6">
      <div class="flex flex-1 justify-between sm:hidden">
        <button
          @click="currentPage > 1 ? currentPage-- : null"
          :disabled="currentPage === 1"
          class="relative inline-flex items-center rounded-md border border-stroke bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
        >
          Previous
        </button>
        <button
          @click="currentPage < totalPages ? currentPage++ : null"
          :disabled="currentPage === totalPages"
          class="relative ml-3 inline-flex items-center rounded-md border border-stroke bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
        >
          Next
        </button>
      </div>
      <div class="hidden sm:flex sm:flex-1 sm:items-center sm:justify-between">
        <div>
          <p class="text-sm text-gray-700 dark:text-gray-400">
            Showing
            <span class="font-medium">{{ (currentPage - 1) * itemsPerPage + 1 }}</span>
            to
            <span class="font-medium">{{ Math.min(currentPage * itemsPerPage, totalItems) }}</span>
            of
            <span class="font-medium">{{ totalItems }}</span>
            results
          </p>
        </div>
        <div>
          <nav class="isolate inline-flex -space-x-px rounded-md shadow-sm" aria-label="Pagination">
            <button
              @click="currentPage > 1 ? currentPage-- : null"
              :disabled="currentPage === 1"
              class="relative inline-flex items-center rounded-l-md border border-stroke bg-white px-2 py-2 text-sm font-medium text-gray-500 hover:bg-gray-50 focus:z-20 disabled:opacity-50"
            >
              <span class="sr-only">Previous</span>
              <svg class="h-5 w-5" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                <path fill-rule="evenodd" d="M12.79 5.23a.75.75 0 01-.02 1.06L8.832 10l3.938 3.71a.75.75 0 11-1.04 1.08l-4.5-4.25a.75.75 0 010-1.08l4.5-4.25a.75.75 0 011.06.02z" clip-rule="evenodd" />
              </svg>
            </button>
            <button
              v-for="page in Math.min(5, totalPages)"
              :key="page"
              @click="currentPage = page"
              :class="[
                'relative inline-flex items-center border border-stroke bg-white px-4 py-2 text-sm font-medium',
                currentPage === page
                  ? 'z-10 bg-primary text-white focus:z-20'
                  : 'text-gray-500 hover:bg-gray-50 focus:z-20'
              ]"
            >
              {{ page }}
            </button>
            <button
              @click="currentPage < totalPages ? currentPage++ : null"
              :disabled="currentPage === totalPages"
              class="relative inline-flex items-center rounded-r-md border border-stroke bg-white px-2 py-2 text-sm font-medium text-gray-500 hover:bg-gray-50 focus:z-20 disabled:opacity-50"
            >
              <span class="sr-only">Next</span>
              <svg class="h-5 w-5" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                <path fill-rule="evenodd" d="M7.21 14.77a.75.75 0 01.02-1.06L11.168 10 7.23 6.29a.75.75 0 111.04-1.08l4.5 4.25a.75.75 0 010 1.08l-4.5 4.25a.75.75 0 01-1.06-.02z" clip-rule="evenodd" />
              </svg>
            </button>
          </nav>
        </div>
      </div>
    </div>
  </div>

  <!-- Payment Method Breakdown -->
  <div class="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
    <div class="rounded-sm border border-stroke bg-white p-4 shadow-default dark:border-strokedark dark:bg-boxdark md:p-6 xl:p-7.5">
      <div class="mb-6 flex items-center justify-between">
        <h4 class="text-xl font-semibold text-black dark:text-white">Payment Methods</h4>
      </div>
      <div v-if="isLoadingStats" class="flex justify-center py-8">
        <div class="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full"></div>
      </div>
      <div v-else-if="!stats?.paymentMethods?.length" class="flex justify-center py-8">
        <p class="text-gray-500 dark:text-gray-400">No payment data available</p>
      </div>
      <div v-else>
        <div class="space-y-4">
          <div v-for="method in stats.paymentMethods" :key="method._id" class="flex items-center justify-between">
            <div class="flex items-center gap-2">
              <div 
                class="h-4 w-4 rounded-full"
                :class="{
                  'bg-primary': method._id === 'cash',
                  'bg-success': method._id === 'gcash',
                  'bg-warning': method._id === 'card',
                  'bg-danger': !['cash', 'gcash', 'card'].includes(method._id)
                }"
              ></div>
              <p class="font-medium capitalize">{{ method._id }}</p>
            </div>
            <div class="flex items-center gap-2">
              <p class="font-medium">{{ formatCurrency(method.total) }}</p>
              <p class="text-sm text-gray-500">({{ method.count }} sales)</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>

  <!-- Sale Details Modal -->
  <div
    v-if="showSaleDetailsModal"
    class="fixed inset-0 z-999 flex items-center justify-center overflow-y-auto bg-black bg-opacity-50"
  >
    <div class="relative w-full max-w-4xl rounded-lg bg-white p-8 dark:bg-boxdark">
      <div class="mb-6 flex items-center justify-between">
        <h3 class="text-xl font-semibold">Sale Details</h3>
        <button
          @click="showSaleDetailsModal = false"
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

      <div v-if="selectedSale" class="space-y-6">
  <div class="grid grid-cols-2 gap-4">
    <div>
      <p class="text-sm text-gray-500">Invoice #</p>
      <p class="font-medium">{{ selectedSale._id }}</p>
    </div>
    <div>
      <p class="text-sm text-gray-500">Date</p>
      <p class="font-medium">{{ formatDate(selectedSale.createdAt) }}</p>
    </div>
    <div>
      <p class="text-sm text-gray-500">Customer</p>
      <p class="font-medium">{{ selectedSale.customerName }}</p>
    </div>
    <div>
      <p class="text-sm text-gray-500">Phone</p>
      <p class="font-medium">{{ selectedSale.customerPhone || 'N/A' }}</p>
    </div>
    <div>
      <p class="text-sm text-gray-500">Payment Method</p>
      <p class="font-medium capitalize">{{ selectedSale.paymentMethod }}</p>
    </div>
    <div>
      <p class="text-sm text-gray-500">Delivery Mode</p>
      <p class="font-medium capitalize">{{ selectedSale.deliveryMode || 'Walk-in' }}</p>
    </div>
  </div>
          <div>
            <p class="text-sm text-gray-500">Cashier</p>
            <p class="font-medium">{{ selectedSale.createdBy?.role || 'N/A' }}</p>
          </div>
          

        <div class="mt-6">
          <h4 class="mb-4 font-medium">Items</h4>
          <div class="overflow-x-auto">
            <table class="w-full table-auto">
              <thead>
                <tr class="bg-gray-2 text-left dark:bg-meta-4">
                  <th class="py-4 px-4 font-medium text-black dark:text-white">Item</th>
                  <th class="py-4 px-4 font-medium text-black dark:text-white">Quantity</th>
                  <th class="py-4 px-4 font-medium text-black dark:text-white">Price</th>
                  <th class="py-4 px-4 font-medium text-black dark:text-white">Total</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="item in selectedSale.items" :key="item.product" class="border-b border-stroke dark:border-strokedark">
                  <td class="py-4 px-4">{{ item.name }}</td>
                  <td class="py-4 px-4">{{ item.quantity }}</td>
                  <td class="py-4 px-4">{{ formatCurrency(item.price) }}</td>
                  <td class="py-4 px-4">{{ formatCurrency(item.total) }}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        <div class="mt-6 flex justify-end">
          <div class="w-64 space-y-2">
            <div class="flex justify-between">
              <p>Subtotal:</p>
              <p class="font-medium">{{ formatCurrency(selectedSale.subtotal) }}</p>
            </div>
            <div class="flex justify-between">
              <p>Total:</p>
              <p class="font-medium">{{ formatCurrency(selectedSale.total) }}</p>
            </div>
            <div class="flex justify-between">
              <p>Payment Amount:</p>
              <p class="font-medium">{{ formatCurrency(selectedSale.paymentAmount) }}</p>
            </div>
            <div class="flex justify-between">
              <p>Change:</p>
              <p class="font-medium">{{ formatCurrency(selectedSale.change) }}</p>
            </div>
          </div>
        </div>

        <div class="mt-6 flex justify-end">
          <button
            @click="showSaleDetailsModal = false"
            class="rounded bg-primary px-6 py-2 text-white hover:bg-opacity-90"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  </div>
</template>