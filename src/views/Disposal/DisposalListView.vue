<script setup>
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import axios from 'axios'
import DefaultLayout from '@/layouts/DefaultLayout.vue'
import BreadcrumbDefault from '@/components/Breadcrumbs/BreadcrumbDefault.vue'

const router = useRouter()
const disposals = ref([])
const loading = ref(true)

const fetchDisposals = async () => {
  try {
    const { data } = await axios.get('/disposal')
    disposals.value = data.disposals
  } catch (error) {
    console.error('Error fetching disposals:', error)
  } finally {
    loading.value = false
  }
}

const viewDisposal = (id) => router.push({ name: 'disposal-detail', params: { id } })
const createDisposal = () => router.push({ name: 'disposal-create' })

onMounted(fetchDisposals)
</script>

<template>
  <DefaultLayout>
    <BreadcrumbDefault pageTitle="Disposal Records" />
    <div class="p-6">
      <div class="flex justify-end mb-4">
        <button @click="createDisposal" class="bg-primary text-white px-6 py-2 rounded">Create Disposal Record</button>
      </div>

      <div v-if="loading" class="text-center py-8">Loading...</div>
      <div v-else class="bg-white rounded shadow">
        <table class="w-full">
          <thead class="bg-gray-100">
            <tr>
              <th class="p-3 text-left">Disposal #</th>
              <th class="p-3 text-left">ACN</th>
              <th class="p-3 text-left">Serial</th>
              <th class="p-3 text-left">Description</th>
              <th class="p-3 text-left">Reason</th>
              <th class="p-3 text-left">Approved By</th>
              <th class="p-3 text-left">Date</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="disposal in disposals" :key="disposal._id" @click="viewDisposal(disposal._id)" class="border-t hover:bg-gray-50 cursor-pointer">
              <td class="p-3">{{ disposal.disposalNumber }}</td>
              <td class="p-3">{{ disposal.acn }}</td>
              <td class="p-3">{{ disposal.serialNumber }}</td>
              <td class="p-3">{{ disposal.description }}</td>
              <td class="p-3"><span class="px-2 py-1 bg-red-100 text-red-800 rounded text-xs">{{ disposal.reason }}</span></td>
              <td class="p-3">{{ disposal.approvedByName || 'Pending' }}</td>
              <td class="p-3">{{ new Date(disposal.disposalDate).toLocaleDateString() }}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  </DefaultLayout>
</template>
