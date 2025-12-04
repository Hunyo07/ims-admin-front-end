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
        route: '/eCommerce',
        roles: ['superadmin', 'admin']
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
        icon: `<svg xmlns="http://www.w3.org/2000/svg" class="fill-current" width="18" height="18" viewBox="0 0 512 512"><path d="M96 0C60.7 0 32 28.7 32 64l0 384c0 35.3 28.7 64 64 64l288 0c35.3 0 64-28.7 64-64l0-384c0-35.3-28.7-64-64-64L96 0zM208 288l64 0c44.2 0 80 35.8 80 80 0 8.8-7.2 16-16 16l-192 0c-8.8 0-16-7.2-16-16 0-44.2 35.8-80 80-80zm-24-96a56 56 0 1 1 112 0 56 56 0 1 1 -112 0zM512 80c0-8.8-7.2-16-16-16s-16 7.2-16 16l0 64c0 8.8 7.2 16 16 16s16-7.2 16-16l0-64zm0 128c0-8.8-7.2-16-16-16s-16 7.2-16 16l0 64c0 8.8 7.2 16 16 16s16-7.2 16-16l0-64zM496 320c-8.8 0-16 7.2-16 16l0 64c0 8.8 7.2 16 16 16s16-7.2 16-16l0-64c0-8.8-7.2-16-16-16z"/></svg>`,
        label: 'Employee',
        route: '/employee',
        roles: ['superadmin', 'admin']
      },
      {
        icon: `<svg xmlns="http://www.w3.org/2000/svg" class="fill-current" width="18" height="18" viewBox="0 0 512 512"><path d="M32.5 96l0 149.5c0 17 6.7 33.3 18.7 45.3l192 192c25 25 65.5 25 90.5 0L483.2 333.3c25-25 25-65.5 0-90.5l-192-192C279.2 38.7 263 32 246 32L96.5 32c-35.3 0-64 28.7-64 64zm112 16a32 32 0 1 1 0 64 32 32 0 1 1 0-64z"/></svg>`,
        label: 'Brand',
        route: '/brand',
        roles: ['superadmin', 'admin']
      },
      {
        icon: `<svg xmlns="http://www.w3.org/2000/svg" class="fill-current" width="18" height="18" viewBox="0 0 512 512"><path d="M192 64c0-17.7 14.3-32 32-32l64 0c17.7 0 32 14.3 32 32l0 64c0 17.7-14.3 32-32 32l-8 0 0 64 120 0c39.8 0 72 32.2 72 72l0 56 8 0c17.7 0 32 14.3 32 32l0 64c0 17.7-14.3 32-32 32l-64 0c-17.7 0-32-14.3-32-32l0-64c0-17.7 14.3-32 32-32l8 0 0-56c0-13.3-10.7-24-24-24l-120 0 0 80 8 0c17.7 0 32 14.3 32 32l0 64c0 17.7-14.3 32-32 32l-64 0c-17.7 0-32-14.3-32-32l0-64c0-17.7 14.3-32 32-32l8 0 0-56c0-39.8 32.2-72 72-72l120 0 0-64-8 0c-17.7 0-32-14.3-32-32l0-64z"/></svg>`,
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
        icon: `<svg xmlns="http://www.w3.org/2000/svg" class="fill-current" width="18" height="18" viewBox="0 0 448 512"><path d="M128 0C110.3 0 96 14.3 96 32l0 32-32 0C28.7 64 0 92.7 0 128l0 48 448 0 0-48c0-35.3-28.7-64-64-64l-32 0 0-32c0-17.7-14.3-32-32-32s-32 14.3-32 32l0 32-128 0 0-32c0-17.7-14.3-32-32-32zM0 224L0 416c0 35.3 28.7 64 64 64l320 0c35.3 0 64-28.7 64-64l0-192-448 0z"/></svg>
      `,
        label: 'Task Schedule',
        route: '/events',
        roles: ['superadmin', 'admin']
      },
      {
        icon: `<svg xmlns="http://www.w3.org/2000/svg" class="fill-current" width="18" height="18" viewBox="0 0 576 512"><path d="M352.1 146.7l0-49.6c0-10.7 5.3-20.7 14.2-26.6L485.2-8.7c6.3-4.2 14.8-3.4 20.2 2l45.4 45.5c5.4 5.4 6.2 13.8 2 20.2L473.6 177.8c-5.9 8.9-15.9 14.2-26.6 14.2l-49.6 0-90.7 90.7c15 33.3 8.9 73.9-18.5 101.3L162.1 510.1c-18.7 18.7-49.1 18.7-67.9 0L34.1 449.9c-18.7-18.7-18.7-49.1 0-67.9L160.1 256c27.4-27.4 67.9-33.6 101.3-18.5l90.7-90.7z"/></svg>`,
        label: 'Repair & Maintenance',
        route: '/maintenance/logs',
        roles: ['superadmin', 'admin', 'staff']
      },
      {
        icon: `<svg xmlns="http://www.w3.org/2000/svg" class="fill-current" width="18" height="18" viewBox="0 0 448 512"><path d="M369.4 128l-34.3-48-222.1 0-34.3 48 290.7 0zM0 148.5c0-13.3 4.2-26.3 11.9-37.2L60.9 42.8C72.9 26 92.3 16 112.9 16l222.1 0c20.7 0 40.1 10 52.1 26.8l48.9 68.5c7.8 10.9 11.9 23.9 11.9 37.2L448 416c0 35.3-28.7 64-64 64L64 480c-35.3 0-64-28.7-64-64L0 148.5z"/></svg>`,
        label: 'Items ',
        route: '/product',
        permissions: ['view_suppliers', 'manage_suppliers'],
        roles: ['superadmin', 'admin']
      },
      {
        icon: `<svg xmlns="http://www.w3.org/2000/svg" class="fill-current" width="18" height="18" viewBox="0 0 512 512"><path d="M418.4 157.9c35.3-8.3 61.6-40 61.6-77.9 0-44.2-35.8-80-80-80-43.4 0-78.7 34.5-80 77.5L136.2 151.1C121.7 136.8 101.9 128 80 128 35.8 128 0 163.8 0 208s35.8 80 80 80c12.2 0 23.8-2.7 34.1-7.6L259.7 407.8c-2.4 7.6-3.7 15.8-3.7 24.2 0 44.2 35.8 80 80 80s80-35.8 80-80c0-27.7-14-52.1-35.4-66.4l37.8-207.7zM156.3 232.2c2.2-6.9 3.5-14.2 3.7-21.7l183.8-73.5c3.6 3.5 7.4 6.7 11.6 9.5L317.6 354.1c-5.5 1.3-10.8 3.1-15.8 5.5L156.3 232.2z"/></svg>`,
        label: 'Borrow Items',
        route: '/borrow',
        roles: ['superadmin', 'admin', 'staff']
      },
      {
        icon: `<svg xmlns="http://www.w3.org/2000/svg" class="fill-current" width="18" height="18" viewBox="0 0 24 24">
                <path d="M20 4H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm-5 14H4v-4h11v4zm0-5H4V9h11v4zm5 5h-4V9h4v9z"/>
              </svg>`,
        label: 'Inventory ',
        route: '',
        children: [
          // { label: 'Purchase order', route: '/reorder', roles: ['superadmin', 'admin'] },
          {
            label: 'Inventory counts',
            route: '/inventory-counts',
            roles: ['superadmin', 'admin']
          },
          {
            label: 'Delivery Receipts',
            route: '/inventory/delivery-receipts',
            roles: ['superadmin', 'admin']
          },
          {
            label: 'Stock adjustments',
            route: '/stock-adjustments',
            roles: ['superadmin', 'admin']
          },
          {
            label: 'Requisition Issue Slips',
            route: '/inventory/ris',
            roles: ['superadmin', 'admin']
          },
          {
            label: 'Inventory Records',
            route: '/inventory/record',
            roles: ['superadmin', 'admin']
          },
          {
            label: 'Supplier',
            route: '/supplier',
            roles: ['superadmin'],
            permissions: ['view_suppliers', 'manage_suppliers']
          }
        ],
        roles: ['superadmin', 'admin']
      },
      {
        icon: `<svg xmlns="http://www.w3.org/2000/svg" class="fill-current" width="18" height="18" viewBox="0 0 24 24">
                <path d="M14 2H6c-1.1 0-1.99.9-1.99 2L4 20c0 1.1.89 2 1.99 2H18c1.1 0 2-.9 2-2V8l-6-6zm2 16H8v-2h8v2zm0-4H8v-2h8v2zm-3-5V3.5L18.5 9H13z"/>
              </svg>`,
        label: 'Asset Management',
        route: '',
        children: [
          { label: 'Memorandum Receipt', route: '/mr', roles: ['superadmin', 'admin', 'staff'] },

          { label: 'Disposal', route: '/disposal', roles: ['superadmin', 'admin', 'staff'] },
          {
            label: 'Warranty & Returns',
            route: '/warranty/supplier-returns',
            roles: ['superadmin', 'admin', 'staff'],
            permissions: ['view_supplier_returns']
          }
        ],
        roles: ['superadmin', 'admin']
      },
      {
        icon: `<svg xmlns="http://www.w3.org/2000/svg" class="fill-current" width="18" height="18" viewBox="0 0 24 24">
                <path d="M3 5v4h2V5h4V3H5c-1.1 0-2 .9-2 2zm2 10H3v4c0 1.1.9 2 2 2h4v-2H5v-4zm14 4h-4v2h4c1.1 0 2-.9 2-2v-4h-2v4zm0-16h-4v2h4v4h2V5c0-1.1-.9-2-2-2z"/>
              </svg>`,
        label: 'Item Tracking',
        route: '',
        children: [
          // { label: 'Inventory List', route: '/inventory/list', roles: ['superadmin', 'admin', 'staff'] },
          { label: 'Barcodes', route: '/barcodes', roles: ['superadmin', 'admin'] },
          { label: 'ACN Management', route: '/acn', roles: ['superadmin', 'admin'] }
        ],
        roles: ['superadmin', 'admin']
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
          // { label: 'Reorder Point', route: '/settings/reorder-point', roles: ['superadmin'] },
          {
            label: 'Account Settings',
            route: '/settings/account',
            roles: ['superadmin', 'admin']
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
