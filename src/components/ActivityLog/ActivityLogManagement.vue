<template>
  <div class="mx-auto max-w-screen-2xl p-4 md:p-6 2xl:p-10">
    <div class="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <h2 class="text-title-md2 font-bold text-black dark:text-white">
        Activity Logs
      </h2>
      <div class="flex items-center gap-3">
        <button
          @click="refreshLogs"
          :disabled="isLoading"
          class="flex items-center gap-2 rounded bg-primary px-4 py-2 text-white hover:bg-opacity-80 disabled:opacity-50"
        >
          <svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
          Refresh
        </button>
      </div>
    </div>

    <!-- Search and Filters -->
    <div class="mb-6 rounded-sm border border-stroke bg-white p-4 shadow-default dark:border-strokedark dark:bg-boxdark">
      <!-- Search Bar -->
      <div class="mb-4">
        <label class="mb-2.5 block text-black dark:text-white">Search</label>
        <div class="relative">
          <input
            v-model="filters.search"
            @input="applyFilters"
            type="text"
            placeholder="Search by description, user name, or action..."
            class="w-full rounded border-[1.5px] border-stroke bg-transparent px-5 py-3 pl-10 font-medium outline-none transition focus:border-primary active:border-primary disabled:cursor-default disabled:bg-whiter dark:border-form-strokedark dark:bg-form-input dark:focus:border-primary"
          />
          <svg
            class="absolute left-3 top-1/2 -translate-y-1/2 fill-current"
            width="20"
            height="20"
            viewBox="0 0 20 20"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path
              fill-rule="evenodd"
              clip-rule="evenodd"
              d="M8 4a4 4 0 100 8 4 4 0 000-8zM2 8a6 6 0 1110.89 3.476l4.817 4.817a1 1 0 01-1.414 1.414l-4.816-4.816A6 6 0 012 8z"
              fill=""
            />
          </svg>
        </div>
      </div>

      <div class="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
        <!-- Action Filter -->
        <div>
          <label class="mb-2.5 block text-black dark:text-white">Action Type</label>
          <select
            v-model="filters.action"
            @change="applyFilters"
            class="w-full rounded border-[1.5px] border-stroke bg-transparent px-5 py-3 font-medium outline-none transition focus:border-primary active:border-primary disabled:cursor-default disabled:bg-whiter dark:border-form-strokedark dark:bg-form-input dark:focus:border-primary"
          >
            <option value="">All Actions</option>
            <option v-for="action in actionTypes" :key="action" :value="action">
              {{ formatAction(action) }}
            </option>
          </select>
        </div>

        <!-- User Filter -->
        <div>
          <label class="mb-2.5 block text-black dark:text-white">User</label>
          <select
            v-model="filters.user"
            @change="applyFilters"
            class="w-full rounded border-[1.5px] border-stroke bg-transparent px-5 py-3 font-medium outline-none transition focus:border-primary active:border-primary disabled:cursor-default disabled:bg-whiter dark:border-form-strokedark dark:bg-form-input dark:focus:border-primary"
          >
            <option value="">All Users</option>
            <option v-for="user in users" :key="user._id" :value="user._id">
              {{ user.firstName }} {{ user.lastName }}
            </option>
          </select>
        </div>

        <!-- Date Range -->
        <div>
          <label class="mb-2.5 block text-black dark:text-white">Start Date</label>
          <input
            v-model="filters.startDate"
            type="date"
            @change="applyFilters"
            class="w-full rounded border-[1.5px] border-stroke bg-transparent px-5 py-3 font-medium outline-none transition focus:border-primary active:border-primary disabled:cursor-default disabled:bg-whiter dark:border-form-strokedark dark:bg-form-input dark:focus:border-primary"
          />
        </div>

        <div>
          <label class="mb-2.5 block text-black dark:text-white">End Date</label>
          <input
            v-model="filters.endDate"
            type="date"
            @change="applyFilters"
            class="w-full rounded border-[1.5px] border-stroke bg-transparent px-5 py-3 font-medium outline-none transition focus:border-primary active:border-primary disabled:cursor-default disabled:bg-whiter dark:border-form-strokedark dark:bg-form-input dark:focus:border-primary"
          />
        </div>
      </div>

      <!-- Clear Filters -->
      <div class="mt-4 flex justify-end">
        <button
          @click="clearFilters"
          class="rounded bg-gray-500 px-4 py-2 text-white hover:bg-gray-600"
        >
          Clear Filters
        </button>
      </div>
    </div>

    <!-- Activity Logs Table -->
    <div class="rounded-sm border border-stroke bg-white px-5 pt-6 pb-2.5 shadow-default dark:border-strokedark dark:bg-boxdark sm:px-7.5 xl:pb-1">
      <div class="max-w-full overflow-x-auto">
        <table class="w-full table-auto">
          <thead>
            <tr class="bg-gray-2 text-left dark:bg-meta-4">
              <th class="min-w-[220px] py-4 px-4 font-medium text-black dark:text-white xl:pl-11">
                User
              </th>
              <th class="min-w-[150px] py-4 px-4 font-medium text-black dark:text-white">
                Action
              </th>
              <th class="min-w-[200px] py-4 px-4 font-medium text-black dark:text-white">
                Description
              </th>
              <th class="min-w-[120px] py-4 px-4 font-medium text-black dark:text-white">
                Branch
              </th>
              <th class="min-w-[150px] py-4 px-4 font-medium text-black dark:text-white">
                Date & Time
              </th>
              <th class="py-4 px-4 font-medium text-black dark:text-white">
                Actions
              </th>
            </tr>
          </thead>
          <tbody>
            <tr v-if="isLoading">
              <td colspan="6" class="py-4 px-4 text-center">
                <div class="flex items-center justify-center">
                  <div class="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent"></div>
                  <span class="ml-2">Loading...</span>
                </div>
              </td>
            </tr>
            <tr v-else-if="activityLogs.length === 0">
              <td colspan="6" class="py-4 px-4 text-center text-gray-500">
                No activity logs found
              </td>
            </tr>
            <tr
              v-else
              v-for="log in activityLogs"
              :key="log._id"
              class="border-b border-[#eee] dark:border-strokedark"
            >
              <td class="py-5 px-4 pl-9 xl:pl-11">
                <div class="flex items-center">
                  <div class="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                    <span class="text-sm font-medium text-primary">
                      {{ log.user?.name?.charAt(0)?.toUpperCase() || 'U' }}
                    </span>
                  </div>
                  <div class="ml-3">
                    <p class="text-black dark:text-white font-medium">
                      {{ log.user ? (log.user.firstName + ' ' + log.user.lastName) : 'Unknown User' }}
                    </p>
                    <p class="text-sm text-gray-500">
                      {{ log.user?.email || 'No email' }}
                    </p>
                  </div>
                </div>
              </td>
              <td class="py-5 px-4">
                <span
                  :class="getActionBadgeClass(log.action)"
                  class="inline-flex rounded-full bg-opacity-10 py-1 px-3 text-sm font-medium"
                >
                  {{ formatAction(log.action) }}
                </span>
              </td>
              <td class="py-5 px-4">
                <p class="text-black dark:text-white max-w-xs truncate" :title="log.description">
                  {{ log.description }}
                </p>
              </td>
              <td class="py-5 px-4">
                <span class="text-black dark:text-white">
                  {{ log.branch?.name || 'N/A' }}
                </span>
              </td>
              <td class="py-5 px-4">
                <p class="text-black dark:text-white">
                  {{ formatDate(log.createdAt) }}
                </p>
                <p class="text-sm text-gray-500">
                  {{ formatTime(log.createdAt) }}
                </p>
              </td>
              <td class="py-5 px-4">
                <div class="flex items-center space-x-3.5">
                  <button
                    @click="viewLogDetails(log)"
                    class="hover:text-primary"
                    title="View Details"
                  >
                    <svg class="fill-current" width="18" height="18" viewBox="0 0 18 18" fill="none" xmlns="http://www.w3.org/2000/svg">
                      <path d="M8.99981 14.8219C3.43106 14.8219 0.674805 9.50624 0.562305 9.28124C0.47793 9.11249 0.47793 8.88749 0.562305 8.71874C0.674805 8.49374 3.43106 3.17812 8.99981 3.17812C14.5686 3.17812 17.3248 8.49374 17.4373 8.71874C17.5217 8.88749 17.5217 9.11249 17.4373 9.28124C17.3248 9.50624 14.5686 14.8219 8.99981 14.8219ZM1.85624 9.00001C2.4748 10.0406 4.89356 13.5562 8.99981 13.5562C13.1061 13.5562 15.5248 10.0406 16.1434 9.00001C15.5248 7.95936 13.1061 4.44374 8.99981 4.44374C4.89356 4.44374 2.4748 7.95936 1.85624 9.00001Z" fill=""/>
                      <path d="M9 11.3906C7.67812 11.3906 6.60938 10.3219 6.60938 9C6.60938 7.67813 7.67812 6.60938 9 6.60938C10.3219 6.60938 11.3906 7.67813 11.3906 9C11.3906 10.3219 10.3219 11.3906 9 11.3906ZM9 7.875C8.38125 7.875 7.875 8.38125 7.875 9C7.875 9.61875 8.38125 10.125 9 10.125C9.61875 10.125 10.125 9.61875 10.125 9C10.125 8.38125 9.61875 7.875 9 7.875Z" fill=""/>
                    </svg>
                  </button>
                  <button
                    @click="deleteLog(log._id)"
                    class="hover:text-danger"
                    title="Delete Log"
                  >
                    <svg class="fill-current" width="18" height="18" viewBox="0 0 18 18" fill="none" xmlns="http://www.w3.org/2000/svg">
                      <path d="M13.7535 2.47502H11.5879V1.9969C11.5879 1.15315 10.9129 0.478149 10.0691 0.478149H7.90352C7.05977 0.478149 6.38477 1.15315 6.38477 1.9969V2.47502H4.21914C3.40352 2.47502 2.72852 3.15002 2.72852 3.96565V4.8094C2.72852 5.42815 3.09414 5.9344 3.62852 6.1594L4.07852 15.4688C4.13477 16.6219 5.09102 17.5219 6.24414 17.5219H11.7004C12.8535 17.5219 13.8098 16.6219 13.866 15.4688L14.3441 6.13127C14.8785 5.90627 15.2441 5.3719 15.2441 4.78127V3.93752C15.2441 3.15002 14.5691 2.47502 13.7535 2.47502ZM7.67852 1.9969C7.67852 1.85627 7.79102 1.74377 7.93164 1.74377H10.0973C10.2379 1.74377 10.3504 1.85627 10.3504 1.9969V2.47502H7.70664V1.9969H7.67852ZM4.02227 3.96565C4.02227 3.85315 4.10664 3.74065 4.24727 3.74065H13.7535C13.866 3.74065 13.9785 3.82502 13.9785 3.96565V4.8094C13.9785 4.9219 13.8941 5.0344 13.7535 5.0344H4.24727C4.13477 5.0344 4.02227 4.95002 4.02227 4.8094V3.96565ZM11.7285 16.2563H6.27227C5.79414 16.2563 5.40039 15.8906 5.37227 15.3844L4.95039 6.2719H13.0785L12.6566 15.3844C12.6004 15.8625 12.2066 16.2563 11.7285 16.2563Z" fill=""/>
                      <path d="M9.00039 9.11255C8.66289 9.11255 8.35352 9.3938 8.35352 9.75942V13.3313C8.35352 13.6688 8.63477 13.9782 9.00039 13.9782C9.33789 13.9782 9.64727 13.6969 9.64727 13.3313V9.75942C9.64727 9.3938 9.33789 9.11255 9.00039 9.11255Z" fill=""/>
                      <path d="M11.2502 9.67504C10.8846 9.64692 10.6033 9.90004 10.6033 10.2657V13.3313C10.6033 13.6688 10.8846 13.9782 11.2502 13.9782C11.5877 13.9782 11.8971 13.6969 11.8971 13.3313V10.2657C11.8971 9.90004 11.5877 9.64692 11.2502 9.67504Z" fill=""/>
                      <path d="M6.72245 9.67504C6.38495 9.64692 6.1037 9.90004 6.1037 10.2657V13.3313C6.1037 13.6688 6.38495 13.9782 6.72245 13.9782C7.08808 13.9782 7.39745 13.6969 7.39745 13.3313V10.2657C7.39745 9.90004 7.08808 9.64692 6.72245 9.67504Z" fill=""/>
                    </svg>
                  </button>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <!-- Pagination -->
      <div class="flex items-center justify-between border-t border-stroke py-5 px-4 dark:border-strokedark">
        <div class="flex items-center space-x-2">
          <span class="text-sm text-gray-700 dark:text-gray-300">
            Showing {{ (currentPage - 1) * limit + 1 }} to {{ Math.min(currentPage * limit, total) }} of {{ total }} entries
          </span>
        </div>
        <div class="flex items-center space-x-2">
          <button
            @click="changePage(currentPage - 1)"
            :disabled="currentPage === 1"
            class="flex items-center justify-center rounded border border-stroke px-3 py-2 text-sm font-medium text-black transition hover:bg-gray-100 disabled:opacity-50 dark:border-strokedark dark:text-white dark:hover:bg-gray-800"
          >
            Previous
          </button>
          <span class="px-3 py-2 text-sm font-medium text-black dark:text-white">
            Page {{ currentPage }} of {{ totalPages }}
          </span>
          <button
            @click="changePage(currentPage + 1)"
            :disabled="currentPage === totalPages"
            class="flex items-center justify-center rounded border border-stroke px-3 py-2 text-sm font-medium text-black transition hover:bg-gray-100 disabled:opacity-50 dark:border-strokedark dark:text-white dark:hover:bg-gray-800"
          >
            Next
          </button>
        </div>
      </div>
    </div>

    <!-- Log Details Modal -->
    <div v-if="showModal" class="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
      <div class="w-full max-w-2xl rounded-lg bg-white p-6 dark:bg-boxdark">
        <div class="mb-4 flex items-center justify-between">
          <h3 class="text-lg font-semibold text-black dark:text-white">Log Details</h3>
          <button @click="showModal = false" class="text-gray-500 hover:text-gray-700">
            <svg class="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        <div v-if="selectedLog" class="space-y-4">
          <div class="grid grid-cols-2 gap-4">
            <div>
              <label class="block text-sm font-medium text-gray-700 dark:text-gray-300">User</label>
              <p class="mt-1 text-sm text-black dark:text-white">{{ selectedLog.user ? (selectedLog.user.firstName + ' ' + selectedLog.user.lastName) : 'Unknown User' }}</p>
            </div>
            <div>
              <label class="block text-sm font-medium text-gray-700 dark:text-gray-300">Email</label>
              <p class="mt-1 text-sm text-black dark:text-white">{{ selectedLog.user?.email }}</p>
            </div>
            <div>
              <label class="block text-sm font-medium text-gray-700 dark:text-gray-300">Action</label>
              <p class="mt-1 text-sm text-black dark:text-white">{{ formatAction(selectedLog.action) }}</p>
            </div>
            <div>
              <label class="block text-sm font-medium text-gray-700 dark:text-gray-300">Branch</label>
              <p class="mt-1 text-sm text-black dark:text-white">{{ selectedLog.branch?.name || 'N/A' }}</p>
            </div>
            <div class="col-span-2">
              <label class="block text-sm font-medium text-gray-700 dark:text-gray-300">Description</label>
              <p class="mt-1 text-sm text-black dark:text-white">{{ selectedLog.description }}</p>
            </div>
            <div>
              <label class="block text-sm font-medium text-gray-700 dark:text-gray-300">Date</label>
              <p class="mt-1 text-sm text-black dark:text-white">{{ formatDate(selectedLog.createdAt) }}</p>
            </div>
            <div>
              <label class="block text-sm font-medium text-gray-700 dark:text-gray-300">Time</label>
              <p class="mt-1 text-sm text-black dark:text-white">{{ formatTime(selectedLog.createdAt) }}</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, computed } from 'vue'
import { useAuthStore } from '@/stores/auth'
import axios from '@/utils/axios'
import Swal from 'sweetalert2'

const authStore = useAuthStore()

// Reactive data
const activityLogs = ref([])
const isLoading = ref(false)
const currentPage = ref(1)
const limit = ref(10)
const total = ref(0)
const totalPages = ref(0)
const showModal = ref(false)
const selectedLog = ref(null)
const users = ref([])

// Filters
const filters = ref({
  search: '',
  action: '',
  user: '',
  startDate: '',
  endDate: ''
})

// Action types for filter dropdown
const actionTypes = [
  'USER_LOGIN',
  'USER_LOGOUT',
  'FAILED_LOGIN_ATTEMPT',
  'PASSWORD_CHANGE',
  'PASSWORD_RESET_REQUEST',
  'CREATE_ADMIN',
  'CREATE_STAFF',
  'CREATE_USER',
  'CREATE_SUPERADMIN',
  'UPDATE_CUSTOMER',
  'REGISTER_CUSTOMER',
  'UPDATE_USER',
  'DELETE_USER',
  'TOGGLE_USER_STATUS',
  'UPDATE_ROLE',
  'UPDATE_PROFILE',
  'CHANGE_PASSWORD',
  'CREATE_BRANCH',
  'TOGGLE_CATEGORY_STATUS',
  'UPDATE_BRANCH',
  'DELETE_BRANCH',
  'TOGGLE_BRANCH_STATUS',
  'CREATE_PRODUCT',
  'UPDATE_PRODUCT',
  'DELETE_PRODUCT',
  'TOGGLE_PRODUCT_STATUS',
  'CREATE_CATEGORY',
  'UPDATE_CATEGORY',
  'DELETE_CATEGORY',
  'CREATE_INVENTORY',
  'UPDATE_INVENTORY',
  'CREATE_INVENTORY_COUNT',
  'UPDATE_STOCK',
  'DELETE_INVENTORY',
  'CREATE_SUPPLIER',
  'UPDATE_SUPPLIER',
  'DELETE_SUPPLIER',
  'TOGGLE_SUPPLIER_STATUS',
  'CREATE_SUBCATEGORY',
  'UPDATE_SUBCATEGORY',
  'DELETE_SUBCATEGORY',
  'TOGGLE_SUBCATEGORY_STATUS',
  'CREATE_REORDER_POINT',
  'UPDATE_REORDER_POINT',
  'TOGGLE_REORDER_POINT_STATUS',
  'REORDER_NEEDED',
  'GENERATE_BARCODE',
  'CREATE_INVOICE',
  'PRINT_BARCODE',
  'CREATE_SALE',
  'CREATE_PURCHASE_ORDER',
  'UPDATE_PURCHASE_ORDER_STATUS',
  'UPDATE_PURCHASE_ORDER',
  'CREATE_PURCHASE_ORDERS_FROM_REORDER',
  'AUTO_REORDER_INITIATED',
  'UPDATE_AUTO_REORDER_SCHEDULE'
]

// Methods
const fetchActivityLogs = async () => {
  try {
    isLoading.value = true
    const params = {
      page: currentPage.value,
      limit: limit.value,
      ...filters.value
    }

    const response = await axios.get('/activity-logs', { params })
    activityLogs.value = response.data.data
    total.value = response.data.pagination.total
    totalPages.value = response.data.pagination.pages
  } catch (error) {
    console.error('Error fetching activity logs:', error)
    Swal.fire({
      icon: 'error',
      title: 'Error',
      text: error.response?.data?.message || 'Failed to fetch activity logs'
    })
  } finally {
    isLoading.value = false
  }
}

const fetchUsers = async () => {
  try {
    const response = await axios.get('/superadmin/users')
    users.value = response.data
  } catch (error) {
    console.error('Error fetching users:', error)
  }
}

const changePage = (page) => {
  if (page >= 1 && page <= totalPages.value) {
    currentPage.value = page
    fetchActivityLogs()
  }
}

const applyFilters = () => {
  currentPage.value = 1
  fetchActivityLogs()
}

const clearFilters = () => {
  filters.value = {
    search: '',
    action: '',
    user: '',
    startDate: '',
    endDate: ''
  }
  currentPage.value = 1
  fetchActivityLogs()
}

const refreshLogs = () => {
  fetchActivityLogs()
}

const viewLogDetails = (log) => {
  selectedLog.value = log
  showModal.value = true
}

const deleteLog = async (logId) => {
  try {
    const result = await Swal.fire({
      title: 'Are you sure?',
      text: "You won't be able to revert this!",
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#d33',
      cancelButtonColor: '#3085d6',
      confirmButtonText: 'Yes, delete it!'
    })

    if (result.isConfirmed) {
      await axios.delete(`/activity-logs/${logId}`)
      
      Swal.fire(
        'Deleted!',
        'Activity log has been deleted.',
        'success'
      )
      
      fetchActivityLogs()
    }
  } catch (error) {
    console.error('Error deleting log:', error)
    Swal.fire({
      icon: 'error',
      title: 'Error',
      text: error.response?.data?.message || 'Failed to delete activity log'
    })
  }
}

const formatAction = (action) => {
  return action.replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, l => l.toUpperCase())
}

const formatDate = (dateString) => {
  if (!dateString) return 'N/A'
  return new Date(dateString).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric'
  })
}

const formatTime = (dateString) => {
  if (!dateString) return 'N/A'
  return new Date(dateString).toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  })
}

const getActionBadgeClass = (action) => {
  const actionClasses = {
    'USER_LOGIN': 'bg-success text-success',
    'USER_LOGOUT': 'bg-warning text-warning',
    'FAILED_LOGIN_ATTEMPT': 'bg-danger text-danger',
    'CREATE_ADMIN': 'bg-primary text-primary',
    'CREATE_STAFF': 'bg-primary text-primary',
    'CREATE_USER': 'bg-primary text-primary',
    'CREATE_SUPERADMIN': 'bg-primary text-primary',
    'UPDATE_CUSTOMER': 'bg-info text-info',
    'REGISTER_CUSTOMER': 'bg-info text-info',
    'UPDATE_USER': 'bg-info text-info',
    'DELETE_USER': 'bg-danger text-danger',
    'TOGGLE_USER_STATUS': 'bg-warning text-warning',
    'UPDATE_ROLE': 'bg-warning text-warning',
    'UPDATE_PROFILE': 'bg-info text-info',
    'CHANGE_PASSWORD': 'bg-warning text-warning',
    'CREATE_BRANCH': 'bg-success text-success',
    'UPDATE_BRANCH': 'bg-info text-info',
    'DELETE_BRANCH': 'bg-danger text-danger',
    'TOGGLE_BRANCH_STATUS': 'bg-warning text-warning',
    'CREATE_PRODUCT': 'bg-success text-success',
    'UPDATE_PRODUCT': 'bg-info text-info',
    'DELETE_PRODUCT': 'bg-danger text-danger',
    'TOGGLE_PRODUCT_STATUS': 'bg-warning text-warning',
    'CREATE_CATEGORY': 'bg-success text-success',
    'UPDATE_CATEGORY': 'bg-info text-info',
    'DELETE_CATEGORY': 'bg-danger text-danger',
    'TOGGLE_CATEGORY_STATUS': 'bg-warning text-warning',
    'CREATE_INVENTORY': 'bg-success text-success',
    'UPDATE_INVENTORY': 'bg-info text-info',
    'CREATE_INVENTORY_COUNT': 'bg-success text-success',
    'UPDATE_STOCK': 'bg-info text-info',
    'DELETE_INVENTORY': 'bg-danger text-danger',
    'CREATE_SUPPLIER': 'bg-success text-success',
    'UPDATE_SUPPLIER': 'bg-info text-info',
    'DELETE_SUPPLIER': 'bg-danger text-danger',
    'TOGGLE_SUPPLIER_STATUS': 'bg-warning text-warning',
    'CREATE_SUBCATEGORY': 'bg-success text-success',
    'UPDATE_SUBCATEGORY': 'bg-info text-info',
    'DELETE_SUBCATEGORY': 'bg-danger text-danger',
    'TOGGLE_SUBCATEGORY_STATUS': 'bg-warning text-warning',
    'CREATE_REORDER_POINT': 'bg-success text-success',
    'UPDATE_REORDER_POINT': 'bg-info text-info',
    'TOGGLE_REORDER_POINT_STATUS': 'bg-warning text-warning',
    'REORDER_NEEDED': 'bg-warning text-warning',
    'GENERATE_BARCODE': 'bg-info text-info',
    'CREATE_INVOICE': 'bg-success text-success',
    'PRINT_BARCODE': 'bg-info text-info',
    'CREATE_SALE': 'bg-success text-success',
    'CREATE_PURCHASE_ORDER': 'bg-success text-success',
    'UPDATE_PURCHASE_ORDER_STATUS': 'bg-info text-info',
    'UPDATE_PURCHASE_ORDER': 'bg-info text-info',
    'CREATE_PURCHASE_ORDERS_FROM_REORDER': 'bg-success text-success',
    'AUTO_REORDER_INITIATED': 'bg-warning text-warning',
    'UPDATE_AUTO_REORDER_SCHEDULE': 'bg-info text-info'
  }
  
  return actionClasses[action] || 'bg-gray-500 text-white'
}

// Lifecycle
onMounted(() => {
  fetchActivityLogs()
  fetchUsers()
})
</script> 