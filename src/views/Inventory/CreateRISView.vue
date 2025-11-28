<script setup>
import { ref, computed, onMounted, onUnmounted, watch } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import axios from '../../utils/axios'
import { socket } from '../../socket'
import DefaultLayout from '../../layouts/DefaultLayout.vue'
import BreadcrumbDefault from '../../components/Breadcrumbs/BreadcrumbDefault.vue'
import SerialPicker from '../../components/Inventory/SerialPicker.vue'
import DeploymentDesktopACNFlow from '../../components/Inventory/DeploymentDesktopACNFlow.vue'
import AcnRepairCombobox from '../../components/AcnRepairCombobox.vue'
import BaseCombobox from '../../components/Forms/BaseCombobox.vue'
import AcnCombobox from '../../components/AcnCombobox.vue'
const pageTitle = ref('Create Requisition Issue Slip')
const router = useRouter()
const route = useRoute()
const risType = ref('Individual')
const purpose = ref('')
const requestor = ref('')
const department = ref('')
const notes = ref('')
const items = ref([
  {
    product: '',
    requestedQty: 1,
    remarks: ''
  }
])
const deploymentData = ref({ employees: [] })
const products = ref([])
const productSerials = ref({})
const selectedSerials = ref({})
const serialFilters = ref({})
const departments = ref([])
const employees = ref([])
const loading = ref(true) // Start with loading true
const submitting = ref(false)
const error = ref(null)
const showRequestorDropdown = ref(false)
const replacementMode = ref('components')
const replaceTargetAcn = ref('')
const repList = ref([])
const repLoading = ref(false)
const repError = ref('')
const repSearch = ref('')
const repFromDate = ref(null)
const repToDate = ref(null)
const selectedRepLogId = ref('')
const showReplacementModal = ref(false)
const isReplacement = computed(() => risType.value === 'Replacement')
const productOptions = computed(() =>
  (products.value || []).map((p) => ({
    ...p,
    label: p.sku ? `${p.name} (${p.sku})` : p.name
  }))
)
const modalParts = computed(() => {
  const acn = (replaceTargetAcn.value || '').trim()
  const logs = (Array.isArray(repList.value) ? repList.value : []).filter(
    (l) => String(l?.acn || '') === acn
  )
  const out = []
  for (const l of logs) {
    const arr = Array.isArray(l?.replacementParts) ? l.replacementParts : []
    for (const rp of arr) {
      out.push({
        part: rp?.part || '',
        qty: Number(rp?.requestedQty || rp?.quantity || 1),
        remarks: rp?.remarks || ''
      })
    }
  }
  return out
})
function openReplacementModal() {
  if (!purpose.value) purpose.value = 'Replacement'
  showReplacementModal.value = true
}
async function fetchProducts() {
  loading.value = true
  try {
    const response = await axios.get('/products')
    products.value = response.data.products || []
  } catch (e) {
    error.value = e?.response?.data?.message || e.message
  } finally {
    loading.value = false
  }
}
async function fetchDepartments() {
  try {
    const response = await axios.get('/departments')
    const list = response.data.departments || []
    // Prefer active departments first
    departments.value = list.filter((d) => d.isActive !== false)
  } catch (e) {
    // Non-blocking error; department is optional
    console.error('Failed to fetch departments', e)
  }
}
async function fetchEmployees() {
  try {
    const baseParams = { limit: 1000 }
    const params = department.value ? { ...baseParams, department: department.value } : baseParams
    const response = await axios.get('/employees', { params })
    let list = response.data?.employees || []
    // Fallback: if department filtering returned no employees, fetch all
    if (department.value && list.length === 0) {
      const allResp = await axios.get('/employees', { params: baseParams })
      list = allResp.data?.employees || []
    }
    employees.value = list
  } catch (e) {
    console.error('Failed to fetch employees', e)
  }
}
async function fetchEndUserForAcn(acn) {
  const target = String(acn || '').trim()
  if (!target) return
  try {
    const { data } = await axios.get('/inventory-records', { params: { acn: target, limit: 1 } })
    const records = data?.records || []
    const rec = records.length ? records[0] : null
    if (!rec) return
    const item =
      (rec.items || []).find((it) => String(it?.acn || '') === target) || (rec.items || [])[0]
    const nm = item?.endUserOrMR || ''
    if (nm) requestor.value = nm
    if (!department.value && rec?.department) department.value = rec.department
  } catch (_) {
    console.log(_)
  }
}
function onReplaceAcnSelect(payload) {
  replaceTargetAcn.value = payload?.acn || ''
  const rec = payload?.record || null
  const item = payload?.item || null
  // Auto-fill purpose, requestor, department
  if (!purpose.value) purpose.value = 'Replacement'
  const nm = item?.endUserOrMR || ''
  if (nm) requestor.value = nm
  else fetchEndUserForAcn(replaceTargetAcn.value)
  if (!department.value) department.value = rec?.department || department.value
  // Switch to Replacement mode
  risType.value = 'Replacement'
}

async function fetchForReplacementLogs() {
  if (risType.value !== 'Replacement') return
  repLoading.value = true
  repError.value = ''
  try {
    const { data } = await axios.get('/maintenance/logs', {
      params: {
        status: 'pending_replacement',
        dateFrom: repFromDate.value,
        dateTo: repToDate.value
      }
    })
    repList.value = Array.isArray(data?.logs) ? data.logs : []
  } catch (e) {
    repError.value = e?.response?.data?.message || e.message || 'Failed to load replacement logs'
    repList.value = []
  } finally {
    repLoading.value = false
  }
}
const filteredRepList = computed(() => {
  const q = repSearch.value.trim().toLowerCase()
  const arr = Array.isArray(repList.value) ? repList.value : []
  if (!q) return arr
  return arr.filter((l) => {
    const s = `${l.logNumber || ''} ${l.acn || ''} ${l.serialNumber || ''}`.toLowerCase()
    return s.includes(q)
  })
})
async function findRepLogIdForCurrentAcn() {
  const acn = (replaceTargetAcn.value || '').trim()
  if (!acn) return ''
  try {
    const { data } = await axios.get('/maintenance/logs', {
      params: { acn, status: 'pending_replacement', limit: 1 }
    })
    const arr = Array.isArray(data?.logs) ? data.logs : []
    const l = arr.length ? arr[0] : null
    return l ? String(l._id || '') : ''
  } catch (_) {
    return ''
  }
}
function loadReplacementLog(l) {
  risType.value = 'Replacement'
  purpose.value = 'Replacement'
  requestor.value = ''
  department.value = l?.inventoryRecordId?.department || department.value
  replaceTargetAcn.value = l?.acn || ''
  selectedRepLogId.value = String(l?._id || '')
  fetchEndUserForAcn(replaceTargetAcn.value)
  const parts = Array.isArray(l?.replacementParts) ? l.replacementParts : []
  if (parts.length > 0) {
    replacementMode.value = 'components'
    items.value = parts.map((rp) => ({
      product: rp?.product || '',
      requestedQty: Number(rp?.requestedQty || rp?.quantity || 1),
      remarks: rp?.remarks || rp?.notes || ''
    }))
  } else {
    replacementMode.value = 'swap'
  }
}
function createRISFromLog(l) {
  loadReplacementLog(l)
  openReplacementModal()
}
watch(department, () => {
  fetchEmployees()
})
const departmentEmployees = computed(() => {
  const dept = (department.value || '').toLowerCase()
  if (!dept) return employees.value
  return employees.value.filter((e) => (e.department || '').toLowerCase() === dept)
})
const filteredRequestors = computed(() => {
  const query = (requestor.value || '').toLowerCase()
  const source = departmentEmployees.value.length ? departmentEmployees.value : employees.value
  if (!query) return source
  return source.filter((e) => {
    const name = `${e.firstName || ''} ${e.lastName || ''}`.toLowerCase()
    const email = (e.email || '').toLowerCase()
    return name.includes(query) || email.includes(query)
  })
})
function selectRequestor(emp) {
  requestor.value = `${emp.firstName} ${emp.lastName}`
  showRequestorDropdown.value = false
}
function addItem() {
  items.value.push({ product: '', requestedQty: 1, remarks: '' })
}
function removeItem(index) {
  if (items.value.length > 1) {
    items.value.splice(index, 1)
  }
}
function checkDuplicateProducts() {
  const productIds = items.value.map((item) => item.product).filter((id) => id !== '')
  return new Set(productIds).size !== productIds.length
}
async function onProductSelected(item) {
  try {
    if (!item.product) {
      item.hasSerialNumbers = false
      item.hasACN = false
      return
    }
    const { data } = await axios.get(`/products/${item.product}`)
    const p = data.product
    item.hasSerialNumbers = !!p?.hasSerialNumbers
    item.hasACN = !!p?.hasAssetControlNumber
    productSerials.value[item.product] = Array.isArray(p?.serialNumbers) ? p.serialNumbers : []
    selectedSerials.value[item.product] = []
    serialFilters.value[item.product] = ''
  } catch (e) {
    item.hasSerialNumbers = false
    item.hasACN = false
    productSerials.value[item.product] = []
    selectedSerials.value[item.product] = []
    serialFilters.value[item.product] = ''
  }
}
async function submitRIS() {
  if (!purpose.value || !requestor.value) {
    error.value = 'Please fill in all required fields'
    return
  }
  if (risType.value === 'Individual') {
    if (items.value.some((item) => !item.product)) {
      error.value = 'Please select products for all items'
      return
    }
    if (checkDuplicateProducts()) {
      error.value = 'Duplicate products selected. Please select each product only once.'
      return
    }
  } else if (risType.value === 'Deployment') {
    if (!deploymentData.value.employees.length) {
      error.value = 'Please select at least one employee for deployment'
      return
    }
  } else if (risType.value === 'Replacement') {
    if (replacementMode.value === 'swap' && !replaceTargetAcn.value.trim()) {
      error.value = 'Select ACN of the item to replace'
      submitting.value = false
      return
    }
    if (items.value.some((item) => !item.product)) {
      error.value = 'Please select products for all items'
      submitting.value = false
      return
    }
  }
  submitting.value = true
  error.value = null
  try {
    const payload = {
      risType: risType.value,
      purpose: isReplacement.value ? 'Replacement' : purpose.value,
      requestor: requestor.value,
      department: department.value,
      notes: notes.value,
      directIssue: true
    }
    if (risType.value === 'Individual' || risType.value === 'Replacement') {
      // Build serial numbers payload for items that require them
      const serialsPayload = {}
      for (const item of items.value) {
        if (item.hasSerialNumbers) {
          const selected = selectedSerials.value[item.product] || []
          const qty = parseInt(item.requestedQty) || 0
          if (selected.length !== qty) {
            error.value = `Select ${qty} serial number(s) for ${
              products.value.find((p) => p._id === item.product)?.name || 'item'
            }`
            submitting.value = false
            return
          }
          serialsPayload[item.product] = selected
        }
      }
      payload.items = items.value
      payload.serialNumbers = serialsPayload
      if (risType.value === 'Replacement') {
        payload.replacementData = {
          mode: replacementMode.value,
          targetAcn: replaceTargetAcn.value.trim() || ''
        }
      }
    } else {
      payload.deploymentData = deploymentData.value
      const allItems = []
      deploymentData.value.employees.forEach((employee) => {
        employee.items.forEach((item) => {
          const existingItem = allItems.find((i) => i.product === item.product)
          if (existingItem) {
            existingItem.requestedQty += 1
          } else {
            allItems.push({
              product: item.product,
              requestedQty: 1,
              remarks: item.remarks
            })
          }
        })
      })
      payload.items = allItems
      const serialsPayload = {}
      deploymentData.value.employees.forEach((employee) => {
        employee.items.forEach((item) => {
          if (item && item.product && item.serialNumber) {
            const pid = item.product
            if (!serialsPayload[pid]) serialsPayload[pid] = []
            // Avoid duplicates across employees
            if (!serialsPayload[pid].includes(item.serialNumber)) {
              serialsPayload[pid].push(item.serialNumber)
            }
          }
        })
      })
      payload.serialNumbers = serialsPayload
      const acnsProvided = {}
      deploymentData.value.employees.forEach((employee) => {
        employee.items.forEach((item) => {
          if (item && item.product && item.acn) {
            const pid = item.product
            if (!acnsProvided[pid]) acnsProvided[pid] = 0
            acnsProvided[pid]++
          }
        })
      })
      for (const ai of allItems) {
        const pid = ai.product
        const product = products.value.find((p) => p._id === pid)
        if (product?.hasSerialNumbers) {
          const provided = (serialsPayload[pid] || []).length
          const acnCount = acnsProvided[pid] || 0
          const required = ai.requestedQty
          // Skip validation if ACNs are provided (ACN tracks the item)
          if (acnCount === 0 && provided !== required) {
            error.value = `Serials count mismatch for ${product.name}: expected ${required}, provided ${provided}. Add or remove serial selections per unit before submitting.`
            submitting.value = false
            return
          }
        }
      }
    }
    const response = await axios.post('/ris', payload)
    if (response.data.success) {
      try {
        if (risType.value === 'Replacement') {
          const targetId = selectedRepLogId.value || (await findRepLogIdForCurrentAcn())
          if (targetId) {
            await axios.patch(`/maintenance/logs/${targetId}`, { status: 'replacement_issued' })
            await fetchForReplacementLogs()
          }
        }
      } catch (_) {
        consoe
      }
      // Socket.IO will handle the update in the list view
      router.push({
        name: 'ris-detail',
        params: { id: response.data.ris._id },
        query: {
          success: 'true',
          message: `RIS #${response.data.ris.risNumber || ''} created successfully`
        }
      })
    }
  } catch (e) {
    error.value = e?.response?.data?.message || e.message
  } finally {
    submitting.value = false
  }
}
onMounted(() => {
  fetchProducts()
  fetchDepartments()
  fetchEmployees()
  socket.on('connect', () => {
    console.log('Socket connected in CreateRISView')
  })
  if (localStorage.getItem('user')) {
    const user = JSON.parse(localStorage.getItem('user'))
    if (user && user._id) {
      socket.emit('authenticate', user._id)
    }
  }
  // Prefill from query
  const q = route.query || {}
  const qRis = String(q.risType || '')
  if (qRis) risType.value = qRis
  const qp = String(q.purpose || '')
  if (qp) purpose.value = qp
  const qr = String(q.requestor || '')
  if (qr) requestor.value = qr
  const qd = String(q.department || '')
  if (qd) department.value = qd
  const qTarget = String(q.targetAcn || '')
  if (qTarget) {
    replaceTargetAcn.value = qTarget
    risType.value = 'Replacement'
    replacementMode.value = String(q.replacementMode || 'swap')
    fetchForReplacementLogs()
  }
  if (risType.value === 'Replacement') fetchForReplacementLogs()
})

watch([replaceTargetAcn, risType], () => {
  fetchForReplacementLogs()
})
watch(replacementMode, () => {})

onUnmounted(() => {
  socket.off('connect')
})
</script>

<template>
  <DefaultLayout>
    <div class="p-6">
      <BreadcrumbDefault :pageTitle="pageTitle" />

      <div class="bg-white dark:bg-boxdark rounded-sm shadow-default p-6 mt-4">
        <div v-if="loading" class="flex justify-center items-center p-8">
          <div class="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
        </div>

        <div v-else>
          <div
            v-if="error"
            class="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4"
          >
            {{ error }}
          </div>

          <form @submit.prevent="submitRIS">
            <!-- RIS Type Selection -->
            <div class="mb-6">
              <label class="mb-2.5 block text-black dark:text-white">
                <span class="text-meta-1">*</span>
              </label>
              <select
                v-model="risType"
                class="w-full rounded border-[1.5px] border-stroke bg-transparent py-3 px-5 text-black outline-none transition focus:border-primary active:border-primary dark:border-form-strokedark dark:bg-form-input dark:text-white"
              >
                <option value="Individual">Individual Request</option>
                <option value="Deployment">Deployment Request</option>
                <option value="Replacement">Replacement</option>
              </select>
            </div>

            <div v-if="!isReplacement" class="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
              <div>
                <label class="mb-2.5 block text-black dark:text-white">
                  Purpose <span class="text-meta-1">*</span>
                </label>
                <input
                  v-model="purpose"
                  type="text"
                  required
                  placeholder="Enter purpose"
                  class="w-full rounded border-[1.5px] border-stroke bg-transparent py-3 px-5 text-black outline-none transition focus:border-primary active:border-primary dark:border-form-strokedark dark:bg-form-input dark:text-white"
                />
              </div>

              <div class="relative">
                <label class="mb-2.5 block text-black dark:text-white">
                  Requestor <span class="text-meta-1">*</span>
                </label>
                <input
                  v-model="requestor"
                  @focus="showRequestorDropdown = true"
                  @input="showRequestorDropdown = true"
                  @blur="() => setTimeout(() => (showRequestorDropdown = false), 200)"
                  type="text"
                  required
                  placeholder="Type to search employee"
                  class="w-full rounded border-[1.5px] border-stroke bg-transparent py-3 px-5 text-black outline-none transition focus:border-primary active:border-primary dark:border-form-strokedark dark:bg-form-input dark:text-white"
                />
                <ul
                  v-if="showRequestorDropdown && filteredRequestors.length"
                  class="absolute z-10 mt-1 w-full bg-white dark:bg-boxdark border border-stroke dark:border-strokedark rounded shadow max-h-48 overflow-auto"
                >
                  <li v-for="emp in filteredRequestors" :key="emp._id">
                    <button
                      type="button"
                      @mousedown.prevent="selectRequestor(emp)"
                      class="w-full text-left px-3 py-2 hover:bg-gray-50 dark:hover:bg-meta-4"
                    >
                      {{ emp.firstName }} {{ emp.lastName }}
                      <span v-if="emp.email" class="text-xs text-gray-500"> — {{ emp.email }}</span>
                    </button>
                  </li>
                </ul>
              </div>

              <div>
                <label class="mb-2.5 block text-black dark:text-white"> Department </label>
                <select
                  v-model="department"
                  class="w-full rounded border-[1.5px] border-stroke bg-transparent py-3 px-5 text-black outline-none transition focus:border-primary active:border-primary dark:border-form-strokedark dark:bg-form-input dark:text-white"
                >
                  <option value="">Select department</option>
                  <option v-for="dept in departments" :key="dept._id" :value="dept.name">
                    {{ dept.name }}<span v-if="dept.code"> ({{ dept.code }})</span>
                  </option>
                </select>
              </div>

              <div>
                <label class="mb-2.5 block text-black dark:text-white"> Notes </label>
                <input
                  v-model="notes"
                  type="text"
                  placeholder="Additional notes"
                  class="w-full rounded border-[1.5px] border-stroke bg-transparent py-3 px-5 text-black outline-none transition focus:border-primary active:border-primary dark:border-form-strokedark dark:bg-form-input dark:text-white"
                />
              </div>
            </div>

            <!-- Deployment Section -->
            <div v-if="risType === 'Deployment'" class="mb-6 space-y-6">
              <!-- Desktop-first ACN flow with per-unit assignment -->
              <DeploymentDesktopACNFlow
                :employees="employees"
                :products="products"
                :department="department"
                @update:deploymentData="deploymentData = $event"
              />
            </div>

            <!-- Individual Items Section -->
            <div v-if="risType === 'Individual'" class="mb-6">
              <div class="flex justify-between items-center mb-4">
                <h3 class="text-lg font-semibold">Items</h3>
                <button
                  type="button"
                  @click="addItem"
                  class="bg-primary text-white px-4 py-2 rounded hover:bg-opacity-90 flex items-center"
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    class="h-5 w-5 mr-1"
                    viewBox="0 0 20 20"
                    fill="currentColor"
                  >
                    <path
                      fill-rule="evenodd"
                      d="M10 5a1 1 0 011 1v3h3a1 1 0 110 2h-3v3a1 1 0 11-2 0v-3H6a1 1 0 110-2h3V6a1 1 0 011-1z"
                      clip-rule="evenodd"
                    />
                  </svg>
                  Add Item
                </button>
              </div>

              <div class="bg-gray-50 dark:bg-meta-4 p-4 rounded-sm mb-4">
                <div
                  v-for="(item, index) in items"
                  :key="index"
                  class="grid grid-cols-1 md:grid-cols-12 gap-4 mb-4 items-end border-b border-stroke pb-4 last:border-0 last:pb-0"
                >
                  <div class="md:col-span-5">
                    <label class="mb-2.5 block text-black dark:text-white">
                      Product <span class="text-meta-1">*</span>
                    </label>
                    <select
                      v-model="item.product"
                      required
                      @change="onProductSelected(item)"
                      class="w-full rounded border-[1.5px] border-stroke bg-transparent py-3 px-5 text-black outline-none transition focus:border-primary active:border-primary dark:border-form-strokedark dark:bg-form-input dark:text-white"
                    >
                      <option value="">Select Product</option>
                      <option v-for="product in products" :key="product._id" :value="product._id">
                        {{ product.name }} ({{ product.sku }})
                      </option>
                    </select>
                  </div>

                  <div class="md:col-span-2">
                    <label class="mb-2.5 block text-black dark:text-white">
                      Quantity <span class="text-meta-1">*</span>
                    </label>
                    <input
                      v-model.number="item.requestedQty"
                      type="number"
                      min="1"
                      required
                      class="w-full rounded border-[1.5px] border-stroke bg-transparent py-3 px-5 text-black outline-none transition focus:border-primary active:border-primary dark:border-form-strokedark dark:bg-form-input dark:text-white"
                    />
                  </div>

                  <div class="md:col-span-4">
                    <label class="mb-2.5 block text-black dark:text-white"> Remarks </label>
                    <input
                      v-model="item.remarks"
                      type="text"
                      placeholder="Optional remarks"
                      class="w-full rounded border-[1.5px] border-stroke bg-transparent py-3 px-5 text-black outline-none transition focus:border-primary active:border-primary dark:border-form-strokedark dark:bg-form-input dark:text-white"
                    />
                  </div>

                  <!-- Serial numbers selection when product has serial tracking -->
                  <div v-if="item.hasSerialNumbers" class="md:col-span-12">
                    <label class="mb-1 block text-black dark:text-white"> Serial Numbers </label>
                    <SerialPicker
                      v-model="selectedSerials[item.product]"
                      :serials="productSerials[item.product] || []"
                      :limit="parseInt(item.requestedQty) || 0"
                    />
                  </div>

                  <div class="md:col-span-1">
                    <button
                      type="button"
                      @click="removeItem(index)"
                      class="bg-danger text-white p-2 rounded hover:bg-opacity-90 w-full h-12 flex items-center justify-center"
                      :disabled="items.length <= 1"
                    >
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        class="h-5 w-5"
                        viewBox="0 0 20 20"
                        fill="currentColor"
                      >
                        <path
                          fill-rule="evenodd"
                          d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z"
                          clip-rule="evenodd"
                        />
                      </svg>
                    </button>
                  </div>
                </div>
              </div>
            </div>

            <!-- Replacement Section -->
            <div v-if="risType === 'Replacement'" class="mb-6 space-y-6">
              <div
                class="bg-white dark:bg-boxdark rounded-sm border border-stroke dark:border-strokedark p-4"
              >
                <div class="flex items-center justify-between mb-3">
                  <h3 class="text-sm font-semibold">For Replacement Logs</h3>
                  <div class="flex items-center gap-2">
                    <input
                      v-model="repSearch"
                      placeholder="Search log # or ACN"
                      class="text-xs rounded border px-2 py-1"
                    />
                    <input
                      type="date"
                      v-model="repFromDate"
                      class="text-xs rounded border px-2 py-1"
                    />
                    <input
                      type="date"
                      v-model="repToDate"
                      class="text-xs rounded border px-2 py-1"
                    />
                    <button
                      type="button"
                      @click="fetchForReplacementLogs"
                      class="text-xs rounded border px-2 py-1"
                    >
                      Apply
                    </button>
                    <button
                      type="button"
                      @click="
                        () => {
                          repSearch = ''
                          repFromDate = new Date().toISOString().slice(0, 10)
                          repToDate = new Date().toISOString().slice(0, 10)
                          fetchForReplacementLogs()
                        }
                      "
                      class="text-xs rounded border px-2 py-1"
                    >
                      Clear
                    </button>
                  </div>
                </div>
                <div v-if="repLoading" class="text-xs text-bodydark2">Loading...</div>
                <div v-else-if="repError" class="text-xs text-red-600">{{ repError }}</div>
                <div v-else>
                  <div v-if="filteredRepList.length === 0" class="text-xs text-bodydark2">
                    No records found
                  </div>
                  <div class="overflow-x-auto" v-else>
                    <table class="w-full text-xs">
                      <thead>
                        <tr class="text-left">
                          <th class="py-1 px-2">Log #</th>
                          <th class="py-1 px-2">Date</th>
                          <th class="py-1 px-2">ACN</th>
                          <th class="py-1 px-2">Requestor</th>
                          <th class="py-1 px-2">Department</th>
                          <th class="py-1 px-2">Parts</th>
                          <th class="py-1 px-2">Action</th>
                        </tr>
                      </thead>
                      <tbody>
                        <tr v-for="rl in filteredRepList" :key="rl._id" class="border-t">
                          <td class="py-1 px-2">{{ rl.logNumber }}</td>
                          <td class="py-1 px-2">
                            {{ new Date(rl.date || rl.createdAt).toLocaleDateString() }}
                          </td>
                          <td class="py-1 px-2 font-mono">{{ rl.acn || '—' }}</td>
                          <td class="py-1 px-2">{{ rl.broughtBy?.name || '—' }}</td>
                          <td class="py-1 px-2">{{ rl.inventoryRecordId?.department || '—' }}</td>
                          <td class="py-1 px-2">
                            <div
                              v-if="(rl.replacementParts || []).length === 0"
                              class="text-bodydark2"
                            >
                              —
                            </div>
                            <ul v-else class="list-disc ml-4">
                              <li v-for="(rp, i) in rl.replacementParts" :key="i">
                                {{ rp.part || 'Part' }} × {{ rp.requestedQty || rp.quantity || 1 }}
                              </li>
                            </ul>
                          </td>
                          <td class="py-1 px-2">
                            <button
                              type="button"
                              @click="createRISFromLog(rl)"
                              class="rounded border px-2 py-1"
                            >
                              Create RIS
                            </button>
                          </td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
              <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label class="mb-2.5 block text-black dark:text-white"> Replacement Mode </label>
                  <select
                    v-model="replacementMode"
                    class="w-full rounded border-[1.5px] border-stroke bg-transparent py-3 px-5 text-black outline-none transition focus:border-primary active:border-primary dark:border-form-strokedark dark:bg-form-input dark:text-white"
                  >
                    <option value="components">Replace Components</option>
                    <option value="swap">Swap Whole Unit</option>
                  </select>
                </div>
                <div v-if="replacementMode === 'swap'" class="md:col-span-2">
                  <label class="mb-2.5 block text-black dark:text-white"> ACN to Replace </label>
                  <AcnRepairCombobox
                    v-model="replaceTargetAcn"
                    placeholder="Search deployed ACN"
                    @select="onReplaceAcnSelect"
                  />
                </div>
              </div>

              <div
                class="bg-white dark:bg-boxdark rounded-sm border border-stroke dark:border-strokedark p-4"
              >
                <div class="grid grid-cols-1 md:grid-cols-4 gap-3 items-end">
                  <div>
                    <div class="text-xs text-bodydark2">Target ACN</div>
                    <div class="text-sm font-mono">{{ replaceTargetAcn || '—' }}</div>
                  </div>
                  <div>
                    <div class="text-xs text-bodydark2">Requestor</div>
                    <div class="text-sm">{{ requestor || '—' }}</div>
                  </div>
                  <div>
                    <div class="text-xs text-bodydark2">Department</div>
                    <div class="text-sm">{{ department || '—' }}</div>
                  </div>
                  <div class="flex justify-end">
                    <button
                      type="button"
                      @click="openReplacementModal"
                      class="text-xs rounded border px-2 py-1"
                    >
                      Create RIS
                    </button>
                  </div>
                </div>
              </div>
            </div>

            <div class="flex justify-end gap-4">
              <button
                type="button"
                @click="router.push('/inventory/ris')"
                class="bg-gray-300 text-gray-700 px-6 py-2 rounded hover:bg-gray-400"
              >
                Cancel
              </button>
              <button
                type="submit"
                class="bg-primary text-white px-6 py-2 rounded hover:bg-opacity-90 flex items-center"
                :disabled="submitting"
              >
                <svg
                  v-if="submitting"
                  class="animate-spin -ml-1 mr-2 h-5 w-5 text-white"
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                >
                  <circle
                    class="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    stroke-width="4"
                  ></circle>
                  <path
                    class="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                  ></path>
                </svg>
                {{ submitting ? 'Submitting...' : 'Submit' }}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>

    <div
      v-if="showReplacementModal"
      class="fixed inset-0 bg-black/30 flex items-center justify-center z-50"
    >
      <div class="bg-white rounded shadow-lg w-full max-w-4xl p-6">
        <div class="flex items-center justify-between mb-4">
          <h2 class="text-lg font-semibold">Create Replacement RIS</h2>
          <button @click="showReplacementModal = false" class="text-sm">✕</button>
        </div>
        <div class="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
          <div>
            <label class="mb-2.5 block text-black dark:text-white"
              >Purpose <span class="text-meta-1">*</span></label
            >
            <input
              v-model="purpose"
              type="text"
              class="w-full rounded border-[1.5px] border-stroke bg-transparent py-3 px-5"
            />
          </div>
          <div>
            <label class="mb-2.5 block text-black dark:text-white"
              >Requestor <span class="text-meta-1">*</span></label
            >
            <input
              v-model="requestor"
              type="text"
              class="w-full rounded border-[1.5px] border-stroke bg-transparent py-3 px-5"
            />
          </div>
          <div>
            <label class="mb-2.5 block text-black dark:text-white">Department</label>
            <select
              v-model="department"
              class="w-full rounded border-[1.5px] border-stroke bg-transparent py-3 px-5"
            >
              <option value="">Select department</option>
              <option v-for="dept in departments" :key="dept._id" :value="dept.name">
                {{ dept.name }}<span v-if="dept.code"> ({{ dept.code }})</span>
              </option>
            </select>
          </div>
          <div>
            <label class="mb-2.5 block text-black dark:text-white">Notes</label>
            <input
              v-model="notes"
              type="text"
              placeholder="Additional notes"
              class="w-full rounded border-[1.5px] border-stroke bg-transparent py-3 px-5"
            />
          </div>
        </div>
        <div class="mb-3">
          <div class="text-sm font-semibold mb-1">Requested Parts</div>
          <div v-if="modalParts.length === 0" class="text-xs text-bodydark2">—</div>
          <ul v-else class="list-disc ml-4 text-sm">
            <li v-for="(p, i) in modalParts" :key="i">
              {{ p.part || 'Part' }} × {{ p.qty }}<span v-if="p.remarks"> — {{ p.remarks }}</span>
            </li>
          </ul>
        </div>
        <div class="border rounded p-4">
          <div class="flex justify-between items-center mb-3">
            <h3 class="text-sm font-semibold">Replacement Items</h3>
            <button type="button" @click="addItem" class="text-xs rounded border px-2 py-1">
              + Add Item
            </button>
          </div>
          <div
            v-for="(item, index) in items"
            :key="index"
            class="grid grid-cols-1 md:grid-cols-12 gap-4 mb-3 items-end"
          >
            <div class="md:col-span-5">
              <label class="mb-2.5 block text-black dark:text-white"
                >Product <span class="text-meta-1">*</span></label
              >
              <BaseCombobox
                v-model="item.product"
                :options="productOptions"
                labelKey="label"
                valueKey="_id"
                placeholder="Select Product"
                @change="() => onProductSelected(item)"
              />
            </div>
            <div class="md:col-span-2">
              <label class="mb-2.5 block text-black dark:text-white"
                >Quantity <span class="text-meta-1">*</span></label
              >
              <input
                v-model.number="item.requestedQty"
                type="number"
                min="1"
                required
                class="w-full rounded border-[1.5px] border-stroke bg-transparent py-3 px-5"
              />
            </div>
            <div class="md:col-span-4">
              <label class="mb-2.5 block text-black dark:text-white">Remarks</label>
              <input
                v-model="item.remarks"
                type="text"
                placeholder="Optional remarks"
                class="w-full rounded border-[1.5px] border-stroke bg-transparent py-3 px-5"
              />
            </div>
            <div class="md:col-span-1">
              <button
                type="button"
                @click="removeItem(index)"
                class="text-xs rounded border px-2 py-1"
              >
                Delete
              </button>
            </div>
            <div v-if="item.hasSerialNumbers" class="md:col-span-12">
              <label class="mb-1 block text-black dark:text-white">Serial Numbers</label>
              <SerialPicker
                v-model="selectedSerials[item.product]"
                :serials="productSerials[item.product] || []"
                :limit="parseInt(item.requestedQty) || 0"
              />
            </div>
            <div v-if="item.hasACN" class="md:col-span-12">
              <label class="mb-1 block text-black dark:text-white">Asset Control Number</label>
              <AcnCombobox v-model="item.acn" :productId="item.product" placeholder="Select ACN" />
            </div>
          </div>
        </div>
        <div class="mt-4 flex justify-end gap-2">
          <button @click="showReplacementModal = false" class="border px-4 py-2 rounded">
            Cancel
          </button>
          <button
            @click="submitRIS"
            :disabled="submitting"
            class="bg-primary text-white px-4 py-2 rounded"
          >
            {{ submitting ? 'Submitting...' : 'Issue RIS' }}
          </button>
        </div>
      </div>
    </div>
  </DefaultLayout>
</template>
