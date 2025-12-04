<script setup>
import { ref, onMounted, watch, computed, nextTick } from 'vue'
import { useRouter } from 'vue-router'
import axios from '@/utils/axios'
import DefaultLayout from '@/layouts/DefaultLayout.vue'
import BreadcrumbDefault from '@/components/Breadcrumbs/BreadcrumbDefault.vue'
import EmployeeCombobox from '@/components/EmployeeCombobox.vue'
import AcnCombobox from '@/components/AcnCombobox.vue'

const router = useRouter()
const borrower = ref('')
const borrowerDepartment = ref('')
const borrowerContact = ref('')
const purpose = ref('')
const expectedReturnDate = ref('')
const notes = ref('')
const items = ref([])
const departments = ref([])
const loading = ref(false)
const error = ref(null)
const borrowImages = ref([])
const cameraActive = ref(false)
const cameraStream = ref(null)
const cameraError = ref('')
const videoEl = ref(null)
const today = new Date()
today.setDate(today.getDate() + 1)
const minDate = today.toISOString().split('T')[0]
// Barcode scanner state
const barcodeScan = ref('')
const barcodeInputRef = ref(null)
const scanningBarcode = ref(false)

// Removed fetchProducts - no longer needed

const fetchDepartments = async () => {
  try {
    const { data } = await axios.get('/departments')
    const list = data?.departments || data || []
    departments.value = Array.isArray(list) ? list : []
  } catch (err) {
    departments.value = []
    console.error('Error fetching departments:', err)
  }
}

watch(
  () => borrowerDepartment.value,
  () => {
    borrower.value = ''
    borrowerContact.value = ''
  }
)

const addItem = () => {
  items.value.push({
    name: '',
    serialNumber: '',
    acn: '',
    quantity: 1,
    multi: [],
    inventoryRecordId: null,
    itemId: null
  })
}

const removeItem = (index) => items.value.splice(index, 1)

// Removed onProductSelect - no longer needed

const onAcnSelect = (index, payload) => {
  try {
    const it = items.value[index]
    const sec = payload?.item?._selectedSecondary || null
    const serial = sec?.serialNumber || payload?.item?.serialNumber || payload?.serialNumber || ''
    // If multi-ACN mode, fill next available slot
    if (Number(it.quantity || 1) > 1) {
      ensureMultiLength(it)
      const k = Math.max(
        0,
        (it.multi || []).findIndex((m) => !norm(m.acn))
      )
      const idx = k === -1 ? 0 : k
      onAcnMultiSelect(index, idx, payload)
    } else {
      it.acn = payload?.acn || it.acn || ''
      it.serialNumber = serial || it.serialNumber || ''
    }
    const pname = payload?.item?.productName || payload?.product?.name || ''
    const descr = payload?.item?.description || ''
    it.name = pname || descr || it.name || ''
    it.inventoryRecordId = payload?.record?._id || it.inventoryRecordId
    it.itemId = payload?.item?._id || it.itemId
  } catch (_) {
    void 0
  }
}

const ensureMultiLength = (item) => {
  const qty = Number(item.quantity || 1)
  if (!Array.isArray(item.multi)) item.multi = []
  if (qty < 1) item.quantity = 1
  while (item.multi.length < qty) {
    item.multi.push({ acn: '', serialNumber: '', inventoryRecordId: null, itemId: null })
  }
  if (item.multi.length > qty) item.multi.splice(qty)
}

const onQuantityChange = (index) => {
  const it = items.value[index]
  const q = Number(it.quantity || 1)
  it.quantity = q < 1 ? 1 : q
  if (it.quantity > 1) {
    // Seed first multi slot from single selection if present
    ensureMultiLength(it)
    if (norm(it.acn)) {
      it.multi[0] = {
        acn: it.acn,
        serialNumber: it.serialNumber,
        inventoryRecordId: it.inventoryRecordId || null,
        itemId: it.itemId || null
      }
    }
    // Clear single fields in multi mode
    it.acn = ''
    it.serialNumber = ''
    it.inventoryRecordId = null
    it.itemId = null
  } else {
    // Transition back to single mode: keep first slot
    ensureMultiLength(it)
    const first = it.multi[0] || { acn: '', serialNumber: '' }
    if (norm(first.acn)) {
      it.acn = first.acn
      it.serialNumber = first.serialNumber
      it.inventoryRecordId = first.inventoryRecordId || null
      it.itemId = first.itemId || null
    }
    // Collapse multi list
    it.multi = []
  }
}

const onAcnMultiSelect = (index, k, payload) => {
  try {
    const it = items.value[index]
    ensureMultiLength(it)
    const row = it.multi[k]
    row.acn = payload?.acn || row.acn || ''
    const sec = payload?.item?._selectedSecondary || null
    const serial = sec?.serialNumber || payload?.item?.serialNumber || payload?.serialNumber || ''
    row.serialNumber = serial || row.serialNumber || ''
    const pname = payload?.item?.productName || payload?.product?.name || ''
    const descr = payload?.item?.description || ''
    if (pname || descr) it.name = pname || descr || it.name || ''
    row.inventoryRecordId = payload?.record?._id || row.inventoryRecordId
    row.itemId = payload?.item?._id || row.itemId
  } catch (_) {
    void 0
  }
}

// Removed fetchSerialsForProduct - no longer needed

const norm = (s) =>
  String(s || '')
    .trim()
    .toUpperCase()
const duplicateAcnSet = computed(() => {
  const list = []
  for (const it of items.value || []) {
    const single = norm(it.acn)
    if (single) list.push(single)
    for (const m of it.multi || []) {
      const mc = norm(m.acn)
      if (mc) list.push(mc)
    }
  }
  const seen = new Set()
  const dup = new Set()
  for (const code of list) {
    if (seen.has(code)) dup.add(code)
    else seen.add(code)
  }
  return dup
})
// Removed getSerialOptionsForProduct - no longer needed

const submitBorrow = async () => {
  if (
    !borrower.value ||
    !borrowerDepartment.value ||
    !purpose.value ||
    !expectedReturnDate.value ||
    !items.value.length
  ) {
    error.value = 'Please fill all required fields'
    return
  }
  if (borrowImages.value.length === 0) {
    error.value = 'Please capture at least one photo for this borrow request'
    return
  }
  loading.value = true
  error.value = null
  try {
    // Validate and expand items
    const expanded = []
    let invalid = false
    for (const it of items.value || []) {
      const qty = Number(it.quantity || 1)
      if (qty <= 1) {
        const hasAcn = !!norm(it.acn)
        if (!hasAcn) {
          invalid = true
          break
        }
        expanded.push({ ...it, quantity: 1 })
      } else {
        ensureMultiLength(it)
        const filled = (it.multi || []).filter((m) => !!norm(m.acn))
        if (filled.length !== qty) {
          invalid = true
          break
        }
        for (const m of it.multi) {
          expanded.push({
            name: it.name,
            acn: m.acn,
            serialNumber: m.serialNumber,
            quantity: 1,
            inventoryRecordId: m.inventoryRecordId,
            itemId: m.itemId
          })
        }
      }
    }
    const hasDup = expanded.some((it) => duplicateAcnSet.value.has(norm(it.acn)))
    if (invalid) {
      error.value = 'For quantity > 1, select the same number of ACNs.'
      loading.value = false
      return
    }
    if (hasDup) {
      error.value = 'Duplicate ACN detected. Please remove duplicates.'
      loading.value = false
      return
    }
    const { data } = await axios.post('/borrow', {
      borrower: borrower.value,
      borrowerDepartment: borrowerDepartment.value,
      borrowerContact: borrowerContact.value,
      purpose: purpose.value,
      expectedReturnDate: expectedReturnDate.value,
      items: expanded,
      notes: notes.value,
      images: borrowImages.value.map((img) => img.src || img)
    })
    router.push({ name: 'borrow-detail', params: { id: data.borrow._id } })
  } catch (err) {
    error.value = err.response?.data?.message || err.message
  } finally {
    loading.value = false
  }
}

// Handle barcode scan
const handleBarcodeScan = async () => {
  const scannedValue = barcodeScan.value.trim()
  if (!scannedValue) return

  scanningBarcode.value = true
  try {
    // Search for ACN by the scanned value (could be ACN, serial, or barcode)
    const { data } = await axios.get('/inventory-records', {
      params: { limit: 100, page: 1 }
    })
    const records = Array.isArray(data?.records) ? data.records : []

    // Find matching item by ACN, serial, or property number
    let foundItem = null
    let foundRecord = null
    const searchUpper = scannedValue.toUpperCase()

    for (const rec of records) {
      for (const it of rec.items || []) {
        const acn = String(it.acn || '').toUpperCase()
        const serial = String(it.serialNumber || '').toUpperCase()
        const prop = String(it.propertyNumber || '').toUpperCase()

        if (acn === searchUpper || serial === searchUpper || prop === searchUpper) {
          foundItem = it
          foundRecord = rec
          break
        }

        // Check secondary items
        if (it.secondaryItems && Array.isArray(it.secondaryItems)) {
          for (const sec of it.secondaryItems) {
            const secAcn = String(sec.acn || '').toUpperCase()
            const secSerial = String(sec.serialNumber || '').toUpperCase()
            if (secAcn === searchUpper || secSerial === searchUpper) {
              foundItem = { ...it, _selectedSecondary: sec }
              foundRecord = rec
              break
            }
          }
        }
        if (foundItem) break
      }
      if (foundItem) break
    }

    if (foundItem && foundRecord) {
      // Auto-populate the first empty item slot or create a new one
      let targetIndex = items.value.findIndex((it) => !norm(it.acn))
      if (targetIndex === -1) {
        addItem()
        targetIndex = items.value.length - 1
      }

      const payload = {
        acn: foundItem._selectedSecondary?.acn || foundItem.acn,
        serialNumber: foundItem._selectedSecondary?.serialNumber || foundItem.serialNumber,
        item: foundItem,
        record: foundRecord,
        product: foundItem.productId || foundItem.product,
        productName: foundItem.description || foundItem.productName
      }

      onAcnSelect(targetIndex, payload)

      // Clear barcode input
      barcodeScan.value = ''
      if (barcodeInputRef.value) {
        barcodeInputRef.value.focus()
      }
    } else {
      error.value = `No item found with ACN/Serial: ${scannedValue}`
      setTimeout(() => {
        error.value = null
      }, 3000)
    }
  } catch (err) {
    error.value = err.response?.data?.message || 'Failed to search for item'
    setTimeout(() => {
      error.value = null
    }, 3000)
  } finally {
    scanningBarcode.value = false
  }
}

onMounted(() => {
  fetchDepartments()
  addItem()
  // Focus barcode input on mount
  nextTick(() => {
    if (barcodeInputRef.value) {
      barcodeInputRef.value.focus()
    }
  })
})

async function startCamera() {
  cameraError.value = ''
  try {
    const stream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: 'environment' }
    })
    cameraStream.value = stream
    cameraActive.value = true
    await nextTick()
    if (videoEl.value) {
      videoEl.value.srcObject = stream
      videoEl.value.play?.()
    }
  } catch (e) {
    cameraError.value = 'Camera permission denied or unavailable'
    cameraActive.value = false
  }
}

function stopCamera() {
  const s = cameraStream.value
  if (s) {
    s.getTracks?.().forEach((t) => t.stop())
    cameraStream.value = null
  }
  if (videoEl.value) videoEl.value.srcObject = null
  cameraActive.value = false
}

function capturePhoto() {
  const video = videoEl.value
  if (!video) return
  const w = video.videoWidth || 640
  const h = video.videoHeight || 480
  const s = Math.min(w, h)
  const sx = Math.floor((w - s) / 2)
  const sy = Math.floor((h - s) / 2)
  const canvas = document.createElement('canvas')
  canvas.width = 640
  canvas.height = 640
  const ctx = canvas.getContext('2d')
  if (!ctx) return
  ctx.drawImage(video, sx, sy, s, s, 0, 0, 640, 640)
  const dataUrl = canvas.toDataURL('image/jpeg', 0.9)
  borrowImages.value.push({ src: dataUrl })
}

function removeBorrowImage(i) {
  if (typeof i === 'number' && i >= 0 && i < borrowImages.value.length) {
    borrowImages.value.splice(i, 1)
  }
}
</script>

<template>
  <DefaultLayout>
    <BreadcrumbDefault pageTitle="Create Borrow Request" />
    <div class="p-6">
      <div class="bg-white rounded shadow p-6">
        <div v-if="error" class="bg-red-100 text-red-700 p-3 rounded mb-4">{{ error }}</div>

        <form @submit.prevent="submitBorrow">
          <div class="grid grid-cols-2 gap-4 mb-4">
            <div>
              <label class="block mb-2">Department <span class="text-red-500">*</span></label>
              <BaseCombobox
                v-model="borrowerDepartment"
                :options="departments"
                labelKey="name"
                valueKey="name"
                placeholder="Select department"
              />
            </div>
            <div>
              <label class="block mb-2">Borrower <span class="text-red-500">*</span></label>
              <EmployeeCombobox
                v-model="borrower"
                :department="borrowerDepartment"
                :disabled="!borrowerDepartment"
                :strictDepartment="true"
                :limit="1000"
                :key="borrowerDepartment || 'none'"
                placeholder="Search employee"
                @select="
                  (emp) => {
                    borrowerContact = emp?.phoneNumber || emp?.email || borrowerContact
                  }
                "
              />
              <div v-if="!borrowerDepartment" class="text-xs text-bodydark2 mt-1">
                Select department first
              </div>
            </div>
            <div>
              <label class="block mb-2">Contact</label>
              <input
                v-model="borrowerContact"
                type="text"
                class="w-full border border-stroke rounded px-3 py-2"
              />
            </div>
            <div>
              <label class="block mb-2">
                Expected Return Date <span class="text-red-500">*</span>
              </label>

              <input
                v-model="expectedReturnDate"
                type="date"
                required
                :min="minDate"
                class="w-full border border-stroke rounded px-3 py-2"
              />
            </div>

            <div class="col-span-2">
              <label class="block mb-2">Purpose <span class="text-red-500">*</span></label>
              <textarea
                v-model="purpose"
                required
                class="w-full border border-stroke rounded px-3 py-2"
                rows="2"
              ></textarea>
            </div>
          </div>

          <div class="mb-4">
            <div class="mb-4 border-b border-stroke pb-4">
              <label class="block text-sm font-medium mb-2">Barcode Scanner</label>
              <input
                ref="barcodeInputRef"
                v-model="barcodeScan"
                @keyup.enter="handleBarcodeScan"
                placeholder="Scan ACN barcode here (or press Enter to search)"
                class="w-full border border-stroke rounded px-3 py-2 bg-blue-50 focus:bg-blue-100 focus:outline-none focus:ring-2 focus:ring-blue-200 focus:border-blue-300 font-medium"
                :disabled="scanningBarcode"
              />
              <p class="text-xs text-bodydark2 mt-1">
                Use your barcode scanner or type ACN and press Enter to auto-populate item details
              </p>
              <p v-if="scanningBarcode" class="text-xs text-blue-600 mt-1">Searching...</p>
            </div>

            <div class="flex justify-between items-center mb-2">
              <h3 class="font-semibold">Items</h3>
              <button
                type="button"
                @click="addItem"
                class="bg-blue-500 text-white px-4 py-1 rounded text-sm"
              >
                Add Item
              </button>
            </div>
            <div
              v-for="(item, index) in items"
              :key="index"
              class="border border-stroke rounded p-3 mb-2"
            >
              <div class="grid grid-cols-3 gap-3">
                <div v-if="item.quantity === 1">
                  <label class="block text-sm mb-1">ACN <span class="text-red-500">*</span></label>
                  <AcnCombobox
                    v-model="item.acn"
                    placeholder="Type or search ACN"
                    @select="(p) => onAcnSelect(index, p)"
                  />
                  <div
                    v-if="item.acn && duplicateAcnSet.has((item.acn || '').trim().toUpperCase())"
                    class="text-xs text-red-600 mt-1"
                  >
                    Duplicate ACN
                  </div>
                </div>
                <div v-if="item.quantity === 1">
                  <label class="block text-sm mb-1">Item Name</label>
                  <input
                    v-model="item.name"
                    type="text"
                    readonly
                    class="w-full border border-stroke rounded px-3 py-2 bg-gray-50"
                    placeholder="Auto-filled from ACN"
                  />
                </div>
                <div v-if="item.quantity === 1">
                  <label class="block text-sm mb-1">Serial Number</label>
                  <input
                    v-model="item.serialNumber"
                    type="text"
                    readonly
                    class="w-full border border-stroke rounded px-3 py-2 bg-gray-50"
                    placeholder="Auto-filled from ACN"
                  />
                </div>
                <div v-else class="col-span-3">
                  <label class="block text-sm mb-1">ACNs <span class="text-red-500">*</span></label>
                  <div class="flex flex-col gap-2">
                    <div v-for="k in item.quantity" :key="k" class="flex items-center gap-2">
                      <AcnCombobox
                        v-model="item.multi[k - 1].acn"
                        placeholder="Select ACN"
                        @select="(p) => onAcnMultiSelect(index, k - 1, p)"
                      />
                      <span class="text-xs text-bodydark2">{{
                        item.multi[k - 1].serialNumber || '—'
                      }}</span>
                      <span
                        v-if="
                          item.multi[k - 1].acn &&
                          duplicateAcnSet.has((item.multi[k - 1].acn || '').trim().toUpperCase())
                        "
                        class="text-xs text-red-600"
                        >Duplicate</span
                      >
                    </div>
                  </div>
                </div>
                <div>
                  <label class="block text-sm mb-1">Quantity</label>
                  <input
                    v-model.number="item.quantity"
                    type="number"
                    min="1"
                    class="w-full border border-stroke rounded px-2 py-1 text-sm"
                    @input="onQuantityChange(index)"
                  />
                </div>
              </div>
              <button type="button" @click="removeItem(index)" class="text-red-500 text-sm mt-2">
                Remove
              </button>
            </div>
          </div>

          <div class="mb-4">
            <label class="block mb-2">Notes</label>
            <textarea
              v-model="notes"
              class="w-full border border-stroke rounded px-3 py-2"
              rows="2"
            ></textarea>
          </div>

          <div class="mb-4">
            <label class="block mb-2">Borrow Photos (Camera Capture)</label>
            <div class="flex items-center gap-2 mb-2">
              <button
                v-if="!cameraActive"
                type="button"
                class="rounded border px-3 py-1"
                @click="startCamera"
              >
                Open Camera
              </button>
              <button v-else type="button" class="rounded border px-3 py-1" @click="stopCamera">
                Stop Camera
              </button>
              <span v-if="cameraError" class="text-danger text-xs">{{ cameraError }}</span>
            </div>
            <div v-if="cameraActive" class="space-y-2">
              <video
                ref="videoEl"
                playsinline
                autoplay
                class="w-48 object-cover rounded border"
                style="aspect-ratio: 1/1"
              />
              <div class="flex items-center gap-2">
                <button type="button" class="rounded border px-3 py-1" @click="capturePhoto">
                  Capture Photo
                </button>
              </div>
            </div>
            <div v-if="borrowImages.length" class="mt-2 grid grid-cols-3 gap-2">
              <div v-for="(img, i) in borrowImages" :key="i" class="relative">
                <img
                  :src="img.src || img"
                  class="w-full object-cover rounded border"
                  style="aspect-ratio: 1/1"
                />

                <button
                  type="button"
                  class="absolute top-1 right-1 bg-black/60 text-white text-xs rounded px-1"
                  @click="removeBorrowImage(i)"
                >
                  Remove
                </button>
              </div>
            </div>
            <div class="text-xs text-bodydark2 mt-1">At least one captured photo is required.</div>
          </div>

          <div class="flex gap-2">
            <button
              type="submit"
              :disabled="loading || !borrowImages.length"
              class="bg-primary text-white px-6 py-2 rounded"
            >
              {{ loading ? 'Creating...' : 'Create Borrow Request' }}
            </button>
            <button type="button" @click="router.back()" class="border px-6 py-2 rounded">
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  </DefaultLayout>
</template>
