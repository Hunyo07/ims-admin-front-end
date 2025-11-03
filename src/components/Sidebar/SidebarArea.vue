<script setup>
import { useAuthStore, useSidebarStore } from '@/stores'
import { onClickOutside } from '@vueuse/core'
import { ref, computed } from 'vue'
import SidebarItem from './SidebarItem.vue'

const target = ref(null)
const sidebarStore = useSidebarStore()
const authStore = useAuthStore()

onClickOutside(target, () => {
  sidebarStore.isSidebarOpen = false
})

const allMenuGroups = ref([
  {
    name: 'MENU',
    menuItems: [
      {
        icon: `<svg
                  class="fill-current"
                  width="18"
                  height="18"
                  viewBox="0 0 18 18"
                  fill="none"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <path
                    d="M6.10322 0.956299H2.53135C1.5751 0.956299 0.787598 1.7438 0.787598 2.70005V6.27192C0.787598 7.22817 1.5751 8.01567 2.53135 8.01567H6.10322C7.05947 8.01567 7.84697 7.22817 7.84697 6.27192V2.72817C7.8751 1.7438 7.0876 0.956299 6.10322 0.956299ZM6.60947 6.30005C6.60947 6.5813 6.38447 6.8063 6.10322 6.8063H2.53135C2.2501 6.8063 2.0251 6.5813 2.0251 6.30005V2.72817C2.0251 2.44692 2.2501 2.22192 2.53135 2.22192H6.10322C6.38447 2.22192 6.60947 2.44692 6.60947 2.72817V6.30005Z"
                    fill=""
                  />
                  <path
                    d="M15.4689 0.956299H11.8971C10.9408 0.956299 10.1533 1.7438 10.1533 2.70005V6.27192C10.1533 7.22817 10.9408 8.01567 11.8971 8.01567H15.4689C16.4252 8.01567 17.2127 7.22817 17.2127 6.27192V2.72817C17.2127 1.7438 16.4252 0.956299 15.4689 0.956299ZM15.9752 6.30005C15.9752 6.5813 15.7502 6.8063 15.4689 6.8063H11.8971C11.6158 6.8063 11.3908 6.5813 11.3908 6.30005V2.72817C11.3908 2.44692 11.6158 2.22192 11.8971 2.22192H15.4689C15.7502 2.22192 15.9752 2.44692 15.9752 2.72817V6.30005Z"
                    fill=""
                  />
                  <path
                    d="M6.10322 9.92822H2.53135C1.5751 9.92822 0.787598 10.7157 0.787598 11.672V15.2438C0.787598 16.2001 1.5751 16.9876 2.53135 16.9876H6.10322C7.05947 16.9876 7.84697 16.2001 7.84697 15.2438V11.7001C7.8751 10.7157 7.0876 9.92822 6.10322 9.92822ZM6.60947 15.272C6.60947 15.5532 6.38447 15.7782 6.10322 15.7782H2.53135C2.2501 15.7782 2.0251 15.5532 2.0251 15.272V11.7001C2.0251 11.4188 2.2501 11.1938 2.53135 11.1938H6.10322C6.38447 11.1938 6.60947 11.4188 6.60947 11.7001V15.272Z"
                    fill=""
                  />
                  <path
                    d="M15.4689 9.92822H11.8971C10.9408 9.92822 10.1533 10.7157 10.1533 11.672V15.2438C10.1533 16.2001 10.9408 16.9876 11.8971 16.9876H15.4689C16.4252 16.9876 17.2127 16.2001 17.2127 15.2438V11.7001C17.2127 10.7157 16.4252 9.92822 15.4689 9.92822ZM15.9752 15.272C15.9752 15.5532 15.7502 15.7782 15.4689 15.7782H11.8971C11.6158 15.7782 11.3908 15.5532 11.3908 15.272V11.7001C11.3908 11.4188 11.6158 11.1938 11.8971 11.1938H15.4689C15.7502 11.1938 15.9752 11.4188 15.9752 11.7001V15.272Z"
                    fill=""
                  />
                </svg>`,
        label: 'Dashboard',
        route: '#',
        children: [{ label: 'eCommerce', route: '/' }],
        roles: ['superadmin', 'admin', 'staff']
      },
      // Sales removed
      {
        icon: `<svg xmlns="http://www.w3.org/2000/svg" class="fill-current" width="18" height="18" viewBox="0 0 24 24">
                <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/>
              </svg>`,
        label: 'User',
        route: '/users',
        roles: ['admin', 'superadmin'],
        permissions: ['view_sales', 'manage_sales']
      },
      {
        icon: `<svg xmlns="http://www.w3.org/2000/svg" class="fill-current" width="18" height="18" viewBox="0 0 24 24">
                <path d="M16 4c0-1.11.89-2 2-2s2 .89 2 2-.89 2-2 2-2-.89-2-2zm4 18v-6h2.5l-2.54-7.63A1.5 1.5 0 0 0 18.54 8H17c-.8 0-1.54.37-2.01 1l-3.99 5.33V4c0-.55-.45-1-1-1s-1 .45-1 1v16h2v-7.5l3.5-4.67c.25-.33.62-.53 1.01-.53H19l1.5 4.5H20V22h2z"/>
              </svg>`,
        label: 'Employee',
        route: '/employee'
      },
      {
        icon: `<svg xmlns="http://www.w3.org/2000/svg" class="fill-current" width="18" height="18" viewBox="0 0 24 24">
                <path d="M16 4c0-1.11.89-2 2-2s2 .89 2 2-.89 2-2 2-2-.89-2-2zm4 18v-6h2.5l-2.54-7.63A1.5 1.5 0 0 0 18.54 8H17c-.8 0-1.54.37-2.01 1l-3.99 5.33V4c0-.55-.45-1-1-1s-1 .45-1 1v16h2v-7.5l3.5-4.67c.25-.33.62-.53 1.01-.53H19l1.5 4.5H20V22h2z"/>
              </svg>`,
        label: 'Brand',
        route: '/brand',
        roles: ['superadmin', 'admin']
      },
      {
        icon: `<svg xmlns="http://www.w3.org/2000/svg" class="fill-current" width="18" height="18" viewBox="0 0 24 24">
                <path d="M12 2a10 10 0 1 0 10 10A10.011 10.011 0 0 0 12 2zm0 18a8 8 0 1 1 8-8 8.009 8.009 0 0 1-8 8zm-1-13h2v6h-2zm0 8h2v2h-2z"/>
              </svg>`,
        label: 'Department',
        route: '/departments',
        roles: ['superadmin', 'admin']
      },
      {
        icon: `<svg xmlns="http://www.w3.org/2000/svg" class="fill-current" width="18" height="18" viewBox="0 0 24 24">
                <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>
              </svg>`,
        label: 'Category',
        route: '/main-category',
        roles: ['superadmin', 'admin']
      },
      {
        icon: `<svg xmlns="http://www.w3.org/2000/svg" class="fill-current" width="18" height="18" viewBox="0 0 24 24">
                <path d="M21.41 11.58l-9-9C12.05 2.22 11.55 2 11 2H4c-1.1 0-2 .9-2 2v7c0 .55.22 1.05.59 1.42l9 9c.36.36.86.58 1.41.58.55 0 1.05-.22 1.41-.59l7-7c.37-.36.59-.86.59-1.41 0-.55-.23-1.06-.59-1.42zM5.5 7C4.67 7 4 6.33 4 5.5S4.67 4 5.5 4 7 4.67 7 5.5 6.33 7 5.5 7z"/>
              </svg>`,
        label: 'Items ',
        route: '/product',
        permissions: ['view_suppliers', 'manage_suppliers']
      },
      {
        icon: `<svg xmlns="http://www.w3.org/2000/svg" class="fill-current" width="18" height="18" viewBox="0 0 24 24">
                <path d="M20 4H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm-5 14H4v-4h11v4zm0-5H4V9h11v4zm5 5h-4V9h4v9z"/>
              </svg>`,
        label: 'Inventory ',
        route: '',
        children: [
          { label: 'Purchase order', route: '/reorder', roles: ['superadmin', 'admin'] },
          {
            label: 'Inventory counts',
            route: '/inventory-counts',
            roles: ['superadmin', 'admin', 'staff']
          },
          {
            label: 'Delivery Receipts',
            route: '/inventory/delivery-receipts',
            roles: ['superadmin', 'admin', 'staff']
          },
          {
            label: 'Stock adjustments',
            route: '/stock-adjustments',
            roles: ['superadmin', 'admin']
          },
          {
            label: 'Requisition Issue Slips',
            route: '/inventory/ris',
            roles: ['superadmin', 'admin', 'staff']
          },
          {
            label: 'Inventory Records',
            route: '/inventory/record',
            roles: ['superadmin', 'admin', 'staff']
          },
          {
            label: 'Supplier',
            route: '/supplier',
            roles: ['superadmin'],
            permissions: ['view_suppliers', 'manage_suppliers']
          }
        ],
        roles: ['superadmin', 'admin', 'staff']
      },
      {
        icon: `<svg xmlns="http://www.w3.org/2000/svg" class="fill-current" width="18" height="18" viewBox="0 0 24 24">
                <path d="M14 2H6c-1.1 0-1.99.9-1.99 2L4 20c0 1.1.89 2 1.99 2H18c1.1 0 2-.9 2-2V8l-6-6zm2 16H8v-2h8v2zm0-4H8v-2h8v2zm-3-5V3.5L18.5 9H13z"/>
              </svg>`,
        label: 'Asset Management',
        route: '',
        children: [
          { label: 'Memorandum Receipt', route: '/mr', roles: ['superadmin', 'admin', 'staff'] },
          { label: 'Maintenance & Repair', route: '/maintenance', roles: ['superadmin', 'admin', 'staff'] },
          { label: 'Disposal', route: '/disposal', roles: ['superadmin', 'admin', 'staff'] },
          { label: 'Borrow Items', route: '/borrow', roles: ['superadmin', 'admin', 'staff'] }
        ],
        roles: ['superadmin', 'admin', 'staff']
      },
      {
        icon: `<svg xmlns="http://www.w3.org/2000/svg" class="fill-current" width="18" height="18" viewBox="0 0 24 24">
                <path d="M3 5v4h2V5h4V3H5c-1.1 0-2 .9-2 2zm2 10H3v4c0 1.1.9 2 2 2h4v-2H5v-4zm14 4h-4v2h4c1.1 0 2-.9 2-2v-4h-2v4zm0-16h-4v2h4v4h2V5c0-1.1-.9-2-2-2z"/>
              </svg>`,
        label: 'Item Tracking',
        route: '',
        children: [
          { label: 'Inventory List', route: '/inventory/list', roles: ['superadmin', 'admin', 'staff'] },
          { label: 'Barcodes', route: '/barcodes', roles: ['superadmin', 'admin'] },
          { label: 'ACN Management', route: '/acn', roles: ['superadmin', 'admin'] }
        ],
        roles: ['superadmin', 'admin', 'staff']
      }
      // POS removed
    ]
  },
  {
    name: 'OTHERS',
    menuItems: [
      {
        icon: `
        <svg xmlns="http://www.w3.org/2000/svg"  viewBox="0 0 72 72" class="fill-current" width="24" height="24" ><path d="M57.531,30.556C58.96,30.813,60,32.057,60,33.509v4.983c0,1.452-1.04,2.696-2.469,2.953l-2.974,0.535	c-0.325,1.009-0.737,1.977-1.214,2.907l1.73,2.49c0.829,1.192,0.685,2.807-0.342,3.834l-3.523,3.523	c-1.027,1.027-2.642,1.171-3.834,0.342l-2.49-1.731c-0.93,0.477-1.898,0.889-2.906,1.214l-0.535,2.974	C41.187,58.96,39.943,60,38.491,60h-4.983c-1.452,0-2.696-1.04-2.953-2.469l-0.535-2.974c-1.009-0.325-1.977-0.736-2.906-1.214	l-2.49,1.731c-1.192,0.829-2.807,0.685-3.834-0.342l-3.523-3.523c-1.027-1.027-1.171-2.641-0.342-3.834l1.73-2.49	c-0.477-0.93-0.889-1.898-1.214-2.907l-2.974-0.535C13.04,41.187,12,39.943,12,38.491v-4.983c0-1.452,1.04-2.696,2.469-2.953	l2.974-0.535c0.325-1.009,0.737-1.977,1.214-2.907l-1.73-2.49c-0.829-1.192-0.685-2.807,0.342-3.834l3.523-3.523	c1.027-1.027,2.642-1.171,3.834-0.342l2.49,1.731c0.93-0.477,1.898-0.889,2.906-1.214l0.535-2.974C30.813,13.04,32.057,12,33.509,12	h4.983c1.452,0,2.696,1.04,2.953,2.469l0.535,2.974c1.009,0.325,1.977,0.736,2.906,1.214l2.49-1.731	c1.192-0.829,2.807-0.685,3.834,0.342l3.523,3.523c1.027,1.027,1.171,2.641,0.342,3.834l-1.73,2.49	c0.477,0.93,0.889,1.898,1.214,2.907L57.531,30.556z M36,45c4.97,0,9-4.029,9-9c0-4.971-4.03-9-9-9s-9,4.029-9,9	C27,40.971,31.03,45,36,45z"/></svg>
        `,
        label: 'Settings',
        route: '#',
        children: [
          { label: 'Reorder Point', route: '/settings/reorder-point', roles: ['superadmin'] },
          {
            label: 'Account Settings',
            route: '/settings/account',
            roles: ['superadmin', 'admin', 'staff']
          },
          { label: 'Activity Logs', route: '/activity-logs', roles: ['superadmin'] }
        ],
        roles: ['superadmin', 'admin', 'staff']
      }
    ]
  }
])

const filteredMenuGroups = computed(() => {
  return allMenuGroups.value
    .map((group) => {
      return {
        ...group,
        menuItems: group.menuItems
          .filter((item) => {
            // If no roles or permissions specified, show to everyone
            if (!item.roles && !item.permissions) return true

            // Check if user has required role
            const hasRequiredRole = !item.roles || authStore.hasRole(item.roles)

            // Check if user has required permissions
            const hasRequiredPermission =
              !item.permissions ||
              item.permissions.some((permission) => authStore.hasPermission(permission))

            return hasRequiredRole && hasRequiredPermission
          })
          .map((item) => {
            // Filter children based on permissions
            if (item.children) {
              return {
                ...item,
                children: item.children.filter((child) => {
                  // If child has no roles or permissions, inherit from parent
                  if (!child.roles && !child.permissions) {
                    return true
                  }

                  const hasRequiredRole = !child.roles || authStore.hasRole(child.roles)
                  const hasRequiredPermission =
                    !child.permissions ||
                    child.permissions.some((permission) => authStore.hasPermission(permission))

                  return hasRequiredRole && hasRequiredPermission
                })
              }
            }
            return item
          })
          .filter((item) => {
            // Hide parent items that have no visible children
            if (item.children && item.children.length === 0) {
              return false
            }
            return true
          })
      }
    })
    .filter((group) => {
      // Hide groups that have no visible menu items
      return group.menuItems.length > 0
    })
})
</script>

<template>
  <aside
    class="absolute left-0 top-0 z-9999 flex h-screen w-72.5 flex-col overflow-y-hidden bg-black duration-300 ease-linear dark:bg-boxdark lg:static lg:translate-x-0"
    :class="{
      'translate-x-0': sidebarStore.isSidebarOpen,
      '-translate-x-full': !sidebarStore.isSidebarOpen
    }"
    ref="target"
  >
    <!-- SIDEBAR HEADER -->
    <div class="flex items-center justify-between gap-2 px-6 py-5.5 lg:py-6.5">
      <h1 class="font-sans font-bold text-white text-xl">MIS Inventory System</h1>
      <!-- </router-link> -->

      <button class="block lg:hidden" @click="sidebarStore.isSidebarOpen = false">
        <svg
          class="fill-current"
          width="20"
          height="18"
          viewBox="0 0 20 18"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <path
            d="M19 8.175H2.98748L9.36248 1.6875C9.69998 1.35 9.69998 0.825 9.36248 0.4875C9.02498 0.15 8.49998 0.15 8.16248 0.4875L0.399976 8.3625C0.0624756 8.7 0.0624756 9.225 0.399976 9.5625L8.16248 17.4375C8.31248 17.5875 8.53748 17.7 8.76248 17.7C8.98748 17.7 9.17498 17.625 9.36248 17.475C9.69998 17.1375 9.69998 16.6125 9.36248 16.275L3.02498 9.8625H19C19.45 9.8625 19.825 9.4875 19.825 9.0375C19.825 8.55 19.45 8.175 19 8.175Z"
            fill=""
          />
        </svg>
      </button>
    </div>
    <!-- SIDEBAR HEADER -->

    <div class="no-scrollbar flex flex-col overflow-y-auto duration-300 ease-linear">
      <!-- Sidebar Menu -->
      <nav class="mt-5 py-4 px-4 lg:mt-9 lg:px-6">
        <div v-for="menuGroup in filteredMenuGroups" :key="menuGroup.name">
          <h3 class="mb-4 ml-4 text-sm font-medium text-bodydark2">{{ menuGroup.name }}</h3>

          <ul class="mb-6 flex flex-col gap-1.5">
            <SidebarItem
              v-for="(menuItem, index) in menuGroup.menuItems"
              :item="menuItem"
              :key="index"
              :index="index"
            />
          </ul>
        </div>
      </nav>
      <!-- Sidebar Menu -->
    </div>
  </aside>
</template>
