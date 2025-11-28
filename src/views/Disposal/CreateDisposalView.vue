<script setup>
import { ref, onMounted, computed } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import axios from '@/utils/axios'
import DefaultLayout from '@/layouts/DefaultLayout.vue'
import BreadcrumbDefault from '@/components/Breadcrumbs/BreadcrumbDefault.vue'
import BaseCombobox from '@/components/Forms/BaseCombobox.vue'
import EmployeeCombobox from '@/components/EmployeeCombobox.vue'
import AcnCombobox from '@/components/AcnCombobox.vue'

const router = useRouter()
const route = useRoute()

// Item context (optional ACN/Serial association)
const inventoryRecordId = ref('')
const itemId = ref('')
const acn = ref('')
const serialNumber = ref('')

// First field: Item combobox (select product or type manually)
const products = ref([])
const selectedProductId = ref('')
const description = ref('')
const productOptions = computed(() => (products.value || []).map((p) => ({ ...p, label: p.name })))

// Required fields
const departments = ref([])
const department = ref('')
const endUser = ref('')
const endUserId = ref('')

// Keep reason and remarks
const reason = ref('damaged_beyond_repair')
const remarks = ref('')

// UI state
const loading = ref(false)
const error = ref(null)

// Fetch options
const fetchProducts = async () => {
  try {
    const { data } = await axios.get('/products')
    const list = data?.products || data || []
    products.value = Array.isArray(list) ? list : []
  } catch (_) {
    products.value = []
  }
}
const fetchDepartments = async () => {
  try {
    const { data } = await axios.get('/departments')
    const list = data?.departments || data || []
    departments.value = Array.isArray(list) ? list : []
  } catch (_) {
    departments.value = []
  }
}

// Prefill from query when coming from logs list
const prefillFromQuery = async () => {
  const q = route.query || {}
  const qInv = String(q.inventoryRecordId || '')
  const qItem = String(q.itemId || '')
  const qAcn = String(q.acn || '')
  const qSerial = String(q.serialNumber || '')
  const qDesc = String(q.description || '')

  if (qInv) inventoryRecordId.value = qInv
  if (qItem) itemId.value = qItem
  if (qAcn) acn.value = qAcn
  if (qSerial) serialNumber.value = qSerial
  if (qDesc) description.value = qDesc
}

// When selecting ACN via combobox, prefill linked details
const onAcnSelect = (payload) => {
  try {
    acn.value = payload?.acn || ''
    const sec = payload?.item?._selectedSecondary || null
    const serial = sec?.serialNumber || payload?.item?.serialNumber || ''
    const pname = payload?.item?.productName || payload?.product?.name || ''
    const descr = payload?.item?.description || ''
    serialNumber.value = serial || serialNumber.value || ''
    description.value = descr || pname || description.value || ''
    inventoryRecordId.value = payload?.record?._id || inventoryRecordId.value || ''
    itemId.value = payload?.item?._id || itemId.value || ''
    const deptName =
      (payload?.record?.department && payload.record.department.name) ||
      payload?.record?.department ||
      ''
    if (deptName) department.value = deptName
    const eu = payload?.item?.endUserOrMR || ''
    if (eu) endUser.value = eu
  } catch (_) {
    void 0
  }
}

// When selecting product, set description
const onProductChange = (pid) => {
  const p = (products.value || []).find((x) => String(x._id) === String(pid))
  selectedProductId.value = pid || ''
  description.value = p?.name || description.value || ''
}

// Submit: create maintenance log with status for_disposal (goes to pending table)
const submitForDisposal = async () => {
  // Validation per requirements
  const desc = String(description.value || '').trim()
  const dept = String(department.value || '').trim()
  const eu = String(endUser.value || '').trim()
  const rsn = String(reason.value || '').trim()
  if (!desc || !dept || !eu || !rsn) {
    error.value = 'Please provide item, department, end user, and reason.'
    return
  }
  loading.value = true
  error.value = null
  try {
    const payload = {
      acn: acn.value || undefined,
      serialNumber: serialNumber.value || undefined,
      description: desc,
      productName: desc,
      status: 'for_disposal',
      purpose: 'Disposal',
      department: department.value || undefined,
      broughtBy: { name: eu, employee: endUserId.value || undefined, department: department.value || undefined },
      remarks:
        desc || remarks.value || (rsn === 'damaged_beyond_repair' ? 'DEFECTIVE' : rsn)
    }
    payload.inventoryRecordId = inventoryRecordId.value || undefined
    payload.itemId = itemId.value || undefined
    const { data } = await axios.post('/maintenance/logs', payload)
    if (!data?.success) throw new Error(data?.message || 'Failed to create for-disposal log')
    router.push({ name: 'disposal-list' })
  } catch (e) {
    error.value = e?.response?.data?.message || e.message || String(e)
  } finally {
    loading.value = false
  }
}

onMounted(async () => {
  await Promise.all([fetchProducts(), fetchDepartments()])
  await prefillFromQuery()
})
</script>

<template>
  <DefaultLayout>
    <BreadcrumbDefault pageTitle="Create For Disposal" />
    <div class="p-6">
      <div class="bg-white rounded shadow p-6">
        <div v-if="error" class="bg-red-100 text-red-700 p-3 rounded mb-4">{{ error }}</div>

        <form @submit.prevent="submitForDisposal">
          <div class="grid grid-cols-2 gap-4 mb-4">
            <div class="col-span-2">
              <label class="block mb-2">Item</label>
              <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <BaseCombobox
                    v-model="selectedProductId"
                    :options="productOptions"
                    labelKey="label"
                    valueKey="_id"
                    placeholder="Select item (optional)"
                    @change="onProductChange"
                  />
                </div>
                <div>
                  <input
                    v-model="description"
                    type="text"
                    class="w-full border border-stroke rounded px-3 py-2 bg-white"
                    placeholder="Or type description"
                  />
                </div>
              </div>
            </div>

            <div>
              <label class="block mb-2">ACN (Optional)</label>
              <AcnCombobox v-model="acn" placeholder="Type or search ACN" @select="onAcnSelect" />
            </div>
            <div>
              <label class="block mb-2">Serial Number (Optional)</label>
              <input
                v-model="serialNumber"
                type="text"
                class="w-full border border-stroke rounded px-3 py-2 bg-white"
              />
            </div>

            <div>
              <label class="block mb-2">Department <span class="text-red-500">*</span></label>
              <BaseCombobox
                v-model="department"
                :options="departments"
                labelKey="name"
                valueKey="name"
                placeholder="Select department"
              />
            </div>
            <div>
              <label class="block mb-2">End User <span class="text-red-500">*</span></label>
              <EmployeeCombobox
                v-model="endUser"
                :department="department"
                :disabled="!department"
                :limit="1000"
                placeholder="Search employee"
                @select="(e) => {
                  endUserId.value = e?._id || ''
                  department.value = e?.department || department.value || ''
                }"
              />
              <div v-if="!department" class="text-xs text-bodydark2 mt-1">Select department first</div>
            </div>

            <div>
              <label class="block mb-2">Reason <span class="text-red-500">*</span></label>
              <select
                v-model="reason"
                required
                class="w-full border-stroke border rounded px-3 py-2"
              >
                <option value="damaged_beyond_repair">Damaged Beyond Repair</option>
                <option value="unserviceable">Unserviceable</option>
                <option value="obsolete">Obsolete</option>
                <option value="lost">Lost</option>
                <option value="stolen">Stolen</option>
                <option value="other">Other</option>
              </select>
            </div>
            <div>
              <label class="block mb-2">Remarks</label>
              <input
                v-model="remarks"
                type="text"
                class="w-full border border-stroke rounded px-3 py-2 bg-white"
                placeholder="e.g., DEFECTIVE"
              />
            </div>
          </div>

          <div class="flex gap-2">
            <button
              type="submit"
              :disabled="loading"
              class="bg-primary text-white px-6 py-2 rounded"
            >
              {{ loading ? 'Creating...' : 'Create For Disposal' }}
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
