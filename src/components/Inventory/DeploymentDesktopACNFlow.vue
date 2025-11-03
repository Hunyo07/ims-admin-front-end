<template>
  <div class="space-y-6">
    <!-- Primary Items Section -->
    <div class="border border-stroke rounded-lg p-4 dark:border-strokedark">
      <div class="flex justify-between items-center mb-3">
        <h4 class="font-medium">Primary Items (Desktop/Laptop)</h4>
        <button
          type="button"
          @click="addPrimaryItem"
          class="bg-primary text-white px-3 py-2 rounded hover:bg-opacity-90 text-sm"
        >
          + Add Primary Item
        </button>
      </div>
      
      <div v-for="(primary, pIdx) in primaryItems" :key="primary.id" class="mb-4 pb-4 border-b border-stroke last:border-0">
        <div class="grid grid-cols-1 md:grid-cols-12 gap-4 items-end">
          <div class="md:col-span-2">
            <label class="block text-sm font-medium mb-1">Device Type</label>
            <select
              v-model="primary.deviceType"
              @change="onPrimaryDeviceTypeChange(pIdx)"
              class="w-full rounded border-[1.5px] border-stroke bg-transparent px-3 py-2 outline-none focus:border-primary dark:border-strokedark"
            >
              <option value="desktop">Desktop</option>
              <option value="laptop">Laptop</option>
            </select>
          </div>
          <div class="md:col-span-4">
            <label class="block text-sm font-medium mb-1">Product</label>
            <select
              v-model="primary.productId"
              @change="onPrimaryProductChange(pIdx)"
              class="w-full rounded border-[1.5px] border-stroke bg-transparent px-3 py-2 outline-none focus:border-primary dark:border-strokedark"
            >
              <option value="">Select Product</option>
              <option 
                v-for="p in getPrimaryProductsByType(primary.deviceType)" 
                :key="p._id" 
                :value="p._id"
                :disabled="!p.currentStock || p.currentStock <= 0"
              >
                {{ p.name }} (Stock: {{ p.currentStock }})
              </option>
            </select>
          </div>
          <div class="md:col-span-2">
            <label class="block text-sm font-medium mb-1">Quantity</label>
            <input
              v-model.number="primary.qty"
              @input="onPrimaryQtyChange(pIdx)"
              type="number"
              min="1"
              :max="primary.stock || null"
              class="w-full rounded border-[1.5px] border-stroke bg-transparent px-3 py-2 outline-none focus:border-primary dark:border-strokedark"
            />
          </div>
          <div class="md:col-span-3">
            <label class="block text-sm font-medium mb-1">Notes</label>
            <input
              v-model="primary.notes"
              type="text"
              placeholder="Optional notes"
              class="w-full rounded border-[1.5px] border-stroke bg-transparent px-3 py-2 outline-none focus:border-primary dark:border-strokedark"
            />
          </div>
          <div class="md:col-span-1">
            <button
              type="button"
              @click="removePrimaryItem(pIdx)"
              :disabled="primaryItems.length === 1"
              class="bg-danger text-white px-2 py-2 rounded hover:bg-opacity-90 w-full disabled:opacity-50"
            >
              Remove
            </button>
          </div>
        </div>
        
        <!-- ACN Selection for this primary item -->
        <div v-if="primary.productId && primary.hasAcn" class="mt-3 p-3 bg-gray-50 dark:bg-meta-4 rounded">
          <h5 class="text-sm font-medium mb-2">Select ACNs ({{ primary.selectedACNs.length }} / {{ primary.qty }})</h5>
          <div class="grid grid-cols-1 md:grid-cols-3 gap-2 max-h-40 overflow-y-auto">
            <label
              v-for="acn in primary.availableAcns"
              :key="acn"
              class="flex items-center space-x-2 py-1 px-2 rounded hover:bg-white dark:hover:bg-boxdark"
            >
              <input
                type="checkbox"
                :value="acn"
                v-model="primary.selectedACNs"
                :disabled="isPrimaryAcnDisabled(pIdx, acn)"
                class="rounded"
              />
              <span class="text-sm">{{ acn }}</span>
            </label>
          </div>
        </div>
      </div>
    </div>

    <!-- Unit Cards per all primary items -->
    <div v-if="unitCards.length" class="space-y-4">
      <h4 class="font-medium">Assign Employees and Additional Items ({{ unitCards.length }} units)</h4>
      <div
        v-for="(unit, idx) in unitCards"
        :key="unit.id"
        class="border border-stroke rounded-lg p-4 dark:border-strokedark"
      >
        <div class="flex justify-between items-start mb-3">
          <div>
            <div class="font-medium">{{ unit.primaryLabel || 'Desktop' }} Unit #{{ idx + 1 }}</div>
            <div class="text-sm text-gray-600">ACN: {{ unit.acn || 'Unselected' }}</div>
          </div>
          <div class="w-64 relative">
            <!-- Deployment History Warning -->
            <div v-if="unit.hasDuplicateWarning && unit.deploymentHistory?.length" class="mb-2 p-2 bg-warning/10 border border-warning/30 rounded text-xs">
              <div class="flex items-start gap-2">
                <svg class="w-4 h-4 text-warning flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                  <path fill-rule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clip-rule="evenodd" />
                </svg>
                <div>
                  <div class="font-medium text-warning">Already has {{ unit.deploymentHistory.length }} deployed item(s)</div>
                  <button 
                    type="button" 
                    @click="unit.showHistory = !unit.showHistory"
                    class="text-primary hover:underline mt-1"
                  >
                    {{ unit.showHistory ? 'Hide' : 'View' }} details
                  </button>
                  <div v-if="unit.showHistory" class="mt-2 space-y-1 max-h-32 overflow-y-auto">
                    <div v-for="(item, i) in unit.deploymentHistory" :key="i" class="text-xs bg-white dark:bg-boxdark p-2 rounded">
                      <div class="font-medium">{{ item.description }}</div>
                      <div class="text-gray-600">ACN: {{ item.acn || 'N/A' }}</div>
                      <div class="text-gray-600">Deployed: {{ new Date(item.deployedDate).toLocaleDateString() }}</div>
                    </div>
                  </div>
                  <div class="mt-2 text-warning">
                    <label class="flex items-center gap-1">
                      <input type="radio" :name="`action-${idx}`" value="additional" v-model="unit.deploymentAction" class="rounded" />
                      <span>Additional items</span>
                    </label>
                    <label class="flex items-center gap-1">
                      <input type="radio" :name="`action-${idx}`" value="replacement" v-model="unit.deploymentAction" class="rounded" />
                      <span>Replacement (retire old)</span>
                    </label>
                  </div>
                </div>
              </div>
            </div>
            <label class="block text-sm font-medium mb-1">Employee</label>
            <div class="flex items-center space-x-2">
              <input
                v-model="unit.employeeQuery"
                @focus="openEmpOptions(idx)"
                @input="openEmpOptions(idx)"
                @keydown.down.prevent="moveEmpHighlight(idx, 1)"
                @keydown.up.prevent="moveEmpHighlight(idx, -1)"
                @keydown.enter.prevent="selectEmpFromHighlight(idx)"
                @keydown.esc.prevent="closeEmpOptions(idx)"
                @blur="closeEmpOptionsLater(idx)"
                type="text"
                placeholder="Type to search employee"
                class="w-full rounded border-[1.5px] border-stroke bg-transparent px-3 py-2 outline-none focus:border-primary dark:border-strokedark"
              />
              <button
                v-if="unit.employeeId"
                type="button"
                @click="clearEmployeeSelection(idx)"
                class="text-xs px-2 py-1 rounded border border-stroke dark:border-strokedark hover:bg-gray-50 dark:hover:bg-meta-4"
              >
                Clear
              </button>
            </div>
            <ul
              v-if="unit.showEmpOptions"
              class="absolute z-10 mt-1 w-full bg-white dark:bg-boxdark border border-stroke dark:border-strokedark rounded shadow max-h-48 overflow-auto"
            >
              <li v-for="(e, eidx) in getFilteredEmployees(unit.employeeQuery)" :key="e._id">
                <button
                  type="button"
                  @mousedown.prevent="selectEmployee(idx, e)"
                  :class="[
                    'w-full text-left px-3 py-2 hover:bg-gray-50 dark:hover:bg-meta-4',
                    eidx === unit.empHighlightIndex ? 'bg-gray-100 dark:bg-meta-3' : ''
                  ]"
                >
                  {{ e.firstName }} {{ e.lastName }}
                  <span v-if="e.email" class="text-xs text-gray-500"> — {{ e.email }}</span>
                </button>
              </li>
              <li
                v-if="getFilteredEmployees(unit.employeeQuery).length === 0"
                class="px-3 py-2 text-sm text-gray-500"
              >
                No matches
              </li>
            </ul>
            <div v-if="unit.employeeId" class="text-xs text-gray-600 mt-1">
              Selected: {{ formatEmployeeNameById(unit.employeeId) }}
            </div>
          </div>
        </div>

        <!-- Primary item preview -->
        <div class="bg-gray-50 dark:bg-meta-4 p-3 rounded mb-3">
          <div class="text-sm">
            <span class="font-medium">{{ unit.primaryLabel }}:</span>
            {{ unit.primaryProductName }}
            <span v-if="unit.acn" class="ml-2">(ACN: {{ unit.acn }})</span>
          </div>
          <div v-if="unit.primaryNotes" class="text-xs text-gray-600">{{ unit.primaryNotes }}</div>
        </div>

        <!-- Additional items per unit -->
        <div class="space-y-2">
          <div
            v-for="(it, iidx) in unit.items"
            :key="iidx"
            class="grid grid-cols-1 md:grid-cols-12 gap-2 items-end"
          >
            <div class="md:col-span-3">
              <label class="block text-sm font-medium mb-1">Category</label>
              <select
                v-model="it.type"
                class="w-full rounded border-[1.5px] border-stroke bg-transparent px-2 py-2 outline-none focus:border-primary dark:border-strokedark"
              >
                <option value="">Select category</option>
                <option value="monitor">Monitor</option>
                <option value="printer">Printer</option>
                <option value="scanner">Scanner</option>
                <option value="laptop">Laptop</option>
              </select>
            </div>
            <div class="md:col-span-5">
              <label class="block text-sm font-medium mb-1">Item</label>
              <select
                v-model="it.product"
                @change="onItemProductChange(idx, iidx)"
                class="w-full rounded border-[1.5px] border-stroke bg-transparent px-2 py-2 outline-none focus:border-primary dark:border-strokedark"
              >
                <option value="">Select item</option>
                <option 
                  v-for="p in getProductsByType(it.type)" 
                  :key="p._id" 
                  :value="p._id"
                  :disabled="!p.currentStock || p.currentStock <= 0"
                >
                  {{ p.name }} (Stock: {{ p.currentStock }})
                </option>
              </select>
              <!-- <div v-if="it.product" class="mt-2 text-xs text-gray-600">
                <span v-if="it.hasSerialNumbers">Requires serial selection</span>
                <span v-else-if="it.hasAssetControlNumber">Select ACN</span>
                <span v-else>No serial or ACN required</span>
              </div> -->
            </div>
            <div class="md:col-span-3" v-if="it.product && it.hasSerialNumbers">
              <label class="block text-sm font-medium mb-1">Serial Number <span class="text-meta-1">*</span></label>
              <select
                v-model="it.selectedSerial"
                class="w-full rounded border-[1.5px] border-stroke bg-transparent px-2 py-2 outline-none focus:border-primary dark:border-strokedark"
                :class="{ 'border-danger': it.product && !it.selectedSerial }"
              >
                <option value="">Select serial</option>
                <option v-for="sn in getAvailableSerials(it)" :key="sn" :value="sn">
                  {{ sn }}
                </option>
              </select>
              <div v-if="it.selectedSerial" class="text-xs text-gray-600 mt-1">
                ACN: {{ getAcnForSerial(it) || 'N/A' }}
              </div>
              <div
                v-if="it.hasSerialNumbers && !it.availableSerials?.length"
                class="text-xs text-warning mt-1"
              >
                No serials available for this product.
              </div>
              <div
                v-if="it.product && !it.selectedSerial && it.availableSerials?.length"
                class="text-xs text-danger mt-1"
              >
                Serial number is required for this product.
              </div>
            </div>
            <div class="md:col-span-3" v-else-if="it.product && it.hasAssetControlNumber">
              <label class="block text-sm font-medium mb-1">Asset Control Number</label>
              <select
                v-model="it.selectedACN"
                class="w-full rounded border-[1.5px] border-stroke bg-transparent px-2 py-2 outline-none focus:border-primary dark:border-strokedark"
              >
                <option value="">Select ACN</option>
                <option v-for="acn in getAvailableACNs(it)" :key="acn" :value="acn">
                  {{ acn }}
                </option>
              </select>
              <div
                v-if="it.hasAssetControlNumber && !it.availableACNs?.length"
                class="text-xs text-warning mt-1"
              >
                No ACNs available for this product.
              </div>
            </div>
            <div class="md:col-span-3">
              <label class="block text-sm font-medium mb-1">Remarks</label>
              <input
                v-model="it.remarks"
                placeholder="Optional remarks"
                class="w-full rounded border-[1.5px] border-stroke bg-transparent px-2 py-2 outline-none focus:border-primary dark:border-strokedark"
              />
            </div>
            <div class="md:col-span-1">
              <button
                type="button"
                @click="removeUnitItem(idx, iidx)"
                class="bg-danger text-white px-2 py-2 rounded hover:bg-opacity-90 w-full"
              >
                Remove
              </button>
            </div>
          </div>

          <div>
            <button
              type="button"
              @click="addUnitItem(idx)"
              class="bg-primary text-white px-3 py-2 rounded hover:bg-opacity-90"
            >
              Add Item
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, watch, onMounted } from 'vue'
import axios from '../../utils/axios'

const props = defineProps({
  employees: { type: Array, default: () => [] },
  products: { type: Array, default: () => [] }
})

const emit = defineEmits(['update:deploymentData'])

// Primary items array (supports multiple desktops/laptops)
const primaryItems = ref([{
  id: Date.now(),
  deviceType: 'desktop',
  productId: '',
  qty: 1,
  notes: '',
  stock: 0,
  hasAcn: false,
  availableAcns: [],
  selectedACNs: []
}])

const deployedAcnCodes = ref([])
const deployedSerials = ref([])
const unitCards = ref([])

// Get products by device type
const getPrimaryProductsByType = (deviceType) => {
  return props.products.filter((p) => {
    const cname = (p.category?.name || '').toLowerCase()
    return deviceType === 'desktop'
      ? cname.includes('desktop') || cname.includes('computer')
      : cname.includes('laptop')
  })
}

const getProductsByType = (type) => {
  const cname = (name) => (name || '').toLowerCase()
  return props.products.filter((p) => {
    const cat = cname(p.category?.name)
    if (!type) return false
    if (type === 'monitor') return cat.includes('monitor')
    if (type === 'printer') return cat.includes('printer')
    if (type === 'scanner') return cat.includes('scanner')
    if (type === 'laptop') return cat.includes('laptop')
    return false
  })
}

const getProductName = (id) => {
  const p = props.products.find((p) => p._id === id)
  return p ? p.name : 'Unknown'
}

// Check if ACN is disabled for a primary item
const isPrimaryAcnDisabled = (pIdx, acn) => {
  const primary = primaryItems.value[pIdx]
  if (!primary) return true
  const isSelected = primary.selectedACNs.includes(acn)
  const limitReached = primary.selectedACNs.length >= (parseInt(primary.qty) || 0)
  return !isSelected && limitReached
}

// Add/remove primary items
const addPrimaryItem = () => {
  primaryItems.value.push({
    id: Date.now(),
    deviceType: 'desktop',
    productId: '',
    qty: 1,
    notes: '',
    stock: 0,
    hasAcn: false,
    availableAcns: [],
    selectedACNs: []
  })
}

const removePrimaryItem = (pIdx) => {
  if (primaryItems.value.length > 1) {
    primaryItems.value.splice(pIdx, 1)
    rebuildUnitCards()
  }
}

const onPrimaryDeviceTypeChange = (pIdx) => {
  const primary = primaryItems.value[pIdx]
  if (!primary) return
  primary.productId = ''
  primary.qty = 1
  primary.stock = 0
  primary.hasAcn = false
  primary.availableAcns = []
  primary.selectedACNs = []
  rebuildUnitCards()
}

const onPrimaryQtyChange = (pIdx) => {
  const primary = primaryItems.value[pIdx]
  if (!primary) return
  const qty = parseInt(primary.qty) || 1
  if (qty < 1) primary.qty = 1
  if (primary.stock > 0 && qty > primary.stock) primary.qty = primary.stock
  // Adjust selected ACNs
  if (qty < primary.selectedACNs.length) {
    primary.selectedACNs = primary.selectedACNs.slice(0, qty)
  } else if (qty > primary.selectedACNs.length) {
    const need = qty - primary.selectedACNs.length
    const candidates = primary.availableAcns.filter(a => !primary.selectedACNs.includes(a)).slice(0, need)
    primary.selectedACNs = [...primary.selectedACNs, ...candidates]
  }
  rebuildUnitCards()
}

// Fetch deployed ACNs and serials from inventory records
const fetchDeployedAcnCodes = async () => {
  try {
    const { data } = await axios.get('/inventory-records', { params: { status: 'deployed' } })
    const codes = new Set()
    const serials = new Set()
    for (const rec of data?.records || []) {
      for (const item of rec.items || []) {
        if (item.acn) codes.add(item.acn)
        if (item.serialNumber) serials.add(item.serialNumber)
        if (Array.isArray(item.secondaryItems)) {
          for (const sec of item.secondaryItems) {
            if (sec.acn) codes.add(sec.acn)
            if (sec.serialNumber) serials.add(sec.serialNumber)
          }
        }
      }
    }
    deployedAcnCodes.value = Array.from(codes)
    deployedSerials.value = Array.from(serials)
  } catch (e) {
    deployedAcnCodes.value = []
    deployedSerials.value = []
  }
}

// Fetch product details for a primary item
const onPrimaryProductChange = async (pIdx) => {
  const primary = primaryItems.value[pIdx]
  if (!primary || !primary.productId) return
  try {
    await fetchDeployedAcnCodes()
    const { data } = await axios.get(`/products/${primary.productId}`)
    const product = data.product
    primary.stock = parseInt(product.currentStock) || 0
    primary.hasAcn = !!product?.hasAssetControlNumber
    const allAcns = Array.isArray(product?.assetControlNumbers) ? product.assetControlNumbers : []
    primary.availableAcns = allAcns.filter(acn => !deployedAcnCodes.value.includes(acn))
    primary.selectedACNs = primary.availableAcns.slice(0, primary.qty)
    rebuildUnitCards()
  } catch (e) {
    primary.stock = 0
    primary.hasAcn = false
    primary.availableAcns = []
    primary.selectedACNs = []
  }
}

// Build unit cards from all primary items
const rebuildUnitCards = () => {
  const newCards = []
  let cardIndex = 0
  for (const primary of primaryItems.value) {
    if (!primary.productId) continue
    const qty = parseInt(primary.qty) || 0
    const product = props.products.find(p => p._id === primary.productId)
    for (let i = 0; i < qty; i++) {
      const existing = unitCards.value[cardIndex]
      newCards.push({
        id: existing?.id || `${cardIndex}-${primary.productId}`,
        primaryProductId: primary.productId,
        primaryProductName: product?.name || 'Unknown',
        primaryLabel: primary.deviceType === 'laptop' ? 'Laptop' : 'Desktop',
        primaryNotes: primary.notes || '',
        acn: primary.selectedACNs[i] || '',
        employeeId: existing?.employeeId || '',
        employeeQuery: existing?.employeeQuery || '',
        employeeDepartment: existing?.employeeDepartment || '',
        showEmpOptions: false,
        empHighlightIndex: 0,
        items: Array.isArray(existing?.items) ? existing.items : [],
        deploymentHistory: existing?.deploymentHistory || [],
        hasDuplicateWarning: existing?.hasDuplicateWarning || false,
        showHistory: existing?.showHistory || false,
        deploymentAction: existing?.deploymentAction || 'additional'
      })
      cardIndex++
    }
  }
  unitCards.value = newCards
  emitDeploymentData()
}

watch(primaryItems, rebuildUnitCards, { deep: true })

// Add/remove items per unit
const addUnitItem = (unitIndex) => {
  const unit = unitCards.value[unitIndex]
  if (!unit) return
  unit.items.push({
    type: '',
    product: '',
    remarks: '',
    hasSerialNumbers: false,
    hasAssetControlNumber: false,
    availableSerials: [],
    availableACNs: [],
    selectedSerial: '',
    selectedACN: '',
    serialToAcnMap: {}
  })
  emitDeploymentData()
}

const removeUnitItem = (unitIndex, itemIndex) => {
  const unit = unitCards.value[unitIndex]
  if (!unit) return
  unit.items.splice(itemIndex, 1)
  emitDeploymentData()
}

// Fetch product details for item selection, to determine serial vs ACN
const onItemProductChange = async (unitIndex, itemIndex) => {
  const unit = unitCards.value[unitIndex]
  const it = unit?.items?.[itemIndex]
  if (!it || !it.product) return
  try {
    await fetchDeployedAcnCodes()
    const { data } = await axios.get(`/products/${it.product}`)
    const p = data.product
    it.hasSerialNumbers = !!p?.hasSerialNumbers
    it.hasAssetControlNumber = !!p?.hasAssetControlNumber
    const allSerials = Array.isArray(p?.serialNumbers) ? p.serialNumbers : []
    it.availableSerials = allSerials.filter(sn => !deployedSerials.value.includes(sn))
    const allAcns = Array.isArray(p?.assetControlNumbers) ? p.assetControlNumbers : []
    it.availableACNs = allAcns.filter(acn => !deployedAcnCodes.value.includes(acn))
    // Build serial-to-ACN map if both serials and ACNs are tracked
    it.serialToAcnMap = {}
    if (it.hasSerialNumbers && it.hasAssetControlNumber) {
      // Build mapping only from explicit ACN records to avoid index-based pairing
      try {
        const { data: acnResp } = await axios.get(`/acns/product/${it.product}`)
        const map = {}
        for (const a of acnResp?.acns || []) {
          if (a?.serialNumber && a?.acnCode) map[a.serialNumber] = a.acnCode
        }
        it.serialToAcnMap = map
      } catch (_) {
        it.serialToAcnMap = {}
      }
    }
    // Reset selections when product changes
    it.selectedSerial = ''
    it.selectedACN = ''
  } catch (e) {
    it.hasSerialNumbers = false
    it.hasAssetControlNumber = false
    it.availableSerials = []
    it.availableACNs = []
    it.selectedSerial = ''
    it.selectedACN = ''
    it.serialToAcnMap = {}
  }
}

// Prevent selecting the same serial/ACN across items for the same product
const getTakenSerials = (productId) => {
  const taken = []
  for (const unit of unitCards.value) {
    for (const it of unit.items) {
      if (it.product === productId && it.selectedSerial) taken.push(it.selectedSerial)
    }
  }
  return taken
}

const getTakenACNs = (productId) => {
  const taken = []
  for (const unit of unitCards.value) {
    for (const it of unit.items) {
      if (it.product === productId && it.selectedACN) taken.push(it.selectedACN)
    }
  }
  return taken
}

const getAvailableSerials = (it) => {
  const taken = getTakenSerials(it.product)
  const list = Array.isArray(it.availableSerials) ? it.availableSerials : []
  // Allow already selected value to stay visible
  return list.filter((sn) => !taken.includes(sn) || sn === it.selectedSerial)
}

const getAvailableACNs = (it) => {
  const taken = getTakenACNs(it.product)
  const list = Array.isArray(it.availableACNs) ? it.availableACNs : []
  return list.filter((a) => !taken.includes(a) || a === it.selectedACN)
}

// Validate that all serialized items have serials selected
const validateSerialSelections = () => {
  for (const unit of unitCards.value) {
    if (!unit) continue
    for (const it of unit.items) {
      if (it.hasSerialNumbers && it.product && !it.selectedSerial) {
        return false
      }
    }
  }
  return true
}

// Emit deploymentData aggregated per employee
const emitDeploymentData = () => {
  const map = new Map()
  for (const unit of unitCards.value) {
    if (!unit || !unit.employeeId || !unit.primaryProductId) continue
    const employee = props.employees.find((e) => e._id === unit.employeeId)
    if (!employee) continue
    if (!map.has(unit.employeeId)) {
      map.set(unit.employeeId, {
        id: unit.employeeId,
        name: `${employee.firstName} ${employee.lastName}`,
        department: unit.employeeDepartment || employee.department || '',
        items: []
      })
    }
    const entry = map.get(unit.employeeId)
    // Primary item with ACN
    const primaryItem = {
      type: (unit.primaryLabel || 'desktop').toLowerCase(),
      product: unit.primaryProductId,
      propertyNumber: '',
      quantity: 1,
      acn: unit.acn || undefined,
      remarks: unit.acn
        ? `ACN: ${unit.acn}${unit.primaryNotes ? ` | ${unit.primaryNotes}` : ''}`
        : unit.primaryNotes || ''
    }
    
    entry.items.push(primaryItem)
    // Additional items
    for (const it of unit.items) {
      if (!it.type || !it.product) continue
      // Build remarks with SN or ACN as per availability
      const acnFromSerial =
        it.selectedSerial && it.serialToAcnMap ? it.serialToAcnMap[it.selectedSerial] : ''
      const detailRemark =
        it.hasSerialNumbers && it.selectedSerial
          ? `SN: ${it.selectedSerial}${acnFromSerial ? ` | ACN: ${acnFromSerial}` : ''}`
          : it.hasAssetControlNumber && it.selectedACN
            ? `ACN: ${it.selectedACN}`
            : ''
      const finalRemarks = [detailRemark, it.remarks].filter(Boolean).join(' | ')
      
      const itemData = {
        type: it.type,
        product: it.product,
        propertyNumber: '',
        quantity: 1,
        remarks: finalRemarks,
        acn: it.selectedACN || acnFromSerial || undefined
      }
      
      // Only include serialNumber if item has serials and one is selected
      if (it.hasSerialNumbers && it.selectedSerial) {
        itemData.serialNumber = it.selectedSerial
      }
      
      entry.items.push(itemData)
    }
  }
  const employees = Array.from(map.values())
  emit('update:deploymentData', { employees })
}

onMounted(() => {
  // Initialize with first available desktop if exists
  const desktops = getPrimaryProductsByType('desktop')
  if (desktops.length && !primaryItems.value[0].productId) {
    primaryItems.value[0].productId = desktops[0]._id
    onPrimaryProductChange(0)
  }
})

// Emit on unit card changes (e.g., employeeId updates)
watch(unitCards, emitDeploymentData, { deep: true })

// Helpers: employee filtering and formatting
const getFilteredEmployees = (query) => {
  const q = (query || '').toLowerCase()
  if (!q) return props.employees
  return props.employees.filter((e) => {
    const name = `${e.firstName || ''} ${e.lastName || ''}`.toLowerCase()
    const email = (e.email || '').toLowerCase()
    const phone = (e.phoneNumber || '').toLowerCase()
    return name.includes(q) || email.includes(q) || phone.includes(q)
  })
}

const formatEmployeeNameById = (id) => {
  const e = props.employees.find((e) => e._id === id)
  return e ? `${e.firstName} ${e.lastName}` : 'Selected employee'
}

// Combobox helpers
const openEmpOptions = (unitIndex) => {
  const unit = unitCards.value[unitIndex]
  if (!unit) return
  unit.showEmpOptions = true
  unit.empHighlightIndex = 0
}

const closeEmpOptions = (unitIndex) => {
  const unit = unitCards.value[unitIndex]
  if (!unit) return
  unit.showEmpOptions = false
}

const closeEmpOptionsLater = (unitIndex) => {
  setTimeout(() => closeEmpOptions(unitIndex), 150)
}

const selectEmployee = async (unitIndex, employee) => {
  const unit = unitCards.value[unitIndex]
  if (!unit || !employee) return
  unit.employeeId = employee._id
  unit.employeeQuery = `${employee.firstName || ''} ${employee.lastName || ''}`.trim()
  unit.employeeDepartment = employee.department || ''
  unit.showEmpOptions = false
  
  // Fetch deployment history for this employee
  await fetchEmployeeDeploymentHistory(unitIndex, employee._id)
  
  emitDeploymentData()
}

const clearEmployeeSelection = (unitIndex) => {
  const unit = unitCards.value[unitIndex]
  if (!unit) return
  unit.employeeId = ''
  unit.employeeQuery = ''
  emitDeploymentData()
}

const moveEmpHighlight = (unitIndex, delta) => {
  const unit = unitCards.value[unitIndex]
  if (!unit) return
  const list = getFilteredEmployees(unit.employeeQuery)
  if (!list.length) return
  const next = (unit.empHighlightIndex + delta + list.length) % list.length
  unit.empHighlightIndex = next
}

const selectEmpFromHighlight = (unitIndex) => {
  const unit = unitCards.value[unitIndex]
  if (!unit) return
  const list = getFilteredEmployees(unit.employeeQuery)
  const choice = list[unit.empHighlightIndex]
  if (choice) selectEmployee(unitIndex, choice)
}

// Helper: ACN display for selected serial
const getAcnForSerial = (it) => {
  if (!it || !it.selectedSerial) return ''
  const map = it.serialToAcnMap || {}
  return map[it.selectedSerial] || ''
}

// Fetch employee deployment history
const fetchEmployeeDeploymentHistory = async (unitIndex, employeeId) => {
  const unit = unitCards.value[unitIndex]
  if (!unit) return
  
  try {
    const { data } = await axios.get('/inventory-records', { 
      params: { employeeId, status: 'deployed' } 
    })
    
    const deployedItems = []
    for (const rec of data?.records || []) {
      for (const item of rec.items || []) {
        if (item.employeeId === employeeId && item.status === 'deployed') {
          deployedItems.push({
            description: item.description,
            acn: item.acn,
            serialNumber: item.serialNumber,
            product: item.product,
            deployedDate: rec.date
          })
        }
      }
    }
    
    unit.deploymentHistory = deployedItems
    unit.hasDuplicateWarning = deployedItems.length > 0
  } catch (e) {
    unit.deploymentHistory = []
    unit.hasDuplicateWarning = false
  }
}
</script>
