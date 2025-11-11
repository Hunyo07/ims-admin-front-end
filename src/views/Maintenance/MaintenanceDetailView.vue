<script setup>
import { ref, onMounted, computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import axios from '@/utils/axios'
import DefaultLayout from '@/layouts/DefaultLayout.vue'

const route = useRoute()
const router = useRouter()

const ticket = ref(null)
const loading = ref(false)
const error = ref('')
const updatingTicket = ref(false)
const updatingAsset = ref(false)
const newTicketStatus = ref('')
const returnDate = ref('')
const repairRemarks = ref('')
const assetStatus = ref('under_repair')
const assetStatusNotes = ref('')

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
      // If returnDate exists, normalize to yyyy-mm-dd
      if (ticket.value.returnDate) {
        try {
          const dt = new Date(ticket.value.returnDate)
          returnDate.value = dt.toISOString().slice(0, 10)
        } catch (_) {
          console.log(_)
        }
      }
    }
  } catch (e) {
    error.value = e?.response?.data?.message || e.message || 'Failed to load ticket'
  } finally {
    loading.value = false
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

function formatDate(d) {
  if (!d) return '—'
  try {
    return new Date(d).toLocaleString()
  } catch (_) {
    return String(d)
  }
}

// Update ticket status and details
async function updateTicketStatus() {
  if (!id.value || !ticket.value) return
  updatingTicket.value = true
  error.value = ''
  try {
    await axios.patch(`/maintenance/${id.value}`, {
      status: newTicketStatus.value || undefined,
      returnDate: returnDate.value || undefined,
      repairRemarks: repairRemarks.value || undefined
    })
    await fetchTicket()
  } catch (e) {
    error.value = e?.response?.data?.message || e.message || 'Failed to update ticket'
  } finally {
    updatingTicket.value = false
  }
}

// Update underlying asset status directly (e.g., repaired/claimed/for disposal)
async function updateAssetItemStatus() {
  const acn = ticket.value?.acn
  const serial = ticket.value?.serialNumber
  let recordId = ticket.value?.inventoryRecordId
  // Fallback: resolve recordId by ACN/Serial if not linked on ticket
  if (!recordId) {
    if (!acn && !serial) {
      error.value = 'Ticket lacks ACN or serial number to locate item'
      return
    }
    try {
      const params = acn ? { acn, limit: 1 } : { serialNumber: serial, limit: 1 }
      const { data } = await axios.get('/inventory-records', { params })
      const rec = (data?.records || [])[0]
      if (!rec) {
        error.value = 'No matching inventory record found for this ACN/Serial'
        return
      }
      recordId = rec._id
    } catch (e) {
      error.value = e?.response?.data?.message || e.message || 'Failed to locate inventory record'
      return
    }
  }
  if (!acn && !serial) {
    error.value = 'Ticket lacks ACN or serial number to locate item'
    return
  }
  if (!acn && !serial) {
    error.value = 'Ticket lacks ACN or serial number to locate item'
    return
  }
  // Map UI labels to inventory item statuses
  const chosen = assetStatus.value
  let mapped = chosen
  if (chosen === 'repaired') mapped = 'deployed'
  else if (chosen === 'claimed') mapped = 'returned'
  else if (chosen === 'under_repair') mapped = 'under_repair'
  else if (chosen === 'for_disposal') mapped = 'for_disposal'

  updatingAsset.value = true
  error.value = ''
  try {
    const body = { status: mapped, statusNotes: assetStatusNotes.value || '' }
    if (serial) body.serialNumber = serial
    else body.acn = acn
    await axios.patch(`/inventory-records/${recordId}/items/status`, body)
    // Reload to reflect changes; fetchTicket shows ticket, but ACN status is not on ticket
    await fetchTicket()
  } catch (e) {
    error.value = e?.response?.data?.message || e.message || 'Failed to update asset status'
  } finally {
    updatingAsset.value = false
  }
}
</script>

<template>
  <DefaultLayout>
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
            {{ ticket.status || '—' }}
          </span>
        </div>
      </div>

      <div class="p-6">
        <div v-if="loading" class="text-sm">Loading ticket...</div>
        <div v-else-if="error" class="text-danger text-sm">{{ error }}</div>

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

        <!-- Actions: Ticket status update -->
        <div v-if="ticket" class="mb-6 rounded border border-stroke p-4 bg-gray-50">
          <div class="font-medium mb-3">Update Ticket Status</div>
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
                {{ updatingTicket ? 'Updating...' : 'Save Ticket Status' }}
              </button>
            </div>
          </div>
        </div>

        <!-- Actions: Asset status update -->
        <div v-if="ticket" class="rounded border border-stroke p-4 bg-gray-50">
          <div class="font-medium mb-3">Update Asset Status</div>
          <div class="grid grid-cols-1 md:grid-cols-3 gap-3 items-end">
            <div>
              <label class="block text-xs mb-1">Asset Status</label>
              <select v-model="assetStatus" class="w-full border rounded px-3 py-2 bg-white">
                <option value="under_repair">Under Repair</option>
                <option value="repaired">Repaired</option>
                <option value="claimed">Claimed</option>
                <option value="for_disposal">For Disposal</option>
              </select>
            </div>
            <div class="md:col-span-2">
              <label class="block text-xs mb-1">Notes</label>
              <input v-model="assetStatusNotes" type="text" class="w-full border rounded px-3 py-2 bg-white" />
            </div>
            <div>
              <button
                type="button"
                :disabled="updatingAsset"
                @click="updateAssetItemStatus"
                class="border px-4 py-2 rounded"
                title="Applies status using ACN/Serial to the linked inventory item"
              >
                {{ updatingAsset ? 'Updating...' : 'Save Asset Status' }}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  </DefaultLayout>
</template>