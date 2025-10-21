<script setup>
import { ref, computed, watch, onMounted } from 'vue'
import axios from '../../utils/axios'
import DefaultLayout from '../../layouts/DefaultLayout.vue'
import BreadcrumbDefault from '../../components/Breadcrumbs/BreadcrumbDefault.vue'
import { useAuthStore } from '../../stores/auth'

const pageTitle = ref('Create Inventory Record')
const authStore = useAuthStore()

// Global data
const departments = ref([])
const products = ref([])
const employees = ref([])
const productsLoading = ref(false)
const employeesLoading = ref(false)
const employeesError = ref(null)
const acnOptionsByProduct = ref({})
const serialOptionsByProduct = ref({})

// Wizard steps
const steps = [
  'Create Inventory Record',
  'Add Primary Category and Item',
  'Assign Items and Employees',
  'Add Secondary Items (Optional)',
  'Finalize'
]
const currentStep = ref(1)

// Wizard state
const wizard = ref({
  departmentId: '',
  department: '',
  date: new Date().toISOString().slice(0, 10),
  createdBy: authStore?.user?.name || authStore?.user?.email || '',
  notes: '',
  recordType: 'New Deployment',
  // primaryDeviceType kept for backward compatibility
  primaryDeviceType: 'desktop',
  primaryProductId: '',
  primaryCategory: '',
  quantity: 1,
  // new: split desktop/laptop generation fields
  desktopProductId: '',
  desktopQuantity: 0,
  desktopNotes: '',
  laptopProductId: '',
  laptopQuantity: 0,
  laptopNotes: '',
  cards: []
})

// Derived department name for employee filtering
const selectedDeptName = computed(() => {
  const depId = wizard.value.departmentId
  if (!depId) return String(wizard.value.department || '').trim() || ''
  const dep = departments.value.find((d) => String(d._id) === String(depId))
  return dep?.name || ''
})

// Category derivations
const allCategoryNames = computed(() => {
  const set = new Set(
    products.value.map((p) => String(p?.category?.name || '').trim()).filter(Boolean)
  )
  return Array.from(set).sort()
})
const primaryCategoryOptions = computed(() => allCategoryNames.value)

function productsByCategory(catName) {
  const c = String(catName || '')
    .trim()
    .toLowerCase()
  return products.value.filter(
    (p) =>
      String(p?.category?.name || '')
        .trim()
        .toLowerCase() === c
  )
}

// RIS-style primary product filtering by device type
const primaryProducts = computed(() => {
  const type = String(wizard.value.primaryDeviceType || '').toLowerCase()
  return products.value.filter((p) => {
    const cat = String(p?.category?.name || '').toLowerCase()
    if (type === 'desktop') return cat.includes('desktop') || cat.includes('computer')
    if (type === 'laptop') return cat.includes('laptop')
    return false
  })
})

// Separate lists for Desktop/Laptop generation
const desktopProducts = computed(() =>
  products.value.filter((p) => {
    const cat = String(p?.category?.name || '').toLowerCase()
    return cat.includes('desktop') || cat.includes('computer')
  })
)
const laptopProducts = computed(() =>
  products.value.filter((p) =>
    String(p?.category?.name || '')
      .toLowerCase()
      .includes('laptop')
  )
)

const primaryProductStock = computed(() => {
  const p = products.value.find((p) => String(p._id) === String(wizard.value.primaryProductId))
  return p ? parseInt(p.currentStock) || 0 : 0
})

function getProductName(id) {
  const p = products.value.find((p) => String(p._id) === String(id))
  return p ? p.name : ''
}

// Employees filtered by selected department (active only)
const employeesBySelectedDepartment = computed(() => {
  const dept = selectedDeptName.value.trim().toLowerCase()
  const source = employees.value.filter((e) => e?.isActive !== false)
  const list = !dept
    ? source
    : source.filter(
        (e) =>
          String(e.department || '')
            .trim()
            .toLowerCase() === dept
      )
  return list.map((e) => ({
    id: e._id,
    name: [e.firstName, e.lastName].filter(Boolean).join(' ') || e.name || e.email,
    email: e.email,
    phoneNumber: e.phoneNumber,
    department: e.department || ''
  }))
})

// ACN helpers
async function fetchACNsForProduct(productId) {
  try {
    const { data } = await axios.get(`/acns/product/${productId}`)
    const records = Array.isArray(data?.acns) ? data.acns : []
    const activeCodes = records
      .filter((a) => a?.isActive !== false)
      .map((a) => a?.acnCode)
      .filter(Boolean)
    acnOptionsByProduct.value = {
      ...acnOptionsByProduct.value,
      [productId]: activeCodes
    }
  } catch (err) {
    acnOptionsByProduct.value = { ...acnOptionsByProduct.value, [productId]: [] }
    console.warn('Failed to fetch ACNs for product', productId, err?.message || err)
  }
}

function requiresAcnForProduct(pid) {
  const product = products.value.find((p) => String(p._id) === String(pid))
  if (!product) return false
  if (product.hasAssetControlNumber === true) return true
  return (acnOptionsByProduct.value[pid] || []).length > 0
}

function requiresSerialForProduct(pid) {
  const product = products.value.find((p) => String(p._id) === String(pid))
  return !!product?.hasSerialNumbers
}

async function fetchSerialsForProduct(productId) {
  try {
    const { data } = await axios.get(`/products/${productId}`)
    const serials = Array.isArray(data?.product?.serialNumbers) ? data.product.serialNumbers : []
    serialOptionsByProduct.value = {
      ...serialOptionsByProduct.value,
      [productId]: serials
    }
  } catch (err) {
    serialOptionsByProduct.value = { ...serialOptionsByProduct.value, [productId]: [] }
    console.warn('Failed to fetch serials for product', productId, err?.message || err)
  }
}

function usedSerialNumbers(excludeCardIdx = null) {
  const sns = []
  wizard.value.cards.forEach((c, idx) => {
    if (excludeCardIdx !== null && idx === excludeCardIdx) return
    const sn = String(c.serialNumber || '').trim()
    if (sn) sns.push(sn)
  })
  return new Set(sns)
}
function availableSerialOptions(productId, cardIdx) {
  const list = serialOptionsByProduct.value[productId] || []
  const used = usedSerialNumbers(cardIdx)
  const current = String(wizard.value.cards[cardIdx]?.serialNumber || '')
  return list.filter((sn) => !used.has(String(sn)) || String(sn) === current)
}

// ACN de-duplication across cards and secondaries
function usedAcnCodes(excludeCardIdx = null) {
  const codes = []
  wizard.value.cards.forEach((c, idx) => {
    if (excludeCardIdx !== null && idx === excludeCardIdx) return
    const primary = String(c.acn || '').trim()
    if (primary)
      codes
        .push(primary)(c.secondaries || [])
        .forEach((s) => {
          const sec = String(s.acn || '').trim()
          if (sec) codes.push(sec)
        })
  })
  return new Set(codes)
}
function availableAcnOptions(productId, cardIdx) {
  const list = acnOptionsByProduct.value[productId] || []
  const used = usedAcnCodes(cardIdx)
  const current = String(wizard.value.cards[cardIdx]?.acn || '')
  return list.filter((code) => !used.has(String(code)) || String(code) === current)
}
function availableSecondaryAddOptions(productId, cardIdx) {
  const list = acnOptionsByProduct.value[productId] || []
  const used = usedAcnCodes(cardIdx)
  return list.filter((code) => !used.has(String(code)))
}

// Step 2: generate cards
function generateCards() {
  const qtyRaw = Number(wizard.value.quantity)
  const stock = primaryProductStock.value
  let qty = !qtyRaw || qtyRaw < 1 ? 0 : qtyRaw
  if (!wizard.value.primaryProductId) {
    alert('Select a primary product before generating cards.')
    return
  }
  if (stock > 0 && qty > stock) {
    wizard.value.quantity = stock
    qty = stock
  }
  if (!qty || qty < 1) {
    alert('Enter a valid quantity (>= 1).')
    return
  }
  // Build cards with the selected primary product
  wizard.value.cards = Array.from({ length: qty }).map(() => ({
    employeeId: '',
    productId: wizard.value.primaryProductId,
    acn: '',
    serialNumber: '',
    remarksYears: '',
    secondaries: [],
    _secType: '',
    _secProductId: '',
    _secAcn: '',
    _secRemarks: '',
    _secInlineShow: false,
    _secInline: {
      type: 'monitor',
      productId: '',
      acn: '',
      remarksYears: '',
      duplicateAcrossAll: false
    },
    category: wizard.value.primaryDeviceType
  }))
  // Fetch details and auto-assign ACNs up to qty if available
  const pid = wizard.value.primaryProductId
  fetchACNsForProduct(pid)
  fetchSerialsForProduct(pid)
  const acnList = acnOptionsByProduct.value[pid] || []
  wizard.value.cards.forEach((card, idx) => {
    card.acn = acnList[idx] || ''
  })
}

// Split generation helpers
function generateDesktopCards() {
  const pid = wizard.value.desktopProductId
  const qty = Number(wizard.value.desktopQuantity) || 0
  if (!pid) {
    alert('Select a Desktop product.')
    return
  }
  if (!qty || qty < 1) {
    alert('Enter a valid Desktop quantity (>= 1).')
    return
  }
  fetchACNsForProduct(pid)
  fetchSerialsForProduct(pid)
  const acnList = acnOptionsByProduct.value[pid] || []
  for (let i = 0; i < qty; i++) {
    wizard.value.cards.push({
      employeeId: '',
      productId: pid,
      acn: acnList[i] || '',
      serialNumber: '',
      remarksYears: wizard.value.desktopNotes || '',
      secondaries: [],
      _secType: '',
      _secProductId: '',
      _secAcn: '',
      _secRemarks: '',
      _secInlineShow: false,
      _secInline: {
        type: 'monitor',
        productId: '',
        acn: '',
        remarksYears: '',
        duplicateAcrossAll: false
      },
      category: 'desktop'
    })
  }
}
function generateLaptopCards() {
  const pid = wizard.value.laptopProductId
  const qty = Number(wizard.value.laptopQuantity) || 0
  if (!pid) {
    alert('Select a Laptop product.')
    return
  }
  if (!qty || qty < 1) {
    alert('Enter a valid Laptop quantity (>= 1).')
    return
  }
  fetchACNsForProduct(pid)
  fetchSerialsForProduct(pid)
  const acnList = acnOptionsByProduct.value[pid] || []
  for (let i = 0; i < qty; i++) {
    wizard.value.cards.push({
      employeeId: '',
      productId: pid,
      acn: acnList[i] || '',
      serialNumber: '',
      remarksYears: wizard.value.laptopNotes || '',
      secondaries: [],
      _secType: '',
      _secProductId: '',
      _secAcn: '',
      _secRemarks: '',
      _secInlineShow: false,
      _secInline: {
        type: 'monitor',
        productId: '',
        acn: '',
        remarksYears: '',
        duplicateAcrossAll: false
      },
      category: 'laptop'
    })
  }
}

function onCardProductChange(card) {
  card.acn = ''
  card.serialNumber = ''
  const pid = card.productId
  if (pid) {
    fetchACNsForProduct(pid)
    fetchSerialsForProduct(pid)
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

function onSecondaryProductChange(card) {
  card._secAcn = ''
  const pid = card._secProductId
  if (pid) fetchACNsForProduct(pid)
}

function addSecondary(card) {
  const type = String(card._secType || '').trim()
  const productId = String(card._secProductId || '').trim()
  const acn = String(card._secAcn || '').trim()
  const remarks = String(card._secRemarks || '')
  if (!type) {
    alert('Select a secondary category (Monitor, Printer, Scanner).')
    return
  }
  if (!productId) {
    alert('Select a secondary item.')
    return
  }
  const requires = requiresAcnForProduct(productId)
  if (requires && !acn) {
    alert('Selected secondary item requires ACN.')
    return
  }
  card.secondaries.push({ type, productId, acn, remarksYears: remarks })
  // clear inputs
  card._secType = ''
  card._secProductId = ''
  card._secAcn = ''
  card._secRemarks = ''
}

function removeSecondary(card, idx) {
  card.secondaries.splice(idx, 1)
}

// Finalize mapping
const reviewItems = computed(() => {
  const depName = selectedDeptName.value
  const rows = []
  for (const card of wizard.value.cards) {
    const product = products.value.find((p) => String(p._id) === String(card.productId))
    const employee = employees.value.find((e) => String(e._id) === String(card.employeeId))
    const employeeName = employee
      ? [employee.firstName, employee.lastName].filter(Boolean).join(' ') ||
        employee.name ||
        employee.email
      : ''
    rows.push({
      description: product ? product.name : '',
      product: product ? product._id : undefined,
      serialNumber: card.serialNumber || '',
      acn: card.acn || undefined,
      propertyNumber: card.acn || '',
      printerOrScanner: '',
      endUserOrMR: employeeName,
      employeeId: employee ? employee._id : undefined,
      // Added editable spec fields with defaults for table editing
      processor: 'N/A',
      storage: 'N/A',
      ram: 'N/A',
      videoCard: 'N/A',
      monitorSerial: 'N/A',
      remarksYears: card.remarksYears || '',
      status: 'deployed',
      statusNotes: ''
    })
    for (const sec of card.secondaries || []) {
      const sp = products.value.find((p) => String(p._id) === String(sec.productId))
      rows.push({
        description: sp ? sp.name : '',
        product: sp ? sp._id : undefined,
        serialNumber: '',
        acn: sec.acn || undefined,
        propertyNumber: sec.acn || '',
        printerOrScanner: sec.type === 'printer' || sec.type === 'scanner' ? sec.type : '',
        endUserOrMR: employee ? employeeName : '',
        employeeId: employee ? employee._id : undefined,
        // Added editable spec fields with defaults for table editing
        processor: 'N/A',
        storage: 'N/A',
        ram: 'N/A',
        videoCard: 'N/A',
        monitorSerial: 'N/A',
        remarksYears: sec.remarksYears || '',
        status: 'deployed',
        statusNotes: ''
      })
    }
  }
  return rows
})

function validateBeforeSaveLegacy() {
  // moved to editableItems-based validation below
  return true
}

async function saveRecordLegacy() {
  // legacy function replaced by editableItems-based saveRecord below
  return
}

// Data fetching
async function fetchDepartments() {
  try {
    const { data } = await axios.get('/departments')
    departments.value = data?.departments || data || []
  } catch (err) {
    departments.value = []
    console.warn('Departments fetch failed; fallback to manual entry.')
  }
}
async function fetchProducts() {
  try {
    productsLoading.value = true
    const { data } = await axios.get('/products')
    products.value = data?.products || data || []
  } catch (err) {
    console.error('Failed to load products:', err)
  } finally {
    productsLoading.value = false
  }
}
async function fetchEmployees() {
  try {
    employeesLoading.value = true
    const { data } = await axios.get('/employees')
    employees.value = data?.employees || data || []
    employeesError.value = null
  } catch (err) {
    employees.value = []
    employeesError.value = err?.response?.data?.message || err.message || 'Failed to load employees'
  } finally {
    employeesLoading.value = false
  }
}

onMounted(async () => {
  await Promise.all([fetchDepartments(), fetchProducts(), fetchEmployees()])
})

// Navigation
function nextStep() {
  if (currentStep.value === 2) {
    // require primary category and valid quantity to proceed
    if (!wizard.value.primaryCategory) {
      alert('Please select a primary category.')
      return
    }
    if (!wizard.value.quantity || Number(wizard.value.quantity) < 1) {
      alert('Please enter a valid quantity (>= 1).')
      return
    }
    if (!wizard.value.cards?.length) generateCards()
  }
  if (currentStep.value < steps.length) currentStep.value += 1
}
function prevStep() {
  if (currentStep.value > 1) currentStep.value -= 1
}

const editableItems = ref([])
watch(currentStep, (step) => {
  if (step === 5) {
    editableItems.value = reviewItems.value.map((it) => ({
      ...it
    }))
  }
})
function validateBeforeSave() {
  // basic checks
  const depName = selectedDeptName.value || wizard.value.department
  if (!depName || !wizard.value.date) {
    alert('Please provide department and date.')
    return false
  }
  // per-card requireds
  for (const [idx, card] of wizard.value.cards.entries()) {
    if (!card.employeeId) {
      alert(`Card ${idx + 1}: select employee.`)
      return false
    }
    const employee = employees.value.find((e) => String(e._id) === String(card.employeeId))
    if (employee && employee.isActive === false) {
      alert(`Card ${idx + 1}: selected employee is inactive.`)
      return false
    }
    if (!card.productId) {
      alert(`Card ${idx + 1}: select item.`)
      return false
    }
    if (requiresAcnForProduct(card.productId) && !card.acn) {
      alert(`Card ${idx + 1}: item requires ACN.`)
      return false
    }
    if (requiresSerialForProduct(card.productId) && !card.serialNumber) {
      alert(`Card ${idx + 1}: item requires serial number.`)
      return false
    }
    for (const [sidx, sec] of (card.secondaries || []).entries()) {
      if (!sec.productId) {
        alert(`Card ${idx + 1} secondary ${sidx + 1}: select item.`)
        return false
      }
      if (requiresAcnForProduct(sec.productId) && !sec.acn) {
        alert(`Card ${idx + 1} secondary ${sidx + 1}: item requires ACN.`)
        return false
      }
    }
  }
  // ACN duplicates check
  const acns = editableItems.value
    .map((it) => String(it.propertyNumber || it.acn || ''))
    .filter(Boolean)
  const seen = new Set()
  for (const code of acns) {
    if (seen.has(code)) {
      alert(`Duplicate ACN detected: ${code}`)
      return false
    }
    seen.add(code)
  }
  // Serial duplicates check
  const serials = editableItems.value.map((it) => String(it.serialNumber || '')).filter(Boolean)
  const sset = new Set()
  for (const sn of serials) {
    if (sset.has(sn)) {
      alert(`Duplicate serial number detected: ${sn}`)
      return false
    }
    sset.add(sn)
  }
  return true
}

const isValidPreview = computed(() => {
  const depName =
    typeof selectedDeptName !== 'undefined' && selectedDeptName?.value
      ? selectedDeptName.value
      : wizard.value.department
  if (!depName || !wizard.value.date) return false
  for (const card of wizard.value.cards) {
    if (!card.employeeId || !card.productId) return false
    const acnRequired =
      typeof requiresAcnForProduct === 'function' ? requiresAcnForProduct(card.productId) : false
    const serialRequired =
      typeof requiresSerialForProduct === 'function'
        ? requiresSerialForProduct(card.productId)
        : false
    if (acnRequired && !card.acn) return false
    if (serialRequired && !card.serialNumber) return false
    for (const sec of card.secondaries || []) {
      if (!sec.productId) return false
      const secAcnRequired =
        typeof requiresAcnForProduct === 'function' ? requiresAcnForProduct(sec.productId) : false
      if (secAcnRequired && !sec.acn) return false
    }
  }
  const acns = (editableItems?.value || [])
    .map((it) => String(it.propertyNumber || it.acn || ''))
    .filter(Boolean)
  const seen = new Set()
  for (const code of acns) {
    if (seen.has(code)) return false
    seen.add(code)
  }
  const serials = (editableItems?.value || [])
    .map((it) => String(it.serialNumber || ''))
    .filter(Boolean)
  const sset = new Set()
  for (const sn of serials) {
    if (sset.has(sn)) return false
    sset.add(sn)
  }
  return true
})

async function saveRecord() {
  if (!validateBeforeSave()) return
  try {
    const dep = wizard.value.departmentId
      ? departments.value.find((d) => String(d._id) === String(wizard.value.departmentId))
      : null
    const headerNotes = wizard.value.recordType ? `[Record Type: ${wizard.value.recordType}] ` : ''
    const payload = {
      departmentId: wizard.value.departmentId || undefined,
      department: dep?.name || wizard.value.department,
      notes: `${headerNotes}${wizard.value.notes || ''}`,
      date: wizard.value.date,
      items: editableItems.value.map((it) => ({
        description: it.description || 'N/A',
        product: it.product,
        processor: it.processor || 'N/A',
        storage: it.storage || 'N/A',
        ram: it.ram || 'N/A',
        videoCard: it.videoCard || 'N/A',
        monitorSerial: it.monitorSerial || 'N/A',
        serialNumber: it.serialNumber || undefined,
        acn: it.acn || undefined,
        propertyNumber: it.propertyNumber || 'N/A',
        printerOrScanner: it.printerOrScanner || 'N/A',
        endUserOrMR: it.endUserOrMR || 'N/A',
        employeeId: it.employeeId,
        remarksYears: it.remarksYears || 'N/A',
        status: it.status || 'deployed',
        statusNotes: it.statusNotes || ''
      }))
    }
    await axios.post('/inventory-records', payload)
    alert('Record created successfully')
    wizard.value.cards = []
    currentStep.value = 1
  } catch (err) {
    console.error('Failed to save record:', err)
    alert(err?.response?.data?.message || 'Failed to save record')
  }
}

async function saveDraft() {
  try {
    const dep = wizard.value.departmentId
      ? departments.value.find((d) => String(d._id) === String(wizard.value.departmentId))
      : null
    const headerNotes = wizard.value.recordType ? `[Record Type: ${wizard.value.recordType}] ` : ''
    const payload = {
      departmentId: wizard.value.departmentId || undefined,
      department: dep?.name || wizard.value.department,
      notes: `${headerNotes}${wizard.value.notes || ''}`,
      date: wizard.value.date,
      items: editableItems.value.map((it) => ({
        description: it.description || 'N/A',
        product: it.product,
        processor: it.processor || 'N/A',
        storage: it.storage || 'N/A',
        ram: it.ram || 'N/A',
        videoCard: it.videoCard || 'N/A',
        monitorSerial: it.monitorSerial || 'N/A',
        serialNumber: it.serialNumber || undefined,
        acn: it.acn || undefined,
        propertyNumber: it.propertyNumber || 'N/A',
        printerOrScanner: it.printerOrScanner || 'N/A',
        endUserOrMR: it.endUserOrMR || 'N/A',
        employeeId: it.employeeId,
        remarksYears: it.remarksYears || 'N/A',
        status: it.status || 'deployed',
        statusNotes: it.statusNotes || ''
      }))
    }
    const draft = { payload, savedAt: new Date().toISOString(), author: wizard.value.createdBy }
    localStorage.setItem('imsInventoryRecordDraft', JSON.stringify(draft))
    alert('Draft saved locally. You can submit later.')
  } catch (err) {
    console.error('Failed to save draft:', err)
    alert('Failed to save draft locally')
  }
}

// Data fetching
async function fetchProducts() {
  try {
    productsLoading.value = true
    const { data } = await axios.get('/products')
    products.value = data?.products || data || []
  } catch (err) {
    console.error('Failed to load products:', err)
  } finally {
    productsLoading.value = false
  }
}
async function fetchEmployees() {
  try {
    employeesLoading.value = true
    const { data } = await axios.get('/employees')
    employees.value = data?.employees || data || []
    employeesError.value = null
  } catch (err) {
    employees.value = []
    employeesError.value = err?.response?.data?.message || err.message || 'Failed to load employees'
  } finally {
    employeesLoading.value = false
  }
}

onMounted(async () => {
  await Promise.all([fetchDepartments(), fetchProducts(), fetchEmployees()])
})

// Navigation
function nextStep() {
  if (currentStep.value === 2) {
    // require at least one card generated
    if (!wizard.value.cards?.length) {
      alert('Generate cards for Desktop or Laptop first.')
      return
    }
  }
  if (currentStep.value < steps.length) currentStep.value += 1
}
function prevStep() {
  if (currentStep.value > 1) currentStep.value -= 1
}

function copyPreviousCard(idx) {
  if (idx < 1) return
  const prev = wizard.value.cards[idx - 1]
  const curr = wizard.value.cards[idx]
  wizard.value.cards[idx] = {
    ...curr,
    employeeId: prev.employeeId,
    acn: prev.acn,
    serialNumber: prev.serialNumber,
    remarksYears: prev.remarksYears,
    secondaries: JSON.parse(JSON.stringify(prev.secondaries || []))
  }
}
function toggleSecondaryEditor(card) {
  card._secInlineShow = !card._secInlineShow
}
function addSecondaryInline(card) {
  const s = { ...card._secInline }
  if (!s.type || !s.productId) {
    alert('Select secondary type and item.')
    return
  }
  const requires = requiresAcnForProduct(s.productId)
  if (requires && !String(s.acn || '').trim()) {
    alert('Selected secondary item requires ACN.')
    return
  }
  card.secondaries.push({
    type: s.type,
    productId: s.productId,
    acn: s.acn || '',
    remarksYears: s.remarksYears || ''
  })
  // duplicate across all cards (ACN left empty on others to avoid duplicates)
  if (s.duplicateAcrossAll) {
    wizard.value.cards.forEach((c) => {
      if (c === card) return
      c.secondaries.push({
        type: s.type,
        productId: s.productId,
        acn: '',
        remarksYears: s.remarksYears || ''
      })
    })
  }
  // clear inline editor
  card._secInline = {
    type: 'monitor',
    productId: '',
    acn: '',
    remarksYears: '',
    duplicateAcrossAll: false
  }
  card._secInlineShow = false
}
function prevStep() {
  if (currentStep.value > 1) currentStep.value -= 1
}
</script>

<template>
  <DefaultLayout>
    <div class="mx-auto max-w-8xl">
      <BreadcrumbDefault :pageTitle="pageTitle" />

      <!-- Stepper header -->
      <div class="flex items-center justify-between my-4">
        <div class="flex flex-wrap gap-2">
          <span
            v-for="(s, idx) in steps"
            :key="s"
            class="px-3 py-1 rounded text-sm border"
            :class="
              idx + 1 === currentStep
                ? 'bg-primary text-white border-primary'
                : 'bg-white text-black border-stroke'
            "
          >
            {{ idx + 1 }}. {{ s }}
          </span>
        </div>
        <div class="flex gap-2">
          <button
            class="px-3 py-1 border border-stroke rounded"
            :disabled="currentStep === 1"
            @click="prevStep"
          >
            Back
          </button>
          <button
            v-if="currentStep < steps.length"
            class="px-3 py-1 border border-primary bg-primary text-white rounded"
            @click="nextStep"
          >
            Next
          </button>
        </div>
      </div>

      <!-- Step 1: Create Inventory Record -->
      <div v-if="currentStep === 1" class="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div>
          <label class="block text-sm font-medium mb-1">Record Type</label>
          <select v-model="wizard.recordType" class="w-full rounded border border-stroke p-2">
            <option>New Deployment</option>
            <option>Replacement</option>
            <option>Returned</option>
            <option>Audit</option>
          </select>
        </div>
        <div>
          <label class="block text-sm font-medium mb-1">Date</label>
          <input
            v-model="wizard.date"
            type="date"
            class="w-full rounded border border-stroke p-2"
          />
        </div>
        <div>
          <label class="block text-sm font-medium mb-1">Created By</label>
          <input
            :value="wizard.createdBy"
            type="text"
            class="w-full rounded border border-stroke p-2 bg-gray-50"
            disabled
          />
        </div>
        <div>
          <label class="block text-sm font-medium mb-1">Department</label>
          <div v-if="departments.length" class="relative">
            <select v-model="wizard.departmentId" class="w-full rounded border border-stroke p-2">
              <option value="">Select department</option>
              <option v-for="d in departments" :key="d._id" :value="d._id">{{ d.name }}</option>
            </select>
          </div>
          <div v-else>
            <input
              v-model="wizard.department"
              type="text"
              class="w-full rounded border border-stroke p-2"
              placeholder="Enter department"
            />
            <p class="text-xs text-gray-500 mt-1">Fallback when departments cannot be loaded.</p>
          </div>
        </div>
        <div class="md:col-span-2">
          <label class="block text-sm font-medium mb-1">Notes</label>
          <textarea
            v-model="wizard.notes"
            class="w-full rounded border border-stroke p-2"
            rows="3"
            placeholder="Optional notes for deployment"
          />
        </div>
      </div>

      <!-- Step 2: Primary category and quantity -->
      <div v-if="currentStep === 2" class="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div>
          <label class="block text-sm font-medium mb-1">Device Type</label>
          <select
            v-model="wizard.primaryDeviceType"
            class="w-full rounded border border-stroke p-2"
          >
            <option value="desktop">Desktop</option>
            <option value="laptop">Laptop</option>
          </select>
        </div>
        <div>
          <label class="block text-sm font-medium mb-1">Primary Product</label>
          <select v-model="wizard.primaryProductId" class="w-full rounded border border-stroke p-2">
            <option value="">Select product</option>
            <option v-for="p in primaryProducts" :key="p._id" :value="p._id">
              {{ p.name }}<span v-if="p.currentStock"> (Stock: {{ p.currentStock }})</span>
            </option>
          </select>
        </div>
        <div>
          <label class="block text-sm font-medium mb-1">Quantity</label>
          <input
            v-model.number="wizard.quantity"
            type="number"
            min="1"
            class="w-full rounded border border-stroke p-2"
          />
          <p class="text-xs text-gray-500 mt-1">Stock: {{ primaryProductStock }}</p>
        </div>
        <div class="md:col-span-2">
          <button
            class="px-3 py-1 border border-primary bg-primary text-white rounded"
            @click="generateCards"
          >
            Generate Cards
          </button>
          <p class="text-xs text-gray-500 mt-2">
            System will create cards based on quantity and selected product.
          </p>
        </div>
      </div>

      <!-- Step 3: Assign items and employees -->
      <div v-if="currentStep === 3" class="space-y-6">
        <div v-if="employeesLoading" class="text-sm text-gray-500">Loading employees…</div>
        <div v-else-if="employeesError" class="text-sm text-red-600">{{ employeesError }}</div>
        <div v-for="(card, idx) in wizard.cards" :key="idx" class="border rounded p-4">
          <div class="font-semibold mb-3">Card {{ idx + 1 }}</div>
          <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label class="block text-sm font-medium mb-1">Employee</label>
              <select v-model="card.employeeId" class="w-full rounded border border-stroke p-2">
                <option value="">Select employee</option>
                <option v-for="e in employeesBySelectedDepartment" :key="e.id" :value="e.id">
                  {{ e.name }}
                </option>
              </select>
              <p class="text-xs text-gray-500 mt-1" v-if="!selectedDeptName">
                Tip: choose a department to filter employees.
              </p>
            </div>
            <div>
              <label class="block text-sm font-medium mb-1">Primary Item</label>
              <input
                :value="getProductName(card.productId) || 'No product selected'"
                type="text"
                class="w-full rounded border border-stroke p-2 bg-gray-50"
                disabled
              />
            </div>
            <div>
              <label class="block text-sm font-medium mb-1">Asset Control Number (ACN)</label>
              <select
                v-model="card.acn"
                class="w-full rounded border border-stroke p-2"
                :disabled="!card.productId"
              >
                <option value="">
                  {{ requiresAcnForProduct(card.productId) ? 'Select ACN' : '— Optional —' }}
                </option>
                <option
                  v-for="code in availableAcnOptions(card.productId, idx)"
                  :key="code"
                  :value="code"
                >
                  {{ code }}
                </option>
              </select>
              <p class="text-xs text-gray-500 mt-1">ACN must exist for ACN-tracked items.</p>
            </div>
            <div>
              <label class="block text-sm font-medium mb-1">Serial Number</label>
              <select
                v-if="requiresSerialForProduct(card.productId)"
                v-model="card.serialNumber"
                class="w-full rounded border border-stroke p-2"
                :disabled="!card.productId"
              >
                <option value="">Select serial</option>
                <option
                  v-for="sn in availableSerialOptions(card.productId, idx)"
                  :key="sn"
                  :value="sn"
                >
                  {{ sn }}
                </option>
              </select>
              <input
                v-else
                v-model="card.serialNumber"
                type="text"
                class="w-full rounded border border-stroke p-2"
              />
              <p class="text-xs text-gray-500 mt-1">Serial required for serialized items.</p>
            </div>
            <div>
              <label class="block text-sm font-medium mb-1">Remarks / Years</label>
              <input
                v-model="card.remarksYears"
                type="text"
                class="w-full rounded border border-stroke p-2"
              />
            </div>
          </div>
          <div class="flex gap-2 mt-3">
            <button
              class="px-3 py-1 border border-stroke rounded"
              @click="card._secInlineShow = !card._secInlineShow"
            >
              Add Secondary Item
            </button>
            <button
              class="px-3 py-1 border border-stroke rounded"
              :disabled="idx === 0"
              @click="copyPreviousCard(idx)"
            >
              Copy Previous Card
            </button>
          </div>
          <div v-if="card._secInlineShow" class="mt-3 border rounded p-3 bg-white">
            <div class="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div>
                <label class="block text-sm font-medium mb-1">Secondary Category</label>
                <select
                  v-model="card._secInline.type"
                  class="w-full rounded border border-stroke p-2"
                >
                  <option value="">Select category</option>
                  <option value="monitor">Monitor</option>
                  <option value="printer">Printer</option>
                  <option value="scanner">Scanner</option>
                </select>
              </div>
              <div>
                <label class="block text-sm font-medium mb-1">Secondary Item</label>
                <select
                  v-model="card._secInline.productId"
                  class="w-full rounded border border-stroke p-2"
                  @change="onSecondaryInlineProductChange(card)"
                >
                  <option value="">Select item</option>
                  <option
                    v-for="p in secondaryProductsByType(card._secInline.type)"
                    :key="p._id"
                    :value="p._id"
                  >
                    {{ p.name }}
                  </option>
                </select>
              </div>
              <div>
                <label class="block text-sm font-medium mb-1">ACN</label>
                <select
                  v-model="card._secInline.acn"
                  class="w-full rounded border border-stroke p-2"
                  :disabled="!card._secInline.productId"
                >
                  <option value="">
                    {{
                      requiresAcnForProduct(card._secInline.productId)
                        ? 'Select ACN'
                        : '— Optional —'
                    }}
                  </option>
                  <option
                    v-for="code in availableSecondaryAddOptions(card._secInline.productId, idx)"
                    :key="code"
                    :value="code"
                  >
                    {{ code }}
                  </option>
                </select>
              </div>
              <div>
                <label class="block text-sm font-medium mb-1">Remarks / Years</label>
                <input
                  v-model="card._secInline.remarksYears"
                  type="text"
                  class="w-full rounded border border-stroke p-2"
                />
              </div>
            </div>
            <div class="flex items-center justify-between mt-3">
              <label class="flex items-center gap-2 text-xs">
                <input v-model="card._secInline.duplicateAcrossAll" type="checkbox" />
                Duplicate this Secondary to all other cards
              </label>
              <button
                class="px-3 py-1 border border-primary bg-primary text-white rounded"
                @click="addSecondaryInline(card)"
              >
                Add Secondary Item
              </button>
            </div>
          </div>
        </div>
      </div>

      <!-- Step 4: Secondary items (optional) -->
      <div v-if="currentStep === 4" class="space-y-6">
        <div v-for="(card, idx) in wizard.cards" :key="idx" class="border rounded p-4">
          <div class="font-semibold mb-3">Card {{ idx + 1 }} — Secondary Items</div>
          <div class="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <label class="block text-sm font-medium mb-1">Secondary Category</label>
              <select v-model="card._secType" class="w-full rounded border border-stroke p-2">
                <option value="">Select category</option>
                <option value="monitor">Monitor</option>
                <option value="printer">Printer</option>
                <option value="scanner">Scanner</option>
              </select>
            </div>
            <div>
              <label class="block text-sm font-medium mb-1">Secondary Item</label>
              <select
                v-model="card._secProductId"
                class="w-full rounded border border-stroke p-2"
                @change="onSecondaryProductChange(card)"
              >
                <option value="">Select item</option>
                <option
                  v-for="p in secondaryProductsByType(card._secType)"
                  :key="p._id"
                  :value="p._id"
                >
                  {{ p.name }}
                </option>
              </select>
            </div>
            <div>
              <label class="block text-sm font-medium mb-1">ACN</label>
              <select
                v-model="card._secAcn"
                class="w-full rounded border border-stroke p-2"
                :disabled="!card._secProductId"
              >
                <option value="">
                  {{ requiresAcnForProduct(card._secProductId) ? 'Select ACN' : '— Optional —' }}
                </option>
                <option
                  v-for="code in availableSecondaryAddOptions(card._secProductId, idx)"
                  :key="code"
                  :value="code"
                >
                  {{ code }}
                </option>
              </select>
            </div>
            <div>
              <label class="block text-sm font-medium mb-1">Remarks / Years</label>
              <input
                v-model="card._secRemarks"
                type="text"
                class="w-full rounded border border-stroke p-2"
              />
            </div>
          </div>
          <div class="flex gap-2 mt-3">
            <button
              class="px-3 py-1 border border-primary bg-primary text-white rounded"
              @click="addSecondary(card)"
            >
              Add Secondary
            </button>
          </div>
          <div class="mt-3">
            <div v-if="!card.secondaries.length" class="text-sm text-gray-500">
              No secondary items added.
            </div>
            <ul v-else class="space-y-2">
              <li
                v-for="(sec, sidx) in card.secondaries"
                :key="sidx"
                class="flex items-center justify-between border rounded p-2"
              >
                <div>
                  <span class="font-medium">{{ sec.type }}</span>
                  <span class="ml-2">ACN: {{ sec.acn || '—' }}</span>
                  <span class="ml-2">Remarks: {{ sec.remarksYears || '—' }}</span>
                </div>
                <button
                  class="px-2 py-1 text-xs border border-stroke rounded"
                  @click="removeSecondary(card, sidx)"
                >
                  Remove
                </button>
              </li>
            </ul>
          </div>
        </div>
      </div>

      <!-- Step 5: Finalize -->
      <div v-if="currentStep === 5" class="space-y-4">
        <div class="border rounded">
          <div class="p-3 font-semibold flex items-center gap-3">
            Review & Edit Items
            <span
              class="px-2 py-1 rounded text-xs border"
              :class="
                isValidPreview
                  ? 'bg-green-100 text-green-700 border-green-300'
                  : 'bg-amber-100 text-amber-700 border-amber-300'
              "
            >
              {{ isValidPreview ? 'Status: Validation Pass' : 'Status: Validation Issues' }}
            </span>
          </div>
          <div class="overflow-x-auto">
            <table class="min-w-full text-sm">
              <thead class="bg-gray-100">
                <tr>
                  <th class="px-3 py-2 text-left">Description</th>
                  <th class="px-3 py-2 text-left">Serial No.</th>
                  <th class="px-3 py-2 text-left">Processor</th>
                  <th class="px-3 py-2 text-left">Storage</th>
                  <th class="px-3 py-2 text-left">RAM</th>
                  <th class="px-3 py-2 text-left">Video Card</th>
                  <th class="px-3 py-2 text-left">Brand of Monitor & Serial Number</th>
                  <th class="px-3 py-2 text-left">Property Number</th>
                  <th class="px-3 py-2 text-left">Printer or Scanner</th>
                  <th class="px-3 py-2 text-left">End User or MR</th>
                  <th class="px-3 py-2 text-left">Remarks / Years</th>
                  <th class="px-3 py-2 text-left">Status</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="(it, idx) in editableItems" :key="idx" class="border-t odd:bg-gray-50">
                  <td class="px-3 py-2 truncate" :title="it.description">
                    {{ it.description || '—' }}
                  </td>
                  <td class="px-3 py-2">
                    <input
                      v-model="editableItems[idx].serialNumber"
                      type="text"
                      class="w-full rounded border border-stroke p-1"
                    />
                  </td>
                  <td class="px-3 py-2">
                    <input
                      v-model="editableItems[idx].processor"
                      type="text"
                      class="w-full rounded border border-stroke p-1"
                    />
                  </td>
                  <td class="px-3 py-2">
                    <input
                      v-model="editableItems[idx].storage"
                      type="text"
                      class="w-full rounded border border-stroke p-1"
                    />
                  </td>
                  <td class="px-3 py-2">
                    <input
                      v-model="editableItems[idx].ram"
                      type="text"
                      class="w-full rounded border border-stroke p-1"
                    />
                  </td>
                  <td class="px-3 py-2">
                    <input
                      v-model="editableItems[idx].videoCard"
                      type="text"
                      class="w-full rounded border border-stroke p-1"
                    />
                  </td>
                  <td class="px-3 py-2">
                    <input
                      v-model="editableItems[idx].monitorSerial"
                      type="text"
                      class="w-full rounded border border-stroke p-1"
                      placeholder="Brand & Serial"
                    />
                  </td>
                  <td class="px-3 py-2">
                    <input
                      v-model="editableItems[idx].propertyNumber"
                      type="text"
                      class="w-full rounded border border-stroke p-1"
                    />
                  </td>
                  <td class="px-3 py-2">
                    <input
                      v-model="editableItems[idx].printerOrScanner"
                      type="text"
                      class="w-full rounded border border-stroke p-1"
                      placeholder="printer/scanner"
                    />
                  </td>
                  <td class="px-3 py-2">
                    <input
                      v-model="editableItems[idx].endUserOrMR"
                      type="text"
                      class="w-full rounded border border-stroke p-1"
                    />
                  </td>
                  <td class="px-3 py-2">
                    <input
                      v-model="editableItems[idx].remarksYears"
                      type="text"
                      class="w-full rounded border border-stroke p-1"
                    />
                  </td>
                  <td class="px-3 py-2">
                    <select
                      v-model="editableItems[idx].status"
                      class="w-full rounded border border-stroke p-1"
                    >
                      <option value="deployed">deployed</option>
                      <option value="returned">returned</option>
                      <option value="repair">repair</option>
                      <option value="retired">retired</option>
                    </select>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
        <div class="flex justify-end gap-2">
          <button class="px-3 py-1 border border-stroke rounded" @click="prevStep">Back</button>
          <button class="px-3 py-1 border border-stroke rounded" @click="saveDraft">
            Save as Draft
          </button>
          <button
            class="px-3 py-1 border border-primary bg-primary text-white rounded"
            @click="saveRecord"
          >
            Save Inventory Record
          </button>
        </div>
      </div>
    </div>
  </DefaultLayout>
</template>
