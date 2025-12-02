<script setup>
import { ref, onMounted } from 'vue'
import axios from '@/utils/axios'
import DefaultLayout from '@/layouts/DefaultLayout.vue'
import BreadcrumbDefault from '@/components/Breadcrumbs/BreadcrumbDefault.vue'

const pageTitle = ref('Task Schedules')
const events = ref([])
const loading = ref(false)
const error = ref('')
const statusFilter = ref('')
const currentPage = ref(1)
const pageSize = ref(10)
const total = ref(0)

const fetchEvents = async () => {
  loading.value = true
  error.value = ''
  try {
    const params = { limit: pageSize.value, page: currentPage.value }
    if (statusFilter.value) params.status = statusFilter.value
    const { data } = await axios.get('/events', { params })
    events.value = data?.data?.events || []
    total.value = data?.data?.total || 0
  } catch (e) {
    error.value = e?.response?.data?.message || e.message
  } finally {
    loading.value = false
  }
}

const cancelEvent = async (id) => {
  try {
    await axios.patch(`/events/${id}/cancel`)
    await fetchEvents()
  } catch (e) {
    error.value = e?.response?.data?.message || e.message
  }
}

const deleteEvent = async (id) => {
  try {
    await axios.delete(`/events/${id}`)
    await fetchEvents()
  } catch (e) {
    error.value = e?.response?.data?.message || e.message
  }
}

const showCreateModal = ref(false)
const newTitle = ref('')
const newDescription = ref('')
const newType = ref('event')
const newDepartmentId = ref('')
const newEventDate = ref('')
const newLocation = ref('')
const newMeetingLink = ref('')
const newReminderValue = ref(30)
const newReminderUnit = ref('minutes')
const newReminders = ref([{ value: 30, unit: 'minutes' }])
const newRepeat = ref('none')
const createSubmitting = ref(false)
const createError = ref('')
const createSuccess = ref('')
const departments = ref([])

const addReminder = () => {
  newReminders.value.push({ value: 15, unit: 'minutes' })
}

const removeReminder = (idx) => {
  if ((newReminders.value || []).length > 1) {
    newReminders.value.splice(idx, 1)
  }
}

const toMinutesCreate = () => {
  const val = Number(newReminderValue.value || 0)
  if (newReminderUnit.value === 'days') return val * 1440
  if (newReminderUnit.value === 'hours') return val * 60
  return val
}

const resetCreateForm = () => {
  newTitle.value = ''
  newDescription.value = ''
  newType.value = 'event'
  newDepartmentId.value = ''
  newEventDate.value = ''
  newLocation.value = ''
  newMeetingLink.value = ''
  newReminderValue.value = 30
  newReminderUnit.value = 'minutes'
  newReminders.value = [{ value: 30, unit: 'minutes' }]
  newRepeat.value = 'none'
  createError.value = ''
  createSuccess.value = ''
}

const fetchDepartments = async () => {
  try {
    const { data } = await axios.get('/departments')
    const list = data?.departments || data || []
    departments.value = Array.isArray(list) ? list : []
  } catch (_) {
    departments.value = []
  }
}

const openCreateModal = async () => {
  resetCreateForm()
  showCreateModal.value = true
  await fetchDepartments()
}

const closeCreateModal = () => {
  showCreateModal.value = false
}

const submitCreate = async () => {
  createSubmitting.value = true
  createError.value = ''
  createSuccess.value = ''
  try {
    if (!newTitle.value || !newEventDate.value) {
      throw new Error('Title and Event Date are required')
    }
    if (newType.value === 'field' && !newLocation.value) {
      throw new Error('Location is required for field events')
    }
    if (newType.value === 'zoom_meeting' && !newMeetingLink.value) {
      throw new Error('Meeting Link is required for Zoom meetings')
    }
    const remindersArr = Array.isArray(newReminders.value)
      ? newReminders.value
          .map((r) => {
            const val = Number(r?.value || 0)
            const unit = String(r?.unit || 'minutes')
            if (unit === 'days') return val * 1440
            if (unit === 'hours') return val * 60
            return val
          })
          .filter((n) => Number.isFinite(Number(n)) && Number(n) >= 0)
      : []
    const payload = {
      title: newTitle.value,
      description: newDescription.value,
      eventDate: new Date(newEventDate.value).toISOString(),
      // endDate removed
      reminderBefore: remindersArr.length ? remindersArr[0] : toMinutesCreate(),
      remindersBefore: remindersArr,
      type: newType.value,
      location: newType.value === 'field' ? newLocation.value : undefined,
      meetingLink: newType.value === 'zoom_meeting' ? newMeetingLink.value : undefined,
      department: newDepartmentId.value || undefined,
      repeat: newRepeat.value
      // repeatUntil removed
    }
    await axios.post('/events', payload)
    createSuccess.value = 'Event created'
    setTimeout(async () => {
      closeCreateModal()
      await fetchEvents()
    }, 600)
  } catch (e) {
    createError.value = e?.response?.data?.message || e.message
  } finally {
    createSubmitting.value = false
  }
}

onMounted(fetchEvents)

const formatDateTime = (dt) => {
  if (!dt) return '—'
  try {
    return new Date(dt).toLocaleString()
  } catch {
    return String(dt)
  }
}

const formatReminder = (minutes) => {
  const m = Number(minutes || 0)
  if (m >= 1440 && m % 1440 === 0) return `${m / 1440} day(s)`
  if (m >= 60 && m % 60 === 0) return `${m / 60} hour(s)`
  return `${m} minute(s)`
}

const formatTypeDetails = (ev) => {
  if (!ev || !ev.type) return '—'
  if (ev.type === 'field') return ev.location || '—'
  if (ev.type === 'zoom_meeting') return ev.meetingLink || '—'
  return '—'
}

const rescheduleId = ref('')
const rescheduleDate = ref('')
const rescheduling = ref(false)

const toLocalInputValue = (dt) => {
  try {
    const d = new Date(dt)
    const pad = (n) => String(n).padStart(2, '0')
    const y = d.getFullYear()
    const m = pad(d.getMonth() + 1)
    const da = pad(d.getDate())
    const h = pad(d.getHours())
    const mi = pad(d.getMinutes())
    return `${y}-${m}-${da}T${h}:${mi}`
  } catch {
    return ''
  }
}

const openReschedule = (ev) => {
  error.value = ''
  rescheduleId.value = ev._id
  rescheduleDate.value = toLocalInputValue(ev.eventDate || new Date())
}

const cancelReschedule = () => {
  rescheduleId.value = ''
  rescheduleDate.value = ''
}

const performReschedule = async () => {
  if (!rescheduleId.value || !rescheduleDate.value) return
  rescheduling.value = true
  error.value = ''
  try {
    const payload = {
      eventDate: new Date(rescheduleDate.value).toISOString(),
      status: 'pending'
    }
    await axios.patch(`/events/${rescheduleId.value}`, payload)
    cancelReschedule()
    await fetchEvents()
  } catch (e) {
    error.value = e?.response?.data?.message || e.message
  } finally {
    rescheduling.value = false
  }
}
</script>

<template>
  <DefaultLayout>
    <BreadcrumbDefault :pageTitle="pageTitle" />

    <div class="mb-4 flex items-center justify-between">
      <div class="flex items-center gap-2">
        <select v-model="statusFilter" class="border border-stroke rounded px-2 py-1 text-sm">
          <option value="">All</option>
          <option value="pending">Pending</option>
          <option value="sent">Sent</option>
          <option value="completed">Completed</option>
          <option value="cancelled">Cancelled</option>
        </select>
        <button
          @click="fetchEvents"
          class="px-3 py-1.5 text-sm border border-stroke rounded hover:bg-gray-50"
        >
          Filter
        </button>
      </div>
      <button
        @click="openCreateModal"
        class="px-3 py-1.5 text-sm bg-primary text-white rounded hover:opacity-90"
      >
        Create Schedule
      </button>
    </div>

    <div v-if="error" class="mb-3 px-4 py-2 rounded bg-danger text-white">{{ error }}</div>
    <div v-if="loading" class="text-sm text-bodydark2">Loading...</div>

    <div v-else class="overflow-auto border border-stroke rounded bg-white">
      <table class="min-w-full text-sm">
        <thead>
          <tr class="bg-gray-50 text-left">
            <th class="px-3 py-2">Title</th>
            <th class="px-3 py-2">Type</th>
            <th class="px-3 py-2">Date</th>
            <th class="px-3 py-2">Repeat</th>
            <th class="px-3 py-2">Reminders</th>
            <th class="px-3 py-2">Reminder Before</th>
            <th class="px-3 py-2">Reminder Date</th>
            <th class="px-3 py-2">Details</th>
            <th class="px-3 py-2">Status</th>
            <th class="px-3 py-2 text-right">Actions</th>
          </tr>
        </thead>
        <tbody>
          <tr class="border-t" v-for="ev in events" :key="ev._id">
            <td class="px-3 py-2 font-medium">{{ ev.title }}</td>
            <td class="px-3 py-2">{{ ev.type || 'event' }}</td>
            <td class="px-3 py-2">{{ formatDateTime(ev.eventDate) }}</td>
            <td class="px-3 py-2">{{ ev.repeat || 'none' }}</td>
            <td class="px-3 py-2">
              <span v-if="Array.isArray(ev.remindersBefore) && ev.remindersBefore.length">
                {{ ev.remindersBefore.map((m) => formatReminder(m)).join(', ') }}
              </span>
              <span v-else>{{ formatReminder(ev.reminderBefore) }}</span>
            </td>
            <td class="px-3 py-2">{{ formatReminder(ev.reminderBefore) }}</td>
            <td class="px-3 py-2">{{ formatDateTime(ev.reminderDate) }}</td>
            <td class="px-3 py-2">{{ formatTypeDetails(ev) }}</td>
            <td class="px-3 py-2">
              <span
                class="inline-flex items-center px-2 py-0.5 rounded bg-gray-100 text-gray-700"
                >{{ ev.status }}</span
              >
            </td>
            <td class="px-3 py-2 text-right">
              <div class="inline-flex items-center gap-2">
                <button
                  @click="openReschedule(ev)"
                  class="px-2 py-1 border border-stroke rounded hover:bg-gray-50"
                >
                  Reschedule
                </button>
                <button
                  @click="cancelEvent(ev._id)"
                  class="px-2 py-1 border border-stroke rounded hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  @click="deleteEvent(ev._id)"
                  class="px-2 py-1 border border-stroke rounded hover:bg-gray-50"
                >
                  Delete
                </button>
              </div>
            </td>
          </tr>
          <tr v-if="rescheduleId" class="border-t bg-gray-50">
            <td colspan="10" class="px-3 py-3">
              <div class="flex items-center gap-2">
                <input
                  v-model="rescheduleDate"
                  type="datetime-local"
                  class="border border-stroke rounded px-3 py-2"
                />
                <button
                  @click="performReschedule"
                  :disabled="rescheduling || !rescheduleDate"
                  class="px-3 py-1.5 bg-primary text-white rounded hover:opacity-90 disabled:opacity-60"
                >
                  {{ rescheduling ? 'Saving...' : 'Save' }}
                </button>
                <button
                  @click="cancelReschedule"
                  class="px-3 py-1.5 border border-stroke rounded hover:bg-gray-50"
                >
                  Close
                </button>
              </div>
            </td>
          </tr>
          <tr v-if="events.length === 0">
            <td colspan="10" class="px-3 py-4 text-center text-bodydark2">No events found</td>
          </tr>
        </tbody>
      </table>
    </div>
    <!-- Create Modal Overlay -->
    <div
      v-if="showCreateModal"
      class="fixed inset-0 bg-black/30 flex items-center justify-center z-50 overflow-y-auto p-4"
    >
      <div class="bg-white rounded shadow-lg w-full max-w-2xl p-6 max-h-[85vh] overflow-y-auto">
        <div class="flex items-center justify-between mb-4">
          <h2 class="text-lg font-semibold">Create Schedule</h2>
          <button @click="closeCreateModal" class="text-sm">✕</button>
        </div>
        <div v-if="createError" class="mb-3 px-4 py-2 rounded bg-danger text-white">
          {{ createError }}
        </div>
        <div v-if="createSuccess" class="mb-3 px-4 py-2 rounded bg-success text-white">
          {{ createSuccess }}
        </div>
        <div class="grid grid-cols-1 gap-4">
          <div>
            <label class="mb-1 block text-sm">Title</label>
            <input
              v-model="newTitle"
              type="text"
              class="w-full border border-stroke rounded px-3 py-2"
            />
          </div>
          <div>
            <label class="mb-1 block text-sm">Description</label>
            <textarea
              v-model="newDescription"
              rows="3"
              class="w-full border border-stroke rounded px-3 py-2"
            ></textarea>
          </div>
          <div>
            <label class="mb-1 block text-sm">Event Type</label>
            <select v-model="newType" class="w-full border border-stroke rounded px-3 py-2">
              <option value="event">Event</option>
              <option value="field">Field</option>
              <option value="zoom_meeting">Zoom Meeting</option>
            </select>
          </div>
          <div>
            <label class="mb-1 block text-sm">Department</label>
            <select v-model="newDepartmentId" class="w-full border border-stroke rounded px-3 py-2">
              <option value="">Select Department</option>
              <option v-for="dept in departments" :key="dept._id" :value="dept._id">
                {{ dept.name }}
              </option>
            </select>
          </div>
          <div>
            <label class="mb-1 block text-sm">Date/Time</label>
            <input
              v-model="newEventDate"
              type="datetime-local"
              class="w-full border border-stroke rounded px-3 py-2"
            />
          </div>
          <div>
            <label class="mb-1 block text-sm">Repeat</label>
            <select v-model="newRepeat" class="w-full border border-stroke rounded px-3 py-2">
              <option value="none">None</option>
              <option value="daily">Daily</option>
              <option value="weekly">Weekly</option>
              <option value="monthly">Monthly</option>
            </select>
          </div>
          <div v-if="newType === 'field' || newType === 'event'">
            <label class="mb-1 block text-sm">Location</label>
            <input
              v-model="newLocation"
              type="text"
              placeholder="Enter location"
              class="w-full border border-stroke rounded px-3 py-2"
            />
          </div>
          <div v-if="newType === 'zoom_meeting'">
            <label class="mb-1 block text-sm">Meeting Link</label>
            <input
              v-model="newMeetingLink"
              type="url"
              placeholder="https://..."
              class="w-full border border-stroke rounded px-3 py-2"
            />
          </div>
          <div>
            <label class="mb-1 block text-sm">Reminder Before</label>
            <div class="flex items-center gap-2">
              <input
                v-model.number="newReminderValue"
                type="number"
                min="0"
                class="w-32 border border-stroke rounded px-3 py-2"
              />
              <select v-model="newReminderUnit" class="border border-stroke rounded px-2 py-2">
                <option value="minutes">Minutes</option>
                <option value="hours">Hours</option>
                <option value="days">Days</option>
              </select>
            </div>
          </div>
          <div>
            <label class="mb-1 block text-sm">Additional Reminders</label>
            <div class="space-y-2">
              <div class="flex items-center gap-2" v-for="(r, idx) in newReminders" :key="idx">
                <input
                  v-model.number="r.value"
                  type="number"
                  min="0"
                  class="w-28 border border-stroke rounded px-3 py-2"
                />
                <select v-model="r.unit" class="border border-stroke rounded px-2 py-2">
                  <option value="minutes">Minutes</option>
                  <option value="hours">Hours</option>
                  <option value="days">Days</option>
                </select>
                <button
                  @click="removeReminder(idx)"
                  class="px-2 py-1 border border-stroke rounded hover:bg-gray-50"
                >
                  Remove
                </button>
              </div>
              <button
                @click="addReminder"
                class="px-2 py-1 border border-stroke rounded hover:bg-gray-50"
              >
                Add Reminder
              </button>
            </div>
          </div>
          <div class="flex items-center gap-2">
            <button
              @click="submitCreate"
              :disabled="createSubmitting"
              class="px-3 py-2 bg-primary text-white rounded hover:opacity-90"
            >
              {{ createSubmitting ? 'Creating...' : 'Create Event' }}
            </button>
            <button
              @click="closeCreateModal"
              class="px-3 py-2 border border-stroke rounded hover:bg-gray-50"
            >
              Cancel
            </button>
          </div>
        </div>
      </div>
    </div>
  </DefaultLayout>
</template>
