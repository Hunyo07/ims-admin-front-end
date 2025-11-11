<script setup>
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import axios from '@/utils/axios'
import DefaultLayout from '@/layouts/DefaultLayout.vue'
import BreadcrumbDefault from '@/components/Breadcrumbs/BreadcrumbDefault.vue'

const router = useRouter()
const mrs = ref([])
const loading = ref(true)
const filters = ref({
  search: '',
  status: '',
  department: '',
  from: '',
  to: ''
})
const departments = ref([])
const depLoading = ref(false)
const depError = ref('')

const fetchDepartments = async () => {
  depLoading.value = true
  depError.value = ''
  try {
    const { data } = await axios.get('/departments')
    departments.value = Array.isArray(data?.departments) ? data.departments : []
  } catch (err) {
    // Silently allow if forbidden; fallback to manual text entry
    depError.value = ''
  } finally {
    depLoading.value = false
  }
}

const fetchMRs = async () => {
  loading.value = true
  try {
    const params = {}
    if (filters.value.search) params.search = filters.value.search
    if (filters.value.status) params.status = filters.value.status
    if (filters.value.department) params.department = filters.value.department
    if (filters.value.from) params.from = filters.value.from
    if (filters.value.to) params.to = filters.value.to
    const { data } = await axios.get('/mr', { params })
    mrs.value = Array.isArray(data?.mrs) ? data.mrs : []
  } catch (error) {
    console.error('Error fetching MRs:', error)
  } finally {
    loading.value = false
  }
}

const resetFilters = () => {
  filters.value = { search: '', status: '', department: '', from: '', to: '' }
  fetchMRs()
}

const viewMR = (id) => router.push({ name: 'mr-detail', params: { id } })
const createMR = () => router.push({ name: 'mr-create' })

onMounted(async () => {
  await Promise.all([fetchDepartments(), fetchMRs()])
})
</script>

<template>
  <DefaultLayout>
    <BreadcrumbDefault pageTitle="Memorandum Receipts" />
    <div class="p-6">
      <div class="bg-white rounded shadow p-4 mb-4">
        <div class="grid grid-cols-1 md:grid-cols-5 gap-3 items-end">
          <div>
            <label class="block text-sm mb-1">Search</label>
            <input v-model="filters.search" @keyup.enter="fetchMRs" type="text" placeholder="MR number, holder, end user" class="w-full border border-gray-200 rounded px-3 py-2 bg-gray-50 focus:outline-none focus:ring-2 focus:ring-gray-200 focus:border-gray-300" />
          </div>
          <div>
            <label class="block text-sm mb-1">Status</label>
            <select v-model="filters.status" @change="fetchMRs" class="w-full border border-gray-200 rounded px-3 py-2 bg-gray-50 focus:outline-none focus:ring-2 focus:ring-gray-200 focus:border-gray-300">
              <option value="">All</option>
              <option value="active">Active</option>
              <option value="returned">Returned</option>
              <option value="cancelled">Cancelled</option>
            </select>
          </div>
          <div>
            <label class="block text-sm mb-1">Department</label>
            <select v-if="departments.length" v-model="filters.department" @change="fetchMRs" class="w-full border border-gray-200 rounded px-3 py-2 bg-gray-50 focus:outline-none focus:ring-2 focus:ring-gray-200 focus:border-gray-300">
              <option value="">All</option>
              <option v-for="d in departments" :key="d._id" :value="d.name">{{ d.name }}</option>
            </select>
            <input v-else v-model="filters.department" @keyup.enter="fetchMRs" type="text" placeholder="Type department" class="w-full border border-gray-200 rounded px-3 py-2 bg-gray-50 focus:outline-none focus:ring-2 focus:ring-gray-200 focus:border-gray-300" />
          </div>
          <div>
            <label class="block text-sm mb-1">From</label>
            <input v-model="filters.from" @change="fetchMRs" type="date" class="w-full border border-gray-200 rounded px-3 py-2 bg-gray-50 focus:outline-none focus:ring-2 focus:ring-gray-200 focus:border-gray-300" />
          </div>
          <div>
            <label class="block text-sm mb-1">To</label>
            <input v-model="filters.to" @change="fetchMRs" type="date" class="w-full border border-gray-200 rounded px-3 py-2 bg-gray-50 focus:outline-none focus:ring-2 focus:ring-gray-200 focus:border-gray-300" />
          </div>
        </div>
        <div class="flex justify-between mt-3">
          <button @click="fetchMRs" class="bg-primary text-white px-4 py-2 rounded">Apply Filters</button>
          <div class="flex gap-2">
            <button @click="createMR" class="bg-primary text-white px-4 py-2 rounded">Create MR</button>
            <button @click="resetFilters" class="bg-gray-100 px-4 py-2 rounded">Reset</button>
          </div>
        </div>
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
              <th class="p-3 text-left">Issued Date</th>
              <th class="p-3 text-left">Returned Date</th>
            </tr>
          </thead>
          <tbody>
            <tr v-if="!mrs.length">
              <td class="p-4 text-center text-gray-500" colspan="8">No results found</td>
            </tr>
            <tr v-for="mr in mrs" :key="mr._id" @click="viewMR(mr._id)" class="hover:bg-gray-50 cursor-pointer even:bg-gray-50">
              <td class="p-3">{{ mr.mrNumber }}</td>
              <td class="p-3">{{ mr.mrHolder }}</td>
              <td class="p-3">{{ mr.endUser }}</td>
              <td class="p-3">{{ mr.endUserDepartment }}</td>
              <td class="p-3">{{ mr.items?.length || 0 }}</td>
              <td class="p-3">
                <span
                  :class="{
                    'bg-green-100 text-green-800': mr.status === 'active',
                    'bg-gray-200 text-gray-800': mr.status === 'returned',
                    'bg-red-100 text-red-800': mr.status === 'cancelled'
                  }"
                  class="px-2 py-1 rounded text-xs"
                >{{ mr.status }}</span>
              </td>
              <td class="p-3">{{ mr.issuedDate ? new Date(mr.issuedDate).toLocaleDateString() : '—' }}</td>
              <td class="p-3">{{ mr.returnedDate ? new Date(mr.returnedDate).toLocaleDateString() : '—' }}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  </DefaultLayout>
</template>
