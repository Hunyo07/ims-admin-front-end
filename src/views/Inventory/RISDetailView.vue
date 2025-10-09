<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useRoute } from 'vue-router'
import axios from '../../utils/axios'

const route = useRoute()
const ris = ref<any | null>(null)
const loading = ref(false)
const error = ref<string | null>(null)
const issueQuantities = ref<Record<string, number>>({})
const issuing = ref(false)

async function fetchRIS() {
  loading.value = true
  error.value = null
  try {
    const { data } = await axios.get(`/ris/${route.params.id}`)
    ris.value = data.ris
  } catch (e: any) {
    error.value = e?.response?.data?.message || e.message
  } finally {
    loading.value = false
  }
}

async function issue() {
  if (!ris.value) return
  issuing.value = true
  error.value = null
  try {
    await axios.post(`/ris/${ris.value._id}/issue`, { issueQuantities: issueQuantities.value })
    await fetchRIS()
  } catch (e: any) {
    error.value = e?.response?.data?.message || e.message
  } finally {
    issuing.value = false
  }
}

onMounted(fetchRIS)
</script>

<template>
  <div class="p-6">
    <div v-if="loading">Loading...</div>
    <div v-else-if="error" class="text-red-500">{{ error }}</div>
    <div v-else-if="ris">
      <h1 class="text-xl font-semibold mb-4">RIS {{ ris.risNumber }}</h1>
      <div class="mb-4 text-sm text-gray-700">
        Purpose: {{ ris.purpose }} | Requestor: {{ ris.requestor }} | Status: {{ ris.status }}
      </div>
      <table class="min-w-full bg-white rounded shadow">
        <thead>
          <tr class="text-left">
            <th class="p-3">Item</th>
            <th class="p-3">Requested</th>
            <th class="p-3">Issued</th>
            <th class="p-3">Issue Now</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="it in ris.items" :key="it.product" class="border-t">
            <td class="p-3">{{ it.name }}</td>
            <td class="p-3">{{ it.requestedQty }}</td>
            <td class="p-3">{{ it.issuedQty }}</td>
            <td class="p-3">
              <input
                type="number"
                min="0"
                class="border rounded px-2 py-1 w-28"
                v-model.number="issueQuantities[it.product]"
              />
            </td>
          </tr>
        </tbody>
      </table>
      <div class="mt-4">
        <button class="bg-blue-600 text-white px-4 py-2 rounded" :disabled="issuing" @click="issue">
          {{ issuing ? 'Issuing...' : 'Issue Items' }}
        </button>
      </div>
    </div>
  </div>
</template>
