import './assets/css/satoshi.css'
import './assets/css/style.css'
import 'jsvectormap/dist/css/jsvectormap.min.css'
import 'flatpickr/dist/flatpickr.min.css'

import { createApp } from 'vue'
import { createPinia } from 'pinia'
import VueApexCharts from 'vue3-apexcharts'

// Import Font Awesome
import { library } from '@fortawesome/fontawesome-svg-core'
import { FontAwesomeIcon } from '@fortawesome/vue-fontawesome'
import {
  faCheckCircle,
  faExclamationTriangle,
  faExclamationCircle,
  faInfoCircle
} from '@fortawesome/free-solid-svg-icons'

// Add icons to library
library.add(faCheckCircle, faExclamationTriangle, faExclamationCircle, faInfoCircle)

import App from './App.vue'
import router from './router'

const app = createApp(App)
const pinia = createPinia()

app.use(pinia)
app.use(router)
app.use(VueApexCharts)
app.component('font-awesome-icon', FontAwesomeIcon)

// Add these imports
// import { vPermission, vRole } from './directives/permission'

// Add these lines before app.mount('#app')
// app.directive('permission', vPermission)
// app.directive('role', vRole)

// Initialize user data after Pinia is properly set up
app.mount('#app')

// Fetch user data on app initialization (after Pinia is registered)
import { useAuthStore } from './stores'

// Use nextTick to ensure the app is mounted before accessing stores
import { nextTick } from 'vue'
nextTick(async () => {
  const authStore = useAuthStore()
  
  // Initialize dark mode
  const { useDarkModeStore } = await import('./stores/darkMode')
  const darkModeStore = useDarkModeStore()
  darkModeStore.initializeDarkMode()
  
  // If user has a token, fetch their current data
  if (authStore.token) {
    authStore.fetchCurrentUser().catch(error => {
      console.error('Failed to fetch user data on app initialization:', error)
    })
  }
})
