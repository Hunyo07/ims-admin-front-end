<script setup>
import { ref, onMounted, computed } from 'vue'
import { useRouter } from 'vue-router'
import axios from '@/utils/axios'
import DefaultLayout from '@/layouts/DefaultLayout.vue'
import { useAuthStore } from '@/stores'

const router = useRouter()
const auth = useAuthStore()

const logs = ref([])
const loading = ref(false)
const error = ref('')
const selected = ref({})
const selectAll = ref(false)

const reason = ref('damaged_beyond_repair')
const reasonDetails = ref('')
const notes = ref('')
const proofImages = ref([])
const submitting = ref(false)
const submitMessage = ref('')

const selectedCount = computed(() => Object.values(selected.value).filter(Boolean).length)

const fetchForDisposalLogs = async () => {
  loading.value = true
  error.value = ''
  try {
    const { data } = await axios.get('/maintenance/logs', { params: { status: 'for_disposal' } })
    const list = Array.isArray(data.logs) ? data.logs : []
    logs.value = list
    selected.value = {}
    selectAll.value = false
  } catch (e) {
    error.value = e?.response?.data?.message || e.message || 'Failed to load for-disposal logs'
  } finally {
    loading.value = false
  }
}

onMounted(fetchForDisposalLogs)

const toggleSelectAll = () => {
  const v = selectAll.value
  const map = {}
  logs.value.forEach((l) => {
    map[String(l._id)] = v
  })
  selected.value = map
}

const handleImageUpload = (e) => {
  const files = Array.from(e.target.files || [])
  files.forEach((file) => {
    const reader = new FileReader()
    reader.onload = (evt) => {
      const src = evt?.target?.result
      if (src) proofImages.value.push(src)
    }
    reader.readAsDataURL(file)
  })
}

const toName = () => {
  const n = auth.userDisplayName
  return n || 'Unknown'
}

const buildPayloadForLog = async (log) => {
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
  return {
    inventoryRecordId,
    itemId,
    acn,
    serialNumber,
    description,
    reason: reason.value || 'damaged_beyond_repair',
    reasonDetails: reasonDetails.value || '',
    proofImages: proofImages.value,
    notes: notes.value || '',
    preparedByName: toName(auth.user)
  }
}

const submitBulk = async () => {
  if (!selectedCount.value) {
    submitMessage.value = 'Select at least one item'
    return
  }
  submitting.value = true
  submitMessage.value = ''
  try {
    const ids = Object.keys(selected.value).filter((id) => selected.value[id])
    let ok = 0
    let fail = 0
    for (const id of ids) {
      try {
        const log = logs.value.find((l) => String(l._id) === String(id))
        if (!log) {
          fail++
          continue
        }
        const payload = await buildPayloadForLog(log)
        const { data } = await axios.post('/disposal', payload)
        if (data?.disposal?._id) ok++
        else fail++
      } catch (_) {
        fail++
      }
    }
    submitMessage.value = `Created ${ok} disposal record${ok !== 1 ? 's' : ''}${fail ? `, ${fail} failed` : ''}`
    await fetchForDisposalLogs()
    router.push('/disposal')
  } catch (e) {
    submitMessage.value = e?.response?.data?.message || e.message || 'Bulk creation failed'
  } finally {
    submitting.value = false
  }
}
</script>

<template>
  <DefaultLayout>
    <div class="p-6">
      <div class="flex items-center justify-between mb-6">
        <div>
          <h1 class="text-2xl font-bold text-black dark:text-white">Bulk Disposal</h1>
          <p class="text-sm text-bodydark2 mt-1">Select items marked for disposal and create records</p>
        </div>
        <button
          type="button"
          class="rounded border border-stroke px-4 py-2 text-sm font-medium hover:bg-gray-50 dark:hover:bg-meta-4 transition"
          @click="router.push('/disposal')"
        >
          ← Back to List
        </button>
      </div>

      <div class="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div class="md:col-span-2 rounded-sm border border-stroke bg-white shadow-default dark:border-strokedark dark:bg-boxdark">
          <div class="border-b border-stroke dark:border-strokedark p-4 flex items-center justify-between">
            <div class="flex items-center gap-3">
              <label class="inline-flex items-center gap-2 text-sm">
                <input type="checkbox" v-model="selectAll" @change="toggleSelectAll" />
                <span>Select All</span>
              </label>
              <span class="text-xs text-bodydark2">Selected: {{ selectedCount }}</span>
            </div>
            <button
              type="button"
              class="rounded bg-primary text-white px-4 py-2 text-sm font-medium hover:bg-opacity-90 transition"
              :disabled="submitting || !selectedCount"
              @click="submitBulk"
            >
              {{ submitting ? 'Disposing...' : 'Bulk Dispose' }}
            </button>
          </div>

          <div v-if="loading" class="p-6 text-sm">Loading items marked for disposal...</div>
          <div v-else-if="error" class="p-6 text-danger text-sm">{{ error }}</div>
          <div v-else>
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
                <tr v-for="l in logs" :key="l._id" class="border-t">
                  <td class="py-2 px-4">
                    <input type="checkbox" v-model="selected[l._id]" />
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
                <tr v-if="logs.length === 0">
                  <td colspan="5" class="py-8 text-center text-sm text-bodydark2">No items marked for disposal</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        <div class="rounded-sm border border-stroke bg-white shadow-default dark:border-strokedark dark:bg-boxdark p-4">
          <div class="mb-3">
            <label class="block text-sm mb-1">Reason</label>
            <select v-model="reason" class="w-full border rounded px-3 py-2 bg-white">
              <option value="damaged_beyond_repair">Damaged Beyond Repair</option>
              <option value="obsolete">Obsolete</option>
              <option value="lost">Lost</option>
              <option value="stolen">Stolen</option>
              <option value="other">Other</option>
            </select>
          </div>
          <div class="mb-3">
            <label class="block text-sm mb-1">Reason Details</label>
            <input v-model="reasonDetails" type="text" class="w-full border rounded px-3 py-2 bg-white" />
          </div>
          <div class="mb-3">
            <label class="block text-sm mb-1">Proof Images</label>
            <input type="file" multiple accept="image/*" @change="handleImageUpload" class="w-full border rounded px-3 py-2 bg-white" />
            <div v-if="proofImages.length" class="flex gap-2 mt-2">
              <img v-for="(img, i) in proofImages" :key="i" :src="img" class="w-16 h-16 object-cover rounded" />
            </div>
          </div>
          <div class="mb-3">
            <label class="block text-sm mb-1">Notes</label>
            <textarea v-model="notes" rows="3" class="w-full border rounded px-3 py-2 bg-white"></textarea>
          </div>
          <div class="text-xs text-bodydark2">
            Prepared By: <span class="font-medium">{{ auth.userDisplayName || '—' }}</span>
          </div>
          <div v-if="submitMessage" class="mt-3 text-sm" :class="submitting ? 'text-bodydark2' : 'text-success'">{{ submitMessage }}</div>
        </div>
      </div>
    </div>
  </DefaultLayout>
</template>

<style scoped>
.bg-primary { background-color: #1a56db; }
.text-primary { color: #1a56db; }
</style>