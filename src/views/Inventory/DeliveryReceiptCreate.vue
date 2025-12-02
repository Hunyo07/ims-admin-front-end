<script setup>
import { ref, reactive, computed, onMounted } from 'vue'
import axios from '../../utils/axios'
import { useRouter } from 'vue-router'
import DefaultLayout from '../../layouts/DefaultLayout.vue'
import BaseCombobox from '../../components/Forms/BaseCombobox.vue'
import { useAuthStore } from '../../stores/auth'

const authStore = useAuthStore()
const router = useRouter()
const hasWarrantyState = ref(false)

const form = reactive({
  drNumber: '',
  supplierId: '',
  dateReceived: '',
  purpose: 'stock',
  images: []
})

const ui = reactive({
  imgPreviews: [],
  submitting: false,
  errors: []
})

const suppliers = ref([])
const products = ref([])
const departments = ref([])

const items = ref([
  {
    productId: '',
    qty: 1,
    serialsText: '',
    notes: '',
    departmentId: '',
    endUserId: '',
    warrantyOverrideEnabled: false,
    warranty: {
      hasWarranty: true,
      provider: 'supplier',
      duration: 0,
      startDate: '',
      expiryDate: '',
      terms: '',
      supplierId: ''
    }
  }
])

const users = ref([])
const usersByDepartment = ref({})

// Computed options for comboboxes with enriched labels
const productOptions = computed(() =>
  (products.value || []).map((p) => ({
    ...p,
    label: `${p.name} ${p.hasSerialNumbers ? '(serialized)' : ''} — Stock: ${p.currentStock ?? 0}`
  }))
)

// Deployment-related user options removed per requirements

const isSerializedProduct = (pid) => {
  if (!Array.isArray(products.value) || !pid) return false
  const p = products.value.find((x) => x._id === pid)
  return !!p?.hasSerialNumbers
}

const validateBeforeSubmit = () => {
  if (!form.drNumber || !form.supplierId || !form.dateReceived || form.images.length === 0)
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

const handleFiles = (e) => {
  const files = Array.from(e.target.files || [])
  if (files.length === 0) return

  const validTypes = ['image/jpeg', 'image/png']
  const maxSize = 5 * 1024 * 1024
  const maxFiles = 5

  if (form.images.length + files.length > maxFiles) {
    alert(`Maximum ${maxFiles} images allowed`)
    e.target.value = ''
    return
  }

  for (const file of files) {
    if (!validTypes.includes(file.type)) {
      alert('Please upload PNG or JPEG images only')
      e.target.value = ''
      return
    }
    if (file.size > maxSize) {
      alert('Each image must be under 5MB')
      e.target.value = ''
      return
    }

    form.images.push(file)
    const reader = new FileReader()
    reader.onload = () => {
      ui.imgPreviews.push(String(reader.result || ''))
    }
    reader.readAsDataURL(file)
  }
  e.target.value = ''
}

const removeImage = (idx) => {
  form.images.splice(idx, 1)
  ui.imgPreviews.splice(idx, 1)
}

const setToday = () => {
  form.dateReceived = new Date().toISOString().slice(0, 10)
}

const addRow = () =>
  items.value.push({
    productId: '',
    qty: 1,
    serialsText: '',
    notes: '',
    departmentId: '',
    endUserId: '',
    warrantyOverrideEnabled: false,
    warranty: {
      hasWarranty: true,
      provider: 'supplier',
      duration: 0,
      startDate: '',
      expiryDate: '',
      terms: ''
    }
  })

const duplicateRow = (idx) => {
  const copy = JSON.parse(JSON.stringify(items.value[idx]))
  items.value.splice(idx + 1, 0, { ...copy })
}

const clearAllRows = () => {
  items.value = [
    {
      productId: '',
      qty: 1,
      serialsText: '',
      notes: '',
      departmentId: '',
      endUserId: '',
      warrantyOverrideEnabled: false,
      warranty: {
        hasWarranty: true,
        provider: 'supplier',
        duration: 0,
        startDate: '',
        expiryDate: '',
        terms: ''
      }
    }
  ]
}

const fetchUsersForDepartment = async (departmentId) => {
  if (!departmentId) return []

  // Check if already cached
  if (usersByDepartment.value[departmentId]) {
    return usersByDepartment.value[departmentId]
  }

  try {
    const { data } = await axios.get(
      `/delivery-receipts/deployment/available-users?departmentId=${departmentId}`
    )
    const fetchedUsers = data?.users || []
    usersByDepartment.value[departmentId] = fetchedUsers
    return fetchedUsers
  } catch (err) {
    console.error('❌ Users fetch error:', err)
    return []
  }
}

const onDepartmentChange = async (itemIndex, departmentId) => {
  // Reset end user when department changes
  items.value[itemIndex].endUserId = ''

  // Fetch users for the new department
  if (departmentId) {
    await fetchUsersForDepartment(departmentId)
  }
}

const getUsersForItem = (itemIndex) => {
  const departmentId = items.value[itemIndex]?.departmentId
  if (!departmentId) return []
  return usersByDepartment.value[departmentId] || []
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
  form.images.forEach((img) => fd.append('images', img))

  const itemsPayload = items.value.map((it) => {
    const base = {
      productId: it.productId,
      qty: Number(it.qty),
      notes: it.notes || '',
      serialNumbers: isSerializedProduct(it.productId)
        ? (it.serialsText || '')
            .split(/\r?\n|,/)
            .map((s) => s.trim())
            .filter(Boolean)
        : []
    }
    if (it.warrantyOverrideEnabled) {
      base.warranty = {
        hasWarranty: !!it?.warrantyOverrideEnabled,
        provider: it.warranty?.provider || 'supplier',
        duration: typeof it.warranty?.duration === 'number' ? it.warranty.duration : undefined,
        startDate: it.warranty?.startDate || undefined,
        expiryDate: it.warranty?.expiryDate || undefined,
        terms: it.warranty?.terms || undefined
      }
    }
    return base
  })

  fd.append('items', JSON.stringify(itemsPayload))

  try {
    ui.submitting = true

    // Step 1: Create the DR
    const { data } = await axios.post('/delivery-receipts', fd)
    const drId = data?.deliveryReceipt?._id
    const createdItems = data?.deliveryReceipt?.items || []

    if (!drId) {
      ui.errors.push('Failed to create delivery receipt')
      return
    }

    // Step 2: Update items with department and end user assignments
    const itemUpdates = items.value
      .map((it, index) => {
        const createdItem = createdItems[index]
        if (!createdItem) return null

        return {
          itemId: createdItem._id,
          departmentId: it.departmentId || undefined,
          endUserId: it.endUserId || undefined
        }
      })
      .filter((update) => update && (update.departmentId || update.endUserId))

    if (itemUpdates.length > 0) {
      try {
        await axios.patch(`/delivery-receipts/${drId}/items`, { items: itemUpdates })
      } catch (updateErr) {
        console.error('Failed to update item assignments:', updateErr)
        // Continue anyway - DR was created successfully
      }
    }

    router.push(`/inventory/delivery-receipts/${drId}`)
  } catch (e) {
    ui.errors = [e?.response?.data?.message || 'Failed to create delivery receipt']
  } finally {
    ui.submitting = false
  }
}

const fetchSuppliers = async () => {
  try {
    const response = await axios.get('/suppliers/suppliers')
    const supplierData = response.data?.suppliers || response.data || []
    suppliers.value = Array.isArray(supplierData) ? supplierData.filter((s) => s?.isActive) : []
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
  } catch (err) {
    products.value = []
    console.error('❌ Products fetch error:', err)
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

const handleClickHasWarranty = () => {
  console.log('Checkbox clicked!')
  // You can perform other actions here, like updating data or emitting events
  // If using v-model, the value will automatically update before this handler
}
onMounted(() => {
  fetchSuppliers()
  fetchProducts()
  fetchDepartments()
})
</script>

<template>
  <DefaultLayout>
    <!-- Sticky Header with Purpose Badge -->
    <div
      class="sticky top-0 z-40 bg-white dark:bg-boxdark border-b border-stroke dark:border-strokedark p-4 mb-4 rounded-t-sm shadow-sm"
    >
      <div class="flex items-center justify-between">
        <div class="flex items-center gap-3">
          <h2 class="text-lg font-semibold">New Delivery Receipt</h2>
        </div>
        <div class="flex gap-2">
          <router-link
            to="/inventory/delivery-receipts"
            class="rounded border border-stroke px-4 py-2 text-sm hover:bg-gray-50 dark:hover:bg-meta-4"
          >
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

    <div
      class="rounded-sm border border-stroke bg-white shadow-default dark:border-strokedark dark:bg-boxdark p-4"
    >
      <!-- Error Banner -->
      <div
        v-if="ui.errors.length"
        class="mb-4 p-3 rounded bg-danger/10 text-danger text-sm border border-danger/20"
      >
        <div v-for="(err, i) in ui.errors" :key="i" class="flex items-start gap-2">
          <span class="text-lg">•</span>
          <span>{{ err }}</span>
        </div>
      </div>

      <!-- DR Info Section -->
      <div
        class="mb-6 p-4 rounded-lg bg-gray-50 dark:bg-meta-4 border border-stroke dark:border-strokedark"
      >
        <h3 class="font-semibold mb-3 text-sm">Delivery Receipt Information</h3>
        <p class="text-xs text-bodydark2 mb-4">Enter the DR details and upload proof of delivery</p>

        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label class="block text-sm font-medium mb-1"
              >DR Number<span class="text-danger">*</span></label
            >
            <input
              v-model="form.drNumber"
              class="w-full rounded border border-stroke p-2 dark:border-strokedark dark:bg-form-input"
              placeholder="DR-0001"
            />
            <p class="text-xs text-bodydark2 mt-1">Manual input; must be unique</p>
          </div>

          <div>
            <label class="block text-sm font-medium mb-1"
              >Supplier<span class="text-danger">*</span></label
            >
            <BaseCombobox
              v-model="form.supplierId"
              :options="suppliers"
              labelKey="name"
              valueKey="_id"
              placeholder="Select supplier"
            />
          </div>

          <div>
            <label class="block text-sm font-medium mb-1"
              >Date Received<span class="text-danger">*</span></label
            >
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

          <!-- Purpose free text removed: DRs are stock-only by design -->

          <div class="md:col-span-2">
            <label class="block text-sm font-medium mb-1"
              >DR Images (Proof)<span class="text-danger">*</span></label
            >
            <input
              type="file"
              accept="image/*"
              multiple
              @change="handleFiles"
              class="w-full rounded border border-stroke p-2 dark:border-strokedark dark:bg-form-input"
            />
            <p class="text-xs text-bodydark2 mt-1">
              Upload up to 5 images (PNG or JPEG, max 5MB each)
            </p>
            <div
              v-if="ui.imgPreviews.length > 0"
              class="mt-3 grid grid-cols-2 md:grid-cols-5 gap-3"
            >
              <div v-for="(preview, idx) in ui.imgPreviews" :key="idx" class="relative">
                <img
                  :src="preview"
                  class="h-24 w-full object-cover rounded border border-stroke dark:border-strokedark"
                  :alt="`DR Preview ${idx + 1}`"
                />
                <button
                  @click="removeImage(idx)"
                  class="absolute top-1 right-1 rounded-full bg-danger text-white p-1 text-xs hover:bg-opacity-90"
                >
                  ✕
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Items Section -->
      <div class="mb-6">
        <div class="flex items-center justify-between mb-4">
          <div>
            <h3 class="font-semibold text-sm">Items</h3>
            <p class="text-xs text-bodydark2 mt-1">
              Add items to receive. Serialized products require serial numbers matching the
              quantity.
            </p>
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
          <div
            v-for="(it, idx) in items"
            :key="idx"
            class="border border-stroke dark:border-strokedark rounded-lg p-4 bg-gray-50 dark:bg-meta-4"
          >
            <!-- Item Header -->
            <div
              class="flex items-center justify-between mb-3 pb-3 border-b border-stroke dark:border-strokedark"
            >
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
                <label class="block text-sm font-medium mb-1"
                  >Product<span class="text-danger">*</span></label
                >
                <BaseCombobox
                  v-model="it.productId"
                  :options="productOptions"
                  labelKey="label"
                  valueKey="_id"
                  placeholder="Select product"
                />
              </div>

              <div>
                <label class="block text-sm font-medium mb-1"
                  >Qty<span class="text-danger">*</span></label
                >
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
                  :class="
                    serialCount(it.serialsText) === Number(it.qty) ? 'text-success' : 'text-danger'
                  "
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

            <!-- Warranty Supplier selection inside override (dynamic) -->

            <!-- Warranty Override -->
            <div class="mt-4 pt-3 border-t border-stroke dark:border-strokedark">
              <div class="flex items-center justify-between">
                <div>
                  <label class="font-medium text-sm">Warranty Settings (Per Item)</label>
                  <p class="text-xs text-bodydark2 mt-1">
                    Defaults come from the product. Enable override to set custom warranty.
                  </p>
                </div>
                <label class="flex items-center gap-2 text-sm">
                  <input type="checkbox" v-model="it.warrantyOverrideEnabled" />
                  <span>With warranty</span>
                </label>
              </div>

              <div
                v-if="it.warrantyOverrideEnabled"
                class="grid grid-cols-1 md:grid-cols-3 gap-3 mt-3"
              >
                <!-- Warranty supplier selection removed as per request -->

                <div>
                  <label class="block text-sm font-medium mb-1">Duration (months)</label>
                  <input
                    type="number"
                    min="0"
                    v-model.number="it.warranty.duration"
                    class="w-full rounded border border-stroke p-2 dark:border-strokedark dark:bg-form-input"
                  />
                </div>

                <div>
                  <label class="block text-sm font-medium mb-1">Start Date</label>
                  <input
                    type="date"
                    v-model="it.warranty.startDate"
                    class="w-full rounded border border-stroke p-2 dark:border-strokedark dark:bg-form-input"
                  />
                </div>
              </div>
            </div>
            <!-- Department and End User Assignment -->
            <div
              class="grid grid-cols-1 md:grid-cols-2 gap-3 mt-3 pt-3 border-t border-stroke dark:border-strokedark"
            >
              <div>
                <label class="block text-sm font-medium mb-1">Department (Optional)</label>
                <BaseCombobox
                  v-model="it.departmentId"
                  :options="departments"
                  labelKey="name"
                  valueKey="_id"
                  placeholder="Select department"
                  @update:modelValue="onDepartmentChange(idx, $event)"
                />
                <p class="text-xs text-bodydark2 mt-1">Assign to a specific department</p>
              </div>

              <div>
                <label class="block text-sm font-medium mb-1">End User (Optional)</label>
                <BaseCombobox
                  v-model="it.endUserId"
                  :options="
                    getUsersForItem(idx).map((u) => ({
                      ...u,
                      label: `${u.firstName} ${u.lastName}`
                    }))
                  "
                  labelKey="label"
                  valueKey="_id"
                  placeholder="Select end user"
                  :disabled="!it.departmentId"
                />
                <p class="text-xs text-bodydark2 mt-1">
                  {{ it.departmentId ? 'Assign to a specific user' : 'Select department first' }}
                </p>
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
