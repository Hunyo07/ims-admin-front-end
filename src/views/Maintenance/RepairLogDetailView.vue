<script setup>
import { onMounted, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import { useAuthStore } from '@/stores'

const route = useRoute()
const auth = useAuthStore()
const apiBase = import.meta.env.VITE_API_URL || 'http://localhost:5001/api'

const log = ref(null)
const loading = ref(false)
const error = ref('')

const actionForm = ref({ consultFindings: '', actionTaken: '', result: '' })
const updateStatus = ref('')
const repairDate = ref('')
const replacementParts = ref([{ product: '', requestedQty: 1, remarks: '' }])
const savingAction = ref(false)
const savingStatus = ref(false)
const savingReplacement = ref(false)

// Employee picker state
const employeeSearch = ref('')
const employeeOptions = ref([])
const employeeLoading = ref(false)
const assigningEmployee = ref(false)

// Linked statuses
const inventoryItemStatus = ref(null)
const drItemStatus = ref(null)

// Product search per replacement row
const productSearchTexts = ref({})
const productOptionsByIdx = ref({})
const productLoadingByIdx = ref({})

const searchProductsForRow = async (idx) => {
  const q = String(productSearchTexts.value[idx] || '').trim()
  if (!q) {
    productOptionsByIdx.value[idx] = []
    return
  }
  productLoadingByIdx.value[idx] = true
  try {
    const res = await fetch(`${apiBase}/products?limit=10&search=${encodeURIComponent(q)}`, {
      headers: { Authorization: `Bearer ${auth.token}` }
    })
    const data = await res.json()
    const list = data?.products || []
    productOptionsByIdx.value[idx] = Array.isArray(list) ? list : []
  } catch (e) {
    productOptionsByIdx.value[idx] = []
  } finally {
    productLoadingByIdx.value[idx] = false
  }
}

const selectProductForPart = (idx, prod) => {
  if (!prod?._id) return
  replacementParts.value[idx].product = prod._id
  productSearchTexts.value[idx] = `${prod.name || ''}${prod.sku ? ' • ' + prod.sku : ''}`
  productOptionsByIdx.value[idx] = []
}

const formatStatus = (s) => (s || '').replace(/_/g, ' ')
const getStatusBadge = (s) => {
  const map = {
    for_inspection: 'bg-yellow-100 text-yellow-700',
    under_repair: 'bg-blue-100 text-blue-700',
    pending_replacement: 'bg-orange-100 text-orange-700',
    repaired: 'bg-green-100 text-green-700',
    for_disposal: 'bg-gray-200 text-gray-700'
  }
  return `inline-block px-2 py-1 rounded text-xs font-medium ${map[s] || 'bg-gray-100 text-gray-700'}`
}

const fetchLog = async () => {
  loading.value = true
  error.value = ''
  try {
    const id = String(route.params.id)
    const res = await fetch(`${apiBase}/maintenance/logs/${id}`, {
      headers: { Authorization: `Bearer ${auth.token}` }
    })
    const data = await res.json()
    if (!data.success) throw new Error(data.message || 'Failed to fetch log')
    log.value = data.log
    // Fetch linked statuses once log is loaded
    await fetchLinkedStatuses()
  } catch (e) {
    error.value = e.message || String(e)
  } finally {
    loading.value = false
  }
}

const submitAction = async () => {
  if (!actionForm.value.result || (!actionForm.value.consultFindings && !actionForm.value.actionTaken)) {
    error.value = 'Please provide findings/action and select a result.'
    return
  }
  savingAction.value = true
  try {
    const id = String(route.params.id)
    const res = await fetch(`${apiBase}/maintenance/logs/${id}/actions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${auth.token}` },
      body: JSON.stringify(actionForm.value)
    })
    const data = await res.json()
    if (!data.success) throw new Error(data.message || 'Failed to add action')
    await fetchLog()
    actionForm.value = { consultFindings: '', actionTaken: '', result: '' }
  } catch (e) {
    error.value = e.message || String(e)
  } finally {
    savingAction.value = false
  }
}

const submitStatusUpdate = async () => {
  if (!updateStatus.value) {
    error.value = 'Please select a status to update.'
    return
  }
  savingStatus.value = true
  try {
    const id = String(route.params.id)
    const payload = { status: updateStatus.value }
    if ((updateStatus.value === 'ready_to_claim' || updateStatus.value === 'repaired') && repairDate.value) {
      payload.repairDetails = { dateRepaired: repairDate.value }
    }
    const res = await fetch(`${apiBase}/maintenance/logs/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${auth.token}` },
      body: JSON.stringify(payload)
    })
    const data = await res.json()
    if (!data.success) throw new Error(data.message || 'Failed to update status')
    await fetchLog()
  } catch (e) {
    error.value = e.message || String(e)
  } finally {
    savingStatus.value = false
  }
}

const addPart = () => {
  replacementParts.value.push({ product: '', requestedQty: 1, remarks: '' })
}

const removePart = (idx) => {
  if (idx >= 0) {
    replacementParts.value.splice(idx, 1)
  }
}

const submitReplacement = async () => {
  const parts = replacementParts.value
  if (!parts.length) {
    error.value = 'Please add at least one replacement part.'
    return
  }
  for (const p of parts) {
    if (Number(p.requestedQty) < 1) {
      error.value = 'Each part must have quantity >= 1.'
      return
    }
  }
  savingReplacement.value = true
  try {
    const id = String(route.params.id)
    const res = await fetch(`${apiBase}/maintenance/logs/${id}/replacement`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${auth.token}` },
      body: JSON.stringify({ replacementParts: parts })
    })
    const data = await res.json()
    if (!data.success) throw new Error(data.message || 'Failed to set replacement')
    await fetchLog()
  } catch (e) {
    error.value = e.message || String(e)
  } finally {
    savingReplacement.value = false
  }
}

// Claim handling
const claimDate = ref('')
const claimedBy = ref('')
const claimRemarks = ref('')
const claimSaving = ref(false)
const submitClaim = async () => {
  claimSaving.value = true
  try {
    const id = String(route.params.id)
    const payload = {
      dateClaimed: claimDate.value || undefined,
      claimedBy: claimedBy.value || undefined,
      remarks: claimRemarks.value || undefined
    }
    const res = await fetch(`${apiBase}/maintenance/logs/${id}/claimed`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${auth.token}` },
      body: JSON.stringify(payload)
    })
    const data = await res.json()
    if (!data.success) throw new Error(data.message || 'Failed to mark claimed')
    await fetchLog()
    claimDate.value = ''
    claimedBy.value = ''
    claimRemarks.value = ''
  } catch (e) {
    error.value = e.message || String(e)
  } finally {
    claimSaving.value = false
  }
}

// Search employees for requester assignment
const searchEmployees = async () => {
  const q = String(employeeSearch.value || '').trim()
  if (!q) {
    employeeOptions.value = []
    return
  }
  employeeLoading.value = true
  try {
    const url = `${apiBase}/employees?limit=10&search=${encodeURIComponent(q)}`
    const res = await fetch(url, { headers: { Authorization: `Bearer ${auth.token}` } })
    const data = await res.json()
    const list = data?.employees || []
    employeeOptions.value = Array.isArray(list) ? list : []
  } catch (e) {
    // Silent fail to avoid noisy UI
    employeeOptions.value = []
  } finally {
    employeeLoading.value = false
  }
}

const assignRequester = async (emp) => {
  if (!emp?._id) return
  assigningEmployee.value = true
  try {
    const id = String(route.params.id)
    const payload = {
      broughtBy: {
        employee: emp._id,
        name: `${emp.firstName || ''} ${emp.lastName || ''}`.trim()
      }
    }
    const res = await fetch(`${apiBase}/maintenance/logs/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${auth.token}` },
      body: JSON.stringify(payload)
    })
    const data = await res.json()
    if (!data.success) throw new Error(data.message || 'Failed to assign requester')
    await fetchLog()
    employeeSearch.value = ''
    employeeOptions.value = []
  } catch (e) {
    error.value = e.message || String(e)
  } finally {
    assigningEmployee.value = false
  }
}

// Fetch inventory and DR item statuses linked to the log
const fetchLinkedStatuses = async () => {
  try {
    const acn = String(log.value?.acn || '').trim()
    const serial = String(log.value?.serialNumber || '').trim()
    let url = `${apiBase}/inventory/records?limit=5`
    if (acn) url += `&acn=${encodeURIComponent(acn)}`
    else if (serial) url += `&serialNumber=${encodeURIComponent(serial)}`
    else {
      inventoryItemStatus.value = null
      drItemStatus.value = null
      return
    }

    const res = await fetch(url, { headers: { Authorization: `Bearer ${auth.token}` } })
    const data = await res.json()
    const records = data?.records || []
    const rec = Array.isArray(records) && records.length ? records[0] : null
    if (!rec) {
      inventoryItemStatus.value = null
      drItemStatus.value = null
      return
    }

    const norm = (s) => String(s || '').trim().toUpperCase()
    const item = (rec.items || []).find((it) => {
      if (acn) return norm(it?.acn) === norm(acn)
      if (serial) return String(it?.serialNumber || '') === serial
      return false
    })
    if (item) {
      inventoryItemStatus.value = {
        status: item.status,
        statusDate: item.statusDate,
        statusNotes: item.statusNotes
      }
    } else {
      inventoryItemStatus.value = null
    }

    if (rec?.sourceDR) {
      try {
        const drRes = await fetch(`${apiBase}/delivery-receipts/${rec.sourceDR}`, {
          headers: { Authorization: `Bearer ${auth.token}` }
        })
        const drData = await drRes.json()
        const dr = drData?.deliveryReceipt
        const drItemId = rec?.sourceDRItemId?.toString?.() || rec?.sourceDRItemId
        const drItem = (dr?.items || []).find((it) => String(it?._id) === String(drItemId))
        drItemStatus.value = dr
          ? {
              drNumber: dr.drNumber,
              deploymentStatus: drItem?.deploymentStatus || '—',
              drId: dr._id
            }
          : null
      } catch (err) {
        drItemStatus.value = null
      }
    } else {
      drItemStatus.value = null
    }
  } catch (err) {
    // Do not surface errors loudly; keep panel silent
    inventoryItemStatus.value = null
    drItemStatus.value = null
  }
}

onMounted(fetchLog)
watch(() => route.params.id, fetchLog)
</script>

<template>
  <div class="p-6">
    <!-- Header -->
    <div class="mb-6 flex items-center justify-between">
      <div>
        <h1 class="text-2xl font-bold text-black dark:text-white">Repair Log Details</h1>
        <p class="text-sm text-bodydark2 mt-1">View and manage repair log information</p>
      </div>
      <div class="flex gap-2">
        <router-link
          to="/maintenance/logs"
          class="rounded border border-stroke px-4 py-2 text-sm font-medium hover:bg-gray-50 dark:hover:bg-meta-4 transition"
        >
          ← Back to List
        </router-link>
        <button @click="fetchLog" class="rounded border border-primary bg-primary/10 text-primary px-4 py-2 text-sm font-medium hover:bg-primary/20 transition">Refresh</button>
      </div>
    </div>

    <div v-if="loading" class="animate-pulse">
      <div class="h-6 bg-gray-200 rounded w-40"></div>
    </div>
    <div v-if="error" class="mb-3 text-red-600 text-sm">{{ error }}</div>

    <div v-if="log" class="grid grid-cols-1 lg:grid-cols-3 gap-6">
      <div class="lg:col-span-2 space-y-6">
        <div class="rounded-sm border border-stroke bg-white shadow-default dark:border-strokedark dark:bg-boxdark p-4">
          <h2 class="font-semibold">Repair Log {{ log.logNumber }}</h2>
          <div class="mt-2 grid grid-cols-2 gap-2 text-sm">
            <div>
              <span class="font-medium">Status:</span>
              <span :class="getStatusBadge(log.status)" class="ml-1">{{ formatStatus(log.status) }}</span>
            </div>
            <div><span class="font-medium">ACN:</span> {{ log.acn || '—' }}</div>
            <div><span class="font-medium">Serial:</span> {{ log.serialNumber || '—' }}</div>
            <div>
              <span class="font-medium">Technician:</span> {{ log.technician?.name || '—' }}
            </div>
            <div><span class="font-medium">Requester:</span> {{ log.broughtBy?.name || '—' }}</div>
            <div>
              <span class="font-medium">RIS:</span>
              <span :class="log.risGenerated ? 'inline-block px-2 py-1 rounded text-xs font-medium bg-green-100 text-green-700' : 'inline-block px-2 py-1 rounded text-xs font-medium bg-gray-100 text-gray-700'" class="ml-1">{{ log.risGenerated ? 'Generated' : '—' }}</span>
              <router-link v-if="log.risId" :to="`/inventory/ris/${log.risId}`" class="ml-2 text-primary hover:underline">Open RIS</router-link>
            </div>
          </div>
        </div>

        <div class="rounded-sm border border-stroke bg-white shadow-default dark:border-strokedark dark:bg-boxdark p-4">
          <h3 class="font-semibold mb-2">Linked Status</h3>
          <div class="space-y-1 text-sm text-gray-700">
            <div>
              <span class="font-medium">Inventory Item:</span>
              <span v-if="inventoryItemStatus">
                {{ formatStatus(inventoryItemStatus.status) }}
                <span v-if="inventoryItemStatus.statusDate" class="text-gray-500">(
                  {{ new Date(inventoryItemStatus.statusDate).toLocaleDateString() }}
                )</span>
              </span>
              <span v-else>—</span>
            </div>
            <div>
              <span class="font-medium">DR Item:</span>
              <span v-if="drItemStatus">
                {{ drItemStatus.deploymentStatus || '—' }}
                <router-link v-if="drItemStatus.drId" :to="`/inventory/delivery-receipts/${drItemStatus.drId}`" class="ml-2 text-primary hover:underline">View DR {{ drItemStatus.drNumber }}</router-link>
              </span>
              <span v-else>—</span>
            </div>
            <div>
              <span class="font-medium">RIS Link:</span>
              <span v-if="log?.risId">
                <router-link :to="`/inventory/ris/${log.risId}`" class="text-primary hover:underline">Open RIS</router-link>
              </span>
              <span v-else>—</span>
            </div>
          </div>
        </div>

        <div class="rounded-sm border border-stroke bg-white shadow-default dark:border-strokedark dark:bg-boxdark p-4">
          <h3 class="font-semibold mb-2">Actions</h3>
          <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
            <textarea
              v-model="actionForm.consultFindings"
              class="border rounded p-2"
              placeholder="Consult Findings"
            ></textarea>
            <textarea
              v-model="actionForm.actionTaken"
              class="border rounded p-2"
              placeholder="Action Taken"
            ></textarea>
            <select v-model="actionForm.result" class="border rounded p-2">
              <option disabled value="">Select result</option>
              <option value="for_repair">For repair</option>
              <option value="for_replacement">For replacement</option>
              <option value="beyond_repair">Beyond repair</option>
            </select>
          </div>
          <button @click="submitAction" :disabled="savingAction" class="mt-3 px-3 py-2 rounded bg-primary text-white disabled:opacity-50 disabled:cursor-not-allowed flex items-center">
            <span v-if="savingAction" class="inline-block w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2"></span>
            <span>{{ savingAction ? 'Saving...' : 'Add Action' }}</span>
          </button>
        </div>

        <div class="rounded-sm border border-stroke bg-white shadow-default dark:border-strokedark dark:bg-boxdark p-4">
          <h3 class="font-semibold mb-2">Update Status</h3>
          <div class="grid grid-cols-1 md:grid-cols-3 gap-3">
            <select v-model="updateStatus" class="border rounded p-2">
              <option disabled value="">Select status</option>
              <option value="for_inspection">For inspection</option>
              <option value="under_repair">Under repair</option>
              <option value="ready_to_claim">Ready to claim</option>
              <option value="pending_replacement">Pending replacement</option>
              <option value="repaired">Repaired</option>
              <option value="for_disposal">For disposal</option>
            </select>
            <input
              v-if="updateStatus === 'ready_to_claim' || updateStatus === 'repaired'"
              v-model="repairDate"
              type="date"
              class="border rounded p-2"
            />
            <button @click="submitStatusUpdate" :disabled="savingStatus" class="px-3 py-2 rounded bg-primary text-white disabled:opacity-50 disabled:cursor-not-allowed flex items-center">
              <span v-if="savingStatus" class="inline-block w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2"></span>
              <span>{{ savingStatus ? 'Updating...' : 'Update' }}</span>
            </button>
          </div>
          <p v-if="updateStatus === 'ready_to_claim' || updateStatus === 'repaired'" class="text-xs text-gray-500 mt-2">Select the repair completion date.</p>
        </div>

        <div class="rounded-sm border border-stroke bg-white shadow-default dark:border-strokedark dark:bg-boxdark p-4">
          <h3 class="font-semibold mb-2">Requester</h3>
          <div class="grid grid-cols-1 md:grid-cols-3 gap-2 items-start">
            <input
              v-model="employeeSearch"
              @input="searchEmployees"
              class="border rounded p-2 md:col-span-2"
              placeholder="Search employee by name/email"
            />
            <button disabled v-if="employeeLoading" class="px-3 py-2 rounded border border-gray-300 text-gray-700">Searching...</button>
          </div>
          <ul v-if="employeeOptions.length" class="border rounded mt-2 max-h-40 overflow-auto divide-y">
            <li v-for="emp in employeeOptions" :key="emp._id" class="p-2 flex justify-between items-center">
              <span>
                {{ emp.firstName }} {{ emp.lastName }}
                <span class="text-xs text-gray-500">{{ emp.email }}</span>
              </span>
              <button @click="assignRequester(emp)" :disabled="assigningEmployee" class="px-2 py-1 border border-gray-300 text-gray-700 rounded text-xs hover:bg-gray-50">
                {{ assigningEmployee ? 'Assigning...' : 'Assign' }}
              </button>
            </li>
          </ul>
        </div>

        <div class="rounded-sm border border-stroke bg-white shadow-default dark:border-strokedark dark:bg-boxdark p-4">
          <h3 class="font-semibold mb-2">Replacement Parts</h3>
          <div class="space-y-2">
            <div v-for="(p, idx) in replacementParts" :key="idx" class="grid grid-cols-1 md:grid-cols-5 gap-2">
              <div>
                <select v-model="p.part" class="border rounded p-2 mb-1">
                  <option value="">Select part (optional)</option>
                  <option value="Motherboard">Motherboard</option>
                  <option value="CPU">Processor (CPU)</option>
                  <option value="RAM">RAM</option>
                  <option value="HDD">HDD</option>
                  <option value="SSD">SSD</option>
                  <option value="PSU">Power Supply Unit (PSU)</option>
                  <option value="GPU">Graphics Card (GPU)</option>
                  <option value="Monitor">Monitor</option>
                  <option value="Keyboard">Keyboard</option>
                  <option value="Mouse">Mouse</option>
                  <option value="Fan">Cooling Fan</option>
                  <option value="Other">Other</option>
                </select>
                <input v-model="p.product" class="border rounded p-2 mb-1" placeholder="Product ID" />
                <input
                  v-model="productSearchTexts[idx]"
                  @input="searchProductsForRow(idx)"
                  class="border rounded p-2"
                  placeholder="Search product by name/SKU"
                />
                <div v-if="productLoadingByIdx[idx]" class="text-xs text-gray-500 mt-1">Searching...</div>
                <ul v-if="(productOptionsByIdx[idx] || []).length" class="border rounded mt-1 max-h-36 overflow-auto divide-y">
                  <li
                    v-for="opt in productOptionsByIdx[idx]"
                    :key="opt._id"
                    class="p-2 flex justify-between items-center hover:bg-gray-50"
                  >
                    <span>{{ opt.name }} <span class="text-xs text-gray-500">{{ opt.sku }}</span></span>
                    <button class="text-xs px-2 py-1 border border-gray-300 text-gray-700 rounded hover:bg-gray-50" @click="selectProductForPart(idx, opt)">Select</button>
                  </li>
                </ul>
              </div>
              <input
                v-model.number="p.requestedQty"
                type="number"
                min="1"
                class="border rounded p-2"
                placeholder="Qty"
              />
              <input v-model="p.remarks" class="border rounded p-2" placeholder="Remarks" />
              <button @click="removePart(idx)" :disabled="savingReplacement" class="px-3 py-2 rounded border border-gray-300 text-gray-700 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50">Remove</button>
            </div>
            <div class="flex items-center gap-2 mt-2">
              <button @click="addPart" :disabled="savingReplacement" class="px-3 py-2 rounded border border-gray-300 text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed">Add Part</button>
              <button @click="submitReplacement" :disabled="savingReplacement" class="px-3 py-2 rounded bg-primary text-white disabled:opacity-50 disabled:cursor-not-allowed flex items-center">
                <span v-if="savingReplacement" class="inline-block w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2"></span>
                Set Replacement & Generate RIS
              </button>
            </div>
          </div>
        </div>

        <div class="rounded-sm border border-stroke bg-white shadow-default dark:border-strokedark dark:bg-boxdark p-4">
          <h3 class="font-semibold mb-2">Claim Unit</h3>
          <div class="grid grid-cols-1 md:grid-cols-3 gap-3">
            <input v-model="claimDate" type="date" class="border rounded p-2" placeholder="Date Claimed" />
            <input v-model="claimedBy" class="border rounded p-2" placeholder="Claimed By" />
            <input v-model="claimRemarks" class="border rounded p-2" placeholder="Remarks (optional)" />
          </div>
          <button @click="submitClaim" :disabled="claimSaving" class="mt-3 px-3 py-2 rounded bg-primary text-white disabled:opacity-50 disabled:cursor-not-allowed flex items-center">
            <span v-if="claimSaving" class="inline-block w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2"></span>
            <span>{{ claimSaving ? 'Saving...' : 'Mark as Claimed' }}</span>
          </button>
        </div>
      </div>

      <div>
        <div class="rounded-sm border border-stroke bg-white shadow-default dark:border-strokedark dark:bg-boxdark p-4">
          <h3 class="font-semibold mb-2">Attachments</h3>
          <ul class="list-disc ml-5">
            <li v-for="(a, i) in log.attachments || []" :key="i">
              <a :href="a?.url || a" target="_blank" class="text-primary hover:underline">{{ a?.url || a }}</a>
            </li>
          </ul>
        </div>
        <div class="rounded-sm border border-stroke bg-white shadow-default dark:border-strokedark dark:bg-boxdark p-4 mt-4">
          <h3 class="font-semibold mb-2">Action History</h3>
          <ul class="space-y-2">
            <li v-for="(a, i) in log.actions || []" :key="i" class="border rounded p-2">
              <div class="text-sm text-gray-600">
                {{ new Date(a.dateUpdated).toLocaleString() }}
              </div>
              <div><span class="font-medium">Result:</span> {{ a.result || '—' }}</div>
              <div><span class="font-medium">Findings:</span> {{ a.consultFindings || '—' }}</div>
              <div><span class="font-medium">Action:</span> {{ a.actionTaken || '—' }}</div>
              <div><span class="font-medium">Updated by:</span> {{ a.updatedBy?.name || '—' }}</div>
            </li>
          </ul>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.bg-primary {
  background-color: #1a56db;
}
.text-primary {
  color: #1a56db;
}
</style>
