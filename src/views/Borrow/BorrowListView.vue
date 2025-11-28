<script setup>
import { ref, onMounted, computed, watch } from 'vue'
import { useRouter } from 'vue-router'
import axios from '@/utils/axios'
import DefaultLayout from '@/layouts/DefaultLayout.vue'
import BreadcrumbDefault from '@/components/Breadcrumbs/BreadcrumbDefault.vue'

const router = useRouter()
const borrows = ref([])
const loading = ref(true)
const filterStatus = ref('')
const search = ref('')

const fetchBorrows = async () => {
  try {
    let params = {}
    if (filterStatus.value === 'returned') params = { status: 'returned' }
    else if (filterStatus.value === 'overdue') params = { status: 'active' }
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

watch(filterStatus, async () => {
  loading.value = true
  await fetchBorrows()
})

const filteredBorrows = computed(() => {
  const q = String(search.value || '')
    .trim()
    .toLowerCase()
  let list = Array.isArray(borrows.value) ? borrows.value : []
  if (filterStatus.value === 'active') {
    list = list.filter((b) => ['active', 'approved', 'pending'].includes(b.status))
  } else if (filterStatus.value === 'returned') {
    list = list.filter((b) => b.status === 'returned')
  } else if (filterStatus.value === 'overdue') {
    list = list.filter((b) => b.status === 'active' && isOverdue(b))
  }
  if (!q) return list
  return list.filter((b) => {
    const fields = [b.borrowNumber, b.borrower, b.borrowerDepartment, b.purpose]
    return fields.some((f) =>
      String(f || '')
        .toLowerCase()
        .includes(q)
    )
  })
})

const statusLabel = (s) => {
  if (s === 'active' || s === 'approved' || s === 'pending') return 'Out'
  if (s === 'returned') return 'Returned'
  if (s === 'overdue') return 'Overdue'
  return s || '—'
}

const statusClass = (s) => {
  console.log(s)
  return (
    {
      active: 'bg-green-100 text-green-800',
      approved: 'bg-green-100 text-green-800',
      pending: 'bg-green-100 text-green-800',
      returned: 'bg-gray-100 text-gray-700',
      overdue: 'bg-red text-black'
    }[s] || 'bg-gray-100 text-gray-700'
  )
}

const formatDate = (d) => {
  try {
    return new Date(d).toLocaleDateString()
  } catch (_) {
    return '—'
  }
}

const isOverdue = (b) => {
  if (!b?.expectedReturnDate) return false
  if (b?.status !== 'active') return false
  try {
    return new Date(b.expectedReturnDate) < new Date()
  } catch (_) {
    return false
  }
}

const statusCounts = computed(() => {
  const counts = { all: 0, out: 0, returned: 0, overdue: 0 }
  const list = Array.isArray(borrows.value) ? borrows.value : []
  counts.all = list.length
  for (const b of list) {
    const s = b.status
    if (['active', 'approved', 'pending'].includes(s)) counts.out++
    if (s === 'returned') counts.returned++
    if (isOverdue(b)) counts.overdue++
  }
  return counts
})

const itemSummary = (b) => {
  const names = (b.items || []).map((it) => it?.product?.name || it?.name || '').filter(Boolean)
  if (!names.length) return `${b.items?.length || 0}`
  const head = names.slice(0, 2).join(', ')
  const more = names.length > 2 ? ` +${names.length - 2} more` : ''
  return head + more
}
</script>

<template>
  <DefaultLayout>
    <BreadcrumbDefault pageTitle="Borrow Items" />
    <div class="p-6">
      <div class="flex flex-col md:flex-row md:items-center md:justify-between gap-3 mb-4">
        <div class="flex items-center gap-2">
          <input
            v-model="search"
            placeholder="Search borrower, department, purpose, number"
            class="rounded border px-3 py-2 w-64"
          />
          <select v-model="filterStatus" class="rounded border px-3 py-2">
            <option value="">All Status</option>
            <option value="active">Out</option>
            <option value="returned">Returned</option>
            <option value="overdue">Overdue</option>
          </select>
          <button @click="fetchBorrows" class="rounded border px-3 py-2">Refresh</button>
        </div>
        <div class="flex items-center gap-2">
          <div class="text-xs px-2 py-1 rounded bg-gray-100">All: {{ statusCounts.all }}</div>
          <div class="text-xs px-2 py-1 rounded bg-green-100 text-green-800">
            Out: {{ statusCounts.out }}
          </div>
          <div class="text-xs px-2 py-1 rounded bg-gray-100 text-gray-700">
            Returned: {{ statusCounts.returned }}
          </div>
          <div class="text-xs px-2 py-1 rounded bg-red-100 text-red-800">
            Overdue: {{ statusCounts.overdue }}
          </div>
        </div>
        <button @click="createBorrow" class="bg-primary text-white px-6 py-2 rounded">
          Create Borrow Request
        </button>
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
              <th class="p-3 text-left">Date Borrowed</th>
              <th class="p-3 text-left">Expected Return</th>
              <th class="p-3 text-left">Status</th>
              <th class="p-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="borrow in filteredBorrows"
              :key="borrow._id"
              class="border-t hover:bg-gray-50"
            >
              <td class="p-3">
                <div class="font-medium">{{ borrow.borrowNumber }}</div>
              </td>
              <td class="p-3">{{ borrow.borrower }}</td>
              <td class="p-3">
                <span class="px-2 py-1 text-xs rounded bg-gray-100 text-gray-700">{{
                  borrow.borrowerDepartment
                }}</span>
              </td>
              <td class="p-3">{{ borrow.purpose }}</td>
              <td class="p-3">
                <div class="text-sm">{{ itemSummary(borrow) }}</div>
                <div class="text-xs text-bodydark2">{{ borrow.items?.length || 0 }} total</div>
              </td>
              <td class="p-3">{{ formatDate(borrow.dateBorrowed) }}</td>
              <td class="p-3">
                <div class="flex items-center gap-2">
                  <span>{{ formatDate(borrow.expectedReturnDate) }}</span>
                  <!-- <span
                    v-if="isOverdue(borrow)"
                    class="inline-flex items-center px-2 py-0.5 rounded bg-red-100 text-red-700 text-xs"
                    >Overdue</span
                  > -->
                </div>
              </td>
              <td class="p-3">
                <span
                  class="px-2 py-1 rounded text-xs"
                  :class="isOverdue(borrow) ? statusClass('overdue') : statusClass(borrow.status)"
                >
                  {{ isOverdue(borrow) ? 'Overdue' : statusLabel(borrow.status) }}
                </span>
              </td>
              <td class="p-3 text-right">
                <button
                  class="rounded border border-stroke px-3 py-1 text-xs hover:bg-gray-50"
                  @click="
                    router.push({
                      name: 'borrow-detail',
                      params: { id: borrow._id },
                      query: { return: '1' }
                    })
                  "
                  v-if="['active', 'approved', 'pending'].includes(borrow.status)"
                >
                  Return
                </button>
                <button
                  class="rounded border border-stroke px-3 py-1 text-xs hover:bg-gray-50"
                  @click="viewBorrow(borrow._id)"
                  v-if="!['active', 'approved', 'pending'].includes(borrow.status)"
                >
                  View
                </button>
              </td>
            </tr>
          </tbody>
        </table>
        <div
          v-if="!filteredBorrows.length && !loading"
          class="p-6 text-center text-sm text-bodydark2"
        >
          No borrow requests match your filters.
        </div>
      </div>
    </div>
  </DefaultLayout>
</template>
