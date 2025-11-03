<script setup>
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import axios from 'axios'
import DefaultLayout from '@/layouts/DefaultLayout.vue'
import BreadcrumbDefault from '@/components/Breadcrumbs/BreadcrumbDefault.vue'

const router = useRouter()
const tickets = ref([])
const loading = ref(true)
const filterStatus = ref('')

const fetchTickets = async () => {
  try {
    const params = filterStatus.value ? { status: filterStatus.value } : {}
    const { data } = await axios.get('/maintenance', { params })
    tickets.value = data.tickets
  } catch (error) {
    console.error('Error fetching tickets:', error)
  } finally {
    loading.value = false
  }
}

const viewTicket = (id) => router.push({ name: 'maintenance-detail', params: { id } })
const createTicket = () => router.push({ name: 'maintenance-create' })

onMounted(fetchTickets)
</script>

<template>
  <DefaultLayout>
    <BreadcrumbDefault pageTitle="Maintenance & Repair" />
    <div class="p-6">
      <div class="flex justify-between mb-4">
        <select v-model="filterStatus" @change="fetchTickets" class="rounded border px-4 py-2">
          <option value="">All Status</option>
          <option value="pending">Pending</option>
          <option value="in_progress">In Progress</option>
          <option value="completed">Completed</option>
          <option value="beyond_repair">Beyond Repair</option>
        </select>
        <button @click="createTicket" class="bg-primary text-white px-6 py-2 rounded">Create Repair Ticket</button>
      </div>

      <div v-if="loading" class="text-center py-8">Loading...</div>
      <div v-else class="bg-white rounded shadow">
        <table class="w-full">
          <thead class="bg-gray-100">
            <tr>
              <th class="p-3 text-left">Ticket #</th>
              <th class="p-3 text-left">ACN</th>
              <th class="p-3 text-left">Serial</th>
              <th class="p-3 text-left">Issue</th>
              <th class="p-3 text-left">Service Provider</th>
              <th class="p-3 text-left">Status</th>
              <th class="p-3 text-left">Date Sent</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="ticket in tickets" :key="ticket._id" @click="viewTicket(ticket._id)" class="border-t hover:bg-gray-50 cursor-pointer">
              <td class="p-3">{{ ticket.ticketNumber }}</td>
              <td class="p-3">{{ ticket.acn }}</td>
              <td class="p-3">{{ ticket.serialNumber }}</td>
              <td class="p-3">{{ ticket.issue }}</td>
              <td class="p-3">{{ ticket.serviceProvider }}</td>
              <td class="p-3"><span :class="{'bg-yellow-100 text-yellow-800': ticket.status === 'pending', 'bg-blue-100 text-blue-800': ticket.status === 'in_progress', 'bg-green-100 text-green-800': ticket.status === 'completed', 'bg-red-100 text-red-800': ticket.status === 'beyond_repair'}" class="px-2 py-1 rounded text-xs">{{ ticket.status }}</span></td>
              <td class="p-3">{{ new Date(ticket.dateSent).toLocaleDateString() }}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  </DefaultLayout>
</template>
