<script setup>
import { ref, onMounted, watch } from 'vue'
import { useRouter } from 'vue-router'
import axios from '@/utils/axios'
import DefaultLayout from '@/layouts/DefaultLayout.vue'
import BreadcrumbDefault from '@/components/Breadcrumbs/BreadcrumbDefault.vue'
import EmployeeCombobox from '@/components/EmployeeCombobox.vue'

const router = useRouter()
const mrHolder = ref('')
const endUser = ref('')
const endUserDepartment = ref('')
const notes = ref('')
const items = ref([])
const inventoryRecords = ref([])
const loading = ref(false)
const error = ref(null)
const departments = ref([])
const deptError = ref(null)

// Inventory record filters
const invFilters = ref({
  department: '',
  acn: '',
  serialNumber: '',
  startDate: '',
  endDate: '',
  status: ''
})

const fetchInventoryRecords = async () => {
  try {
    const params = {
      department: invFilters.value.department || undefined,
      acn: invFilters.value.acn || undefined,
      serialNumber: invFilters.value.serialNumber || undefined,
      startDate: invFilters.value.startDate || undefined,
      endDate: invFilters.value.endDate || undefined,
      status: invFilters.value.status || undefined
    }
    const { data } = await axios.get('/inventory-records', { params })
    inventoryRecords.value = data.records
  } catch (err) {
    console.error('Error fetching inventory records:', err)
  }
}

const fetchDepartments = async () => {
  try {
    const { data } = await axios.get('/departments')
    departments.value = data?.departments || data || []
  } catch (err) {
    deptError.value = err.response?.data?.message || err.message
  }
}

const applyInventoryFilters = async () => {
  await fetchInventoryRecords()
}

const addItem = () => {
  items.value.push({
    inventoryRecordId: '',
    itemId: '',
    description: '',
    acn: '',
    propertyNumber: '',
    serialNumber: ''
  })
}

const removeItem = (index) => items.value.splice(index, 1)

const onRecordSelect = (index) => {
  const item = items.value[index]
  const record = inventoryRecords.value.find((r) => r._id === item.inventoryRecordId)
  if (record && record.items?.length) {
    const recordItem = record.items[0]
    item.itemId = recordItem._id
    item.description = recordItem.description || ''
    item.acn = recordItem.acn || ''
    item.propertyNumber = recordItem.propertyNumber || ''
    item.serialNumber = recordItem.serialNumber || ''
  } else {
    item.itemId = ''
    item.description = ''
    item.acn = ''
    item.propertyNumber = ''
    item.serialNumber = ''
  }
}

const onItemSelect = (index) => {
  const item = items.value[index]
  const record = inventoryRecords.value.find((r) => r._id === item.inventoryRecordId)
  if (!record) return
  const recordItem = record.items?.find((i) => i._id === item.itemId)
  if (recordItem) {
    item.description = recordItem.description || ''
    item.acn = recordItem.acn || ''
    item.propertyNumber = recordItem.propertyNumber || ''
    item.serialNumber = recordItem.serialNumber || ''
  }
}

const submitMR = async () => {
  if (!mrHolder.value || !endUser.value || !items.value.length) {
    error.value = 'Please fill all required fields'
    return
  }
  loading.value = true
  error.value = null
  try {
    const { data } = await axios.post('/mr', {
      mrHolder: mrHolder.value,
      endUser: endUser.value,
      endUserDepartment: endUserDepartment.value,
      items: items.value,
      notes: notes.value
    })
    router.push({ name: 'mr-detail', params: { id: data.mr._id } })
  } catch (err) {
    error.value = err.response?.data?.message || err.message
  } finally {
    loading.value = false
  }
}

onMounted(() => {
  fetchDepartments()
  fetchInventoryRecords()
  addItem()
})
</script>

<template>
  <DefaultLayout>
    <BreadcrumbDefault pageTitle="Create Memorandum Receipt" />
    <div class="p-6">
      <div class="bg-white rounded shadow p-6">
        <div v-if="error" class="bg-red-100 text-red-700 p-3 rounded mb-4">{{ error }}</div>

        <form @submit.prevent="submitMR">
          <div class="grid grid-cols-2 gap-4 mb-4">
            <div>
              <label class="block mb-2">MR Holder <span class="text-red-500">*</span></label>
              <EmployeeCombobox v-model="mrHolder" :department="endUserDepartment" placeholder="Search employee" />
            </div>
            <div>
              <label class="block mb-2">End User <span class="text-red-500">*</span></label>
              <EmployeeCombobox v-model="endUser" :department="endUserDepartment" placeholder="Search employee" />
            </div>
            <div>
              <label class="block mb-2">Department</label>
              <template v-if="departments.length && !deptError">
                <select
                  v-model="endUserDepartment"
                  class="w-full border border-stroke rounded px-3 py-2 bg-gray-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-gray-200 focus:border-gray-300"
                >
                  <option value="">Select Department</option>
                  <option v-for="dept in departments" :key="dept._id" :value="dept.name">
                    {{ dept.name }}
                  </option>
                </select>
              </template>
              <template v-else>
                <input
                  v-model="endUserDepartment"
                  type="text"
                  class="w-full border border-stroke rounded px-3 py-2 bg-gray-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-gray-200 focus:border-gray-300"
                  placeholder="Enter department"
                />
              </template>
            </div>
            <div>
              <label class="block mb-2">Notes</label>
              <input
                v-model="notes"
                type="text"
                class="w-full border border-stroke rounded px-3 py-2 bg-gray-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-gray-200 focus:border-gray-300"
              />
            </div>
          </div>

          <!-- Inventory Record Filters -->
          <div class="bg-gray-50 rounded p-4 mb-4">
            <div class="grid grid-cols-5 gap-3 items-end">
              <div>
                <label class="block text-sm mb-1">Record Department</label>
                <template v-if="departments.length && !deptError">
                  <select
                    v-model="invFilters.department"
                    class="w-full border border-stroke rounded px-2 py-1 text-sm bg-gray-50 focus:bg-white focus:outline-none focus:ring-1 focus:ring-gray-200 focus:border-gray-300"
                  >
                    <option value="">All</option>
                    <option v-for="dept in departments" :key="dept._id" :value="dept.name">
                      {{ dept.name }}
                    </option>
                  </select>
                </template>
                <template v-else>
                  <input
                    v-model="invFilters.department"
                    type="text"
                    class="w-full border border-stroke rounded px-2 py-1 text-sm bg-gray-50 focus:bg-white focus:outline-none focus:ring-1 focus:ring-gray-200 focus:border-gray-300"
                    placeholder="Any"
                  />
                </template>
              </div>
              <div>
                <label class="block text-sm mb-1">ACN</label>
                <input
                  v-model="invFilters.acn"
                  type="text"
                  class="w-full border border-stroke rounded px-2 py-1 text-sm bg-gray-50 focus:bg-white focus:outline-none focus:ring-1 focus:ring-gray-200 focus:border-gray-300"
                  placeholder="e.g., ACN-123"
                />
              </div>
              <div>
                <label class="block text-sm mb-1">Serial Number</label>
                <input
                  v-model="invFilters.serialNumber"
                  type="text"
                  class="w-full border border-stroke rounded px-2 py-1 text-sm bg-gray-50 focus:bg-white focus:outline-none focus:ring-1 focus:ring-gray-200 focus:border-gray-300"
                  placeholder="e.g., SN-987"
                />
              </div>
              <div>
                <label class="block text-sm mb-1">From</label>
                <input
                  v-model="invFilters.startDate"
                  type="date"
                  class="w-full border border-stroke rounded px-2 py-1 text-sm bg-gray-50 focus:bg-white focus:outline-none focus:ring-1 focus:ring-gray-200 focus:border-gray-300"
                />
              </div>
              <div>
                <label class="block text-sm mb-1">To</label>
                <div class="flex gap-2">
                  <input
                    v-model="invFilters.endDate"
                    type="date"
                    class="w-full border border-stroke rounded px-2 py-1 text-sm bg-gray-50 focus:bg-white focus:outline-none focus:ring-1 focus:ring-gray-200 focus:border-gray-300"
                  />
                  <button
                    type="button"
                    @click="applyInventoryFilters"
                    class="bg-blue-500 text-white px-3 py-1 rounded text-sm"
                  >
                    Apply
                  </button>
                </div>
              </div>
            </div>
          </div>

          <div class="mb-4">
            <div class="flex justify-between items-center mb-2">
              <h3 class="font-semibold">Items</h3>
              <button
                type="button"
                @click="addItem"
                class="bg-blue-500 text-white px-4 py-1 rounded text-sm"
              >
                Add Item
              </button>
            </div>
            <div v-for="(item, index) in items" :key="index" class="rounded p-3 mb-2 bg-gray-50">
              <div class="grid grid-cols-3 gap-3">
                <div>
                  <label class="block text-sm mb-1">Inventory Record</label>
                  <select
                    v-model="item.inventoryRecordId"
                    @change="onRecordSelect(index)"
                    class="w-full border border-stroke rounded px-2 py-1 text-sm bg-gray-50 focus:bg-white focus:outline-none focus:ring-1 focus:ring-gray-200 focus:border-gray-300"
                  >
                    <option value="">Select Record</option>
                    <option v-for="rec in inventoryRecords" :key="rec._id" :value="rec._id">
                      {{ rec.department }} - {{ new Date(rec.date).toLocaleDateString() }}
                    </option>
                  </select>
                </div>
                <div>
                  <label class="block text-sm mb-1">Item</label>
                  <select
                    v-model="item.itemId"
                    @change="onItemSelect(index)"
                    class="w-full border border-stroke rounded px-2 py-1 text-sm bg-gray-50 focus:bg-white focus:outline-none focus:ring-1 focus:ring-gray-200 focus:border-gray-300"
                    :disabled="!item.inventoryRecordId"
                  >
                    <option value="">Select Item</option>
                    <option
                      v-for="recItem in inventoryRecords.find(
                        (r) => r._id === item.inventoryRecordId
                      )?.items || []"
                      :key="recItem._id"
                      :value="recItem._id"
                    >
                      {{ recItem.description || 'Item' }} - {{ recItem.acn || 'No ACN' }}
                    </option>
                  </select>
                </div>
                <div>
                  <label class="block text-sm mb-1">Description</label>
                  <input
                    v-model="item.description"
                    type="text"
                    class="w-full border border-stroke rounded px-2 py-1 text-sm bg-gray-50 focus:bg-white focus:outline-none focus:ring-1 focus:ring-gray-200 focus:border-gray-300"
                    readonly
                  />
                </div>
              </div>
              <div class="grid grid-cols-3 gap-3 mt-3">
                <div>
                  <label class="block text-sm mb-1">Property Number</label>
                  <input
                    v-model="item.propertyNumber"
                    type="text"
                    class="w-full border border-stroke rounded px-2 py-1 text-sm bg-gray-50 focus:bg-white focus:outline-none focus:ring-1 focus:ring-gray-200 focus:border-gray-300"
                    readonly
                  />
                </div>
                <div>
                  <label class="block text-sm mb-1">ACN</label>
                  <input
                    v-model="item.acn"
                    type="text"
                    class="w-full border border-stroke rounded px-2 py-1 text-sm bg-gray-50 focus:bg-white focus:outline-none focus:ring-1 focus:ring-gray-200 focus:border-gray-300"
                    readonly
                  />
                </div>
                <div>
                  <label class="block text-sm mb-1">Serial Number</label>
                  <input
                    v-model="item.serialNumber"
                    type="text"
                    class="w-full border border-stroke rounded px-2 py-1 text-sm bg-gray-50 focus:bg-white focus:outline-none focus:ring-1 focus:ring-gray-200 focus:border-gray-300"
                    readonly
                  />
                </div>
              </div>
              <button type="button" @click="removeItem(index)" class="text-red-500 text-sm mt-2">
                Remove
              </button>
            </div>
          </div>

          <div class="flex gap-2">
            <button
              type="submit"
              :disabled="loading"
              class="bg-primary text-white px-6 py-2 rounded"
            >
              {{ loading ? 'Creating...' : 'Create MR' }}
            </button>
            <button type="button" @click="router.back()" class="bg-gray-100 px-6 py-2 rounded">
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  </DefaultLayout>
</template>
