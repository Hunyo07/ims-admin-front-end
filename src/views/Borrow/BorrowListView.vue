<script setup>
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import axios from 'axios'
import DefaultLayout from '@/layouts/DefaultLayout.vue'
import BreadcrumbDefault from '@/components/Breadcrumbs/BreadcrumbDefault.vue'

const router = useRouter()
const borrows = ref([])
const loading = ref(true)
const filterStatus = ref('')

const fetchBorrows = async () => {
  try {
    const params = filterStatus.value ? { status: filterStatus.value } : {}
    const { data } = await axios.get('/borrow', { params })
    borrows.value = data.borrows
  } catch (error) {
    console.error('Error fetching borrows:', error)
  } finally {
    loading.value = false
  }
}

const viewBorrow = (id) => router.push({ name: 'borrow-detail', params: { id } })
const createBorrow = () => router.push({ name: 'borrow-create' })

onMounted(fetchBorrows)
</script>

<template>
  <DefaultLayout>
    <BreadcrumbDefault pageTitle="Borrow Items" />
    <div class="p-6">
      <div class="flex justify-between mb-4">
        <select v-model="filterStatus" @change="fetchBorrows" class="rounded border px-4 py-2">
          <option value="">All Status</option>
          <option value="pending">Pending</option>
          <option value="approved">Approved</option>
          <option value="active">Active</option>
          <option value="returned">Returned</option>
          <option value="overdue">Overdue</option>
        </select>
        <button @click="createBorrow" class="bg-primary text-white px-6 py-2 rounded">Create Borrow Request</button>
      </div>

      <div v-if="loading" class="text-center py-8">Loading...</div>
      <div v-else class="bg-white rounded shadow">
        <table class="w-full">
          <thead class="bg-gray-100">
            <tr>
              <th class="p-3 text-left">Borrow #</th>
              <th class="p-3 text-left">Borrower</th>
              <th class="p-3 text-left">Department</th>
              <th class="p-3 text-left">Purpose</th>
              <th class="p-3 text-left">Items</th>
              <th class="p-3 text-left">Expected Return</th>
              <th class="p-3 text-left">Status</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="borrow in borrows" :key="borrow._id" @click="viewBorrow(borrow._id)" class="border-t hover:bg-gray-50 cursor-pointer">
              <td class="p-3">{{ borrow.borrowNumber }}</td>
              <td class="p-3">{{ borrow.borrower }}</td>
              <td class="p-3">{{ borrow.borrowerDepartment }}</td>
              <td class="p-3">{{ borrow.purpose }}</td>
              <td class="p-3">{{ borrow.items?.length || 0 }}</td>
              <td class="p-3">{{ new Date(borrow.expectedReturnDate).toLocaleDateString() }}</td>
              <td class="p-3"><span :class="{'bg-yellow-100 text-yellow-800': borrow.status === 'pending', 'bg-blue-100 text-blue-800': borrow.status === 'approved', 'bg-green-100 text-green-800': borrow.status === 'active', 'bg-gray-100': borrow.status === 'returned', 'bg-red-100 text-red-800': borrow.status === 'overdue'}" class="px-2 py-1 rounded text-xs">{{ borrow.status }}</span></td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  </DefaultLayout>
</template>
