<script setup>
import { ref, onMounted, computed, watch } from 'vue'
import { useRouter } from 'vue-router'
import axios from '@/utils/axios'
import DefaultLayout from '@/layouts/DefaultLayout.vue'
import EmployeeCombobox from '@/components/EmployeeCombobox.vue'
import AcnRepairCombobox from '@/components/AcnRepairCombobox.vue'

const router = useRouter()

const form = ref({
  acn: '',
  purpose: '',
  remarks: '',
  broughtByName: '',
  broughtByEmployeeId: '',
  technicianName: '',
  status: 'for_inspection',
  repairType: 'inside',
  outsideDescription: '',
  outsideSerialNumber: '',
  outsideAcn: ''
})
const repairTypeOptions = [
  { value: 'inside', label: 'Inside (Walk-in)' },
  { value: 'outside', label: 'Outside (Not in System)' },
  { value: 'on-site', label: 'On-site (On-call Service)' }
]
const loading = ref(false)
const error = ref('')
const success = ref('')
const createdLog = ref(null)
const downloading = ref(false)
const statsLoading = ref(false)
const statsError = ref('')
const stats = ref({
  total: 0,
  outside: 0,
  repaired: 0,
  under_repair: 0,
  byStatus: {},
  avgRepairDays: 0,
  byTechnician: []
})
const fromDate = ref(new Date().toISOString().slice(0, 10))
const toDate = ref(new Date().toISOString().slice(0, 10))
const barcodeInput = ref(null)
const barcodeScan = ref('')
const acnComboboxRef = ref(null)
const remarksInput = ref(null)

// Modal state
const isOpen = ref(false)
const close = () => {
  isOpen.value = false
  // Navigate back to previous page after closing
  router.back()
}
const handleBarcodeScan = async () => {
  const scannedCode = barcodeScan.value?.trim()
  if (!scannedCode) return
  
  try {
    // Search for inventory by ACN, serial number, or property number
    const { data } = await axios.get('/inventory-records', {
      params: { limit: 500, status: 'deployed' }
    })
    
    const records = Array.isArray(data?.records) ? data.records : []
    const codeUpper = scannedCode.toUpperCase()
    
    // Find matching item
    let foundRecord = null
    let foundItem = null
    let isSecondary = false
    
    for (const rec of records) {
      for (const item of rec.items || []) {
        // Check primary item
        if (String(item.acn || '').toUpperCase() === codeUpper ||
            String(item.propertyNumber || '').toUpperCase() === codeUpper ||
            String(item.serialNumber || '').toUpperCase() === codeUpper) {
          foundRecord = rec
          foundItem = item
          break
        }
        
        // Check secondary items
        for (const secondary of item.secondaryItems || []) {
          if (String(secondary.acn || '').toUpperCase() === codeUpper ||
              String(secondary.propertyNumber || '').toUpperCase() === codeUpper ||
              String(secondary.serialNumber || '').toUpperCase() === codeUpper) {
            foundRecord = rec
            foundItem = { ...item, _selectedSecondary: secondary }
            isSecondary = true
            break
          }
        }
        
        if (foundRecord) break
      }
      if (foundRecord) break
    }
    
    if (foundRecord && foundItem) {
      const acn = foundItem._selectedSecondary?.acn || 
                  foundItem._selectedSecondary?.propertyNumber ||
                  foundItem.acn || 
                  foundItem.propertyNumber || 
                  scannedCode
      
      form.value.acn = acn
      selectedItem.value = foundItem
      selectedRecord.value = foundRecord
      
      const defaultRequester = foundItem?.endUserOrMR || ''
      if (defaultRequester && !form.value.broughtByName) {
        form.value.broughtByName = defaultRequester
      }
      
      try {
        const { data: drData } = await axios.get('/delivery-receipts', {
          params: { limit: 500 }
        })
        
        const receipts = Array.isArray(drData?.receipts) ? drData.receipts : []
        
        for (const receipt of receipts) {
          for (const item of receipt.items || []) {
            const acnMatch = String(item.generatedACNs?.[0] || '').toUpperCase() === codeUpper
            
            if (acnMatch && item.warranty) {
              if (selectedItem.value) {
                selectedItem.value.warranty = item.warranty
              }
              break
            }
          }
        }
      } catch (warrantyErr) {
        console.warn('Could not fetch warranty data:', warrantyErr)
      }
      
      barcodeScan.value = ''
      
      setTimeout(() => {
        if (remarksInput.value && typeof remarksInput.value.focus === 'function') {
          remarksInput.value.focus()
        }
      }, 100)
    }
  } catch (e) {
    console.error('Barcode scan error:', e)
  }
}

onMounted(() => {
  isOpen.value = true
  fetchStats()
  if (barcodeInput.value && typeof barcodeInput.value.focus === 'function') {
    setTimeout(() => barcodeInput.value?.focus(), 100)
  }
})
// Selected ACN item details (for display-only)
const selectedItem = ref(null)
const selectedRecord = ref(null)
const onAcnSelect = async (payload) => {
  form.value.acn = payload?.acn || ''
  selectedItem.value = payload?.item || null
  selectedRecord.value = payload?.record || null
  const defaultRequester = payload?.item?.endUserOrMR || ''
  if (defaultRequester && !form.value.broughtByName) {
    form.value.broughtByName = defaultRequester
  }
  
  try {
    const { data } = await axios.get('/delivery-receipts', {
      params: { limit: 500 }
    })
    
    const receipts = Array.isArray(data?.receipts) ? data.receipts : []
    const acnCode = String(payload?.acn || '').toUpperCase()
    
    for (const receipt of receipts) {
      for (const item of receipt.items || []) {
        const acnMatch = String(item.generatedACNs?.[0] || '').toUpperCase() === acnCode
        
        if (acnMatch && item.warranty) {
          if (selectedItem.value) {
            selectedItem.value.warranty = item.warranty
          }
          break
        }
      }
    }
  } catch (e) {
    console.warn('Could not fetch warranty data:', e)
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

const warrantyInfo = computed(() => {
  const w = selectedItem.value?.warranty
  if (!w || !w.expiryDate) return null
  
  try {
    const now = new Date()
    const expiry = new Date(w.expiryDate)
    
    if (isNaN(expiry.getTime())) return null
    
    const isActive = now < expiry
    const daysRemaining = Math.ceil((expiry.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
    const monthsRemaining = Math.floor(daysRemaining / 30)
    
    return {
      isActive,
      duration: w.duration || 0,
      startDate: w.startDate ? new Date(w.startDate).toLocaleDateString() : '',
      expiryDate: new Date(w.expiryDate).toLocaleDateString(),
      provider: w.provider || 'Unknown',
      daysRemaining: Math.max(0, daysRemaining),
      monthsRemaining: Math.max(0, monthsRemaining)
    }
  } catch (e) {
    console.warn('Error calculating warranty info:', e)
    return null
  }
})

const submit = async () => {
  error.value = ''
  success.value = ''
  if (!form.value.remarks || !form.value.remarks.trim()) {
    error.value = 'Remarks is required.'
    return
  }
  const isOutside = form.value.repairType === 'outside'
  if (isOutside && !form.value.outsideDescription?.trim()) {
    error.value = 'Description is required for Outside Repair.'
    return
  }
  loading.value = true
  try {
    const desc = isOutside ? (form.value.outsideDescription || '').trim() : ''
    const combinedRemarks = desc
      ? `${desc}${form.value.remarks ? ' — ' + form.value.remarks : ''}`
      : form.value.remarks || undefined
    const payload = {
      acn: isOutside ? form.value.outsideAcn || undefined : form.value.acn || undefined,
      purpose: isOutside
        ? 'Outside Repair'
        : form.value.purpose || 'Repair & Maintenance',
      remarks: combinedRemarks,
      status: form.value.status || 'for_inspection',
      repairType: form.value.repairType || 'inside',
      broughtBy: {
        name: form.value.broughtByName || '',
        employee: form.value.broughtByEmployeeId || undefined
      },
      technician: { name: form.value.technicianName || '' }
    }
    payload.serialNumber = isOutside
      ? form.value.outsideSerialNumber || undefined
      : (isSecondary.value
          ? selectedItem.value?._selectedSecondary?.serialNumber
          : selectedItem.value?.serialNumber) || undefined
    payload.inventoryRecordId = isOutside
      ? undefined
      : selectedRecord.value?._id || undefined
    payload.itemId = isOutside ? undefined : selectedItem.value?._id || undefined
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

const fetchStats = async () => {
  statsLoading.value = true
  statsError.value = ''
  try {
    const { data } = await axios.get('/maintenance/logs', {
      params: { dateFrom: fromDate.value, dateTo: toDate.value }
    })
    const logs = Array.isArray(data?.logs) ? data.logs : []
    const map = {}
    const tech = {}
    let sumDays = 0
    let cntDays = 0
    let outside = 0
    let repaired = 0
    let under = 0
    for (const l of logs) {
      const st = String(l?.status || '')
      map[st] = (map[st] || 0) + 1
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
            (new Date(l.repairDetails.dateRepaired).getTime() - new Date(l.date).getTime()) /
              86400000
          )
        )
        sumDays += days
        cntDays++
      }
    }
    const byTechnician = Object.entries(tech)
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count)
    stats.value = {
      total: logs.length,
      outside,
      repaired,
      under_repair: under,
      byStatus: map,
      avgRepairDays: cntDays ? Number((sumDays / cntDays).toFixed(1)) : 0,
      byTechnician
    }
  } catch (e) {
    statsError.value = e?.response?.data?.message || e.message || 'Failed to load stats'
  } finally {
    statsLoading.value = false
  }
}

watch([fromDate, toDate], () => fetchStats())

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
            <div class="mb-4 rounded border border-stroke bg-gray-50 p-3">
              <div class="flex items-center gap-2">
                <input type="date" v-model="fromDate" class="rounded border px-3 py-2" />
                <input type="date" v-model="toDate" class="rounded border px-3 py-2" />
                <button class="rounded border px-3 py-1" @click="fetchStats">Refresh</button>
                <span v-if="statsLoading" class="text-xs">Loading...</span>
                <span v-if="statsError" class="text-danger text-xs">{{ statsError }}</span>
              </div>
              <div class="grid grid-cols-2 md:grid-cols-4 gap-2 mt-3">
                <div class="bg-white rounded p-3">
                  <div class="text-xs text-bodydark2">Total Repairs</div>
                  <div class="text-lg font-semibold">{{ stats.total }}</div>
                </div>
                <div class="bg-white rounded p-3">
                  <div class="text-xs text-bodydark2">Outside Repairs</div>
                  <div class="text-lg font-semibold">{{ stats.outside }}</div>
                </div>
                <div class="bg-white rounded p-3">
                  <div class="text-xs text-bodydark2">Repaired</div>
                  <div class="text-lg font-semibold">{{ stats.repaired }}</div>
                </div>
                <div class="bg-white rounded p-3">
                  <div class="text-xs text-bodydark2">Under Repair</div>
                  <div class="text-lg font-semibold">{{ stats.under_repair }}</div>
                </div>
              </div>
              <div class="mt-3 grid grid-cols-1 md:grid-cols-3 gap-2">
                <div class="bg-white rounded p-3">
                  <div class="text-xs text-bodydark2">Avg Repair Time</div>
                  <div class="text-lg font-semibold">{{ stats.avgRepairDays }} days</div>
                </div>
                <div class="bg-white rounded p-3">
                  <div class="text-xs text-bodydark2">Statuses</div>
                  <div class="flex flex-wrap gap-2 text-xs mt-1">
                    <span
                      v-for="(count, st) in stats.byStatus"
                      :key="st"
                      class="px-2 py-1 rounded bg-gray-100"
                      >{{ st }}: {{ count }}</span
                    >
                  </div>
                </div>
                <div class="bg-white rounded p-3">
                  <div class="text-xs text-bodydark2">Top Technicians</div>
                  <div class="text-xs mt-1">
                    <div v-for="t in stats.byTechnician.slice(0, 3)" :key="t.name">
                      {{ t.name || '—' }}: {{ t.count }}
                    </div>
                  </div>
                </div>
              </div>
            </div>
            <div
              class="bg-white dark:bg-boxdark z-10 flex items-center justify-between border-b border-stroke dark:border-strokedark"
            >
              <div>
                <h2 class="text-xl font-semibold text-black dark:text-white">Create Repair Log</h2>
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
                <div class="border-b border-stroke pb-4">
                  <label class="block text-sm font-medium mb-2">Quick Barcode Scanner</label>
                  <input
                    ref="barcodeInput"
                    v-model="barcodeScan"
                    @keyup.enter="handleBarcodeScan"
                    placeholder="Scan ACN, serial number, or property number here"
                    class="w-full border border-stroke rounded px-3 py-2 bg-blue-50 focus:bg-blue-100 focus:outline-none focus:ring-2 focus:ring-blue-200 focus:border-blue-300 font-medium"
                  />
                  <p class="text-xs text-bodydark2 mt-1">
                    Press Enter to scan or use your barcode scanner device
                  </p>
                </div>

                <div>
                  <label class="block text-sm font-medium mb-2">Repair Type</label>
                  <div class="space-y-2">
                    <label v-for="opt in repairTypeOptions" :key="opt.value" class="flex items-center gap-2 cursor-pointer">
                      <input type="radio" :value="opt.value" v-model="form.repairType" name="repairType" />
                      <span class="text-sm">{{ opt.label }}</span>
                    </label>
                  </div>
                </div>
                <div v-if="form.repairType !== 'outside'">
                  <label class="block text-sm font-medium mb-2">ACN</label>
                  <AcnRepairCombobox
                    v-model="form.acn"
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
                      v-model="form.outsideDescription"
                      class="w-full border border-stroke rounded px-3 py-2 bg-gray-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-gray-200 focus:border-gray-300"
                      placeholder="Item description"
                    />
                  </div>
                  <div>
                    <label class="block text-sm font-medium mb-2">Serial Number</label>
                    <input
                      v-model="form.outsideSerialNumber"
                      class="w-full border border-stroke rounded px-3 py-2 bg-gray-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-gray-200 focus:border-gray-300"
                      placeholder="Serial number (optional)"
                    />
                  </div>
                  <div>
                    <label class="block text-sm font-medium mb-2">ACN</label>
                    <input
                      v-model="form.outsideAcn"
                      class="w-full border border-stroke rounded px-3 py-2 bg-gray-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-gray-200 focus:border-gray-300"
                      placeholder="ACN (optional)"
                    />
                  </div>
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
              <div v-if="!outsideRepair" class="rounded-sm border border-stroke bg-gray-50 p-4">
                <div class="mb-3">
                  <div class="text-sm text-bodydark2">Selected ACN</div>
                  <div class="text-lg font-semibold">{{ form.acn || '—' }}</div>
                </div>

                <!-- Warranty Status -->
                <div
                  v-if="warrantyInfo"
                  class="mb-4 p-3 rounded border-2"
                  :class="{
                    'bg-green-50 border-green-300': warrantyInfo.isActive,
                    'bg-red-50 border-red-300': !warrantyInfo.isActive
                  }"
                >
                  <div
                    class="font-semibold text-sm mb-2"
                    :class="{
                      'text-green-700': warrantyInfo.isActive,
                      'text-red-700': !warrantyInfo.isActive
                    }"
                  >
                    {{
                      warrantyInfo.isActive
                        ? '✓ Under Warranty'
                        : '✗ Out of Warranty'
                    }}
                  </div>
                  <div class="text-xs space-y-1" :class="{
                    'text-green-600': warrantyInfo.isActive,
                    'text-red-600': !warrantyInfo.isActive
                  }">
                    <div v-if="warrantyInfo.isActive">
                      <strong>{{ warrantyInfo.monthsRemaining }}</strong> months remaining
                      <span v-if="warrantyInfo.daysRemaining <= 30" class="ml-1 font-semibold">({{ warrantyInfo.daysRemaining }} days)</span>
                    </div>
                    <div v-else>
                      Expired {{ warrantyInfo.daysRemaining === 0 ? 'today' : warrantyInfo.daysRemaining + ' days ago' }}
                    </div>
                    <div class="mt-1 opacity-75">
                      Expires: {{ warrantyInfo.expiryDate }}
                    </div>
                    <div class="mt-1 opacity-75">
                      Duration: {{ warrantyInfo.duration }} months | Provider: {{ warrantyInfo.provider }}
                    </div>
                  </div>
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
