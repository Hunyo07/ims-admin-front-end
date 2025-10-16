<script setup>
import { onMounted, ref, onUnmounted, computed } from 'vue'
import axios from '../../utils/axios'
import DefaultLayout from '@/layouts/DefaultLayout.vue'
import { socket } from '../../socket'
import BreadcrumbDefault from '@/components/Breadcrumbs/BreadcrumbDefault.vue'

const ris = ref([])
const loading = ref(false)
const error = ref(null)
const pageTitle = ref('Requisition Issue Slips')
const searchQuery = ref('')
const statusFilter = ref('all')

async function fetchRIS() {
  loading.value = true
  error.value = null

  try {
    const response = await axios.get('/ris')
    ris.value = response.data.ris || []
  } catch (e) {
    error.value = e?.response?.data?.message || e.message
  } finally {
    loading.value = false
  }
}

function handleRISCreated(data) {
  // Refresh the list when a new RIS is created
  fetchRIS()
}

function handleRISUpdated(data) {
  // Update the specific RIS in the list or refresh the whole list
  fetchRIS()
}

// function handleClickRIS(){

// }

function getStatusClass(status) {
  switch (status) {
    case 'requested':
      return 'bg-blue-100 text-blue-800'
    case 'issued':
      return 'bg-green-100 text-green-800'
    case 'partially_issued':
      return 'bg-yellow-100 text-yellow-800'
    case 'cancelled':
      return 'bg-red-100 text-red-800'
    default:
      return 'bg-gray-100 text-gray-800'
  }
}

function formatDate(dateString) {
  if (!dateString) return ''
  const date = new Date(dateString)
  return new Intl.DateTimeFormat('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  }).format(date)
}

const filteredRIS = computed(() => {
  let result = [...ris.value]

  // Apply status filter
  if (statusFilter.value !== 'all') {
    result = result.filter((r) => r.status === statusFilter.value)
  }

  // Apply search filter
  if (searchQuery.value) {
    const query = searchQuery.value.toLowerCase()
    result = result.filter(
      (r) =>
        r.risNumber.toLowerCase().includes(query) ||
        r.purpose.toLowerCase().includes(query) ||
        r.requestor.toLowerCase().includes(query)
    )
  }

  return result
})

onMounted(() => {
  fetchRIS()

  // Listen for socket events
  socket.on('risCreated', handleRISCreated)
  socket.on('risUpdated', handleRISUpdated)
  socket.on('risIssued', handleRISUpdated)

  // Emit authentication event if user is logged in
  if (localStorage.getItem('user')) {
    const user = JSON.parse(localStorage.getItem('user'))
    if (user && user._id) {
      socket.emit('authenticate', user._id)
    }
  }
})

onUnmounted(() => {
  // Clean up socket listeners
  socket.off('risCreated', handleRISCreated)
  socket.off('risUpdated', handleRISUpdated)
  socket.off('risIssued', handleRISUpdated)
})
</script>

<template>
  <DefaultLayout>
    <div class="p-6">
      <BreadcrumbDefault :pageTitle="pageTitle" />

      <div class="flex justify-between items-center mb-4 mt-4">
        <h1 class="text-xl font-semibold">Requisition Issue Slips</h1>
        <router-link
          to="/inventory/ris/create"
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
          Create RIS
        </router-link>
      </div>

      <!-- Filters -->
      <div class="bg-white dark:bg-boxdark rounded-sm border border-stroke shadow-default p-4 mb-4">
        <div class="flex flex-col md:flex-row gap-4">
          <div class="w-full md:w-1/3">
            <label class="mb-2.5 block text-black dark:text-white">Search</label>
            <input
              v-model="searchQuery"
              type="text"
              placeholder="Search by RIS#, purpose, requestor..."
              class="w-full rounded border-[1.5px] border-stroke bg-transparent py-2 px-5 text-black outline-none transition focus:border-primary active:border-primary dark:border-form-strokedark dark:bg-form-input dark:text-white"
            />
          </div>
          <div class="w-full md:w-1/3">
            <label class="mb-2.5 block text-black dark:text-white">Status</label>
            <select
              v-model="statusFilter"
              class="w-full rounded border-[1.5px] border-stroke bg-transparent py-2 px-5 text-black outline-none transition focus:border-primary active:border-primary dark:border-form-strokedark dark:bg-form-input dark:text-white"
            >
              <option value="all">All Statuses</option>
              <option value="requested">Requested</option>
              <option value="issued">Issued</option>
              <option value="partially_issued">Partially Issued</option>
              <option value="cancelled">Cancelled</option>
            </select>
          </div>
          <div class="w-full md:w-1/3 flex items-end">
            <button
              @click="fetchRIS"
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
                  d="M4 2a1 1 0 011 1v2.101a7.002 7.002 0 0111.601 2.566 1 1 0 11-1.885.666A5.002 5.002 0 005.999 7H9a1 1 0 010 2H4a1 1 0 01-1-1V3a1 1 0 011-1zm.008 9.057a1 1 0 011.276.61A5.002 5.002 0 0014.001 13H11a1 1 0 110-2h5a1 1 0 011 1v5a1 1 0 11-2 0v-2.101a7.002 7.002 0 01-11.601-2.566 1 1 0 01.61-1.276z"
                  clip-rule="evenodd"
                />
              </svg>
              Refresh
            </button>
          </div>
        </div>
      </div>

      <!-- Loading state -->
      <div v-if="loading" class="flex justify-center items-center p-8">
        <div class="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>

      <!-- Error state -->
      <div
        v-else-if="error"
        class="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4"
      >
        {{ error }}
      </div>

      <!-- Empty state -->
      <div
        v-else-if="filteredRIS.length === 0"
        class="bg-white dark:bg-boxdark rounded-sm border border-stroke shadow-default p-8 text-center"
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          class="h-16 w-16 mx-auto text-gray-400"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            stroke-linecap="round"
            stroke-linejoin="round"
            stroke-width="2"
            d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
          />
        </svg>
        <p class="mt-4 text-lg font-medium">No requisition issue slips found</p>
        <p class="text-gray-500 mt-2">Create a new RIS or adjust your search filters</p>
      </div>

      <!-- Data table -->
      <div
        v-else
        class="bg-white dark:bg-boxdark rounded-sm border border-stroke shadow-default overflow-hidden"
      >
        <table class="min-w-full">
          <thead class="bg-gray-50 dark:bg-meta-4">
            <tr class="text-left">
              <th class="p-4 font-medium">RIS #</th>
              <th class="p-4 font-medium">Type</th>
              <th class="p-4 font-medium">Purpose</th>
              <th class="p-4 font-medium">Requestor</th>
              <th class="p-4 font-medium">Status</th>
              <th class="p-4 font-medium">Created</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-gray-200 dark:divide-strokedark">
            <tr
              v-for="r in filteredRIS"
              :key="r._id"
              class="hover:bg-gray-50 dark:hover:bg-meta-4 transition-colors"
            >
              <td class="p-4">
                <router-link
                  class="text-primary font-medium hover:underline"
                  :to="{ name: 'ris-detail', params: { id: r._id } }"
                  >{{ r.risNumber }}</router-link
                >
              </td>
              <td class="p-4">
                <span
                  :class="[
                    'px-2 py-1 rounded-full text-xs font-medium',
                    r.risType === 'Deployment' ? 'bg-purple-100 text-purple-800' : 'bg-blue-100 text-blue-800'
                  ]"
                >
                  {{ r.risType || 'Individual' }}
                </span>
              </td>
              <td class="p-4">{{ r.purpose }}</td>
              <td class="p-4">{{ r.requestor }}</td>
              <td class="p-4">
                <span
                  :class="['px-2 py-1 rounded-full text-xs font-medium', getStatusClass(r.status)]"
                >
                  {{ r.status.replace('_', ' ').toUpperCase() }}
                </span>
              </td>
              <td class="p-4">{{ formatDate(r.createdAt) }}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  </DefaultLayout>
</template>
