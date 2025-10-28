<script setup>
import { ref, onMounted, computed, watch, nextTick } from 'vue'
import axios from '../../utils/axios'
import DefaultLayout from '../../layouts/DefaultLayout.vue'
import BreadcrumbDefault from '../../components/Breadcrumbs/BreadcrumbDefault.vue'
import BaseCombobox from '../../components/Forms/BaseCombobox.vue'
import { useAuthStore } from '../../stores/auth'
import { useRouter } from 'vue-router'

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
// Item-level server filters
const serialSearch = ref('')
const acnSearch = ref('')

// Pagination
const currentPage = ref(1)
const pageSize = ref(10)

// Departments
const departments = ref([])
const authStore = useAuthStore()
const createdByName = computed(() => authStore?.user?.name || authStore?.user?.email || '')

// Lifecycle status options
const statusOptions = ['deployed', 'returned', 'repair', 'retired']

// Cache of globally deployed ACN codes for robust filtering
const deployedAcnCodes = ref([])

// Helper to safely read specs from either top-level or nested `specs`
function specFrom(item, key) {
  try {
    return item?.[key] || item?.specs?.[key] || ''
  } catch (_) {
    return ''
  }
}

// Helper to extract ACNs from legacy display strings (backward compatibility)
function extractAcnsFromDisplayStrings(item) {
  const acns = []
  const acnPattern = /[A-Z]{3}-\d{3}-\d{2}-\d{4}/g

  // Extract from monitorAndSerial field
  const monitorStr = String(item.monitorAndSerial || '')
  const monitorMatches = monitorStr.match(acnPattern) || []
  acns.push(...monitorMatches)

  // Extract from printerOrScanner field
  const printerStr = String(item.printerOrScanner || '')
  const printerMatches = printerStr.match(acnPattern) || []
  acns.push(...printerMatches)

  return acns.map((acn) => acn.trim().toUpperCase()).filter(Boolean)
}
async function fetchDeployedAcnCodes() {
  try {
    const { data } = await axios.get('/inventory-records', {
      params: { status: 'deployed', page: 1, limit: 10000 }
    })
    const list = Array.isArray(data?.records) ? data.records : Array.isArray(data) ? data : []
    const norm = (s) =>
      String(s || '')
        .trim()
        .toUpperCase()
    const codes = (list || []).flatMap((rec) =>
      (rec.items || [])
        .flatMap((it) => {
          const primary = [norm(it.propertyNumber), norm(it.acn)]
          const secondary = (it.secondaryItems || []).flatMap((sec) => [
            norm(sec.propertyNumber),
            norm(sec.acn)
          ])
          // For backward compatibility: extract ACNs from display strings if secondaryItems is empty
          const legacy =
            (it.secondaryItems || []).length === 0 ? extractAcnsFromDisplayStrings(it) : []
          return [...primary, ...secondary, ...legacy]
        })
        .filter((s) => !!s)
    )
    const uniq = Array.from(new Set(codes))
    console.log(data)
    deployedAcnCodes.value = uniq
  } catch (_) {
    deployedAcnCodes.value = deployedAcnCodes.value || []
  }
}

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
      acn: '',
      propertyNumber: '',
      printerOrScanner: '',
      endUserOrMR: '',
      remarksYears: '',
      // identifiers & lifecycle
      serialNumber: '',
      status: 'deployed',
      statusNotes: ''
    }
  ]
})

// Primary device and employee selectors for Add modal
const deviceType = ref('desktop')
const products = ref([])
const employees = ref([])
const primaryProductId = ref('')
const selectedEmployeeId = ref('')
// Loading and error states for selectors
const productsLoading = ref(false)
const employeesLoading = ref(false)
const productsError = ref(null)
const employeesError = ref(null)

// ACN selection state (RIS-style: use product.assetControlNumbers)
const acnOptionsByProduct = ref({})
const serialByAcnByProduct = ref({})
const acnLoading = ref(false)
const acnError = ref(null)
const selectedPrimaryAcn = ref('')
// RIS-style ACN combobox
const acnQuery = ref('')
const showAcnOptions = ref(false)
const acnHighlightIndex = ref(0)

async function fetchACNsForProduct(productId) {
  if (!productId) return
  acnLoading.value = true
  acnError.value = null
  try {
    console.log('🔍 DEBUG: Fetching ACNs for product:', productId)

    // 1) Fetch product to get legacy ACN array and serials
    const { data: prodResp } = await axios.get(`/products/${productId}`)
    const product = prodResp?.product || {}
    const legacyCodes = Array.isArray(product.assetControlNumbers)
      ? product.assetControlNumbers.filter(Boolean)
      : []
    const serials = Array.isArray(product.serialNumbers) ? product.serialNumbers : []
    console.log('📦 Product legacy ACNs:', legacyCodes)

    // 2) Fetch ACN records that may include serial numbers
    const { data: acnResp } = await axios.get(`/acns/product/${productId}`)
    const records = Array.isArray(acnResp?.acns) ? acnResp.acns : []
    const active = records.filter((r) => r?.isActive !== false)
    console.log(
      '📋 Active ACN records:',
      active.map((r) => r.acnCode)
    )

    // Build union of ACN codes from product and records
    const codeSet = new Set([
      ...legacyCodes.map((c) => String(c).trim()).filter(Boolean),
      ...active.map((r) => String(r?.acnCode || '').trim()).filter(Boolean)
    ])
    const allCodes = Array.from(codeSet)
    console.log('🔗 All available ACNs before filtering:', allCodes)

    // 3) Use global deployed ACNs cache
    await fetchDeployedAcnCodes()
    const deployedAcns = new Set(deployedAcnCodes.value.map(c => c.toUpperCase()))
    
    console.log('🚫 Deployed ACNs to exclude:', Array.from(deployedAcns))

    // Filter out deployed ACNs
    const codes = allCodes.filter((code) => !deployedAcns.has(code.toUpperCase()))
    console.log('✅ Final available ACNs after filtering:', codes)

    // Build ACN → serial map from records
    const map = {}
    for (const r of active) {
      const code = String(r?.acnCode || '').trim()
      const sn = String(r?.serialNumber || '').trim()
      if (code) map[code] = sn
    }

    // Fallback: derive mapping by index if product tracks both arrays but no record serials
    if (serials.length && legacyCodes.length && Object.values(map).every((s) => !s)) {
      const max = Math.min(serials.length, legacyCodes.length)
      for (let i = 0; i < max; i++) {
        const code = String(legacyCodes[i] || '').trim()
        const sn = String(serials[i] || '').trim()
        if (code && sn) map[code] = sn
      }
    }

    acnOptionsByProduct.value[productId] = codes
    serialByAcnByProduct.value[productId] = map
    console.log('💾 Stored ACN options for product:', productId, codes)
  } catch (err) {
    console.error('❌ Error fetching ACNs:', err)
    // Preserve any existing options to avoid clearing UI unexpectedly
    acnOptionsByProduct.value[productId] = acnOptionsByProduct.value[productId] || []
    serialByAcnByProduct.value[productId] = serialByAcnByProduct.value[productId] || {}
    acnError.value = err?.response?.data?.message || err.message || 'Failed to load ACNs'
  } finally {
    acnLoading.value = false
  }
}

const currentItemAcnOptions = computed(() => {
  const pid = tempItem.value?.product
  const list = pid ? acnOptionsByProduct.value[pid] || [] : []
  // Exclude ACNs already used in other items or across records, keep current selection visible
  const usedLocal = newRecord.value.items
    .map((it, idx) =>
      idx !== editingItemIndex.value ? String(it.propertyNumber || it.acn || '') : ''
    )
    .filter(Boolean)
  const usedAcross = Array.from(acnCodesUsedInRecords.value || new Set())
  const usedSet = new Set([...usedLocal, ...usedAcross].map((s) => String(s)))
  const current = String(tempItem.value?.propertyNumber || '')
  return list.filter((code) => {
    const c = String(code)
    return !usedSet.has(c) || c === current
  })
})

// Inline editor ACN combobox
const acnEditorQuery = ref('')
const showAcnEditorOptions = ref(false)
const acnEditorHighlightIndex = ref(0)
const filteredItemAcnOptions = computed(() => {
  const q = acnEditorQuery.value.trim().toLowerCase()
  const base = currentItemAcnOptions.value || []
  if (!q) return base
  return base.filter((code) => String(code).toLowerCase().includes(q))
})

const primaryAcnOptions = computed(() => {
  const pid = primaryProductId.value
  const list = pid ? acnOptionsByProduct.value[pid] || [] : []
  const usedLocal = (newRecord.value.items || [])
    .flatMap((it) => [String(it.propertyNumber || ''), String(it.acn || '')])
    .filter(Boolean)
  const usedAcross = Array.from(acnCodesUsedInRecords.value || new Set())
  const usedSet = new Set([...usedLocal, ...usedAcross].map((s) => String(s)))
  const current = String(selectedPrimaryAcn.value || '')
  const filtered = list.filter((code) => {
    const c = String(code)
    return !usedSet.has(c) || c === current
  })
  console.log(
    'Primary ACN Options - Product ID:',
    pid,
    'Raw list:',
    list,
    'Used local:',
    usedLocal,
    'Used across:',
    usedAcross,
    'Filtered:',
    filtered
  )
  return filtered
})

const filteredPrimaryAcnOptions = computed(() => {
  const q = acnQuery.value.trim().toLowerCase()
  const base = primaryAcnOptions.value || []
  if (!q) return base
  return base.filter((code) => String(code).toLowerCase().includes(q))
})

const requiresAcn = computed(() => {
  const pid = primaryProductId.value
  const product = products.value.find((p) => String(p._id) === String(pid))
  const hasAcnFlag = product && product.hasAssetControlNumber === true
  const hasAcnOptions = (acnOptionsByProduct.value[pid] || []).length > 0
  const result = hasAcnFlag || hasAcnOptions
  console.log(
    'RequiresAcn - Product ID:',
    pid,
    'Product:',
    product,
    'HasACNFlag:',
    hasAcnFlag,
    'HasACNOptions:',
    hasAcnOptions,
    'Result:',
    result
  )
  return result
})

function applySelectedACN() {
  const code = String(tempItem.value?.propertyNumber || '').trim()
  tempItem.value.acn = code || undefined
  const pid = tempItem.value?.product
  const map = pid ? serialByAcnByProduct.value?.[pid] || {} : {}
  const serial = code ? map[code] || '' : ''
  tempItem.value.serialNumber = serial || ''
  // Best-effort: update derived preview fields based on product type
  try {
    const p = products.value.find((x) => String(x._id) === String(pid))
    const brand = p ? p.name : ''
    const cname = String(p?.category?.name || '').toLowerCase()
    if (cname.includes('monitor')) {
      tempItem.value.monitorAndSerial = brand ? (serial ? `${brand} - ${serial}` : brand) : ''
    } else if (cname.includes('printer') || cname.includes('scanner')) {
      tempItem.value.printerOrScanner = brand ? (serial ? `${brand} - ${serial}` : brand) : ''
    }
  } catch (_) {
    console.log(_)
  }
}

// Selected department name for filtering employees
const selectedDeptName = computed(() => {
  const depId = newRecord.value.departmentId
  if (!depId) return String(newRecord.value.department || '').trim() || ''
  const dep = departments.value.find((d) => String(d._id) === String(depId))
  return dep?.name || ''
})

// Batch builder state
const batchQuantity = ref('')
const batchUnits = ref([])

// Auto-fetch ACNs when secondary product selection changes
watch(
  batchUnits,
  (units) => {
    try {
      for (const u of units || []) {
        const pid = String(u?._newSecondaryProductId || '').trim()
        if (
          pid &&
          (!acnOptionsByProduct.value[pid] || acnOptionsByProduct.value[pid].length === 0)
        ) {
          fetchACNsForProduct(pid)
        }
      }
    } catch (_) {
      /* no-op */
    }
  },
  { deep: true }
)

const desktopProductId = ref('')
const desktopQuantity = ref('')
const desktopNotes = ref('')
const laptopProductId = ref('')
const laptopQuantity = ref('')
const laptopNotes = ref('')

function requiresAcnForProduct(pid) {
  const product = products.value.find((p) => String(p._id) === String(pid))
  if (!product) return false
  if (product.hasAssetControlNumber === true) return true
  return (acnOptionsByProduct.value[pid] || []).length > 0
}

// Filter ACN options for a batch unit: exclude ACNs already selected in other units
// and those already used in items of the current record. Keep the unit's current
// selection visible so it doesn't disappear from the list.
function getFilteredAcnOptions(unit, idx) {
  try {
    const pid = String(unit?.productId || '').trim()
    const base = pid ? acnOptionsByProduct.value[pid] || [] : []
    if (!base || base.length === 0) return base

    const usedInRecord = (newRecord.value.items || [])
      .map((it) => String(it.propertyNumber || it.acn || ''))
      .filter(Boolean)

    const usedInBatch = (batchUnits.value || [])
      .map((u, uidx) => (uidx !== idx ? String(u.acn || u.propertyNumber || '') : ''))
      .filter(Boolean)

    const usedAcrossRecords = Array.from(acnCodesUsedInRecords.value || new Set())

    const usedSet = new Set(
      [...usedInRecord, ...usedInBatch, ...usedAcrossRecords].map((s) => String(s))
    )
    const current = String(unit?.acn || unit?.propertyNumber || '')

    return base.filter((code) => {
      const c = String(code)
      return !usedSet.has(c) || c === current
    })
  } catch (_) {
    return acnOptionsByProduct.value[unit?.productId] || []
  }
}

function buildBatchUnits() {
  const qty = Number(batchQuantity.value)
  if (!qty || qty < 1) {
    alert('Enter a valid quantity (>= 1).')
    return
  }
  batchUnits.value = Array.from({ length: qty }).map(() => ({
    productId: primaryProductId.value || '',
    employeeId: selectedEmployeeId.value || '',
    remarksYears: '',
    acn: '',
    propertyNumber: '',
    secondary: [],
    _newSecondaryType: '',
    _newSecondaryProductId: '',
    _newSecondaryAcn: '',
    _newSecondaryPropertyNumber: '',
    _newSecondaryRemarks: '',
    _newSecondaryDuplicate: false
  }))
  // Preload ACNs for the default product
  const pid = primaryProductId.value
  if (pid) fetchACNsForProduct(pid)
}

function copyPreviousUnit(uidx) {
  if (uidx <= 0) return
  const prev = batchUnits.value[uidx - 1]
  const curr = batchUnits.value[uidx]
  if (!prev || !curr) return
  batchUnits.value[uidx] = {
    ...curr,
    productId: prev.productId,
    employeeId: prev.employeeId,
    remarksYears: prev.remarksYears || '',
    acn: prev.acn || '',
    propertyNumber: prev.propertyNumber || '',
    secondary: Array.isArray(prev.secondary) ? JSON.parse(JSON.stringify(prev.secondary)) : []
  }
}

function generateUnitsFor(productId, qty, notes) {
  const count = Number(qty)
  if (!productId || !count || count < 1) {
    alert('Select product and valid quantity.')
    return
  }
  const arr = Array.from({ length: count }).map(() => ({
    productId,
    employeeId: selectedEmployeeId.value || '',
    remarksYears: notes || '',
    acn: '',
    propertyNumber: '',
    secondary: [],
    _newSecondaryType: '',
    _newSecondaryProductId: '',
    _newSecondaryAcn: '',
    _newSecondaryPropertyNumber: '',
    _newSecondaryRemarks: '',
    _newSecondaryDuplicate: false
  }))
  if (productId) fetchACNsForProduct(productId)
  batchUnits.value = [...batchUnits.value, ...arr]
}

function generateDesktopUnits() {
  generateUnitsFor(desktopProductId.value, desktopQuantity.value, desktopNotes.value)
}
function generateLaptopUnits() {
  generateUnitsFor(laptopProductId.value, laptopQuantity.value, laptopNotes.value)
}

function removeUnit(idx) {
  batchUnits.value.splice(idx, 1)
}

function onUnitProductChange(unit) {
  // Clear ACN and fetch options for the selected product
  unit.acn = ''
  unit.propertyNumber = ''
  if (unit?.productId) fetchACNsForProduct(unit.productId)
}

function applyBatchToItems() {
  if (!batchUnits.value.length) return
  const usedAcn = new Set(newRecord.value.items.map((it) => String(it.acn || '')).filter(Boolean))
  const itemsToAdd = []
  for (const unit of batchUnits.value) {
    const product = products.value.find((p) => String(p._id) === String(unit.productId))
    if (!product) {
      alert('Each unit must have a product selected.')
      return
    }
    const requires = requiresAcnForProduct(unit.productId)
    const code = String(unit.acn || '')
    if (requires && !code) {
      alert(`Product "${product.name}" requires an ACN.`)
      return
    }
    if (code && usedAcn.has(code)) {
      alert(`ACN ${code} is already used in items.`)
      return
    }
    const usedAcrossRecords = acnCodesUsedInRecords.value || new Set()
    if (code && usedAcrossRecords.has(code)) {
      alert(`ACN ${code} is already deployed in another record.`)
      return
    }
    const employee = employees.value.find((e) => String(e._id) === String(unit.employeeId))
    const employeeName = employee
      ? [employee.firstName, employee.lastName].filter(Boolean).join(' ') ||
        employee.name ||
        employee.email
      : ''
    const primarySerial =
      code && serialByAcnByProduct.value?.[product._id]?.[code]
        ? serialByAcnByProduct.value[product._id][code]
        : ''
    itemsToAdd.push({
      description: product.name,
      product: product._id,
      processor: '',
      storage: '',
      ram: '',
      videoCard: '',
      monitorAndSerial: (() => {
        const monitors = (unit.secondary || [])
          .filter((s) => s.type === 'monitor')
          .map((s) => {
            const brand = getProductName(s.productId)
            const acn = s?.acn ? String(s.acn) : ''
            const serial =
              acn && serialByAcnByProduct.value?.[s.productId]?.[acn]
                ? serialByAcnByProduct.value[s.productId][acn]
                : ''
            return brand ? (serial ? `${brand} - ${serial}` : brand) : null
          })
          .filter(Boolean)
        return monitors.length ? monitors.join(', ') : '—'
      })(),
      acn: code || undefined,
      propertyNumber: unit.propertyNumber || '',
      printerOrScanner: (() => {
        const buildItems = (type) => {
          return (unit.secondary || [])
            .filter((s) => s.type === type)
            .map((s) => {
              const brand = getProductName(s.productId)
              const acn = s?.acn ? String(s.acn) : ''
              const serial =
                acn && serialByAcnByProduct.value?.[s.productId]?.[acn]
                  ? serialByAcnByProduct.value[s.productId][acn]
                  : ''
              return brand ? (serial ? `${brand} - ${serial}` : brand) : null
            })
            .filter(Boolean)
        }
        const printers = buildItems('printer')
        const scanners = buildItems('scanner')
        const parts = []
        if (printers.length) parts.push('Printer - ' + printers.join(', '))
        if (scanners.length) parts.push('Scanner - ' + scanners.join(', '))
        return parts.join(' ') || '—'
      })(),
      endUserOrMR: employeeName,
      employeeId: employee ? employee._id : undefined,
      remarksYears: unit.remarksYears || '',
      serialNumber: primarySerial,
      status: 'deployed',
      statusNotes: '',
      secondaryItems: (unit.secondary || []).map((sec) => ({
        type: sec.type,
        productId: sec.productId,
        acn: sec.acn || undefined,
        propertyNumber: sec.propertyNumber || '',
        serialNumber:
          sec.acn && serialByAcnByProduct.value?.[sec.productId]?.[sec.acn]
            ? serialByAcnByProduct.value[sec.productId][sec.acn]
            : '',
        remarksYears: sec.remarksYears || ''
      }))
    })
    if (code) usedAcn.add(code)

    // Append secondary items for this unit
    const secList = Array.isArray(unit.secondary) ? unit.secondary : []
    for (const sec of secList) {
      const secProduct = products.value.find((p) => String(p._id) === String(sec.productId))
      if (!secProduct) {
        alert('Each secondary item must have a product selected.')
        return
      }
      const secRequires = requiresAcnForProduct(sec.productId)
      const secCode = String(sec.acn || '')
      if (secRequires && !secCode) {
        alert(`Secondary product "${secProduct.name}" requires an ACN.`)
        return
      }
      if (secCode && usedAcn.has(secCode)) {
        alert(`ACN ${secCode} is already used in items.`)
        return
      }
      const usedAcrossRecords = acnCodesUsedInRecords.value || new Set()
      if (secCode && usedAcrossRecords.has(secCode)) {
        alert(`ACN ${secCode} is already deployed in another record.`)
        return
      }
      const secSerial =
        secCode && serialByAcnByProduct.value?.[secProduct._id]?.[secCode]
          ? serialByAcnByProduct.value[secProduct._id][secCode]
          : ''
      itemsToAdd.push({
        description: secProduct.name,
        product: secProduct._id,
        processor: '',
        storage: '',
        ram: '',
        videoCard: '',
        monitorAndSerial: '',
        propertyNumber: sec.propertyNumber || '',
        acn: secCode || undefined,
        printerOrScanner: sec.type === 'printer' || sec.type === 'scanner' ? sec.type : '',
        endUserOrMR: employeeName,
        employeeId: employee ? employee._id : undefined,
        remarksYears: sec.remarksYears || '',
        serialNumber: secSerial,
        status: 'deployed',
        statusNotes: ''
      })
      if (secCode) usedAcn.add(secCode)
    }
  }
  // // Append and open editor for last item
  newRecord.value.items.push(...itemsToAdd)
  if (newRecord.value.items.length) {
    const idx = newRecord.value.items.length - 1
    tempItem.value = { ...newRecord.value.items[idx] }
    editingItemIndex.value = idx
  }
}

function secondaryProductsByType(type) {
  const t = String(type || '')
    .trim()
    .toLowerCase()
  return products.value.filter((p) => {
    const cname = String(p?.category?.name || '')
      .trim()
      .toLowerCase()
    if (t === 'monitor') return cname.includes('monitor')
    if (t === 'printer') return cname.includes('printer')
    if (t === 'scanner') return cname.includes('scanner')
    return false
  })
}

function onSecondaryProductChange(unit) {
  unit._newSecondaryAcn = ''
  const pid = unit._newSecondaryProductId
  if (pid) {
    fetchACNsForProduct(pid)
    fetchDeployedAcnCodes() // Ensure deployed ACNs are up to date
  }
}

// Filter ACN options for a new secondary item: exclude ACNs already selected
// in other batch units (unless duplication across units is enabled) and ACNs
// already used in current record items. Keep the current selection visible.
function getFilteredSecondaryAcnOptions(unit, uidx) {
  try {
    const pid = String(unit?._newSecondaryProductId || '').trim()
    const base = pid ? acnOptionsByProduct.value[pid] || [] : []
    if (!base || base.length === 0) return base

    const current = String(unit?._newSecondaryAcn || unit?._newSecondaryPropertyNumber || '').trim()
    const allowDupeAcrossUnits = !!unit?._newSecondaryDuplicate

    // Get deployed ACNs from global cache (same as fetchACNsForProduct uses)
    const deployedAcns = new Set(deployedAcnCodes.value || [])

    const usedInRecord = (newRecord.value.items || [])
      .flatMap((it) => [String(it.propertyNumber || '').trim(), String(it.acn || '').trim()])
      .filter((s) => !!s)

    const usedPrimaryInBatch = allowDupeAcrossUnits
      ? []
      : (batchUnits.value || [])
          .map((u, i) => (i !== uidx ? String(u.acn || u.propertyNumber || '').trim() : ''))
          .filter((s) => !!s)

    const usedSecondaryInBatch = allowDupeAcrossUnits
      ? []
      : (batchUnits.value || []).flatMap((u, i) =>
          i !== uidx
            ? (u.secondary || [])
                .flatMap((s) => [String(s.acn || '').trim(), String(s.propertyNumber || '').trim()])
                .filter((s) => !!s)
            : []
        )

    const usedPrimaryInCurrentUnit = [
      String(unit?.acn || unit?.propertyNumber || '').trim()
    ].filter((s) => !!s)

    const usedSecondaryInCurrentUnit = (unit?.secondary || [])
      .flatMap((s) => [String(s.acn || '').trim(), String(s.propertyNumber || '').trim()])
      .filter((s) => !!s)

    const usedSet = new Set([
      ...Array.from(deployedAcns),
      ...usedInRecord,
      ...usedPrimaryInBatch,
      ...usedSecondaryInBatch,
      ...usedPrimaryInCurrentUnit,
      ...usedSecondaryInCurrentUnit
    ])

    return base.filter((code) => {
      const c = String(code)
      return !usedSet.has(c) || c === current
    })
  } catch (_) {
    return acnOptionsByProduct.value[unit?._newSecondaryProductId] || []
  }
}
function addSecondary(unit) {
  const productId = String(unit._newSecondaryProductId || '').trim()
  const acn = String(unit._newSecondaryAcn || '').trim()
  const propertyNumber = String(unit._newSecondaryPropertyNumber || '').trim()
  const remarks = String(unit._newSecondaryRemarks || '')
  const type = String(unit._newSecondaryType || '').trim()
  if (!type) {
    alert('Select a secondary type.')
    return
  }
  const secProduct = products.value.find((p) => String(p._id) === String(productId))
  if (!secProduct) {
    alert('Select a secondary product.')
    return
  }
  if (requiresAcnForProduct(productId) && !acn) {
    alert('This secondary product requires an ACN.')
    return
  }
  // Block selecting ACNs that are already deployed anywhere
  const norm = (s) =>
    String(s || '')
      .trim()
      .toUpperCase()
  const acnUsedSet = new Set(Array.from(acnCodesUsedInRecords.value || new Set()))
  if (acn && acnUsedSet.has(norm(acn))) {
    alert('Selected ACN is already deployed. Please choose a different code.')
    return
  }
  const newSec = { type, productId, acn, propertyNumber, remarksYears: remarks }
  unit.secondary = unit.secondary || []
  unit.secondary.push(newSec)
  if (unit._newSecondaryDuplicate) {
    for (const u of batchUnits.value) {
      if (u === unit) continue
      u.secondary = u.secondary || []
      const hasDupe = (u.secondary || []).some(
        (s) =>
          String(s.productId) === String(productId) &&
          String(s.type) === String(type) &&
          String(s.acn || '') === String(acn || '')
      )
      if (!hasDupe) u.secondary.push({ ...newSec })
    }
  }
  unit._newSecondaryType = ''
  unit._newSecondaryProductId = ''
  unit._newSecondaryAcn = ''
  unit._newSecondaryPropertyNumber = ''
  unit._newSecondaryRemarks = ''
  unit._newSecondaryDuplicate = false
}
function removeSecondary(unit, idx) {
  if (!unit.secondary) return
  unit.secondary.splice(idx, 1)
}
const showEmpOptions = ref(false)
const empHighlightIndex = ref(0)
function openEmpOptions() {
  showEmpOptions.value = true
  empHighlightIndex.value = 0
}
function closeEmpOptions() {
  showEmpOptions.value = false
}
function closeEmpOptionsLater() {
  setTimeout(() => (showEmpOptions.value = false), 150)
}
function moveEmpHighlight(delta) {
  const list = filteredEmployeeOptions.value || []
  if (!list.length) return
  empHighlightIndex.value = (empHighlightIndex.value + delta + list.length) % list.length
}
function selectEmpFromHighlight() {
  const list = filteredEmployeeOptions.value || []
  const choice = list[empHighlightIndex.value]
  if (choice) selectEmployee(choice)
}
function selectEmployee(e) {
  if (!e) return
  selectedEmployeeId.value = e.id
  employeeQuery.value = e.name || ''
  showEmpOptions.value = false
}
function clearEmployeeSelection() {
  selectedEmployeeId.value = ''
  employeeQuery.value = ''
}
function openAcnOptions() {
  showAcnOptions.value = true
  acnHighlightIndex.value = 0
}
function closeAcnOptions() {
  showAcnOptions.value = false
}
function closeAcnOptionsLater() {
  setTimeout(() => (showAcnOptions.value = false), 150)
}
function moveAcnHighlight(delta) {
  const list = filteredPrimaryAcnOptions.value || []
  if (!list.length) return
  acnHighlightIndex.value = (acnHighlightIndex.value + delta + list.length) % list.length
}
function selectAcnFromHighlight() {
  const list = filteredPrimaryAcnOptions.value || []
  const choice = list[acnHighlightIndex.value]
  if (choice) selectPrimaryAcn(choice)
}
function selectPrimaryAcn(code) {
  selectedPrimaryAcn.value = String(code || '')
  acnQuery.value = selectedPrimaryAcn.value
  showAcnOptions.value = false
}
function clearPrimaryAcn() {
  selectedPrimaryAcn.value = ''
  acnQuery.value = ''
}

// Combobox helpers: ACN (inline editor)
function openAcnEditorOptions() {
  showAcnEditorOptions.value = true
  acnEditorHighlightIndex.value = 0
}
function closeAcnEditorOptions() {
  showAcnEditorOptions.value = false
}
function closeAcnEditorOptionsLater() {
  setTimeout(() => (showAcnEditorOptions.value = false), 150)
}
function moveAcnEditorHighlight(delta) {
  const list = filteredItemAcnOptions.value || []
  if (!list.length) return
  acnEditorHighlightIndex.value =
    (acnEditorHighlightIndex.value + delta + list.length) % list.length
}
function selectAcnEditorFromHighlight() {
  const list = filteredItemAcnOptions.value || []
  const choice = list[acnEditorHighlightIndex.value]
  if (choice) selectInlineAcn(choice)
}
function selectInlineAcn(code) {
  const val = String(code || '')
  // Keep propertyNumber in sync with chosen ACN for mapping
  tempItem.value.propertyNumber = val
  // Derive ACN + serial + preview fields based on selected ACN
  applySelectedACN()
  showAcnEditorOptions.value = false
}
const primaryProducts = computed(() => {
  const byName = (n) => String(n || '').toLowerCase()
  return products.value.filter((p) => {
    const cname = byName(p?.category?.name)
    return cname.includes('desktop') || cname.includes('computer') || cname.includes('laptop')
  })
})

const desktopProducts = computed(() => {
  const byName = (n) => String(n || '').toLowerCase()
  return products.value.filter((p) => {
    const cname = byName(p?.category?.name)
    return cname.includes('desktop') || cname.includes('computer')
  })
})

const laptopProducts = computed(() => {
  const byName = (n) => String(n || '').toLowerCase()
  return products.value.filter((p) => {
    const cname = byName(p?.category?.name)
    return cname.includes('laptop')
  })
})

const employeeOptions = computed(() => {
  const getDeptName = (emp) => {
    try {
      if (typeof emp?.department === 'string') return emp.department
      if (emp?.department?.name) return emp.department.name
      if (emp?.departmentName) return emp.departmentName
      if (emp?.departmentCode) return emp.departmentCode
      if (emp?.departmentId) {
        const dep = departments.value.find((d) => String(d._id) === String(emp.departmentId))
        return dep?.name || ''
      }
      return ''
    } catch (_) {
      return ''
    }
  }
  return (employees.value || []).map((e) => ({
    id: e._id,
    name: [e.firstName, e.lastName].filter(Boolean).join(' ') || e.name || e.email,
    email: e.email || '',
    phoneNumber: e.phoneNumber || '',
    department: getDeptName(e)
  }))
})

const employeeIdsUsedInRecords = computed(() => {
  const ids = (records.value || []).flatMap((rec) =>
    (rec.items || [])
      .filter((it) => String(it.status || '').toLowerCase() === 'deployed')
      .map((it) => String(it.employeeId || ''))
      .filter(Boolean)
  )
  return new Set(ids)
})

const acnCodesUsedInRecords = computed(() => {
  const norm = (s) =>
    String(s || '')
      .trim()
      .toUpperCase()
  const codes = (records.value || []).flatMap((rec) =>
    (rec.items || [])
      .filter((it) => String(it.status || '').toLowerCase() === 'deployed')
      .flatMap((it) => {
        const primary = [norm(it.propertyNumber), norm(it.acn)]
        const secondary = (it.secondaryItems || []).flatMap((sec) => [
          norm(sec.propertyNumber),
          norm(sec.acn)
        ])
        // For backward compatibility: extract ACNs from display strings if secondaryItems is empty
        const legacy =
          (it.secondaryItems || []).length === 0 ? extractAcnsFromDisplayStrings(it).map(norm) : []
        return [...primary, ...secondary, ...legacy]
      })
      .filter((s) => !!s)
  )
  const union = new Set([...(deployedAcnCodes.value || []), ...codes])
  return union
})

const employeeQuery = ref('')
const filteredEmployeeOptions = computed(() => {
  const q = employeeQuery.value.trim().toLowerCase()
  const toKey = (s) => {
    const t = String(s || '')
      .trim()
      .toLowerCase()
    const words = t
      .replace(/[^a-z0-9]+/g, ' ')
      .trim()
      .split(/\s+/)
      .filter(Boolean)
    const init = words.map((w) => w[0]).join('')
    const acro = words.length === 1 && t.length <= 5 ? t : init
    return { t, init, acro }
  }
  const dept = toKey(selectedDeptName.value)
  const baseByDept = dept.t
    ? employeeOptions.value.filter((e) => {
        const ed = toKey(e.department)
        return (
          ed.t === dept.t ||
          ed.t.includes(dept.t) ||
          dept.t.includes(ed.t) ||
          ed.init === dept.init ||
          ed.acro === dept.acro ||
          ed.acro === dept.init ||
          dept.acro === ed.init
        )
      })
    : employeeOptions.value

  const usedInRecord = (newRecord.value?.items || [])
    .map((it) => String(it.employeeId || ''))
    .filter(Boolean)
  const usedInBatch = (batchUnits.value || [])
    .map((u) => String(u.employeeId || ''))
    .filter(Boolean)
  const usedAcrossRecords = Array.from(employeeIdsUsedInRecords.value || new Set())
  const usedSet = new Set([...usedInRecord, ...usedInBatch, ...usedAcrossRecords])
  const currentId = String(selectedEmployeeId.value || '')

  const base = baseByDept.filter((e) => {
    const id = String(e.id || e._id || '')
    return !usedSet.has(id) || id === currentId
  })

  if (!q) return base
  return base.filter(
    (e) =>
      String(e.name || '')
        .toLowerCase()
        .includes(q) ||
      String(e.email || '')
        .toLowerCase()
        .includes(q) ||
      String(e.phoneNumber || '')
        .toLowerCase()
        .includes(q)
  )
})

const employeesBySelectedDepartment = computed(() => {
  const toKey = (s) => {
    const t = String(s || '')
      .trim()
      .toLowerCase()
    const words = t
      .replace(/[^a-z0-9]+/g, ' ')
      .trim()
      .split(/\s+/)
      .filter(Boolean)
    const init = words.map((w) => w[0]).join('')
    const acro = words.length === 1 && t.length <= 5 ? t : init
    return { t, init, acro }
  }
  const dept = toKey(selectedDeptName.value)
  if (!dept.t) return employeeOptions.value
  return employeeOptions.value.filter((e) => {
    const ed = toKey(e.department)
    return (
      ed.t === dept.t ||
      ed.t.includes(dept.t) ||
      dept.t.includes(ed.t) ||
      ed.init === dept.init ||
      ed.acro === dept.acro ||
      ed.acro === dept.init ||
      dept.acro === ed.init
    )
  })
})

function getFilteredEmployeeOptionsForUnit(unit, uidx) {
  const base = employeesBySelectedDepartment.value || []
  const usedInRecord = (newRecord.value?.items || [])
    .map((it) => String(it.employeeId || ''))
    .filter(Boolean)
  const usedInBatch = (batchUnits.value || [])
    .map((u, i) => (i !== uidx ? String(u.employeeId || '') : ''))
    .filter(Boolean)
  const usedAcrossRecords = Array.from(employeeIdsUsedInRecords.value || new Set())
  const usedSet = new Set([...usedInRecord, ...usedInBatch, ...usedAcrossRecords])
  const currentId = String(unit?.employeeId || '')

  return base.filter((e) => {
    const id = String(e.id || e._id || '')
    return !usedSet.has(id) || id === currentId
  })
}

function getProductName(id) {
  const p = products.value.find((x) => String(x._id) === String(id))
  return p ? p.name : ''
}

// View mode for selected record table
const recordViewMode = ref('compact')

function statusClass(status) {
  const base = 'inline-flex items-center px-2 py-0.5 rounded text-xs font-medium '
  const map = {
    deployed: 'bg-green-100 text-green-700',
    returned: 'bg-yellow-100 text-yellow-800',
    repair: 'bg-orange-100 text-orange-800',
    retired: 'bg-gray-200 text-gray-700'
  }
  return base + (map[status] || 'bg-gray-100 text-gray-700')
}

// Helpers for table listing
function formatRecordNumber(rec) {
  const id = String(rec?._id || '')
  const suffix = id ? id.slice(-6).padStart(6, '0') : '000000'
  return `INV-${suffix}`
}
function countEndUsers(rec) {
  const names = (rec?.items || []).map((i) => String(i.endUserOrMR || '').trim()).filter(Boolean)
  return new Set(names).size
}
function recordStatus(rec) {
  const statuses = (rec?.items || [])
    .map((i) => String(i.status || '').toLowerCase())
    .filter(Boolean)
  if (!statuses.length) return ''
  const unique = Array.from(new Set(statuses))
  return unique.length === 1 ? unique[0] : 'mixed'
}

async function copyToClipboard(text) {
  try {
    await navigator.clipboard.writeText(String(text || '').trim())
    successMessage.value = 'Copied to clipboard'
    setTimeout(() => (successMessage.value = null), 1200)
  } catch (e) {
    alert('Failed to copy to clipboard')
  }
}

const isValidPreview = computed(() => {
  const dep = newRecord.value.departmentId || newRecord.value.department
  if (!dep || !newRecord.value.date) return false
  const items = newRecord.value.items || []
  for (const it of items) {
    if (!it.description) return false
    if (requiresAcnForProduct(it.product) && !it.acn) return false
  }
  const acns = items.map((it) => String(it.acn || it.propertyNumber || '')).filter(Boolean)
  const seenA = new Set()
  for (const code of acns) {
    if (seenA.has(code)) return false
    seenA.add(code)
  }
  const serials = items.map((it) => String(it.serialNumber || '')).filter(Boolean)
  const seenS = new Set()
  for (const sn of serials) {
    if (seenS.has(sn)) return false
    seenS.add(sn)
  }
  return true
})

// Inline row editor state for Add modal
const editingItemIndex = ref(null)
const tempItem = ref(null)

// Auto-apply ACN→serial mapping whenever Property Number changes in the inline editor
watch(
  () => tempItem.value && tempItem.value.propertyNumber,
  () => {
    applySelectedACN()
  }
)

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
        remarksYears: '',
        serialNumber: '',
        status: 'deployed',
        statusNotes: '',
        secondaryItems: []
      }
    ]
  }
  deviceType.value = 'desktop'
  primaryProductId.value = ''
  selectedEmployeeId.value = ''
  selectedPrimaryAcn.value = ''
  employeeQuery.value = ''
}

function addItemRow() {
  const product = products.value.find((p) => String(p._id) === String(primaryProductId.value))
  const employee = employees.value.find((e) => String(e._id) === String(selectedEmployeeId.value))
  const employeeName = employee
    ? [employee.firstName, employee.lastName].filter(Boolean).join(' ') ||
      employee.name ||
      employee.email
    : ''
  let acnCode = ''
  let acnSerial = ''
  let acnProductId = product ? product._id : undefined
  if (requiresAcn.value && selectedPrimaryAcn.value) {
    acnCode = selectedPrimaryAcn.value
    const map = serialByAcnByProduct.value?.[acnProductId] || {}
    acnSerial = map[acnCode] || ''
  }
  newRecord.value.items.push({
    description: product ? product.name : '',
    product: acnProductId,
    processor: '',
    storage: '',
    ram: '',
    videoCard: '',
    monitorAndSerial: '',
    propertyNumber: acnCode || '',
    acn: acnCode || undefined,
    printerOrScanner: '',
    endUserOrMR: employeeName,
    employeeId: employee ? employee._id : undefined,
    remarksYears: '',
    serialNumber: acnSerial || '',
    status: 'deployed',
    statusNotes: '',
    secondaryItems: []
  })
  // Immediately open editor for the newly added row
  const idx = newRecord.value.items.length - 1
  tempItem.value = { ...newRecord.value.items[idx] }
  editingItemIndex.value = idx
  // Reset selected ACN to prevent duplicate adds
  selectedPrimaryAcn.value = ''
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
  // Fetch ACNs for the item's product to support ACN-based selection
  if (tempItem.value?.product) {
    fetchACNsForProduct(tempItem.value.product)
  }
}

function saveEditItem() {
  if (editingItemIndex.value === null) return
  const idx = editingItemIndex.value
  const t = tempItem.value || {}
  // Ensure ACN/serial/derived preview fields reflect the current Property Number
  applySelectedACN()
  const required = [
    { key: 'description', label: 'Description' },
    { key: 'processor', label: 'Processor' },
    { key: 'storage', label: 'Storage' },
    { key: 'ram', label: 'RAM' },
    { key: 'videoCard', label: 'Video Card' },
    { key: 'monitorAndSerial', label: 'Brand of Monitor & Serial Number' },
    { key: 'printerOrScanner', label: 'Printer or Scanner' },
    { key: 'endUserOrMR', label: 'End User or MR' },
    { key: 'remarksYears', label: 'Remarks / Years' }
  ]
  for (const f of required) {
    if (!String(t[f.key] || '').trim()) {
      alert(`Please provide ${f.label} for this item.`)
      return
    }
  }
  newRecord.value.items[idx] = { ...t }
  editingItemIndex.value = null
  tempItem.value = null
}

function cancelEditItem() {
  editingItemIndex.value = null
  tempItem.value = null
}

function printPreview() {
  window.print()
}

async function fetchRecords() {
  isLoading.value = true
  errorMessage.value = null
  try {
    const params = {}
    if (filterDepartment.value) params['department'] = filterDepartment.value
    if (filterSource.value) {
      const map = { manual: 'Manual', deployment: 'Deployment' }
      params['sourceType'] = map[filterSource.value] || filterSource.value
    }
    if (filterDate.value) {
      params['startDate'] = filterDate.value
      params['endDate'] = filterDate.value
    }
    if (serialSearch.value) params['serialNumber'] = serialSearch.value.trim()
    if (acnSearch.value) params['acn'] = acnSearch.value.trim()
    const { data } = await axios.get('/inventory-records', { params })
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

function hasValidationIssues(rec) {
  try {
    const items = rec?.items || []
    return items.some(
      (it) =>
        !it?.description ||
        !(it?.processor || it?.specs?.processor) ||
        !(it?.storage || it?.specs?.storage) ||
        !(it?.ram || it?.specs?.ram) ||
        !it?.endUserOrMR
    )
  } catch (e) {
    return false
  }
}

function printSelectedRecord() {
  nextTick(() => {
    window.print()
  })
}

function printRecord(rec) {
  openDetails(rec)
  setTimeout(() => {
    window.print()
  }, 250)
}

// Build merged rows for any items list (same format as add-record preview)
function buildMergedRows(items) {
  const groups = {}
  const list = Array.isArray(items) ? items : []
  const byName = (s) =>
    String(s || '')
      .trim()
      .toLowerCase()
  for (const it of list) {
    const endUser = String(it.endUserOrMR || '').trim() || '—'
    if (!groups[endUser]) {
      groups[endUser] = {
        endUserOrMR: endUser,
        description: '',
        processor: '',
        storage: '',
        ram: '',
        videoCard: '',
        monitors: [],
        propertyNumber: '',
        printerOrScannerList: [],
        remarksYearsList: []
      }
    }
    const row = groups[endUser]
    const product = products.value.find((p) => String(p._id) === String(it.product))
    const cname = byName(product?.category?.name)
    const isDesktop = cname.includes('desktop') || cname.includes('computer')
    const isLaptop = cname.includes('laptop')
    const isMonitor = cname.includes('monitor')
    const isPrinter = cname.includes('printer')
    const isScanner = cname.includes('scanner')

    const specsArr = Array.isArray(product?.specifications) ? product.specifications : []
    const specVal = (n) => {
      const s = specsArr.find(
        (x) => String(x?.name || '').toLowerCase() === String(n).toLowerCase()
      )
      return s?.value || ''
    }
    const serial = it.serialNumber || ''
    const monitorStr = [product?.name || it.description || 'Monitor', serial]
      .filter(Boolean)
      .join(' - ')

    // Always capture inline monitor/printer fields stored on primary items
    if (String(it.monitorAndSerial || '').trim()) {
      row.monitors.push(String(it.monitorAndSerial).trim())
    }
    if (String(it.printerOrScanner || '').trim()) {
      row.printerOrScannerList.push(String(it.printerOrScanner).trim())
    }

    if (isDesktop || (!row.description && isLaptop)) {
      row.description = product?.name || it.description || ''
      row.processor = specFrom(it, 'processor') || specVal('Processor') || ''
      row.storage = specFrom(it, 'storage') || specVal('Storage') || ''
      row.ram = specFrom(it, 'ram') || specVal('RAM') || ''
      row.videoCard = specFrom(it, 'videoCard') || specVal('Video Card') || ''
      if (it.propertyNumber && !row.propertyNumber) row.propertyNumber = it.propertyNumber
    } else if (isMonitor) {
      if (monitorStr) row.monitors.push(monitorStr)
      if (it.propertyNumber && !row.propertyNumber) row.propertyNumber = it.propertyNumber
    } else if (isPrinter || isScanner) {
      const t = isPrinter ? 'Printer' : 'Scanner'
      const name = product?.name || it.description || ''
      const serialPS = it.serialNumber || ''
      const psStr = [t, name, serialPS].filter(Boolean).join(' - ')
      row.printerOrScannerList.push(psStr)
      if (it.propertyNumber && !row.propertyNumber) row.propertyNumber = it.propertyNumber
    } else if (String(it.printerOrScanner || '').trim()) {
      // If printer/scanner info is embedded on a non-printer item, take it literally
      row.printerOrScannerList.push(String(it.printerOrScanner).trim())
      if (it.propertyNumber && !row.propertyNumber) row.propertyNumber = it.propertyNumber
    } else {
      // Fallback: if this item carries specs (or product specs), use as primary if none yet
      if (
        !row.description &&
        (specFrom(it, 'processor') ||
          specFrom(it, 'storage') ||
          specFrom(it, 'ram') ||
          specFrom(it, 'videoCard') ||
          specVal('Processor') ||
          specVal('Storage') ||
          specVal('RAM') ||
          specVal('Video Card'))
      ) {
        row.description = product?.name || it.description || ''
        row.processor = specFrom(it, 'processor') || specVal('Processor') || ''
        row.storage = specFrom(it, 'storage') || specVal('Storage') || ''
        row.ram = specFrom(it, 'ram') || specVal('RAM') || ''
        row.videoCard = specFrom(it, 'videoCard') || specVal('Video Card') || ''
        if (it.propertyNumber && !row.propertyNumber) row.propertyNumber = it.propertyNumber
      }
    }

    if (String(it.remarksYears || '').trim()) {
      row.remarksYearsList.push(String(it.remarksYears).trim())
    }
    if (String(it.remarks || '').trim()) {
      row.remarksYearsList.push(String(it.remarks).trim())
    }
  }

  const merged = Object.values(groups).map((row) => ({
    description: row.description || '—',
    processor: row.processor || '—',
    storage: row.storage || '—',
    ram: row.ram || '—',
    videoCard: row.videoCard || '—',
    monitorAndSerial: row.monitors.length ? row.monitors.join('\n') : '—',
    propertyNumber: row.propertyNumber || '—',
    printerOrScanner: row.printerOrScannerList.length ? row.printerOrScannerList.join('\n') : '—',
    endUserOrMR: row.endUserOrMR || '—',
    remarksYears: row.remarksYearsList.length ? row.remarksYearsList.join('\n') : '—'
  }))
  return merged.filter((r) => {
    return !(
      r.description === '—' &&
      r.processor === '—' &&
      r.storage === '—' &&
      r.ram === '—' &&
      r.videoCard === '—' &&
      r.monitorAndSerial === '—' &&
      r.propertyNumber === '—' &&
      r.printerOrScanner === '—' &&
      r.remarksYears === '—'
    )
  })
}
const selectedMergedRows = computed(() => buildMergedRows(selectedRecord?.value.items))

async function saveRecord() {
  try {
    const dep = newRecord.value.departmentId
      ? departments.value.find((d) => String(d._id) === String(newRecord.value.departmentId))
      : null

    // Build items from preview rows so saved format matches current preview
    const previewRows = mergedPreviewRows.value || []
    const itemsFromPreview = previewRows.map((row) => {
      const endUser = String(row.endUserOrMR || '').trim()
      // Find exemplar item(s) for this end user to derive product/employee/serial/acn
      const exemplars = (newRecord.value.items || []).filter(
        (it) => String(it.endUserOrMR || '').trim() === endUser
      )
      const primaryExemplar = (() => {
        const byCat = (pid) => {
          const p = products.value.find((x) => String(x._id) === String(pid))
          return String(p?.category?.name || '').toLowerCase()
        }
        // Prefer desktop/laptop
        const dl = exemplars.find((it) => {
          const cname = byCat(it.product)
          return cname.includes('desktop') || cname.includes('laptop') || cname.includes('computer')
        })
        if (dl) return dl
        // Fallback to any exemplar
        return exemplars[0] || null
      })()
      const productId = primaryExemplar?.product || undefined
      const employeeId = (exemplars.find((it) => it.employeeId) || {}).employeeId || undefined
      const serialNumber = primaryExemplar?.serialNumber || undefined
      const acn = primaryExemplar?.acn || undefined
      const secondaryItems = primaryExemplar?.secondaryItems || []

      return {
        description: row.description || primaryExemplar?.description || '',
        product: productId,
        processor: row.processor,
        storage: row.storage,
        ram: row.ram,
        videoCard: row.videoCard,
        monitorAndSerial: row.monitorAndSerial,
        serialNumber,
        acn,
        propertyNumber: row.propertyNumber,
        printerOrScanner: row.printerOrScanner,
        endUserOrMR: row.endUserOrMR,
        employeeId,
        remarksYears: row.remarksYears,
        status: 'deployed',
        statusNotes: '',
        secondaryItems
      }
    })

    const payload = {
      departmentId: newRecord.value.departmentId || undefined,
      department: dep?.name || newRecord.value.department,
      notes: newRecord.value.notes,
      date: newRecord.value.date,
      items: itemsFromPreview
    }

    if (!payload.department || !payload.date || payload.items.length === 0) {
      alert('Please provide department, date, and at least one item with description.')
      return
    }

    // Require employee relation for each item
    const missingEmp = payload.items.filter((it) => !it.employeeId)
    if (missingEmp.length) {
      alert('Please select an employee for all items to establish relations.')
      return
    }

    // Client-side required field validation per item (type-aware)
    const invalid = payload.items.filter((it) => {
      const product = products.value.find((p) => String(p._id) === String(it.product))
      const cname = String(
        product?.category?.name || product?.name || it.description || ''
      ).toLowerCase()
      const isDesktop = cname.includes('desktop')
      const isLaptop = cname.includes('laptop')
      const isMonitor = cname.includes('monitor')
      const isPrinter = cname.includes('printer')
      const isScanner = cname.includes('scanner')
      // Always require description and End User/MR
      const baseRequired = [it.description, it.endUserOrMR]
      // Additional requireds based on type
      const computerRequired = [it.processor, it.storage, it.ram, it.videoCard, it.remarksYears]
      const monitorRequired = [it.monitorAndSerial]
      const printerScannerRequired = [it.printerOrScanner]
      const checks = [...baseRequired]
      if (isDesktop || isLaptop) checks.push(...computerRequired)
      else if (isMonitor) checks.push(...monitorRequired)
      else if (isPrinter || isScanner) checks.push(...printerScannerRequired)
      // For other types, only baseRequired applies
      return !checks.every((v) => (typeof v === 'string' ? v.trim() : v))
    })

    if (invalid.length) {
      alert(
        'Some items are missing required fields based on type. Computers need specs and Remarks/Years; monitors need Brand & Serial; printers/scanners need Printer/Scanner. Also ensure End User/MR.'
      )
      return
    }
    // Derive employee assignments to help backend establish relations
    const empMap = {}
    for (const it of payload.items) {
      const eid = String(it.employeeId)
      if (!empMap[eid]) {
        const emp = employees.value.find((e) => String(e._id) === eid)
        empMap[eid] = {
          employeeId: eid,
          employeeName: emp
            ? [emp.firstName, emp.lastName].filter(Boolean).join(' ') || emp.name || emp.email
            : it.endUserOrMR || '',
          department: emp?.department || '',
          items: []
        }
      }
      empMap[eid].items.push({
        description: it.description,
        product: it.product,
        serialNumber: it.serialNumber,
        acn: it.acn,
        propertyNumber: it.propertyNumber,
        printerOrScanner: it.printerOrScanner,
        remarksYears: it.remarksYears,
        status: it.status
      })
    }
    payload.employeeAssignments = Object.values(empMap)
    payload.employeeIds = payload.employeeAssignments.map((a) => a.employeeId)
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

async function saveDraft() {
  try {
    const dep = newRecord.value.departmentId
      ? departments.value.find((d) => String(d._id) === String(newRecord.value.departmentId))
      : null

    // Build items from preview rows so draft payload matches current preview
    const previewRows = mergedPreviewRows.value || []
    const itemsFromPreview = previewRows.map((row) => {
      const endUser = String(row.endUserOrMR || '').trim()
      const exemplars = (newRecord.value.items || []).filter(
        (it) => String(it.endUserOrMR || '').trim() === endUser
      )
      const primaryExemplar = (() => {
        const byCat = (pid) => {
          const p = products.value.find((x) => String(x._id) === String(pid))
          return String(p?.category?.name || '').toLowerCase()
        }
        const dl = exemplars.find((it) => {
          const cname = byCat(it.product)
          return cname.includes('desktop') || cname.includes('laptop') || cname.includes('computer')
        })
        return dl || exemplars[0] || null
      })()
      const productId = primaryExemplar?.product || undefined
      const employeeId = (exemplars.find((it) => it.employeeId) || {}).employeeId || undefined
      const serialNumber = primaryExemplar?.serialNumber || undefined
      const acn = primaryExemplar?.acn || undefined

      return {
        description: row.description || primaryExemplar?.description || 'N/A',
        product: productId,
        processor: row.processor || 'N/A',
        storage: row.storage || 'N/A',
        ram: row.ram || 'N/A',
        videoCard: row.videoCard || 'N/A',
        monitorAndSerial: row.monitorAndSerial || 'N/A',
        serialNumber,
        acn,
        propertyNumber: row.propertyNumber || 'N/A',
        printerOrScanner: row.printerOrScanner || '',
        endUserOrMR: row.endUserOrMR || '',
        employeeId,
        remarksYears: row.remarksYears || '',
        status: 'deployed',
        statusNotes: ''
      }
    })

    const payload = {
      departmentId: newRecord.value.departmentId || undefined,
      department: dep?.name || newRecord.value.department,
      notes: newRecord.value.notes,
      date: newRecord.value.date,
      items: itemsFromPreview
    }

    // Derive employee assignments for draft (skip items without employeeId)
    const empMap = {}
    for (const it of payload.items) {
      if (!it.employeeId) continue
      const eid = String(it.employeeId)
      if (!empMap[eid]) {
        const emp = employees.value.find((e) => String(e._id) === eid)
        empMap[eid] = {
          employeeId: eid,
          employeeName: emp
            ? [emp.firstName, emp.lastName].filter(Boolean).join(' ') || emp.name || emp.email
            : it.endUserOrMR || '',
          department: emp?.department || '',
          items: []
        }
      }
      empMap[eid].items.push({
        description: it.description,
        product: it.product,
        serialNumber: it.serialNumber,
        acn: it.acn,
        propertyNumber: it.propertyNumber,
        printerOrScanner: it.printerOrScanner,
        remarksYears: it.remarksYears,
        status: it.status
      })
    }
    payload.employeeAssignments = Object.values(empMap)
    payload.employeeIds = payload.employeeAssignments.map((a) => a.employeeId)

    const draft = { payload, savedAt: new Date().toISOString(), author: createdByName.value }
    localStorage.setItem('imsInventoryRecordDraft', JSON.stringify(draft))
    successMessage.value = 'Draft saved locally'
    setTimeout(() => (successMessage.value = null), 2000)
  } catch (err) {
    console.error('Failed to save draft:', err)
    alert('Failed to save draft locally')
  }
}

// Update per-item lifecycle status
async function updateItemStatus(recordId, item) {
  try {
    if (!recordId || !item?._nextStatus) return
    const body = {
      status: item._nextStatus,
      serialNumber: item.serialNumber || undefined,
      acn: item.acn || item.propertyNumber || undefined,
      notes: 'Updated via Inventory UI'
    }
    const { data } = await axios.patch(`/inventory-records/${recordId}/items/status`, body)
    const updated = data?.record || data?.updatedRecord || data
    if (updated && updated.items) {
      // Update selectedRecord reference to reflect changes
      if (selectedRecord.value && String(selectedRecord.value._id) === String(recordId)) {
        selectedRecord.value = updated
      }
      // Also refresh list to keep consistency
      await fetchRecords()
    }
    successMessage.value = 'Item status updated'
    setTimeout(() => (successMessage.value = null), 2000)
    item._nextStatus = ''
  } catch (err) {
    console.error('Failed to update item status:', err)
    alert(err?.response?.data?.message || 'Failed to update item status')
  }
}

function cancelAdd() {
  isAddOpen.value = false
  resetAddForm()
}

onMounted(async () => {
  async function fetchProducts() {
    productsLoading.value = true
    productsError.value = null
    try {
      const { data } = await axios.get('/products')
      products.value = data?.products || data?.data?.products || []
      console.log('🔍 Products loaded:', products.value.length, products.value)
      // Initialize primary product to first matching type
      const list = primaryProducts.value
      console.log('🔍 Primary products:', list.length, list)
      if (!primaryProductId.value && list.length) primaryProductId.value = list[0]._id
    } catch (err) {
      products.value = []
      productsError.value = err?.response?.data?.message || err.message || 'Failed to load products'
      console.error('❌ Products fetch error:', err)
    } finally {
      productsLoading.value = false
    }
  }
  async function fetchEmployees() {
    employeesLoading.value = true
    employeesError.value = null
    try {
      const { data } = await axios.get('/employees')
      employees.value = data?.employees || []
      console.log('🔍 Employees loaded:', employees.value.length, employees.value)
    } catch (err) {
      employees.value = []
      employeesError.value =
        err?.response?.data?.message || err.message || 'Failed to load employees'
      console.error('❌ Employees fetch error:', err)
    } finally {
      employeesLoading.value = false
    }
  }
  await Promise.all([
    fetchRecords(),
    fetchDepartments(),
    fetchProducts(),
    fetchEmployees(),
    fetchDeployedAcnCodes()
  ])
})

// Refetch when filters change
watch([filterDepartment, filterSource, filterDate, serialSearch, acnSearch], () => {
  fetchRecords()
})

// Reset product selection when device type changes
watch(deviceType, () => {
  const list = primaryProducts.value
  primaryProductId.value = list[0]?._id || ''
})

// Fetch ACNs when primary product changes
watch(primaryProductId, (pid) => {
  selectedPrimaryAcn.value = ''
  if (pid) fetchACNsForProduct(pid)
})

// Derived - client text search only; other filters are server-backed
const filteredRecords = computed(() => {
  const q = textSearch.value.trim().toLowerCase()
  if (!q) return records.value
  return records.value.filter((r) =>
    [r.department, r.notes, r?.createdBy?.name]
      .map((v) => String(v || '').toLowerCase())
      .some((v) => v.includes(q))
  )
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

// Group records by department for accordion view
const expandedDept = ref({})
const expandedRecord = ref({})
const groupedByDepartment = computed(() => {
  const groups = {}
  for (const r of filteredRecords.value) {
    const dept = r.department || '—'
    if (!groups[dept]) groups[dept] = []
    groups[dept].push(r)
  }
  // Sort each group's records by date descending
  Object.keys(groups).forEach((d) => {
    groups[d].sort((a, b) => new Date(b.date) - new Date(a.date))
  })
  return groups
})
const mergedPreviewRows = computed(() => {
  const groups = {}
  const items = Array.isArray(newRecord.value.items) ? newRecord.value.items : []
  console.log(items)
  const byName = (s) =>
    String(s || '')
      .trim()
      .toLowerCase()
  for (const it of items) {
    const endUser = String(it.endUserOrMR || '').trim() || '—'
    if (!groups[endUser]) {
      groups[endUser] = {
        endUserOrMR: endUser,
        description: '',
        processor: '',
        storage: '',
        ram: '',
        videoCard: '',
        monitors: [],
        propertyNumber: '',
        printerOrScannerList: [],
        remarksYearsList: []
      }
    }
    const row = groups[endUser]
    const product = products.value.find((p) => String(p._id) === String(it.product))
    const cname = byName(product?.category?.name)
    const isDesktop = cname.includes('desktop') || cname.includes('computer')
    const isLaptop = cname.includes('laptop')
    const isMonitor = cname.includes('monitor')
    const isPrinter = cname.includes('printer')
    const isScanner = cname.includes('scanner')

    const specsArr = Array.isArray(product?.specifications) ? product.specifications : []
    const specVal = (n) => {
      const s = specsArr.find(
        (x) => String(x?.name || '').toLowerCase() === String(n).toLowerCase()
      )
      return s?.value || ''
    }
    const serial = it.serialNumber || ''
    const monitorStr = [product?.name || it.description || 'Monitor', serial]
      .filter(Boolean)
      .join(' - ')
    if (isDesktop || (!row.description && isLaptop)) {
      row.description = product?.name || it.description || ''
      row.processor = it.processor || specVal('Processor') || ''
      row.storage = it.storage || specVal('Storage') || ''
      row.ram = it.ram || specVal('RAM') || ''
      row.videoCard = it.videoCard || specVal('Video Card') || ''
      if (it.propertyNumber && !row.propertyNumber) row.propertyNumber = it.propertyNumber
    } else if (isMonitor) {
      if (monitorStr) row.monitors.push(monitorStr)
      if (it.propertyNumber && !row.propertyNumber) row.propertyNumber = it.propertyNumber
    } else if (isPrinter || isScanner || String(it.printerOrScanner || '').trim()) {
      const t = isPrinter ? 'Printer' : isScanner ? 'Scanner' : String(it.printerOrScanner).trim()
      const name = product?.name || it.description || ''
      const serialPS = it.serialNumber || ''
      const psStr = [t, name, serialPS].filter(Boolean).join(' - ')
      row.printerOrScannerList.push(psStr)
      if (it.propertyNumber && !row.propertyNumber) row.propertyNumber = it.propertyNumber
    } else {
      // Fallback: if this item carries specs (or product specs), use as primary if none yet
      if (
        !row.description &&
        (it.processor ||
          it.storage ||
          it.ram ||
          it.videoCard ||
          specVal('Processor') ||
          specVal('Storage') ||
          specVal('RAM') ||
          specVal('Video Card'))
      ) {
        row.description = product?.name || it.description || ''
        row.processor = it.processor || specVal('Processor') || ''
        row.storage = it.storage || specVal('Storage') || ''
        row.ram = it.ram || specVal('RAM') || ''
        row.videoCard = it.videoCard || specVal('Video Card') || ''
        if (it.propertyNumber && !row.propertyNumber) row.propertyNumber = it.propertyNumber
      }
    }

    if (String(it.remarksYears || '').trim()) {
      row.remarksYearsList.push(String(it.remarksYears).trim())
    }
  }
  const merged = Object.values(groups).map((row) => ({
    description: row.description || '—',
    processor: row.processor || '—',
    storage: row.storage || '—',
    ram: row.ram || '—',
    videoCard: row.videoCard || '—',
    monitorAndSerial: row.monitors.length ? row.monitors.join('\n') : '—',
    propertyNumber: row.propertyNumber || '—',
    printerOrScanner: row.printerOrScannerList.length ? row.printerOrScannerList.join('\n') : '—',
    endUserOrMR: row.endUserOrMR || '—',
    remarksYears: row.remarksYearsList.length ? row.remarksYearsList.join('\n') : '—'
  }))
  // Remove completely blank rows from preview (no device/spec/monitor/printer/remarks/property)
  return merged.filter((r) => {
    return !(
      r.description === '—' &&
      r.processor === '—' &&
      r.storage === '—' &&
      r.ram === '—' &&
      r.videoCard === '—' &&
      r.monitorAndSerial === '—' &&
      r.propertyNumber === '—' &&
      r.printerOrScanner === '—' &&
      r.remarksYears === '—'
    )
  })
})
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
              <BaseCombobox
                v-model="filterDepartment"
                :options="[
                  { label: 'All Departments', value: '' },
                  ...departments.map((d) => ({ label: d.name, value: d.name }))
                ]"
                labelKey="label"
                valueKey="value"
                placeholder="All Departments"
              />
              <BaseCombobox
                v-model="filterSource"
                :options="[
                  { label: 'All Sources', value: '' },
                  { label: 'Manual', value: 'manual' },
                  { label: 'Deployment', value: 'deployment' }
                ]"
                labelKey="label"
                valueKey="value"
                placeholder="All Sources"
              />
              <input
                v-model="filterDate"
                type="date"
                class="w-1/3 rounded border border-stroke p-2"
              />
              <input
                v-model="serialSearch"
                type="text"
                placeholder="Serial No."
                class="w-1/3 rounded border border-stroke p-2"
              />
              <input
                v-model="acnSearch"
                type="text"
                placeholder="ACN"
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

        <!-- Department-grouped list -->
        <div v-else>
          <div v-if="filteredRecords?.length === 0" class="px-4 py-10 text-center">
            <div class="flex flex-col items-center gap-2 text-gray-600">
              <div class="text-sm">No records match your filters.</div>
              <button
                class="bg-primary text-white px-4 py-2 rounded hover:bg-opacity-90"
                @click="isAddOpen = true"
              >
                Add New Record
              </button>
            </div>
          </div>

          <!-- Records Table -->
          <div class="overflow-x-auto">
            <table class="min-w-full bg-white dark:bg-boxdark rounded-sm">
              <thead class="bg-gray-50 dark:bg-meta-4">
                <tr class="text-left">
                  <th class="p-3 border-b border-stroke">Record #</th>
                  <th class="p-3 border-b border-stroke">Department</th>
                  <th class="p-3 border-b border-stroke">Created By</th>
                  <th class="p-3 border-b border-stroke">Date</th>
                  <th class="p-3 border-b border-stroke">Total Items</th>
                  <th class="p-3 border-b border-stroke">End Users</th>
                  <th class="p-3 border-b border-stroke">Status</th>
                  <th class="p-3 border-b border-stroke">Actions</th>
                </tr>
              </thead>
              <tbody>
                <tr
                  v-for="rec in paginatedRecords"
                  :key="rec._id"
                  class="border-b border-stroke last:border-0"
                >
                  <td class="p-3 font-mono">{{ formatRecordNumber(rec) }}</td>
                  <td class="p-3">{{ rec.department || '—' }}</td>
                  <td class="p-3">{{ rec?.createdBy?.name || rec?.createdBy?.role || '—' }}</td>
                  <td class="p-3">{{ new Date(rec.date).toLocaleDateString() }}</td>
                  <td class="p-3">{{ (rec.items || []).length }}</td>
                  <td class="p-3">{{ countEndUsers(rec) }}</td>
                  <td class="p-3">
                    <span :class="statusClass(recordStatus(rec))">{{
                      recordStatus(rec) || '—'
                    }}</span>
                  </td>
                  <td class="p-3">
                    <div class="flex items-center gap-2">
                      <button
                        class="border border-stroke px-3 py-1 rounded hover:bg-gray-50"
                        @click="openDetails(rec)"
                      >
                        View
                      </button>
                      <button
                        class="border border-stroke px-3 py-1 rounded hover:bg-gray-50"
                        @click="printRecord(rec)"
                      >
                        Print
                      </button>
                    </div>
                  </td>
                </tr>
                <tr v-if="paginatedRecords.length === 0">
                  <td colspan="8" class="p-4 text-center text-gray-500">No records to display.</td>
                </tr>
              </tbody>
            </table>
          </div>

          <div class="flex items-center justify-end gap-2 mt-3">
            <button
              class="px-3 py-1 border border-stroke rounded text-sm"
              :disabled="currentPage <= 1"
              @click="prevPage"
            >
              Prev
            </button>
            <div class="text-xs text-gray-600">Page {{ currentPage }} of {{ totalPages }}</div>
            <button
              class="px-3 py-1 border border-stroke rounded text-sm"
              :disabled="currentPage >= totalPages"
              @click="nextPage"
            >
              Next
            </button>
          </div>

          <!-- Build grouped structure -->
          <div
            v-show="false"
            v-for="dept in Object.keys(groupedByDepartment)"
            :key="dept"
            class="mb-4 border border-stroke rounded"
          >
            <button
              class="w-full flex items-center justify-between px-4 py-2 bg-gray-50"
              @click="expandedDept[dept] = !expandedDept[dept]"
              :title="dept"
            >
              <div class="flex items-center gap-2">
                <span
                  class="inline-flex items-center rounded-full bg-sky-100 text-sky-700 px-2 py-0.5 text-xs font-medium"
                >
                  {{ dept || '—' }}
                </span>
                <span class="text-xs text-gray-600"
                  >{{ (groupedByDepartment[dept] || []).length }} RIS</span
                >
              </div>
              <span class="text-xs text-gray-500">{{ expandedDept[dept] ? 'Hide' : 'Show' }}</span>
            </button>
            <div v-show="expandedDept[dept]" class="p-2">
              <div v-for="rec in groupedByDepartment[dept]" :key="rec._id" class="border-t">
                <div class="flex items-center justify-between px-2 py-2">
                  <div class="flex items-center gap-3">
                    <span
                      :class="[
                        'inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium',
                        rec.sourceType === 'Deployment'
                          ? 'bg-purple-100 text-purple-700'
                          : 'bg-gray-100 text-gray-700'
                      ]"
                    >
                      {{ rec.sourceType || 'Manual' }}
                    </span>
                    <div class="max-w-[28rem] truncate" :title="rec.notes">
                      {{ rec.notes || '—' }}
                    </div>
                  </div>
                  <div class="flex items-center gap-3">
                    <span class="text-sm text-gray-600">{{
                      new Date(rec.date).toLocaleDateString()
                    }}</span>
                    <button
                      class="border border-stroke px-3 py-1 rounded hover:bg-gray-50"
                      @click="openDetails(rec)"
                      :title="'View full details'"
                    >
                      View
                    </button>
                    <button
                      class="border border-stroke px-3 py-1 rounded hover:bg-gray-50"
                      @click="printRecord(rec)"
                      :title="'Print / Export PDF'"
                    >
                      Print
                    </button>
                  </div>
                </div>
                <div v-if="expandedRecord[rec._id]" class="px-2 pb-4">
                  <div class="grid grid-cols-1 md:grid-cols-2 gap-4 mb-3 text-sm">
                    <div>
                      <span class="font-semibold">Created By:</span>
                      <span class="ml-1">{{
                        rec?.createdBy?.name || rec?.createdBy?.role || '—'
                      }}</span>
                    </div>
                    <div>
                      <span class="font-semibold">Source RIS:</span>
                      <span class="ml-1">{{ rec?.sourceRIS || '—' }}</span>
                    </div>
                  </div>
                  <div class="overflow-x-auto">
                    <table class="min-w-full text-sm">
                      <thead class="bg-gray-100">
                        <tr>
                          <th class="px-4 py-2 text-left">Description</th>
                          <th class="px-4 py-2 text-left">Serial No.</th>
                          <th class="px-4 py-2 text-left">Processor</th>
                          <th class="px-4 py-2 text-left">Storage</th>
                          <th class="px-4 py-2 text-left">RAM</th>
                          <th class="px-4 py-2 text-left">Video Card</th>
                          <th class="px-4 py-2 text-left">Brand of Monitor & Serial Number</th>
                          <th class="px-4 py-2 text-left">Property Number</th>
                          <th class="px-4 py-2 text-left">Printer or Scanner</th>
                          <th class="px-4 py-2 text-left">End User or MR</th>
                          <th class="px-4 py-2 text-left">Remarks / Years</th>
                          <th class="px-4 py-2 text-left">Status</th>
                          <th class="px-4 py-2 text-left">Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        <tr v-for="(item, idx) in rec?.items || []" :key="idx" class="border-t">
                          <td class="px-4 py-2">{{ item.description }}</td>
                          <td class="px-4 py-2">{{ item.serialNumber || '—' }}</td>
                          <td class="px-4 py-2">{{ item.processor }}</td>
                          <td class="px-4 py-2">{{ item.storage }}</td>
                          <td class="px-4 py-2">{{ item.ram }}</td>
                          <td class="px-4 py-2">{{ item.videoCard }}</td>
                          <td class="px-4 py-2">{{ item.monitorAndSerial }}</td>
                          <td class="px-4 py-2">{{ item.propertyNumber }}</td>
                          <td class="px-4 py-2">{{ item.printerOrScanner }}</td>
                          <td class="px-4 py-2">{{ item.endUserOrMR }}</td>
                          <td class="px-4 py-2">{{ item.remarksYears }}</td>
                          <td class="px-4 py-2">{{ item.status || '—' }}</td>
                          <td class="px-4 py-2">
                            <div class="flex gap-2 items-center">
                              <BaseCombobox
                                v-model="item._nextStatus"
                                :options="statusOptions"
                                placeholder="Change..."
                              />
                              <button
                                class="text-xs px-2 py-1 border border-stroke rounded hover:bg-gray-50 disabled:opacity-50"
                                :disabled="
                                  !item._nextStatus || !(item.serialNumber || item.propertyNumber)
                                "
                                @click="updateItemStatus(rec?._id, item)"
                              >
                                Apply
                              </button>
                            </div>
                          </td>
                        </tr>
                        <tr v-if="!rec || (rec.items || []).length === 0">
                          <td colspan="13" class="px-4 py-6 text-center text-gray-500">
                            No items in this record.
                          </td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
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
          id="printArea"
          class="bg-white max-h-[80%] overflow-auto dark:bg-boxdark rounded-md shadow-lg w-full max-w-[90%] p-6"
        >
          <div class="flex justify-between items-start mb-4">
            <div>
              <h2 class="text-lg font-semibold flex items-center gap-2">
                Inventory Record Details
                <!-- <span
                  v-if="hasValidationIssues(selectedRecord)"
                  class="inline-flex items-center rounded bg-yellow-100 text-yellow-700 px-2 py-0.5 text-xs"
                >
                  ⚠ Validation Issues
                </span> -->
              </h2>
              <div class="text-xs text-gray-600 mt-1">
                ID: #{{ formatRecordNumber(selectedRecord) }} • Dept:
                {{ selectedRecord?.department || '—' }} • Date:
                {{ selectedRecord ? new Date(selectedRecord.date).toLocaleDateString() : '' }}
              </div>
            </div>
            <div class="flex items-center gap-2">
              <button
                class="no-print text-sm px-3 py-1 border border-stroke rounded hover:bg-gray-50"
                @click="printSelectedRecord"
                title="Print / Export PDF"
              >
                Print
              </button>
              <button
                class="no-print text-xl leading-none px-2 py-1"
                @click="closeDetails"
                aria-label="Close"
              >
                ×
              </button>
            </div>
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

          <!-- Items Table (Preview Format) -->
          <div class="overflow-x-auto mt-2 border border-stroke rounded">
            <table class="min-w-full text-sm border border-stroke">
              <thead class="bg-gray-100">
                <tr>
                  <th class="px-3 py-2 text-left border border-stroke">Description</th>
                  <th class="px-3 py-2 text-left border border-stroke">Processor</th>
                  <th class="px-3 py-2 text-left border border-stroke">Storage</th>
                  <th class="px-3 py-2 text-left border border-stroke">RAM</th>
                  <th class="px-3 py-2 text-left border border-stroke">Video Card</th>
                  <th class="px-3 py-2 text-left border border-stroke">
                    Brand of Monitor & Serial Number
                  </th>
                  <th class="px-3 py-2 text-left border border-stroke">Property Number</th>
                  <th class="px-3 py-2 text-left border border-stroke">Printer or Scanner</th>
                  <th class="px-3 py-2 text-left border border-stroke">End User or MR</th>
                  <th class="px-3 py-2 text-left border border-stroke">Remarks / Years</th>
                  <th class="px-3 py-2 text-left border border-stroke">Actions</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="(row, idx) in selectedMergedRows" :key="idx" class="odd:bg-gray-50">
                  <td
                    class="px-3 py-2 border border-stroke whitespace-normal break-words align-top"
                    :title="row.description"
                  >
                    {{ row.description || '—' }}
                  </td>
                  <td
                    class="px-3 py-2 border border-stroke whitespace-normal break-words align-top"
                    :title="row.processor"
                  >
                    {{ row.processor || '—' }}
                  </td>
                  <td
                    class="px-3 py-2 border border-stroke whitespace-normal break-words align-top"
                    :title="row.storage"
                  >
                    {{ row.storage || '—' }}
                  </td>
                  <td
                    class="px-3 py-2 border border-stroke whitespace-normal break-words align-top"
                    :title="row.ram"
                  >
                    {{ row.ram || '—' }}
                  </td>
                  <td
                    class="px-3 py-2 border border-stroke whitespace-normal break-words align-top"
                    :title="row.videoCard"
                  >
                    {{ row.videoCard || '—' }}
                  </td>
                  <td
                    class="px-3 py-2 border border-stroke whitespace-pre-line break-words align-top"
                    :title="row.monitorAndSerial"
                  >
                    {{ row.monitorAndSerial || '—' }}
                  </td>
                  <td
                    class="px-3 py-2 border border-stroke whitespace-normal break-words align-top"
                    :title="row.propertyNumber"
                  >
                    {{ row.propertyNumber || '—' }}
                  </td>
                  <td
                    class="px-3 py-2 border border-stroke whitespace-pre-line break-words align-top"
                    :title="row.printerOrScanner"
                  >
                    {{ row.printerOrScanner || '—' }}
                  </td>
                  <td
                    class="px-3 py-2 border border-stroke whitespace-normal break-words align-top"
                    :title="row.endUserOrMR"
                  >
                    {{ row.endUserOrMR || '—' }}
                  </td>
                  <td
                    class="px-3 py-2 border border-stroke whitespace-pre-line break-words align-top"
                    :title="row.remarksYears"
                  >
                    {{ row.remarksYears || '—' }}
                  </td>
                  <td class="px-3 py-2 border border-stroke">
                    <div class="text-xs text-gray-500">
                      Edit items individually in source record
                    </div>
                  </td>
                </tr>
                <tr v-if="selectedMergedRows.length === 0">
                  <td colspan="11" class="px-3 py-4 text-center text-gray-500">
                    No items in this record.
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          <div v-if="false" class="flex items-center justify-between mb-2">
            <div class="flex items-center gap-2">
              <label class="text-xs text-gray-600">View:</label>
              <button
                class="text-xs px-2 py-1 border border-stroke rounded"
                :class="recordViewMode === 'compact' ? 'bg-gray-100' : ''"
                @click="recordViewMode = 'compact'"
                title="Compact view"
              >
                Compact
              </button>
              <button
                class="text-xs px-2 py-1 border border-stroke rounded"
                :class="recordViewMode === 'expanded' ? 'bg-gray-100' : ''"
                @click="recordViewMode = 'expanded'"
                title="Expanded view"
              >
                Expanded
              </button>
            </div>
          </div>

          <div v-if="false" class="overflow-x-auto max-h-[60vh]">
            <table class="min-w-full text-sm">
              <thead class="bg-gray-100 sticky top-0 z-10">
                <tr v-if="recordViewMode === 'compact'">
                  <th class="px-4 py-2 text-left">Description</th>
                  <th class="px-4 py-2 text-left">Product</th>
                  <th class="px-4 py-2 text-left">Serial No.</th>
                  <th class="px-4 py-2 text-left">ACN</th>
                  <th class="px-4 py-2 text-left">Specs</th>
                  <th class="px-4 py-2 text-left">Brand of Monitor & Serial Number</th>
                  <th class="px-4 py-2 text-left">Property Number</th>
                  <th class="px-4 py-2 text-left">Printer or Scanner</th>
                  <th class="px-4 py-2 text-left">End User or MR</th>
                  <th class="px-4 py-2 text-left">Remarks</th>
                  <th class="px-4 py-2 text-left">Status</th>
                  <th class="px-4 py-2 text-left">Actions</th>
                </tr>
                <tr v-else>
                  <th class="px-4 py-2 text-left">Description</th>
                  <th class="px-4 py-2 text-left">Serial No.</th>
                  <th class="px-4 py-2 text-left">Processor</th>
                  <th class="px-4 py-2 text-left">Storage</th>
                  <th class="px-4 py-2 text-left">RAM</th>
                  <th class="px-4 py-2 text-left">Video Card</th>
                  <th class="px-4 py-2 text-left">Brand of Monitor & Serial Number</th>
                  <th class="px-4 py-2 text-left">Property Number</th>
                  <th class="px-4 py-2 text-left">Printer or Scanner</th>
                  <th class="px-4 py-2 text-left">End User or MR</th>
                  <th class="px-4 py-2 text-left">Remarks / Years</th>
                  <th class="px-4 py-2 text-left">Status</th>
                  <th class="px-4 py-2 text-left">Actions</th>
                </tr>
              </thead>
              <tbody>
                <template v-if="recordViewMode === 'compact'">
                  <tr
                    v-for="(item, idx) in selectedRecord?.items || []"
                    :key="idx"
                    class="border-t"
                  >
                    <td class="px-4 py-2">{{ item.description }}</td>
                    <td class="px-4 py-2">{{ getProductName(item.product) || '—' }}</td>
                    <td class="px-4 py-2">
                      <div class="flex items-center gap-2">
                        <span>{{ item.serialNumber || '—' }}</span>
                        <button
                          v-if="item.serialNumber"
                          class="text-[11px] px-1.5 py-0.5 border border-stroke rounded hover:bg-gray-50"
                          @click="copyToClipboard(item.serialNumber)"
                          title="Copy Serial"
                        >
                          Copy
                        </button>
                      </div>
                    </td>
                    <td class="px-4 py-2">
                      <div class="flex items-center gap-2">
                        <span>{{ item.acn || '—' }}</span>
                        <button
                          v-if="item.acn"
                          class="text-[11px] px-1.5 py-0.5 border border-stroke rounded hover:bg-gray-50"
                          @click="copyToClipboard(item.acn)"
                          title="Copy ACN"
                        >
                          Copy
                        </button>
                      </div>
                    </td>
                    <td class="px-4 py-2 whitespace-pre-line">
                      Processor: {{ specFrom(item, 'processor') }} \nStorage:
                      {{ specFrom(item, 'storage') }} \nRAM: {{ specFrom(item, 'ram') }} \nVideo
                      Card: {{ specFrom(item, 'videoCard') }}
                    </td>
                    <td class="px-4 py-2 whitespace-pre-line">
                      {{ item.monitorAndSerial || '—' }}
                    </td>
                    <td class="px-4 py-2">
                      <div class="flex items-center gap-2">
                        <span>{{ item.propertyNumber || '—' }}</span>
                        <button
                          v-if="item.propertyNumber"
                          class="text-[11px] px-1.5 py-0.5 border border-stroke rounded hover:bg-gray-50"
                          @click="copyToClipboard(item.propertyNumber)"
                          title="Copy Property Number"
                        >
                          Copy
                        </button>
                      </div>
                    </td>
                    <td class="px-4 py-2">{{ item.printerOrScanner || '—' }}</td>
                    <td class="px-4 py-2">{{ item.endUserOrMR || '—' }}</td>
                    <td class="px-4 py-2">{{ item.remarks || item.remarksYears || '—' }}</td>
                    <td class="px-4 py-2">
                      <span :class="statusClass(item.status)">{{ item.status || '—' }}</span>
                    </td>
                    <td class="px-4 py-2">
                      <div class="flex gap-2 items-center">
                        <BaseCombobox
                          v-model="item._nextStatus"
                          :options="statusOptions"
                          placeholder="Change..."
                        />
                        <button
                          class="text-xs px-2 py-1 border border-stroke rounded hover:bg-gray-50 disabled:opacity-50"
                          :disabled="
                            !item._nextStatus || !(item.serialNumber || item.propertyNumber)
                          "
                          @click="updateItemStatus(selectedRecord?._id, item)"
                        >
                          Apply
                        </button>
                      </div>
                    </td>
                  </tr>
                  <tr v-if="!selectedRecord || (selectedRecord.items || []).length === 0">
                    <td colspan="12" class="px-4 py-6 text-center text-gray-500">
                      No items in this record.
                    </td>
                  </tr>
                </template>

                <template v-else>
                  <tr
                    v-for="(item, idx) in selectedRecord?.items || []"
                    :key="idx"
                    class="border-t"
                  >
                    <td class="px-4 py-2">{{ item.description }}</td>
                    <td class="px-4 py-2">{{ item.serialNumber || '—' }}</td>
                    <td class="px-4 py-2">{{ specFrom(item, 'processor') }}</td>
                    <td class="px-4 py-2">{{ specFrom(item, 'storage') }}</td>
                    <td class="px-4 py-2">{{ specFrom(item, 'ram') }}</td>
                    <td class="px-4 py-2">{{ specFrom(item, 'videoCard') }}</td>
                    <td class="px-4 py-2">{{ item.monitorAndSerial }}</td>
                    <td class="px-4 py-2">{{ item.propertyNumber }}</td>
                    <td class="px-4 py-2">{{ item.printerOrScanner }}</td>
                    <td class="px-4 py-2">{{ item.endUserOrMR }}</td>
                    <td class="px-4 py-2">{{ item.remarksYears }}</td>
                    <td class="px-4 py-2">{{ item.status || '—' }}</td>
                    <td class="px-4 py-2">
                      <div class="flex gap-2 items-center">
                        <BaseCombobox
                          v-model="item._nextStatus"
                          :options="statusOptions"
                          placeholder="Change..."
                        />
                        <button
                          class="text-xs px-2 py-1 border border-stroke rounded hover:bg-gray-50 disabled:opacity-50"
                          :disabled="
                            !item._nextStatus || !(item.serialNumber || item.propertyNumber)
                          "
                          @click="updateItemStatus(selectedRecord?._id, item)"
                        >
                          Apply
                        </button>
                      </div>
                    </td>
                  </tr>
                  <tr v-if="!selectedRecord || (selectedRecord.items || []).length === 0">
                    <td colspan="10" class="px-4 py-6 text-center text-gray-500">
                      No items in this record.
                    </td>
                  </tr>
                </template>
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <!-- Add Modal -->
      <div
        v-if="isAddOpen"
        class="fixed inset-0 bg-black bg-opacity-30 flex items-center justify-center z-1000"
      >
        <div
          class="bg-white left-35 top-10 relative max-h-[80%] overflow-auto dark:bg-boxdark rounded-md shadow-lg w-full max-w-[75%] p-6"
        >
          <h2 class="text-lg font-semibold mb-4">Add Record</h2>
          <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label class="block text-sm font-medium mb-1">Department</label>
              <div v-if="departments.length">
                <BaseCombobox
                  v-model="newRecord.departmentId"
                  :options="departments"
                  labelKey="name"
                  valueKey="_id"
                  placeholder="Select Department"
                />
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

          <!-- Primary device and employee selectors -->
          <div class="mt-4 border border-stroke rounded p-4">
            <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <div v-if="productsLoading" class="text-sm text-gray-500">Loading products…</div>
                <div v-else-if="productsError" class="text-sm text-red-600">
                  {{ productsError }}
                </div>
                <BaseCombobox
                  v-else
                  v-model="primaryProductId"
                  :options="primaryProducts"
                  labelKey="name"
                  valueKey="_id"
                  placeholder="Select product"
                />
              </div>
              <div>
                <div v-if="acnLoading" class="text-sm text-gray-500">Loading ACNs…</div>
                <div v-else-if="acnError" class="text-sm text-red-600">{{ acnError }}</div>
                <div v-else class="relative">
                  <div class="flex items-center space-x-2">
                    <input
                      v-model="acnQuery"
                      @focus="openAcnOptions"
                      @input="openAcnOptions"
                      @keydown.down.prevent="moveAcnHighlight(1)"
                      @keydown.up.prevent="moveAcnHighlight(-1)"
                      @keydown.enter.prevent="selectAcnFromHighlight()"
                      @keydown.esc.prevent="closeAcnOptions()"
                      @blur="closeAcnOptionsLater()"
                      type="text"
                      placeholder=""
                      class="w-full rounded border border-stroke p-2"
                    />
                    <button
                      v-if="selectedPrimaryAcn"
                      type="button"
                      @click="clearPrimaryAcn"
                      class="text-xs px-2 py-1 rounded border border-stroke hover:bg-gray-50"
                    >
                      Clear
                    </button>
                  </div>
                  <ul
                    v-if="showAcnOptions"
                    class="absolute z-10 mt-1 w-full bg-white dark:bg-boxdark border border-stroke dark:border-strokedark rounded shadow max-h-48 overflow-auto"
                  >
                    <li v-for="(code, aidx) in filteredPrimaryAcnOptions" :key="code">
                      <button
                        type="button"
                        @mousedown.prevent="selectPrimaryAcn(code)"
                        :class="[
                          'w-full text-left px-3 py-2 hover:bg-gray-50 dark:hover:bg-meta-4',
                          aidx === acnHighlightIndex ? 'bg-gray-100 dark:bg-meta-3' : ''
                        ]"
                      >
                        {{ code }}
                      </button>
                    </li>
                    <li
                      v-if="filteredPrimaryAcnOptions.length === 0"
                      class="px-3 py-2 text-sm text-gray-500"
                    >
                      No matches
                    </li>
                  </ul>
                  <div v-if="selectedPrimaryAcn" class="text-xs text-gray-600 mt-1">
                    Selected: {{ selectedPrimaryAcn }}
                  </div>
                </div>
              </div>
              <div>
                <div v-if="employeesLoading" class="text-sm text-gray-500">Loading employees…</div>
                <div v-else-if="employeesError" class="text-sm text-red-600">
                  {{ employeesError }}
                </div>
                <div v-else class="relative">
                  <div class="flex items-center space-x-2">
                    <input
                      v-model="employeeQuery"
                      @focus="openEmpOptions"
                      @input="openEmpOptions"
                      @keydown.down.prevent="moveEmpHighlight(1)"
                      @keydown.up.prevent="moveEmpHighlight(-1)"
                      @keydown.enter.prevent="selectEmpFromHighlight()"
                      @keydown.esc.prevent="closeEmpOptions()"
                      @blur="closeEmpOptionsLater()"
                      type="text"
                      placeholder=""
                      class="w-full rounded border border-stroke p-2"
                    />
                    <button
                      v-if="selectedEmployeeId"
                      type="button"
                      @click="clearEmployeeSelection"
                      class="text-xs px-2 py-1 rounded border border-stroke hover:bg-gray-50"
                    >
                      Clear
                    </button>
                  </div>
                  <ul
                    v-if="showEmpOptions"
                    class="absolute z-10 mt-1 w-full bg-white dark:bg-boxdark border border-stroke dark:border-strokedark rounded shadow max-h-48 overflow-auto"
                  >
                    <li v-for="(e, eidx) in filteredEmployeeOptions" :key="e.id">
                      <button
                        type="button"
                        @mousedown.prevent="selectEmployee(e)"
                        :class="[
                          'w-full text-left px-3 py-2 hover:bg-gray-50 dark:hover:bg-meta-4',
                          eidx === empHighlightIndex ? 'bg-gray-100 dark:bg-meta-3' : ''
                        ]"
                      >
                        {{ e.name }}
                        <span v-if="e.email" class="text-xs text-gray-500"> — {{ e.email }}</span>
                      </button>
                    </li>
                    <li
                      v-if="filteredEmployeeOptions.length === 0"
                      class="px-3 py-2 text-sm text-gray-500"
                    >
                      No matches
                    </li>
                  </ul>
                  <div v-if="selectedEmployeeId" class="text-xs text-gray-600 mt-1">
                    Selected: {{ employeeQuery }}
                  </div>
                </div>
              </div>
            </div>
          </div>

          <!-- Batch Builder -->
          <div class="mt-6 border border-stroke rounded p-4">
            <h3 class="font-semibold mb-3">Batch Builder</h3>
            <div class="grid grid-cols-1 gap-4">
              <div class="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
                <div>
                  <label class="block text-sm font-medium mb-1">Desktop Product</label>
                  <BaseCombobox
                    v-model="desktopProductId"
                    :options="desktopProducts"
                    labelKey="name"
                    valueKey="_id"
                    placeholder="Select desktop"
                  />
                </div>
                <div>
                  <label class="block text-sm font-medium mb-1">Quantity</label>
                  <input
                    v-model="desktopQuantity"
                    type="number"
                    min="1"
                    class="w-full rounded border border-stroke p-2"
                  />
                </div>
                <div>
                  <label class="block text-sm font-medium mb-1">Optional Notes</label>
                  <input v-model="desktopNotes" class="w-full rounded border border-stroke p-2" />
                </div>
                <div class="flex items-end">
                  <button
                    class="text-sm px-3 py-2 border border-stroke rounded hover:bg-gray-50"
                    @click="generateDesktopUnits"
                  >
                    Generate Units
                  </button>
                </div>
              </div>
              <div class="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
                <div>
                  <label class="block text-sm font-medium mb-1">Laptop Product</label>
                  <BaseCombobox
                    v-model="laptopProductId"
                    :options="laptopProducts"
                    labelKey="name"
                    valueKey="_id"
                    placeholder="Select laptop"
                  />
                </div>
                <div>
                  <label class="block text-sm font-medium mb-1">Quantity</label>
                  <input
                    v-model="laptopQuantity"
                    type="number"
                    min="1"
                    class="w-full rounded border border-stroke p-2"
                  />
                </div>
                <div>
                  <label class="block text-sm font-medium mb-1">Optional Notes</label>
                  <input v-model="laptopNotes" class="w-full rounded border border-stroke p-2" />
                </div>
                <div class="flex items-end">
                  <button
                    class="text-sm px-3 py-2 border border-stroke rounded hover:bg-gray-50"
                    @click="generateLaptopUnits"
                  >
                    Generate Units
                  </button>
                </div>
              </div>
              <div class="flex gap-2">
                <button
                  class="text-sm px-3 py-2 border border-stroke rounded hover:bg-gray-50 disabled:opacity-50"
                  :disabled="batchUnits.length === 0"
                  @click="applyBatchToItems"
                >
                  Apply Units to Items
                </button>
              </div>
            </div>

            <div v-if="batchUnits.length" class="mt-4 space-y-4">
              <div
                v-for="(unit, uidx) in batchUnits"
                :key="uidx"
                class="border border-sky-200 bg-sky-50 rounded p-4"
              >
                <div class="flex items-center justify-between mb-3">
                  <div class="flex items-center gap-2">
                    <h4 class="font-medium">Unit #{{ uidx + 1 }}</h4>
                    <button
                      v-if="uidx > 0"
                      class="text-xs underline"
                      @click="copyPreviousUnit(uidx)"
                    >
                      Copy Previous Unit
                    </button>
                  </div>
                  <button
                    class="text-xs px-2 py-1 border border-stroke rounded hover:bg-gray-50"
                    @click="removeUnit(uidx)"
                  >
                    Remove
                  </button>
                </div>
                <div class="grid grid-cols-1 md:grid-cols-4 gap-4">
                  <div>
                    <label class="block text-sm font-medium mb-1">Select Item</label>

                    <BaseCombobox
                      v-model="unit.productId"
                      :options="primaryProducts"
                      labelKey="name"
                      valueKey="_id"
                      placeholder="Select item"
                      @change="(v) => onUnitProductChange(unit)"
                    />
                  </div>
                  <div>
                    <label class="block text-sm font-medium mb-1">Select Employee</label>
                    <BaseCombobox
                      v-model="unit.employeeId"
                      :options="getFilteredEmployeeOptionsForUnit(unit, uidx)"
                      labelKey="name"
                      valueKey="id"
                      placeholder="Select employee"
                    />
                    <!-- <p class="text-xs text-gray-500 mt-1" v-if="!selectedDeptName">
                      Tip: choose a department to filter employees.
                    </p> -->
                  </div>
                  <div>
                    <label class="block text-sm font-medium mb-1">Asset Control Number</label>
                    <BaseCombobox
                      v-model="unit.acn"
                      :options="getFilteredAcnOptions(unit, uidx)"
                      :disabled="!unit.productId"
                      placeholder="Select ACN"
                    />
                    <p
                      class="text-xs text-gray-600 mt-1"
                      v-if="requiresAcnForProduct(unit.productId)"
                    >
                      ACN required for this product.
                    </p>
                  </div>
                  <div>
                    <label class="block text-sm font-medium mb-1">Property Number</label>
                    <input
                      v-model="unit.propertyNumber"
                      class="w-full rounded border border-stroke p-2"
                    />
                  </div>
                  <div>
                    <label class="block text-sm font-medium mb-1">Remarks / Years</label>
                    <input
                      v-model="unit.remarksYears"
                      class="w-full rounded border border-stroke p-2"
                    />
                  </div>
                </div>

                <!-- Secondary items -->
                <div class="mt-4">
                  <h5 class="font-medium mb-2">Secondary Items</h5>
                  <div class="grid grid-cols-1 md:grid-cols-6 gap-3 items-end">
                    <div>
                      <label class="block text-sm font-medium mb-1">Type</label>
                      <BaseCombobox
                        v-model="unit._newSecondaryType"
                        :options="['Monitor', 'Printer', 'Scanner']"
                        placeholder="Select type"
                      />
                    </div>
                    <div>
                      <BaseCombobox
                        v-model="unit._newSecondaryProductId"
                        :options="secondaryProductsByType(unit._newSecondaryType)"
                        labelKey="name"
                        valueKey="_id"
                        :disabled="!unit._newSecondaryType"
                        placeholder="Select product"
                        @change="(v) => onSecondaryProductChange(unit)"
                      />
                    </div>
                    <div>
                      <label class="block text-sm font-medium mb-1">ACN</label>
                      <BaseCombobox
                        v-model="unit._newSecondaryAcn"
                        :options="getFilteredSecondaryAcnOptions(unit, uidx)"
                        :disabled="!unit._newSecondaryProductId"
                        placeholder="Select ACN"
                      />
                    </div>
                    <div>
                      <label class="block text-sm font-medium mb-1">Property Number</label>
                      <input
                        v-model="unit._newSecondaryPropertyNumber"
                        class="w-full rounded border border-stroke p-2"
                      />
                    </div>

                    <div class="md:col-span-1">
                      <label class="block text-sm font-medium mb-1">Remarks</label>
                      <input
                        v-model="unit._newSecondaryRemarks"
                        class="w-full rounded border border-stroke p-2"
                      />
                    </div>
                    <!-- <div class="md:col-span-1">
                      <label class="text-xs flex items-center gap-1 mt-6">
                        <input type="checkbox" v-model="unit._newSecondaryDuplicate" />
                        Duplicate across units
                      </label>
                    </div> -->
                    <div class="md:col-span-1">
                      <button
                        class="text-sm px-3 py-2 border border-stroke rounded hover:bg-gray-50 disabled:opacity-50"
                        :disabled="
                          !unit._newSecondaryType ||
                          !unit._newSecondaryProductId ||
                          (requiresAcnForProduct(unit._newSecondaryProductId) &&
                            !unit._newSecondaryAcn)
                        "
                        @click="addSecondary(unit)"
                      >
                        + Add Secondary
                      </button>
                    </div>
                  </div>

                  <div v-if="(unit.secondary || []).length" class="mt-3">
                    <div class="overflow-x-auto border border-stroke rounded">
                      <table class="min-w-full text-xs">
                        <thead class="bg-gray-100">
                          <tr>
                            <th class="px-2 py-1 text-left">Type</th>
                            <th class="px-2 py-1 text-left">Product</th>
                            <th class="px-2 py-1 text-left">ACN</th>
                            <th class="px-2 py-1 text-left">Property Number</th>
                            <th class="px-2 py-1 text-left">Remarks</th>
                            <th class="px-2 py-1 text-left">Actions</th>
                          </tr>
                        </thead>
                        <tbody>
                          <tr v-for="(sec, sidx) in unit.secondary" :key="sidx" class="border-t">
                            <td class="px-2 py-1">{{ sec.type }}</td>
                            <td class="px-2 py-1">{{ getProductName(sec.productId) }}</td>
                            <td class="px-2 py-1">{{ sec.acn || '—' }}</td>
                            <td class="px-2 py-1">{{ sec.propertyNumber || '—' }}</td>
                            <td class="px-2 py-1">{{ sec.remarksYears || '—' }}</td>
                            <td class="px-2 py-1">
                              <button
                                class="text-xs px-2 py-1 border border-stroke rounded hover:bg-gray-50"
                                @click="removeSecondary(unit, sidx)"
                              >
                                Remove
                              </button>
                            </td>
                          </tr>
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              </div>

              <div class="flex justify-end mt-2">
                <button
                  class="bg-primary text-white px-4 py-2 rounded hover:bg-opacity-90 disabled:opacity-50"
                  :disabled="
                    batchUnits.length === 0 ||
                    batchUnits.some(
                      (u) =>
                        !u.productId ||
                        !u.employeeId ||
                        (requiresAcnForProduct(u.productId) && !u.acn)
                    )
                  "
                  @click="applyBatchToItems"
                >
                  Apply Units to Items
                </button>
              </div>
            </div>
          </div>

          <div class="mt-6">
            <div class="flex justify-between items-center mb-3">
              <h3 class="font-semibold">Items</h3>
              <div class="flex gap-2 items-center">
                <span
                  class="text-xs px-2 py-1 rounded border"
                  :class="
                    isValidPreview
                      ? 'border-green-300 text-green-700 bg-green-50'
                      : 'border-yellow-300 text-yellow-700 bg-yellow-50'
                  "
                >
                  {{ isValidPreview ? 'Status: Validation Pass' : 'Status: Validation Issues' }}
                </span>
                <button
                  class="text-sm px-3 py-1 border border-stroke rounded hover:bg-gray-50 disabled:opacity-50"
                  @click="addItemRow"
                  :disabled="
                    !primaryProductId ||
                    !selectedEmployeeId ||
                    productsLoading ||
                    employeesLoading ||
                    (requiresAcn && !selectedPrimaryAcn)
                  "
                  :title="
                    !primaryProductId || !selectedEmployeeId
                      ? 'Select product and employee first'
                      : requiresAcn && !selectedPrimaryAcn
                        ? 'Select ACN for this product'
                        : ''
                  "
                >
                  + Add Item
                </button>
              </div>
            </div>

            <!-- Items Preview Table -->
            <div class="overflow-x-auto mt-2 border border-stroke rounded">
              <div class="flex justify-end p-2">
                <button
                  class="text-xs px-3 py-1 border border-stroke rounded hover:bg-gray-50"
                  @click="printPreview"
                >
                  Print / Export PDF
                </button>
              </div>
              <table class="min-w-full text-sm border border-stroke">
                <thead class="bg-gray-100">
                  <tr>
                    <th class="px-3 py-2 text-left border border-stroke">Description</th>
                    <th class="px-3 py-2 text-left border border-stroke">Processor</th>
                    <th class="px-3 py-2 text-left border border-stroke">Storage</th>
                    <th class="px-3 py-2 text-left border border-stroke">RAM</th>
                    <th class="px-3 py-2 text-left border border-stroke">Video Card</th>
                    <th class="px-3 py-2 text-left border border-stroke">
                      Brand of Monitor & Serial Number
                    </th>
                    <th class="px-3 py-2 text-left border border-stroke">Property Number</th>
                    <th class="px-3 py-2 text-left border border-stroke">Printer or Scanner</th>
                    <th class="px-3 py-2 text-left border border-stroke">End User or MR</th>
                    <th class="px-3 py-2 text-left border border-stroke">Remarks / Years</th>
                    <th class="px-3 py-2 text-left border border-stroke">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-for="(row, idx) in mergedPreviewRows" :key="idx" class="odd:bg-gray-50">
                    <td
                      class="px-3 py-2 border border-stroke whitespace-normal break-words align-top"
                      :title="row.description"
                    >
                      {{ row.description || '—' }}
                    </td>
                    <td
                      class="px-3 py-2 border border-stroke whitespace-normal break-words align-top"
                      :title="row.processor"
                    >
                      {{ row.processor || '—' }}
                    </td>
                    <td
                      class="px-3 py-2 border border-stroke whitespace-normal break-words align-top"
                      :title="row.storage"
                    >
                      {{ row.storage || '—' }}
                    </td>
                    <td
                      class="px-3 py-2 border border-stroke whitespace-normal break-words align-top"
                      :title="row.ram"
                    >
                      {{ row.ram || '—' }}
                    </td>
                    <td
                      class="px-3 py-2 border border-stroke whitespace-normal break-words align-top"
                      :title="row.videoCard"
                    >
                      {{ row.videoCard || '—' }}
                    </td>
                    <td
                      class="px-3 py-2 border border-stroke whitespace-pre-line break-words align-top"
                      :title="row.monitorAndSerial"
                    >
                      {{ row.monitorAndSerial || '—' }}
                    </td>
                    <td
                      class="px-3 py-2 border border-stroke whitespace-normal break-words align-top"
                      :title="row.propertyNumber"
                    >
                      {{ row.propertyNumber || '—' }}
                    </td>
                    <td
                      class="px-3 py-2 border border-stroke whitespace-pre-line break-words align-top"
                      :title="row.printerOrScanner"
                    >
                      {{ row.printerOrScanner || '—' }}
                    </td>
                    <td
                      class="px-3 py-2 border border-stroke whitespace-normal break-words align-top"
                      :title="row.endUserOrMR"
                    >
                      {{ row.endUserOrMR || '—' }}
                    </td>
                    <td
                      class="px-3 py-2 border border-stroke whitespace-pre-line break-words align-top"
                      :title="row.remarksYears"
                    >
                      {{ row.remarksYears || '—' }}
                    </td>
                    <td class="px-3 py-2 border border-stroke">
                      <div class="text-xs text-gray-500">Edit items individually above</div>
                    </td>
                  </tr>
                  <tr v-if="mergedPreviewRows.length === 0">
                    <td colspan="11" class="px-3 py-4 text-center text-gray-500">
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
            <button class="px-3 py-2 text-sm border border-stroke rounded" @click="saveDraft">
              Save as Draft
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
<style>
@media print {
  body * {
    visibility: hidden;
  }
  #printArea,
  #printArea * {
    visibility: visible;
  }
  #printArea {
    position: absolute;
    left: 0;
    top: 0;
    width: 100%;
    box-shadow: none !important;
    background: white !important;
    max-height: none !important;
    overflow: visible !important;
    padding: 0 !important;
  }
  .no-print,
  .no-print * {
    display: none !important;
  }
  #printArea table {
    width: 100%;
    border-collapse: collapse;
  }
  #printArea th,
  #printArea td {
    border: 1px solid #ddd;
    padding: 6px;
    font-size: 12px;
  }
  #printArea thead {
    display: table-header-group;
  }
}
</style>
