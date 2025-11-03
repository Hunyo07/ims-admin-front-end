<script setup>
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import axios from 'axios'
import DefaultLayout from '@/layouts/DefaultLayout.vue'
import BreadcrumbDefault from '@/components/Breadcrumbs/BreadcrumbDefault.vue'

const router = useRouter()
const mrHolder = ref('')
const endUser = ref('')
const endUserDepartment = ref('')
const notes = ref('')
const items = ref([])
const inventoryRecords = ref([])
const loading = ref(false)
const error = ref(null)

const fetchInventoryRecords = async () => {
  try {
    const { data } = await axios.get('/inventory-records')
    inventoryRecords.value = data.records
  } catch (err) {
    console.error('Error fetching inventory records:', err)
  }
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
  const record = inventoryRecords.value.find(r => r._id === item.inventoryRecordId)
  if (record && record.items?.length) {
    const recordItem = record.items[0]
    item.description = recordItem.description
    item.acn = recordItem.acn
    item.propertyNumber = recordItem.propertyNumber
    item.serialNumber = recordItem.serialNumber
    item.itemId = recordItem._id
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
              <input v-model="mrHolder" type="text" required class="w-full border rounded px-3 py-2" />
            </div>
            <div>
              <label class="block mb-2">End User <span class="text-red-500">*</span></label>
              <input v-model="endUser" type="text" required class="w-full border rounded px-3 py-2" />
            </div>
            <div>
              <label class="block mb-2">Department</label>
              <input v-model="endUserDepartment" type="text" class="w-full border rounded px-3 py-2" />
            </div>
            <div>
              <label class="block mb-2">Notes</label>
              <input v-model="notes" type="text" class="w-full border rounded px-3 py-2" />
            </div>
          </div>

          <div class="mb-4">
            <div class="flex justify-between items-center mb-2">
              <h3 class="font-semibold">Items</h3>
              <button type="button" @click="addItem" class="bg-blue-500 text-white px-4 py-1 rounded text-sm">Add Item</button>
            </div>
            <div v-for="(item, index) in items" :key="index" class="border rounded p-3 mb-2">
              <div class="grid grid-cols-3 gap-3">
                <div>
                  <label class="block text-sm mb-1">Inventory Record</label>
                  <select v-model="item.inventoryRecordId" @change="onRecordSelect(index)" class="w-full border rounded px-2 py-1 text-sm">
                    <option value="">Select Record</option>
                    <option v-for="rec in inventoryRecords" :key="rec._id" :value="rec._id">{{ rec.department }} - {{ rec.items?.[0]?.acn }}</option>
                  </select>
                </div>
                <div>
                  <label class="block text-sm mb-1">ACN</label>
                  <input v-model="item.acn" type="text" class="w-full border rounded px-2 py-1 text-sm" readonly />
                </div>
                <div>
                  <label class="block text-sm mb-1">Serial Number</label>
                  <input v-model="item.serialNumber" type="text" class="w-full border rounded px-2 py-1 text-sm" readonly />
                </div>
              </div>
              <button type="button" @click="removeItem(index)" class="text-red-500 text-sm mt-2">Remove</button>
            </div>
          </div>

          <div class="flex gap-2">
            <button type="submit" :disabled="loading" class="bg-primary text-white px-6 py-2 rounded">{{ loading ? 'Creating...' : 'Create MR' }}</button>
            <button type="button" @click="router.back()" class="border px-6 py-2 rounded">Cancel</button>
          </div>
        </form>
      </div>
    </div>
  </DefaultLayout>
</template>
