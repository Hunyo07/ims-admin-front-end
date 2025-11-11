<script setup>
import { ref, onMounted, computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import axios from '@/utils/axios'
import DefaultLayout from '@/layouts/DefaultLayout.vue'

const route = useRoute()
const router = useRouter()

const disposal = ref(null)
const loading = ref(false)
const error = ref('')

const id = computed(() => String(route.params.id || ''))

async function fetchDisposal() {
  if (!id.value) return
  loading.value = true
  error.value = ''
  try {
    const { data } = await axios.get(`/disposal/${id.value}`)
    disposal.value = data?.disposal || null
  } catch (e) {
    error.value = e?.response?.data?.message || e.message || 'Failed to load disposal'
  } finally {
    loading.value = false
  }
}

onMounted(fetchDisposal)

function formatDate(d) {
  if (!d) return '—'
  try {
    return new Date(d).toLocaleString()
  } catch (_) {
    return String(d)
  }
}
</script>

<template>
  <DefaultLayout>
    <div class="mb-6 flex items-center justify-between">
      <div>
        <h1 class="text-2xl font-bold text-black dark:text-white">Disposal Record</h1>
        <p class="text-sm text-bodydark2 mt-1">View disposal details</p>
      </div>
      <button
        class="rounded border border-stroke px-4 py-2 text-sm hover:bg-gray-50 dark:hover:bg-meta-4"
        @click="router.push('/disposal')"
      >
        ← Back to List
      </button>
    </div>

    <div class="rounded-sm border border-stroke bg-white shadow-default dark:border-strokedark dark:bg-boxdark">
      <div class="border-b border-stroke dark:border-strokedark p-6">
        <div class="flex items-start justify-between">
          <div>
            <h2 class="text-xl font-semibold">{{ disposal?.disposalNumber || '—' }}</h2>
            <p class="text-xs text-bodydark2 mt-1">Disposal ID: {{ id }}</p>
          </div>
          <div class="text-right">
            <div class="text-xs text-bodydark2">Approved By</div>
            <div class="text-sm font-medium">{{ disposal?.approvedByName || (disposal?.approvedBy ? (disposal.approvedBy.firstName + ' ' + (disposal.approvedBy.lastName || '')) : '—') }}</div>
          </div>
        </div>
      </div>

      <div class="p-6">
        <div v-if="loading" class="text-sm">Loading disposal...</div>
        <div v-else-if="error" class="text-danger text-sm">{{ error }}</div>

        <div v-else-if="disposal" class="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <div>
            <div class="text-xs text-bodydark2 mb-1">Reason</div>
            <div class="text-sm font-medium capitalize">{{ disposal.reason || '—' }}</div>
          </div>
          <div>
            <div class="text-xs text-bodydark2 mb-1">Disposal Date</div>
            <div class="text-sm font-medium">{{ formatDate(disposal.disposalDate) }}</div>
          </div>
          <div>
            <div class="text-xs text-bodydark2 mb-1">ACN</div>
            <div class="text-sm font-medium">{{ disposal.acn || '—' }}</div>
          </div>
          <div>
            <div class="text-xs text-bodydark2 mb-1">Serial</div>
            <div class="text-sm font-medium">{{ disposal.serialNumber || '—' }}</div>
          </div>
          <div>
            <div class="text-xs text-bodydark2 mb-1">Item Description</div>
            <div class="text-sm font-medium">{{ disposal.description || '—' }}</div>
          </div>
        </div>

        <div v-if="disposal?.reasonDetails" class="mb-6">
          <div class="text-xs text-bodydark2 mb-1">Reason Details</div>
          <div class="text-sm bg-gray-50 dark:bg-meta-4 p-3 rounded">{{ disposal.reasonDetails }}</div>
        </div>

        <div v-if="disposal?.notes" class="mb-6">
          <div class="text-xs text-bodydark2 mb-1">Notes</div>
          <div class="text-sm bg-gray-50 dark:bg-meta-4 p-3 rounded">{{ disposal.notes }}</div>
        </div>

        <div>
          <h3 class="text-lg font-semibold mb-3">Proof Images ({{ disposal?.proofImages?.length || 0 }})</h3>
          <div v-if="disposal?.proofImages?.length" class="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            <div v-for="(img, i) in disposal.proofImages" :key="img + i" class="rounded border border-stroke dark:border-strokedark p-2">
              <img :src="img" alt="Proof Image" class="w-full h-32 object-cover rounded" />
              <a :href="img" target="_blank" class="text-primary text-xs font-medium hover:underline mt-2 inline-block">View Full Image →</a>
            </div>
          </div>
          <div v-else class="text-sm text-bodydark2 p-4">No proof images uploaded</div>
        </div>
      </div>
    </div>
  </DefaultLayout>
</template>