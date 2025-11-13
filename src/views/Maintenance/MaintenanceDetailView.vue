<script setup>
import { ref, onMounted, computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import axios from '@/utils/axios'
import DefaultLayout from '@/layouts/DefaultLayout.vue'
import BreadcrumbDefault from '@/components/Breadcrumbs/BreadcrumbDefault.vue'

const route = useRoute()
const router = useRouter()

const ticket = ref(null)
const loading = ref(false)
const error = ref('')
const updatingTicket = ref(false)
const newTicketStatus = ref('')
const returnDate = ref('')
const repairRemarks = ref('')
const estimatedCost = ref(0)
const actualCost = ref(0)
const repairHistory = ref([])
const loadingHistory = ref(false)

const id = computed(() => String(route.params.id || ''))

async function fetchTicket() {
  if (!id.value) return
  loading.value = true
  error.value = ''
  try {
    const { data } = await axios.get(`/maintenance/${id.value}`)
    ticket.value = data?.ticket || null
    // Initialize controls from loaded ticket
    if (ticket.value) {
      newTicketStatus.value = ticket.value.status || 'pending'
      repairRemarks.value = ticket.value.repairRemarks || ''
      estimatedCost.value = ticket.value.estimatedCost || 0
      actualCost.value = ticket.value.actualCost || 0
      // If returnDate exists, normalize to yyyy-mm-dd
      if (ticket.value.returnDate) {
        try {
          const dt = new Date(ticket.value.returnDate)
          returnDate.value = dt.toISOString().slice(0, 10)
        } catch (_) {
          console.log(_)
        }
      }
      // Fetch repair history
      fetchRepairHistory()
    }
  } catch (e) {
    error.value = e?.response?.data?.message || e.message || 'Failed to load ticket'
  } finally {
    loading.value = false
  }
}

async function fetchRepairHistory() {
  if (!ticket.value?.acn && !ticket.value?.serialNumber) return
  loadingHistory.value = true
  try {
    const params = {}
    if (ticket.value.acn) params.acn = ticket.value.acn
    if (ticket.value.serialNumber) params.serialNumber = ticket.value.serialNumber
    const { data } = await axios.get('/maintenance/history', { params })
    // Exclude current ticket from history
    repairHistory.value = (data?.history || []).filter(h => h._id !== id.value)
  } catch (e) {
    console.error('Failed to fetch repair history:', e)
  } finally {
    loadingHistory.value = false
  }
}

onMounted(fetchTicket)

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

const costDifference = computed(() => {
  const est = Number(estimatedCost.value) || 0
  const act = Number(actualCost.value) || 0
  if (est === 0 || act === 0) return null
  return act - est
})

function formatDate(d) {
  if (!d) return '—'
  try {
    return new Date(d).toLocaleString()
  } catch (_) {
    return String(d)
  }
}

// Update ticket status and details (consolidated - updates both ticket and inventory)
async function updateTicketStatus() {
  if (!id.value || !ticket.value) return
  updatingTicket.value = true
  error.value = ''
  try {
    await axios.patch(`/maintenance/${id.value}`, {
      status: newTicketStatus.value || undefined,
      returnDate: returnDate.value || undefined,
      repairRemarks: repairRemarks.value || undefined,
      estimatedCost: estimatedCost.value || undefined,
      actualCost: actualCost.value || undefined
    })
    await fetchTicket()
  } catch (e) {
    error.value = e?.response?.data?.message || e.message || 'Failed to update ticket'
  } finally {
    updatingTicket.value = false
  }
}

</script>

<template>
  <DefaultLayout>
    <BreadcrumbDefault pageTitle="Repair Ticket Details" />
    <div class="mb-6 flex items-center justify-between">
      <div>
        <h1 class="text-2xl font-bold text-black dark:text-white">Repair Ticket</h1>
        <p class="text-sm text-bodydark2 mt-1">View maintenance & repair details</p>
      </div>
      <button
        class="rounded border border-stroke px-4 py-2 text-sm hover:bg-gray-50 dark:hover:bg-meta-4"
        @click="router.push('/maintenance')"
      >
        ← Back to List
      </button>
    </div>

    <div class="rounded-sm border border-stroke bg-white shadow-default dark:border-strokedark dark:bg-boxdark">
      <div class="border-b border-stroke dark:border-strokedark p-6">
        <div class="flex items-start justify-between">
          <div>
            <h2 class="text-xl font-semibold">{{ ticket?.ticketNumber || '—' }}</h2>
            <p class="text-xs text-bodydark2 mt-1">Ticket ID: {{ id }}</p>
          </div>
          <span v-if="ticket" :class="`inline-block px-3 py-1 rounded text-xs font-medium ${statusBadgeClass(ticket.status)}`">
            {{ labelForStatus(ticket.status) }}
          </span>
        </div>
      </div>

      <div class="p-6">
        <div v-if="loading" class="text-sm">Loading ticket...</div>
        <div v-else-if="error" class="text-danger text-sm">{{ error }}</div>

        <!-- Link to Inventory Record -->
        <div v-if="ticket?.acn || ticket?.serialNumber" class="mb-4">
          <router-link 
            :to="{ name: 'InventoryRecord', query: { acn: ticket.acn, serialNumber: ticket.serialNumber } }"
            class="text-primary hover:underline flex items-center gap-1 text-sm"
          >
            <svg class="h-4 w-4" fill="currentColor" viewBox="0 0 20 20">
              <path d="M10 12a2 2 0 100-4 2 2 0 000 4z"/>
              <path fill-rule="evenodd" d="M.458 10C1.732 5.943 5.522 3 10 3s8.268 2.943 9.542 7c-1.274 4.057-5.064 7-9.542 7S1.732 14.057.458 10zM14 10a4 4 0 11-8 0 4 4 0 018 0z"/>
            </svg>
            View in Inventory Records
          </router-link>
        </div>

        <div v-else-if="ticket" class="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <div>
            <div class="text-xs text-bodydark2 mb-1">Issue</div>
            <div class="text-sm font-medium">{{ ticket.issue || '—' }}</div>
          </div>
          <div>
            <div class="text-xs text-bodydark2 mb-1">ACN</div>
            <div class="text-sm font-medium">{{ ticket.acn || '—' }}</div>
          </div>
          <div>
            <div class="text-xs text-bodydark2 mb-1">Serial</div>
            <div class="text-sm font-medium">{{ ticket.serialNumber || '—' }}</div>
          </div>
          <div>
            <div class="text-xs text-bodydark2 mb-1">Service Provider</div>
            <div class="text-sm font-medium">{{ ticket.serviceProvider || '—' }}</div>
          </div>
          <div>
            <div class="text-xs text-bodydark2 mb-1">Technician</div>
            <div class="text-sm font-medium">{{ ticket.technicianName || '—' }}</div>
          </div>
          <div>
            <div class="text-xs text-bodydark2 mb-1">Date Sent</div>
            <div class="text-sm font-medium">{{ formatDate(ticket.dateSent) }}</div>
          </div>
          <div>
            <div class="text-xs text-bodydark2 mb-1">Return Date</div>
            <div class="text-sm font-medium">{{ formatDate(ticket.returnDate) }}</div>
          </div>
          <div>
            <div class="text-xs text-bodydark2 mb-1">Estimated Cost</div>
            <div class="text-sm font-medium">{{ ticket.estimatedCost ?? '—' }}</div>
          </div>
          <div>
            <div class="text-xs text-bodydark2 mb-1">Actual Cost</div>
            <div class="text-sm font-medium">{{ ticket.actualCost ?? '—' }}</div>
          </div>
          <div>
            <div class="text-xs text-bodydark2 mb-1">Created By</div>
            <div class="text-sm font-medium">{{ ticket.createdBy?.name || '—' }}</div>
          </div>
        </div>

        <div v-if="ticket?.description" class="mb-6">
          <div class="text-xs text-bodydark2 mb-1">Item Description</div>
          <div class="text-sm bg-gray-50 dark:bg-meta-4 p-3 rounded">{{ ticket.description }}</div>
        </div>

        <div v-if="ticket?.repairRemarks" class="mb-6">
          <div class="text-xs text-bodydark2 mb-1">Repair Remarks</div>
          <div class="text-sm bg-gray-50 dark:bg-meta-4 p-3 rounded">{{ ticket.repairRemarks }}</div>
        </div>

        <!-- Repair History -->
        <div v-if="repairHistory.length > 0" class="mb-6">
          <div class="font-medium mb-3">Repair History ({{ repairHistory.length }} previous repairs)</div>
          <div class="space-y-2">
            <div 
              v-for="h in repairHistory" 
              :key="h._id" 
              class="flex justify-between items-start p-3 bg-gray-50 dark:bg-meta-4 rounded border border-stroke dark:border-strokedark hover:bg-gray-100 dark:hover:bg-meta-4/80 cursor-pointer transition"
              @click="router.push(`/maintenance/${h._id}`)"
            >
              <div class="flex-1">
                <div class="text-sm font-medium">{{ h.ticketNumber }}</div>
                <div class="text-xs text-bodydark2 mt-1">{{ h.issue }}</div>
                <div v-if="h.serviceProvider" class="text-xs text-bodydark2 mt-1">
                  Provider: {{ h.serviceProvider }}
                </div>
              </div>
              <div class="text-right ml-4">
                <div class="text-xs text-bodydark2">{{ formatDate(h.dateSent) }}</div>
                <span :class="`inline-block px-2 py-1 rounded text-xs font-medium mt-1 ${statusBadgeClass(h.status)}`">
                  {{ labelForStatus(h.status) }}
                </span>
              </div>
            </div>
          </div>
        </div>
        <div v-else-if="loadingHistory" class="mb-6 text-sm text-bodydark2">
          Loading repair history...
        </div>

        <!-- Cost Tracking Summary -->
        <div v-if="ticket && (ticket.estimatedCost || ticket.actualCost)" class="mb-6 p-4 rounded border border-stroke" :class="costDifference && costDifference > 0 ? 'bg-red-50 border-danger' : costDifference && costDifference < 0 ? 'bg-green-50 border-success' : 'bg-blue-50'">
          <div class="font-medium mb-2">Cost Summary</div>
          <div class="grid grid-cols-2 gap-4">
            <div>
              <div class="text-xs text-bodydark2 mb-1">Estimated Cost</div>
              <div class="text-lg font-semibold">₱{{ Number(ticket.estimatedCost || 0).toLocaleString() }}</div>
            </div>
            <div>
              <div class="text-xs text-bodydark2 mb-1">Actual Cost</div>
              <div class="text-lg font-semibold">₱{{ Number(ticket.actualCost || 0).toLocaleString() }}</div>
            </div>
          </div>
          <div v-if="costDifference !== null" class="mt-3 pt-3 border-t" :class="costDifference > 0 ? 'border-danger' : 'border-success'">
            <div class="text-sm font-medium" :class="costDifference > 0 ? 'text-danger' : 'text-success'">
              {{ costDifference > 0 ? 'Over' : 'Under' }} budget by ₱{{ Math.abs(costDifference).toLocaleString() }}
            </div>
          </div>
        </div>

        <!-- Actions: Consolidated Status Update -->
        <div v-if="ticket" class="mb-6 rounded border border-stroke p-4 bg-gray-50">
          <div class="font-medium mb-3">Update Status & Details</div>
          <p class="text-xs text-bodydark2 mb-3">Updating the status here will automatically sync with the inventory record</p>
          <div class="grid grid-cols-1 md:grid-cols-3 gap-3 items-end">
            <div>
              <label class="block text-xs mb-1">Ticket Status</label>
              <select v-model="newTicketStatus" class="w-full border rounded px-3 py-2 bg-white">
                <option value="pending">Under Repair</option>
                <option value="in_progress">In Progress</option>
                <option value="completed">Repaired</option>
                <option value="beyond_repair">Beyond Repair</option>
              </select>
            </div>
            <div>
              <label class="block text-xs mb-1">Return Date</label>
              <input type="date" v-model="returnDate" class="w-full border rounded px-3 py-2 bg-white" />
            </div>
            <div>
              <label class="block text-xs mb-1">Estimated Cost</label>
              <input 
                v-model="estimatedCost" 
                type="number" 
                step="0.01"
                class="w-full border rounded px-3 py-2 bg-white"
                placeholder="0.00"
              />
            </div>
            <div>
              <label class="block text-xs mb-1">Actual Cost</label>
              <input 
                v-model="actualCost" 
                type="number" 
                step="0.01"
                class="w-full border rounded px-3 py-2 bg-white"
                placeholder="0.00"
              />
            </div>
            <div class="md:col-span-3">
              <label class="block text-xs mb-1">Repair Remarks</label>
              <textarea v-model="repairRemarks" rows="2" class="w-full border rounded px-3 py-2"></textarea>
            </div>
            <div>
              <button
                type="button"
                :disabled="updatingTicket"
                @click="updateTicketStatus"
                class="bg-primary text-white px-4 py-2 rounded"
              >
                {{ updatingTicket ? 'Updating...' : 'Save Changes' }}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  </DefaultLayout>
</template>