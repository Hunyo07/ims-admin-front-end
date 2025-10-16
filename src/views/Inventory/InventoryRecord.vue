<script setup>
import { ref, onMounted, computed } from 'vue'
import axios from '../../utils/axios'
import DefaultLayout from '../../layouts/DefaultLayout.vue'
import BreadcrumbDefault from '../../components/Breadcrumbs/BreadcrumbDefault.vue'
import { useAuthStore } from '../../stores/auth'

const pageTitle = ref('Inventory Records')

// State
const records = ref([])
const isLoading = ref(false)
const errorMessage = ref(null)
const successMessage = ref(null)

// Filters
const filterDepartment = ref('')
const filterDate = ref('')
const filterSource = ref('')
const textSearch = ref('')

// Pagination
const currentPage = ref(1)
const pageSize = ref(10)

// Departments
const departments = ref([])
const authStore = useAuthStore()
const createdByName = computed(() => authStore?.user?.name || authStore?.user?.email || '')

// Details Modal
const isDetailsOpen = ref(false)
const selectedRecord = ref(null)

// Add Modal
const isAddOpen = ref(false)
const newRecord = ref({
  departmentId: '',
  department: '',
  notes: '',
  date: new Date().toISOString().slice(0, 10),
  items: [
    {
      description: '',
      processor: '',
      storage: '',
      ram: '',
      videoCard: '',
      monitorAndSerial: '',
      propertyNumber: '',
      printerOrScanner: '',
      endUserOrMR: '',
      remarksYears: ''
    }
  ]
})

// Inline row editor state for Add modal
const editingItemIndex = ref(null)
const tempItem = ref(null)

function resetAddForm() {
  newRecord.value = {
    departmentId: '',
    department: '',
    notes: '',
    date: new Date().toISOString().slice(0, 10),
    items: [
      {
        description: '',
        processor: '',
        storage: '',
        ram: '',
        videoCard: '',
        monitorAndSerial: '',
        propertyNumber: '',
        printerOrScanner: '',
        endUserOrMR: '',
        remarksYears: ''
      }
    ]
  }
}

function addItemRow() {
  newRecord.value.items.push({
    description: '',
    processor: '',
    storage: '',
    ram: '',
    videoCard: '',
    monitorAndSerial: '',
    propertyNumber: '',
    printerOrScanner: '',
    endUserOrMR: '',
    remarksYears: ''
  })
  // Immediately open editor for the newly added row
  const idx = newRecord.value.items.length - 1
  tempItem.value = { ...newRecord.value.items[idx] }
  editingItemIndex.value = idx
}

function removeItemRow(idx) {
  if (newRecord.value.items.length > 1) {
    newRecord.value.items.splice(idx, 1)
    if (editingItemIndex.value === idx) {
      editingItemIndex.value = null
      tempItem.value = null
    }
  }
}

function startEditItem(idx) {
  tempItem.value = { ...newRecord.value.items[idx] }
  editingItemIndex.value = idx
}

function saveEditItem() {
  if (editingItemIndex.value === null) return
  const idx = editingItemIndex.value
  newRecord.value.items[idx] = { ...tempItem.value }
  editingItemIndex.value = null
  tempItem.value = null
}

function cancelEditItem() {
  editingItemIndex.value = null
  tempItem.value = null
}

async function fetchRecords() {
  isLoading.value = true
  errorMessage.value = null
  try {
    const { data } = await axios.get('/inventory-records')
    records.value = Array.isArray(data) ? data : data?.records || []
  } catch (err) {
    console.error('Failed to fetch inventory records:', err)
    errorMessage.value = err?.response?.data?.message || err.message || 'Failed to load records'
  } finally {
    isLoading.value = false
  }
}

async function fetchDepartments() {
  try {
    const { data } = await axios.get('/departments')
    departments.value = data?.departments || data || []
  } catch (err) {
    // Fallback to manual text entry if departments cannot be loaded
    departments.value = []
    console.warn('Departments fetch failed; fallback to text input.')
  }
}

function openDetails(rec) {
  selectedRecord.value = rec
  isDetailsOpen.value = true
}

function closeDetails() {
  isDetailsOpen.value = false
  selectedRecord.value = null
}

async function saveRecord() {
  try {
    const dep = newRecord.value.departmentId
      ? departments.value.find((d) => String(d._id) === String(newRecord.value.departmentId))
      : null
    const payload = {
      departmentId: newRecord.value.departmentId || undefined,
      department: dep?.name || newRecord.value.department,
      notes: newRecord.value.notes,
      date: newRecord.value.date,
      items: newRecord.value.items.filter((it) => it.description?.trim())
    }

    if (!payload.department || !payload.date || payload.items.length === 0) {
      alert('Please provide department, date, and at least one item with description.')
      return
    }

    await axios.post('/inventory-records', payload)
    isAddOpen.value = false
    resetAddForm()
    await fetchRecords()
    successMessage.value = 'Record created successfully'
    setTimeout(() => (successMessage.value = null), 3000)
  } catch (err) {
    console.error('Failed to save record:', err)
    alert(err?.response?.data?.message || 'Failed to save record')
  }
}

function cancelAdd() {
  isAddOpen.value = false
  resetAddForm()
}

onMounted(async () => {
  await Promise.all([fetchRecords(), fetchDepartments()])
})

// Derived
const filteredRecords = computed(() => {
  const dept = filterDepartment.value.trim().toLowerCase()
  const date = filterDate.value.trim()
  const source = filterSource.value.trim().toLowerCase()
  const q = textSearch.value.trim().toLowerCase()

  return records.value.filter((r) => {
    const matchesDept = dept
      ? String(r.department || '')
          .toLowerCase()
          .includes(dept)
      : true
    const matchesDate = date ? new Date(r.date).toISOString().slice(0, 10) === date : true
    const matchesSource = source
      ? String(r.sourceType || 'manual')
          .toLowerCase()
          .includes(source)
      : true
    const matchesText = q
      ? [r.department, r.notes, r?.createdBy?.name]
          .map((v) => String(v || '').toLowerCase())
          .some((v) => v.includes(q))
      : true
    return matchesDept && matchesDate && matchesSource && matchesText
  })
})

const totalPages = computed(() =>
  Math.max(1, Math.ceil(filteredRecords.value.length / pageSize.value))
)
const paginatedRecords = computed(() => {
  const start = (currentPage.value - 1) * pageSize.value
  return filteredRecords.value.slice(start, start + pageSize.value)
})

function prevPage() {
  if (currentPage.value > 1) currentPage.value -= 1
}
function nextPage() {
  if (currentPage.value < totalPages.value) currentPage.value += 1
}

// Header stats and helpers
const totalRecordsCount = computed(() => records.value.length)
const totalItemsCount = computed(() =>
  records.value.reduce(
    (sum, r) => sum + (r.items && Array.isArray(r.items) ? r.items.length : 0),
    0
  )
)
const activeFiltersList = computed(() => {
  const chips = []
  if (filterDepartment.value) chips.push({ label: 'Department', value: filterDepartment.value })
  if (filterDate.value) chips.push({ label: 'Date', value: filterDate.value })
  if (filterSource.value) chips.push({ label: 'Source', value: filterSource.value })
  if (textSearch.value) chips.push({ label: 'Search', value: textSearch.value })
  return chips
})

function initials(name) {
  const str = String(name || '').trim()
  if (!str) return 'U'
  const parts = str.split(/\s+/)
  return (
    parts
      .slice(0, 2)
      .map((p) => p[0]?.toUpperCase() || '')
      .join('') || 'U'
  )
}
</script>

<template>
  <DefaultLayout>
    <div class="mx-auto max-w-8xl">
      <!-- Breadcrumb -->
      <BreadcrumbDefault :pageTitle="pageTitle" />

      <!-- Card Container -->
      <div class="bg-white dark:bg-boxdark rounded-sm border border-stroke shadow-default p-6">
        <!-- Header Toolbar -->
        <div class="mb-6">
          <div class="flex items-start justify-between gap-4">
            <div>
              <h1 class="text-2xl font-semibold tracking-tight">Inventory Records</h1>
              <p class="text-sm text-gray-500 mt-1">
                Grouped assets by department, with quick filters and actions.
              </p>
            </div>
            <div>
              <button
                class="bg-gradient-to-r from-primary to-blue-600 text-white px-5 py-2.5 rounded-md shadow hover:opacity-90"
                @click="isAddOpen = true"
                title="Add a new inventory record"
              >
                Add New Record
              </button>
            </div>
          </div>

          <!-- Stats -->
          <div class="mt-4 grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div class="rounded-md border border-stroke p-3 bg-gray-50 dark:bg-meta-4">
              <div class="text-xs text-gray-500">Total Records</div>
              <div class="text-lg font-semibold">{{ totalRecordsCount }}</div>
            </div>
            <div class="rounded-md border border-stroke p-3 bg-gray-50 dark:bg-meta-4">
              <div class="text-xs text-gray-500">Total Items</div>
              <div class="text-lg font-semibold">{{ totalItemsCount }}</div>
            </div>
            <div class="rounded-md border border-stroke p-3 bg-gray-50 dark:bg-meta-4">
              <div class="text-xs text-gray-500">Active Filters</div>
              <div class="text-lg font-semibold">{{ activeFiltersList.length }}</div>
            </div>
          </div>
        </div>

        <!-- Filters Row -->
        <div class="flex flex-col md:flex-row md:items-end md:justify-between gap-4 mb-4">
          <div class="w-full md:w-1/2">
            <label class="mb-2.5 block text-black dark:text-white">Filters</label>
            <div class="flex gap-2">
              <select v-model="filterDepartment" class="w-1/3 rounded border border-stroke p-2">
                <option value="">All Departments</option>
                <option v-for="d in departments" :key="d._id" :value="d.name">{{ d.name }}</option>
              </select>
              <select v-model="filterSource" class="w-1/3 rounded border border-stroke p-2">
                <option value="">All Sources</option>
                <option value="manual">Manual</option>
                <option value="deployment">Deployment</option>
              </select>
              <input
                v-model="filterDate"
                type="date"
                class="w-1/3 rounded border border-stroke p-2"
              />
            </div>
            <!-- Active filter chips -->
            <div v-if="activeFiltersList.length" class="mt-2 flex flex-wrap gap-2">
              <span
                v-for="chip in activeFiltersList"
                :key="chip.label"
                class="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs bg-gray-100 text-gray-700 border border-stroke"
              >
                <span class="font-medium">{{ chip.label }}:</span>
                <span class="truncate max-w-[10rem]" :title="chip.value">{{ chip.value }}</span>
              </span>
            </div>
          </div>
          <div class="w-full md:w-1/2">
            <label class="mb-2.5 block text-black dark:text-white">Search</label>
            <input
              v-model="textSearch"
              type="text"
              class="w-full rounded border border-stroke p-2"
              placeholder="Search notes, department, or creator"
            />
          </div>
        </div>

        <!-- Feedback banners -->
        <div v-if="successMessage" class="mb-3 px-4 py-2 rounded bg-success text-white">
          {{ successMessage }}
        </div>
        <div v-if="errorMessage" class="mb-3 px-4 py-2 rounded bg-danger text-white">
          Error: {{ errorMessage }}
        </div>

        <!-- Loading / Error -->
        <div v-if="isLoading" class="text-gray-500">Loading...</div>
        <div v-else-if="errorMessage" class="text-danger">Error: {{ errorMessage }}</div>

        <!-- Table -->
        <div v-else class="overflow-x-auto">
          <table class="min-w-full text-sm">
            <thead class="bg-gray-100 dark:bg-meta-4 sticky top-0 z-10">
              <tr>
                <th class="px-4 py-2 text-left">Department</th>
                <th class="px-4 py-2 text-left">Source</th>
                <th class="px-4 py-2 text-left">Notes</th>
                <th class="px-4 py-2 text-left">Created By</th>
                <th class="px-4 py-2 text-left">Date</th>
                <th class="px-4 py-2 text-left">Actions</th>
              </tr>
            </thead>
            <tbody>
              <tr
                v-for="rec in paginatedRecords"
                :key="rec._id"
                class="border-t odd:bg-gray-50 dark:odd:bg-meta-4 hover:bg-gray-100 transition-colors"
              >
                <td class="px-4 py-2">
                  <span
                    class="inline-flex items-center rounded-full bg-sky-100 text-sky-700 px-2 py-0.5 text-xs font-medium"
                    :title="rec.department"
                  >
                    {{ rec.department || '—' }}
                  </span>
                </td>
                <td class="px-4 py-2">
                  <span
                    :class="[
                      'inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium',
                      rec.sourceType === 'Deployment' 
                        ? 'bg-purple-100 text-purple-700' 
                        : 'bg-gray-100 text-gray-700'
                    ]"
                  >
                    {{ rec.sourceType || 'Manual' }}
                    <svg v-if="rec.sourceRIS" class="ml-1 h-3 w-3" fill="currentColor" viewBox="0 0 20 20">
                      <path d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/>
                    </svg>
                  </span>
                </td>
                <td class="px-4 py-2">
                  <div class="max-w-[22rem] truncate" :title="rec.notes">
                    {{ rec.notes || '—' }}
                  </div>
                </td>
                <td class="px-4 py-2">
                  <div class="flex items-center gap-2">
                    <div
                      class="w-6 h-6 rounded-full bg-indigo-500 text-white flex items-center justify-center text-xs"
                      :title="rec?.createdBy?.name || rec?.createdBy?.role || ''"
                    >
                      {{ initials(rec?.createdBy?.name || rec?.createdBy?.role || '') }}
                    </div>
                    <span class="truncate max-w-[12rem]">{{
                      rec?.createdBy?.name || rec?.createdBy?.role || '—'
                    }}</span>
                  </div>
                </td>
                <td class="px-4 py-2">{{ new Date(rec.date).toLocaleDateString() }}</td>
                <td class="px-4 py-2">
                  <button
                    class="border border-stroke px-3 py-1 rounded hover:bg-gray-50"
                    @click="openDetails(rec)"
                    title="View record details"
                  >
                    View
                  </button>
                </td>
              </tr>
              <tr v-if="filteredRecords?.length === 0">
                <td colspan="6" class="px-4 py-10 text-center">
                  <div class="flex flex-col items-center gap-2 text-gray-600">
                    <div class="text-sm">No records match your filters.</div>
                    <button
                      class="bg-primary text-white px-4 py-2 rounded hover:bg-opacity-90"
                      @click="isAddOpen = true"
                    >
                      Add New Record
                    </button>
                  </div>
                </td>
              </tr>
            </tbody>
          </table>
          <!-- Pagination -->
          <div class="flex items-center justify-between mt-4">
            <div class="text-sm text-gray-500">Page {{ currentPage }} of {{ totalPages }}</div>
            <div class="flex gap-2">
              <button
                class="border border-stroke px-3 py-1 rounded disabled:opacity-50"
                @click="prevPage"
                :disabled="currentPage === 1"
              >
                Prev
              </button>
              <button
                class="border border-stroke px-3 py-1 rounded disabled:opacity-50"
                @click="nextPage"
                :disabled="currentPage === totalPages"
              >
                Next
              </button>
            </div>
          </div>
        </div>
      </div>

      <!-- Details Modal -->
      <div
        v-if="isDetailsOpen"
        class="fixed inset-0 bg-black bg-opacity-30 flex items-center justify-center z-50"
      >
        <div
          class="bg-white max-h-[80%] overflow-auto dark:bg-boxdark rounded-md shadow-lg w-full max-w-4xl p-6"
        >
          <div class="flex justify-between items-center mb-4">
            <h2 class="text-lg font-semibold">Record Details</h2>
            <button class="text-sm px-3 py-1 border border-stroke rounded" @click="closeDetails">
              Close
            </button>
          </div>
          <div class="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4 text-sm">
            <div>
              <span class="font-semibold">Department:</span> {{ selectedRecord?.department }}
            </div>
            <div>
              <span class="font-semibold">Date:</span>
              {{ selectedRecord ? new Date(selectedRecord.date).toLocaleDateString() : '' }}
            </div>
            <div class="md:col-span-2">
              <span class="font-semibold">Notes:</span> {{ selectedRecord?.notes }}
            </div>
          </div>

          <div class="overflow-x-auto">
            <table class="min-w-full text-sm">
              <thead class="bg-gray-100">
                <tr>
                  <th class="px-4 py-2 text-left">Description</th>
                  <th class="px-4 py-2 text-left">Processor</th>
                  <th class="px-4 py-2 text-left">Storage</th>
                  <th class="px-4 py-2 text-left">RAM</th>
                  <th class="px-4 py-2 text-left">Video Card</th>
                  <th class="px-4 py-2 text-left">Brand of Monitor & Serial Number</th>
                  <th class="px-4 py-2 text-left">Property Number</th>
                  <th class="px-4 py-2 text-left">Printer or Scanner</th>
                  <th class="px-4 py-2 text-left">End User or MR</th>
                  <th class="px-4 py-2 text-left">Remarks / Years</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="(item, idx) in selectedRecord?.items || []" :key="idx" class="border-t">
                  <td class="px-4 py-2">{{ item.description }}</td>
                  <td class="px-4 py-2">{{ item.processor }}</td>
                  <td class="px-4 py-2">{{ item.storage }}</td>
                  <td class="px-4 py-2">{{ item.ram }}</td>
                  <td class="px-4 py-2">{{ item.videoCard }}</td>
                  <td class="px-4 py-2">{{ item.monitorAndSerial }}</td>
                  <td class="px-4 py-2">{{ item.propertyNumber }}</td>
                  <td class="px-4 py-2">{{ item.printerOrScanner }}</td>
                  <td class="px-4 py-2">{{ item.endUserOrMR }}</td>
                  <td class="px-4 py-2">{{ item.remarksYears }}</td>
                </tr>
                <tr v-if="!selectedRecord || (selectedRecord.items || []).length === 0">
                  <td colspan="10" class="px-4 py-6 text-center text-gray-500">
                    No items in this record.
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <!-- Add Modal -->
      <div
        v-if="isAddOpen"
        class="fixed inset-0 bg-black bg-opacity-30 flex items-center justify-center z-50"
      >
        <div
          class="bg-white max-h-[80%] overflow-auto dark:bg-boxdark rounded-md shadow-lg w-full max-w-4xl p-6"
        >
          <h2 class="text-lg font-semibold mb-4">Add Record</h2>
          <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label class="block text-sm font-medium mb-1">Department</label>
              <div v-if="departments.length">
                <select
                  v-model="newRecord.departmentId"
                  class="w-full rounded border border-stroke p-2"
                >
                  <option value="">Select Department</option>
                  <option v-for="d in departments" :key="d._id" :value="d._id">{{ d.name }}</option>
                </select>
              </div>
              <div v-else>
                <input
                  v-model="newRecord.department"
                  type="text"
                  class="w-full rounded border border-stroke p-2"
                  placeholder="Enter department"
                />
              </div>
            </div>
            <div>
              <label class="block text-sm font-medium mb-1">Created By</label>
              <input
                :value="createdByName"
                type="text"
                class="w-full rounded border border-stroke p-2 bg-gray-100"
                disabled
              />
            </div>
            <div class="md:col-span-1">
              <label class="block text-sm font-medium mb-1">Notes</label>
              <input v-model="newRecord.notes" class="w-full rounded border border-stroke p-2" />
            </div>
            <div>
              <label class="block text-sm font-medium mb-1">Date</label>
              <input
                v-model="newRecord.date"
                type="date"
                class="w-full rounded border border-stroke p-2"
              />
            </div>
          </div>

          <div class="mt-6">
            <div class="flex justify-between items-center mb-3">
              <h3 class="font-semibold">Items</h3>
              <div class="flex gap-2">
                <button
                  class="text-sm px-3 py-1 border border-stroke rounded hover:bg-gray-50"
                  @click="addItemRow"
                >
                  + Add Item
                </button>
              </div>
            </div>

            <!-- Inline row editor -->
            <div
              v-if="editingItemIndex !== null"
              class="mt-4 border border-sky-200 bg-sky-50 rounded p-4"
            >
              <div class="flex items-center justify-between mb-3">
                <h4 class="font-medium">Item #{{ editingItemIndex + 1 }}</h4>
                <button
                  class="text-sm px-3 py-1 border border-stroke rounded"
                  @click="cancelEditItem"
                >
                  Close
                </button>
              </div>
              <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label class="block text-sm font-medium mb-1">Description</label>
                  <input
                    v-model="tempItem.description"
                    type="text"
                    class="w-full rounded border border-stroke p-2"
                  />
                </div>
                <div>
                  <label class="block text-sm font-medium mb-1">Processor</label>
                  <input
                    v-model="tempItem.processor"
                    type="text"
                    class="w-full rounded border border-stroke p-2"
                  />
                </div>
                <div>
                  <label class="block text-sm font-medium mb-1">Storage</label>
                  <input
                    v-model="tempItem.storage"
                    type="text"
                    class="w-full rounded border border-stroke p-2"
                  />
                </div>
                <div>
                  <label class="block text-sm font-medium mb-1">RAM</label>
                  <input
                    v-model="tempItem.ram"
                    type="text"
                    class="w-full rounded border border-stroke p-2"
                  />
                </div>
                <div>
                  <label class="block text-sm font-medium mb-1">Video Card</label>
                  <input
                    v-model="tempItem.videoCard"
                    type="text"
                    class="w-full rounded border border-stroke p-2"
                  />
                </div>
                <div>
                  <label class="block text-sm font-medium mb-1">BOM & SN</label>
                  <input
                    v-model="tempItem.monitorAndSerial"
                    type="text"
                    class="w-full rounded border border-stroke p-2"
                  />
                </div>
                <div>
                  <label class="block text-sm font-medium mb-1">Asset Control Number (ACN)</label>
                  <input
                    v-model="tempItem.propertyNumber"
                    type="text"
                    placeholder="Enter ACN"
                    class="w-full rounded border border-stroke p-2"
                  />
                </div>
                <div>
                  <label class="block text-sm font-medium mb-1">Printer or Scanner</label>
                  <input
                    v-model="tempItem.printerOrScanner"
                    type="text"
                    class="w-full rounded border border-stroke p-2"
                  />
                </div>
                <div>
                  <label class="block text-sm font-medium mb-1">End User or MR</label>
                  <input
                    v-model="tempItem.endUserOrMR"
                    type="text"
                    class="w-full rounded border border-stroke p-2"
                  />
                </div>
                <div class="md:col-span-1">
                  <label class="block text-sm font-medium mb-1">Remarks / Years</label>
                  <input
                    v-model="tempItem.remarksYears"
                    rows="2"
                    class="w-full rounded border border-stroke p-2"
                  />
                </div>
              </div>
              <div class="flex justify-end gap-2 mt-4">
                <button class="border border-stroke px-4 py-2 rounded" @click="cancelEditItem">
                  Cancel
                </button>
                <button
                  class="bg-primary text-white px-4 py-2 rounded hover:bg-opacity-90"
                  @click="saveEditItem"
                >
                  Save
                </button>
              </div>
            </div>

            <!-- Compact table for items -->
            <div class="overflow-x-auto mt-2 border border-stroke rounded">
              <table class="min-w-full text-sm">
                <thead class="bg-gray-100">
                  <tr>
                    <th class="px-3 py-2 text-left">Description</th>
                    <th class="px-3 py-2 text-left">Asset Control Number (ACN)</th>
                    <th class="px-3 py-2 text-left">End User / MR</th>
                    <th class="px-3 py-2 text-left">Remarks / Years</th>
                    <th class="px-3 py-2 text-left">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  <tr
                    v-for="(item, idx) in newRecord.items"
                    :key="idx"
                    class="border-t odd:bg-gray-50"
                  >
                    <td class="px-3 py-2 truncate" :title="item.description">
                      {{ item.description || '—' }}
                    </td>
                    <td class="px-3 py-2 truncate" :title="item.propertyNumber">
                      {{ item.propertyNumber || '—' }}
                    </td>
                    <td class="px-3 py-2 truncate" :title="item.endUserOrMR">
                      {{ item.endUserOrMR || '—' }}
                    </td>
                    <td class="px-3 py-2 truncate" :title="item.remarksYears">
                      {{ item.remarksYears || '—' }}
                    </td>
                    <td class="px-3 py-2">
                      <div class="flex gap-2">
                        <button
                          class="text-xs px-2 py-1 border border-stroke rounded hover:bg-gray-50"
                          @click="startEditItem(idx)"
                        >
                          Edit
                        </button>
                        <button
                          class="text-xs px-2 py-1 border border-stroke rounded hover:bg-gray-50 disabled:opacity-50"
                          :disabled="newRecord.items.length === 1"
                          @click="removeItemRow(idx)"
                        >
                          Remove
                        </button>
                      </div>
                    </td>
                  </tr>
                  <tr v-if="newRecord.items.length === 0">
                    <td colspan="5" class="px-3 py-4 text-center text-gray-500">
                      No items yet. Click "Add Item" to start.
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          <div class="flex justify-end gap-2 mt-6">
            <button @click="cancelAdd" class="border border-stroke px-4 py-2 rounded">
              Cancel
            </button>
            <button
              @click="saveRecord"
              class="bg-primary text-white px-4 py-2 rounded hover:bg-opacity-90"
            >
              Save Record
            </button>
          </div>
        </div>
      </div>
    </div>
  </DefaultLayout>
</template>

<!-- Tailwind only for styling -->
