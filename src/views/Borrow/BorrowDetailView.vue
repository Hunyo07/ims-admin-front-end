<script setup>
import { ref, onMounted, computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import axios from '@/utils/axios'
import DefaultLayout from '@/layouts/DefaultLayout.vue'

const route = useRoute()
const router = useRouter()

const borrow = ref(null)
const loading = ref(false)
const error = ref('')

const id = computed(() => String(route.params.id || ''))

async function fetchBorrow() {
  if (!id.value) return
  loading.value = true
  error.value = ''
  try {
    const { data } = await axios.get(`/borrow/${id.value}`)
    borrow.value = data?.borrowRequest || null
  } catch (e) {
    error.value = e?.response?.data?.message || e.message || 'Failed to load borrow request'
  } finally {
    loading.value = false
  }
}

onMounted(fetchBorrow)

function formatDate(d) {
  if (!d) return '—'
  try {
    return new Date(d).toLocaleString()
  } catch (_) {
    return String(d)
  }
}

function fullName(u) {
  if (!u) return '—'
  if (typeof u === 'string') return u
  const first = u.firstName || ''
  const last = u.lastName || ''
  const name = `${first} ${last}`.trim()
  return name || u.email || '—'
}
</script>

<template>
  <DefaultLayout>
    <div class="mb-6 flex items-center justify-between">
      <div>
        <h1 class="text-2xl font-bold text-black dark:text-white">Borrow Request</h1>
        <p class="text-sm text-bodydark2 mt-1">View borrow details</p>
      </div>
      <button
        class="rounded border border-stroke px-4 py-2 text-sm hover:bg-gray-50 dark:hover:bg-meta-4"
        @click="router.push('/borrow')"
      >
        ← Back to List
      </button>
    </div>

    <div class="rounded-sm border border-stroke bg-white shadow-default dark:border-strokedark dark:bg-boxdark">
      <div class="border-b border-stroke dark:border-strokedark p-6">
        <div class="flex items-start justify-between">
          <div>
            <h2 class="text-xl font-semibold">{{ borrow?.borrowNumber || '—' }}</h2>
            <p class="text-xs text-bodydark2 mt-1">Borrow ID: {{ id }}</p>
          </div>
          <div class="text-right">
            <div class="text-xs text-bodydark2">Status</div>
            <div class="inline-flex items-center gap-2 mt-1">
              <span
                class="px-2 py-1 text-xs rounded"
                :class="{
                  'bg-yellow-100 text-yellow-700': borrow?.status === 'pending',
                  'bg-blue-100 text-blue-700': borrow?.status === 'approved',
                  'bg-purple-100 text-purple-700': borrow?.status === 'issued',
                  'bg-green-100 text-green-700': borrow?.status === 'returned'
                }"
              >
                {{ borrow?.status || '—' }}
              </span>
            </div>
          </div>
        </div>
      </div>

      <div class="p-6">
        <div v-if="loading" class="text-sm">Loading borrow request...</div>
        <div v-else-if="error" class="text-danger text-sm">{{ error }}</div>

        <div v-else-if="borrow">
          <!-- Borrower Info -->
          <div class="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            <div>
              <div class="text-xs text-bodydark2 mb-1">Borrower</div>
              <div class="text-sm font-medium">{{ borrow.borrower || '—' }}</div>
            </div>
            <div>
              <div class="text-xs text-bodydark2 mb-1">Department</div>
              <div class="text-sm font-medium">{{ borrow.borrowerDepartment || '—' }}</div>
            </div>
            <div>
              <div class="text-xs text-bodydark2 mb-1">Contact</div>
              <div class="text-sm font-medium">{{ borrow.borrowerContact || '—' }}</div>
            </div>
          </div>

          <!-- Purpose and Dates -->
          <div class="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            <div>
              <div class="text-xs text-bodydark2 mb-1">Purpose</div>
              <div class="text-sm font-medium">{{ borrow.purpose || '—' }}</div>
            </div>
            <div>
              <div class="text-xs text-bodydark2 mb-1">Date Borrowed</div>
              <div class="text-sm font-medium">{{ formatDate(borrow.dateBorrowed) }}</div>
            </div>
            <div>
              <div class="text-xs text-bodydark2 mb-1">Expected Return Date</div>
              <div class="text-sm font-medium">{{ formatDate(borrow.expectedReturnDate) }}</div>
            </div>
            <div>
              <div class="text-xs text-bodydark2 mb-1">Actual Return Date</div>
              <div class="text-sm font-medium">{{ formatDate(borrow.actualReturnDate) }}</div>
            </div>
          </div>

          <!-- Workflow Actors -->
          <div class="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            <div class="p-3 rounded bg-gray-50 dark:bg-meta-4">
              <div class="text-xs text-bodydark2 mb-1">Approved By</div>
              <div class="text-sm font-medium">{{ fullName(borrow.approvedBy) }}</div>
              <div class="text-xs mt-1">{{ formatDate(borrow.approvedAt) }}</div>
            </div>
            <div class="p-3 rounded bg-gray-50 dark:bg-meta-4">
              <div class="text-xs text-bodydark2 mb-1">Issued By</div>
              <div class="text-sm font-medium">{{ fullName(borrow.issuedBy) }}</div>
            </div>
            <div class="p-3 rounded bg-gray-50 dark:bg-meta-4">
              <div class="text-xs text-bodydark2 mb-1">Returned To</div>
              <div class="text-sm font-medium">{{ fullName(borrow.returnedTo) }}</div>
            </div>
          </div>

          <!-- Items -->
          <div class="mb-6">
            <h3 class="text-lg font-semibold mb-3">Items ({{ borrow.items?.length || 0 }})</h3>
            <div v-if="borrow.items?.length" class="overflow-x-auto">
              <table class="min-w-full text-sm">
                <thead>
                  <tr class="text-left border-b border-stroke dark:border-strokedark">
                    <th class="py-2 pr-4">Product</th>
                    <th class="py-2 pr-4">Name</th>
                    <th class="py-2 pr-4">Serial</th>
                    <th class="py-2 pr-4">ACN</th>
                    <th class="py-2 pr-4">Qty</th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-for="(it, idx) in borrow.items" :key="idx" class="border-b border-stroke/50 dark:border-strokedark/50">
                    <td class="py-2 pr-4">{{ typeof it.product === 'object' ? it.product?.name : it.product }}</td>
                    <td class="py-2 pr-4">{{ it.name || '—' }}</td>
                    <td class="py-2 pr-4">{{ it.serialNumber || '—' }}</td>
                    <td class="py-2 pr-4">{{ it.acn || '—' }}</td>
                    <td class="py-2 pr-4">{{ it.quantity ?? 1 }}</td>
                  </tr>
                </tbody>
              </table>
            </div>
            <div v-else class="text-sm text-bodydark2 p-4">No items</div>
          </div>

          <!-- Notes -->
          <div v-if="borrow?.notes" class="mb-6">
            <div class="text-xs text-bodydark2 mb-1">Notes</div>
            <div class="text-sm bg-gray-50 dark:bg-meta-4 p-3 rounded">{{ borrow.notes }}</div>
          </div>

          <div v-if="borrow?.returnNotes" class="mb-6">
            <div class="text-xs text-bodydark2 mb-1">Return Notes</div>
            <div class="text-sm bg-gray-50 dark:bg-meta-4 p-3 rounded">{{ borrow.returnNotes }}</div>
          </div>
        </div>
      </div>
    </div>
  </DefaultLayout>
</template>