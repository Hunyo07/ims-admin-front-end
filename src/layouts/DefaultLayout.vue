<script setup >
import HeaderArea from '../components/Header/HeaderArea.vue'
import SidebarArea from '../components/Sidebar/SidebarArea.vue'
import { useSidebarStore } from '../stores'

const sidebarStore = useSidebarStore()
</script>

<template>
  <!-- ===== Page Wrapper Start ===== -->
  <div class="flex h-screen overflow-hidden">
    <!-- ===== Sidebar Start ===== -->
    <SidebarArea v-if="!sidebarStore.isFullScreen" />
    <!-- ===== Sidebar End ===== -->

    <!-- ===== Content Area Start ===== -->
    <div class="relative flex flex-1 flex-col overflow-y-auto overflow-x-hidden" :class="{ 'w-full': sidebarStore.isFullScreen }">
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
