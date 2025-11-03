<script setup>
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import axios from 'axios'
import DefaultLayout from '@/layouts/DefaultLayout.vue'
import BreadcrumbDefault from '@/components/Breadcrumbs/BreadcrumbDefault.vue'

const router = useRouter()
const inventoryRecordId = ref('')
const itemId = ref('')
const acn = ref('')
const serialNumber = ref('')
const description = ref('')
const reason = ref('')
const reasonDetails = ref('')
const notes = ref('')
const proofImages = ref([])
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

const onRecordSelect = () => {
  const record = inventoryRecords.value.find(r => r._id === inventoryRecordId.value)
  if (record && record.items?.length) {
    const item = record.items[0]
    itemId.value = item._id
    description.value = item.description
    acn.value = item.acn
    serialNumber.value = item.serialNumber
  }
}

const handleImageUpload = (e) => {
  const files = Array.from(e.target.files)
  files.forEach(file => {
    const reader = new FileReader()
    reader.onload = (event) => proofImages.value.push(event.target.result)
    reader.readAsDataURL(file)
  })
}

const submitDisposal = async () => {
  if (!reason.value) {
    error.value = 'Disposal reason is required'
    return
  }
  loading.value = true
  error.value = null
  try {
    const { data } = await axios.post('/disposal', {
      inventoryRecordId: inventoryRecordId.value,
      itemId: itemId.value,
      acn: acn.value,
      serialNumber: serialNumber.value,
      description: description.value,
      reason: reason.value,
      reasonDetails: reasonDetails.value,
      proofImages: proofImages.value,
      notes: notes.value
    })
    router.push({ name: 'disposal-detail', params: { id: data.disposal._id } })
  } catch (err) {
    error.value = err.response?.data?.message || err.message
  } finally {
    loading.value = false
  }
}

onMounted(fetchInventoryRecords)
</script>

<template>
  <DefaultLayout>
    <BreadcrumbDefault pageTitle="Create Disposal Record" />
    <div class="p-6">
      <div class="bg-white rounded shadow p-6">
        <div v-if="error" class="bg-red-100 text-red-700 p-3 rounded mb-4">{{ error }}</div>
        
        <form @submit.prevent="submitDisposal">
          <div class="grid grid-cols-2 gap-4 mb-4">
            <div class="col-span-2">
              <label class="block mb-2">Select Inventory Item</label>
              <select v-model="inventoryRecordId" @change="onRecordSelect" class="w-full border rounded px-3 py-2">
                <option value="">Select Item</option>
                <option v-for="rec in inventoryRecords" :key="rec._id" :value="rec._id">{{ rec.items?.[0]?.acn }} - {{ rec.items?.[0]?.description }}</option>
              </select>
            </div>
            <div>
              <label class="block mb-2">ACN</label>
              <input v-model="acn" type="text" readonly class="w-full border rounded px-3 py-2 bg-gray-50" />
            </div>
            <div>
              <label class="block mb-2">Serial Number</label>
              <input v-model="serialNumber" type="text" readonly class="w-full border rounded px-3 py-2 bg-gray-50" />
            </div>
            <div>
              <label class="block mb-2">Reason <span class="text-red-500">*</span></label>
              <select v-model="reason" required class="w-full border rounded px-3 py-2">
                <option value="">Select Reason</option>
                <option value="obsolete">Obsolete</option>
                <option value="damaged_beyond_repair">Damaged Beyond Repair</option>
                <option value="lost">Lost</option>
                <option value="stolen">Stolen</option>
                <option value="other">Other</option>
              </select>
            </div>
            <div>
              <label class="block mb-2">Reason Details</label>
              <input v-model="reasonDetails" type="text" class="w-full border rounded px-3 py-2" />
            </div>
            <div class="col-span-2">
              <label class="block mb-2">Proof Images</label>
              <input type="file" @change="handleImageUpload" multiple accept="image/*" class="w-full border rounded px-3 py-2" />
              <div v-if="proofImages.length" class="flex gap-2 mt-2">
                <img v-for="(img, i) in proofImages" :key="i" :src="img" class="w-20 h-20 object-cover rounded" />
              </div>
            </div>
            <div class="col-span-2">
              <label class="block mb-2">Notes</label>
              <textarea v-model="notes" class="w-full border rounded px-3 py-2" rows="3"></textarea>
            </div>
          </div>

          <div class="flex gap-2">
            <button type="submit" :disabled="loading" class="bg-primary text-white px-6 py-2 rounded">{{ loading ? 'Creating...' : 'Create Disposal Record' }}</button>
            <button type="button" @click="router.back()" class="border px-6 py-2 rounded">Cancel</button>
          </div>
        </form>
      </div>
    </div>
  </DefaultLayout>
</template>
