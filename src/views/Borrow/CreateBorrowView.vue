<script setup>
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import axios from '@/utils/axios'
import DefaultLayout from '@/layouts/DefaultLayout.vue'
import BreadcrumbDefault from '@/components/Breadcrumbs/BreadcrumbDefault.vue'

const router = useRouter()
const borrower = ref('')
const borrowerDepartment = ref('')
const borrowerContact = ref('')
const purpose = ref('')
const expectedReturnDate = ref('')
const notes = ref('')
const items = ref([])
const products = ref([])
const loading = ref(false)
const error = ref(null)

const fetchProducts = async () => {
  try {
    const { data } = await axios.get('/products')
    products.value = data.products
  } catch (err) {
    console.error('Error fetching products:', err)
  }
}

const addItem = () => {
  items.value.push({ product: '', name: '', serialNumber: '', acn: '', quantity: 1 })
}

const removeItem = (index) => items.value.splice(index, 1)

const onProductSelect = (index) => {
  const item = items.value[index]
  const product = products.value.find(p => p._id === item.product)
  if (product) item.name = product.name
}

const submitBorrow = async () => {
  if (!borrower.value || !borrowerDepartment.value || !purpose.value || !expectedReturnDate.value || !items.value.length) {
    error.value = 'Please fill all required fields'
    return
  }
  loading.value = true
  error.value = null
  try {
    const { data } = await axios.post('/borrow', {
      borrower: borrower.value,
      borrowerDepartment: borrowerDepartment.value,
      borrowerContact: borrowerContact.value,
      purpose: purpose.value,
      expectedReturnDate: expectedReturnDate.value,
      items: items.value,
      notes: notes.value
    })
    router.push({ name: 'borrow-detail', params: { id: data.borrow._id } })
  } catch (err) {
    error.value = err.response?.data?.message || err.message
  } finally {
    loading.value = false
  }
}

onMounted(() => {
  fetchProducts()
  addItem()
})
</script>

<template>
  <DefaultLayout>
    <BreadcrumbDefault pageTitle="Create Borrow Request" />
    <div class="p-6">
      <div class="bg-white rounded shadow p-6">
        <div v-if="error" class="bg-red-100 text-red-700 p-3 rounded mb-4">{{ error }}</div>
        
        <form @submit.prevent="submitBorrow">
          <div class="grid grid-cols-2 gap-4 mb-4">
            <div>
              <label class="block mb-2">Borrower <span class="text-red-500">*</span></label>
              <input v-model="borrower" type="text" required class="w-full border rounded px-3 py-2" />
            </div>
            <div>
              <label class="block mb-2">Department <span class="text-red-500">*</span></label>
              <input v-model="borrowerDepartment" type="text" required class="w-full border rounded px-3 py-2" />
            </div>
            <div>
              <label class="block mb-2">Contact</label>
              <input v-model="borrowerContact" type="text" class="w-full border rounded px-3 py-2" />
            </div>
            <div>
              <label class="block mb-2">Expected Return Date <span class="text-red-500">*</span></label>
              <input v-model="expectedReturnDate" type="date" required class="w-full border rounded px-3 py-2" />
            </div>
            <div class="col-span-2">
              <label class="block mb-2">Purpose <span class="text-red-500">*</span></label>
              <textarea v-model="purpose" required class="w-full border rounded px-3 py-2" rows="2"></textarea>
            </div>
          </div>

          <div class="mb-4">
            <div class="flex justify-between items-center mb-2">
              <h3 class="font-semibold">Items</h3>
              <button type="button" @click="addItem" class="bg-blue-500 text-white px-4 py-1 rounded text-sm">Add Item</button>
            </div>
            <div v-for="(item, index) in items" :key="index" class="border rounded p-3 mb-2">
              <div class="grid grid-cols-4 gap-3">
                <div>
                  <label class="block text-sm mb-1">Product</label>
                  <select v-model="item.product" @change="onProductSelect(index)" class="w-full border rounded px-2 py-1 text-sm">
                    <option value="">Select Product</option>
                    <option v-for="prod in products" :key="prod._id" :value="prod._id">{{ prod.name }}</option>
                  </select>
                </div>
                <div>
                  <label class="block text-sm mb-1">Serial Number</label>
                  <input v-model="item.serialNumber" type="text" class="w-full border rounded px-2 py-1 text-sm" />
                </div>
                <div>
                  <label class="block text-sm mb-1">ACN</label>
                  <input v-model="item.acn" type="text" class="w-full border rounded px-2 py-1 text-sm" />
                </div>
                <div>
                  <label class="block text-sm mb-1">Quantity</label>
                  <input v-model.number="item.quantity" type="number" min="1" class="w-full border rounded px-2 py-1 text-sm" />
                </div>
              </div>
              <button type="button" @click="removeItem(index)" class="text-red-500 text-sm mt-2">Remove</button>
            </div>
          </div>

          <div class="mb-4">
            <label class="block mb-2">Notes</label>
            <textarea v-model="notes" class="w-full border rounded px-3 py-2" rows="2"></textarea>
          </div>

          <div class="flex gap-2">
            <button type="submit" :disabled="loading" class="bg-primary text-white px-6 py-2 rounded">{{ loading ? 'Creating...' : 'Create Borrow Request' }}</button>
            <button type="button" @click="router.back()" class="border px-6 py-2 rounded">Cancel</button>
          </div>
        </form>
      </div>
    </div>
  </DefaultLayout>
</template>
