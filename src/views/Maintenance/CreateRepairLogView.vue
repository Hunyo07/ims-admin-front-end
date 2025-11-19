<script setup>
import { ref, onMounted, computed } from 'vue'
import { useRouter } from 'vue-router'
import axios from '@/utils/axios'
import DefaultLayout from '@/layouts/DefaultLayout.vue'
import EmployeeCombobox from '@/components/EmployeeCombobox.vue'
import AcnCombobox from '@/components/AcnCombobox.vue'

const router = useRouter()

const form = ref({
  acn: '',
  purpose: '',
  remarks: '',
  broughtByName: '',
  broughtByEmployeeId: '',
  technicianName: '',
  status: 'for_inspection'
})
const loading = ref(false)
const error = ref('')
const success = ref('')
const createdLog = ref(null)
const downloading = ref(false)

// Modal state
const isOpen = ref(false)
const close = () => {
  isOpen.value = false
  // Navigate back to previous page after closing
  router.back()
}
onMounted(() => {
  isOpen.value = true
})
// Selected ACN item details (for display-only)
const selectedItem = ref(null)
const selectedRecord = ref(null)
const onAcnSelect = (payload) => {
  form.value.acn = payload?.acn || ''
  selectedItem.value = payload?.item || null
  selectedRecord.value = payload?.record || null
  // If the inventory item has an endUser/MR, default requester
  const defaultRequester = payload?.item?.endUserOrMR || ''
  if (defaultRequester && !form.value.broughtByName) {
    form.value.broughtByName = defaultRequester
  }
}
// Dynamic preview helpers: render only existing fields
const isSecondary = computed(() => !!selectedItem.value?._selectedSecondary)
const descText = computed(() => {
  if (isSecondary.value) {
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
  if (isSecondary.value) return selectedItem.value?._selectedSecondary?.type || ''
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
  if (isSecondary.value) return false
  const s = selectedItem.value?.specs || {}
  return !!(s.processor || s.storage || s.ram || s.videoCard)
})

const submit = async () => {
  error.value = ''
  success.value = ''
  if (!form.value.remarks || !form.value.remarks.trim()) {
    error.value = 'Remarks is required.'
    return
  }
  loading.value = true
  try {
    const payload = {
      acn: form.value.acn || undefined,
      purpose: form.value.purpose || 'Repair & Maintenance',
      remarks: form.value.remarks || undefined,
      status: form.value.status || 'under_repair',
      broughtBy: {
        name: form.value.broughtByName || '',
        employee: form.value.broughtByEmployeeId || undefined
      },
      technician: { name: form.value.technicianName || '' }
    }
    payload.serialNumber =
      (isSecondary.value
        ? selectedItem.value?._selectedSecondary?.serialNumber
        : selectedItem.value?.serialNumber) || undefined
    payload.inventoryRecordId = selectedRecord.value?._id || undefined
    payload.itemId = selectedItem.value?._id || undefined
    const { data } = await axios.post('/maintenance/logs', payload)
    if (!data?.success) throw new Error(data?.message || 'Failed to create repair log')
    success.value = `Created Repair Log ${data.log?.logNumber}`
    createdLog.value = data.log || null
    await downloadLabel()
  } catch (e) {
    error.value = e.response?.data?.message || e.message || String(e)
  } finally {
    loading.value = false
  }
}

const downloadLabel = async () => {
  if (!createdLog.value) return
  downloading.value = true
  try {
    const name = form.value.broughtByName || ''
    const dept = selectedRecord.value?.department || ''
    const dstr = new Date(createdLog.value?.date || Date.now()).toISOString().slice(0, 10)
    const remarks = form.value.remarks || ''
    const canvas = document.createElement('canvas')
    canvas.width = 800
    canvas.height = 600
    const ctx = canvas.getContext('2d')
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, 0, canvas.width, canvas.height)
    ctx.fillStyle = '#000000'
    ctx.font = 'bold 28px Arial'
    ctx.fillText(`Repair Log Number: ${createdLog.value?.logNumber || ''}`, 30, 60)
    ctx.font = '20px Arial'
    ctx.fillText(`Brought By: ${name}`, 30, 120)
    ctx.fillText(`Department: ${dept}`, 30, 160)
    ctx.fillText(`Date: ${dstr}`, 30, 200)
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
    const blob = await new Promise((resolve) => {
      canvas.toBlob((b) => resolve(b || new Blob()), 'image/png')
    })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `repair-label-${createdLog.value.logNumber}.png`
    document.body.appendChild(a)
    a.click()
    a.remove()
    setTimeout(() => URL.revokeObjectURL(url), 0)
  } catch (e) {
    error.value = e?.message || 'Failed to download label'
  } finally {
    downloading.value = false
  }
}
</script>

<template>
  <DefaultLayout>
    <!-- Modal overlay and container -->
    <div v-if="isOpen" class="fixed inset-0 z-50">
      <div class="absolute inset-0 bg-black/30" @click="close"></div>
      <div class="absolute inset-0 mt-15 flex items-center justify-center p-4 sm:p-6">
        <div
          class="w-full max-w-full sm:max-w-2xl md:max-w-4xl lg:max-w-5xl my-6 sm:my-8 rounded-sm border border-stroke bg-white shadow-default dark:border-strokedark dark:bg-boxdark max-h-[90vh] flex flex-col"
        >
          <!-- Modal Body -->
          <div class="p-4 overflow-y-auto">
            <div
              class="bg-white dark:bg-boxdark z-10 flex items-center justify-between border-b border-stroke dark:border-strokedark"
            >
              <div>
                <h2 class="text-xl font-semibold text-black dark:text-white">Create Respair Log</h2>
                <p class="text-xs text-bodydark2">Record a new maintenance or repair activity</p>
              </div>
              <div class="flex items-center gap-2">
                <button
                  @click="downloadLabel"
                  :disabled="downloading || !createdLog"
                  class="px-3 py-1 rounded border border-stroke bg-white text-black hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed text-sm"
                >
                  {{ downloading ? 'Preparing...' : 'Download Label' }}
                </button>
                <button
                  type="button"
                  @click="close"
                  class="px-3 py-1 rounded bg-gray-100 hover:bg-gray-200 text-sm"
                >
                  Close
                </button>
              </div>
            </div>
            <div
              v-if="error"
              class="mb-3 p-3 rounded bg-danger/10 text-danger text-sm border border-danger/20"
            >
              {{ error }}
            </div>
            <div
              v-if="success"
              class="mb-3 p-3 rounded bg-success/10 text-success text-sm border border-success/20"
            >
              {{ success }}
              <div class="mt-2">
                <button
                  v-if="createdLog"
                  @click="downloadLabel"
                  :disabled="downloading"
                  class="px-3 py-1 rounded-sm border border-stroke bg-white text-black hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {{ downloading ? 'Preparing...' : 'Download Label' }}
                </button>
              </div>
            </div>

            <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
              <!-- Left: Selection and form -->
              <div class="space-y-4">
                <div>
                  <label class="block text-sm font-medium mb-2">ACN</label>
                  <AcnCombobox
                    v-model="form.acn"
                    placeholder="Search deployed ACN"
                    @select="onAcnSelect"
                  />
                  <p class="text-xs text-bodydark2 mt-1">
                    Choose a deployed ACN to auto-populate item details
                  </p>
                </div>

                <div>
                  <label class="block text-sm font-medium mb-2">Purpose</label>
                  <input
                    v-model="form.purpose"
                    class="w-full border border-stroke rounded px-3 py-2 bg-gray-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-gray-200 focus:border-gray-300"
                    placeholder="Purpose"
                  />
                </div>

                <div>
                  <label class="block text-sm font-medium mb-2">Remarks</label>
                  <textarea
                    required
                    v-model="form.remarks"
                    class="w-full border border-stroke rounded px-3 py-2 bg-gray-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-gray-200 focus:border-gray-300"
                    placeholder="Remarks"
                    rows="4"
                  ></textarea>
                </div>

                <div>
                  <label class="block text-sm font-medium mb-2">Brought By</label>
                  <EmployeeCombobox
                    v-model="form.broughtByName"
                    placeholder="Search employee"
                    :limit="200"
                    @select="
                      (emp) => {
                        form.value
                          ? (form.value.broughtByEmployeeId = emp._id)
                          : (form.broughtByEmployeeId = emp._id)
                        form.broughtByName = `${emp.firstName} ${emp.lastName}`
                      }
                    "
                  />
                </div>

                <div>
                  <label class="block text-sm font-medium mb-2">Technician Name</label>
                  <input
                    v-model="form.technicianName"
                    class="w-full border border-stroke rounded px-3 py-2 bg-gray-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-gray-200 focus:border-gray-300"
                    placeholder="Technician Name"
                  />
                </div>

                <div>
                  <label class="block text-sm font-medium mb-2">Status</label>
                  <select
                    v-model="form.status"
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
                    @click="submit"
                    :disabled="loading"
                    class="px-4 py-2 rounded-sm border border-stroke bg-primary text-white hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {{ loading ? 'Creating...' : 'Create Log' }}
                  </button>
                  <button
                    @click="downloadLabel"
                    :disabled="downloading || !createdLog"
                    class="px-4 py-2 rounded-sm border border-stroke bg-white text-black hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {{ downloading ? 'Preparing...' : 'Download Label' }}
                  </button>
                  <button
                    type="button"
                    @click="close"
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
                  <div class="text-lg font-semibold">{{ form.acn || '—' }}</div>
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
                    isSecondary &&
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
/* Minimal form tweaks for a clean, neutral appearance */
.text-primary {
  color: #1a56db;
}
</style>
