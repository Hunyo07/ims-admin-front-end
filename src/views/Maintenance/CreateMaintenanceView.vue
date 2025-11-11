<script setup>
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import axios from '@/utils/axios'
import DefaultLayout from '@/layouts/DefaultLayout.vue'
import BreadcrumbDefault from '@/components/Breadcrumbs/BreadcrumbDefault.vue'
import AcnSearchCombobox from '@/components/AcnSearchCombobox.vue'
import EmployeeCombobox from '@/components/EmployeeCombobox.vue'

const router = useRouter()
const inventoryRecordId = ref('')
const itemId = ref('')
const acn = ref('')
const serialNumber = ref('')
const description = ref('')
const issue = ref('')
const serviceProvider = ref('')
const technicianName = ref('')
const dateSent = ref('')
const repairRemarks = ref('')
const status = ref('pending')
const broughtByName = ref('')
const broughtByEmployeeId = ref('')
const acnDetails = ref(null) // end user, specs, status from inventory record
const inventoryRecords = ref([])
const loading = ref(false)
const error = ref(null)

const fetchInventoryRecords = async () => {
  try {
    const { data } = await axios.get('/inventory-records')
    inventoryRecords.value = data.records
  } catch (err) {
    console.error('Error fetching inventory records:', err)
  }
}
const setToday = () => {
  dateSent.value = new Date().toISOString().slice(0, 10)
}

const onRecordSelect = () => {
  const record = inventoryRecords.value.find((r) => r._id === inventoryRecordId.value)
  if (record && record.items?.length) {
    const item = record.items[0]
    itemId.value = item._id
    description.value = item.description
    acn.value = item.acn
    serialNumber.value = item.serialNumber
  }
}

// When ACN is selected via combobox, fetch its inventory record to auto-fill details
const onAcnSelected = async (selected) => {
  const code = selected?.acnCode || selected?.acn || ''
  acn.value = code
  try {
    const { data } = await axios.get('/inventory-records', { params: { acn: code, limit: 1 } })
    const rec = (data?.records || [])[0]
    if (!rec) {
      acnDetails.value = null
      return
    }
    inventoryRecordId.value = rec._id
    // Find item with matching ACN
    const matchItem =
      (rec.items || []).find(
        (it) => String(it.acn || '').toUpperCase() === String(code).toUpperCase()
      ) || rec.items?.[0]
    if (matchItem) {
      itemId.value = matchItem._id
      description.value = matchItem.description || ''
      serialNumber.value = matchItem.serialNumber || ''
      acnDetails.value = {
        endUserOrMR: matchItem.endUserOrMR || '',
        employeeId: matchItem.employeeId || '',
        status: matchItem.status || '',
        specs: matchItem.specs || {}
      }
    } else {
      acnDetails.value = null
    }
  } catch (err) {
    console.error('Failed to fetch inventory record by ACN:', err)
    acnDetails.value = null
  }
}

const submitTicket = async () => {
  if (!issue.value) {
    error.value = 'Issue description is required'
    return
  }
  loading.value = true
  error.value = null
  try {
    const statusForTicket = status.value === 'for_disposal' ? 'beyond_repair' : status.value
    const payload = {
      inventoryRecordId: inventoryRecordId.value || undefined,
      itemId: itemId.value || undefined,
      acn: acn.value,
      serialNumber: serialNumber.value,
      description: description.value,
      issue: issue.value,
      serviceProvider: serviceProvider.value,
      technicianName: technicianName.value,
      dateSent: dateSent.value || undefined,
      repairRemarks: repairRemarks.value || undefined,
      status: statusForTicket || undefined,
      broughtByEmployeeId: broughtByEmployeeId.value || undefined
    }
    const { data } = await axios.post('/maintenance', payload)
    router.push({ name: 'maintenance-detail', params: { id: data.ticket._id } })
  } catch (err) {
    error.value = err.response?.data?.message || err.message
  } finally {
    loading.value = false
  }
}

// Apply actual repair outcome directly to the inventory item status
const applyRepairStatus = async () => {
  if (!inventoryRecordId.value || (!acn.value && !serialNumber.value)) {
    error.value = 'Select ACN/Serial first via the search box'
    return
  }
  loading.value = true
  error.value = null
  try {
    // Map UI status to inventory item status
    const chosen = status.value
    const mappedStatus =
      chosen === 'completed'
        ? 'deployed'
        : chosen === 'beyond_repair'
        ? 'for_disposal'
        : chosen === 'pending' || chosen === 'in_progress'
        ? 'under_repair'
        : chosen

    const body = {
      status: mappedStatus,
      statusNotes:
        repairRemarks.value || (chosen === 'beyond_repair' ? 'Beyond repair' : '')
    }
    if (serialNumber.value) body.serialNumber = serialNumber.value
    else body.acn = acn.value

    await axios.patch(
      `/inventory-records/${inventoryRecordId.value}/items/status`,
      body
    )

    // Refresh ACN details to show updated status
    await onAcnSelected({ acnCode: acn.value })
  } catch (err) {
    error.value = err.response?.data?.message || err.message
  } finally {
    loading.value = false
  }
}

onMounted(fetchInventoryRecords)
</script>

<template>
  <DefaultLayout>
    <BreadcrumbDefault pageTitle="Create Repair" />
    <div class="p-6">
      <div class="bg-white rounded shadow p-6">
        <div v-if="error" class="bg-red-100 text-red-700 p-3 rounded mb-4">{{ error }}</div>

        <form @submit.prevent="submitTicket">
          <div class="grid grid-cols-2 gap-4 mb-4">
            <div class="col-span-2">
              <label class="block mb-2">ACN Search</label>
              <AcnSearchCombobox
                v-model="acn"
                @select="onAcnSelected"
                placeholder="Type ACN or Serial to search"
              />
            </div>

            <div>
              <label class="block text-sm font-medium mb-1">Date</label>
              <div class="flex gap-2">
                <input
                  type="date"
                  v-model="dateSent"
                  class="flex-1 rounded border border-stroke p-2 bg-gray-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-gray-200 focus:border-gray-300"
                />
                <button
                  type="button"
                  @click="setToday"
                  class="rounded border border-stroke px-3 py-2 text-sm hover:bg-gray-50 dark:hover:bg-meta-4 dark:border-strokedark"
                >
                  Today
                </button>
              </div>
            </div>
            <div>
              <label class="block mb-2">ACN</label>
              <input
                v-model="acn"
                type="text"
                readonly
                class="w-full border border-stroke rounded px-3 py-2 bg-gray-50"
              />
            </div>
            <div>
              <label class="block mb-2">Serial Number</label>
              <input
                v-model="serialNumber"
                type="text"
                readonly
                class="w-full border border-stroke rounded px-3 py-2 bg-gray-50"
              />
            </div>
            <div class="col-span-2">
              <label class="block mb-2"
                >Issue Description <span class="text-red-500">*</span></label
              >
              <textarea
                v-model="issue"
                required
                class="w-full border border-stroke rounded px-3 py-2"
                rows="3"
              ></textarea>
            </div>
            <div class="col-span-2" v-if="acnDetails">
              <div class="grid grid-cols-2 gap-3 p-3 rounded border border-stroke bg-gray-50">
                <div>
                  <div class="text-xs text-bodydark2 mb-1">End User</div>
                  <div class="text-sm font-medium">{{ acnDetails.endUserOrMR || '—' }}</div>
                </div>
                <div>
                  <div class="text-xs text-bodydark2 mb-1">Status</div>
                  <div class="text-sm font-medium">{{ acnDetails.status || '—' }}</div>
                </div>
                <div class="col-span-2">
                  <div class="text-xs text-bodydark2 mb-1">Specs</div>
                  <div class="text-sm bg-white p-2 rounded border border-stroke">
                    <div>Processor: {{ acnDetails.specs?.processor || '—' }}</div>
                    <div>Storage: {{ acnDetails.specs?.storage || '—' }}</div>
                    <div>RAM: {{ acnDetails.specs?.ram || '—' }}</div>
                    <div>Video Card: {{ acnDetails.specs?.videoCard || '—' }}</div>
                    <div>Brand: {{ acnDetails.specs?.brand || '—' }}</div>
                    <div>Monitor Size: {{ acnDetails.specs?.monitorSize || '—' }}</div>
                  </div>
                </div>
              </div>
            </div>

            <div>
              <label class="block mb-2">Recieve By</label>
              <input
                v-model="technicianName"
                type="text"
                class="w-full border border-stroke rounded px-3 py-2"
              />
            </div>
            <div>
              <label class="block mb-2">Brought By</label>
              <EmployeeCombobox
                v-model="broughtByName"
                @select="
                  (emp) => {
                    broughtByEmployeeId.value = emp._id
                    broughtByName.value = `${emp.firstName} ${emp.lastName}`
                  }
                "
                placeholder="Search employee"
              />
            </div>
            <div>
              <label class="block mb-2">Status</label>
              <select
                v-model="status"
                class="w-full border border-stroke rounded px-3 py-2 bg-white"
              >
                <option value="pending">Under Repair</option>
                <option value="in_progress">In Progress</option>
                <option value="completed">Repaired</option>
                <option value="beyond_repair">Beyond Repair</option>
                <option value="for_disposal">For Disposal</option>
              </select>
            </div>
            <div class="col-span-2">
              <label class="block mb-2">Remarks</label>
              <textarea
                v-model="repairRemarks"
                class="w-full border border-stroke rounded px-3 py-2"
                rows="2"
              ></textarea>
            </div>
          </div>

          <div class="flex gap-2">
            <button
              type="submit"
              :disabled="loading"
              class="bg-primary text-white px-6 py-2 rounded"
            >
              {{ loading ? 'Creating...' : 'Create Ticket' }}
            </button>
            <button
              type="button"
              :disabled="loading || !inventoryRecordId"
              @click="applyRepairStatus"
              class="border px-6 py-2 rounded"
              title="Update actual item status using the selected ACN/Serial"
            >
              {{ loading ? 'Updating...' : 'Update Item Status' }}
            </button>
            <button type="button" @click="router.back()" class="border px-6 py-2 rounded">
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  </DefaultLayout>
</template>
