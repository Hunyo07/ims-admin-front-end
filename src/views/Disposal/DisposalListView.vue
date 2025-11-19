<script setup>
import { ref, onMounted, computed, watch } from 'vue'
import { useRouter } from 'vue-router'
import axios from '@/utils/axios'
import DefaultLayout from '@/layouts/DefaultLayout.vue'
import BreadcrumbDefault from '@/components/Breadcrumbs/BreadcrumbDefault.vue'
import { useAuthStore } from '@/stores'

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

    // Exclude logs already included in a pending disposal record
    try {
      const { data: dd } = await axios.get('/disposal')
      const alld = Array.isArray(dd?.disposals) ? dd.disposals : []
      const pendingDisposals = alld.filter((d) => !d?.approvedBy)
      const block = new Set()
      for (const d of pendingDisposals) {
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
    for (const l of pendingLogs.value) {
      let eu = ''
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
          }
        } catch (_) {
          eu = ''
        }
      }
      if (eu) cache[String(l._id)] = eu
    }
    endUserCache.value = cache
  } catch (e) {
    pendingError.value =
      e?.response?.data?.message || e.message || 'Failed to load for-disposal items'
  } finally {
    pendingLoading.value = false
  }
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
  if (ids.length === 0) {
    bulkSubmitMessage.value = 'Select at least one item'
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
    const preparedByStr = auth.userDisplayName || ''
    const notesOut = [bulkNotes.value || '', preparedByStr ? `Prepared by: ${preparedByStr}` : '']
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
  await Promise.all([fetchDisposals(), fetchPendingForDisposal()])
})
</script>

<template>
  <DefaultLayout>
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
            <label class="inline-flex items-center gap-2 text-sm">
              <input type="checkbox" v-model="pendingSelectAll" @change="togglePendingSelectAll" />
              <span>Select All</span>
            </label>
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
              <thead>
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
                <tr v-for="l in pendingLogs" :key="l._id" class="border-t">
                  <td class="py-2 px-4">
                    <input type="checkbox" v-model="pendingSelected[l._id]" />
                  </td>
                  <td class="py-2 px-4">
                    <span class="text-sm font-medium">{{ l.logNumber }}</span>
                  </td>
                  <td class="py-2 px-4">
                    <span class="text-sm font-mono">{{ l.acn || l.item?.acn || '—' }}</span>
                  </td>
                  <td class="py-2 px-4">
                    <span class="text-sm">{{
                      l.remarks || l.productName || l.item?.remarks || '—'
                    }}</span>
                  </td>

                  <td class="py-2 px-4">
                    <span class="text-sm font-mono">{{ l.serialNumber || '—' }}</span>
                  </td>
                  <td class="py-2 px-4">
                    <span class="text-sm">{{ endUserCache[l._id] || getEndUser(l) || '—' }}</span>
                  </td>
                  <td class="py-2 px-4">
                    <span class="text-sm">{{ l.inventoryRecordId?.department || '—' }}</span>
                  </td>
                  <td class="py-2 px-4">
                    <span class="text-sm">{{
                      l.remarks ||
                      (bulkReason === 'damaged_beyond_repair' ? 'DEFECTIVE' : bulkReason)
                    }}</span>
                  </td>
                </tr>
                <tr v-if="pendingLogs.length === 0">
                  <td colspan="8" class="py-8 text-center text-sm text-bodydark2">
                    No items marked for disposal
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <div v-if="loading" class="text-center py-8">Loading...</div>
      <div v-else class="bg-white rounded shadow">
        <table class="w-full">
          <thead class="bg-gray-100">
            <tr>
              <th class="p-3 text-left">Disposal #</th>
              <th class="p-3 text-left">Description</th>
              <th class="p-3 text-left">Reason</th>
              <th class="p-3 text-left">Approved By</th>
              <th class="p-3 text-left">Date</th>
              <th class="p-3 text-left">Action</th>
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="disposal in disposals"
              :key="disposal._id"
              @click="viewDisposal(disposal._id)"
              class="border-t hover:bg-gray-50 cursor-pointer"
            >
              <td class="p-3">{{ disposal.disposalNumber }}</td>
              <td class="p-3">{{ disposal.reasonDetails }}</td>
              <td class="p-3">
                <span class="px-2 py-1 bg-red-100 text-red-800 rounded text-xs">{{
                  disposal.reason
                }}</span>
              </td>
              <td class="p-3">{{ disposal.approvedByName || 'Pending' }}</td>
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
          </tbody>
        </table>
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

    <div v-if="approveModalOpen" class="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
      <div class="bg-white dark:bg-boxdark rounded shadow-lg w-full max-w-2xl">
        <div class="border-b border-stroke dark:border-strokedark p-4 flex items-center justify-between">
          <h3 class="text-lg font-semibold">Approve Disposal</h3>
          <button class="text-sm px-2 py-1 rounded border" @click="closeApprove">Close</button>
        </div>
        <div class="p-6">
          <div class="mb-3 text-sm">Disposal #: <span class="font-mono font-medium">{{ approveTarget?.disposalNumber || '—' }}</span></div>
          <div class="mb-3">
            <label class="block text-sm mb-1">Upload GSD Proof Images</label>
            <input type="file" multiple accept="image/*" @change="handleApproveImageUpload" class="w-full border rounded border-stroke px-3 py-2 bg-white" />
            <div v-if="approveImages.length" class="mt-2 space-y-2">
              <div v-for="(img, i) in approveImages" :key="i" class="flex items-center gap-3">
                <img :src="img.src" class="w-16 h-16 object-cover rounded border" />
                <div class="flex-1">
                  <label class="block text-xs mb-1">Image Name</label>
                  <input v-model="img.name" type="text" placeholder="Auto on submit (NNNN-GSD-#)" class="w-48 border rounded px-2 py-1 bg-white" />
                </div>
                <div>
                  <button type="button" class="rounded border px-2 py-1 text-xs" @click="removeApproveImage(i)">Remove</button>
                </div>
              </div>
            </div>
          </div>
          <div v-if="approveError" class="mb-3 p-2 rounded bg-danger/10 text-danger text-sm">{{ approveError }}</div>
          <div class="flex items-center justify-end gap-3">
            <button type="button" class="rounded border px-4 py-2 text-sm" @click="closeApprove">Cancel</button>
            <button type="button" class="rounded bg-primary text-white px-4 py-2 text-sm font-medium hover:bg-opacity-90 transition" :disabled="approveSubmitting || approveImages.length === 0" @click="submitApprove">
              {{ approveSubmitting ? 'Approving...' : 'Submit Approval' }}
            </button>
          </div>
        </div>
      </div>
    </div>
  </DefaultLayout>
</template>
