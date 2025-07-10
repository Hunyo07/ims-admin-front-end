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
import { vPermission, vRole } from './directives/permission'

// Add these lines before app.mount('#app')
app.directive('permission', vPermission)
app.directive('role', vRole)

// // Initialize user data if token exists
// const pinia = createPinia()
// app.use(pinia)

// Fetch user data on app initialization (after Pinia is registered)
import { useAuthStore } from './stores/auth'
const authStore = useAuthStore()

// If user has a token, fetch their current data
if (authStore.token) {
  authStore.fetchCurrentUser().catch(error => {
    console.error('Failed to fetch user data on app initialization:', error)
  })
}

app.mount('#app')
