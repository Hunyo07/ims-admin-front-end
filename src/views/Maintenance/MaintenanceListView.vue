<script setup>
import { ref, onMounted, computed } from 'vue'
import { useRouter } from 'vue-router'
import axios from '@/utils/axios'
import DefaultLayout from '@/layouts/DefaultLayout.vue'
import BreadcrumbDefault from '@/components/Breadcrumbs/BreadcrumbDefault.vue'

const router = useRouter()
const tickets = ref([])
const loading = ref(true)
const filterStatus = ref('')
const search = ref('')
const filterDateFrom = ref('')
const filterDateTo = ref('')
const filterProvider = ref('')
const sortBy = ref('createdAt')
const sortOrder = ref('desc')
const currentPage = ref(1)
const pageSize = ref(10)
const totalTickets = ref(0)
const serviceProviders = ref([])

const fetchTickets = async () => {
  try {
    const params = {}
    if (filterStatus.value) params.status = filterStatus.value
    const { data } = await axios.get('/maintenance', { params })
    tickets.value = data.tickets || []
    totalTickets.value = tickets.value.length
    
    // Extract unique service providers for filter
    const providers = new Set()
    tickets.value.forEach(t => {
      if (t.serviceProvider) providers.add(t.serviceProvider)
    })
    serviceProviders.value = Array.from(providers).sort()
  } catch (error) {
    console.error('Error fetching tickets:', error)
  } finally {
    loading.value = false
  }
}

const viewTicket = (id) => router.push({ name: 'maintenance-detail', params: { id } })
const createTicket = () => router.push({ name: 'maintenance-create' })

onMounted(fetchTickets)

const filteredTickets = computed(() => {
  let list = tickets.value || []
  
  // Search filter
  const q = String(search.value || '').trim().toLowerCase()
  if (q) {
    list = list.filter((t) => {
      return [
        t.ticketNumber,
        t.acn,
        t.serialNumber,
        t.issue,
        t.serviceProvider
      ]
        .map((v) => String(v || '').toLowerCase())
        .some((str) => str.includes(q))
    })
  }
  
  // Date range filter
  if (filterDateFrom.value) {
    const fromDate = new Date(filterDateFrom.value)
    list = list.filter(t => {
      const tDate = new Date(t.dateSent || t.createdAt)
      return tDate >= fromDate
    })
  }
  if (filterDateTo.value) {
    const toDate = new Date(filterDateTo.value)
    toDate.setHours(23, 59, 59, 999)
    list = list.filter(t => {
      const tDate = new Date(t.dateSent || t.createdAt)
      return tDate <= toDate
    })
  }
  
  // Service provider filter
  if (filterProvider.value) {
    list = list.filter(t => t.serviceProvider === filterProvider.value)
  }
  
  // Sort
  list.sort((a, b) => {
    let aVal, bVal
    if (sortBy.value === 'createdAt' || sortBy.value === 'dateSent') {
      aVal = new Date(a[sortBy.value] || 0).getTime()
      bVal = new Date(b[sortBy.value] || 0).getTime()
    } else if (sortBy.value === 'actualCost') {
      aVal = Number(a.actualCost || 0)
      bVal = Number(b.actualCost || 0)
    } else {
      aVal = String(a[sortBy.value] || '').toLowerCase()
      bVal = String(b[sortBy.value] || '').toLowerCase()
    }
    
    if (sortOrder.value === 'desc') {
      return aVal > bVal ? -1 : aVal < bVal ? 1 : 0
    } else {
      return aVal < bVal ? -1 : aVal > bVal ? 1 : 0
    }
  })
  
  return list
})

const paginatedTickets = computed(() => {
  const start = (currentPage.value - 1) * pageSize.value
  const end = start + pageSize.value
  return filteredTickets.value.slice(start, end)
})

const totalPages = computed(() => {
  return Math.ceil(filteredTickets.value.length / pageSize.value)
})

function resetFilters() {
  filterStatus.value = ''
  search.value = ''
  filterDateFrom.value = ''
  filterDateTo.value = ''
  filterProvider.value = ''
  sortBy.value = 'createdAt'
  sortOrder.value = 'desc'
  currentPage.value = 1
}

function statusBadgeClass(status) {
  switch (status) {
    case 'pending':
      return 'bg-bodydark/10 text-bodydark'
    case 'in_progress':
      return 'bg-warning/10 text-warning'
    case 'completed':
      return 'bg-success/10 text-success'
    case 'beyond_repair':
      return 'bg-danger/10 text-danger'
    default:
      return 'bg-bodydark/10 text-bodydark'
  }
}

function labelForStatus(status) {
  switch (status) {
    case 'pending':
      return 'Under Repair'
    case 'in_progress':
      return 'In Progress'
    case 'completed':
      return 'Repaired'
    case 'beyond_repair':
      return 'Beyond Repair'
    default:
      return status || '—'
  }
}

function formatDate(d) {
  try {
    return d ? new Date(d).toLocaleDateString() : '—'
  } catch (_) {
    return '—'
  }
}
</script>

<template>
  <DefaultLayout>
    <BreadcrumbDefault pageTitle="Repair & Maintenance" />
    <div class="p-6">
      <div class="flex flex-col gap-3 md:flex-row md:items-center md:justify-between mb-4">
        <div class="flex gap-2 items-center flex-wrap">
          <select v-model="filterStatus" class="rounded border px-3 py-2 bg-white text-sm">
            <option value="">All Status</option>
            <option value="pending">Under Repair</option>
            <option value="in_progress">In Progress</option>
            <option value="completed">Repaired</option>
            <option value="beyond_repair">Beyond Repair</option>
          </select>
          
          <input
            v-model="filterDateFrom"
            type="date"
            placeholder="From"
            class="rounded border px-3 py-2 bg-white text-sm"
          />
          <span class="text-xs text-bodydark2">to</span>
          <input
            v-model="filterDateTo"
            type="date"
            placeholder="To"
            class="rounded border px-3 py-2 bg-white text-sm"
          />
          
          <select v-model="filterProvider" class="rounded border px-3 py-2 bg-white text-sm">
            <option value="">All Providers</option>
            <option v-for="p in serviceProviders" :key="p" :value="p">{{ p }}</option>
          </select>
          
          <select v-model="sortBy" class="rounded border px-3 py-2 bg-white text-sm">
            <option value="createdAt">Date Created</option>
            <option value="dateSent">Date Sent</option>
            <option value="actualCost">Cost</option>
            <option value="status">Status</option>
          </select>
          
          <button 
            @click="sortOrder = sortOrder === 'asc' ? 'desc' : 'asc'"
            class="rounded border px-3 py-2 bg-white text-sm hover:bg-gray-50"
            :title="sortOrder === 'asc' ? 'Ascending' : 'Descending'"
          >
            <svg class="h-4 w-4" fill="currentColor" viewBox="0 0 20 20" :class="sortOrder === 'desc' ? 'rotate-180' : ''">
              <path d="M3 3a1 1 0 000 2h11a1 1 0 100-2H3zM3 7a1 1 0 000 2h7a1 1 0 100-2H3zM3 11a1 1 0 100 2h4a1 1 0 100-2H3zM15 8a1 1 0 10-2 0v5.586l-1.293-1.293a1 1 0 00-1.414 1.414l3 3a1 1 0 001.414 0l3-3a1 1 0 00-1.414-1.414L15 13.586V8z"/>
            </svg>
          </button>
          
          <input
            v-model="search"
            type="text"
            placeholder="Search tickets..."
            class="rounded border px-3 py-2 bg-white w-48 text-sm"
          />
          
          <button 
            @click="resetFilters"
            class="rounded border px-3 py-2 text-sm hover:bg-gray-50 text-bodydark2"
          >
            Clear
          </button>
        </div>
        <button @click="createTicket" class="bg-primary text-white px-4 py-2 rounded">Create Repair</button>
      </div>

      <div v-if="loading" class="text-center py-8">Loading...</div>
      <div v-else class="bg-white rounded shadow">
        <table class="w-full">
          <thead class="bg-gray-100">
            <tr>
              <th class="p-3 text-left w-1/3">Ticket</th>
              <th class="p-3 text-left w-1/3">Asset</th>
              <th class="p-3 text-left w-1/6">Status</th>
              <th class="p-3 text-left w-1/6">Sent</th>
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="ticket in paginatedTickets"
              :key="ticket._id"
              @click="viewTicket(ticket._id)"
              class="border-t hover:bg-gray-50 cursor-pointer"
            >
              <td class="p-3">
                <div class="text-sm font-medium">{{ ticket.ticketNumber }}</div>
                <div class="text-xs text-bodydark2 truncate">{{ ticket.issue }}</div>
              </td>
              <td class="p-3">
                <div class="text-sm">{{ ticket.acn || ticket.serialNumber || '—' }}</div>
                <div class="text-xs text-bodydark2 truncate">{{ ticket.serviceProvider || '—' }}</div>
              </td>
              <td class="p-3">
                <span :class="statusBadgeClass(ticket.status)" class="px-2 py-1 rounded text-xs">
                  {{ labelForStatus(ticket.status) }}
                </span>
              </td>
              <td class="p-3">{{ formatDate(ticket.dateSent) }}</td>
            </tr>
            <tr v-if="paginatedTickets.length === 0">
              <td colspan="4" class="p-6 text-center text-sm text-bodydark2">No tickets found</td>
            </tr>
          </tbody>
        </table>
        
        <!-- Pagination -->
        <div v-if="totalPages > 1" class="flex justify-between items-center p-4 border-t">
          <div class="text-sm text-bodydark2">
            Showing {{ (currentPage - 1) * pageSize + 1 }} to 
            {{ Math.min(currentPage * pageSize, filteredTickets.length) }} of {{ filteredTickets.length }}
          </div>
          <div class="flex gap-2">
            <button 
              @click="currentPage--" 
              :disabled="currentPage === 1"
              class="px-3 py-1 border rounded disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
            >
              Previous
            </button>
            <span class="px-3 py-1 text-sm text-bodydark2">
              Page {{ currentPage }} of {{ totalPages }}
            </span>
            <button 
              @click="currentPage++" 
              :disabled="currentPage >= totalPages"
              class="px-3 py-1 border rounded disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
            >
              Next
            </button>
          </div>
        </div>
      </div>
    </div>
  </DefaultLayout>
</template>
