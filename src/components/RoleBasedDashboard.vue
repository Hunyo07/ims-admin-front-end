<script setup lang="ts">
import { useAuthStore } from '../stores'
import { computed } from 'vue'

const authStore = useAuthStore()

const userRole = computed(() => authStore.getUserRole())
const userRoleDisplay = computed(() => authStore.getUserRoleDisplayName())

// Define dashboard sections based on roles
const dashboardSections = computed(() => {
  const sections = {
    superadmin: [
      {
        title: 'System Overview',
        description: 'Complete system management and monitoring',
        features: [
          'User Management',
          'System Settings',
          'Advanced Analytics',
          'Role Management'
        ]
      },
      {
        title: 'Business Operations',
        description: 'Full operational control',
        features: [
          'Product Management',
          'Inventory Control',
          'Sales Management',
          'Supplier Management',
          'Customer Management'
        ]
      }
    ],
    admin: [
      {
        title: 'Business Management',
        description: 'Manage your business operations',
        features: [
          'User Management',
          'Product Management',
          'Inventory Control',
          'Sales Management',
          'Customer Management'
        ]
      },
      {
        title: 'Business Analytics',
        description: 'Monitor business performance',
        features: [
          'Sales Reports',
          'Inventory Reports',
          'Customer Analytics',
          'Performance Metrics'
        ]
      }
    ],
    staff: [
      {
        title: 'Daily Operations',
        description: 'Essential tools for daily work',
        features: [
          'POS System',
          'Customer Service',
          'Basic Inventory View',
          'Sales Processing'
        ]
      },
      {
        title: 'Quick Access',
        description: 'Frequently used features',
        features: [
          'Process Sales',
          'View Products',
          'Customer Information',
          'Basic Reports'
        ]
      }
    ],
    customer: [
      {
        title: 'Product Catalog',
        description: 'Browse available products',
        features: [
          'View Products',
          'Product Search',
          'Product Categories'
        ]
      }
    ]
  }

  return sections[userRole.value as keyof typeof sections] || []
})

const canAccessFeature = (feature: string) => {
  return authStore.canAccess(feature)
}

const canPerformAction = (action: string) => {
  return authStore.canPerform(action)
}
</script>

<template>
  <div class="role-based-dashboard max-w-7xl mx-auto px-4 py-6">
    <!-- Role Header -->
    <div class="mb-6 p-4 bg-gradient-to-r from-blue-600 to-purple-600 rounded-lg text-white">
      <h1 class="text-2xl font-bold mb-2">Welcome, {{ authStore.userDisplayName }}</h1>
      <p class="text-blue-100">Role: {{ userRoleDisplay }}</p>
      <p class="text-sm text-blue-200">Access Level: {{ userRole }}</p>
    </div>

    <!-- Dashboard Sections -->
    <!-- <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      <div 
        v-for="(section, index) in dashboardSections" 
        :key="index"
        class="bg-white rounded-lg shadow-md p-6 border border-gray-200"
      >
        <h3 class="text-lg font-semibold text-gray-800 mb-2">{{ section.title }}</h3>
        <p class="text-gray-600 text-sm mb-4">{{ section.description }}</p>
        
        <ul class="space-y-2">
          <li 
            v-for="feature in section.features" 
            :key="feature"
            class="flex items-center text-sm"
          >
            <svg 
              class="w-4 h-4 text-green-500 mr-2" 
              fill="currentColor" 
              viewBox="0 0 20 20"
            >
              <path 
                fill-rule="evenodd" 
                d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" 
                clip-rule="evenodd"
              />
            </svg>
            {{ feature }}
          </li>
        </ul>
      </div>
    </div> -->

    <!-- Quick Actions -->
    <div class="mt-8">
      <h2 class="text-xl font-semibold text-gray-800 mb-4">Quick Actions</h2>
      <div class="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
        <!-- POS Access -->
        <div 
          v-if="canAccessFeature('pos')"
          class="bg-green-50 border border-green-200 rounded-lg p-4 text-center hover:bg-green-100 transition-colors cursor-pointer"
          @click="$router.push('/pos')"
        >
          <div class="text-green-600 text-2xl mb-2">🛒</div>
          <div class="text-sm font-medium text-green-800">POS System</div>
        </div>

        <!-- Product Management -->
        <div 
          v-if="canAccessFeature('products')"
          class="bg-blue-50 border border-blue-200 rounded-lg p-4 text-center hover:bg-blue-100 transition-colors cursor-pointer"
          @click="$router.push('/product')"
        >
          <div class="text-blue-600 text-2xl mb-2">📦</div>
          <div class="text-sm font-medium text-blue-800">Products</div>
        </div>

        <!-- Sales Management -->
        <div 
          v-if="canAccessFeature('sales')"
          class="bg-purple-50 border border-purple-200 rounded-lg p-4 text-center hover:bg-purple-100 transition-colors cursor-pointer"
          @click="$router.push('/sales')"
        >
          <div class="text-purple-600 text-2xl mb-2">📊</div>
          <div class="text-sm font-medium text-purple-800">Sales</div>
        </div>

        <!-- Customer Management -->
        <div 
          v-if="canAccessFeature('customers')"
          class="bg-orange-50 border border-orange-200 rounded-lg p-4 text-center hover:bg-orange-100 transition-colors cursor-pointer"
          @click="$router.push('/customer')"
        >
          <div class="text-orange-600 text-2xl mb-2">👥</div>
          <div class="text-sm font-medium text-orange-800">Customers</div>
        </div>

        <!-- Inventory Management -->
        <div 
          v-if="canAccessFeature('inventory')"
          class="bg-red-50 border border-red-200 rounded-lg p-4 text-center hover:bg-red-100 transition-colors cursor-pointer"
          @click="$router.push('/inventory-counts')"
        >
          <div class="text-red-600 text-2xl mb-2">📋</div>
          <div class="text-sm font-medium text-red-800">Inventory</div>
        </div>

        <!-- User Management (Admin only) -->
        <div 
          v-if="canAccessFeature('users')"
          class="bg-gray-50 border border-gray-200 rounded-lg p-4 text-center hover:bg-gray-100 transition-colors cursor-pointer"
          @click="$router.push('/users')"
        >
          <div class="text-gray-600 text-2xl mb-2">👤</div>
          <div class="text-sm font-medium text-gray-800">Users</div>
        </div>
      </div>
    </div>

    <!-- Permission Status -->
    <!-- <div class="mt-8 p-4 bg-gray-50 rounded-lg">
      <h3 class="text-lg font-semibold text-gray-800 mb-3">Your Permissions</h3>
      <div class="mb-4">
        <p class="text-sm text-gray-600">User Role: {{ userRole }}</p>
        <p class="text-sm text-gray-600">Total Permissions: {{ authStore.userPermissions.length }}</p>
      </div>
      <div class="grid grid-cols-2 md:grid-cols-4 gap-2">
        <div 
          v-for="permission in authStore.userPermissions" 
          :key="permission"
          class="text-xs bg-green-100 text-green-800 px-2 py-1 rounded"
        >
          {{ permission }}
        </div>
      </div> -->
      
      <!-- Debug Information -->
      <!-- <div class="mt-4 p-3 bg-yellow-50 border border-yellow-200 rounded">
        <h4 class="text-sm font-semibold text-yellow-800 mb-2">Debug Information</h4>
        <pre class="text-xs text-yellow-700 overflow-auto">{{ JSON.stringify({
          user: authStore.user,
          role: authStore.userRole,
          permissions: authStore.userPermissions,
          isAuthenticated: authStore.isAuthenticated
        }, null, 2) }}</pre>
      </div>
    </div> -->
  </div>
</template> 