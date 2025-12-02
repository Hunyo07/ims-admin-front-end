<script setup>
import { ref, onMounted } from 'vue'
import api from '../utils/axios.js'
import { Howl } from 'howler'

const loading = ref(false)
const error = ref('')
const success = ref('')
const soundFileName = ref('')

const formData = ref({
  firstName: '',
  lastName: '',
  phoneNumber: '',
  email: '',
  password: '',
  age: '',
  gender: '',
  civilStatus: '',
  address: {
    street: '',
    barangay: '',
    city: '',
    province: '',
    zipCode: ''
  },
  notificationSettings: {
    soundEnabled: true,
    soundUrl: '',
    soundVolume: 1,
    soundLoop: false,
    snoozeMinutes: 5
  }
})

const fetchProfile = async () => {
  loading.value = true
  error.value = ''
  try {
    const token = localStorage.getItem('token')
    const res = await api.get('/users/me', {
      headers: { Authorization: `Bearer ${token}` }
    })
    const user = res.data.user
    formData.value.firstName = user.firstName || ''
    formData.value.lastName = user.lastName || ''
    formData.value.phoneNumber = user.phoneNumber || ''
    formData.value.email = user.email || ''
    formData.value.password = ''
    formData.value.age = user.age || ''
    formData.value.gender = user.gender || ''
    formData.value.civilStatus = user.civilStatus || ''
    formData.value.address = {
      street: user.address?.street || '',
      barangay: user.address?.barangay || '',
      city: user.address?.city || '',
      province: user.address?.province || '',
      zipCode: user.address?.zipCode || ''
    }
    formData.value.notificationSettings = {
      soundEnabled: user?.notificationSettings?.soundEnabled ?? true,
      soundUrl: user?.notificationSettings?.soundUrl || '',
      soundVolume:
        typeof user?.notificationSettings?.soundVolume === 'number'
          ? user.notificationSettings.soundVolume
          : 1,
      soundLoop: !!user?.notificationSettings?.soundLoop,
      snoozeMinutes:
        typeof user?.notificationSettings?.snoozeMinutes === 'number'
          ? user.notificationSettings.snoozeMinutes
          : 5
    }
  } catch (err) {
    error.value = err.response?.data?.message || 'Failed to load user data.'
  } finally {
    loading.value = false
  }
}

const handleSubmit = async () => {
  loading.value = true
  error.value = ''
  success.value = ''
  try {
    const token = localStorage.getItem('token')
    const updateData = { ...formData.value, address: { ...formData.value.address } }
    updateData.notificationSettings = { ...formData.value.notificationSettings }
    if (!updateData.password) delete updateData.password
    const res = await api.patch('/users/me', updateData, {
      headers: { Authorization: `Bearer ${token}` }
    })
    const user = res.data.user
    formData.value.firstName = user.firstName || ''
    formData.value.lastName = user.lastName || ''
    formData.value.phoneNumber = user.phoneNumber || ''
    formData.value.email = user.email || ''
    formData.value.password = ''
    formData.value.age = user.age || ''
    formData.value.gender = user.gender || ''
    formData.value.civilStatus = user.civilStatus || ''
    formData.value.address = {
      street: user.address?.street || '',
      barangay: user.address?.barangay || '',
      city: user.address?.city || '',
      province: user.address?.province || '',
      zipCode: user.address?.zipCode || ''
    }
    success.value = 'Account settings updated successfully!'
  } catch (err) {
    error.value = err.response?.data?.message || 'Failed to update account settings.'
  } finally {
    loading.value = false
  }
}

onMounted(fetchProfile)

const onSoundUpload = async (e) => {
  try {
    const file = e.target.files?.[0]
    if (!file) return
    const isMp3 = /\.mp3$/i.test(file.name) || file.type === 'audio/mpeg'
    if (!isMp3) {
      error.value = 'Please select an MP3 file'
      return
    }
    if (file.size > 2 * 1024 * 1024) {
      error.value = 'MP3 must be 2MB or smaller'
      return
    }
    const reader = new FileReader()
    reader.onload = () => {
      const url = String(reader.result || '')
      formData.value.notificationSettings.soundUrl = url
      soundFileName.value = file.name
      success.value = 'Sound uploaded'
    }
    reader.onerror = () => {
      error.value = 'Failed to read file'
    }
    reader.readAsDataURL(file)
  } catch (_) {
    error.value = 'Upload error'
  }
}

const clearSound = () => {
  formData.value.notificationSettings.soundUrl = ''
  soundFileName.value = ''
}

const currentTestSound = ref(null)
const currentTestCtx = ref(null)
const currentTestOsc = ref(null)

const testSound = () => {
  const ns = formData.value.notificationSettings
  const vol = Math.max(0, Math.min(1, Number(ns.soundVolume || 1)))
  const loop = !!ns.soundLoop
  if (ns.soundUrl) {
    try {
      if (currentTestSound.value) {
        currentTestSound.value.stop()
        currentTestSound.value = null
      }
      const sound = new Howl({ src: [ns.soundUrl], volume: vol, loop })
      currentTestSound.value = sound
      sound.play()
      if (!loop) {
        setTimeout(() => {
          try {
            if (currentTestSound.value) {
              currentTestSound.value.stop()
              currentTestSound.value = null
            }
          } catch (_) {
            void 0
          }
        }, 5000)
      }
    } catch (_) {
      void 0
    }
  } else {
    try {
      const ctx = new (window.AudioContext || window.webkitAudioContext)()
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.type = 'sine'
      osc.frequency.value = 660
      gain.gain.value = vol
      osc.connect(gain)
      gain.connect(ctx.destination)
      osc.start()
      currentTestCtx.value = ctx
      currentTestOsc.value = osc
      setTimeout(() => {
        try {
          if (currentTestOsc.value) {
            currentTestOsc.value.stop()
            currentTestOsc.value = null
          } else {
            osc.stop()
          }
        } catch (_) {
          void 0
        }
        try {
          if (currentTestCtx.value) {
            currentTestCtx.value.close()
            currentTestCtx.value = null
          } else {
            ctx.close()
          }
        } catch (_) {
          void 0
        }
      }, 1000)
    } catch (_) {
      void 0
    }
  }
}

const stopTestSound = () => {
  try {
    if (currentTestSound.value) {
      currentTestSound.value.stop()
      currentTestSound.value = null
    }
  } catch (_) {
    void 0
  }
  try {
    if (currentTestOsc.value) {
      currentTestOsc.value.stop()
      currentTestOsc.value = null
    }
  } catch (_) {
    void 0
  }
  try {
    if (currentTestCtx.value) {
      currentTestCtx.value.close()
      currentTestCtx.value = null
    }
  } catch (_) {
    void 0
  }
}
</script>

<template>
  <div
    class="rounded-sm border border-stroke bg-white shadow-default dark:border-strokedark dark:bg-boxdark max-w-xl mx-auto p-8 mt-8"
  >
    <h3 class="font-medium text-black dark:text-white mb-6 text-2xl text-center">
      Account Settings
    </h3>
    <form @submit.prevent="handleSubmit" class="space-y-4">
      <div v-if="error" class="bg-red-100 text-red-700 p-2 rounded">{{ error }}</div>
      <div v-if="success" class="bg-green-100 text-green-700 p-2 rounded">{{ success }}</div>
      <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label class="mb-1 block text-sm font-medium text-black dark:text-white" for="firstName"
            >First Name</label
          >
          <input
            v-model="formData.firstName"
            class="w-full rounded border border-stroke bg-gray py-3 px-4.5 font-normal text-black focus:border-primary focus-visible:outline-none dark:border-strokedark dark:bg-meta-4 dark:text-white dark:focus:border-primary"
            type="text"
            id="firstName"
            required
          />
        </div>
        <div>
          <label class="mb-1 block text-sm font-medium text-black dark:text-white" for="lastName"
            >Last Name</label
          >
          <input
            v-model="formData.lastName"
            class="w-full rounded border border-stroke bg-gray py-3 px-4.5 font-normal text-black focus:border-primary focus-visible:outline-none dark:border-strokedark dark:bg-meta-4 dark:text-white dark:focus:border-primary"
            type="text"
            id="lastName"
            required
          />
        </div>
        <div>
          <label class="mb-1 block text-sm font-medium text-black dark:text-white" for="phoneNumber"
            >Phone Number</label
          >
          <input
            v-model="formData.phoneNumber"
            class="w-full rounded border border-stroke bg-gray py-3 px-4.5 font-normal text-black focus:border-primary focus-visible:outline-none dark:border-strokedark dark:bg-meta-4 dark:text-white dark:focus:border-primary"
            type="text"
            id="phoneNumber"
          />
        </div>
        <div>
          <label class="mb-1 block text-sm font-medium text-black dark:text-white" for="email"
            >Email</label
          >
          <input
            v-model="formData.email"
            class="w-full rounded border border-stroke bg-gray py-3 px-4.5 font-normal text-black focus:border-primary focus-visible:outline-none dark:border-strokedark dark:bg-meta-4 dark:text-white dark:focus:border-primary"
            type="email"
            id="email"
            required
          />
        </div>
        <div>
          <label class="mb-1 block text-sm font-medium text-black dark:text-white" for="age"
            >Age</label
          >
          <input
            v-model="formData.age"
            class="w-full rounded border border-stroke bg-gray py-3 px-4.5 font-normal text-black focus:border-primary focus-visible:outline-none dark:border-strokedark dark:bg-meta-4 dark:text-white dark:focus:border-primary"
            type="number"
            id="age"
            min="0"
          />
        </div>
        <div>
          <label class="mb-1 block text-sm font-medium text-black dark:text-white" for="gender"
            >Gender</label
          >
          <select
            v-model="formData.gender"
            class="w-full rounded border border-stroke bg-gray py-3 px-4.5 font-normal text-black focus:border-primary focus-visible:outline-none dark:border-strokedark dark:bg-meta-4 dark:text-white dark:focus:border-primary"
            id="gender"
          >
            <option value="">Select</option>
            <option value="male">Male</option>
            <option value="female">Female</option>
            <option value="other">Other</option>
          </select>
        </div>
        <div>
          <label class="mb-1 block text-sm font-medium text-black dark:text-white" for="civilStatus"
            >Civil Status</label
          >
          <select
            v-model="formData.civilStatus"
            class="w-full rounded border border-stroke bg-gray py-3 px-4.5 font-normal text-black focus:border-primary focus-visible:outline-none dark:border-strokedark dark:bg-meta-4 dark:text-white dark:focus:border-primary"
            id="civilStatus"
          >
            <option value="">Select</option>
            <option value="single">Single</option>
            <option value="married">Married</option>
            <option value="divorced">Divorced</option>
            <option value="widowed">Widowed</option>
          </select>
        </div>
        <div class="md:col-span-2 grid grid-cols-1 md:grid-cols-5 gap-4">
          <div>
            <label class="mb-1 block text-sm font-medium text-black dark:text-white" for="street"
              >Street</label
            >
            <input
              v-model="formData.address.street"
              class="w-full rounded border border-stroke bg-gray py-3 px-4.5 font-normal text-black focus:border-primary focus-visible:outline-none dark:border-strokedark dark:bg-meta-4 dark:text-white dark:focus:border-primary"
              type="text"
              id="street"
            />
          </div>
          <div>
            <label class="mb-1 block text-sm font-medium text-black dark:text-white" for="barangay"
              >Barangay</label
            >
            <input
              v-model="formData.address.barangay"
              class="w-full rounded border border-stroke bg-gray py-3 px-4.5 font-normal text-black focus:border-primary focus-visible:outline-none dark:border-strokedark dark:bg-meta-4 dark:text-white dark:focus:border-primary"
              type="text"
              id="barangay"
            />
          </div>
          <div>
            <label class="mb-1 block text-sm font-medium text-black dark:text-white" for="city"
              >City</label
            >
            <input
              v-model="formData.address.city"
              class="w-full rounded border border-stroke bg-gray py-3 px-4.5 font-normal text-black focus:border-primary focus-visible:outline-none dark:border-strokedark dark:bg-meta-4 dark:text-white dark:focus:border-primary"
              type="text"
              id="city"
            />
          </div>
          <div>
            <label class="mb-1 block text-sm font-medium text-black dark:text-white" for="province"
              >Province</label
            >
            <input
              v-model="formData.address.province"
              class="w-full rounded border border-stroke bg-gray py-3 px-4.5 font-normal text-black focus:border-primary focus-visible:outline-none dark:border-strokedark dark:bg-meta-4 dark:text-white dark:focus:border-primary"
              type="text"
              id="province"
            />
          </div>
          <div>
            <label class="mb-1 block text-sm font-medium text-black dark:text-white" for="zipCode"
              >Zip Code</label
            >
            <input
              v-model="formData.address.zipCode"
              class="w-full rounded border border-stroke bg-gray py-3 px-4.5 font-normal text-black focus:border-primary focus-visible:outline-none dark:border-strokedark dark:bg-meta-4 dark:text-white dark:focus:border-primary"
              type="text"
              id="zipCode"
            />
          </div>
        </div>
        <div class="md:col-span-2">
          <label class="mb-1 block text-sm font-medium text-black dark:text-white" for="password"
            >Password
            <span class="text-xs text-gray-500">(leave blank to keep current)</span></label
          >
          <input
            v-model="formData.password"
            class="w-full rounded border border-stroke bg-gray py-3 px-4.5 font-normal text-black focus:border-primary focus-visible:outline-none dark:border-strokedark dark:bg-meta-4 dark:text-white dark:focus:border-primary"
            type="password"
            id="password"
            autocomplete="new-password"
          />
        </div>
      </div>
      <div class="mt-6 border-t pt-4">
        <h4 class="font-medium text-black dark:text-white mb-3 text-lg">Notification Sound</h4>
        <div class="space-y-3">
          <label class="flex items-center gap-2">
            <input type="checkbox" v-model="formData.notificationSettings.soundEnabled" />
            <span>Enable sound</span>
          </label>
          <div>
            <label class="block text-sm">Preset</label>
            <select
              class="w-full rounded border border-stroke bg-gray py-2 px-3"
              @change="
                (e) => {
                  const v = e.target.value
                  const map = {
                    '': '',
                    bell: 'https://actions.google.com/sounds/v1/alarms/alarm_clock.ogg',
                    chime: 'https://actions.google.com/sounds/v1/alarms/beep_short.ogg',
                    alert:
                      'https://actions.google.com/sounds/v1/alarms/digital_watch_alarm_long.ogg'
                  }
                  formData.notificationSettings.soundUrl = map[v] || ''
                }
              "
            >
              <option value="">Default Beep</option>
              <option value="bell">Bell</option>
              <option value="chime">Chime</option>
              <option value="alert">Digital Alarm</option>
            </select>
          </div>
          <div class="grid grid-cols-1 gap-2">
            <label class="block text-sm">Sound URL</label>
            <input
              v-model="formData.notificationSettings.soundUrl"
              type="url"
              placeholder="https://example.com/sound.mp3"
              class="w-full rounded border border-stroke bg-gray py-2 px-3"
            />
            <p class="text-xs text-gray-500">Leave blank for built-in beep</p>
          </div>
          <div class="grid grid-cols-1 gap-2">
            <label class="block text-sm">Upload MP3</label>
            <input type="file" accept="audio/mpeg,.mp3" @change="onSoundUpload" />
            <div class="text-xs text-gray-600" v-if="soundFileName">{{ soundFileName }}</div>
            <div class="flex items-center gap-2">
              <button type="button" class="px-2 py-1 border rounded" @click="clearSound">
                Clear
              </button>
            </div>
            <p class="text-xs text-gray-500">Max 2MB. Upload sets the sound URL automatically.</p>
          </div>
          <div class="grid grid-cols-2 gap-4 items-center">
            <div>
              <label class="block text-sm">Volume</label>
              <input
                v-model.number="formData.notificationSettings.soundVolume"
                type="range"
                min="0"
                max="1"
                step="0.05"
              />
            </div>
            <label class="flex items-center gap-2">
              <input type="checkbox" v-model="formData.notificationSettings.soundLoop" />
              <span>Loop</span>
            </label>
          </div>
          <div class="grid grid-cols-2 gap-4 items-center">
            <div>
              <label class="block text-sm">Snooze Duration (minutes)</label>
              <input
                v-model.number="formData.notificationSettings.snoozeMinutes"
                type="number"
                min="1"
                max="120"
                class="w-24 rounded border border-stroke bg-gray py-2 px-3"
              />
            </div>
            <p class="text-xs text-gray-500">How long the banner snooze lasts.</p>
          </div>
          <div class="flex items-center gap-2">
            <button type="button" class="px-3 py-2 border rounded" @click="testSound">
              Test Sound
            </button>
            <button type="button" class="px-3 py-2 border rounded" @click="stopTestSound">
              Stop
            </button>
          </div>
        </div>
      </div>
      <button
        type="submit"
        class="mt-4 w-full bg-primary text-white py-2 rounded hover:bg-opacity-90"
        :disabled="loading"
      >
        {{ loading ? 'Saving...' : 'Save Changes' }}
      </button>
    </form>
  </div>
</template>
