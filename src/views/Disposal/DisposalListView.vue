<script setup>
import { ref, onMounted } from 'vue'
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
    pendingLogs.value = list
    pendingSelected.value = {}
    pendingSelectAll.value = false
  } catch (e) {
    pendingError.value = e?.response?.data?.message || e.message || 'Failed to load for-disposal items'
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

const handleBulkImageUpload = (e) => {
  const files = Array.from(e.target.files || [])
  files.forEach((file) => {
    const reader = new FileReader()
    reader.onload = (evt) => {
      const src = evt?.target?.result
      if (src) bulkProofImages.value.push(src)
    }
    reader.readAsDataURL(file)
  })
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
      inventoryRecordId = inventoryRecordId || l?.inventoryRecordId?._id || l?.inventoryRecordId || ''
      itemId = itemId || l?.itemId?._id || l?.itemId || ''
    } catch (_) {
      void 0
    }
  }
  const preparedByStr = auth.userDisplayName || ''
  const notesOut = [bulkNotes.value || '', preparedByStr ? `Prepared by: ${preparedByStr}` : '']
    .filter(Boolean)
    .join('\n')
  return {
    inventoryRecordId,
    itemId,
    acn,
    serialNumber,
    description,
    reason: bulkReason.value || 'damaged_beyond_repair',
    reasonDetails: bulkReasonDetails.value || '',
    proofImages: bulkProofImages.value,
    notes: notesOut
  }
}

const submitBulkDisposal = async () => {
  const ids = Object.keys(pendingSelected.value).filter((id) => pendingSelected.value[id])
  if (ids.length === 0) {
    bulkSubmitMessage.value = 'Select at least one item'
    return
  }
  bulkSubmitting.value = true
  bulkSubmitMessage.value = ''
  try {
    let ok = 0
    let fail = 0
    for (const id of ids) {
      try {
        const log = pendingLogs.value.find((l) => String(l._id) === String(id))
        if (!log) {
          fail++
          continue
        }
        const payload = await buildBulkPayloadForLog(log)
        const { data } = await axios.post('/disposal', payload)
        if (data?.disposal?._id) ok++
        else fail++
      } catch (_) {
        fail++
      }
    }
    bulkSubmitMessage.value = `Created ${ok} disposal record${ok !== 1 ? 's' : ''}${fail ? `, ${fail} failed` : ''}`
    await Promise.all([fetchDisposals(), fetchPendingForDisposal()])
  } catch (e) {
    bulkSubmitMessage.value = e?.response?.data?.message || e.message || 'Bulk creation failed'
  } finally {
    bulkSubmitting.value = false
  }
}

const viewDisposal = (id) => router.push({ name: 'disposal-detail', params: { id } })
const createDisposal = () => router.push({ name: 'disposal-create' })

onMounted(async () => {
  await Promise.all([fetchDisposals(), fetchPendingForDisposal()])
})
</script>

<template>
  <DefaultLayout>
    <BreadcrumbDefault pageTitle="Disposal Records" />
    <div class="p-6">
      <div class="flex justify-end mb-4">
        <button @click="createDisposal" class="bg-primary text-white px-6 py-2 rounded">Create Disposal Record</button>
      </div>

      <div class="rounded-sm border border-stroke bg-white shadow-default dark:border-strokedark dark:bg-boxdark mb-6">
        <div class="border-b border-stroke dark:border-strokedark p-4 flex items-center justify-between">
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
              :disabled="bulkSubmitting || Object.values(pendingSelected).filter(Boolean).length === 0"
              @click="submitBulkDisposal"
            >
              {{ bulkSubmitting ? 'Disposing...' : 'Bulk Dispose' }}
            </button>
          </div>
        </div>
        <div v-if="pendingLoading" class="p-6 text-sm">Loading items marked for disposal...</div>
        <div v-else-if="pendingError" class="p-6 text-danger text-sm">{{ pendingError }}</div>
        <div v-else class="grid grid-cols-1 md:grid-cols-3 gap-4 p-4">
          <div class="md:col-span-2">
            <table class="w-full table-auto">
              <thead>
                <tr class="bg-gray-2 text-left dark:bg-meta-4">
                  <th class="py-3 px-4 text-sm">Select</th>
                  <th class="py-3 px-4 text-sm">Log #</th>
                  <th class="py-3 px-4 text-sm">ACN</th>
                  <th class="py-3 px-4 text-sm">Serial</th>
                  <th class="py-3 px-4 text-sm">Description</th>
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
                    <span class="text-sm font-mono">{{ l.acn || '—' }}</span>
                  </td>
                  <td class="py-2 px-4">
                    <span class="text-sm font-mono">{{ l.serialNumber || '—' }}</span>
                  </td>
                  <td class="py-2 px-4">
                    <span class="text-sm">{{ l.description || '—' }}</span>
                  </td>
                </tr>
                <tr v-if="pendingLogs.length === 0">
                  <td colspan="5" class="py-8 text-center text-sm text-bodydark2">No items marked for disposal</td>
                </tr>
              </tbody>
            </table>
          </div>
          <div>
            <div class="mb-3">
              <label class="block text-sm mb-1">Reason</label>
              <select v-model="bulkReason" class="w-full border rounded px-3 py-2 bg-white">
                <option value="damaged_beyond_repair">Damaged Beyond Repair</option>
                <option value="obsolete">Obsolete</option>
                <option value="lost">Lost</option>
                <option value="stolen">Stolen</option>
                <option value="other">Other</option>
              </select>
            </div>
            <div class="mb-3">
              <label class="block text-sm mb-1">Reason Details</label>
              <input v-model="bulkReasonDetails" type="text" class="w-full border rounded px-3 py-2 bg-white" />
            </div>
            <div class="mb-3">
              <label class="block text-sm mb-1">Proof Images</label>
              <input type="file" multiple accept="image/*" @change="handleBulkImageUpload" class="w-full border rounded px-3 py-2 bg-white" />
              <div v-if="bulkProofImages.length" class="flex gap-2 mt-2">
                <img v-for="(img, i) in bulkProofImages" :key="i" :src="img" class="w-16 h-16 object-cover rounded" />
              </div>
            </div>
            <div class="mb-3">
              <label class="block text-sm mb-1">Notes</label>
              <textarea v-model="bulkNotes" rows="3" class="w-full border rounded px-3 py-2 bg-white"></textarea>
            </div>
            <div class="text-xs text-bodydark2">
              Prepared By: <span class="font-medium">{{ auth.userDisplayName || '—' }}</span>
            </div>
            <div v-if="bulkSubmitMessage" class="mt-3 text-sm">{{ bulkSubmitMessage }}</div>
          </div>
        </div>
      </div>

      <div v-if="loading" class="text-center py-8">Loading...</div>
      <div v-else class="bg-white rounded shadow">
        <table class="w-full">
          <thead class="bg-gray-100">
            <tr>
              <th class="p-3 text-left">Disposal #</th>
              <th class="p-3 text-left">ACN</th>
              <th class="p-3 text-left">Serial</th>
              <th class="p-3 text-left">Description</th>
              <th class="p-3 text-left">Reason</th>
              <th class="p-3 text-left">Approved By</th>
              <th class="p-3 text-left">Date</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="disposal in disposals" :key="disposal._id" @click="viewDisposal(disposal._id)" class="border-t hover:bg-gray-50 cursor-pointer">
              <td class="p-3">{{ disposal.disposalNumber }}</td>
              <td class="p-3">{{ disposal.acn }}</td>
              <td class="p-3">{{ disposal.serialNumber }}</td>
              <td class="p-3">{{ disposal.description }}</td>
              <td class="p-3"><span class="px-2 py-1 bg-red-100 text-red-800 rounded text-xs">{{ disposal.reason }}</span></td>
              <td class="p-3">{{ disposal.approvedByName || 'Pending' }}</td>
              <td class="p-3">{{ new Date(disposal.disposalDate).toLocaleDateString() }}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  </DefaultLayout>
</template>
