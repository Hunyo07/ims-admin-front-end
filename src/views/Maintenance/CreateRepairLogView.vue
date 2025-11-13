<script setup>
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import axios from '@/utils/axios'
import { useAuthStore } from '@/stores'
import DefaultLayout from '@/layouts/DefaultLayout.vue'
import EmployeeCombobox from '@/components/EmployeeCombobox.vue'
import AcnCombobox from '@/components/AcnCombobox.vue'

const auth = useAuthStore()
const router = useRouter()

const form = ref({
  acn: '',
  purpose: '',
  remarks: '',
  broughtByName: '',
  broughtByEmployeeId: '',
  technicianName: '',
  status: 'for_inspection'
})
const loading = ref(false)
const error = ref('')
const success = ref('')

// Modal state
const isOpen = ref(false)
const close = () => {
  isOpen.value = false
  // Navigate back to previous page after closing
  router.back()
}
onMounted(() => {
  isOpen.value = true
})

// Selected ACN item details (for display-only)
const selectedItem = ref(null)
const selectedRecord = ref(null)

const onAcnSelect = (payload) => {
  form.value.acn = payload?.acn || ''
  selectedItem.value = payload?.item || null
  selectedRecord.value = payload?.record || null
  // If the inventory item has an endUser/MR, default requester
  const defaultRequester = payload?.item?.endUserOrMR || ''
  if (defaultRequester && !form.value.broughtByName) {
    form.value.broughtByName = defaultRequester
  }
}

const submit = async () => {
  loading.value = true
  error.value = ''
  success.value = ''
  try {
    const payload = {
      acn: form.value.acn || undefined,
      purpose: form.value.purpose || 'Repair & Maintenance',
      remarks: form.value.remarks || undefined,
      status: form.value.status || 'under_repair',
      broughtBy: {
        name: form.value.broughtByName || '',
        employee: form.value.broughtByEmployeeId || undefined
      },
      technician: { name: form.value.technicianName || '' }
    }
    const { data } = await axios.post('/maintenance/logs', payload)
    if (!data?.success) throw new Error(data?.message || 'Failed to create repair log')
    success.value = `Created Repair Log ${data.log?.logNumber}`
  } catch (e) {
    error.value = e.response?.data?.message || e.message || String(e)
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <DefaultLayout>
    <!-- Modal overlay and container -->
    <div v-if="isOpen" class="fixed inset-0 z-50">
      <div class="absolute inset-0 bg-black/30" @click="close"></div>
      <div class="absolute inset-0 mt-15 flex items-center justify-center p-4 sm:p-6">
        <div
          class="w-full max-w-full sm:max-w-2xl md:max-w-4xl lg:max-w-5xl my-6 sm:my-8 rounded-sm border border-stroke bg-white shadow-default dark:border-strokedark dark:bg-boxdark max-h-[90vh] flex flex-col"
        >
          <!-- Modal Body -->
          <div class="p-4 overflow-y-auto">
            <div
              class="bg-white dark:bg-boxdark z-10 flex items-center justify-between border-b border-stroke dark:border-strokedark"
            >
              <div>
                <h2 class="text-xl font-semibold text-black dark:text-white">Create Repair Log</h2>
                <p class="text-xs text-bodydark2">Record a new maintenance or repair activity</p>
              </div>
              <button
                type="button"
                @click="close"
                class="px-3 py-1 rounded bg-gray-100 hover:bg-gray-200 text-sm"
              >
                Close
              </button>
            </div>
            <div
              v-if="error"
              class="mb-3 p-3 rounded bg-danger/10 text-danger text-sm border border-danger/20"
            >
              {{ error }}
            </div>
            <div
              v-if="success"
              class="mb-3 p-3 rounded bg-success/10 text-success text-sm border border-success/20"
            >
              {{ success }}
            </div>

            <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
              <!-- Left: Selection and form -->
              <div class="space-y-4">
                <div>
                  <label class="block text-sm font-medium mb-2">ACN</label>
                  <AcnCombobox
                    v-model="form.acn"
                    placeholder="Search deployed ACN"
                    @select="onAcnSelect"
                  />
                  <p class="text-xs text-bodydark2 mt-1">
                    Choose a deployed ACN to auto-populate item details
                  </p>
                </div>

                <div>
                  <label class="block text-sm font-medium mb-2">Purpose</label>
                  <input
                    v-model="form.purpose"
                    class="w-full border border-stroke rounded px-3 py-2 bg-gray-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-gray-200 focus:border-gray-300"
                    placeholder="Purpose"
                  />
                </div>

                <div>
                  <label class="block text-sm font-medium mb-2">Remarks</label>
                  <textarea
                    v-model="form.remarks"
                    class="w-full border border-stroke rounded px-3 py-2 bg-gray-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-gray-200 focus:border-gray-300"
                    placeholder="Remarks"
                    rows="4"
                  ></textarea>
                </div>

                <div>
                  <label class="block text-sm font-medium mb-2">Brought By</label>
                  <EmployeeCombobox
                    v-model="form.broughtByName"
                    placeholder="Search employee"
                    :limit="200"
                    @select="
                      (emp) => {
                        form.value
                          ? (form.value.broughtByEmployeeId = emp._id)
                          : (form.broughtByEmployeeId = emp._id)
                        form.broughtByName = `${emp.firstName} ${emp.lastName}`
                      }
                    "
                  />
                </div>

                <div>
                  <label class="block text-sm font-medium mb-2">Technician Name</label>
                  <input
                    v-model="form.technicianName"
                    class="w-full border border-stroke rounded px-3 py-2 bg-gray-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-gray-200 focus:border-gray-300"
                    placeholder="Technician Name"
                  />
                </div>

                <div>
                  <label class="block text-sm font-medium mb-2">Status</label>
                  <select
                    v-model="form.status"
                    class="w-full border border-stroke rounded px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-gray-200 focus:border-gray-300"
                  >
                    <option value="for_inspection">For inspection</option>
                    <option value="under_repair">Under repair</option>
                    <option value="pending_replacement">Pending replacement</option>
                    <option value="repaired">Repaired</option>
                    <option value="for_disposal">For disposal</option>
                  </select>
                </div>

                <div class="pt-2 flex gap-2">
                  <button
                    @click="submit"
                    :disabled="loading"
                    class="px-4 py-2 rounded-sm border border-stroke bg-primary text-white hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {{ loading ? 'Creating...' : 'Create Log' }}
                  </button>
                  <button
                    type="button"
                    @click="close"
                    class="px-4 py-2 rounded-sm border border-stroke bg-white text-black hover:bg-gray-50"
                  >
                    Cancel
                  </button>
                </div>
              </div>

              <!-- Right: Item details preview -->
              <div class="rounded-sm border border-stroke bg-gray-50 p-4">
                <div class="mb-3">
                  <div class="text-sm text-bodydark2">Selected ACN</div>
                  <div class="text-lg font-semibold">{{ form.acn || '—' }}</div>
                </div>
                <div class="grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <div class="text-bodydark2">Description</div>
                    <div class="font-medium">{{ selectedItem?.description || '—' }}</div>
                  </div>
                  <div>
                    <div class="text-bodydark2">End User</div>
                    <div class="font-medium">{{ selectedItem?.endUserOrMR || '—' }}</div>
                  </div>
                  <div>
                    <div class="text-bodydark2">Department</div>
                    <div class="font-medium">{{ selectedRecord?.department || '—' }}</div>
                  </div>
                  <div>
                    <div class="text-bodydark2">Product</div>
                    <div class="font-medium">
                      {{
                        selectedItem?.product ||
                        selectedItem?.specs?.brand ||
                        selectedItem?.specs?.monitorSize ||
                        '—'
                      }}
                    </div>
                  </div>
                </div>
                <div class="mt-4">
                  <div class="text-sm text-bodydark2 mb-2">Specs</div>
                  <div class="grid grid-cols-2 gap-3 text-sm">
                    <div>
                      <div class="text-bodydark2">Processor</div>
                      <div class="font-medium">{{ selectedItem?.specs?.processor || '—' }}</div>
                    </div>
                    <div>
                      <div class="text-bodydark2">Storage</div>
                      <div class="font-medium">{{ selectedItem?.specs?.storage || '—' }}</div>
                    </div>
                    <div>
                      <div class="text-bodydark2">RAM</div>
                      <div class="font-medium">{{ selectedItem?.specs?.ram || '—' }}</div>
                    </div>
                    <div>
                      <div class="text-bodydark2">Video Card</div>
                      <div class="font-medium">{{ selectedItem?.specs?.videoCard || '—' }}</div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </DefaultLayout>
</template>

<style scoped>
/* Minimal form tweaks for a clean, neutral appearance */
.text-primary {
  color: #1a56db;
}
</style>
