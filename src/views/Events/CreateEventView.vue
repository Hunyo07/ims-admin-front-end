<script setup>
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import axios from '@/utils/axios'
import DefaultLayout from '@/layouts/DefaultLayout.vue'
import BreadcrumbDefault from '@/components/Breadcrumbs/BreadcrumbDefault.vue'

const router = useRouter()
const pageTitle = ref('Create Schedule')
const title = ref('')
const description = ref('')
const eventDate = ref('')
const endDate = ref('')
const type = ref('event')
const location = ref('')
const meetingLink = ref('')
const departments = ref([])
const selectedDepartmentId = ref('')
const reminderValue = ref(30)
const reminderUnit = ref('minutes')
const submitting = ref(false)
const error = ref('')
const success = ref('')

const toMinutes = () => {
  const val = Number(reminderValue.value || 0)
  if (reminderUnit.value === 'days') return val * 1440
  if (reminderUnit.value === 'hours') return val * 60
  return val
}

const submit = async () => {
  submitting.value = true
  error.value = ''
  success.value = ''
  try {
    if (!title.value || !eventDate.value) {
      throw new Error('Title and Event Date are required')
    }
    if (type.value === 'field' && !location.value) {
      throw new Error('Location is required for field events')
    }
    if (type.value === 'zoom_meeting' && !meetingLink.value) {
      throw new Error('Meeting Link is required for Zoom meetings')
    }
    const payload = {
      title: title.value,
      description: description.value,
      eventDate: new Date(eventDate.value).toISOString(),
      endDate: endDate.value ? new Date(endDate.value).toISOString() : undefined,
      reminderBefore: toMinutes(),
      type: type.value,
      location: type.value === 'field' ? location.value : undefined,
      meetingLink: type.value === 'zoom_meeting' ? meetingLink.value : undefined,
      department: selectedDepartmentId.value || undefined
    }
    await axios.post('/events', payload)
    success.value = 'Event created'
    setTimeout(() => router.push({ name: 'events-list' }), 800)
  } catch (e) {
    error.value = e?.response?.data?.message || e.message
  } finally {
    submitting.value = false
  }
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

onMounted(fetchDepartments)
</script>

<template>
  <DefaultLayout>
    <BreadcrumbDefault :pageTitle="pageTitle" />
    <div class="max-w-2xl">
      <div v-if="error" class="mb-3 px-4 py-2 rounded bg-danger text-white">{{ error }}</div>
      <div v-if="success" class="mb-3 px-4 py-2 rounded bg-success text-white">{{ success }}</div>

      <div class="grid grid-cols-1 gap-4">
        <div>
          <label class="mb-1 block text-sm">Title</label>
          <input
            v-model="title"
            type="text"
            class="w-full border border-stroke rounded px-3 py-2"
          />
        </div>
        <div>
          <label class="mb-1 block text-sm">Description</label>
          <textarea
            v-model="description"
            rows="3"
            class="w-full border border-stroke rounded px-3 py-2"
          ></textarea>
        </div>
        <div>
          <label class="mb-1 block text-sm">Event Type</label>
          <select v-model="type" class="w-full border border-stroke rounded px-3 py-2">
            <option value="event">Event</option>
            <option value="field">Field</option>
            <option value="zoom_meeting">Zoom Meeting</option>
          </select>
        </div>
        <div>
          <label class="mb-1 block text-sm">Department</label>
          <select
            v-model="selectedDepartmentId"
            class="w-full border border-stroke rounded px-3 py-2"
          >
            <option value="">Select Department</option>
            <option v-for="dept in departments" :key="dept._id" :value="dept._id">
              {{ dept.name }}
            </option>
          </select>
        </div>
        <div>
          <label class="mb-1 block text-sm">Date/Time</label>
          <input
            v-model="eventDate"
            type="datetime-local"
            class="w-full border border-stroke rounded px-3 py-2"
          />
        </div>
        <div v-if="type === 'field'">
          <label class="mb-1 block text-sm">Location</label>
          <input
            v-model="location"
            type="text"
            placeholder="Enter location"
            class="w-full border border-stroke rounded px-3 py-2"
          />
        </div>
        <div v-if="type === 'zoom_meeting'">
          <label class="mb-1 block text-sm">Meeting Link</label>
          <input
            v-model="meetingLink"
            type="url"
            placeholder="https://..."
            class="w-full border border-stroke rounded px-3 py-2"
          />
        </div>
        <div>
          <label class="mb-1 block text-sm">Reminder Before</label>
          <div class="flex items-center gap-2">
            <input
              v-model.number="reminderValue"
              type="number"
              min="0"
              class="w-32 border border-stroke rounded px-3 py-2"
            />
            <select v-model="reminderUnit" class="border border-stroke rounded px-2 py-2">
              <option value="minutes">Minutes</option>
              <option value="hours">Hours</option>
              <option value="days">Days</option>
            </select>
          </div>
        </div>
        <div class="flex items-center gap-2">
          <button
            @click="submit"
            :disabled="submitting"
            class="px-3 py-2 bg-primary text-white rounded hover:opacity-90"
          >
            {{ submitting ? 'Creating...' : 'Create Event' }}
          </button>
          <button
            @click="router.push({ name: 'events-list' })"
            class="px-3 py-2 border border-stroke rounded hover:bg-gray-50"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  </DefaultLayout>
</template>
