<script setup>
import { onMounted, ref } from 'vue'
import axios from '../../utils/axios'
import DefaultLayout from '@/layouts/DefaultLayout.vue'

let ris = []
let loading = false
let error = null

async function fetchRIS() {
  loading = true
  error = null

  try {
    const response = await axios.get('/ris')
    ris = response.data.ris || []
  } catch (e) {
    error = e?.response?.data?.message || e.message
  } finally {
    loading = false
  }
}

onMounted(fetchRIS)
</script>

<template>
  <DefaultLayout>
    <div class="p-6">
      <h1 class="text-xl font-semibold mb-4">Requisition Issue Slips</h1>
      <div v-if="loading">Loading...</div>
      <div v-else>
        <div v-if="error" class="text-red-500 mb-3">{{ error }}</div>
        <table class="min-w-full bg-white rounded shadow">
          <thead>
            <tr class="text-left">
              <th class="p-3">RIS #</th>
              <th class="p-3">Purpose</th>
              <th class="p-3">Requestor</th>
              <th class="p-3">Status</th>
              <th class="p-3">Created</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="r in ris" :key="r._id" class="border-t hover:bg-gray-50">
              <td class="p-3">
                <router-link
                  class="text-blue-600"
                  :to="{ name: 'ris-detail', params: { id: r._id } }"
                  >{{ r.risNumber }}</router-link
                >
              </td>
              <td class="p-3">{{ r.purpose }}</td>
              <td class="p-3">{{ r.requestor }}</td>
              <td class="p-3">{{ r.status }}</td>
              <td class="p-3">{{ new Date(r.createdAt).toLocaleString() }}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  </DefaultLayout>
</template>
