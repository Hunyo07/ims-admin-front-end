<script setup>
import { ref, onMounted, computed, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import axios from '../../utils/axios'
import DefaultLayout from '../../layouts/DefaultLayout.vue'
import { useAuthStore } from '../../stores/auth'

const authStore = useAuthStore()
const route = useRoute()
const router = useRouter()

const dr = ref(null)
const isLoading = ref(false)
const isSaving = ref(false)
const users = ref([])
const departments = ref([])
const saveMessage = ref('')
const assignmentAcnMap = ref({})
const assignmentSerialMap = ref({})
const usersByDept = ref({})

// Per-asset decompressed rows (ACN/Serial)
const decompressedRows = computed(() => {
  const rows = []
  const items = dr.value?.items || []
  for (const it of items) {
    const serials = Array.isArray(it.serialNumbers) ? it.serialNumbers : []
    const acns = Array.isArray(it.generatedACNs) ? it.generatedACNs : []
    const maxLen = Math.max(serials.length, acns.length)
    if (maxLen === 0) continue
    for (let i = 0; i < maxLen; i++) {
      const sn = serials[i] || ''
      const acn = acns[i] || ''
      rows.push({
        key: `${it._id}:${acn || sn || i}`,
        drItemId: it._id,
        productName: it.product?.name || '—',
        serialNumber: sn,
        acn,
        notes: it.notes || '',
        endUser: it.endUser,
        department: it.department,
        status: it.deploymentStatus,
        deployedAt: it.deployedAt
      })
    }
  }
  try {
    console.debug(
      '[DR] Decompressed rows deployedAt:',
      rows.map((r) => r.deployedAt)
    )
  } catch (_) {
    console.log(`This is rerror ${_}`)
  }
  return rows
})

const getEmployeeName = (endUser) => {
  if (!endUser) return '—'
  if (typeof endUser === 'string') {
    const allDeptUsers = Object.values(usersByDept.value).flat()
    const u =
      allDeptUsers.find((x) => x._id === endUser) || users.value.find((x) => x._id === endUser)
    return u ? `${u.firstName} ${u.lastName}` : '—'
  }
  const first = endUser.firstName || ''
  const last = endUser.lastName || ''
  const full = `${first} ${last}`.trim()
  return full || '—'
}

const getDepartmentName = (dept) => {
  if (!dept) return '—'
  if (typeof dept === 'string') {
    const d = departments.value.find((x) => x._id === dept)
    return d ? d.name : '—'
  }
  return dept.name || '—'
}

const getAssignmentForRow = (row) => {
  if (row.acn && assignmentAcnMap.value[row.acn]) return assignmentAcnMap.value[row.acn]
  if (row.serialNumber && assignmentSerialMap.value[row.serialNumber])
    return assignmentSerialMap.value[row.serialNumber]
  return null
}

// Prefer inventory record statusDate for deployed date display
const getDeployedAtForRow = (row) => {
  const assign = getAssignmentForRow(row)
  const candidate =
    (assign?.status === 'deployed' ? assign.statusDate : null) || row.deployedAt || ''
  return candidate
}

// Format date for display in table (consistent with header sections)
const formatDateForDisplay = (val) => {
  if (!val) return '—'
  const d = new Date(val)
  return isNaN(d.getTime()) ? '—' : d.toLocaleDateString()
}

// Determine effective item status preferring assignment map
const getEffectiveStatusForRow = (row) => {
  const assign = getAssignmentForRow(row)
  // If this specific ACN/Serial is assigned in inventory, use that status
  if (assign?.assigned) {
    return assign.status || 'deployed'
  }
  // If not assigned in inventory, it's not actually deployed yet
  return 'pending'
}

// Human-friendly label for status
const formatStatusLabel = (status) => {
  switch (status) {
    case 'deployed':
      return 'Deployed'
    case 'delivered':
      return 'Delivered'
    case 'cancelled':
      return 'Cancelled'
    default:
      return 'Pending'
  }
}

const showGrouped = ref(false)

// Date helpers to ensure proper ISO ↔ input format
const formatDateForInput = (val) => {
  if (!val) {
    try {
      console.debug('[DR] formatDateForInput: empty input', val)
    } catch (_) {
      console
    }
    return ''
  }
  const d = new Date(val)
  if (isNaN(d.getTime())) {
    try {
      console.debug('[DR] formatDateForInput: invalid date', val)
    } catch (_) {
      console.log(_)
    }
    return ''
  }
  const yyyy = d.getFullYear()
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  const out = `${yyyy}-${mm}-${dd}`
  try {
    console.debug('[DR] formatDateForInput:', val, '->', out)
  } catch (_) {
    console.log(_)
  }
  return out
}
const parseDateFromInput = (val) => {
  if (!val) return ''
  const d = new Date(val)
  return isNaN(d.getTime()) ? '' : d.toISOString()
}

const fetchDR = async () => {
  try {
    isLoading.value = true
    const { data } = await axios.get(`/delivery-receipts/${route.params.id}`)
    dr.value = data?.deliveryReceipt
    if (dr.value?.items) {
      console.debug(
        '[DR] Fetched items deployedAt:',
        dr.value.items.map((it) => it.deployedAt)
      )
    }
  } catch (e) {
    console.error('Error fetching DR:', e)
    dr.value = null
  } finally {
    isLoading.value = false
  }
}

// Watch for item changes to trace deployedAt across updates
watch(
  () => dr.value?.items,
  (newItems) => {
    if (!newItems) return
    try {
      console.debug(
        '[DR] Watch items deployedAt:',
        newItems.map((it) => ({
          id: it._id,
          status: it.deploymentStatus,
          deployedAt: it.deployedAt
        }))
      )
    } catch (_) {
      console.log(_)
    }
  },
  { deep: true }
)

const refreshAssignmentStatus = async () => {
  try {
    const acnCodes = Array.from(
      new Set((dr.value?.items || []).flatMap((it) => it.generatedACNs || []))
    )
    const serialNumbers = Array.from(
      new Set((dr.value?.items || []).flatMap((it) => it.serialNumbers || []))
    )
    if (acnCodes.length === 0 && serialNumbers.length === 0) {
      assignmentAcnMap.value = {}
      assignmentSerialMap.value = {}
      return
    }
    const { data } = await axios.post('/acns/assignment-status', { acnCodes, serialNumbers })
    assignmentAcnMap.value = data?.assignments?.acn || {}
    assignmentSerialMap.value = data?.assignments?.serial || {}
  } catch (e) {
    console.warn('Failed to refresh assignment status', e)
  }
}

const fetchUsers = async () => {
  try {
    const { data } = await axios.get('/employees')
    users.value = data?.employees || []
  } catch (_) {
    users.value = []
  }
}

const fetchDepartments = async () => {
  try {
    const { data } = await axios.get('/departments')
    departments.value = data || []
  } catch (_) {
    departments.value = []
  }
}

// Department-filtered users for deployment
const getUsersForDepartment = async (departmentId) => {
  try {
    if (!departmentId) return []
    if (usersByDept.value[departmentId]) return usersByDept.value[departmentId]
    const { data } = await axios.get('/delivery-receipts/deployment/available-users', {
      params: { departmentId }
    })
    const list = data?.users || []
    usersByDept.value[departmentId] = list
    return list
  } catch (_) {
    usersByDept.value[departmentId] = []
    return []
  }
}

const onDepartmentChange = async (item) => {
  const deptId = item.department?._id || item.department || ''
  if (!deptId) return
  await getUsersForDepartment(deptId)
}

const updateItem = async (item) => {
  try {
    isSaving.value = true
    saveMessage.value = ''
    // Determine deployedAt payload based on deploymentStatus
    let deployedAtPayload = ''
    if (item.deploymentStatus === 'deployed') {
      // If status is deployed and no date set yet, default to now
      deployedAtPayload = item.deployedAt || new Date().toISOString()
    } else if (
      item.deploymentStatus === 'cancelled' ||
      item.deploymentStatus === 'pending' ||
      item.deploymentStatus === 'delivered'
    ) {
      // Clear date for non-deployed statuses
      deployedAtPayload = ''
    } else {
      deployedAtPayload = item.deployedAt || ''
    }

    const { data } = await axios.patch(`/delivery-receipts/${dr.value._id}/items/${item._id}`, {
      endUserId: item.endUser?._id || item.endUser || '',
      departmentId: item.department?._id || item.department || '',
      deploymentStatus: item.deploymentStatus,
      deployedAt: deployedAtPayload
    })
    saveMessage.value = 'Item updated successfully'
    setTimeout(() => {
      saveMessage.value = ''
    }, 3000)
    // Use PATCH response to update local state immediately
    if (data?.deliveryReceipt) {
      dr.value = data.deliveryReceipt
      if (dr.value?.items) {
        console.debug(
          '[DR] After PATCH items deployedAt:',
          dr.value.items.map((it) => it.deployedAt)
        )
      }
    } else {
      await fetchDR()
    }
    await refreshAssignmentStatus()
  } catch (e) {
    saveMessage.value = e?.response?.data?.message || 'Failed to update item'
  } finally {
    isSaving.value = false
  }
}

const getStatusBadgeClass = (status) => {
  return status === 'posted' ? 'bg-success/10 text-success' : 'bg-bodydark/10 text-bodydark'
}

const getPurposeBadgeClass = () => {
  // DRs are stock-only; always render success badge
  return 'bg-success/10 text-success'
}

const getDeploymentStatusClass = (status) => {
  switch (status) {
    case 'deployed':
      return 'bg-success/10 text-success'
    case 'delivered':
      return 'bg-primary/10 text-primary'
    case 'cancelled':
      return 'bg-danger/10 text-danger'
    default:
      return 'bg-warning/10 text-warning'
  }
}

const getInventoryStatusClass = (status) => {
  switch (status) {
    case 'deployed':
      return 'bg-success/10 text-success'
    case 'under_repair':
    case 'repair':
      return 'bg-warning/10 text-warning'
    case 'returned':
      return 'bg-primary/10 text-primary'
    case 'retired':
    case 'for_disposal':
      return 'bg-danger/10 text-danger'
    case 'replaced':
      return 'bg-bodydark/10 text-bodydark'
    default:
      return 'bg-gray/10 text-gray'
  }
}

const formatInventoryStatusLabel = (status) => {
  const labels = {
    deployed: 'Deployed',
    under_repair: 'Under Repair',
    repair: 'Repair',
    returned: 'Returned',
    retired: 'Retired',
    for_disposal: 'For Disposal',
    replaced: 'Replaced'
  }
  return labels[status] || status
}

onMounted(() => {
  fetchUsers()
  fetchDepartments()
  fetchDR().then(() => refreshAssignmentStatus())
})
</script>

<template>
  <DefaultLayout>
    <!-- Header -->
    <div class="mb-6 flex items-center justify-between">
      <div>
        <h1 class="text-2xl font-bold text-black dark:text-white">Delivery Receipt Details</h1>
        <p class="text-sm text-bodydark2 mt-1">View and manage delivery receipt information</p>
      </div>
      <router-link
        to="/inventory/delivery-receipts"
        class="rounded border border-stroke px-4 py-2 text-sm font-medium hover:bg-gray-50 dark:hover:bg-meta-4 transition"
      >
        ← Back to List
      </router-link>
    </div>

    <!-- Loading State -->
    <div
      v-if="isLoading"
      class="rounded-sm border border-stroke bg-white shadow-default dark:border-strokedark dark:bg-boxdark p-8"
    >
      <div class="flex items-center justify-center gap-3">
        <div
          class="h-5 w-5 rounded-full border-2 border-primary border-t-transparent animate-spin"
        ></div>
        <span class="text-sm text-bodydark2">Loading delivery receipt...</span>
      </div>
    </div>

    <!-- Not Found State -->
    <div
      v-else-if="!dr"
      class="rounded-sm border border-stroke bg-white shadow-default dark:border-strokedark dark:bg-boxdark p-8"
    >
      <div class="flex flex-col items-center gap-3">
        <svg
          class="h-16 w-16 text-bodydark2 opacity-50"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            stroke-linecap="round"
            stroke-linejoin="round"
            stroke-width="2"
            d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
          />
        </svg>
        <span class="text-sm text-bodydark2">Delivery receipt not found</span>
        <router-link
          to="/inventory/delivery-receipts"
          class="mt-2 text-primary text-sm font-medium hover:underline"
        >
          Return to list
        </router-link>
      </div>
    </div>

    <!-- Content -->
    <div v-else>
      <!-- Success Message -->
      <div
        v-if="saveMessage"
        class="mb-4 p-3 rounded bg-success/10 text-success text-sm border border-success/20"
      >
        {{ saveMessage }}
      </div>

      <!-- DR Header Card -->
      <div
        class="rounded-sm border border-stroke bg-white shadow-default dark:border-strokedark dark:bg-boxdark mb-6"
      >
        <div class="border-b border-stroke dark:border-strokedark p-6">
          <div class="flex items-start justify-between mb-4">
            <div>
              <h2 class="text-xl font-bold text-black dark:text-white">{{ dr.drNumber }}</h2>
              <p class="text-sm text-bodydark2 mt-1">{{ dr.supplier?.name }}</p>
            </div>
            <div class="flex gap-2">
              <span
                :class="`inline-block px-3 py-1 rounded text-xs font-medium ${getPurposeBadgeClass()}`"
              >
                For Stocks
              </span>
              <span
                :class="`inline-block px-3 py-1 rounded text-xs font-medium ${getStatusBadgeClass(
                  dr.status
                )}`"
              >
                {{ dr.status === 'posted' ? 'Posted' : 'Received' }}
              </span>
            </div>
          </div>

          <!-- Info Grid -->
          <div class="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <p class="text-xs text-bodydark2 mb-1">Date Received</p>
              <p class="font-medium text-sm">
                {{ new Date(dr.dateReceived).toLocaleDateString() }}
              </p>
            </div>
            <div>
              <p class="text-xs text-bodydark2 mb-1">Total Items</p>
              <p class="font-medium text-sm">{{ dr.items?.length || 0 }}</p>
            </div>
            <div>
              <p class="text-xs text-bodydark2 mb-1">Created By</p>
              <p class="font-medium text-sm">{{ dr.createdBy?.role || '—' }}</p>
            </div>
            <div v-if="dr.postedAt">
              <p class="text-xs text-bodydark2 mb-1">Posted At</p>
              <p class="font-medium text-sm">{{ new Date(dr.postedAt).toLocaleDateString() }}</p>
            </div>
          </div>

          <!-- Stock Update Status -->
          <div
            v-if="dr.purpose === 'stock'"
            class="mt-4 p-3 rounded"
            :class="
              dr.status === 'posted'
                ? 'bg-success/10 border border-success/20'
                : 'bg-warning/10 border border-warning/20'
            "
          >
            <div class="flex items-center gap-2">
              <svg
                v-if="dr.status === 'posted'"
                class="h-4 w-4 text-success"
                fill="currentColor"
                viewBox="0 0 20 20"
              >
                <path
                  fill-rule="evenodd"
                  d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                  clip-rule="evenodd"
                />
              </svg>
              <svg v-else class="h-4 w-4 text-warning" fill="currentColor" viewBox="0 0 20 20">
                <path
                  fill-rule="evenodd"
                  d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z"
                  clip-rule="evenodd"
                />
              </svg>
              <span
                class="text-xs font-medium"
                :class="dr.status === 'posted' ? 'text-success' : 'text-warning'"
              >
                {{
                  dr.status === 'posted'
                    ? 'Stock has been updated and ACNs generated'
                    : 'Stock not yet updated'
                }}
              </span>
            </div>
          </div>
        </div>

        <!-- DR Image Preview -->
        <div v-if="dr.images?.length" class="border-b border-stroke dark:border-strokedark p-6">
          <p class="text-sm font-semibold mb-3">Proof of Delivery</p>

          <div class="flex flex-wrap items-center gap-4">
            <div
              v-for="(image, index) in dr.images"
              :key="image._id || index"
              class="flex flex-col items-center"
            >
              <img
                :src="image.url"
                class="h-32 w-32 object-cover rounded border border-stroke dark:border-strokedark"
                alt="DR Proof"
              />
              <a
                :href="image.url"
                target="_blank"
                class="text-primary text-xs font-medium hover:underline mt-2"
              >
                View Full Image →
              </a>
            </div>
          </div>
        </div>
      </div>

      <!-- Per-Asset Lines (Decompressed) -->
      <div
        class="rounded-sm border border-stroke bg-white shadow-default dark:border-strokedark dark:bg-boxdark mb-6"
      >
        <div
          class="border-b border-stroke dark:border-strokedark p-6 flex items-center justify-between"
        >
          <div>
            <h3 class="text-lg font-semibold">
              Per-Asset Lines (ACN/Serial) ({{ decompressedRows.length }})
            </h3>
            <p class="text-xs text-bodydark2 mt-1">
              Each ACN/Serial tracked individually with assignment status
            </p>
          </div>
          <button
            @click="showGrouped = !showGrouped"
            class="rounded border border-stroke px-3 py-1 text-xs font-medium hover:bg-gray-50 dark:hover:bg-meta-4 transition"
          >
            {{ showGrouped ? 'Hide Grouped Items' : 'Show Grouped Items' }}
          </button>
        </div>
        <div class="overflow-x-auto">
          <table class="w-full table-auto">
            <thead>
              <tr class="bg-gray-2 text-left dark:bg-meta-4">
                <th class="py-3 px-4 font-semibold text-sm">Product</th>
                <th class="py-3 px-4 font-semibold text-sm">Serial</th>
                <th class="py-3 px-4 font-semibold text-sm">ACN</th>
                <th class="py-3 px-4 font-semibold text-sm">End User</th>
                <th class="py-3 px-4 font-semibold text-sm">Department</th>
                <th class="py-3 px-4 font-semibold text-sm">Item Status</th>
                <th class="py-3 px-4 font-semibold text-sm">Deployed At</th>
              </tr>
            </thead>
            <tbody>
              <tr
                v-for="row in decompressedRows"
                :key="row.key"
                class="border-b border-stroke dark:border-strokedark hover:bg-gray-50 dark:hover:bg-meta-4 transition"
              >
                <td class="py-3 px-4">
                  <span class="text-sm font-medium">{{ row.productName }}</span>
                </td>
                <td class="py-3 px-4">
                  <span class="text-sm font-mono">{{ row.serialNumber || '—' }}</span>
                </td>
                <td class="py-3 px-4">
                  <span class="text-sm font-mono text-success">{{ row.acn || '—' }}</span>
                </td>
                <td class="py-3 px-4">
                  <span class="text-sm">{{
                    getAssignmentForRow(row)?.endUserOrMR || getEmployeeName(row.endUser)
                  }}</span>
                </td>
                <td class="py-3 px-4">
                  <span class="text-sm">{{ getAssignmentForRow(row)?.department || '—' }}</span>
                </td>
                <td class="py-3 px-4">
                  <div class="flex flex-col gap-1">
                    <!-- Item Status (from inventory if assigned, otherwise pending) -->
                    <div class="flex items-center gap-2">
                      <span
                        :class="`inline-block px-2 py-1 rounded text-xs font-medium ${
                          getAssignmentForRow(row)?.assigned
                            ? getInventoryStatusClass(getAssignmentForRow(row).status)
                            : 'bg-warning/10 text-warning'
                        }`"
                      >
                        {{
                          getAssignmentForRow(row)?.assigned
                            ? formatInventoryStatusLabel(getAssignmentForRow(row).status)
                            : 'Pending'
                        }}
                      </span>
                    </div>

                    <!-- Repair Ticket Link (if under repair) -->
                    <div v-if="getAssignmentForRow(row)?.repairTicket" class="mt-1">
                      <router-link
                        :to="`/maintenance/repair/${getAssignmentForRow(row).repairTicket}`"
                        class="text-xs text-primary hover:underline flex items-center gap-1"
                      >
                        <svg class="h-3 w-3" fill="currentColor" viewBox="0 0 20 20">
                          <path
                            d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z"
                          />
                        </svg>
                        {{ getAssignmentForRow(row).repairTicketNumber }}
                      </router-link>
                    </div>
                  </div>
                </td>
                <td class="py-3 px-4">
                  <span class="text-sm">
                    {{ formatDateForDisplay(getDeployedAtForRow(row)) }}
                  </span>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
        <div v-if="decompressedRows.length === 0" class="p-8 text-center">
          <p class="text-sm text-bodydark2">No ACNs or Serials to display</p>
        </div>
      </div>

      <!-- Items Section (Grouped, optional) -->
      <div
        v-show="showGrouped"
        class="rounded-sm border border-stroke bg-white shadow-default dark:border-strokedark dark:bg-boxdark"
      >
        <div class="border-b border-stroke dark:border-strokedark p-6">
          <h3 class="text-lg font-semibold">Items ({{ dr.items?.length || 0 }})</h3>
          <p class="text-xs text-bodydark2 mt-1">Manage item details and deployment status</p>
        </div>

        <div class="overflow-x-auto">
          <table class="w-full table-auto">
            <thead>
              <tr class="bg-gray-2 text-left dark:bg-meta-4">
                <th class="py-3 px-4 font-semibold text-sm">Product</th>
                <th class="py-3 px-4 font-semibold text-sm text-center">Qty</th>
                <th class="py-3 px-4 font-semibold text-sm text-center">Serials</th>
                <th class="py-3 px-4 font-semibold text-sm text-center">ACNs</th>
                <th class="py-3 px-4 font-semibold text-sm">Notes</th>
                <th class="py-3 px-4 font-semibold text-sm">End User</th>
                <th class="py-3 px-4 font-semibold text-sm">Department</th>
                <th class="py-3 px-4 font-semibold text-sm">Status</th>
                <th class="py-3 px-4 font-semibold text-sm">Deployed At</th>
                <th class="py-3 px-4 font-semibold text-sm">Action</th>
              </tr>
            </thead>
            <tbody>
              <tr
                v-for="it in dr.items"
                :key="it._id"
                class="border-b border-stroke dark:border-strokedark hover:bg-gray-50 dark:hover:bg-meta-4 transition"
              >
                <td class="py-3 px-4">
                  <div>
                    <span class="text-sm font-medium">{{ it.product?.name || '—' }}</span>
                    <div v-if="dr.status === 'posted'" class="text-xs text-success mt-1">
                      ✓ Stock updated
                    </div>
                  </div>
                </td>
                <td class="py-3 px-4 text-center">
                  <span
                    class="inline-block px-2 py-1 rounded bg-bodydark/10 text-bodydark text-xs font-medium"
                  >
                    {{ it.qty }}
                  </span>
                </td>
                <td class="py-3 px-4 text-center">
                  <div v-if="(it.serialNumbers || []).length > 0">
                    <button
                      @click="it._showSerials = !it._showSerials"
                      class="text-primary text-xs font-medium hover:underline"
                    >
                      {{ (it.serialNumbers || []).length }} serial(s)
                    </button>
                    <div
                      v-if="it._showSerials"
                      class="mt-2 p-2 bg-gray-50 dark:bg-boxdark rounded text-left max-h-32 overflow-y-auto"
                    >
                      <div
                        v-for="(sn, idx) in it.serialNumbers"
                        :key="idx"
                        class="text-xs text-bodydark2 flex items-center justify-between gap-2"
                      >
                        <span class="font-mono">{{ sn }}</span>
                        <span
                          v-if="assignmentSerialMap[sn]?.assigned"
                          class="inline-flex rounded-full bg-primary/10 text-primary px-2 py-0.5"
                        >
                          Assigned to {{ assignmentSerialMap[sn].endUserOrMR }} ({{
                            assignmentSerialMap[sn].department
                          }})
                        </span>
                        <span
                          v-else
                          class="inline-flex rounded-full bg-bodydark/10 text-bodydark px-2 py-0.5"
                        >
                          Unassigned
                        </span>
                      </div>
                    </div>
                  </div>
                  <span v-else class="text-sm text-bodydark2">—</span>
                </td>
                <td class="py-3 px-4 text-center">
                  <div v-if="(it.generatedACNs || []).length > 0">
                    <button
                      @click="it._showACNs = !it._showACNs"
                      class="text-success text-xs font-medium hover:underline"
                    >
                      {{ (it.generatedACNs || []).length }} ACN(s)
                    </button>
                    <div
                      v-if="it._showACNs"
                      class="mt-2 p-2 bg-success/5 rounded text-left max-h-32 overflow-y-auto"
                    >
                      <div
                        v-for="(acn, idx) in it.generatedACNs"
                        :key="idx"
                        class="text-xs text-success font-mono flex items-center justify-between gap-2"
                      >
                        <span>{{ acn }}</span>
                        <span
                          v-if="assignmentAcnMap[acn]?.assigned"
                          class="inline-flex rounded-full bg-primary/10 text-primary px-2 py-0.5"
                        >
                          Assigned to {{ assignmentAcnMap[acn].endUserOrMR }} ({{
                            assignmentAcnMap[acn].department
                          }})
                        </span>
                        <span
                          v-else
                          class="inline-flex rounded-full bg-bodydark/10 text-bodydark px-2 py-0.5"
                        >
                          Unassigned
                        </span>
                      </div>
                    </div>
                  </div>
                  <span v-else class="text-sm text-bodydark2">—</span>
                </td>
                <td class="py-3 px-4">
                  <span class="text-sm text-bodydark2">{{ it.notes || '—' }}</span>
                </td>
                <td class="py-3 px-4">
                  <select
                    v-model="it.endUser"
                    class="rounded border border-stroke p-2 text-xs dark:border-strokedark dark:bg-form-input"
                  >
                    <option :value="undefined">—</option>
                    <template v-if="it.department">
                      <option
                        v-for="u in usersByDept[it.department?._id || it.department] || []"
                        :key="u._id"
                        :value="u._id"
                      >
                        {{ u.firstName }} {{ u.lastName }}
                      </option>
                    </template>
                  </select>
                </td>
                <td class="py-3 px-4">
                  <select
                    v-model="it.department"
                    @change="onDepartmentChange(it)"
                    class="rounded border border-stroke p-2 text-xs dark:border-strokedark dark:bg-form-input"
                  >
                    <option :value="undefined">—</option>
                    <option v-for="d in departments" :key="d._id" :value="d._id">
                      {{ d.name }}
                    </option>
                  </select>
                </td>
                <td class="py-3 px-4">
                  <select
                    v-model="it.deploymentStatus"
                    :class="`rounded border border-stroke p-2 text-xs font-medium dark:border-strokedark dark:bg-form-input ${getDeploymentStatusClass(
                      it.deploymentStatus
                    )}`"
                  >
                    <option value="pending">Pending</option>
                    <option value="delivered">Delivered</option>
                    <option value="deployed">Deployed</option>
                    <option value="cancelled">Cancelled</option>
                  </select>
                </td>
                <td class="py-3 px-4">
                  <input
                    type="date"
                    :value="formatDateForInput(it.deployedAt)"
                    @input="it.deployedAt = parseDateFromInput($event.target.value)"
                    class="rounded border border-stroke p-2 text-xs dark:border-strokedark dark:bg-form-input"
                  />
                </td>
                <td class="py-3 px-4">
                  <button
                    @click="updateItem(it)"
                    :disabled="isSaving"
                    class="rounded bg-primary text-white px-3 py-1 text-xs font-medium hover:bg-opacity-90 disabled:opacity-50 transition"
                  >
                    {{ isSaving ? 'Saving...' : 'Save' }}
                  </button>
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <!-- Empty Items State -->
        <div v-if="!dr.items || dr.items.length === 0" class="p-8 text-center">
          <p class="text-sm text-bodydark2">No items in this delivery receipt</p>
        </div>
      </div>
    </div>
  </DefaultLayout>
</template>
