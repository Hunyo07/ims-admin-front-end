<script setup >
// import { onClickOutside } from '@vueuse/core'
// import { ref, computed, onMounted } from 'vue'
// import { useNotificationStore } from '../../stores'
// import { useRouter } from 'vue-router'
// import { formatDistanceToNow } from 'date-fns'

// const router = useRouter()
// const notificationStore = useNotificationStore()

// const target = ref(null)
// const dropdownOpen = ref(false)

// onClickOutside(target, () => {
//   dropdownOpen.value = false
// })

// onMounted(() => {
//   notificationStore.fetchNotifications()
// })

// const hasUnread = computed(() => notificationStore.unreadCount > 0)

// const formatTime = (dateString) => {
//   try {
//     return formatDistanceToNow(new Date(dateString), { addSuffix: true })
//   } catch (e) {
//     return dateString
//   }
// }

// const handleNotificationClick = async (notification) => {
  // Mark as read
  // await notificationStore.markAsRead(notification._id)
  
  // Navigate to link if provided
  // if (notification.link) {
  //   router.push(notification.link)
  // }
  
  // Close dropdown
  // dropdownOpen.value = false
// }

// const markAllAsRead = async () => {
  // await notificationStore.markAllAsRead()
// }

// const clearAllRead = async () => {
  // await notificationStore.deleteAllRead()
// }

// const getNotificationIcon = (type) => {
//   switch (type) {
//     case 'success':
//        return 'check-circle'
//     case 'warning':
//       return 'exclamation-triangle'
//     case 'error':
//       return 'exclamation-circle'
//     case 'info':
//     default:
//       return 'info-circle'
//   }
// }

// const getNotificationColor = (type ) => {
//   switch (type) {
//     case 'success':
//       return 'text-success'
//     case 'warning':
//       return 'text-warning'
//     case 'error':
//       return 'text-danger'
//     case 'info':
//     default:
//       return 'text-info'
//   }
//   }
</script>

<template>
  <!-- <li class="relative" ref="target">
    <router-link
      class="relative flex h-8.5 w-8.5 items-center justify-center rounded-full border-[0.5px] border-stroke bg-gray hover:text-primary dark:border-strokedark dark:bg-meta-4 dark:text-white"
      to="#"
      @click.prevent="(dropdownOpen = !dropdownOpen)"
    >
      <span
        v-if="hasUnread"
        class="absolute -top-0.5 right-0 z-1 h-2 w-2 rounded-full bg-meta-1"
      >
        <span
          class="absolute -z-1 inline-flex h-full w-full animate-ping rounded-full bg-meta-1 opacity-75"
        ></span>
      </span>

      <svg
        class="fill-current duration-300 ease-in-out"
        width="18"
        height="18"
        viewBox="0 0 18 18"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <path
          d="M16.1999 14.9343L15.6374 14.0624C15.5249 13.8937 15.4687 13.7249 15.4687 13.528V7.67803C15.4687 6.01865 14.7655 4.47178 13.4718 3.31865C12.4312 2.39053 11.0812 1.7999 9.64678 1.6874V1.1249C9.64678 0.787402 9.36553 0.478027 8.9999 0.478027C8.6624 0.478027 8.35303 0.759277 8.35303 1.1249V1.65928C8.29678 1.65928 8.24053 1.65928 8.18428 1.6874C4.92178 2.05303 2.4749 4.66865 2.4749 7.79053V13.528C2.44678 13.8093 2.39053 13.9499 2.33428 14.0343L1.7999 14.9343C1.63115 15.2155 1.63115 15.553 1.7999 15.8343C1.96865 16.0874 2.2499 16.2562 2.55928 16.2562H8.38115V16.8749C8.38115 17.2124 8.6624 17.5218 9.02803 17.5218C9.36553 17.5218 9.6749 17.2405 9.6749 16.8749V16.2562H15.4687C15.778 16.2562 16.0593 16.0874 16.228 15.8343C16.3968 15.553 16.3968 15.2155 16.1999 14.9343ZM3.23428 14.9905L3.43115 14.653C3.5999 14.3718 3.68428 14.0343 3.74053 13.6405V7.79053C3.74053 5.31553 5.70928 3.23428 8.3249 2.95303C9.92803 2.78428 11.503 3.2624 12.6562 4.2749C13.6687 5.1749 14.2312 6.38428 14.2312 7.67803V13.528C14.2312 13.9499 14.3437 14.3437 14.5968 14.7374L14.7655 14.9905H3.23428Z"
          fill=""
        />
      </svg>
    </router-link> -->

    <!-- Dropdown Start -->
    <!-- <div
      v-show="dropdownOpen"
      class="absolute -right-27 mt-2.5 flex h-90 w-75 flex-col rounded-sm border border-stroke bg-white shadow-default dark:border-strokedark dark:bg-boxdark sm:right-0 sm:w-80"
    >
      <div class="px-4.5 py-3 flex justify-between items-center">
        <h5 class="text-sm font-medium text-bodydark2">Notifications</h5>
        <div class="flex space-x-2">
          <button 
            @click="markAllAsRead"
            class="text-xs text-blue-500 hover:text-blue-700"
          >
            Mark all as read
          </button>
          <button 
            @click="clearAllRead"
            class="text-xs text-red-500 hover:text-red-700"
          >
            Clear read
          </button>
        </div>
      </div> -->

      <!-- <ul class="flex h-auto flex-col overflow-y-auto">
        <li v-if="notificationStore.loading" class="flex justify-center items-center py-4">
          <div class="animate-spin rounded-full h-6 w-6 border-b-2 border-primary"></div>
        </li>
        
        <li v-else-if="notificationStore.notifications.length === 0" class="py-4 text-center text-sm text-bodydark2">
          No notifications
        </li>
        
        <template v-else v-for="notification in notificationStore.notifications" :key="notification._id">
          <li>
            <div
              @click="handleNotificationClick(notification)"
              class="flex gap-2.5 border-t border-stroke px-4.5 py-3 hover:bg-gray-2 dark:border-strokedark dark:hover:bg-meta-4 cursor-pointer"
              :class="{ 'bg-gray-100 dark:bg-meta-3': !notification.isRead }"
            >
              <div class="flex-shrink-0">
                <span :class="[getNotificationColor(notification.type), 'text-lg']">
                  <i :class="`fas fa-${getNotificationIcon(notification.type)}`"></i>
                </span>
              </div>
              
              <div class="flex-1">
                <p class="text-sm font-medium">
                  {{ notification.title }}
                </p>
                <p class="text-sm text-black dark:text-white">
                  {{ notification.message }}
                </p>
                <p class="text-xs text-bodydark2">{{ formatTime(notification.createdAt) }}</p>
              </div>
            </div>
          </li>
        </template>
      </ul>
    </div> -->
    <!-- Dropdown End -->
  <!-- </li> -->
   <div>
    
   </div>
</template>
