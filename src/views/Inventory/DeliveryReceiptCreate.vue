<script setup>
import { ref, reactive, computed, onMounted } from 'vue'
import axios from '../../utils/axios'
import { useRouter } from 'vue-router'
import DefaultLayout from '../../layouts/DefaultLayout.vue'
import BaseCombobox from '../../components/Forms/BaseCombobox.vue'
import { useAuthStore } from '../../stores/auth'

const authStore = useAuthStore()
const router = useRouter()

const form = reactive({
  drNumber: '',
  supplierId: '',
  dateReceived: '',
  purpose: 'stock',
  image: null
})

const ui = reactive({
  imgPreview: '',
  submitting: false,
  errors: []
})

const suppliers = ref([])
const products = ref([])
const users = ref([])
const departments = ref([])

const items = ref([{ productId: '', qty: 1, serialsText: '', notes: '' }])

// Computed options for comboboxes with enriched labels
const productOptions = computed(() =>
  (products.value || []).map((p) => ({
    ...p,
    label: `${p.name} ${p.hasSerialNumbers ? '(serialized)' : ''} — Stock: ${p.currentStock ?? 0}`,
  }))
)

const userOptions = computed(() =>
  (users.value || []).map((u) => ({
    ...u,
    label: `${u.firstName || ''} ${u.lastName || ''}${u.email ? ` (${u.email})` : ''}`.trim(),
  }))
)

const isSerializedProduct = (pid) => {
  if (!Array.isArray(products.value) || !pid) return false
  const p = products.value.find((x) => x._id === pid)
  return !!p?.hasSerialNumbers
}

const validateBeforeSubmit = () => {
  if (!form.drNumber || !form.supplierId || !form.dateReceived || !form.purpose || !form.image)
    return false
  for (const it of items.value) {
    if (!it.productId || !it.qty || Number(it.qty) < 1) return false
    if (isSerializedProduct(it.productId)) {
      const count = (it.serialsText || '')
        .split(/\r?\n|,/)
        .map((s) => s.trim())
        .filter(Boolean).length
      if (count !== Number(it.qty)) return false
    }
  }
  return true
}

const handleFile = (e) => {
  const t = e.target
  const f = (t.files && t.files[0]) || null
  if (!f) {
    form.image = null
    ui.imgPreview = ''
    return
  }
  const validTypes = ['image/jpeg', 'image/png']
  const maxSize = 5 * 1024 * 1024
  if (!validTypes.includes(f.type)) {
    alert('Please upload PNG or JPEG image only')
    t.value = ''
    return
  }
  if (f.size > maxSize) {
    alert('Image must be under 5MB')
    t.value = ''
    return
  }
  form.image = f
  const reader = new FileReader()
  reader.onload = () => {
    ui.imgPreview = String(reader.result || '')
  }
  reader.readAsDataURL(f)
}

const removeImage = () => {
  form.image = null
  ui.imgPreview = ''
}

const setToday = () => {
  form.dateReceived = new Date().toISOString().slice(0, 10)
}

const addRow = () => items.value.push({ productId: '', qty: 1, serialsText: '', notes: '' })

const duplicateRow = (idx) => {
  const copy = JSON.parse(JSON.stringify(items.value[idx]))
  items.value.splice(idx + 1, 0, { ...copy })
}

const clearAllRows = () => {
  items.value = [{ productId: '', qty: 1, serialsText: '', notes: '' }]
}

const removeRow = (idx) => items.value.splice(idx, 1)

const serialCount = (txt) =>
  (txt || '')
    .split(/\r?\n|,/)
    .map((s) => s.trim())
    .filter(Boolean).length

const submit = async () => {
  ui.errors = []
  if (!validateBeforeSubmit()) {
    ui.errors.push('Please fill all required fields. Check serial counts for serialized products.')
    return
  }
  const fd = new FormData()
  fd.append('drNumber', form.drNumber)
  fd.append('supplierId', form.supplierId)
  fd.append('dateReceived', form.dateReceived)
  fd.append('purpose', form.purpose)
  if (form.image) fd.append('image', form.image)

  const itemsPayload = items.value.map((it) => ({
    productId: it.productId,
    qty: Number(it.qty),
    notes: it.notes || '',
    serialNumbers: isSerializedProduct(it.productId)
      ? (it.serialsText || '')
          .split(/\r?\n|,/)
          .map((s) => s.trim())
          .filter(Boolean)
      : [],
    endUserId: form.purpose === 'deployment' ? it.endUserId || '' : undefined,
    departmentId: form.purpose === 'deployment' ? it.departmentId || '' : undefined,
    deploymentStatus: form.purpose === 'deployment' ? it.deploymentStatus || 'pending' : undefined
  }))

  fd.append('items', JSON.stringify(itemsPayload))

  try {
    ui.submitting = true
    const { data } = await axios.post('/delivery-receipts', fd)
    const id = data?.deliveryReceipt?._id
    if (id) router.push(`/inventory/delivery-receipts/${id}`)
    else router.push('/inventory/delivery-receipts')
  } catch (e) {
    ui.errors = [e?.response?.data?.message || 'Failed to create delivery receipt']
  } finally {
    ui.submitting = false
  }
}

const fetchSuppliers = async () => {
  try {
    console.log('🚀 Fetching suppliers...')
    const response = await axios.get('/suppliers/suppliers')
    console.log('📦 Raw response:', response)
    const supplierData = response.data?.suppliers || response.data || []
    console.log('📋 Supplier data:', supplierData)
    suppliers.value = Array.isArray(supplierData)
      ? supplierData.filter((s) => s?.isActive)
      : []
    console.log('🔍 Suppliers loaded:', suppliers.value.length, suppliers.value)
  } catch (err) {
    suppliers.value = []
    console.error('❌ Suppliers fetch error:', err)
    console.error('❌ Error response:', err.response)
  }
}

const fetchProducts = async () => {
  try {
    const { data } = await axios.get('/products')
    const productData = data?.products || data || []
    products.value = Array.isArray(productData) ? productData : []
    console.log('🔍 Products loaded:', products.value.length, products.value)
  } catch (err) {
    products.value = []
    console.error('❌ Products fetch error:', err)
  }
}

const fetchUsers = async () => {
  try {
    const { data } = await axios.get('/employees')
    const userData = data?.employees || data || []
    users.value = Array.isArray(userData) ? userData : []
    console.log('🔍 Users loaded:', users.value.length, users.value)
  } catch (err) {
    users.value = []
    console.error('❌ Users fetch error:', err)
  }
}

const fetchDepartments = async () => {
  try {
    const { data } = await axios.get('/departments')
    const deptData = data?.departments || data || []
    departments.value = Array.isArray(deptData) ? deptData : []
    console.log('🔍 Departments loaded:', departments.value.length, departments.value)
  } catch (err) {
    departments.value = []
    console.error('❌ Departments fetch error:', err)
  }
}

onMounted(() => {
  fetchSuppliers()
  fetchProducts()
  fetchUsers()
  fetchDepartments()
})
</script>

<template>
  <DefaultLayout>
    <!-- Sticky Header with Purpose Badge -->
    <div class="sticky top-0 z-40 bg-white dark:bg-boxdark border-b border-stroke dark:border-strokedark p-4 mb-4 rounded-t-sm shadow-sm">
      <div class="flex items-center justify-between">
        <div class="flex items-center gap-3">
          <h2 class="text-lg font-semibold">New Delivery Receipt</h2>
          <span :class="`px-3 py-1 rounded text-xs font-medium ${form.purpose === 'stock' ? 'bg-success/10 text-success' : 'bg-warning/10 text-warning'}`">
            {{ form.purpose === 'stock' ? 'For Stocks' : 'For Deployment' }}
          </span>
        </div>
        <div class="flex gap-2">
          <router-link to="/inventory/delivery-receipts" class="rounded border border-stroke px-4 py-2 text-sm hover:bg-gray-50 dark:hover:bg-meta-4">
            Back
          </router-link>
          <button
            class="rounded bg-primary text-white px-4 py-2 text-sm disabled:opacity-50 disabled:cursor-not-allowed"
            :disabled="ui.submitting || !validateBeforeSubmit()"
            @click="submit"
          >
            {{ ui.submitting ? 'Submitting...' : 'Create DR' }}
          </button>
        </div>
      </div>
    </div>

    <div class="rounded-sm border border-stroke bg-white shadow-default dark:border-strokedark dark:bg-boxdark p-4">
      <!-- Error Banner -->
      <div v-if="ui.errors.length" class="mb-4 p-3 rounded bg-danger/10 text-danger text-sm border border-danger/20">
        <div v-for="(err, i) in ui.errors" :key="i" class="flex items-start gap-2">
          <span class="text-lg">•</span>
          <span>{{ err }}</span>
        </div>
      </div>

      <!-- DR Info Section -->
      <div class="mb-6 p-4 rounded-lg bg-gray-50 dark:bg-meta-4 border border-stroke dark:border-strokedark">
        <h3 class="font-semibold mb-3 text-sm">Delivery Receipt Information</h3>
        <p class="text-xs text-bodydark2 mb-4">Enter the DR details and upload proof of delivery</p>
        
        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label class="block text-sm font-medium mb-1">DR Number<span class="text-danger">*</span></label>
            <input 
              v-model="form.drNumber" 
              class="w-full rounded border border-stroke p-2 dark:border-strokedark dark:bg-form-input" 
              placeholder="DR-0001"
            />
            <p class="text-xs text-bodydark2 mt-1">Manual input; must be unique</p>
          </div>
          
          <div>
            <label class="block text-sm font-medium mb-1">Supplier<span class="text-danger">*</span></label>
            <BaseCombobox
              v-model="form.supplierId"
              :options="suppliers"
              labelKey="name"
              valueKey="_id"
              placeholder="Select supplier"
            />
          </div>
          
          <div>
            <label class="block text-sm font-medium mb-1">Date Received<span class="text-danger">*</span></label>
            <div class="flex gap-2">
              <input 
                type="date" 
                v-model="form.dateReceived" 
                class="flex-1 rounded border border-stroke p-2 dark:border-strokedark dark:bg-form-input"
              />
              <button 
                @click="setToday"
                class="rounded border border-stroke px-3 py-2 text-sm hover:bg-gray-50 dark:hover:bg-meta-4 dark:border-strokedark"
              >
                Today
              </button>
            </div>
          </div>
          
          <div>
            <label class="block text-sm font-medium mb-1">Purpose<span class="text-danger">*</span></label>
            <select v-model="form.purpose" class="w-full rounded border border-stroke p-2 dark:border-strokedark dark:bg-form-input">
              <option value="stock">For Stocks</option>
              <option value="deployment">For Deployment</option>
            </select>
          </div>
          
          <div class="md:col-span-2">
            <label class="block text-sm font-medium mb-1">DR Image (Proof)<span class="text-danger">*</span></label>
            <input
              type="file"
              accept="image/*"
              @change="handleFile"
              class="w-full rounded border border-stroke p-2 dark:border-strokedark dark:bg-form-input"
            />
            <div v-if="ui.imgPreview" class="mt-3 flex items-end gap-3">
              <div>
                <img :src="ui.imgPreview" class="h-24 rounded border border-stroke dark:border-strokedark" alt="DR Preview" />
              </div>
              <button 
                @click="removeImage"
                class="rounded border border-danger px-3 py-2 text-sm text-danger hover:bg-danger/10"
              >
                Remove
              </button>
            </div>
          </div>
        </div>
      </div>

      <!-- Items Section -->
      <div class="mb-6">
        <div class="flex items-center justify-between mb-4">
          <div>
            <h3 class="font-semibold text-sm">Items</h3>
            <p class="text-xs text-bodydark2 mt-1">Add items to receive. Serialized products require serial numbers matching the quantity.</p>
          </div>
          <div class="flex gap-2">
            <button 
              @click="clearAllRows"
              class="rounded border border-stroke px-3 py-1 text-sm hover:bg-gray-50 dark:hover:bg-meta-4 dark:border-strokedark"
            >
              Remove All
            </button>
            <button 
              @click="addRow"
              class="rounded bg-primary text-white px-3 py-1 text-sm hover:bg-opacity-90"
            >
              Add Item
            </button>
          </div>
        </div>

        <div class="space-y-3">
          <div v-for="(it, idx) in items" :key="idx" class="border border-stroke dark:border-strokedark rounded-lg p-4 bg-gray-50 dark:bg-meta-4">
            <!-- Item Header -->
            <div class="flex items-center justify-between mb-3 pb-3 border-b border-stroke dark:border-strokedark">
              <h4 class="font-medium text-sm">Item #{{ idx + 1 }}</h4>
              <div class="flex gap-2">
                <button 
                  @click="duplicateRow(idx)"
                  class="rounded border border-stroke px-2 py-1 text-xs hover:bg-white dark:hover:bg-boxdark dark:border-strokedark"
                >
                  Duplicate
                </button>
                <button 
                  @click="removeRow(idx)"
                  class="rounded border border-danger px-2 py-1 text-xs text-danger hover:bg-danger/10"
                >
                  Remove
                </button>
              </div>
            </div>

            <!-- Item Fields -->
            <div class="grid grid-cols-1 md:grid-cols-6 gap-3 items-end">
              <div class="md:col-span-2">
                <label class="block text-sm font-medium mb-1">Product<span class="text-danger">*</span></label>
                <BaseCombobox
                  v-model="it.productId"
                  :options="productOptions"
                  labelKey="label"
                  valueKey="_id"
                  placeholder="Select product"
                />
              </div>
              
              <div>
                <label class="block text-sm font-medium mb-1">Qty<span class="text-danger">*</span></label>
                <input 
                  type="number" 
                  min="1" 
                  v-model="it.qty" 
                  class="w-full rounded border border-stroke p-2 dark:border-strokedark dark:bg-form-input"
                />
              </div>
              
              <div class="md:col-span-3" v-if="isSerializedProduct(it.productId)">
                <label class="block text-sm font-medium mb-1">Serial Numbers</label>
                <textarea
                  v-model="it.serialsText"
                  class="w-full rounded border border-stroke p-2 text-xs dark:border-strokedark dark:bg-form-input"
                  placeholder="One per line or comma-separated"
                  rows="2"
                ></textarea>
                <div
                  class="text-xs mt-1 font-medium"
                  :class="serialCount(it.serialsText) === Number(it.qty) ? 'text-success' : 'text-danger'"
                >
                  ✓ Serials: {{ serialCount(it.serialsText) }} of {{ Number(it.qty) }}
                </div>
              </div>
              
              <div class="md:col-span-3" v-else>
                <label class="block text-sm font-medium mb-1">Notes</label>
                <input 
                  v-model="it.notes" 
                  class="w-full rounded border border-stroke p-2 dark:border-strokedark dark:bg-form-input"
                  placeholder="Optional notes"
                />
              </div>
            </div>

            <!-- Deployment Fields (conditional) -->
            <div v-if="form.purpose === 'deployment'" class="grid grid-cols-1 md:grid-cols-3 gap-3 mt-4 pt-4 border-t border-stroke dark:border-strokedark">
              <div>
                <label class="block text-sm font-medium mb-1">End User (optional)</label>
                <BaseCombobox
                  v-model="it.endUserId"
                  :options="userOptions"
                  labelKey="label"
                  valueKey="_id"
                  placeholder="Select end user"
                />
              </div>
              
              <div>
                <label class="block text-sm font-medium mb-1">Department (optional)</label>
                <BaseCombobox
                  v-model="it.departmentId"
                  :options="departments"
                  labelKey="name"
                  valueKey="_id"
                  placeholder="Select department"
                />
              </div>
              
              <div>
                <label class="block text-sm font-medium mb-1">Deployment Status</label>
                <select 
                  v-model="it.deploymentStatus" 
                  class="w-full rounded border border-stroke p-2 dark:border-strokedark dark:bg-form-input"
                >
                  <option value="pending">Pending</option>
                  <option value="deployed">Deployed</option>
                  <option value="cancelled">Cancelled</option>
                </select>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Footer Actions -->
      <div class="flex justify-end gap-3 pt-4 border-t border-stroke dark:border-strokedark">
        <router-link 
          to="/inventory/delivery-receipts" 
          class="rounded border border-stroke px-4 py-2 text-sm hover:bg-gray-50 dark:hover:bg-meta-4 dark:border-strokedark"
        >
          Cancel
        </router-link>
        <button
          class="rounded bg-primary text-white px-4 py-2 text-sm disabled:opacity-50 disabled:cursor-not-allowed hover:bg-opacity-90"
          :disabled="ui.submitting || !validateBeforeSubmit()"
          @click="submit"
        >
          {{ ui.submitting ? 'Submitting...' : 'Create DR' }}
        </button>
      </div>
    </div>
  </DefaultLayout>
</template>
