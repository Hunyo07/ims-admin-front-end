<script setup>
import { ref, onMounted, computed, nextTick } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import axios from '@/utils/axios'
import DefaultLayout from '@/layouts/DefaultLayout.vue'

const route = useRoute()
const router = useRouter()

const borrow = ref(null)
const loading = ref(false)
const error = ref('')
const showReturnModal = ref(false)
const returnDate = ref('')
const returnBy = ref('')
const returnRemarks = ref('')
const returning = ref(false)
const returnImages = ref([])
const cameraActive = ref(false)
const cameraStream = ref(null)
const cameraError = ref('')
const videoEl = ref(null)

const id = computed(() => String(route.params.id || ''))

async function fetchBorrow() {
  if (!id.value) return
  loading.value = true
  error.value = ''
  try {
    const { data } = await axios.get(`/borrow/${id.value}`)
    borrow.value = data?.borrow || null
  } catch (e) {
    error.value = e?.response?.data?.message || e.message || 'Failed to load borrow request'
  } finally {
    loading.value = false
  }
}

onMounted(fetchBorrow)
onMounted(() => {
  if (String(route.query?.return || '') === '1') openReturn()
})

function formatDate(d) {
  if (!d) return '—'
  try {
    return new Date(d).toLocaleString()
  } catch (_) {
    return String(d)
  }
}

function fullName(u) {
  if (!u) return '—'
  if (typeof u === 'string') return u
  const first = u.firstName || ''
  const last = u.lastName || ''
  const name = `${first} ${last}`.trim()
  return name || u.email || '—'
}

function statusLabel(s) {
  if (s === 'active') return 'Out'
  if (s === 'approved') return 'Approved'
  if (s === 'returned') return 'Returned'
  if (s === 'pending') return 'Pending'
  if (s === 'overdue') return 'Overdue'
  return s || '—'
}

async function openReturn() {
  const d = new Date()
  const pad = (n) => String(n).padStart(2, '0')
  const v = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(
    d.getHours()
  )}:${pad(d.getMinutes())}`
  returnDate.value = v
  returnBy.value = ''
  returnRemarks.value = ''
  returnImages.value = []
  cameraError.value = ''
  cameraActive.value = false
  showReturnModal.value = true
  await startCamera()
}

async function issueBorrow() {
  if (!id.value) return
  loading.value = true
  try {
    await axios.patch(`/borrow/${id.value}/issue`)
    await fetchBorrow()
  } catch (e) {
    error.value = e?.response?.data?.message || e.message
  } finally {
    loading.value = false
  }
}

async function submitReturn() {
  if (!id.value) return
  returning.value = true
  try {
    if (returnImages.value.length === 0) {
      error.value = 'Please capture at least one return photo'
      returning.value = false
      return
    }
    const images = returnImages.value.map((img) => img.src || img)
    await axios.patch(`/borrow/${id.value}/return`, {
      actualReturnDate: returnDate.value,
      returnBy: returnBy.value,
      returnNotes: returnRemarks.value,
      images
    })
    stopCamera()
    showReturnModal.value = false
    await fetchBorrow()
  } catch (e) {
    error.value = e?.response?.data?.message || e.message
  } finally {
    returning.value = false
  }
}

function removeReturnImage(i) {
  if (typeof i === 'number' && i >= 0 && i < returnImages.value.length) {
    returnImages.value.splice(i, 1)
  }
}

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
  returnImages.value.push({ src: dataUrl })
}
</script>

<template>
  <DefaultLayout>
    <div class="mb-6 flex items-center justify-between">
      <div>
        <h1 class="text-2xl font-bold text-black dark:text-white">Borrow Request</h1>
        <p class="text-sm text-bodydark2 mt-1">View borrow details</p>
      </div>
      <button
        class="rounded border border-stroke px-4 py-2 text-sm hover:bg-gray-50 dark:hover:bg-meta-4"
        @click="router.push('/borrow')"
      >
        ← Back to List
      </button>
    </div>

    <div
      class="rounded-sm border border-stroke bg-white shadow-default dark:border-strokedark dark:bg-boxdark"
    >
      <div class="border-b border-stroke dark:border-strokedark p-6">
        <div class="flex items-start justify-between">
          <div>
            <h2 class="text-xl font-semibold">{{ borrow?.borrowNumber || '—' }}</h2>
            <p class="text-xs text-bodydark2 mt-1">Borrow ID: {{ id }}</p>
          </div>
          <div class="text-right">
            <div class="text-xs text-bodydark2">Status</div>
            <div class="inline-flex items-center gap-2 mt-1">
              <span
                class="px-2 py-1 text-xs rounded"
                :class="{
                  'bg-yellow-100 text-yellow-700': borrow?.status === 'pending',
                  'bg-blue-100 text-blue-700': borrow?.status === 'approved',
                  'bg-green-100 text-green-700': borrow?.status === 'active',
                  'bg-gray-100 text-gray-700': borrow?.status === 'returned',
                  'bg-red-100 text-red-700': borrow?.status === 'overdue'
                }"
              >
                {{ statusLabel(borrow?.status) }}
              </span>
            </div>
            <div class="mt-2 flex items-center gap-2 justify-end">
              <button
                v-if="borrow?.status === 'approved'"
                class="rounded border border-stroke px-3 py-1 text-xs hover:bg-gray-50 dark:hover:bg-meta-4"
                @click="issueBorrow"
              >
                Issue Items
              </button>
              <button
                v-if="borrow?.status === 'active'"
                class="rounded border border-stroke px-3 py-1 text-xs hover:bg-gray-50 dark:hover:bg-meta-4"
                @click="openReturn"
              >
                Return Items
              </button>
            </div>
            <div v-if="borrow?.status === 'active' && borrow?.expectedReturnDate">
              <span
                v-if="new Date(borrow.expectedReturnDate) < new Date()"
                class="mt-2 inline-flex items-center px-2 py-0.5 rounded bg-red-100 text-red-700 text-xs"
              >
                Overdue
              </span>
            </div>
          </div>
        </div>
      </div>

      <div class="p-6">
        <div v-if="loading" class="text-sm">Loading borrow request...</div>
        <div v-else-if="error" class="text-danger text-sm">{{ error }}</div>

        <div v-else-if="borrow">
          <!-- Borrower Info -->
          <div class="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            <div>
              <div class="text-xs text-bodydark2 mb-1">Borrower</div>
              <div class="text-sm font-medium">{{ borrow.borrower || '—' }}</div>
            </div>
            <div>
              <div class="text-xs text-bodydark2 mb-1">Department</div>
              <div class="text-sm font-medium">{{ borrow.borrowerDepartment || '—' }}</div>
            </div>
            <div>
              <div class="text-xs text-bodydark2 mb-1">Contact</div>
              <div class="text-sm font-medium">{{ borrow.borrowerContact || '—' }}</div>
            </div>
          </div>

          <!-- Purpose and Dates -->
          <div class="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            <div>
              <div class="text-xs text-bodydark2 mb-1">Purpose</div>
              <div class="text-sm font-medium">{{ borrow.purpose || '—' }}</div>
            </div>
            <div>
              <div class="text-xs text-bodydark2 mb-1">Date Borrowed</div>
              <div class="text-sm font-medium">{{ formatDate(borrow.dateBorrowed) }}</div>
            </div>
            <div>
              <div class="text-xs text-bodydark2 mb-1">Expected Return Date</div>
              <div class="text-sm font-medium">{{ formatDate(borrow.expectedReturnDate) }}</div>
            </div>
            <div>
              <div class="text-xs text-bodydark2 mb-1">Actual Return Date</div>
              <div class="text-sm font-medium">{{ formatDate(borrow.actualReturnDate) }}</div>
            </div>
          </div>

          <!-- Workflow Actors -->
          <div class="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            <div class="p-3 rounded bg-gray-50 dark:bg-meta-4">
              <div class="text-xs text-bodydark2 mb-1">Approved By</div>
              <div class="text-sm font-medium">{{ fullName(borrow.approvedBy) }}</div>
              <div class="text-xs mt-1">{{ formatDate(borrow.approvedAt) }}</div>
            </div>
            <div class="p-3 rounded bg-gray-50 dark:bg-meta-4">
              <div class="text-xs text-bodydark2 mb-1">Issued By</div>
              <div class="text-sm font-medium">{{ fullName(borrow.issuedBy) }}</div>
            </div>
            <div class="p-3 rounded bg-gray-50 dark:bg-meta-4">
              <div class="text-xs text-bodydark2 mb-1">Returned To</div>
              <div class="text-sm font-medium">{{ fullName(borrow.returnedTo) }}</div>
              <div class="text-xs text-bodydark2">Return By: {{ borrow.returnBy || '—' }}</div>
              <div class="text-xs">{{ formatDate(borrow.actualReturnDate) }}</div>
            </div>
          </div>

          <!-- Items -->
          <div class="mb-6">
            <h3 class="text-lg font-semibold mb-3">Items ({{ borrow.items?.length || 0 }})</h3>
            <div v-if="borrow.items?.length" class="overflow-x-auto">
              <table class="min-w-full text-sm">
                <thead>
                  <tr class="text-left border-b border-stroke dark:border-strokedark">
                    <th class="py-2 pr-4">Product</th>
                    <th class="py-2 pr-4">Name</th>
                    <th class="py-2 pr-4">Serial</th>
                    <th class="py-2 pr-4">ACN</th>
                    <th class="py-2 pr-4">Qty</th>
                  </tr>
                </thead>
                <tbody>
                  <tr
                    v-for="(it, idx) in borrow.items"
                    :key="idx"
                    class="border-b border-stroke/50 dark:border-strokedark/50"
                  >
                    <td class="py-2 pr-4">
                      {{ typeof it.product === 'object' ? it.product?.name : it.product }}
                    </td>
                    <td class="py-2 pr-4">{{ it.name || '—' }}</td>
                    <td class="py-2 pr-4">{{ it.serialNumber || '—' }}</td>
                    <td class="py-2 pr-4">{{ it.acn || '—' }}</td>
                    <td class="py-2 pr-4">{{ it.quantity ?? 1 }}</td>
                  </tr>
                </tbody>
              </table>
            </div>
            <div v-else class="text-sm text-bodydark2 p-4">No items</div>
          </div>

          <!-- Actions -->
          <div class="mb-6" v-if="borrow?.status === 'active'">
            <button
              class="rounded border border-stroke px-4 py-2 text-sm hover:bg-gray-50 dark:hover:bg-meta-4"
              @click="openReturn"
            >
              Return Items
            </button>
          </div>

          <!-- Notes -->
          <div v-if="borrow?.notes" class="mb-6">
            <div class="text-xs text-bodydark2 mb-1">Notes</div>
            <div class="text-sm bg-gray-50 dark:bg-meta-4 p-3 rounded">{{ borrow.notes }}</div>
          </div>

          <div v-if="borrow?.borrowPhotos?.length" class="mb-6">
            <div class="text-xs text-bodydark2 mb-1">Borrow Photos</div>
            <div class="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              <div
                v-for="(p, i) in borrow.borrowPhotos"
                :key="(p.url || p) + i"
                class="rounded border border-stroke dark:border-strokedark p-2"
              >
                <img
                  :src="p.url || p"
                  alt="Borrow Photo"
                  class="w-full object-cover rounded"
                  style="aspect-ratio: 1/1"
                />
                <a
                  :href="p.url || p"
                  target="_blank"
                  class="text-primary text-xs font-medium hover:underline mt-2 inline-block"
                  >View Full Image →</a
                >
              </div>
            </div>
          </div>

          <!-- Return Modal -->
          <div
            v-if="showReturnModal"
            class="fixed inset-0 bg-black/30 flex items-center justify-center z-50 p-4"
          >
            <div
              class="bg-white grid grid-cols-2 rounded p-4 w-full max-w-[60%] max-h-[80vh] overflow-y-auto"
            >
              <div class="m-1">
                <h3 class="text-lg font-semibold mb-2">Return Items</h3>
                <div class="grid grid-cols-1 gap-3 mb-3">
                  <div>
                    <label class="block text-sm mb-1">Actual Return Date & Time</label>
                    <input
                      v-model="returnDate"
                      type="datetime-local"
                      step="1"
                      required
                      class="w-full border border-stroke rounded px-3 py-2"
                    />
                  </div>
                  <div>
                    <label class="block text-sm mb-1">Return By</label>
                    <input
                      v-model="returnBy"
                      type="text"
                      class="w-full border border-stroke rounded px-3 py-2"
                      placeholder="Person returning"
                    />
                  </div>
                  <div>
                    <label class="block text-sm mb-1">Remarks</label>
                    <textarea
                      v-model="returnRemarks"
                      rows="3"
                      class="w-full border border-stroke rounded px-3 py-2"
                    ></textarea>
                  </div>
                </div>
              </div>
              <div class="m-1 max-w-full flex-row items-center justify-center">
                <label class="block text-sm mb-1">Return Photos</label>
                <div class="flex items-center gap-2 mb-2">
                  <button
                    v-if="!cameraActive"
                    class="rounded border px-3 py-1"
                    @click="startCamera"
                  >
                    Open Camera
                  </button>
                  <button v-else class="rounded border px-3 py-1" @click="stopCamera">
                    Stop Camera
                  </button>
                  <span v-if="cameraError" class="text-danger text-xs">{{ cameraError }}</span>
                </div>
                <div v-if="cameraActive" class="space-y-2">
                  <video
                    ref="videoEl"
                    playsinline
                    autoplay
                    class="w-full max-w-[280px] mx-auto object-cover rounded border"
                    style="aspect-ratio: 1/1"
                  />
                  <div class="flex items-center gap-2">
                    <button class="rounded border px-3 py-1" @click="capturePhoto">
                      Capture Photo
                    </button>
                  </div>
                </div>

                <div v-if="returnImages.length" class="mt-2 grid grid-cols-3 gap-2">
                  <div v-for="(img, i) in returnImages" :key="i" class="relative">
                    <img
                      :src="img.src || img"
                      class="w-full object-cover rounded border"
                      style="aspect-ratio: 1/1"
                    />
                    <button
                      type="button"
                      class="absolute top-1 right-1 bg-black/60 text-white text-xs rounded px-1"
                      @click="removeReturnImage(i)"
                    >
                      <p class="text-black">Remove</p>
                    </button>
                  </div>
                </div>
              </div>
              <div class="flex gap-2 justify-end">
                <button
                  class="border px-4 py-2 rounded"
                  @click="(showReturnModal = false), stopCamera()"
                >
                  Cancel
                </button>
                <button
                  class="bg-primary text-white px-4 py-2 rounded"
                  :disabled="returning || !returnImages.length"
                  @click="submitReturn"
                >
                  {{ returning ? 'Submitting...' : 'Submit Return' }}
                </button>
              </div>
            </div>
          </div>

          <div v-if="borrow?.returnNotes" class="mb-6">
            <div class="text-xs text-bodydark2 mb-1">Return Notes</div>
            <div class="text-sm bg-gray-50 dark:bg-meta-4 p-3 rounded">
              {{ borrow.returnNotes }}
            </div>
          </div>
          <div v-if="borrow?.returnPhotos?.length" class="mb-6">
            <div class="text-xs text-bodydark2 mb-1">Return Photos</div>
            <div class="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              <div
                v-for="(p, i) in borrow.returnPhotos"
                :key="(p.url || p) + i"
                class="rounded border border-stroke dark:border-strokedark p-2"
              >
                <img
                  :src="p.url || p"
                  alt="Return Photo"
                  class="w-full object-cover rounded"
                  style="aspect-ratio: 1/1"
                />
                <a
                  :href="p.url || p"
                  target="_blank"
                  class="text-primary text-xs font-medium hover:underline mt-2 inline-block"
                  >View Full Image →</a
                >
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </DefaultLayout>
</template>
