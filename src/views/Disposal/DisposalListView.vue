<script setup>
import { ref, onMounted, computed, watch } from 'vue'
import { useRouter } from 'vue-router'
import axios from '@/utils/axios'
import DefaultLayout from '@/layouts/DefaultLayout.vue'
import BreadcrumbDefault from '@/components/Breadcrumbs/BreadcrumbDefault.vue'
import { useAuthStore } from '@/stores'
import BaseCombobox from '@/components/Forms/BaseCombobox.vue'
import EmployeeCombobox from '@/components/EmployeeCombobox.vue'
import AcnCombobox from '@/components/AcnCombobox.vue'

const router = useRouter()
const auth = useAuthStore()
const disposals = ref([])
const loading = ref(true)
const pendingLogs = ref([])
const pendingLoading = ref(false)
const pendingError = ref('')
const pendingSelected = ref({})
const pendingSelectAll = ref(false)
const bulkReason = ref('damaged_beyond_repair')
const bulkReasonDetails = ref('')
const bulkNotes = ref('')
const bulkProofImages = ref([])
const bulkSubmitting = ref(false)
const bulkSubmitMessage = ref('')
const bulkFormVisible = ref(false)
const endUserCache = ref({})
const itemNameCache = ref({})
const officeCache = ref({})
const debugPendingOffice = ref(false)
const pendingQuery = ref('')
const pendingDept = ref('')
const copyingId = ref('')
const toastMessage = ref('')
const toastType = ref('info')
const pendingPage = ref(1)
const pageSize = ref(10)
const bulkManualItems = ref([])
const departments = ref([])
const products = ref([])
const productOptions = computed(() =>
  (products.value || []).map((p) => ({
    ...p,
    label: p.name
  }))
)
const disposalQuery = ref('')
const disposalReasonFilter = ref('')
const disposalStatusFilter = ref('')
const dPage = ref(1)
const dPageSize = ref(10)
const copyingDisposalId = ref('')

const fetchDisposals = async () => {
  try {
    const { data } = await axios.get('/disposal')
    disposals.value = data.disposals
  } catch (error) {
    console.error('Error fetching disposals:', error)
  } finally {
    loading.value = false
  }
}

const fetchPendingForDisposal = async () => {
  pendingLoading.value = true
  pendingError.value = ''
  try {
    const { data } = await axios.get('/maintenance/logs', { params: { status: 'for_disposal' } })
    const list = Array.isArray(data.logs) ? data.logs : []
    const enriched = await Promise.all(
      list.map(async (l) => {
        try {
          const { data: d } = await axios.get(`/maintenance/logs/${l._id}`)
          const full = d?.log || l
          return full
        } catch (_) {
          return l
        }
      })
    )
    pendingLogs.value = enriched
    pendingSelected.value = {}
    pendingSelectAll.value = false

    // Exclude logs already included in any disposal record (approved or pending)
    try {
      const { data: dd } = await axios.get('/disposal')
      const alld = Array.isArray(dd?.disposals) ? dd.disposals : []
      const block = new Set()
      for (const d of alld) {
        const items = Array.isArray(d.items) && d.items.length ? d.items : [d]
        for (const it of items) {
          const k1 = String(it?.itemId || '')
          const k2 = String(it?.acn || '')
          const k3 = String(it?.serialNumber || '')
          if (k1) block.add(`item:${k1}`)
          if (k2) block.add(`acn:${k2.toUpperCase()}`)
          if (k3) block.add(`serial:${k3}`)
        }
      }
      pendingLogs.value = enriched.filter((l) => {
        const idk = `item:${String(l?.itemId?._id || l?.itemId || '')}`
        const acnk = `acn:${String(l?.acn || '').toUpperCase()}`
        const serk = `serial:${String(l?.serialNumber || '')}`
        return !(block.has(idk) || block.has(acnk) || block.has(serk))
      })
    } catch (_) {
      // ignore filter errors; show all enriched
    }
    const cache = {}
    const nameCache = {}
    const deptCache = {}
    for (const l of pendingLogs.value) {
      let eu = ''
      let name =
        l?.item?.productName || l?.item?.description || l?.productName || l?.description || ''
      let office =
        l?.inventoryRecordId?.department || l?.broughtBy?.department || l?.department || ''
      const remarksText = String(l?.remarks || '').trim()
      const notesText = String(l?.notes || '').trim()
      const isNonInformativeRemark = /^(DEFECTIVE|BEYOND|DISPOSAL)$/i.test(remarksText)
      if (!name && remarksText && !isNonInformativeRemark) name = remarksText
      if (!name && notesText) name = notesText.split('\n')[0]
      if (l?.item?.endUserOrMR) {
        eu = l.item.endUserOrMR
      } else {
        const acn = String(l?.acn || '').trim()
        const serial = String(l?.serialNumber || '').trim()
        const params = { limit: 5 }
        if (acn) params.acn = acn
        else if (serial) params.serialNumber = serial
        try {
          const irRes = await axios.get('/inventory-records', { params })
          const records = irRes?.data?.records || []
          let rec = Array.isArray(records) && records.length ? records[0] : null
          if (!rec && acn) {
            const fbParams = { status: 'deployed', limit: 50, page: 1 }
            const fbRes = await axios.get('/inventory-records', { params: fbParams })
            const fbRecords = fbRes?.data?.records || []
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
          if (!rec && serial) {
            const fbParams = { status: 'deployed', limit: 50, page: 1 }
            const fbRes = await axios.get('/inventory-records', { params: fbParams })
            const fbRecords = fbRes?.data?.records || []
            rec =
              fbRecords.find((r) =>
                (r.items || []).some(
                  (it) =>
                    Array.isArray(it.secondaryItems) &&
                    it.secondaryItems.some((s) => String(s?.serialNumber || '') === serial)
                )
              ) || null
          }
          if (rec) {
            const norm = (s) =>
              String(s || '')
                .trim()
                .toUpperCase()
            let item = (rec.items || []).find((it) => {
              if (acn) return norm(it?.acn) === norm(acn)
              if (serial) return String(it?.serialNumber || '') === serial
              return false
            })
            if (!item && acn) {
              const parent = (rec.items || []).find(
                (it) =>
                  Array.isArray(it.secondaryItems) &&
                  it.secondaryItems.some((s) => norm(s?.acn) === norm(acn))
              )
              if (parent) item = parent
            }
            if (!item && serial) {
              const parentBySerial = (rec.items || []).find(
                (it) =>
                  Array.isArray(it.secondaryItems) &&
                  it.secondaryItems.some((s) => String(s?.serialNumber || '') === serial)
              )
              if (parentBySerial) item = parentBySerial
            }
            eu = item?.endUserOrMR || ''
            if (!name) {
              const pid = item?.product
              const pname =
                (products.value || []).find((p) => String(p._id) === String(pid))?.name || ''
              name =
                item?.productName ||
                pname ||
                item?.description ||
                item?.monitorAndSerial ||
                item?.printerOrScanner ||
                name
            }
            if (!office) {
              office = (rec?.department && rec.department.name) || rec?.department || office || ''
            }
          }
        } catch (_) {
          eu = ''
        }
      }
      if (!office && l?.broughtBy?.employee) {
        try {
          const { data: empd } = await axios.get(`/employees/${l.broughtBy.employee}`)
          office = (empd?.employee?.department || office || '').trim()
        } catch (_) {
          void 0
        }
      }
      if (!office && l?.broughtBy?.name) {
        try {
          const { data: srch } = await axios.get('/employees', {
            params: { search: l.broughtBy.name, limit: 50 }
          })
          const list = Array.isArray(srch?.employees) ? srch.employees : []
          const target = String(l.broughtBy.name || '')
            .trim()
            .toUpperCase()
          const emp =
            list.find(
              (e) =>
                `${String(e.firstName || '')} ${String(e.lastName || '')}`.trim().toUpperCase() ===
                target
            ) ||
            list.find(
              (e) =>
                `${String(e.lastName || '')} ${String(e.firstName || '')}`.trim().toUpperCase() ===
                target
            ) ||
            list[0]
          office = (emp?.department || office || '').trim()
          if (!office) {
            const { data: all } = await axios.get('/employees', { params: { limit: 1000 } })
            const allList = Array.isArray(all?.employees) ? all.employees : []
            const emp2 =
              allList.find(
                (e) =>
                  `${String(e.firstName || '')} ${String(e.lastName || '')}`
                    .trim()
                    .toUpperCase() === target
              ) ||
              allList.find(
                (e) =>
                  `${String(e.lastName || '')} ${String(e.firstName || '')}`
                    .trim()
                    .toUpperCase() === target
              ) ||
              allList.find((e) =>
                `${String(e.firstName || '')} ${String(e.lastName || '')}`
                  .trim()
                  .toUpperCase()
                  .includes(target)
              ) ||
              null
            office = (emp2?.department || office || '').trim()
          }
        } catch (_) {
          void 0
        }
      }
      if (!office) {
        try {
          const { data: ld } = await axios.get(`/maintenance/logs/${l._id}`)
          const full = ld?.log || {}
          office =
            full?.inventoryRecordId?.department ||
            full?.broughtBy?.department ||
            full?.department ||
            office ||
            ''
        } catch (_) {
          void 0
        }
      }
      if (eu) cache[String(l._id)] = eu
      if (name) nameCache[String(l._id)] = name
      if (office) deptCache[String(l._id)] = office
    }
    endUserCache.value = cache
    itemNameCache.value = nameCache
    officeCache.value = deptCache
  } catch (e) {
    pendingError.value =
      e?.response?.data?.message || e.message || 'Failed to load for-disposal items'
  } finally {
    pendingLoading.value = false
  }
}

const filteredPendingLogs = computed(() => {
  const q = String(pendingQuery.value || '')
    .trim()
    .toUpperCase()
  const dept = String(pendingDept.value || '')
    .trim()
    .toUpperCase()
  const list = pendingLogs.value || []
  if (!q && !dept) return list
  return list.filter((l) => {
    const acn = String(l?.acn || l?.item?.acn || '').toUpperCase()
    const desc = String(
      itemNameCache.value[l?._id] || l?.productName || l?.description || ''
    ).toUpperCase()
    const serial = String(l?.serialNumber || '').toUpperCase()
    const eu = String(
      l?.broughtBy?.name || endUserCache.value[l?._id] || getEndUser(l) || ''
    ).toUpperCase()
    const office = String(
      officeCache.value[l?._id] ||
        l?.inventoryRecordId?.department ||
        l?.broughtBy?.department ||
        l?.department ||
        ''
    ).toUpperCase()
    const matchesQ =
      !q ||
      acn.includes(q) ||
      desc.includes(q) ||
      serial.includes(q) ||
      eu.includes(q) ||
      office.includes(q)
    const matchesDept = !dept || office.includes(dept)
    return matchesQ && matchesDept
  })
})

const pagedPendingLogs = computed(() => {
  const list = filteredPendingLogs.value || []
  const size = Math.max(1, Number(pageSize.value) || 10)
  const page = Math.max(1, Number(pendingPage.value) || 1)
  const start = (page - 1) * size
  return list.slice(start, start + size)
})

const totalPendingPages = computed(() => {
  const size = Math.max(1, Number(pageSize.value) || 10)
  const list = filteredPendingLogs.value || []
  return Math.max(1, Math.ceil(list.length / size))
})

const nextPendingPage = () => {
  if (pendingPage.value < totalPendingPages.value) pendingPage.value += 1
}
const prevPendingPage = () => {
  if (pendingPage.value > 1) pendingPage.value -= 1
}

const showToast = (msg, type = 'info') => {
  toastMessage.value = String(msg || '')
  toastType.value = String(type || 'info')
  if (!toastMessage.value) return
  setTimeout(() => {
    toastMessage.value = ''
  }, 2000)
}

const copyLogNumber = async (log) => {
  try {
    await navigator.clipboard.writeText(String(log?.logNumber || ''))
    copyingId.value = log?._id
    setTimeout(() => {
      copyingId.value = ''
    }, 800)
  } catch (_) {
    showToast('Failed to copy', 'error')
  }
}

const fetchDepartments = async () => {
  try {
    const { data } = await axios.get('/departments')
    const deptData = data?.departments || data || []
    departments.value = Array.isArray(deptData) ? deptData : []
  } catch (_) {
    departments.value = []
  }
}

const fetchProducts = async () => {
  try {
    const { data } = await axios.get('/products')
    const productData = data?.products || data || []
    products.value = Array.isArray(productData) ? productData : []
  } catch (_) {
    products.value = []
  }
}

const filteredDisposals = computed(() => {
  const q = String(disposalQuery.value || '')
    .trim()
    .toUpperCase()
  const reason = String(disposalReasonFilter.value || '')
  const status = String(disposalStatusFilter.value || '')
  const list = Array.isArray(disposals.value) ? disposals.value : []
  return list.filter((d) => {
    const num = String(d?.disposalNumber || '').toUpperCase()
    const desc = String(d?.reasonDetails || '').toUpperCase()
    const r = String(d?.reason || '').toUpperCase()
    const appr = String(
      d?.approvedByName ||
        (d?.approvedBy ? `${d.approvedBy.firstName} ${d.approvedBy.lastName || ''}` : '')
    ).toUpperCase()
    const matchesQ = !q || num.includes(q) || desc.includes(q) || r.includes(q) || appr.includes(q)
    const matchesR = !reason || String(d?.reason || '') === reason
    const isApproved = !!d?.approvedBy
    const matchesS = !status || (status === 'approved' ? isApproved : !isApproved)
    return matchesQ && matchesR && matchesS
  })
})

const totalDisposalPages = computed(() => {
  const size = Math.max(1, Number(dPageSize.value) || 10)
  return Math.max(1, Math.ceil((filteredDisposals.value || []).length / size))
})

const pagedDisposals = computed(() => {
  const list = filteredDisposals.value || []
  const size = Math.max(1, Number(dPageSize.value) || 10)
  const page = Math.max(1, Number(dPage.value) || 1)
  const start = (page - 1) * size
  return list.slice(start, start + size)
})

const copyDisposalNumber = async (d) => {
  try {
    await navigator.clipboard.writeText(String(d?.disposalNumber || ''))
    copyingDisposalId.value = d?._id
    showToast('Copied', 'success')
    setTimeout(() => {
      copyingDisposalId.value = ''
    }, 800)
  } catch (_) {
    showToast('Failed to copy', 'error')
  }
}

const addManualItem = () => {
  bulkManualItems.value.push({
    description: '',
    serialNumber: '',
    acn: '',
    department: '',
    endUser: '',
    remarks: ''
  })
}
const removeManualItem = (idx) => {
  if (typeof idx === 'number' && idx >= 0 && idx < bulkManualItems.value.length) {
    bulkManualItems.value.splice(idx, 1)
  }
}
const onManualProductChange = (idx, pid) => {
  const it = bulkManualItems.value[idx]
  if (!it) return
  const p = products.value.find((x) => String(x._id) === String(pid))
  it.description = p?.name || it.description || ''
}
const onManualAcnSelect = (idx, payload) => {
  const it = bulkManualItems.value[idx]
  if (!it) return
  it.acn = payload?.acn || ''
  const sec = payload?.item?._selectedSecondary || null
  const serial = sec?.serialNumber || payload?.item?.serialNumber || ''
  const pname = payload?.item?.productName || payload?.product?.name || ''
  const descr = payload?.item?.description || ''
  it.serialNumber = serial || it.serialNumber || ''
  it.description = descr || pname || it.description || ''
  const deptName =
    (payload?.record?.department && payload.record.department.name) ||
    payload?.record?.department ||
    ''
  if (deptName) it.department = deptName
  const eu = payload?.item?.endUserOrMR || ''
  if (eu) it.endUser = eu
}

const togglePendingSelectAll = () => {
  const v = pendingSelectAll.value
  const map = {}
  pendingLogs.value.forEach((l) => {
    map[String(l._id)] = v
  })
  pendingSelected.value = map
}

const pendingSelectedCount = computed(() => {
  return Object.values(pendingSelected.value).filter(Boolean).length
})

watch(
  pendingSelected,
  (val) => {
    const count = Object.values(val).filter(Boolean).length
    if (count === 0) bulkFormVisible.value = false
  },
  { deep: true }
)

const getEndUser = (l) => {
  if (l?.item?.endUserOrMR) return l.item.endUserOrMR
  const items = Array.isArray(l?.inventoryRecordId?.items) ? l.inventoryRecordId.items : []
  if (items.length) {
    const itemId = l?.itemId?._id || l?.itemId || ''
    const acn = l?.acn || ''
    const serial = l?.serialNumber || ''
    let it = null
    if (itemId) it = items.find((i) => String(i._id) === String(itemId)) || null
    if (!it && acn)
      it = items.find((i) => String(i.acn || i.propertyNumber || '') === String(acn)) || null
    if (!it && serial)
      it = items.find((i) => String(i.serialNumber || '') === String(serial)) || null
    if (it?.endUserOrMR) return it.endUserOrMR
  }
  return ''
}

const handleBulkImageUpload = (e) => {
  const files = Array.from(e.target.files || [])
  files.forEach((file) => {
    const reader = new FileReader()
    reader.onload = (evt) => {
      const src = evt?.target?.result
      if (src) bulkProofImages.value.push({ src, name: '' })
    }
    reader.readAsDataURL(file)
  })
}

const removeBulkImage = (i) => {
  if (typeof i === 'number' && i >= 0 && i < bulkProofImages.value.length) {
    bulkProofImages.value.splice(i, 1)
  }
}

const buildBulkPayloadForLog = async (log) => {
  let acn = log?.acn || ''
  let serialNumber = log?.serialNumber || ''
  let description = log?.description || ''
  let inventoryRecordId = log?.inventoryRecordId?._id || log?.inventoryRecordId || ''
  let itemId = log?.itemId?._id || log?.itemId || ''
  if (!inventoryRecordId || !itemId || !description || !serialNumber || !acn) {
    try {
      const { data } = await axios.get(`/maintenance/logs/${log._id}`)
      const l = data?.log || {}
      acn = acn || l?.acn || ''
      serialNumber = serialNumber || l?.serialNumber || ''
      description = description || l?.description || ''
      inventoryRecordId =
        inventoryRecordId || l?.inventoryRecordId?._id || l?.inventoryRecordId || ''
      itemId = itemId || l?.itemId?._id || l?.itemId || ''
    } catch (_) {
      void 0
    }
  }
  const preparedByStr = auth.userDisplayName || ''
  const propertyNo =
    log?.item?.propertyNumber || log?.item?._selectedSecondary?.propertyNumber || ''
  const endUserOffice = log?.item?.endUserOrMR || log?.inventoryRecordId?.department || ''
  const notesOut = [
    bulkNotes.value || '',
    propertyNo ? `Property #: ${propertyNo}` : '',
    endUserOffice ? `End User/Office: ${endUserOffice}` : '',
    preparedByStr ? `Prepared by: ${preparedByStr}` : ''
  ]
    .filter(Boolean)
    .join('\n')
  return {
    inventoryRecordId,
    itemId,
    description,
    reason: bulkReason.value || 'damaged_beyond_repair',
    reasonDetails: bulkReasonDetails.value || '',
    proofImages: bulkProofImages.value,
    notes: notesOut
  }
}

const buildItemEntryForLog = async (log) => {
  let acn = log?.acn || ''
  let serialNumber = log?.serialNumber || ''
  let description = log?.description || ''
  let inventoryRecordId = log?.inventoryRecordId?._id || log?.inventoryRecordId || ''
  let itemId = log?.itemId?._id || log?.itemId || ''
  if (!inventoryRecordId || !itemId || !description || !serialNumber || !acn) {
    try {
      const { data } = await axios.get(`/maintenance/logs/${log._id}`)
      const l = data?.log || {}
      acn = acn || l?.acn || ''
      serialNumber = serialNumber || l?.serialNumber || ''
      description = description || l?.description || ''
      inventoryRecordId =
        inventoryRecordId || l?.inventoryRecordId?._id || l?.inventoryRecordId || ''
      itemId = itemId || l?.itemId?._id || l?.itemId || ''
    } catch (_) {
      void 0
    }
  }
  return {
    inventoryRecordId: inventoryRecordId || undefined,
    itemId: itemId || undefined,
    acn: acn || undefined,
    serialNumber: serialNumber || undefined,
    description: description || undefined
  }
}

const submitBulkDisposal = async () => {
  const ids = Object.keys(pendingSelected.value).filter((id) => pendingSelected.value[id])
  const hasManual = bulkManualItems.value.some((it) => {
    const desc = String(it?.description || '').trim()
    const sn = String(it?.serialNumber || '').trim()
    const acn = String(it?.acn || '').trim()
    return !!(desc || sn || acn)
  })
  if (ids.length === 0 && !hasManual) {
    bulkSubmitMessage.value = 'Select at least one item or add a manual entry'
    return
  }
  if (bulkFormVisible.value && bulkProofImages.value.length === 0) {
    bulkSubmitMessage.value = 'Please upload at least one proof image before submitting.'
    return
  }
  bulkSubmitting.value = true
  bulkSubmitMessage.value = ''
  try {
    const items = []
    for (const id of ids) {
      const log = pendingLogs.value.find((l) => String(l._id) === String(id))
      if (!log) continue
      const entry = await buildItemEntryForLog(log)
      items.push(entry)
    }
    for (const it of bulkManualItems.value) {
      const desc = String(it?.description || '').trim()
      const sn = String(it?.serialNumber || '').trim()
      const acn = String(it?.acn || '').trim()
      if (desc || sn || acn) {
        items.push({
          inventoryRecordId: undefined,
          itemId: undefined,
          acn: acn || undefined,
          serialNumber: sn || undefined,
          description: desc || undefined
        })
      }
    }
    const preparedByStr = auth.userDisplayName || ''
    const manualNotes = bulkManualItems.value
      .map((it, idx) => {
        const parts = [
          it.description ? `Desc: ${it.description}` : '',
          it.serialNumber ? `SN: ${it.serialNumber}` : '',
          it.acn ? `ACN: ${it.acn}` : '',
          it.endUser ? `End User: ${it.endUser}` : '',
          it.department ? `Office: ${it.department}` : '',
          it.remarks ? `Remarks: ${it.remarks}` : ''
        ]
          .filter(Boolean)
          .join(' • ')
        return parts ? `Manual #${idx + 1}: ${parts}` : ''
      })
      .filter(Boolean)
    const notesOut = [
      bulkNotes.value || '',
      ...manualNotes,
      preparedByStr ? `Prepared by: ${preparedByStr}` : ''
    ]
      .filter(Boolean)
      .join('\n')
    const payload = {
      items,
      reason: bulkReason.value || 'damaged_beyond_repair',
      reasonDetails: bulkReasonDetails.value || '',
      proofImages: bulkProofImages.value.map((p) => p?.src || p),
      proofs: bulkProofImages.value.map((p, i) => ({
        acn: p.acn || '',
        image: p.src || '',
        name: (p.name || '').trim()
      })),
      notes: notesOut
    }
    const { data } = await axios.post('/disposal', payload)
    bulkSubmitMessage.value = data?.disposal?._id
      ? `Created disposal with ${items.length} item${items.length !== 1 ? 's' : ''}`
      : 'Failed to create disposal'
    await Promise.all([fetchDisposals(), fetchPendingForDisposal()])
  } catch (e) {
    bulkSubmitMessage.value = e?.response?.data?.message || e.message || 'Bulk creation failed'
  } finally {
    bulkSubmitting.value = false
  }
}

const onBulkDisposeClick = async () => {
  if (!bulkFormVisible.value) {
    bulkFormVisible.value = true
    return
  }
  await submitBulkDisposal()
}

const viewDisposal = (id) => router.push({ name: 'disposal-detail', params: { id } })
const createDisposal = () => router.push({ name: 'disposal-create' })

const approveModalOpen = ref(false)
const approveTarget = ref(null)
const approveImages = ref([])
const approveSubmitting = ref(false)
const approveError = ref('')
const handleApproveImageUpload = (e) => {
  const files = Array.from(e.target.files || [])
  files.forEach((file) => {
    const reader = new FileReader()
    reader.onload = (evt) => {
      const src = evt?.target?.result
      if (src) approveImages.value.push({ src, name: '' })
    }
    reader.readAsDataURL(file)
  })
}
const removeApproveImage = (i) => {
  if (typeof i === 'number' && i >= 0 && i < approveImages.value.length) {
    approveImages.value.splice(i, 1)
  }
}
const openApprove = (d) => {
  approveTarget.value = d || null
  approveImages.value = []
  approveError.value = ''
  approveModalOpen.value = true
}
const closeApprove = () => {
  approveModalOpen.value = false
  approveTarget.value = null
}
const autoNameApproveImages = () => {
  const last4 = String(approveTarget.value?.disposalNumber || '').slice(-4)
  approveImages.value = approveImages.value.map((p, i) => ({
    ...p,
    name: (p.name || '').trim() || `${last4}-GSD-${i + 1}`
  }))
}
const submitApprove = async () => {
  if (!approveTarget.value?._id) return
  approveSubmitting.value = true
  approveError.value = ''
  try {
    autoNameApproveImages()
    const payload = {
      proofs: approveImages.value.map((p) => ({ image: p.src || '', name: p.name || '' }))
    }
    const { data } = await axios.patch(`/disposal/${approveTarget.value._id}/approve`, payload)
    if (!data?.success) throw new Error(data?.message || 'Failed to approve disposal')
    await fetchDisposals()
    closeApprove()
  } catch (e) {
    approveError.value = e?.response?.data?.message || e.message || String(e)
  } finally {
    approveSubmitting.value = false
  }
}

onMounted(async () => {
  await Promise.all([fetchDisposals(), fetchDepartments(), fetchProducts()])
  await fetchPendingForDisposal()
})
</script>

<template>
  <DefaultLayout>
    <div
      v-if="toastMessage"
      class="fixed top-4 right-4 z-50 px-3 py-2 rounded text-white shadow"
      :class="{
        'bg-primary': toastType === 'info',
        'bg-green-600': toastType === 'success',
        'bg-red-600': toastType === 'error'
      }"
    >
      {{ toastMessage }}
    </div>
    <BreadcrumbDefault pageTitle="Disposal Records" />
    <div class="p-6">
      <div class="flex justify-end mb-4">
        <button @click="createDisposal" class="bg-primary text-white px-6 py-2 rounded">
          Create Disposal Record
        </button>
      </div>

      <div
        class="rounded-sm border border-stroke bg-white shadow-default dark:border-strokedark dark:bg-boxdark mb-6"
      >
        <div
          class="border-b border-stroke dark:border-strokedark p-4 flex items-center justify-between"
        >
          <div class="flex items-center gap-3">
            <h3 class="text-lg font-semibold">Pending For Disposal</h3>
          </div>
          <div class="flex items-center gap-3">
            <input
              v-model="pendingQuery"
              type="text"
              class="rounded border border-stroke h-11 px-3 py-1 text-sm"
              placeholder="Search ACN, item, serial, user, office"
            />
            <BaseCombobox
              v-model="pendingDept"
              :options="departments"
              labelKey="name"
              valueKey="name"
              placeholder="Filter by office"
            />
            <label class="inline-flex items-center gap-2 text-sm">
              <input type="checkbox" v-model="pendingSelectAll" @change="togglePendingSelectAll" />
              <span>Select All</span>
            </label>
            <span class="text-xs text-bodydark2">Selected {{ pendingSelectedCount }}</span>
            <button
              type="button"
              class="rounded bg-primary text-white px-4 py-2 text-sm font-medium hover:bg-opacity-90 transition"
              :disabled="bulkSubmitting || pendingSelectedCount === 0"
              @click="bulkFormVisible = true"
            >
              {{ bulkSubmitting ? 'Disposing...' : 'Bulk Dispose' }}
            </button>
          </div>
        </div>
        <div v-if="pendingLoading" class="p-6 text-sm">Loading items marked for disposal...</div>
        <div v-else-if="pendingError" class="p-6 text-danger text-sm">{{ pendingError }}</div>
        <div v-else class="grid grid-cols-1 gap-4 p-4">
          <div class="md:col-span-2">
            <table class="w-full table-auto">
              <thead class="sticky top-0 z-10">
                <tr class="bg-gray-2 text-left dark:bg-meta-4">
                  <th class="py-3 px-4 text-sm">Select</th>
                  <th class="py-3 px-4 text-sm">Log #</th>
                  <th class="py-3 px-4 text-sm">ACN</th>
                  <th class="py-3 px-4 text-sm">Description</th>
                  <th class="py-3 px-4 text-sm">Serial Number</th>
                  <th class="py-3 px-4 text-sm">End User</th>
                  <th class="py-3 px-4 text-sm">Office</th>
                  <th class="py-3 px-4 text-sm">Remarks</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="l in pagedPendingLogs" :key="l._id" class="border-t odd:bg-gray-50">
                  <td class="py-2 px-4">
                    <input type="checkbox" v-model="pendingSelected[l._id]" />
                  </td>
                  <td class="py-2 px-4">
                    <span class="text-sm font-medium">{{ l.logNumber }}</span>
                    <button
                      type="button"
                      class="ml-2 text-xs text-primary"
                      @click="copyLogNumber(l)"
                    >
                      {{ copyingId === l._id ? 'Copied' : 'Copy' }}
                    </button>
                  </td>
                  <td class="py-2 px-4">
                    <span class="text-sm font-mono">{{ l.acn || l.item?.acn || '—' }}</span>
                  </td>
                  <td class="py-2 px-4">
                    <span class="text-sm truncate max-w-[24rem] inline-block align-middle">{{
                      itemNameCache[l._id] ||
                      l.productName ||
                      l.description ||
                      l.item?.productName ||
                      l.item?.description ||
                      l.item?.monitorAndSerial ||
                      l.item?.printerOrScanner ||
                      '—'
                    }}</span>
                    <span
                      v-if="!l.inventoryRecordId && !l.itemId"
                      class="inline-block w-2 h-2 rounded-full bg-yellow-400 ml-2"
                      aria-label="Manual entry"
                    ></span>
                  </td>

                  <td class="py-2 px-4">
                    <span class="text-sm font-mono block text-right">{{
                      l.serialNumber || '—'
                    }}</span>
                  </td>
                  <td class="py-2 px-4">
                    <span class="text-sm">{{
                      l.broughtBy?.name || endUserCache[l._id] || getEndUser(l) || '—'
                    }}</span>
                  </td>
                  <td class="py-2 px-4">
                    <span class="text-sm">{{
                      (
                        officeCache[l._id] ||
                        l.inventoryRecordId?.department ||
                        l.broughtBy?.department ||
                        l.department ||
                        '—'
                      )
                        .toString()
                        .trim()
                    }}</span>
                    <div v-if="debugPendingOffice" class="mt-1 text-[10px] text-bodydark2">
                      [dbg] src: invRec: {{ l.inventoryRecordId?.department || '×' }} • broughtBy:
                      {{ l.broughtBy?.department || '×' }} • top: {{ l.department || '×' }} • cache:
                      {{ (officeCache[l._id] || '×').toString().trim() }}
                    </div>
                  </td>
                  <td class="py-2 px-4">
                    <span
                      class="px-2 py-1 rounded text-xs"
                      :class="{
                        'bg-red-100 text-red-700': (l.remarks || '')
                          .toUpperCase()
                          .includes('DEFECTIVE'),
                        'bg-orange-100 text-orange-700':
                          (l.remarks || '').toUpperCase().includes('BEYOND') ||
                          (l.remarks || '').toUpperCase().includes('DISPOSAL'),
                        'bg-gray-100 text-gray-700': !(l.remarks || '').trim()
                      }"
                      >{{
                        l.remarks ||
                        (bulkReason === 'damaged_beyond_repair' ? 'DEFECTIVE' : bulkReason)
                      }}</span
                    >
                  </td>
                </tr>
                <tr v-if="pendingLogs.length === 0">
                  <td colspan="8" class="py-10">
                    <div class="mx-auto max-w-xl text-center">
                      <div class="text-lg font-semibold mb-2">No items marked for disposal</div>
                      <div class="text-sm text-bodydark2">
                        Mark items as <span class="font-medium">for disposal</span> from the Repair
                        Logs, or create a manual entry in Create For Disposal.
                      </div>
                      <div class="mt-3">
                        <router-link to="/maintenance/logs" class="text-primary text-sm"
                          >Open Repair Logs</router-link
                        >
                      </div>
                    </div>
                  </td>
                </tr>
              </tbody>
            </table>
            <div class="flex items-center justify-end gap-2 mt-3">
              <button
                type="button"
                class="rounded border border-stroke px-3 py-1 text-xs"
                :disabled="pendingPage <= 1"
                @click="prevPendingPage"
              >
                Prev
              </button>
              <span class="text-xs">Page {{ pendingPage }} of {{ totalPendingPages }}</span>
              <button
                type="button"
                class="rounded border border-stroke px-3 py-1 text-xs"
                :disabled="pendingPage >= totalPendingPages"
                @click="nextPendingPage"
              >
                Next
              </button>
              <select
                v-model.number="pageSize"
                class="ml-2 rounded border border-stroke px-2 py-1 text-xs"
              >
                <option :value="10">10</option>
                <option :value="20">20</option>
                <option :value="50">50</option>
              </select>
            </div>
          </div>
        </div>
      </div>

      <div v-if="loading" class="text-center py-8">Loading...</div>
      <div v-else class="bg-white rounded shadow">
        <div class="p-4 flex items-center justify-between border-b border-stroke">
          <div class="flex items-center gap-2">
            <input
              v-model="disposalQuery"
              type="text"
              class="rounded border border-stroke px-3 py-1 text-sm"
              placeholder="Search #, description, reason, approver"
            />
            <select
              v-model="disposalReasonFilter"
              class="rounded border border-stroke px-3 py-1 text-sm bg-white"
            >
              <option value="">All Reasons</option>
              <option value="damaged_beyond_repair">Damaged Beyond Repair</option>
              <option value="unserviceable">Unserviceable</option>
              <option value="obsolete">Obsolete</option>
              <option value="lost">Lost</option>
              <option value="stolen">Stolen</option>
              <option value="other">Other</option>
            </select>
            <select
              v-model="disposalStatusFilter"
              class="rounded border border-stroke px-3 py-1 text-sm bg-white"
            >
              <option value="">All Status</option>
              <option value="approved">Approved</option>
              <option value="pending">Pending</option>
            </select>
          </div>
          <div class="flex items-center gap-2">
            <select
              v-model.number="dPageSize"
              class="rounded border border-stroke px-2 py-1 text-xs"
            >
              <option :value="10">10</option>
              <option :value="20">20</option>
              <option :value="50">50</option>
            </select>
          </div>
        </div>
        <table class="w-full table-auto">
          <thead class="bg-gray-100 sticky top-0 z-10">
            <tr>
              <th class="p-3 text-left">Disposal #</th>
              <th class="p-3 text-left">Description</th>
              <th class="p-3 text-left">Items</th>
              <th class="p-3 text-left">Reason</th>
              <th class="p-3 text-left">Approved By</th>
              <th class="p-3 text-left">Date</th>
              <th class="p-3 text-left">Action</th>
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="disposal in pagedDisposals"
              :key="disposal._id"
              @click="viewDisposal(disposal._id)"
              class="border-t hover:bg-gray-50 cursor-pointer odd:bg-gray-50"
            >
              <td class="p-3">
                <span class="text-sm font-medium">{{ disposal.disposalNumber }}</span>
                <button
                  type="button"
                  class="ml-2 text-xs text-primary"
                  @click.stop="copyDisposalNumber(disposal)"
                >
                  {{ copyingDisposalId === disposal._id ? 'Copied' : 'Copy' }}
                </button>
              </td>
              <td class="p-3">
                <span class="inline-block truncate max-w-[20rem]">{{
                  disposal.reasonDetails
                }}</span>
              </td>
              <td class="p-3">
                {{
                  Array.isArray(disposal.items) && disposal.items.length ? disposal.items.length : 1
                }}
              </td>
              <td class="p-3">
                <span
                  class="px-2 py-1 rounded text-xs"
                  :class="{
                    'bg-red-100 text-red-800': String(disposal.reason).includes('damaged'),
                    'bg-orange-100 text-orange-800':
                      String(disposal.reason).includes('unserviceable') ||
                      String(disposal.reason).includes('beyond'),
                    'bg-gray-100 text-gray-800': String(disposal.reason).includes('obsolete'),
                    'bg-yellow-100 text-yellow-800':
                      String(disposal.reason).includes('lost') ||
                      String(disposal.reason).includes('stolen') ||
                      String(disposal.reason).includes('other')
                  }"
                  >{{ disposal.reason }}</span
                >
              </td>
              <td class="p-3">
                <span
                  v-if="disposal.approvedByName"
                  class="px-2 py-1 rounded bg-green-100 text-green-800 text-xs"
                  >{{ disposal.approvedByName }}</span
                >
                <span v-else class="px-2 py-1 rounded bg-gray-100 text-gray-800 text-xs"
                  >Pending</span
                >
              </td>
              <td class="p-3">{{ new Date(disposal.disposalDate).toLocaleDateString() }}</td>
              <td class="p-3" @click.stop>
                <button
                  v-if="!disposal.approvedBy"
                  type="button"
                  class="rounded bg-primary text-white px-3 py-1 text-sm font-medium hover:bg-opacity-90 transition"
                  @click="openApprove(disposal)"
                >
                  Approve
                </button>
                <span v-else class="text-xs text-bodydark2">Approved</span>
              </td>
            </tr>
            <tr v-if="pagedDisposals.length === 0">
              <td colspan="7" class="py-10">
                <div class="mx-auto max-w-xl text-center">
                  <div class="text-lg font-semibold mb-2">No disposal records found</div>
                  <div class="text-sm text-bodydark2">
                    Adjust filters or create a new disposal record.
                  </div>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
        <div class="flex items-center justify-end gap-2 p-3">
          <button
            type="button"
            class="rounded border border-stroke px-3 py-1 text-xs"
            :disabled="dPage <= 1"
            @click="dPage = Math.max(1, dPage - 1)"
          >
            Prev
          </button>
          <span class="text-xs">Page {{ dPage }} of {{ totalDisposalPages }}</span>
          <button
            type="button"
            class="rounded border border-stroke px-3 py-1 text-xs"
            :disabled="dPage >= totalDisposalPages"
            @click="dPage = Math.min(totalDisposalPages, dPage + 1)"
          >
            Next
          </button>
        </div>
      </div>
    </div>

    <div
      v-if="bulkFormVisible"
      class="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50"
    >
      <div class="bg-white dark:bg-boxdark rounded shadow-lg w-full max-w-2xl">
        <div
          class="border-b border-stroke dark:border-strokedark p-4 flex items-center justify-between"
        >
          <h3 class="text-lg font-semibold">Bulk Dispose</h3>
          <button class="text-sm px-2 py-1 rounded border" @click="bulkFormVisible = false">
            Close
          </button>
        </div>
        <div class="p-6">
          <div class="mb-3">
            <label class="block text-sm mb-1">Reason</label>
            <select
              v-model="bulkReason"
              class="w-full border border-stroke rounded px-3 py-2 bg-white"
            >
              <option value="damaged_beyond_repair">Damaged Beyond Repair</option>
              <option value="unserviceable">Unserviceable</option>
              <option value="obsolete">Obsolete</option>
              <option value="lost">Lost</option>
              <option value="stolen">Stolen</option>
              <option value="other">Other</option>
            </select>
          </div>
          <div class="mb-3">
            <label class="block text-sm mb-1">Reason Details</label>
            <input
              v-model="bulkReasonDetails"
              type="text"
              class="w-full border border-stroke rounded px-3 py-2 bg-white"
            />
          </div>
          <div class="mb-3">
            <label class="block text-sm mb-1">Proof Images</label>
            <input
              type="file"
              multiple
              accept="image/*"
              @change="handleBulkImageUpload"
              class="w-full border rounded border-stroke px-3 py-2 bg-white"
            />
            <div v-if="bulkProofImages.length" class="mt-2 space-y-2">
              <div v-for="(img, i) in bulkProofImages" :key="i" class="flex items-center gap-3">
                <img :src="img.src || img" class="w-16 h-16 object-cover rounded border" />

                <div class="flex-1">
                  <label class="block text-xs mb-1">Image Name</label>
                  <input
                    v-model="img.name"
                    type="text"
                    placeholder="Auto on submit (last4-#)"
                    class="w-48 border rounded px-2 py-1 bg-white"
                  />
                </div>
                <div>
                  <button
                    type="button"
                    class="rounded border px-2 py-1 text-xs"
                    @click="removeBulkImage(i)"
                  >
                    Remove
                  </button>
                </div>
              </div>
            </div>
          </div>
          <div class="mb-3">
            <label class="block text-sm mb-1">Notes</label>
            <textarea
              v-model="bulkNotes"
              rows="3"
              class="w-full border border-stroke rounded px-3 py-2 bg-white"
            ></textarea>
          </div>
          <div class="mb-4">
            <div class="flex items-center justify-between mb-2">
              <h4 class="font-semibold text-sm">Manual Items (Optional)</h4>
              <button
                type="button"
                class="rounded bg-primary text-white px-3 py-1 text-xs hover:bg-opacity-90"
                @click="addManualItem"
              >
                Add Manual Item
              </button>
            </div>
            <div v-if="bulkManualItems.length" class="space-y-3">
              <div
                v-for="(it, idx) in bulkManualItems"
                :key="'man-' + idx"
                class="border border-stroke rounded p-3 bg-gray-50 dark:bg-meta-4"
              >
                <div class="flex items-center justify-between mb-2">
                  <div class="font-medium text-sm">Item #{{ idx + 1 }}</div>
                  <button
                    type="button"
                    class="rounded border px-2 py-1 text-xs"
                    @click="removeManualItem(idx)"
                  >
                    Remove
                  </button>
                </div>
                <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div>
                    <label class="block text-sm mb-1">ACN (Optional)</label>
                    <AcnCombobox
                      v-model="it.acn"
                      placeholder="Search deployed ACN"
                      @select="(p) => onManualAcnSelect(idx, p)"
                    />
                  </div>
                  <div>
                    <label class="block text-sm mb-1">Serial Number</label>
                    <input
                      v-model="it.serialNumber"
                      type="text"
                      class="w-full border border-stroke rounded px-3 py-2 bg-white"
                    />
                  </div>
                  <div>
                    <label class="block text-sm mb-1">Description</label>
                    <div class="space-y-2">
                      <BaseCombobox
                        v-model="it._productId"
                        :options="productOptions"
                        labelKey="label"
                        valueKey="_id"
                        placeholder="Select item (optional)"
                        @change="(v) => onManualProductChange(idx, v)"
                      />
                      <input
                        v-model="it.description"
                        type="text"
                        class="w-full border border-stroke rounded px-3 py-2 bg-white"
                        placeholder="Or type description"
                      />
                    </div>
                  </div>
                  <div>
                    <label class="block text-sm mb-1">Department</label>
                    <BaseCombobox
                      v-model="it.department"
                      :options="departments"
                      labelKey="name"
                      valueKey="name"
                      placeholder="Select department"
                    />
                  </div>
                  <div>
                    <label class="block text-sm mb-1">End User</label>
                    <EmployeeCombobox
                      v-model="it.endUser"
                      :department="it.department"
                      placeholder="Search employee"
                    />
                  </div>
                  <div class="md:col-span-2">
                    <label class="block text-sm mb-1">Remarks (Optional)</label>
                    <input
                      v-model="it.remarks"
                      type="text"
                      class="w-full border border-stroke rounded px-3 py-2 bg-white"
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>
          <div class="text-xs text-bodydark2 mb-4">
            Prepared By: <span class="font-medium">{{ auth.userDisplayName || '—' }}</span>
          </div>
          <div class="flex items-center justify-end gap-3">
            <button
              type="button"
              class="rounded border px-4 py-2 text-sm"
              @click="bulkFormVisible = false"
            >
              Cancel
            </button>
            <button
              type="button"
              class="rounded bg-primary text-white px-4 py-2 text-sm font-medium hover:bg-opacity-90 transition"
              :disabled="bulkSubmitting || bulkProofImages.length === 0"
              @click="submitBulkDisposal"
            >
              {{ bulkSubmitting ? 'Submitting...' : 'Submit Bulk' }}
            </button>
          </div>
          <div v-if="bulkSubmitMessage" class="mt-3 text-sm">{{ bulkSubmitMessage }}</div>
        </div>
      </div>
    </div>

    <div
      v-if="approveModalOpen"
      class="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50"
    >
      <div class="bg-white dark:bg-boxdark rounded shadow-lg w-full max-w-2xl">
        <div
          class="border-b border-stroke dark:border-strokedark p-4 flex items-center justify-between"
        >
          <h3 class="text-lg font-semibold">Approve Disposal</h3>
          <button class="text-sm px-2 py-1 rounded border" @click="closeApprove">Close</button>
        </div>
        <div class="p-6">
          <div class="mb-3 text-sm">
            Disposal #:
            <span class="font-mono font-medium">{{ approveTarget?.disposalNumber || '—' }}</span>
          </div>
          <div class="mb-3">
            <label class="block text-sm mb-1">Upload GSD Proof Images</label>
            <input
              type="file"
              multiple
              accept="image/*"
              @change="handleApproveImageUpload"
              class="w-full border rounded border-stroke px-3 py-2 bg-white"
            />
            <div v-if="approveImages.length" class="mt-2 space-y-2">
              <div v-for="(img, i) in approveImages" :key="i" class="flex items-center gap-3">
                <img :src="img.src" class="w-16 h-16 object-cover rounded border" />
                <div class="flex-1">
                  <label class="block text-xs mb-1">Image Name</label>
                  <input
                    v-model="img.name"
                    type="text"
                    placeholder="Auto on submit (NNNN-GSD-#)"
                    class="w-48 border rounded px-2 py-1 bg-white"
                  />
                </div>
                <div>
                  <button
                    type="button"
                    class="rounded border px-2 py-1 text-xs"
                    @click="removeApproveImage(i)"
                  >
                    Remove
                  </button>
                </div>
              </div>
            </div>
          </div>
          <div v-if="approveError" class="mb-3 p-2 rounded bg-danger/10 text-danger text-sm">
            {{ approveError }}
          </div>
          <div class="flex items-center justify-end gap-3">
            <button type="button" class="rounded border px-4 py-2 text-sm" @click="closeApprove">
              Cancel
            </button>
            <button
              type="button"
              class="rounded bg-primary text-white px-4 py-2 text-sm font-medium hover:bg-opacity-90 transition"
              :disabled="approveSubmitting || approveImages.length === 0"
              @click="submitApprove"
            >
              {{ approveSubmitting ? 'Approving...' : 'Submit Approval' }}
            </button>
          </div>
        </div>
      </div>
    </div>
  </DefaultLayout>
</template>
