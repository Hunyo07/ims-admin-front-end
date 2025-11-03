<script setup>
import { ref, onMounted, computed } from 'vue'
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

const fetchDR = async () => {
  try {
    isLoading.value = true
    const { data } = await axios.get(`/delivery-receipts/${route.params.id}`)
    dr.value = data?.deliveryReceipt
  } catch (e) {
    console.error('Error fetching DR:', e)
    dr.value = null
  } finally {
    isLoading.value = false
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

const updateItem = async (item) => {
  try {
    isSaving.value = true
    saveMessage.value = ''
    await axios.patch(`/delivery-receipts/${dr.value._id}/items/${item._id}`, {
      endUserId: item.endUser?._id || item.endUser || '',
      departmentId: item.department?._id || item.department || '',
      deploymentStatus: item.deploymentStatus,
      deployedAt: item.deployedAt || ''
    })
    saveMessage.value = 'Item updated successfully'
    setTimeout(() => {
      saveMessage.value = ''
    }, 3000)
    await fetchDR()
  } catch (e) {
    saveMessage.value = e?.response?.data?.message || 'Failed to update item'
  } finally {
    isSaving.value = false
  }
}

const getStatusBadgeClass = (status) => {
  return status === 'posted' ? 'bg-success/10 text-success' : 'bg-bodydark/10 text-bodydark'
}

const getPurposeBadgeClass = (purpose) => {
  return purpose === 'stock' ? 'bg-success/10 text-success' : 'bg-warning/10 text-warning'
}

const getDeploymentStatusClass = (status) => {
  switch (status) {
    case 'deployed':
      return 'bg-success/10 text-success'
    case 'cancelled':
      return 'bg-danger/10 text-danger'
    default:
      return 'bg-warning/10 text-warning'
  }
}

onMounted(() => {
  fetchUsers()
  fetchDepartments()
  fetchDR()
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
                :class="`inline-block px-3 py-1 rounded text-xs font-medium ${getPurposeBadgeClass(
                  dr.purpose
                )}`"
              >
                {{ dr.purpose === 'stock' ? 'For Stocks' : 'For Deployment' }}
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

      <!-- Items Section -->
      <div
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
                        class="text-xs text-bodydark2"
                      >
                        {{ sn }}
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
                        class="text-xs text-success font-mono"
                      >
                        {{ acn }}
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
                    <option v-for="u in users" :key="u._id" :value="u._id">
                      {{ u.firstName }} {{ u.lastName }}
                    </option>
                  </select>
                </td>
                <td class="py-3 px-4">
                  <select
                    v-model="it.department"
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
                    <option value="deployed">Deployed</option>
                    <option value="cancelled">Cancelled</option>
                  </select>
                </td>
                <td class="py-3 px-4">
                  <input
                    type="date"
                    v-model="it.deployedAt"
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
