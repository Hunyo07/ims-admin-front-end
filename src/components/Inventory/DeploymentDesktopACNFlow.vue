<template>
  <div class="space-y-6">
    <!-- Step 1: Select Computer Desktop and Quantity -->
    <div class="border border-stroke rounded-lg p-4 dark:border-strokedark">
      <h4 class="font-medium mb-3">Select Computer Desktop</h4>
      <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div>
          <label class="block text-sm font-medium mb-1">Desktop Product</label>
          <select
            v-model="desktopProductId"
            class="w-full rounded border-[1.5px] border-stroke bg-transparent px-3 py-2 outline-none focus:border-primary dark:border-strokedark"
          >
            <option value="">Select Computer Desktop</option>
            <option v-for="p in desktopProducts" :key="p._id" :value="p._id">
              {{ p.name }} (Stock: {{ p.currentStock }})
            </option>
          </select>
        </div>

        <div>
          <label class="block text-sm font-medium mb-1">Quantity</label>
          <input
            v-model.number="desktopQty"
            type="number"
            min="1"
            :max="desktopProductStock || null"
            class="w-full rounded border-[1.5px] border-stroke bg-transparent px-3 py-2 outline-none focus:border-primary dark:border-strokedark"
          />
          <div
            v-if="desktopProductId"
            class="text-xs mt-1"
            :class="desktopProductStock <= 0 ? 'text-warning' : 'text-gray-600'"
          >
            <span v-if="desktopProductStock > 0">Available stock: {{ desktopProductStock }}</span>
            <span v-else>No stock available for selected product.</span>
          </div>
        </div>

        <div>
          <label class="block text-sm font-medium mb-1">Notes</label>
          <input
            v-model="desktopNotes"
            type="text"
            placeholder="Optional notes for desktop deployment"
            class="w-full rounded border-[1.5px] border-stroke bg-transparent px-3 py-2 outline-none focus:border-primary dark:border-strokedark"
          />
        </div>
      </div>
      <p v-if="desktopProductId && !hasAcn" class="text-xs text-warning mt-2">
        This product has no ACN tracking enabled. You can still proceed.
      </p>
    </div>

    <!-- Step 2: Select ACNs based on quantity -->
    <div v-if="desktopProductId" class="border border-stroke rounded-lg p-4 dark:border-strokedark">
      <h4 class="font-medium mb-3">Select ACNs (limit: {{ desktopQty }})</h4>
      <div class="grid grid-cols-1 md:grid-cols-3 gap-2 max-h-60 overflow-y-auto">
        <label
          v-for="acn in availableAcnList"
          :key="acn"
          class="flex items-center space-x-2 py-1 px-2 rounded hover:bg-gray-50 dark:hover:bg-meta-4"
        >
          <input
            type="checkbox"
            :value="acn"
            v-model="selectedACNs"
            :disabled="isAcnDisabled(acn)"
            class="rounded"
          />
          <span class="text-sm">{{ acn }}</span>
        </label>
      </div>
      <div class="text-xs text-gray-600 mt-2">
        Selected: {{ selectedACNs.length }} / {{ desktopQty }}
      </div>
    </div>

    <!-- Step 3: Cards per selected desktop unit -->
    <div v-if="desktopProductId && unitCards.length" class="space-y-4">
      <h4 class="font-medium">Assign Employees and Additional Items</h4>
      <div
        v-for="(unit, idx) in unitCards"
        :key="unit.id"
        class="border border-stroke rounded-lg p-4 dark:border-strokedark"
      >
        <div class="flex justify-between items-start mb-3">
          <div>
            <div class="font-medium">Desktop Unit #{{ idx + 1 }}</div>
            <div class="text-sm text-gray-600">ACN: {{ unit.acn || 'Unselected' }}</div>
          </div>
          <div class="w-64 relative">
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

        <!-- Default desktop item preview -->
        <div class="bg-gray-50 dark:bg-meta-4 p-3 rounded mb-3">
          <div class="text-sm">
            <span class="font-medium">Desktop:</span>
            {{ getProductName(desktopProductId) }}
            <span v-if="unit.acn" class="ml-2">(ACN: {{ unit.acn }})</span>
          </div>
          <div v-if="desktopNotes" class="text-xs text-gray-600">{{ desktopNotes }}</div>
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
                <option v-for="p in getProductsByType(it.type)" :key="p._id" :value="p._id">
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
              <label class="block text-sm font-medium mb-1">Serial Number</label>
              <select
                v-model="it.selectedSerial"
                class="w-full rounded border-[1.5px] border-stroke bg-transparent px-2 py-2 outline-none focus:border-primary dark:border-strokedark"
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

// Desktop selection
const desktopProductId = ref('')
const desktopQty = ref(1)
const desktopNotes = ref('')
const hasAcn = ref(false)
const acnList = ref([])
const selectedACNs = ref([])

// Unit cards derived from qty and selected ACNs
const unitCards = ref([])

// Filter desktop products
const desktopProducts = computed(() => {
  return props.products.filter((p) => {
    const cname = (p.category?.name || '').toLowerCase()
    return cname.includes('desktop') || cname.includes('computer')
  })
})

// Current stock of the selected desktop product
const desktopProductStock = computed(() => {
  const p = props.products.find((p) => p._id === desktopProductId.value)
  return p ? parseInt(p.currentStock) || 0 : 0
})

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

// Available ACNs from product, prefer product.assetControlNumbers
const availableAcnList = computed(() => {
  return Array.isArray(acnList.value) ? acnList.value : []
})

const isAcnDisabled = (acn) => {
  const isSelected = selectedACNs.value.includes(acn)
  const limitReached = selectedACNs.value.length >= (parseInt(desktopQty.value) || 0)
  return !isSelected && limitReached
}

// Fetch product details when desktopProductId changes
const fetchDesktopDetails = async () => {
  acnList.value = []
  hasAcn.value = false
  selectedACNs.value = []
  try {
    if (!desktopProductId.value) return
    const { data } = await axios.get(`/products/${desktopProductId.value}`)
    const product = data.product
    hasAcn.value = !!product?.hasAssetControlNumber
    acnList.value = Array.isArray(product?.assetControlNumbers) ? product.assetControlNumbers : []
    // Auto-select up to qty if available
    const qty = parseInt(desktopQty.value) || 0
    selectedACNs.value = acnList.value.slice(0, qty)
  } catch (e) {
    hasAcn.value = false
    acnList.value = []
    selectedACNs.value = []
  }
}

watch(desktopProductId, fetchDesktopDetails)

// Sync selected ACNs when qty changes
watch(desktopQty, (newQty) => {
  const qty = parseInt(newQty) || 0
  if (qty < selectedACNs.value.length) {
    selectedACNs.value = selectedACNs.value.slice(0, qty)
  }
  // If we have room, auto-fill remaining from acnList
  if (qty > selectedACNs.value.length) {
    const need = qty - selectedACNs.value.length
    const candidates = (acnList.value || [])
      .filter((a) => !selectedACNs.value.includes(a))
      .slice(0, need)
    selectedACNs.value = selectedACNs.value.concat(candidates)
  }
})

// Build unit cards from qty and selected ACNs
const rebuildUnitCards = () => {
  const qty = parseInt(desktopQty.value) || 0
  const cards = []
  for (let i = 0; i < qty; i++) {
    const existing = unitCards.value[i]
    cards.push({
      id: existing?.id || `${i}-${desktopProductId.value}`,
      acn: selectedACNs.value[i] || '',
      employeeId: existing?.employeeId || '',
      employeeQuery: existing?.employeeQuery || '',
      showEmpOptions: false,
      empHighlightIndex: 0,
      items: Array.isArray(existing?.items) ? existing.items : []
    })
  }
  unitCards.value = cards
  emitDeploymentData()
}

watch(selectedACNs, rebuildUnitCards, { deep: true })
watch(desktopQty, rebuildUnitCards)

// Clamp quantity to available stock and keep it >= 1
watch([desktopQty, desktopProductStock], ([qty, stock]) => {
  let q = parseInt(qty) || 1
  if (stock > 0 && q > stock) {
    desktopQty.value = stock
    q = stock
  }
  if (q < 1) desktopQty.value = 1
})

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
    const { data } = await axios.get(`/products/${it.product}`)
    const p = data.product
    it.hasSerialNumbers = !!p?.hasSerialNumbers
    it.hasAssetControlNumber = !!p?.hasAssetControlNumber
    it.availableSerials = Array.isArray(p?.serialNumbers) ? p.serialNumbers : []
    it.availableACNs = Array.isArray(p?.assetControlNumbers) ? p.assetControlNumbers : []
    // Build serial-to-ACN map if both serials and ACNs are tracked
    it.serialToAcnMap = {}
    if (it.hasSerialNumbers && it.hasAssetControlNumber) {
      // Fallback: pair arrays by index from product details
      const baseMap = {}
      const len = Math.min(it.availableSerials.length, it.availableACNs.length)
      for (let i = 0; i < len; i++) {
        const sn = it.availableSerials[i]
        const acn = it.availableACNs[i]
        if (sn && acn) baseMap[sn] = acn
      }
      it.serialToAcnMap = baseMap
      // Prefer explicit ACN records when available
      try {
        const { data: acnResp } = await axios.get(`/acns/product/${it.product}`)
        for (const a of acnResp?.acns || []) {
          if (a?.serialNumber) it.serialToAcnMap[a.serialNumber] = a.acnCode
        }
      } catch (_) {
        // keep baseMap
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

// Emit deploymentData aggregated per employee
const emitDeploymentData = () => {
  const map = new Map()
  for (const unit of unitCards.value) {
    if (!unit.employeeId) continue
    const employee = props.employees.find((e) => e._id === unit.employeeId)
    if (!employee) continue
    if (!map.has(unit.employeeId)) {
      map.set(unit.employeeId, {
        id: unit.employeeId,
        name: `${employee.firstName} ${employee.lastName}`,
        department: employee.department || '',
        items: []
      })
    }
    const entry = map.get(unit.employeeId)
    // Desktop item with ACN as part of remarks
    if (desktopProductId.value) {
      entry.items.push({
        type: 'desktop',
        product: desktopProductId.value,
        propertyNumber: '',
        quantity: 1,
        // include ACN explicitly for downstream consumers
        acn: unit.acn || undefined,
        remarks: unit.acn
          ? `ACN: ${unit.acn}${desktopNotes.value ? ` | ${desktopNotes.value}` : ''}`
          : desktopNotes.value || ''
      })
    }
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
      entry.items.push({
        type: it.type,
        product: it.product,
        propertyNumber: '',
        quantity: 1,
        remarks: finalRemarks,
        // emit explicit fields so CreateRIS can build serialNumbers mapping
        serialNumber: it.selectedSerial || undefined,
        acn: (it.selectedACN || (acnFromSerial || undefined))
      })
    }
  }
  const employees = Array.from(map.values())
  emit('update:deploymentData', { employees })
}

// Auto-select first desktop product on mount if available
onMounted(() => {
  if (!desktopProductId.value && desktopProducts.value.length) {
    desktopProductId.value = desktopProducts.value[0]._id
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

const selectEmployee = (unitIndex, employee) => {
  const unit = unitCards.value[unitIndex]
  if (!unit || !employee) return
  unit.employeeId = employee._id
  unit.employeeQuery = `${employee.firstName || ''} ${employee.lastName || ''}`.trim()
  unit.showEmpOptions = false
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
</script>
