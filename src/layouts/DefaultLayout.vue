<script setup>
import HeaderArea from '../components/Header/HeaderArea.vue'
import SidebarArea from '../components/Sidebar/SidebarArea.vue'
import { useSidebarStore } from '../stores'
import { useNotificationStore } from '../stores/notification'
import { ref, watch } from 'vue'

const sidebarStore = useSidebarStore()
const notificationStore = useNotificationStore()

const bannerVisible = ref(false)
const bannerNotification = ref(null)
const lastShownId = ref('')
let hideTimer = null
let snoozeTimer = null

const hideBanner = () => {
  bannerVisible.value = false
  bannerNotification.value = null
  if (hideTimer) {
    clearTimeout(hideTimer)
    hideTimer = null
  }
}

const stopBannerSound = () => {
  notificationStore.stopSound()
}

const snoozeBanner = () => {
  try {
    const n = bannerNotification.value
    if (!n) return
    const minutes = Number(notificationStore.snoozeMinutes || 5)
    const ms = Math.max(60000, minutes * 60000)
    stopBannerSound()
    hideBanner()
    if (snoozeTimer) clearTimeout(snoozeTimer)
    snoozeTimer = setTimeout(() => {
      showBanner(n)
      notificationStore.playSoundForNotification(n)
    }, ms)
  } catch (_) {
    void 0
  }
}

const showBanner = (n) => {
  if (!n) return
  bannerNotification.value = n
  bannerVisible.value = true
  if (hideTimer) clearTimeout(hideTimer)
  const shouldAutoHide = !notificationStore.isPlaying && !n?.soundLoop && n?.type !== 'warning'
  if (shouldAutoHide) {
    hideTimer = setTimeout(() => {
      bannerVisible.value = false
      bannerNotification.value = null
      hideTimer = null
    }, 6000)
  } else {
    hideTimer = null
  }
}

const getBannerClasses = (t) => {
  const base = 'rounded-md shadow-lg border px-4 py-3 flex items-start gap-3'
  if (t === 'success') return `${base} bg-success/10 border-success/30 text-success`
  if (t === 'error') return `${base} bg-danger/10 border-danger/30 text-danger`
  if (t === 'warning') return `${base} bg-primary/10 border-primary/30 text-primary`
  return `${base} bg-primary/10 border-primary/30 text-primary`
}

watch(
  () => notificationStore.lastIncoming,
  (n) => {
    try {
      if (n && n._id !== lastShownId.value) {
        lastShownId.value = n._id
        showBanner(n)
      }
    } catch (_) {
      void 0
    }
  }
)
</script>

<template>
  <!-- ===== Page Wrapper Start ===== -->
  <div class="flex h-screen overflow-hidden">
    <!-- ===== Sidebar Start ===== -->
    <SidebarArea v-if="!sidebarStore.isFullScreen" />
    <!-- ===== Sidebar End ===== -->
    <!-- ===== Content Area Start ===== -->
    <div
      class="relative flex flex-1 flex-col overflow-y-auto overflow-x-hidden"
      :class="{ 'w-full': sidebarStore.isFullScreen }"
    >
      <div v-if="bannerVisible" class="fixed bg-white top-2 left-2 right-2 z-[9999]">
        <div :class="getBannerClasses(bannerNotification?.type)">
          <div class="flex-1 min-w-0">
            <div class="font-semibold truncate">{{ bannerNotification?.title }}</div>
            <div class="text-sm break-words whitespace-pre-line">
              {{ bannerNotification?.message }}
            </div>
          </div>
          <div class="flex items-center gap-2">
            <a
              v-if="bannerNotification?.link"
              :href="bannerNotification.link"
              class="text-sm underline"
              >View</a
            >
            <button type="button" class="text-sm px-2 py-1 border rounded" @click="stopBannerSound">
              Stop
            </button>
            <button type="button" class="text-sm px-2 py-1 border rounded" @click="snoozeBanner">
              Snooze
            </button>
            <button type="button" class="text-sm px-2 py-1 border rounded" @click="hideBanner">
              Close
            </button>
          </div>
        </div>
      </div>
      <!-- ===== Header Start ===== -->
      <HeaderArea v-if="!sidebarStore.isFullScreen" />
      <!-- ===== Header End ===== -->

      <!-- ===== Main Content Start ===== -->
      <main>
        <div class="mx-auto max-w-screen-2xl p-4 md:p-6 2xl:p-10">
          <slot></slot>
        </div>
      </main>
      <!-- ===== Main Content End ===== -->
    </div>
  </div>
  <!-- ===== Page Wrapper End ===== -->
</template>
watch( () => notificationStore.isPlaying, (playing) => { try { if (!playing && bannerVisible.value
&& !hideTimer && bannerNotification.value) { hideTimer = setTimeout(() => { bannerVisible.value =
false bannerNotification.value = null hideTimer = null }, 6000) } } catch (_) { void 0 } } )
