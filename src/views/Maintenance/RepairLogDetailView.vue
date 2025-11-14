<script setup>
import { onMounted, ref, watch, computed } from 'vue'
import { useRoute } from 'vue-router'
import { useAuthStore } from '@/stores'
import axios from '@/utils/axios'
import DefaultLayout from '@/layouts/DefaultLayout.vue'

const route = useRoute()
const auth = useAuthStore()
const apiBase = import.meta.env.VITE_API_URL || 'http://localhost:5001/api'

const log = ref(null)
const loading = ref(false)
const error = ref('')

const inventoryItemStatus = ref(null)
const drItemStatus = ref(null)
// Linked item details for spec-based part suggestions
const linkedItemSpecs = ref(null)
const linkedCategoryName = ref('')

// Removed unused product search helpers

const formatStatus = (s) => (s || '').replace(/_/g, ' ')
const getStatusBadge = (s) => {
  const map = {
    for_inspection: 'bg-yellow-100 text-yellow-700',
    under_repair: 'bg-blue-100 text-blue-700',
    pending_replacement: 'bg-orange-100 text-orange-700',
    repaired: 'bg-green-100 text-green-700',
    for_disposal: 'bg-gray-200 text-gray-700'
  }
  return `inline-block px-2 py-1 rounded text-xs font-medium ${
    map[s] || 'bg-gray-100 text-gray-700'
  }`
}

// ACN-linked detail refs
const acnRecord = ref(null)
const acnItem = ref(null)
const acnIsSecondary = ref(false)
const repairCount = ref(0)
const acnHistoryActions = ref([])
const loadingAcnHistory = ref(false)
const acnHistoryError = ref('')

const fetchProductName = async (pid) => {
  try {
    if (!pid) return ''
    const id = typeof pid === 'string' ? pid : String(pid?._id || '')
    if (!id) return ''
    const { data } = await axios.get(`/products/${id}`)
    return data?.product?.name || ''
  } catch (_) {
    return ''
  }
}

const descText = computed(() => {
  if (acnIsSecondary.value) {
    const sec = acnItem.value?._selectedSecondary || {}
    const pname = sec.productName || ''
    if (pname) return pname
    const name = sec.item || ''
    if (name) return name
    const t = sec.type || ''
    const pn = sec.propertyNumber ? ` • ${sec.propertyNumber}` : ''
    return `${t}${pn}`.trim()
  }
  return acnItem.value?.productName || acnItem.value?.name || acnItem.value?.description || ''
})

const primaryDescText = computed(() => {
  return acnItem.value?.productName || acnItem.value?.name || acnItem.value?.description || ''
})

const secondaryDescText = computed(() => {
  const sec = acnItem.value?._selectedSecondary || {}
  const pname = sec.productName || ''
  if (pname) return pname
  const name = sec.item || ''
  if (name) return name
  const t = sec.type || ''
  const pn = sec.propertyNumber ? ` • ${sec.propertyNumber}` : ''
  return `${t}${pn}`.trim()
})

const hasAnySpecs = computed(() => {
  const sec = acnItem.value?._selectedSecondary || null
  const s1 = sec?.specs
  const s2 = acnItem.value?.specs
  try {
    if (s1 && Object.keys(s1 || {}).length) return true
    if (s2 && Object.keys(s2 || {}).length) return true
    if (linkedItemSpecs.value && Object.keys(linkedItemSpecs.value || {}).length) return true
    return false
  } catch (_) {
    return !!(s1 || s2 || linkedItemSpecs.value)
  }
})

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
    await fetchRepairCount()
    await fetchAcnHistory()
  } catch (e) {
    error.value = e.message || String(e)
  } finally {
    loading.value = false
  }
}

// Removed unused submitAction

// Removed unused submitStatusUpdate

// Removed unused replacement parts handlers

// Removed unused claim handling

// Removed unused requester assignment

// Fetch inventory and DR item statuses linked to the log
const fetchLinkedStatuses = async () => {
  try {
    const acn = String(log.value?.acn || '').trim()
    const serial = String(log.value?.serialNumber || '').trim()
    const params = { limit: 5 }
    if (acn) params.acn = acn
    else if (serial) params.serialNumber = serial
    else {
      inventoryItemStatus.value = null
      drItemStatus.value = null
      acnRecord.value = null
      acnItem.value = null
      acnIsSecondary.value = false
      return
    }

    // First attempt: query with direct params (acn or serial)
    let { data } = await axios.get('/inventory-records', { params })
    let records = data?.records || []
    let rec = Array.isArray(records) && records.length ? records[0] : null

    // Fallback: if searching by ACN did not return a record, broaden the search
    if (!rec && acn) {
      const fbParams = { status: 'deployed', limit: 25, page: 1 }
      const fbRes = await axios.get('/inventory-records', { params: fbParams })
      const fbRecords = fbRes?.data?.records || []
      // Find any record whose item's secondaryItems contain this ACN
      rec =
        fbRecords.find((r) =>
          (r.items || []).some(
            (it) =>
              Array.isArray(it.secondaryItems) &&
              it.secondaryItems.some(
                (s) => String(s?.acn || '').toUpperCase() === acn.toUpperCase()
              )
          )
        ) || null
    }

    if (!rec) {
      inventoryItemStatus.value = null
      drItemStatus.value = null
      acnRecord.value = null
      acnItem.value = null
      acnIsSecondary.value = false
      return
    }

    acnRecord.value = rec

    const norm = (s) =>
      String(s || '')
        .trim()
        .toUpperCase()
    let item = (rec.items || []).find((it) => {
      if (acn) return norm(it?.acn) === norm(acn)
      if (serial) return String(it?.serialNumber || '') === serial
      return false
    })
    let isSecondary = false
    if (!item && acn) {
      const parent = (rec.items || []).find(
        (it) =>
          Array.isArray(it.secondaryItems) &&
          it.secondaryItems.some((s) => norm(s?.acn) === norm(acn))
      )
      if (parent) {
        const sec = parent.secondaryItems.find((s) => norm(s?.acn) === norm(acn))
        item = { ...parent, _selectedSecondary: sec }
        isSecondary = true
      }
    }
    if (!item && serial) {
      const parentBySerial = (rec.items || []).find(
        (it) =>
          Array.isArray(it.secondaryItems) &&
          it.secondaryItems.some((s) => String(s?.serialNumber || '') === serial)
      )
      if (parentBySerial) {
        const sec = parentBySerial.secondaryItems.find(
          (s) => String(s?.serialNumber || '') === serial
        )
        item = { ...parentBySerial, _selectedSecondary: sec }
        isSecondary = true
      }
    }

    if (item) {
      inventoryItemStatus.value = {
        status: item.status,
        statusDate: item.statusDate,
        statusNotes: item.statusNotes
      }
      const sec = item._selectedSecondary
      linkedItemSpecs.value = sec && sec.specs ? sec.specs : item.specs || null
      linkedCategoryName.value = rec?.product?.category?.name || ''
      acnItem.value = item
      acnIsSecondary.value = isSecondary
      try {
        if (isSecondary && sec) {
          const pid = sec.productId || sec.product || ''
          const pname = typeof pid === 'string' ? await fetchProductName(pid) : pid?.name || ''
          if (pname) acnItem.value._selectedSecondary = { ...sec, productName: pname }
        } else {
          const pid = item.product
          const pname = typeof pid === 'string' ? await fetchProductName(pid) : pid?.name || ''
          if (pname) acnItem.value = { ...item, productName: pname }
        }
      } catch (_) {
        console.log(_)
      }
    } else {
      inventoryItemStatus.value = null
      linkedItemSpecs.value = null
      linkedCategoryName.value = ''
      acnItem.value = null
      acnIsSecondary.value = false
    }

    if (rec?.sourceDR) {
      try {
        const { data: drData } = await axios.get(`/delivery-receipts/${rec.sourceDR}`)
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
    inventoryItemStatus.value = null
    drItemStatus.value = null
    acnRecord.value = null
    acnItem.value = null
    acnIsSecondary.value = false
  }
}

onMounted(fetchLog)
watch(() => route.params.id, fetchLog)

const fetchRepairCount = async () => {
  try {
    const acn = String(log.value?.acn || '').trim()
    const serial = String(log.value?.serialNumber || '').trim()
    if (!acn && !serial) {
      repairCount.value = 0
      return
    }
    const url = new URL(`${apiBase}/maintenance/logs`)
    url.searchParams.set('status', 'repaired')
    if (acn) url.searchParams.set('acn', acn)
    else url.searchParams.set('serialNumber', serial)
    const res = await fetch(url.toString(), {
      headers: { Authorization: `Bearer ${auth.token}` }
    })
    const data = await res.json()
    const arr = Array.isArray(data?.logs) ? data.logs : []
    repairCount.value = arr.length
  } catch (_) {
    repairCount.value = 0
  }
}

const fetchAcnHistory = async () => {
  try {
    loadingAcnHistory.value = true
    acnHistoryError.value = ''
    acnHistoryActions.value = []
    const acn = String(log.value?.acn || '').trim()
    const serial = String(log.value?.serialNumber || '').trim()
    if (!acn && !serial) {
      loadingAcnHistory.value = false
      return
    }
    const url = new URL(`${apiBase}/maintenance/logs`)
    if (acn) url.searchParams.set('acn', acn)
    else url.searchParams.set('serialNumber', serial)
    url.searchParams.set('limit', '50')
    const res = await fetch(url.toString(), {
      headers: { Authorization: `Bearer ${auth.token}` }
    })
    const data = await res.json()
    const list = Array.isArray(data?.logs) ? data.logs : []
    const others = list.filter((l) => String(l._id) !== String(route.params.id))
    const details = [log.value]
    for (const item of others) {
      try {
        const r = await fetch(`${apiBase}/maintenance/logs/${item._id}`, {
          headers: { Authorization: `Bearer ${auth.token}` }
        })
        const d = await r.json()
        if (d?.success && d?.log) details.push(d.log)
      } catch (_) {
        acnHistoryError.value = ''
      }
    }
    const timeline = []
    for (const dlog of details) {
      const actions = Array.isArray(dlog.actions) ? dlog.actions : []
      let hasClaimEntry = false
      let hasDisposalEntry = false
      for (const a of actions) {
        const entry = {
          date: a.dateUpdated || dlog.updatedAt || dlog.createdAt,
          logNumber: dlog.logNumber,
          result: a.result,
          consultFindings: a.consultFindings,
          actionTaken: a.actionTaken,
          updatedBy: a.updatedBy,
          claimDetails: a.claimDetails,
          replacementParts: Array.isArray(dlog.replacementParts) ? dlog.replacementParts : []
        }
        if (entry.claimDetails) hasClaimEntry = true
        if (entry.result === 'beyond_repair' || entry.result === 'for_disposal')
          hasDisposalEntry = true
        timeline.push(entry)
      }

      if (String(dlog.status) === 'claimed' && !hasClaimEntry) {
        const cd = dlog.claimDetails ||
          dlog.claim || {
            dateClaimed: dlog.dateClaimed,
            claimedBy: dlog.claimedBy,
            remarks: dlog.claimRemarks
          }
        if (cd && (cd.dateClaimed || cd.claimedBy || cd.remarks)) {
          timeline.push({
            date: cd.dateClaimed || dlog.updatedAt || dlog.createdAt,
            logNumber: dlog.logNumber,
            result: 'claimed',
            consultFindings: '',
            actionTaken: '',
            updatedBy: null,
            claimDetails: cd,
            replacementParts: []
          })
        }
      }

      if (String(dlog.status) === 'for_disposal' && !hasDisposalEntry) {
        timeline.push({
          date: dlog.updatedAt || dlog.createdAt,
          logNumber: dlog.logNumber,
          result: 'for_disposal',
          consultFindings: '',
          actionTaken: '',
          updatedBy: null,
          claimDetails: null,
          replacementParts: []
        })
      }
    }
    timeline.sort((x, y) => new Date(x.date).getTime() - new Date(y.date).getTime())
    acnHistoryActions.value = timeline
  } catch (e) {
    acnHistoryError.value = e.message || String(e)
  } finally {
    loadingAcnHistory.value = false
  }
}
</script>

<template>
  <DefaultLayout>
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
          <button
            @click="fetchLog"
            class="rounded border border-primary bg-primary/10 text-primary px-4 py-2 text-sm font-medium hover:bg-primary/20 transition"
          >
            Refresh
          </button>
        </div>
      </div>

      <div v-if="loading" class="animate-pulse">
        <div class="h-6 bg-gray-200 rounded w-40"></div>
      </div>
      <div v-if="error" class="mb-3 text-red-600 text-sm">{{ error }}</div>

      <div v-if="log" class="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div class="lg:col-span-2 space-y-6">
          <div
            class="rounded-sm border border-stroke bg-white shadow-default dark:border-strokedark dark:bg-boxdark p-4"
          >
            <h2 class="font-semibold">Repair Log {{ log.logNumber }}</h2>
            <div class="mt-2 grid grid-cols-2 gap-2 text-sm">
              <div>
                <span class="font-medium">Status:</span>
                <span :class="getStatusBadge(log.status)" class="ml-1">{{
                  formatStatus(log.status)
                }}</span>
              </div>
              <div><span class="font-medium">ACN:</span> {{ log.acn || '—' }}</div>
              <div><span class="font-medium">Repairs:</span> {{ repairCount }}</div>
              <div v-if="!acnIsSecondary">
                <span class="font-medium">Item:</span> {{ descText || '—' }}
              </div>
              <div v-else>
                <span class="font-medium">Primary:</span> {{ primaryDescText || '—' }}
              </div>
              <div v-if="acnIsSecondary">
                <span class="font-medium">Secondary:</span> {{ secondaryDescText || '—' }}
              </div>
              <div>
                <span class="font-medium">End User:</span> {{ acnItem?.endUserOrMR || '—' }}
              </div>
              <div>
                <span class="font-medium">Department:</span>
                {{ acnRecord?.department?.name || acnRecord?.department || '—' }}
              </div>
              <div>
                <span class="font-medium">Serial:</span>
                {{
                  log?.serialNumber ||
                  acnItem?._selectedSecondary?.serialNumber ||
                  acnItem?.serialNumber ||
                  '—'
                }}
              </div>
              <div>
                <span class="font-medium">Brought by:</span> {{ log.broughtBy?.name || '—' }}
              </div>
              <div><span class="font-medium">Specs:</span> {{ hasAnySpecs ? 'Yes' : '—' }}</div>
            </div>
          </div>
          <div
            class="rounded-sm border border-stroke bg-white shadow-default dark:border-strokedark dark:bg-boxdark p-4 mt-4"
          >
            <h3 class="font-semibold mb-2">Action History</h3>
            <ul class="space-y-2">
              <li v-for="(a, i) in log.actions || []" :key="i" class="border rounded p-2">
                <div class="text-sm text-gray-600">
                  {{ new Date(a.dateUpdated || a.updatedAt || a.createdAt).toLocaleString() }}
                </div>
                <div><span class="font-medium">Result:</span> {{ a.claimDetails ? 'claimed' : (a.result || '—') }}</div>
                <div><span class="font-medium">Findings:</span> {{ a.consultFindings || '—' }}</div>
                <div><span class="font-medium">Action:</span> {{ a.actionTaken || '—' }}</div>
                <div>
                  <span class="font-medium">Updated by:</span> {{ a.updatedBy?.name || '—' }}
                </div>
              </li>
            </ul>
          </div>

          <div
            class="rounded-sm border border-stroke bg-white shadow-default dark:border-strokedark dark:bg-boxdark p-4"
          >
            <h3 class="font-semibold mb-2">ACN Repair History</h3>
            <div v-if="loadingAcnHistory" class="text-sm text-gray-600">Loading history...</div>
            <div v-else-if="acnHistoryError" class="text-sm text-danger">{{ acnHistoryError }}</div>
            <ul v-else class="space-y-2">
              <li v-for="(h, idx) in acnHistoryActions" :key="idx" class="border rounded p-2">
                <div class="flex justify-between items-center">
                  <div class="text-sm text-gray-600">{{ new Date(h.date).toLocaleString() }}</div>
                  <div class="text-xs text-bodydark2">Log {{ h.logNumber }}</div>
                </div>
                <div><span class="font-medium">Result:</span> {{ h.claimDetails ? 'claimed' : (h.result || '—') }}</div>
                <div v-if="h.consultFindings">
                  <span class="font-medium">Findings:</span> {{ h.consultFindings }}
                </div>
                <div v-if="h.actionTaken">
                  <span class="font-medium">Action:</span> {{ h.actionTaken }}
                </div>
                <div v-if="h.updatedBy">
                  <span class="font-medium">Updated by:</span> {{ h.updatedBy?.name || '—' }}
                </div>
                <div v-if="h.claimDetails" class="mt-1 text-sm">
                  <div>
                    <span class="font-medium">Claimed Date:</span>
                    {{ h.claimDetails?.dateClaimed || '—' }}
                  </div>
                  <div>
                    <span class="font-medium">Claimed By:</span>
                    {{ h.claimDetails?.claimedBy || '—' }}
                  </div>
                  <div v-if="h.claimDetails?.remarks">
                    <span class="font-medium">Remarks:</span> {{ h.claimDetails?.remarks }}
                  </div>
                </div>
                <div
                  v-if="Array.isArray(h.replacementParts) && h.replacementParts.length"
                  class="mt-1 text-sm"
                >
                  <div class="font-medium">Replacement Parts</div>
                  <div class="text-xs text-bodydark2">
                    <span v-for="(rp, i) in h.replacementParts" :key="i" class="inline-block mr-2">
                      {{ rp.part }} x{{ rp.quantity }}
                    </span>
                  </div>
                </div>
              </li>
              <!-- <li v-if="acnHistoryActions.length === 0" class="text-sm text-bodydark2">
                No history found
              </li> -->
            </ul>
          </div>
          <div
            class="rounded-sm border border-stroke bg-white shadow-default dark:border-strokedark dark:bg-boxdark p-4"
          >
            <h3 class="font-semibold mb-2">Linked Status</h3>
            <div class="space-y-1 text-sm text-gray-700">
              <div>
                <span class="font-medium">Inventory Item:</span>
                <span v-if="inventoryItemStatus">
                  {{ formatStatus(inventoryItemStatus.status) }}
                  <span v-if="inventoryItemStatus.statusDate" class="text-gray-500"
                    >(
                    {{ new Date(inventoryItemStatus.statusDate).toLocaleDateString() }}
                    )</span
                  >
                </span>
                <span v-else>—</span>
              </div>
              <div>
                <span class="font-medium">DR Item:</span>
                <span v-if="drItemStatus">
                  {{ drItemStatus.deploymentStatus || '—' }}
                  <router-link
                    v-if="drItemStatus.drId"
                    :to="`/inventory/delivery-receipts/${drItemStatus.drId}`"
                    class="ml-2 text-primary hover:underline"
                    >View DR {{ drItemStatus.drNumber }}</router-link
                  >
                </span>
                <span v-else>—</span>
              </div>
              <div>
                <span class="font-medium">RIS Link:</span>
                <span v-if="log?.risId">
                  <router-link
                    :to="`/inventory/ris/${log.risId}`"
                    class="text-primary hover:underline"
                    >Open RIS</router-link
                  >
                </span>
                <span v-else>—</span>
              </div>
            </div>
          </div>

          <div
            v-if="log.status === 'for_disposal'"
            class="rounded-sm border border-stroke bg-white shadow-default dark:border-strokedark dark:bg-boxdark p-4"
          >
            <h3 class="font-semibold mb-2">Disposal</h3>
            <p class="text-sm text-gray-700">
              This unit is marked <span class="font-medium">for disposal</span>. Proceed to create a
              disposal record.
            </p>
            <router-link
              to="/disposal/create"
              class="mt-2 inline-block rounded bg-primary text-white px-4 py-2 text-sm font-medium hover:bg-opacity-90 transition"
              >Go to Disposal</router-link
            >
          </div>
        </div>

        <div></div>
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
