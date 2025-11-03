<script setup>
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import axios from 'axios'
import DefaultLayout from '@/layouts/DefaultLayout.vue'
import BreadcrumbDefault from '@/components/Breadcrumbs/BreadcrumbDefault.vue'

const router = useRouter()
const mrs = ref([])
const loading = ref(true)
const filterStatus = ref('')

const fetchMRs = async () => {
  try {
    const params = filterStatus.value ? { status: filterStatus.value } : {}
    const { data } = await axios.get('/mr', { params })
    mrs.value = data.mrs
  } catch (error) {
    console.error('Error fetching MRs:', error)
  } finally {
    loading.value = false
  }
}

const viewMR = (id) => router.push({ name: 'mr-detail', params: { id } })
const createMR = () => router.push({ name: 'mr-create' })

onMounted(fetchMRs)
</script>

<template>
  <DefaultLayout>
    <BreadcrumbDefault pageTitle="Memorandum Receipts" />
    <div class="p-6">
      <div class="flex justify-between mb-4">
        <select v-model="filterStatus" @change="fetchMRs" class="rounded border px-4 py-2">
          <option value="">All Status</option>
          <option value="active">Active</option>
          <option value="returned">Returned</option>
          <option value="cancelled">Cancelled</option>
        </select>
        <button @click="createMR" class="bg-primary text-white px-6 py-2 rounded">Create MR</button>
      </div>

      <div v-if="loading" class="text-center py-8">Loading...</div>
      <div v-else class="bg-white rounded shadow">
        <table class="w-full">
          <thead class="bg-gray-100">
            <tr>
              <th class="p-3 text-left">MR Number</th>
              <th class="p-3 text-left">MR Holder</th>
              <th class="p-3 text-left">End User</th>
              <th class="p-3 text-left">Department</th>
              <th class="p-3 text-left">Items</th>
              <th class="p-3 text-left">Status</th>
              <th class="p-3 text-left">Date</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="mr in mrs" :key="mr._id" @click="viewMR(mr._id)" class="border-t hover:bg-gray-50 cursor-pointer">
              <td class="p-3">{{ mr.mrNumber }}</td>
              <td class="p-3">{{ mr.mrHolder }}</td>
              <td class="p-3">{{ mr.endUser }}</td>
              <td class="p-3">{{ mr.endUserDepartment }}</td>
              <td class="p-3">{{ mr.items?.length || 0 }}</td>
              <td class="p-3"><span :class="{'bg-green-100 text-green-800': mr.status === 'active', 'bg-gray-100': mr.status === 'returned'}" class="px-2 py-1 rounded text-xs">{{ mr.status }}</span></td>
              <td class="p-3">{{ new Date(mr.issuedDate).toLocaleDateString() }}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  </DefaultLayout>
</template>
