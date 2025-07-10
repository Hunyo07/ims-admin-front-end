<script setup lang="ts">
import { useSidebarStore } from '../../stores/sidebar'
import { useAuthStore } from '../../stores/auth'
import { ref, computed } from 'vue'

const sidebarStore = useSidebarStore()
const authStore = useAuthStore()

const props = defineProps(['items', 'page'])

// Filter items based on permissions and roles
const filteredItems = computed(() => {
  return props.items.filter((item: any) => {
    // Check roles
    const hasRequiredRole = !item.roles || authStore.hasRole(item.roles)
    
    // Check permissions
    const hasRequiredPermission = !item.permissions || 
      item.permissions.some((permission: any) => authStore.hasPermission(permission))
    
    return hasRequiredRole && hasRequiredPermission
  })
})

const handleItemClick = (index: number) => {
  const pageName =
    sidebarStore.selected === filteredItems.value[index].label ? '' : filteredItems.value[index].label
  sidebarStore.selected = pageName
}
</script>

<template>
  <ul class="mt-4 mb-5.5 flex flex-col gap-2.5 pl-6">
    <li v-for="(childItem, index) in filteredItems" :key="index">
      <router-link
        :to="childItem.route"
        @click="handleItemClick(index)"
        class="group relative flex items-center gap-2.5 rounded-md px-4 font-medium text-bodydark2 duration-300 ease-in-out hover:text-white"
        :class="{
          '!text-white': childItem.label === sidebarStore.selected
        }"
      >
        {{ childItem.label }}
      </router-link>
    </li>
  </ul>
</template>
