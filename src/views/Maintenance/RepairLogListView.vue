<script setup>
import { onMounted, ref, computed } from 'vue'
import { useAuthStore } from '@/stores'
import DefaultLayout from '@/layouts/DefaultLayout.vue'
import axios from '@/utils/axios'
import EmployeeCombobox from '@/components/EmployeeCombobox.vue'
import AcnCombobox from '@/components/AcnCombobox.vue'

const auth = useAuthStore()
const apiBase = import.meta.env.VITE_API_URL || 'http://localhost:5001/api'
const loading = ref(false)
const error = ref('')
const logs = ref([])
const search = ref('')
const statusFilter = ref('')

// Consult Modal State
const showConsultModal = ref(false)
const showClaimModal = ref(false)
const selectedLog = ref(null)
const selectedLogDetails = ref(null)
const consultForm = ref({
  consultFindings: '',
  actionTaken: '',
  result: '', // for_repair | for_replacement | beyond_repair | repaired
  repairedStatus: '', // ready_to_claim | claim_now
  claimDetails: { dateClaimed: '', claimedBy: '', remarks: '' },
  replacementParts: [] // [{ part, quantity, remarks }]
})

// Claim Modal State
const claimForm = ref({
  dateClaimed: new Date().toISOString().slice(0, 10),
  claimedBy: '',
  remarks: ''
})
const savingClaim = ref(false)

// UI helper: map backend status to display label
const statusLabel = (s) => (s === 'repaired' || s === 'claimed' ? 'Claimed' : s)

const savingConsult = ref(false)
const replacementOptions = ref([
  { value: 'Motherboard', label: 'Motherboard' },
  { value: 'CPU', label: 'CPU' },
  { value: 'RAM', label: 'RAM' },
  { value: 'HDD', label: 'HDD' },
  { value: 'SSD', label: 'SSD' },
  { value: 'PSU', label: 'Power Supply (PSU)' },
  { value: 'GPU', label: 'GPU' },
  { value: 'Fan', label: 'Fan' },
  { value: 'Other', label: 'Other' }
])

const openConsult = async (log) => {
  selectedLog.value = log
  showConsultModal.value = true
  consultForm.value = {
    consultFindings: '',
    actionTaken: '',
    result: '',
    repairedStatus: '',
    claimDetails: {
      dateClaimed: new Date().toISOString().slice(0, 10),
      claimedBy: log?.broughtBy?.name || '',
      remarks: ''
    },
    replacementParts: []
  }
  try {
    const { data } = await axios.get(`/maintenance/logs/${log._id}`)
    if (data.success) selectedLogDetails.value = data.log
  } catch (e) {
    /* ignore for modal */
  }
}

const openClaim = async (log) => {
  selectedLog.value = log
  showClaimModal.value = true
  claimForm.value = {
    dateClaimed: new Date().toISOString().slice(0, 10),
    claimedBy: log?.broughtBy?.name || '',
    remarks: ''
  }
  try {
    const { data } = await axios.get(`/maintenance/logs/${log._id}`)
    if (data.success) selectedLogDetails.value = data.log
  } catch (e) {
    /* ignore for modal */
  }
}

const closeClaim = () => {
  showClaimModal.value = false
  selectedLog.value = null
  selectedLogDetails.value = null
}

const submitClaim = async () => {
  if (!selectedLog.value) return
  savingClaim.value = true
  try {
    const res = await fetch(`${apiBase}/maintenance/logs/${selectedLog.value._id}/claimed`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${auth.token}` },
      body: JSON.stringify({
        dateClaimed: claimForm.value.dateClaimed,
        claimedBy: claimForm.value.claimedBy,
        remarks: claimForm.value.remarks
      })
    })
    const data = await res.json()
    if (!data.success) throw new Error(data.message || 'Failed to mark claimed')

    await fetch(`${apiBase}/maintenance/logs/${selectedLog.value._id}/actions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${auth.token}` },
      body: JSON.stringify({
        consultFindings: '',
        actionTaken: '',
        result: 'repaired',
        repairedStatus: 'claim_now',
        claimDetails: {
          dateClaimed: claimForm.value.dateClaimed,
          claimedBy: claimForm.value.claimedBy,
          remarks: claimForm.value.remarks
        },
        replacementParts: []
      })
    })
    await fetchLogs()
    closeClaim()
  } catch (e) {
    error.value = e.message || String(e)
  } finally {
    savingClaim.value = false
  }
}

const closeConsult = () => {
  showConsultModal.value = false
  selectedLog.value = null
  selectedLogDetails.value = null
}
const addReplacementRow = () => {
  consultForm.value.replacementParts.push({ part: '', quantity: 1, remarks: '' })
}
const removeReplacementRow = (idx) => {
  consultForm.value.replacementParts.splice(idx, 1)
}
const submitConsult = async () => {
  if (!selectedLog.value) return
  if (!consultForm.value.result) {
    error.value = 'Please select a status in the modal.'
    return
  }
  savingConsult.value = true
  try {
    // 1) Add repair action with outcome
    const res = await fetch(`${apiBase}/maintenance/logs/${selectedLog.value._id}/actions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${auth.token}` },
      body: JSON.stringify(consultForm.value)
    })
    const data = await res.json()
    if (!data.success) throw new Error(data.message || 'Failed to add action')

    // 2) If for_replacement, set replacement parts via endpoint
    if (
      consultForm.value.result === 'for_replacement' &&
      consultForm.value.replacementParts.length > 0
    ) {
      await fetch(`${apiBase}/maintenance/logs/${selectedLog.value._id}/replacement`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${auth.token}` },
        body: JSON.stringify({ replacementParts: consultForm.value.replacementParts })
      })
    }

    // Optional: On beyond_repair, keep a hint to go to Disposal
    // We'll show a small banner below table when last action was beyond_repair

    await fetchLogs()
    closeConsult()
  } catch (e) {
    error.value = e.message || String(e)
  } finally {
    savingConsult.value = false
  }
}

const fetchLogs = async () => {
  loading.value = true
  error.value = ''
  try {
    const url = new URL(`${apiBase}/maintenance/logs`)
    if (statusFilter.value) url.searchParams.set('status', statusFilter.value)
    const res = await fetch(url.toString(), {
      headers: { Authorization: `Bearer ${auth.token}` }
    })
    const data = await res.json()
    if (!data.success) throw new Error(data.message || 'Failed to fetch logs')
    logs.value = Array.isArray(data.logs) ? data.logs : []
  } catch (e) {
    error.value = e.message || String(e)
  } finally {
    loading.value = false
  }
}

const filteredLogs = computed(() => {
  const q = search.value.trim().toLowerCase()
  return logs.value.filter((l) => {
    const s = `${l.logNumber || ''} ${l.acn || ''} ${l.serialNumber || ''} ${
      l.status || ''
    }`.toLowerCase()
    return !q || s.includes(q)
  })
})

onMounted(fetchLogs)

// Create Repair Log Modal State
const showCreateModal = ref(false)
const createForm = ref({
  acn: '',
  purpose: '',
  remarks: '',
  broughtByName: '',
  broughtByEmployeeId: '',
  status: 'for_inspection'
})
const createLoading = ref(false)
const createError = ref('')
const selectedItem = ref(null)
const selectedRecord = ref(null)
const selectedIsSecondary = ref(false)
const openCreateModal = () => {
  createError.value = ''
  selectedItem.value = null
  selectedRecord.value = null
  createForm.value = {
    acn: '',
    purpose: 'Repair & Maintenance',
    remarks: '',
    broughtByName: '',
    broughtByEmployeeId: '',
    status: 'for_inspection'
  }
  showCreateModal.value = true
  // ACN combobox now lists all deployed (including secondary); no extra picker
}
const closeCreateModal = () => {
  showCreateModal.value = false
}
const onAcnSelect = (payload) => {
  createForm.value.acn = payload?.acn || ''
  selectedItem.value = payload?.item || null
  selectedRecord.value = payload?.record || null
  selectedIsSecondary.value = !!payload?.isSecondary
  const defaultRequester = payload?.item?.endUserOrMR || ''
  if (defaultRequester && !createForm.value.broughtByName) {
    createForm.value.broughtByName = defaultRequester
  }
}
// Dynamic preview helpers
const descText = computed(() => {
  if (selectedIsSecondary.value) {
    const sec = selectedItem.value?._selectedSecondary
    if (!sec) return ''
    const pname = sec.productName || ''
    if (pname) return pname
    const name = sec.item || ''
    if (name) return name
    const t = sec.type || ''
    const pn = sec.propertyNumber ? ` • ${sec.propertyNumber}` : ''
    return `${t}${pn}`.trim()
  }
  return (
    selectedItem.value?.productName ||
    selectedItem.value?.name ||
    selectedItem.value?.description ||
    ''
  )
})
const productText = computed(() => {
  if (selectedIsSecondary.value) return selectedItem.value?._selectedSecondary?.type || ''
  return (
    selectedItem.value?.product ||
    selectedItem.value?.specs?.brand ||
    selectedItem.value?.specs?.monitorSize ||
    ''
  )
})
const hasDescription = computed(() => !!descText.value)
const hasEndUser = computed(() => !!selectedItem.value?.endUserOrMR)
const hasDepartment = computed(() => !!selectedRecord.value?.department)
const hasProduct = computed(() => !!productText.value)
const hasAnySpecs = computed(() => {
  if (selectedIsSecondary.value) return false
  const s = selectedItem.value?.specs || {}
  return !!(s.processor || s.storage || s.ram || s.videoCard)
})
const submitCreateLog = async () => {
  createLoading.value = true
  createError.value = ''
  try {
    const payload = {
      acn: createForm.value.acn || undefined,
      purpose: createForm.value.purpose || 'Repair & Maintenance',
      remarks: createForm.value.remarks || undefined,
      status: createForm.value.status || 'under_repair',
      broughtBy: {
        name: createForm.value.broughtByName || '',
        employee: createForm.value.broughtByEmployeeId || undefined
      }
      // technician: { name: createForm.value.technicianName || '' }
    }
    // Only include inventory linkage for primary items
    if (!selectedIsSecondary.value) {
      payload.serialNumber = selectedItem.value?.serialNumber || undefined
      payload.inventoryRecordId = selectedRecord.value?._id || undefined
      payload.itemId = selectedItem.value?._id || undefined
    }
    const { data } = await axios.post('/maintenance/logs', payload)
    if (!data?.success) throw new Error(data?.message || 'Failed to create repair log')
    await fetchLogs()
    closeCreateModal()
  } catch (e) {
    createError.value = e.response?.data?.message || e.message || String(e)
  } finally {
    createLoading.value = false
  }
}
</script>

<template>
  <DefaultLayout>
    <div class="p-6">
      <!-- Header -->
      <div class="flex items-center justify-between mb-6">
        <div>
          <h1 class="text-2xl font-bold text-black dark:text-white">Repair Logs</h1>
          <p class="text-sm text-bodydark2 mt-1">Track and manage repair and maintenance logs</p>
        </div>
        <button
          type="button"
          class="rounded bg-primary text-white px-4 py-2 text-sm font-medium hover:bg-opacity-90 transition"
          @click="openCreateModal"
        >
          + New Repair Log
        </button>
      </div>

      <!-- Main Card -->
      <div
        class="rounded-sm border border-stroke bg-white shadow-default dark:border-strokedark dark:bg-boxdark"
      >
        <!-- Filters -->
        <div class="border-b border-stroke dark:border-strokedark p-4">
          <div class="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-3">
            <input
              v-model="search"
              class="w-full border border-stroke rounded px-3 py-2 bg-white"
              placeholder="Search log #, ACN, or serial"
            />
            <select
              v-model="statusFilter"
              class="w-full border border-stroke rounded px-3 py-2 bg-white"
            >
              <option value="">All statuses</option>
              <option value="for_inspection">For inspection</option>
              <option value="under_repair">Under repair</option>
              <option value="pending_replacement">Pending replacement</option>
              <option value="repaired">Repaired</option>
              <option value="for_disposal">For disposal</option>
            </select>
            <div class="flex gap-2">
              <button
                @click="fetchLogs"
                class="rounded border border-primary bg-primary/10 text-primary px-4 py-2 text-sm font-medium hover:bg-primary/20 transition"
              >
                Apply
              </button>
              <button
                @click="
                  () => {
                    search = ''
                    statusFilter = ''
                    fetchLogs()
                  }
                "
                class="rounded border border-stroke px-4 py-2 text-sm font-medium hover:bg-gray-50 dark:hover:bg-meta-4 transition"
              >
                Clear
              </button>
            </div>
          </div>
          <div v-if="error" class="text-red-600 mt-3 text-sm">{{ error }}</div>
        </div>

        <!-- Table -->
        <div class="overflow-x-auto">
          <table class="w-full table-auto">
            <thead>
              <tr class="bg-gray-2 text-left dark:bg-meta-4">
                <th class="py-3 px-4 font-semibold text-sm">Log #</th>
                <th class="py-3 px-4 font-semibold text-sm">Date</th>
                <th class="py-3 px-4 font-semibold text-sm">Status</th>
                <th class="py-3 px-4 font-semibold text-sm">ACN</th>
                <!-- <th class="py-3 px-4 font-semibold text-sm">Serial</th> -->
                <th class="py-3 px-4 font-semibold text-sm">Brought By</th>
                <th class="py-3 px-4 font-semibold text-sm">RIS</th>
                <th class="py-3 px-4 font-semibold text-sm">Actions</th>
              </tr>
            </thead>
            <tbody>
              <!-- Loading State -->
              <tr v-if="loading">
                <td colspan="9" class="text-center py-8">
                  <div class="flex items-center justify-center gap-2">
                    <div
                      class="h-4 w-4 rounded-full border-2 border-primary border-t-transparent animate-spin"
                    ></div>
                    <span class="text-sm text-bodydark2">Loading repair logs...</span>
                  </div>
                </td>
              </tr>

              <!-- Empty State -->
              <tr v-else-if="filteredLogs.length === 0">
                <td colspan="9" class="text-center py-8">
                  <div class="flex flex-col items-center gap-2">
                    <svg
                      class="h-12 w-12 text-bodydark2 opacity-50"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        stroke-linecap="round"
                        stroke-linejoin="round"
                        stroke-width="2"
                        d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                      />
                    </svg>
                    <span class="text-sm text-bodydark2">No repair logs found</span>
                  </div>
                </td>
              </tr>

              <!-- Data Rows -->
              <tr
                v-for="l in filteredLogs"
                :key="l._id"
                class="border-b border-stroke dark:border-strokedark hover:bg-gray-50 dark:hover:bg-meta-4 transition"
              >
                <td class="py-3 px-4">
                  <span class="font-medium text-sm">{{ l.logNumber }}</span>
                </td>
                <td class="py-3 px-4">
                  <span class="text-sm">{{
                    new Date(l.date || l.createdAt).toLocaleDateString()
                  }}</span>
                </td>
                <td class="py-3 px-4">
                  <span
                    class="inline-block px-2 py-1 rounded text-xs font-medium bg-bodydark/10 text-black"
                  >
                    {{ statusLabel(l.status) }}
                  </span>
                </td>
                <td class="py-3 px-4">
                  <span class="text-sm font-mono text-success">{{ l.acn || '—' }}</span>
                </td>
                <!-- <td class="py-3 px-4">
                  <span class="text-sm font-mono">{{ l.serialNumber || '—' }}</span>
                </td> -->
                <!-- <td class="py-3 px-4">
                  <span class="text-sm">{{ l.technician?.name || '—' }}</span>
                </td> -->
                <td class="py-3 px-4">
                  <span class="text-sm">{{ l.broughtBy?.name || '—' }}</span>
                </td>
                <td class="py-3 px-4">
                  <span class="text-sm">{{ l.risGenerated ? 'Generated' : '—' }}</span>
                </td>
                <td class="py-3 px-4">
                  <div class="flex gap-3 items-center">
                    <button
                      v-if="l.status === 'ready_to_claim'"
                      @click="openClaim(l)"
                      class="inline-flex items-center gap-1 rounded border border-primary bg-primary/10 text-primary px-3 py-1 text-xs font-medium hover:bg-primary/20 transition"
                    >
                      Claim
                    </button>
                    <button
                      v-else-if="l.status !== 'repaired' && l.status !== 'claimed'"
                      @click="openConsult(l)"
                      class="inline-flex items-center gap-1 rounded border border-primary bg-primary/10 text-primary px-3 py-1 text-xs font-medium hover:bg-primary/20 transition"
                    >
                      Action
                    </button>
                    <router-link
                      :to="`/maintenance/logs/${l._id}`"
                      class="inline-flex items-center gap-1 text-primary text-sm font-medium hover:underline"
                    >
                      View
                      <svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path
                          stroke-linecap="round"
                          stroke-linejoin="round"
                          stroke-width="2"
                          d="M9 5l7 7-7 7"
                        />
                      </svg>
                    </router-link>
                  </div>
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <!-- Footer Summary -->
        <div
          v-if="filteredLogs.length > 0"
          class="border-t border-stroke dark:border-strokedark p-4 bg-gray-50 dark:bg-meta-4"
        >
          <p class="text-xs text-bodydark2">
            Showing <span class="font-semibold">{{ filteredLogs.length }}</span> repair log{{
              filteredLogs.length !== 1 ? 's' : ''
            }}
          </p>
        </div>
      </div>
    </div>
    <!-- Consult Modal -->
    <div
      v-if="showConsultModal"
      class="fixed inset-0 bg-black/30 flex items-center justify-center z-50"
    >
      <div class="bg-white rounded shadow-lg w-full max-w-2xl p-6">
        <div class="flex items-center justify-between mb-4">
          <h2 class="text-lg font-semibold">Action</h2>
          <button @click="closeConsult" class="text-sm">✕</button>
        </div>
        <div class="space-y-3">
          <div>
            <label class="block mb-1 text-sm">Consult Findings</label>
            <textarea
              v-model="consultForm.consultFindings"
              rows="3"
              class="w-full border rounded px-3 py-2"
            ></textarea>
          </div>
          <div>
            <label class="block mb-1 text-sm">Action Taken</label>
            <textarea
              v-model="consultForm.actionTaken"
              rows="2"
              class="w-full border rounded px-3 py-2"
            ></textarea>
          </div>
          <div>
            <label class="block mb-1 text-sm">Status / Outcome</label>
            <select v-model="consultForm.result" class="w-full border rounded px-3 py-2">
              <option value="">Select outcome</option>
              <option value="for_repair">For repair</option>
              <option value="for_replacement">For replacement</option>
              <option value="beyond_repair">Beyond repair</option>
              <option value="repaired">Repaired</option>
            </select>
            <p v-if="consultForm.result === 'beyond_repair'" class="text-xs text-bodydark2 mt-1">
              This marks the unit as <span class="font-semibold">for disposal</span>. You can create
              a disposal record from the Disposal module.
            </p>
          </div>

          <!-- Repaired outcome options -->
          <div v-if="consultForm.result === 'repaired'" class="border rounded p-3">
            <label class="block mb-2 text-sm font-medium">Repaired Outcome</label>
            <div class="flex flex-col gap-2">
              <label class="inline-flex items-center gap-2">
                <input type="radio" value="ready_to_claim" v-model="consultForm.repairedStatus" />
                <span>Mark as Ready to Claim</span>
              </label>
              <label class="inline-flex items-center gap-2">
                <input type="radio" value="claim_now" v-model="consultForm.repairedStatus" />
                <span>Mark as Claimed now</span>
              </label>
            </div>
            <div
              v-if="consultForm.repairedStatus === 'claim_now'"
              class="grid grid-cols-3 gap-3 mt-3"
            >
              <div>
                <label class="block mb-1 text-sm">Claim Date</label>
                <input
                  type="date"
                  v-model="consultForm.claimDetails.dateClaimed"
                  class="w-full border rounded px-3 py-2"
                />
              </div>
              <div>
                <label class="block mb-1 text-sm">Claimed By</label>
                <input
                  type="text"
                  v-model="consultForm.claimDetails.claimedBy"
                  class="w-full border rounded px-3 py-2"
                />
              </div>
              <div class="col-span-3">
                <label class="block mb-1 text-sm">Claim Remarks</label>
                <input
                  type="text"
                  v-model="consultForm.claimDetails.remarks"
                  class="w-full border rounded px-3 py-2"
                />
              </div>
            </div>
          </div>

          <!-- For replacement specs combobox -->
          <div v-if="consultForm.result === 'for_replacement'" class="border rounded p-3">
            <div class="flex items-center justify-between mb-2">
              <label class="text-sm font-medium">Replacement Parts</label>
              <button
                type="button"
                @click="addReplacementRow"
                class="text-xs px-2 py-1 rounded border"
              >
                + Add Part
              </button>
            </div>
            <div v-if="consultForm.replacementParts.length === 0" class="text-xs text-bodydark2">
              Add parts like CPU, RAM, Storage, GPU, etc.
            </div>
            <div
              v-for="(rp, idx) in consultForm.replacementParts"
              :key="idx"
              class="grid grid-cols-12 gap-2 items-center mb-2"
            >
              <div class="col-span-4">
                <select v-model="rp.part" class="w-full border rounded px-2 py-1">
                  <option value="">Select part</option>
                  <option v-for="opt in replacementOptions" :key="opt.value" :value="opt.value">
                    {{ opt.label }}
                  </option>
                </select>
              </div>
              <div class="col-span-2">
                <input
                  type="number"
                  min="1"
                  v-model.number="rp.quantity"
                  class="w-full border rounded px-2 py-1"
                />
              </div>
              <div class="col-span-5">
                <input
                  type="text"
                  v-model="rp.remarks"
                  placeholder="Remarks"
                  class="w-full border rounded px-2 py-1"
                />
              </div>
              <div class="col-span-1">
                <button
                  type="button"
                  @click="removeReplacementRow(idx)"
                  class="text-xs text-red-600"
                >
                  Remove
                </button>
              </div>
            </div>
            <div v-if="selectedLogDetails?.specs" class="mt-2 text-xs text-bodydark2">
              Specs: CPU {{ selectedLogDetails.specs?.cpu || '—' }}, RAM
              {{ selectedLogDetails.specs?.ram || '—' }}, Storage
              {{ selectedLogDetails.specs?.storage || '—' }}, GPU
              {{ selectedLogDetails.specs?.gpu || '—' }}
            </div>
          </div>
        </div>

        <div class="mt-4 flex justify-end gap-2">
          <button @click="closeConsult" class="border px-4 py-2 rounded">Cancel</button>
          <button
            @click="submitConsult"
            :disabled="savingConsult"
            class="bg-primary text-white px-4 py-2 rounded"
          >
            {{ savingConsult ? 'Saving...' : 'Save Action' }}
          </button>
        </div>
      </div>
    </div>

    <!-- Claim Modal -->
    <div
      v-if="showClaimModal"
      class="fixed inset-0 bg-black/30 flex items-center justify-center z-50"
    >
      <div class="bg-white rounded shadow-lg w-full max-w-xl p-6">
        <div class="flex items-center justify-between mb-4">
          <h2 class="text-lg font-semibold">Claim Item</h2>
          <button @click="closeClaim" class="text-sm">✕</button>
        </div>
        <div class="space-y-3">
          <div>
            <label class="block mb-1 text-sm">Date Claimed</label>
            <input
              type="date"
              v-model="claimForm.dateClaimed"
              class="w-full border rounded px-3 py-2"
            />
          </div>
          <div>
            <label class="block mb-1 text-sm">Claimed By</label>
            <EmployeeCombobox
              v-model="claimForm.claimedBy"
              :placeholder="'Search or type employee name'"
            />
          </div>
          <div>
            <label class="block mb-1 text-sm">Remarks</label>
            <input
              type="text"
              v-model="claimForm.remarks"
              class="w-full border rounded px-3 py-2"
            />
          </div>
        </div>
        <div class="mt-4 flex justify-end gap-2">
          <button @click="closeClaim" class="border px-4 py-2 rounded">Cancel</button>
          <button
            @click="submitClaim"
            :disabled="savingClaim"
            class="bg-primary text-white px-4 py-2 rounded"
          >
            {{ savingClaim ? 'Claiming...' : 'Confirm Claim' }}
          </button>
        </div>
      </div>
    </div>

    <!-- Create Repair Log Modal -->
    <div v-if="showCreateModal" class="fixed inset-0 z-50">
      <div class="absolute inset-0 bg-black/30" @click="closeCreateModal"></div>
      <div class="absolute inset-0 mt-15 flex items-center justify-center p-4 sm:p-6">
        <div
          class="w-full max-w-full sm:max-w-2xl md:max-w-4xl lg:max-w-5xl my-6 sm:my-8 rounded-sm border border-stroke bg-white shadow-default dark:border-strokedark dark:bg-boxdark max-h-[90vh] flex flex-col"
        >
          <div class="p-4 overflow-y-auto">
            <div
              class="bg-white dark:bg-boxdark z-10 flex items-center justify-between border-b border-stroke dark:border-strokedark"
            >
              <div>
                <h2 class="text-xl font-semibold text-black dark:text-white">Create Repair Log</h2>
                <p class="text-xs text-bodydark2">Record a new maintenance or repair activity</p>
              </div>
              <button
                type="button"
                @click="closeCreateModal"
                class="px-3 py-1 rounded bg-gray-100 hover:bg-gray-200 text-sm"
              >
                Close
              </button>
            </div>

            <div
              v-if="createError"
              class="mb-3 p-3 rounded bg-danger/10 text-danger text-sm border border-danger/20"
            >
              {{ createError }}
            </div>

            <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
              <!-- Left: Selection and form -->
              <div class="space-y-4">
                <div>
                  <label class="block text-sm font-medium mb-2">ACN</label>
                  <AcnCombobox
                    v-model="createForm.acn"
                    placeholder="Search deployed ACN"
                    @select="onAcnSelect"
                  />
                  <p class="text-xs text-bodydark2 mt-1">
                    Choose a deployed ACN to auto-populate item details
                  </p>
                </div>

                <!-- Deployed items picker removed; ACN combobox includes all deployed ACNs -->

                <div>
                  <label class="block text-sm font-medium mb-2">Purpose</label>
                  <input
                    v-model="createForm.purpose"
                    class="w-full border border-stroke rounded px-3 py-2 bg-gray-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-gray-200 focus:border-gray-300"
                    placeholder="Purpose"
                  />
                </div>

                <div>
                  <label class="block text-sm font-medium mb-2">Remarks</label>
                  <textarea
                    v-model="createForm.remarks"
                    class="w-full border border-stroke rounded px-3 py-2 bg-gray-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-gray-200 focus:border-gray-300"
                    placeholder="Remarks"
                    rows="4"
                  ></textarea>
                </div>

                <div>
                  <label class="block text-sm font-medium mb-2">Brought By</label>
                  <EmployeeCombobox
                    v-model="createForm.broughtByName"
                    placeholder="Search employee"
                    :limit="200"
                    @select="
                      (emp) => {
                        createForm.value
                          ? (createForm.value.broughtByEmployeeId = emp._id)
                          : (createForm.broughtByEmployeeId = emp._id)
                        createForm.broughtByName = `${emp.firstName} ${emp.lastName}`
                      }
                    "
                  />
                </div>

                <div>
                  <label class="block text-sm font-medium mb-2">Status</label>
                  <select
                    v-model="createForm.status"
                    class="w-full border border-stroke rounded px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-gray-200 focus:border-gray-300"
                  >
                    <option value="for_inspection">For inspection</option>
                    <option value="under_repair">Under repair</option>
                    <option value="pending_replacement">Pending replacement</option>
                    <option value="repaired">Repaired</option>
                    <option value="for_disposal">For disposal</option>
                  </select>
                </div>

                <div class="pt-2 flex gap-2">
                  <button
                    @click="submitCreateLog"
                    :disabled="createLoading"
                    class="px-4 py-2 rounded-sm border border-stroke bg-primary text-white hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {{ createLoading ? 'Creating...' : 'Create Log' }}
                  </button>
                  <button
                    type="button"
                    @click="closeCreateModal"
                    class="px-4 py-2 rounded-sm border border-stroke bg-white text-black hover:bg-gray-50"
                  >
                    Cancel
                  </button>
                </div>
              </div>

              <!-- Right: Item details preview -->
              <div class="rounded-sm border border-stroke bg-gray-50 p-4">
                <div class="mb-3">
                  <div class="text-sm text-bodydark2">Selected ACN</div>
                  <div class="text-lg font-semibold">{{ createForm.acn || '—' }}</div>
                </div>
                <div class="grid grid-cols-2 gap-3 text-sm">
                  <div v-if="hasDescription">
                    <div class="text-bodydark2">Description</div>
                    <div class="font-medium">{{ descText }}</div>
                  </div>
                  <div v-if="hasEndUser">
                    <div class="text-bodydark2">End User</div>
                    <div class="font-medium">{{ selectedItem?.endUserOrMR }}</div>
                  </div>
                  <div v-if="hasDepartment">
                    <div class="text-bodydark2">Department</div>
                    <div class="font-medium">{{ selectedRecord?.department }}</div>
                  </div>
                  <div v-if="hasProduct">
                    <div class="text-bodydark2">Product</div>
                    <div class="font-medium">{{ productText }}</div>
                  </div>
                </div>
                <div class="mt-4" v-if="hasAnySpecs">
                  <div class="text-sm text-bodydark2 mb-2">Specs</div>
                  <div class="grid grid-cols-2 gap-3 text-sm">
                    <div v-if="selectedItem?.specs?.processor">
                      <div class="text-bodydark2">Processor</div>
                      <div class="font-medium">{{ selectedItem?.specs?.processor }}</div>
                    </div>
                    <div v-if="selectedItem?.specs?.storage">
                      <div class="text-bodydark2">Storage</div>
                      <div class="font-medium">{{ selectedItem?.specs?.storage }}</div>
                    </div>
                    <div v-if="selectedItem?.specs?.ram">
                      <div class="text-bodydark2">RAM</div>
                      <div class="font-medium">{{ selectedItem?.specs?.ram }}</div>
                    </div>
                    <div v-if="selectedItem?.specs?.videoCard">
                      <div class="text-bodydark2">Video Card</div>
                      <div class="font-medium">{{ selectedItem?.specs?.videoCard }}</div>
                    </div>
                  </div>
                </div>
                <div
                  class="mt-4"
                  v-if="
                    selectedIsSecondary &&
                    (selectedItem?._selectedSecondary?.propertyNumber ||
                      selectedItem?._selectedSecondary?.serialNumber)
                  "
                >
                  <div class="text-sm text-bodydark2 mb-2">Secondary Item Details</div>
                  <div class="grid grid-cols-2 gap-3 text-sm">
                    <div v-if="selectedItem?._selectedSecondary?.propertyNumber">
                      <div class="text-bodydark2">Property #</div>
                      <div class="font-medium">
                        {{ selectedItem?._selectedSecondary?.propertyNumber }}
                      </div>
                    </div>
                    <div v-if="selectedItem?._selectedSecondary?.serialNumber">
                      <div class="text-bodydark2">Serial</div>
                      <div class="font-medium">
                        {{ selectedItem?._selectedSecondary?.serialNumber }}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </DefaultLayout>
</template>

<style scoped>
.bg-primary {
  background-color: #1a56db;
}
.text-primary {
  color: #1a56db;
}
</style>
