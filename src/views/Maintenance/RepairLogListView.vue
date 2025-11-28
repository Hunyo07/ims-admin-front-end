<script setup>
import { onMounted, ref, computed } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '@/stores'
import DefaultLayout from '@/layouts/DefaultLayout.vue'
import axios from '@/utils/axios'
import EmployeeCombobox from '@/components/EmployeeCombobox.vue'
import AcnRepairCombobox from '@/components/AcnRepairCombobox.vue'
import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'

const auth = useAuthStore()
const router = useRouter()
const apiBase = import.meta.env.VITE_API_URL || 'http://localhost:5001/api'
const loading = ref(false)
const error = ref('')
const logs = ref([])
const search = ref('')
const statusFilter = ref('')
const fromDate = ref(null)
const toDate = ref(null)
const toastMessage = ref('')
const toastType = ref('info')
const copyingId = ref('')
const page = ref(1)
const activeTab = ref('inside')
const pageInside = ref(1)
const pageOutside = ref(1)
const pageSize = ref(10)
const sortKey = ref('date')
const sortDir = ref('desc')

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
  claimedTime: `${String(new Date().getHours()).padStart(2, '0')}:${String(
    new Date().getMinutes()
  ).padStart(2, '0')}`,
  claimedBy: '',
  remarks: ''
})
const savingClaim = ref(false)
// UI helper: map backend status to display label
const latestActionIsRetrieve = (l) => {
  const acts = Array.isArray(l?.actions) ? l.actions : []
  if (!acts.length) return false
  const last = acts[acts.length - 1] || {}
  const res = String(last.result || '')
  const at = String(last.actionTaken || '').toLowerCase()
  const cf = String(last.consultFindings || '').toLowerCase()
  return res === 'beyond_repair' && (at.includes('retrieve') || cf.includes('retrieve'))
}
const statusLabel = (s, l) => {
  if (latestActionIsRetrieve(l)) return 'Retrieved'
  if (s === 'repaired' || s === 'claimed') return 'Claimed'
  if (s === 'disposed') return 'Disposed'
  return s
}

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

// removed: navigation to Replacement RIS from Repair module per user request

const openClaim = async (log) => {
  selectedLog.value = log
  showClaimModal.value = true
  claimForm.value = {
    dateClaimed: new Date().toISOString().slice(0, 10),
    claimedTime: `${String(new Date().getHours()).padStart(2, '0')}:${String(
      new Date().getMinutes()
    ).padStart(2, '0')}`,
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
    const cbRaw = claimForm.value.claimedBy
    const claimedByStr =
      typeof cbRaw === 'string'
        ? cbRaw
        : `${cbRaw?.firstName || ''} ${cbRaw?.lastName || ''}`.trim() || cbRaw?.name || ''
    const time =
      claimForm.value.claimedTime ||
      `${String(new Date().getHours()).padStart(2, '0')}:${String(new Date().getMinutes()).padStart(
        2,
        '0'
      )}`
    const dateTimeStr = `${claimForm.value.dateClaimed}T${time}:00`
    const res = await fetch(`${apiBase}/maintenance/logs/${selectedLog.value._id}/claimed`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${auth.token}` },
      body: JSON.stringify({
        dateClaimed: dateTimeStr,
        claimedBy: claimedByStr,
        remarks: claimForm.value.remarks,
        claimedAt: new Date(dateTimeStr).toISOString()
      })
    })
    const data = await res.json()
    if (!data.success) throw new Error(data.message || 'Failed to mark claimed')

    const actRes = await fetch(`${apiBase}/maintenance/logs/${selectedLog.value._id}/actions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${auth.token}` },
      body: JSON.stringify({
        consultFindings: '',
        actionTaken: '',
        result: 'repaired',
        repairedStatus: 'claim_now',
        claimDetails: {
          dateClaimed: dateTimeStr,
          claimedBy: claimedByStr,
          remarks: claimForm.value.remarks,
          claimedAt: new Date(dateTimeStr).toISOString()
        },
        replacementParts: []
      })
    })
    const actData = await actRes.json()
    if (!actData.success) throw new Error(actData.message || 'Failed to record claim action')

    // Update inventory item to mark repair as completed
    try {
      if (selectedLog.value?.itemId && selectedLog.value?.inventoryRecordId) {
        const inventoryPayload = {
          // Keep deployment status as deployed
          status: 'deployed',
          // Mark repair status as completed
          repairStatus: 'completed',
          // Update status notes
          statusNotes: `Repair completed - Claimed ${dateTimeStr}`,
          statusDate: new Date().toISOString()
        }

        // Update inventory item
        await axios.patch(
          `/inventory-records/${selectedLog.value.inventoryRecordId}/items/${selectedLog.value.itemId}`,
          inventoryPayload
        )

        console.log('✅ Updated inventory item - repair completed:', {
          deploymentStatus: inventoryPayload.status,
          repairStatus: inventoryPayload.repairStatus,
          statusNotes: inventoryPayload.statusNotes
        })
      }
    } catch (inventoryUpdateError) {
      console.warn('⚠️ Could not update inventory item status on claim:', inventoryUpdateError)
      // Don't fail the whole operation if inventory update fails
    }

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
  if (consultForm.value.result === 'retrieve') {
    consultForm.value.result = 'beyond_repair'
    if (
      !String(consultForm.value.actionTaken || '')
        .toLowerCase()
        .includes('retrieve')
    ) {
      consultForm.value.actionTaken = 'Retrieve'
    }
  }
  if (consultForm.value.result === 'repaired' && consultForm.value.repairedStatus === 'claim_now') {
    consultForm.value.claimDetails = {
      ...(consultForm.value.claimDetails || {}),
      claimedAt: new Date().toISOString()
    }
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

    // 3) Update inventory item with proper status separation
    try {
      if (selectedLog.value?.itemId && selectedLog.value?.inventoryRecordId) {
        let inventoryPayload

        if (consultForm.value.result === 'repaired') {
          // Item is repaired
          inventoryPayload = {
            status: 'deployed', // Keep deployed
            repairStatus:
              consultForm.value.repairedStatus === 'claim_now' ? 'completed' : 'ready_to_claim',
            statusNotes: `Repair completed - ${consultForm.value.repairedStatus}`,
            statusDate: new Date().toISOString()
          }
        } else if (consultForm.value.result === 'beyond_repair') {
          // Item is beyond repair
          inventoryPayload = {
            status: 'for_disposal', // Change deployment status
            repairStatus: 'beyond_repair',
            statusNotes: 'Beyond repair - for disposal',
            statusDate: new Date().toISOString()
          }
        } else if (consultForm.value.result === 'for_replacement') {
          // Item needs replacement
          inventoryPayload = {
            status: 'deployed', // Keep deployed while waiting for replacement
            repairStatus: 'for_replacement',
            statusNotes: 'Replacement parts ordered',
            statusDate: new Date().toISOString()
          }
        }

        if (inventoryPayload) {
          await axios.patch(
            `/inventory-records/${selectedLog.value.inventoryRecordId}/items/${selectedLog.value.itemId}`,
            inventoryPayload
          )

          console.log('✅ Updated inventory item - consult result:', {
            result: consultForm.value.result,
            deploymentStatus: inventoryPayload.status,
            repairStatus: inventoryPayload.repairStatus,
            statusNotes: inventoryPayload.statusNotes
          })
        }
      }
    } catch (inventoryUpdateError) {
      console.warn('⚠️ Could not update inventory item status on consult:', inventoryUpdateError)
      // Don't fail the whole operation if inventory update fails
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

const goToDisposalForLog = async (log) => {
  if (!log) return
  let acn = log?.acn || ''
  let serial = log?.serialNumber || ''
  let description = log?.description || ''
  let inventoryRecordId = log?.inventoryRecordId?._id || log?.inventoryRecordId || ''
  let itemId = log?.itemId?._id || log?.itemId || ''
  try {
    if (!inventoryRecordId || !itemId || !description || !serial || !acn) {
      const { data } = await axios.get(`/maintenance/logs/${log._id}`)
      const l = data?.log || {}
      acn = acn || l?.acn || ''
      serial = serial || l?.serialNumber || ''
      description = description || l?.description || ''
      inventoryRecordId =
        inventoryRecordId || l?.inventoryRecordId?._id || l?.inventoryRecordId || ''
      itemId = itemId || l?.itemId?._id || l?.itemId || ''
    }
  } catch (_) {
    void 0
  }
  router.push({
    name: 'disposal-create',
    query: { inventoryRecordId, itemId, acn, serialNumber: serial, description }
  })
}

const fetchLogs = async () => {
  loading.value = true
  error.value = ''
  try {
    const url = new URL(`${apiBase}/maintenance/logs`)
    if (statusFilter.value && statusFilter.value !== 'disposed')
      url.searchParams.set('status', statusFilter.value)
    if (fromDate.value) url.searchParams.set('dateFrom', fromDate.value)
    if (toDate.value) url.searchParams.set('dateTo', toDate.value)
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

const effectiveStatus = (l) => (isDisposed(l) ? 'disposed' : String(l.status || ''))

const filteredLogs = computed(() => {
  const q = search.value.trim().toLowerCase()
  const sf = String(statusFilter.value || '')
  return logs.value.filter((l) => {
    const eff = effectiveStatus(l)
    const s = `${l.logNumber || ''} ${l.acn || ''} ${l.serialNumber || ''} ${eff}`.toLowerCase()
    const matchesStatus = !sf || eff === sf
    return matchesStatus && (!q || s.includes(q))
  })
})

const isOutsideRepair = (l) =>
  String(l?.purpose || '')
    .trim()
    .toLowerCase() === 'outside repair'
const filteredInsideLogs = computed(() => filteredLogs.value.filter((l) => !isOutsideRepair(l)))
const filteredOutsideLogs = computed(() => filteredLogs.value.filter((l) => isOutsideRepair(l)))

const sortedLogs = computed(() => {
  const list = filteredLogs.value.slice()
  const key = String(sortKey.value || 'date')
  const dir = String(sortDir.value || 'desc')
  const mult = dir === 'asc' ? 1 : -1
  list.sort((a, b) => {
    let va = ''
    let vb = ''
    if (key === 'date') {
      va = new Date(a.date || a.createdAt || 0).getTime()
      vb = new Date(b.date || b.createdAt || 0).getTime()
    } else if (key === 'status') {
      va = effectiveStatus(a)
      vb = effectiveStatus(b)
    } else if (key === 'logNumber') {
      va = String(a.logNumber || '')
      vb = String(b.logNumber || '')
    }
    if (va < vb) return -1 * mult
    if (va > vb) return 1 * mult
    return 0
  })
  return list
})

const sortedInsideLogs = computed(() => {
  const list = filteredInsideLogs.value.slice()
  const key = String(sortKey.value || 'date')
  const dir = String(sortDir.value || 'desc')
  const mult = dir === 'asc' ? 1 : -1
  list.sort((a, b) => {
    let va = ''
    let vb = ''
    if (key === 'date') {
      va = new Date(a.date || a.createdAt || 0).getTime()
      vb = new Date(b.date || b.createdAt || 0).getTime()
    } else if (key === 'status') {
      va = effectiveStatus(a)
      vb = effectiveStatus(b)
    } else if (key === 'logNumber') {
      va = String(a.logNumber || '')
      vb = String(b.logNumber || '')
    }
    if (va < vb) return -1 * mult
    if (va > vb) return 1 * mult
    return 0
  })
  return list
})

const sortedOutsideLogs = computed(() => {
  const list = filteredOutsideLogs.value.slice()
  const key = String(sortKey.value || 'date')
  const dir = String(sortDir.value || 'desc')
  const mult = dir === 'asc' ? 1 : -1
  list.sort((a, b) => {
    let va = ''
    let vb = ''
    if (key === 'date') {
      va = new Date(a.date || a.createdAt || 0).getTime()
      vb = new Date(b.date || b.createdAt || 0).getTime()
    } else if (key === 'status') {
      va = effectiveStatus(a)
      vb = effectiveStatus(b)
    } else if (key === 'logNumber') {
      va = String(a.logNumber || '')
      vb = String(b.logNumber || '')
    }
    if (va < vb) return -1 * mult
    if (va > vb) return 1 * mult
    return 0
  })
  return list
})

const totalPages = computed(() => {
  const size = Math.max(1, Number(pageSize.value) || 10)
  return Math.max(1, Math.ceil(sortedLogs.value.length / size))
})
const totalInsidePages = computed(() => {
  const size = Math.max(1, Number(pageSize.value) || 10)
  return Math.max(1, Math.ceil(sortedInsideLogs.value.length / size))
})
const totalOutsidePages = computed(() => {
  const size = Math.max(1, Number(pageSize.value) || 10)
  return Math.max(1, Math.ceil(sortedOutsideLogs.value.length / size))
})

const pagedLogs = computed(() => {
  const size = Math.max(1, Number(pageSize.value) || 10)
  const p = Math.max(1, Number(page.value) || 1)
  const start = (p - 1) * size
  return sortedLogs.value.slice(start, start + size)
})
const pagedInsideLogs = computed(() => {
  const size = Math.max(1, Number(pageSize.value) || 10)
  const p = Math.max(1, Number(pageInside.value) || 1)
  const start = (p - 1) * size
  return sortedInsideLogs.value.slice(start, start + size)
})
const pagedOutsideLogs = computed(() => {
  const size = Math.max(1, Number(pageSize.value) || 10)
  const p = Math.max(1, Number(pageOutside.value) || 1)
  const start = (p - 1) * size
  return sortedOutsideLogs.value.slice(start, start + size)
})

const insideCount = computed(() => filteredInsideLogs.value.length)
const outsideCount = computed(() => filteredOutsideLogs.value.length)

const currentPage = computed({
  get() {
    return activeTab.value === 'inside' ? pageInside.value : pageOutside.value
  },
  set(v) {
    if (activeTab.value === 'inside') pageInside.value = v
    else pageOutside.value = v
  }
})
const totalPagesActive = computed(() =>
  activeTab.value === 'inside' ? totalInsidePages.value : totalOutsidePages.value
)

const printReport = () => {
  const doc = new jsPDF('landscape', 'pt', 'a4')
  const title = 'Repair Logs Report'
  const range =
    fromDate.value || toDate.value
      ? `${fromDate.value || '—'} to ${toDate.value || '—'}`
      : 'All Dates'
  const tab = activeTab.value === 'inside' ? 'Inside' : 'Outside'
  doc.setFontSize(16)
  doc.text(title, 40, 40)
  doc.setFontSize(11)
  doc.text(`Tab: ${tab}`, 40, 60)
  doc.text(`Range: ${range}`, 40, 76)
  doc.text(`Status: ${statusFilter.value || 'All'}`, 40, 92)
  doc.text(`Search: ${search.value || '—'}`, 40, 108)
  const list = activeTab.value === 'inside' ? sortedInsideLogs.value : sortedOutsideLogs.value
  const head = [['Log #', 'Date', 'Status', 'ACN', 'Brought By', 'Purpose', 'Remarks']]
  const body = list.map((l) => [
    String(l.logNumber || ''),
    new Date(l.date || l.createdAt || Date.now()).toLocaleDateString(),
    statusLabel(effectiveStatus(l), l),
    String(l.acn || ''),
    String(l?.broughtBy?.name || ''),
    String(l?.purpose || ''),
    String(l?.remarks || '').slice(0, 200)
  ])
  autoTable(doc, { head, body, startY: 130, styles: { fontSize: 9 } })
  const fname = `repair-logs-report-${tab.toLowerCase()}-${fromDate.value || 'all'}-${
    toDate.value || 'all'
  }.pdf`
  doc.save(fname)
}

const stats = computed(() => {
  const list = Array.isArray(logs.value) ? logs.value : []
  const byStatus = {}
  const tech = {}
  let outside = 0
  let repaired = 0
  let under = 0
  let sumDays = 0
  let cntDays = 0
  for (const l of list) {
    const st = effectiveStatus(l)
    byStatus[st] = (byStatus[st] || 0) + 1
    if (st === 'repaired') repaired++
    if (st === 'under_repair') under++
    const purpose = String(l?.purpose || '').toLowerCase()
    if (purpose === 'outside repair') outside++
    const tname = l?.technician?.name || ''
    if (tname) tech[tname] = (tech[tname] || 0) + 1
    if (st === 'repaired' && l?.repairDetails?.dateRepaired && l?.date) {
      const days = Math.max(
        0,
        Math.round(
          (new Date(l.repairDetails.dateRepaired).getTime() - new Date(l.date).getTime()) / 86400000
        )
      )
      sumDays += days
      cntDays++
    }
  }
  const byTechnician = Object.entries(tech)
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count)
  return {
    total: list.length,
    outside,
    repaired,
    under_repair: under,
    byStatus,
    avgRepairDays: cntDays ? Number((sumDays / cntDays).toFixed(1)) : 0,
    byTechnician
  }
})
const setSort = (key) => {
  const k = String(key || '')
  if (!k) return
  if (sortKey.value === k) sortDir.value = sortDir.value === 'asc' ? 'desc' : 'asc'
  else {
    sortKey.value = k
    sortDir.value = 'desc'
  }
}
const showToast = (msg, type = 'info') => {
  toastMessage.value = String(msg || '')
  toastType.value = String(type || 'info')
  if (!toastMessage.value) return
  setTimeout(() => {
    toastMessage.value = ''
  }, 2000)
}

const copyLogNumber = async (l) => {
  try {
    await navigator.clipboard.writeText(String(l?.logNumber || ''))
    copyingId.value = l?._id
    showToast('Copied', 'success')
    setTimeout(() => {
      copyingId.value = ''
    }, 800)
  } catch (_) {
    showToast('Failed to copy', 'error')
  }
}

const disposedMap = ref({})
const fetchDisposedMap = async () => {
  try {
    const { data } = await axios.get('/disposal')
    const disposals = Array.isArray(data?.disposals) ? data.disposals : []
    const map = {}
    for (const d of disposals) {
      // consider approved disposals as disposed
      const approved = !!d?.approvedBy
      const items = Array.isArray(d.items) && d.items.length ? d.items : [d]
      for (const it of items) {
        const id = String(it?.itemId || '')
        const acn = String(it?.acn || '').toUpperCase()
        const sn = String(it?.serialNumber || '')
        if (approved) {
          if (id) map[`item:${id}`] = true
          if (acn) map[`acn:${acn}`] = true
          if (sn) map[`serial:${sn}`] = true
        }
      }
    }
    disposedMap.value = map
  } catch (_) {
    disposedMap.value = {}
  }
}

const isDisposed = (l) => {
  const rec = l?.inventoryRecordId || null
  const items = Array.isArray(rec?.items) ? rec.items : []
  const id = l?.itemId?._id || l?.itemId || ''
  const acn = String(l?.acn || '')
    .trim()
    .toUpperCase()
  const serial = String(l?.serialNumber || '').trim()
  let it = null
  if (id) it = items.find((i) => String(i._id) === String(id)) || null
  if (!it && acn) it = items.find((i) => String(i?.acn || '').toUpperCase() === acn) || null
  if (!it && serial) it = items.find((i) => String(i?.serialNumber || '') === serial) || null
  if (!it && acn)
    it =
      items.find(
        (i) =>
          Array.isArray(i.secondaryItems) &&
          i.secondaryItems.some((s) => String(s?.acn || '').toUpperCase() === acn)
      ) || null
  if (!it && serial)
    it =
      items.find(
        (i) =>
          Array.isArray(i.secondaryItems) &&
          i.secondaryItems.some((s) => String(s?.serialNumber || '') === serial)
      ) || null
  const disposedItem = String(it?.status || '') === 'disposed'
  const keyHit =
    disposedMap.value[`item:${String(id)}`] ||
    disposedMap.value[`acn:${acn}`] ||
    disposedMap.value[`serial:${serial}`]
  return disposedItem || !!keyHit
}

onMounted(async () => {
  await Promise.all([fetchLogs(), fetchDisposedMap()])
})

// Create Repair Log Modal State
const showCreateModal = ref(false)
const outsideRepair = ref(false)
const createForm = ref({
  acn: '',
  purpose: '',
  remarks: '',
  broughtByName: '',
  broughtByEmployeeId: '',
  status: 'for_inspection',
  outsideDescription: '',
  outsideSerialNumber: '',
  outsideAcn: ''
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
    status: 'for_inspection',
    outsideDescription: '',
    outsideSerialNumber: '',
    outsideAcn: ''
  }
  outsideRepair.value = false
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
  createError.value = ''
  if (!createForm.value.remarks || !createForm.value.remarks.trim()) {
    createError.value = 'Remarks is required.'
    return
  }
  if (outsideRepair.value && !createForm.value.outsideDescription?.trim()) {
    createError.value = 'Description is required for Outside Repair.'
    return
  }
  createLoading.value = true
  try {
    const desc = outsideRepair.value ? (createForm.value.outsideDescription || '').trim() : ''
    const combinedRemarks = desc
      ? `${desc}${createForm.value.remarks ? ' — ' + createForm.value.remarks : ''}`
      : createForm.value.remarks || undefined
    const payload = {
      acn: outsideRepair.value
        ? createForm.value.outsideAcn || undefined
        : createForm.value.acn || undefined,
      purpose: outsideRepair.value
        ? 'Outside Repair'
        : createForm.value.purpose || 'Repair & Maintenance',
      remarks: combinedRemarks,
      status: createForm.value.status || 'under_repair',
      broughtBy: {
        name: createForm.value.broughtByName || '',
        employee: createForm.value.broughtByEmployeeId || undefined
      }
    }
    payload.serialNumber = outsideRepair.value
      ? createForm.value.outsideSerialNumber || undefined
      : (selectedIsSecondary.value
          ? selectedItem.value?._selectedSecondary?.serialNumber
          : selectedItem.value?.serialNumber) || undefined
    payload.inventoryRecordId = outsideRepair.value
      ? undefined
      : selectedRecord.value?._id || undefined
    payload.itemId = outsideRepair.value ? undefined : selectedItem.value?._id || undefined
    const { data } = await axios.post('/maintenance/logs', payload)
    if (!data?.success) throw new Error(data?.message || 'Failed to create repair log')

    // Update inventory item with proper status separation
    try {
      if (!outsideRepair.value && selectedItem.value && selectedRecord.value?._id) {
        // Update the inventory item to maintain deployment status but add repair status
        const inventoryPayload = {
          // Keep deployment status as deployed (or whatever it was)
          status: selectedItem.value.status || 'deployed',
          // Set repair status separately
          repairStatus: createForm.value.status || 'under_repair',
          // Add repair log reference
          statusNotes: `Repair log ${data.log?.logNumber || data.log?._id}`,
          statusDate: new Date().toISOString()
        }

        // Update inventory item
        await axios.patch(
          `/inventory-records/${selectedRecord.value._id}/items/${selectedItem.value._id}`,
          inventoryPayload
        )

        console.log('✅ Updated inventory item with proper status separation:', {
          deploymentStatus: inventoryPayload.status,
          repairStatus: inventoryPayload.repairStatus,
          statusNotes: inventoryPayload.statusNotes
        })
      }
    } catch (inventoryUpdateError) {
      console.warn('⚠️ Could not update inventory item status:', inventoryUpdateError)
      // Don't fail the whole operation if inventory update fails
    }
    try {
      const name = createForm.value.broughtByName || ''
      const dept = selectedRecord.value?.department || ''
      const dstr = new Date(data.log?.date || Date.now()).toISOString().slice(0, 10)
      const remarks = createForm.value.remarks || ''
      const canvas = document.createElement('canvas')
      canvas.width = 800
      canvas.height = 450
      const ctx = canvas.getContext('2d')
      ctx.fillStyle = '#ffffff'
      ctx.fillRect(0, 0, canvas.width, canvas.height)
      ctx.fillStyle = '#000000'
      ctx.font = '15px Arial'
      ctx.fillText(`${dateStr}`, canvas.width - ctx.measureText(`Date: ${dateStr}`).width - 15, 35)
      ctx.font = 'bold 28px Arial'
      ctx.fillText(`Repair Log # ${data.log?.logNumber || ''}`, 30, 60)
      ctx.font = '20px Arial'
      ctx.fillText(`Brought By: ${name}`, 30, 120)
      ctx.fillText(`Department: ${dept}`, 30, 160)
      ctx.fillText('Remarks:', 30, 240)
      const drawWrapped = (t, x, y, maxWidth, lineHeight) => {
        const words = String(t).split(' ')
        let line = ''
        let cursorY = y
        for (let n = 0; n < words.length; n++) {
          const testLine = line + words[n] + ' '
          const metrics = ctx.measureText(testLine)
          if (metrics.width > maxWidth && n > 0) {
            ctx.fillText(line, x, cursorY)
            line = words[n] + ' '
            cursorY += lineHeight
          } else {
            line = testLine
          }
        }
        if (line) ctx.fillText(line, x, cursorY)
        return cursorY
      }
      const lastY = drawWrapped(remarks, 30, 270, canvas.width - 60, 26)
      ctx.strokeStyle = '#000000'
      ctx.lineWidth = 3
      const lineY = Math.min(canvas.height - 40, lastY + 40)
      ctx.beginPath()
      ctx.moveTo(30, lineY)
      ctx.lineTo(canvas.width - 30, lineY)
      ctx.stroke()
      const drawCheckbox = (x, y, label, checked, size = 28, fontSize = 26) => {
        ctx.strokeStyle = '#000000'
        ctx.lineWidth = 2
        ctx.strokeRect(x, y, size, size)

        if (checked) {
          ctx.beginPath()
          ctx.moveTo(x + 3, y + size / 2)
          ctx.lineTo(x + size / 2, y + size - 3)
          ctx.lineTo(x + size - 3, y + 3)
          ctx.stroke()
        }

        ctx.font = `${fontSize}px Arial`
        ctx.fillStyle = '#000000'
        ctx.fillText(label, x + size + 10, y + size - 4)
      }

      const st = createForm.value.status || 'ready_to_claim'
      // First row Y position
      const y1 = Math.min(canvas.height - 30, lineY + 20)
      // Second row Y position (move down 50–60px)
      const y2 = y1 + 60
      // Row 1 — Two checkboxes
      drawCheckbox(40, y1, 'Repaired and ready to claim', st === 'ready_to_claim')
      drawCheckbox(450, y1, 'Under repair / Awaiting Parts', st === 'under_repair')
      // Row 2 — For Disposal (below)
      drawCheckbox(40, y2, 'For disposal', st === 'for_disposal')
      const blob = await new Promise((resolve) => {
        canvas.toBlob((b) => resolve(b || new Blob()), 'image/png')
      })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `repair-label-${data.log.logNumber}.png`
      document.body.appendChild(a)
      a.click()
      a.remove()
      setTimeout(() => URL.revokeObjectURL(url), 0)
    } catch (_) {
      console.log(_)
    }
    await fetchLogs()
    closeCreateModal()
  } catch (e) {
    createError.value = e.response?.data?.message || e.message || String(e)
  } finally {
    createLoading.value = false
  }
}

const downloadingLabelId = ref('')
const downloadLabelForLog = async (log) => {
  if (!log?._id) return
  downloadingLabelId.value = log._id
  try {
    let name = log?.broughtBy?.name || ''
    let dept = ''
    let dateStr = new Date(log.date || log.createdAt || Date.now()).toISOString().slice(0, 10)
    let remarks = log?.remarks || ''
    try {
      const { data } = await axios.get(`/maintenance/logs/${log._id}`)
      if (data?.success && data?.log) {
        const l = data.log
        name = name || l?.broughtBy?.name || ''
        dept = l?.inventoryRecordId?.department || ''
        dateStr = new Date(l.date || l.createdAt || Date.now()).toISOString().slice(0, 10)
        remarks = remarks || l?.remarks || ''
      }
    } catch (_) {
      console.log(_)
    }
    const canvas = document.createElement('canvas')
    canvas.width = 800
    canvas.height = 450
    const ctx = canvas.getContext('2d')
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, 0, canvas.width, canvas.height)
    ctx.fillStyle = '#000000'
    ctx.font = '15px Arial'
    ctx.fillText(`${dateStr}`, canvas.width - ctx.measureText(`Date: ${dateStr}`).width - 15, 35)
    ctx.font = 'bold 28px Arial'
    ctx.fillText(`Repair Log # ${log?.logNumber || ''}`, 30, 60)
    ctx.font = '20px Arial'
    ctx.fillText(`Brought By: ${name}`, 30, 120)
    ctx.fillText(`Department: ${dept}`, 30, 160)
    const drawWrapped = (t, x, y, maxWidth, lineHeight) => {
      const words = String(t).split(' ')
      let line = ''
      let cursorY = y
      for (let n = 0; n < words.length; n++) {
        const testLine = line + words[n] + ' '
        const metrics = ctx.measureText(testLine)
        if (metrics.width > maxWidth && n > 0) {
          ctx.fillText(line, x, cursorY)
          line = words[n] + ' '
          cursorY += lineHeight
        } else {
          line = testLine
        }
      }
      if (line) ctx.fillText(line, x, cursorY)
      return cursorY
    }
    ctx.fillText('Remarks:', 30, 240)
    const lastY = drawWrapped(remarks, 30, 270, canvas.width - 60, 26)
    ctx.strokeStyle = '#000000'
    ctx.lineWidth = 3
    const lineY = Math.min(canvas.height - 40, lastY + 40)
    ctx.beginPath()
    ctx.moveTo(30, lineY)
    ctx.lineTo(canvas.width - 30, lineY)
    ctx.stroke()

    const drawCheckbox = (x, y, label, checked, size = 28, fontSize = 26) => {
      ctx.strokeStyle = '#000000'
      ctx.lineWidth = 2
      ctx.strokeRect(x, y, size, size)

      if (checked) {
        ctx.beginPath()
        ctx.moveTo(x + 3, y + size / 2)
        ctx.lineTo(x + size / 2, y + size - 3)
        ctx.lineTo(x + size - 3, y + 3)
        ctx.stroke()
      }

      ctx.font = `${fontSize}px Arial`
      ctx.fillStyle = '#000000'
      ctx.fillText(label, x + size + 10, y + size - 4)
    }

    const st = createForm.value.status || 'ready_to_claim'

    // First row Y position
    const y1 = Math.min(canvas.height - 30, lineY + 20)

    // Second row Y position (move down 50–60px)
    const y2 = y1 + 60

    // Row 1 — Two checkboxes
    drawCheckbox(40, y1, 'Repaired and ready to claim', st === 'ready_to_claim')

    drawCheckbox(420, y1, 'Under repair / Awaiting Parts', st === 'under_repair')

    // Row 2 — For Disposal (below)
    drawCheckbox(40, y2, 'For disposal', st === 'for_disposal')

    const blob = await new Promise((resolve) => {
      canvas.toBlob((b) => resolve(b || new Blob()), 'image/png')
    })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `repair-label-${log.logNumber}.png`
    document.body.appendChild(a)
    a.click()
    a.remove()
    setTimeout(() => URL.revokeObjectURL(url), 0)
  } catch (_) {
    console.log(_)
  } finally {
    downloadingLabelId.value = ''
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
        <div class="flex items-center gap-2">
          <button
            type="button"
            class="rounded border border-stroke bg-white text-black px-4 py-2 text-sm font-medium hover:bg-gray-50 transition"
            @click="printReport"
          >
            Print Report
          </button>
          <button
            type="button"
            class="rounded bg-primary text-white px-4 py-2 text-sm font-medium hover:bg-opacity-90 transition"
            @click="openCreateModal"
          >
            + New Repair Log
          </button>
        </div>
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
              <option value="disposed">Disposed</option>
            </select>
            <input
              type="date"
              v-model="fromDate"
              class="w-full border border-stroke rounded px-3 py-2 bg-white"
            />
            <input
              type="date"
              v-model="toDate"
              class="w-full border border-stroke rounded px-3 py-2 bg-white"
            />
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
                    fromDate = null
                    toDate = null
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

          <div class="mt-4">
            <div class="grid grid-cols-2 md:grid-cols-4 gap-3">
              <div class="bg-gray-50 rounded p-3">
                <div class="text-xs text-bodydark2">Total Repairs</div>
                <div class="text-lg font-semibold">{{ stats.total }}</div>
              </div>
              <div class="bg-gray-50 rounded p-3">
                <div class="text-xs text-bodydark2">Outside Repairs</div>
                <div class="text-lg font-semibold">{{ stats.outside }}</div>
              </div>
              <div class="bg-gray-50 rounded p-3">
                <div class="text-xs text-bodydark2">Repaired</div>
                <div class="text-lg font-semibold">{{ stats.repaired }}</div>
              </div>
              <div class="bg-gray-50 rounded p-3">
                <div class="text-xs text-bodydark2">Under Repair</div>
                <div class="text-lg font-semibold">{{ stats.under_repair }}</div>
              </div>
            </div>
          </div>
        </div>
        <div class="mt-3 p-2">
          <div class="inline-flex gap-2">
            <button
              type="button"
              @click="activeTab = 'inside'"
              :class="[
                'px-3 py-1 rounded border text-sm',
                activeTab === 'inside'
                  ? 'bg-primary/10 text-primary border-primary'
                  : 'bg-white text-black border-stroke'
              ]"
            >
              Inside ({{ insideCount }})
            </button>
            <button
              type="button"
              @click="activeTab = 'outside'"
              :class="[
                'px-3 py-1 rounded border text-sm',
                activeTab === 'outside'
                  ? 'bg-primary/10 text-primary border-primary'
                  : 'bg-white text-black border-stroke'
              ]"
            >
              Outside ({{ outsideCount }})
            </button>
          </div>
        </div>
        <!-- Table -->
        <div class="overflow-x-auto">
          <table class="w-full table-auto">
            <thead class="sticky top-0 z-10">
              <tr class="bg-gray-2 text-left dark:bg-meta-4">
                <th
                  class="py-3 px-4 font-semibold text-sm cursor-pointer"
                  @click="setSort('logNumber')"
                >
                  Log #
                </th>
                <th class="py-3 px-4 font-semibold text-sm cursor-pointer" @click="setSort('date')">
                  Date
                </th>
                <th
                  class="py-3 px-4 font-semibold text-sm cursor-pointer"
                  @click="setSort('status')"
                >
                  Status
                </th>
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
              <tr
                v-else-if="
                  (activeTab === 'inside'
                    ? filteredInsideLogs.length
                    : filteredOutsideLogs.length) === 0
                "
              >
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
                v-for="l in activeTab === 'inside' ? pagedInsideLogs : pagedOutsideLogs"
                :key="l._id"
                class="border-b border-stroke dark:border-strokedark hover:bg-gray-50 dark:hover:bg-meta-4 transition odd:bg-gray-50"
              >
                <td class="py-3 px-4">
                  <span class="font-medium text-sm">{{ l.logNumber }}</span>
                  <button
                    type="button"
                    class="ml-2 text-xs text-primary"
                    @click.stop="copyLogNumber(l)"
                  >
                    {{ copyingId === l._id ? 'Copied' : 'Copy' }}
                  </button>
                </td>
                <td class="py-3 px-4">
                  <span class="text-sm">{{
                    new Date(l.date || l.createdAt).toLocaleDateString()
                  }}</span>
                </td>
                <td class="py-3 px-4">
                  <span
                    class="inline-block px-2 py-1 rounded text-xs font-medium"
                    :class="{
                      'bg-blue-100 text-blue-800': effectiveStatus(l) === 'for_inspection',
                      'bg-yellow-100 text-yellow-800': effectiveStatus(l) === 'under_repair',
                      'bg-orange-100 text-orange-800': effectiveStatus(l) === 'pending_replacement',
                      'bg-green-100 text-green-800':
                        effectiveStatus(l) === 'repaired' || effectiveStatus(l) === 'claimed',
                      'bg-gray-100 text-gray-800': effectiveStatus(l) === 'for_disposal',
                      'bg-red-100 text-red-800': effectiveStatus(l) === 'disposed'
                    }"
                  >
                    {{ statusLabel(effectiveStatus(l), l) }}
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
                      v-if="
                        l.status === 'ready_to_claim' &&
                        !isDisposed(l) &&
                        !latestActionIsRetrieve(l)
                      "
                      @click="openClaim(l)"
                      class="inline-flex items-center gap-1 rounded border border-primary bg-primary/10 text-primary px-3 py-1 text-xs font-medium hover:bg-primary/20 transition"
                    >
                      Claim
                    </button>
                    <button
                      v-else-if="
                        l.status !== 'repaired' &&
                        l.status !== 'claimed' &&
                        !isDisposed(l) &&
                        !latestActionIsRetrieve(l)
                      "
                      @click="openConsult(l)"
                      class="inline-flex items-center gap-1 rounded border border-primary bg-primary/10 text-primary px-3 py-1 text-xs font-medium hover:bg-primary/20 transition"
                    >
                      Action
                    </button>
                    <button
                      v-if="!isDisposed(l) && !latestActionIsRetrieve(l)"
                      @click="downloadLabelForLog(l)"
                      :disabled="downloadingLabelId === l._id"
                      class="inline-flex items-center gap-1 rounded border border-stroke bg-white text-black px-3 py-1 text-xs font-medium hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition"
                    >
                      {{ downloadingLabelId === l._id ? 'Preparing...' : 'Download Label' }}
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
                    <button
                      v-if="
                        l.status === 'for_disposal' && !isDisposed(l) && !latestActionIsRetrieve(l)
                      "
                      @click="goToDisposalForLog(l)"
                      class="inline-flex items-center gap-1 rounded border border-danger bg-danger/10 text-danger px-3 py-1 text-xs font-medium hover:bg-danger/20 transition"
                    >
                      Disposal
                    </button>
                  </div>
                </td>
              </tr>
            </tbody>
          </table>
          <div class="flex items-center justify-end gap-2 p-3">
            <button
              type="button"
              class="rounded border border-stroke px-3 py-1 text-xs"
              :disabled="currentPage <= 1"
              @click="currentPage = Math.max(1, currentPage - 1)"
            >
              Prev
            </button>
            <span class="text-xs">Page {{ currentPage }} of {{ totalPagesActive }}</span>
            <button
              type="button"
              class="rounded border border-stroke px-3 py-1 text-xs"
              :disabled="currentPage >= totalPagesActive"
              @click="currentPage = Math.min(totalPagesActive, currentPage + 1)"
            >
              Next
            </button>
          </div>
        </div>

        <!-- Footer Summary -->
        <div
          v-if="
            (activeTab === 'inside' ? filteredInsideLogs.length : filteredOutsideLogs.length) > 0
          "
          class="border-t border-stroke dark:border-strokedark p-4 bg-gray-50 dark:bg-meta-4"
        >
          <p class="text-xs text-bodydark2">
            Showing
            <span class="font-semibold">{{
              activeTab === 'inside' ? filteredInsideLogs.length : filteredOutsideLogs.length
            }}</span>
            repair log{{
              (activeTab === 'inside' ? filteredInsideLogs.length : filteredOutsideLogs.length) !==
              1
                ? 's'
                : ''
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
              <option value="retrieve">Retrieve</option>
              <option value="beyond_repair">Beyond repair</option>
              <option value="repaired">Repaired</option>
            </select>
            <p v-if="consultForm.result === 'beyond_repair'" class="text-xs text-bodydark2 mt-1">
              This marks the unit as <span class="font-semibold">for disposal</span>. You can create
              a disposal record from the Disposal module.
            </p>
            <div v-if="consultForm.result === 'beyond_repair'" class="mt-2">
              <button
                type="button"
                @click="goToDisposalForLog(selectedLogDetails || selectedLog)"
                class="inline-flex items-center gap-1 rounded border border-danger bg-danger/10 text-danger px-3 py-1 text-xs font-medium hover:bg-danger/20 transition"
              >
                Go to Disposal
              </button>
            </div>
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
            <label class="block mb-1 text-sm">Time Claimed</label>
            <input
              type="time"
              v-model="claimForm.claimedTime"
              class="w-full border rounded px-3 py-2"
            />
          </div>

          <div>
            <label class="block mb-1 text-sm">Claimed By</label>
            <EmployeeCombobox
              v-model="claimForm.claimedBy"
              @select="
                (emp) => {
                  claimForm.claimedBy =
                    emp?.name || ((emp?.firstName || '') + ' ' + (emp?.lastName || '')).trim()
                }
              "
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
                <div class="flex items-center gap-2">
                  <input type="checkbox" v-model="outsideRepair" id="outsideRepair" />
                  <label for="outsideRepair" class="text-sm">Outside Repair (manual)</label>
                </div>
                <div v-if="!outsideRepair">
                  <label class="block text-sm font-medium mb-2">ACN</label>
                  <AcnRepairCombobox
                    v-model="createForm.acn"
                    placeholder="Search deployed ACN"
                    @select="onAcnSelect"
                  />
                  <p class="text-xs text-bodydark2 mt-1">
                    Choose a deployed ACN to auto-populate item details
                  </p>
                </div>
                <div v-else class="space-y-3">
                  <div>
                    <label class="block text-sm font-medium mb-2">Description</label>
                    <input
                      v-model="createForm.outsideDescription"
                      class="w-full border border-stroke rounded px-3 py-2 bg-gray-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-gray-200 focus:border-gray-300"
                      placeholder="Item description"
                    />
                  </div>
                  <div>
                    <label class="block text-sm font-medium mb-2">Serial Number</label>
                    <input
                      v-model="createForm.outsideSerialNumber"
                      class="w-full border border-stroke rounded px-3 py-2 bg-gray-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-gray-200 focus:border-gray-300"
                      placeholder="Serial number (optional)"
                    />
                  </div>
                  <div>
                    <label class="block text-sm font-medium mb-2">ACN</label>
                    <input
                      v-model="createForm.outsideAcn"
                      class="w-full border border-stroke rounded px-3 py-2 bg-gray-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-gray-200 focus:border-gray-300"
                      placeholder="ACN (optional)"
                    />
                  </div>
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
                    required
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
              <div v-if="!outsideRepair" class="rounded-sm border border-stroke bg-gray-50 p-4">
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
