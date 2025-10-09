<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import axios from 'axios'
import { useAuthStore } from '../../stores'
import Swal from 'sweetalert2'

const authStore = useAuthStore()

interface ScheduleSettings {
  frequency: string
  dayOfWeek?: number
  dayOfMonth?: number
  hour: number
  minute: number
  enabled: boolean
}

const scheduleSettings = ref<ScheduleSettings>({
  frequency: 'daily',
  hour: 0,
  minute: 0,
  enabled: true
})

// For time input
const timeInput = ref('00:00')

const isLoading = ref(false)

// Days of week for dropdown
const daysOfWeek = [
  { value: 0, label: 'Sunday' },
  { value: 1, label: 'Monday' },
  { value: 2, label: 'Tuesday' },
  { value: 3, label: 'Wednesday' },
  { value: 4, label: 'Thursday' },
  { value: 5, label: 'Friday' },
  { value: 6, label: 'Saturday' }
]

// Generate days of month for dropdown
const daysOfMonth = Array.from({ length: 31 }, (_, i) => ({ value: i + 1, label: `${i + 1}` }))

// Update time input when hour/minute changes
const updateTimeFromSettings = () => {
  timeInput.value = `${scheduleSettings.value.hour
    .toString()
    .padStart(2, '0')}:${scheduleSettings.value.minute.toString().padStart(2, '0')}`
}

// Update hour/minute when time input changes
const updateSettingsFromTime = () => {
  const [hours, minutes] = timeInput.value.split(':').map(Number)
  scheduleSettings.value.hour = hours
  scheduleSettings.value.minute = minutes
}

// Fetch current settings
const fetchSettings = async () => {
  try {
    isLoading.value = true
    const response = await axios.get('http://localhost:5000/api/settings', {
      headers: {
        Authorization: `Bearer ${authStore.token}`
      }
    })

    if (response.data.autoReorderSchedule) {
      scheduleSettings.value = response.data.autoReorderSchedule
      updateTimeFromSettings()
    }
  } catch (error) {
    console.error('Error fetching settings:', error)
    Swal.fire({
      icon: 'error',
      title: 'Error',
      text: 'Failed to load auto-reorder schedule settings'
    })
  } finally {
    isLoading.value = false
  }
}

// Save settings
const saveSettings = async () => {
  try {
    updateSettingsFromTime() // Ensure hour/minute are updated from time input
    isLoading.value = true
    await axios.put(
      'http://localhost:5000/api/settings/auto-reorder-schedule',
      scheduleSettings.value,
      {
        headers: {
          Authorization: `Bearer ${authStore.token}`
        }
      }
    )

    Swal.fire({
      icon: 'success',
      title: 'Success',
      text: 'Auto-reorder schedule settings updated successfully',
      toast: true,
      position: 'top-end',
      showConfirmButton: false,
      timer: 3000
    })
  } catch (error: any) {
    console.error('Error saving settings:', error)
    Swal.fire({
      icon: 'error',
      title: 'Error',
      text: error.response?.data?.message || 'Failed to update auto-reorder schedule settings'
    })
  } finally {
    isLoading.value = false
  }
}

// Get human-readable schedule description
const scheduleDescription = computed(() => {
  const settings = scheduleSettings.value
  const timeStr = timeInput.value

  if (!settings.enabled) {
    return 'Auto-reorder is currently disabled'
  }

  if (settings.frequency === 'daily') {
    return `Daily at ${timeStr}`
  } else if (settings.frequency === 'weekly' && settings.dayOfWeek !== undefined) {
    const day = daysOfWeek.find((d) => d.value === settings.dayOfWeek)?.label || 'Unknown'
    return `Every ${day} at ${timeStr}`
  } else if (settings.frequency === 'monthly' && settings.dayOfMonth !== undefined) {
    return `Monthly on day ${settings.dayOfMonth} at ${timeStr}`
  }

  return 'Schedule configuration incomplete'
})

onMounted(() => {
  fetchSettings()
})
</script>

<template>
  <div
    class="rounded-sm border border-stroke bg-white shadow-default dark:border-strokedark dark:bg-boxdark"
  >
    <div class="border-b border-stroke px-4 py-3 dark:border-strokedark">
      <h3 class="font-medium text-black dark:text-white">Auto-Reorder Schedule</h3>
    </div>
    <div class="p-4">
      <div v-if="isLoading" class="flex justify-center py-4">
        <div
          class="animate-spin h-6 w-6 border-3 border-primary border-t-transparent rounded-full"
        ></div>
      </div>
      <div v-else>
        <!-- Enable/Disable Toggle and Current Schedule -->
        <div class="flex flex-wrap items-center justify-between mb-4">
          <label class="flex items-center cursor-pointer">
            <div class="relative">
              <input type="checkbox" v-model="scheduleSettings.enabled" class="sr-only" />
              <div class="block h-7 w-12 rounded-full bg-meta-9 dark:bg-[#5A616B]"></div>
              <div
                :class="scheduleSettings.enabled ? '!right-1 !translate-x-full !bg-primary' : ''"
                class="absolute left-1 top-1 h-5 w-5 rounded-full bg-white transition"
              ></div>
            </div>
            <span class="ml-2 text-sm font-medium text-black dark:text-white"
              >Enable Auto-Reorder</span
            >
          </label>
          <div class="text-xs text-meta-4">{{ scheduleDescription }}</div>
        </div>

        <!-- Schedule Configuration -->
        <div class="grid grid-cols-2 gap-3 mb-4">
          <!-- Frequency -->
          <div class="col-span-2 sm:col-span-1">
            <label class="mb-1 block text-sm text-black dark:text-white">Frequency</label>
            <select
              v-model="scheduleSettings.frequency"
              class="w-full rounded border-[1.5px] border-stroke bg-transparent px-3 py-2 text-sm outline-none transition focus:border-primary active:border-primary dark:border-form-strokedark dark:bg-form-input"
            >
              <option value="daily">Daily</option>
              <option value="weekly">Weekly</option>
              <option value="monthly">Monthly</option>
            </select>
          </div>

          <!-- Time (Combined Hour and Minute) -->
          <div class="col-span-2 sm:col-span-1">
            <label class="mb-1 block text-sm text-black dark:text-white"
              >Time (24-hour format)</label
            >
            <input
              type="time"
              v-model="timeInput"
              class="w-full rounded border-[1.5px] border-stroke bg-transparent px-3 py-2 text-sm outline-none transition focus:border-primary active:border-primary dark:border-form-strokedark dark:bg-form-input"
            />
          </div>

          <!-- Day of Week (conditional) -->
          <div v-if="scheduleSettings.frequency === 'weekly'" class="col-span-2">
            <label class="mb-1 block text-sm text-black dark:text-white">Day of Week</label>
            <select
              v-model="scheduleSettings.dayOfWeek"
              class="w-full rounded border-[1.5px] border-stroke bg-transparent px-3 py-2 text-sm outline-none transition focus:border-primary active:border-primary dark:border-form-strokedark dark:bg-form-input"
            >
              <option v-for="day in daysOfWeek" :key="day.value" :value="day.value">
                {{ day.label }}
              </option>
            </select>
          </div>

          <!-- Day of Month (conditional) -->
          <div v-if="scheduleSettings.frequency === 'monthly'" class="col-span-2">
            <label class="mb-1 block text-sm text-black dark:text-white">Day of Month</label>
            <select
              v-model="scheduleSettings.dayOfMonth"
              class="w-full rounded border-[1.5px] border-stroke bg-transparent px-3 py-2 text-sm outline-none transition focus:border-primary active:border-primary dark:border-form-strokedark dark:bg-form-input"
            >
              <option v-for="day in daysOfMonth" :key="day.value" :value="day.value">
                {{ day.label }}
              </option>
            </select>
          </div>
        </div>

        <!-- Buttons -->
        <div class="flex justify-end gap-3">
          <button
            @click="fetchSettings"
            class="flex justify-center rounded border border-stroke px-4 py-1.5 text-sm font-medium text-black hover:shadow-1 dark:border-strokedark dark:text-white"
          >
            Cancel
          </button>
          <button
            @click="saveSettings"
            class="flex justify-center rounded bg-primary px-4 py-1.5 text-sm font-medium text-white hover:bg-opacity-90"
          >
            Save
          </button>
        </div>
      </div>
    </div>
  </div>
</template>
