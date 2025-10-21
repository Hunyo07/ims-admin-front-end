import { createRouter, createWebHistory } from 'vue-router'

// import SalesManagementView from '../views/Sales/SalesManagementView.vue'
// import CreatSaleView from '../views/Sales/CreateSaleView.vue'
const RISListView = () => import('../views/Inventory/RISListView.vue')
const RISDetailView = () => import('../views/Inventory/RISDetailView.vue')

const RISPrintView = () => import('../views/Inventory/RISPrintView.vue')
const CreateRISView = () => import('../views/Inventory/CreateRISView.vue')
const DepartmentManagementView = () => import('../views/Department/DepartmentManagementView.vue')

const routes = [
  {
    path: '/',
    name: 'signin',
    component: () => import('../views/Authentication/SigninView.vue'),
    meta: {
      title: 'Signin',
      requiresAuth: false
    }
  },
  {
    path: '/auth/signup',
    name: 'signup',
    component: () => import('../views/Authentication/SignupView.vue'),
    meta: {
      title: 'Signup',
      requiresAuth: false
    }
  },
  {
    path: '/forgot-password',
    name: 'forgot-password',
    component: () => import('../views/Authentication/ForgotPasswordView.vue'),
    meta: {
      title: 'Forgot Password',
      requiresAuth: false
    }
  },
  {
    path: '/reset-password/:token',
    name: 'reset-password',
    component: () => import('../views/Authentication/ResetPasswordView.vue'),
    meta: {
      title: 'Reset Password',
      requiresAuth: false
    }
  },
  {
    path: '/departments',
    name: 'departments',
    component: DepartmentManagementView,
    meta: {
      title: 'Departments',
      requiresAuth: true
    }
  },
  {
    path: '/eCommerce',
    name: 'eCommerce',
    component: () => import('../views/Dashboard/ECommerceView.vue'),
    meta: {
      title: 'eCommerce Dashboard',
      requiresAuth: true
    }
  },
  {
    path: '/inventory-counts',
    name: 'Inventory Counts',
    component: () => import('../views/Inventory/InventoryCountsView.vue'),
    meta: {
      title: 'Inventory Counts',
      requiresAuth: true,
      roles: ['superadmin', 'admin', 'staff'],
      permissions: ['view_inventory']
    }
  },
  {
    path: '/inventory/stock-adjustments',
    name: 'StockAdjustments',
    component: () => import('../views/Inventory/StockAdjustmentsView.vue'),
    meta: {
      requiresAuth: true
    }
  },
  {
    path: '/brand',
    name: 'brand',
    component: () => import('../views/Brand/BrandManagementView.vue'),
    meta: {
      title: 'Brand Management',
      requiresAuth: true,
      roles: ['superadmin', 'admin'],
      permissions: ['view_brands', 'manage_brands']
    }
  },
  {
    path: '/stock-adjustments',
    name: 'Stock Adjustments',
    component: () => import('../views/Inventory/StockAdjustmentsView.vue'),
    meta: {
      title: 'Stock Adjustments',
      requiresAuth: true
    }
  },
  // Update your route definitions to include role requirements
  // Example for a route that requires specific roles:
  {
    path: '/users',
    name: 'users',
    component: () => import('../views/User/UserManagementView.vue'),
    meta: {
      title: 'User Management',
      requiresAuth: true,
      roles: ['superadmin', 'admin'],
      permissions: ['view_users', 'manage_users']
    }
  },
  {
    path: '/activity-logs',
    name: 'activity-logs',
    component: () => import('../views/ActivityLog/ActivityLogView.vue'),
    meta: {
      title: 'Activity Logs',
      requiresAuth: true,
      roles: ['superadmin'],
      permissions: ['view_activity_logs']
    }
  },
  {
    path: '/employee',
    name: 'employee',
    component: () => import('../views/Employee/EmployeeManagementView.vue'),
    meta: {
      title: 'Employee',
      requiresAuth: true,
      roles: ['superadmin', 'admin', 'staff'],
      permissions: ['view_customers', 'manage_customers']
    }
  },
  // RIS routes
  {
    path: '/inventory/ris',
    name: 'ris-list',
    component: RISListView,
    meta: { title: 'Requisition Issue Slips', requiresAuth: true }
  },
  {
    path: '/inventory/ris/create',
    name: 'ris-create',
    component: CreateRISView,
    meta: { title: 'Create Requisition Issue Slip', requiresAuth: true }
  },
  {
    path: '/inventory/ris/:id',
    name: 'ris-detail',
    component: RISDetailView,
    meta: { title: 'RIS Details', requiresAuth: true }
  },
  {
    path: '/inventory/ris/:id/print',
    name: 'ris-print',
    component: RISPrintView,
    meta: { title: 'Print RIS', requiresAuth: true }
  },
  {
    path: '/inventory/record',
    name: 'InventoryRecord',
    component: () => import('../views/Inventory/InventoryRecord.vue'),
    meta: { title: 'Inventory Records', requiresAuth: true }
  },
  {
    path: '/inventory/record/create',
    name: 'InventoryRecordCreate',
    component: () => import('../views/Inventory/CreateInventoryRecordFlow.vue'),
    meta: { title: 'Create Inventory Record', requiresAuth: true }
  },
  {
    path: '/inventory/list',
    name: 'InventoryList',
    component: () => import('../views/Inventory/InventoryListView.vue'),
    meta: { title: 'Inventory List', requiresAuth: true }
  },
  {
    path: '/supplier',
    name: 'supllier',
    component: () => import('../views/Supplier/SupplierManagementView.vue'),
    meta: {
      title: 'Supplier Management',
      requiresAuth: true,
      roles: ['superadmin'],
      permissions: ['view_suppliers', 'manage_suppliers']
    }
  },
  {
    path: '/main-category',
    name: 'main-category',
    component: () => import('../views/Category/MainCategoryView.vue'),
    meta: {
      title: 'Category Management',
      requiresAuth: true,
      roles: ['superadmin', 'admin'],
      permissions: ['view_categories', 'manage_categories']
    }
  },
  {
    path: '/sub-category',
    name: 'sub-category',
    // component removed
    component: () => import('../views/Category/SubCategoryView.vue'),
    meta: {
      title: 'Sub Category Management',
      requiresAuth: true,
      roles: ['superadmin', 'admin'],
      permissions: ['view_categories', 'manage_categories']
    }
  },
  {
    path: '/settings/reorder-point',
    name: 'reorder-point',
    component: () => import('../views/Settings/ReorderPointView.vue'),
    meta: {
      title: 'Reorder Point',
      requiresAuth: true,
      roles: ['superadmin'],
      permissions: ['manage_settings']
    }
  },
  {
    path: '/product',
    name: 'product',
    component: () => import('../views/Product/ProductManagementView.vue'),
    meta: {
      title: 'Product Management',
      requiresAuth: true,
      roles: ['superadmin', 'admin', 'staff'],
      permissions: ['view_products']
    }
  },
  {
    path: '/reorder',
    name: 'reorder',
    component: () => import('../views/Reorder/PurchaseMangementView.vue'),
    meta: {
      title: 'Reorder Management',
      requiresAuth: true,
      roles: ['superadmin', 'admin'],
      permissions: ['view_orders', 'manage_orders']
    }
  },
  {
    path: '/barcodes',
    name: 'barcodes',
    component: () => import('../views/Barcodes/BarcodeManagementView.vue'),
    meta: {
      title: 'Barcode Management',
      requiresAuth: true,
      roles: ['superadmin', 'admin'],
      permissions: ['view_barcodes', 'manage_barcodes']
    }
  },
  {
    path: '/acn',
    name: 'acn',
    component: () => import('../views/Barcodes/ACNManagementView.vue'),
    meta: {
      title: 'ACN Management',
      requiresAuth: true,
      roles: ['superadmin', 'admin'],
      permissions: ['view_barcodes', 'manage_barcodes']
    }
  },
  {
    path: '/calendar',
    name: 'calendar',
    component: () => import('../views/CalendarView.vue'),
    meta: {
      title: 'Calendar',
      requiresAuth: true
    }
  },
  {
    path: '/profile',
    name: 'profile',
    component: () => import('../views/ProfileView.vue'),
    meta: {
      title: 'Profile',
      requiresAuth: true
    }
  },
  {
    path: '/forms/form-elements',
    name: 'formElements',
    component: () => import('../views/Forms/FormElementsView.vue'),
    meta: {
      title: 'Form Elements',
      requiresAuth: true
    }
  },
  {
    path: '/forms/form-layout',
    name: 'formLayout',
    component: () => import('../views/Forms/FormLayoutView.vue'),
    meta: {
      title: 'Form Layout',
      requiresAuth: true
    }
  },
  {
    path: '/tables',
    name: 'tables',
    component: () => import('../views/TablesView.vue'),
    meta: {
      title: 'Tables',
      requiresAuth: true
    }
  },
  {
    path: '/pages/settings',
    name: 'settings',
    component: () => import('../views/Pages/SettingsView.vue'),
    meta: {
      title: 'Settings',
      requiresAuth: true
    }
  },
  {
    path: '/charts/basic-chart',
    name: 'basicChart',
    component: () => import('../views/Charts/BasicChartView.vue'),
    meta: {
      title: 'Basic Chart',
      requiresAuth: true
    }
  },
  {
    path: '/ui-elements/alerts',
    name: 'alerts',
    component: () => import('../views/UiElements/AlertsView.vue'),
    meta: {
      title: 'Alerts',
      requiresAuth: true
    }
  },
  {
    path: '/ui-elements/buttons',
    name: 'buttons',
    component: () => import('../views/UiElements/ButtonsView.vue'),
    meta: {
      title: 'Buttons',
      requiresAuth: true
    }
  },
  {
    path: '/settings/account',
    name: 'account-settings',
    component: () => import('../views/Pages/SettingsView.vue'),
    meta: {
      title: 'Account Settings',
      requiresAuth: true
    }
  }
]

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes,
  scrollBehavior(to, from, savedPosition) {
    return savedPosition || { left: 0, top: 0 }
  }
})

// Authentication Guard
router.beforeEach(async (to, from, next) => {
  document.title = `MIS - Inventory System ${to.meta.title} | `

  const { useAuthStore } = await import('../stores/auth')
  const authStore = useAuthStore()
  const isAuthenticated = authStore.isAuthenticated

  // Prevent authenticated users from accessing signin/signup
  if (isAuthenticated && (to.name === 'signin' || to.name === 'signup')) {
    next({ name: 'eCommerce' })
  }
  // Check for authentication and role requirements
  else if (to.meta.requiresAuth) {
    if (!isAuthenticated) {
      next({ name: 'signin' })
    }
    // Temporarily allow all authenticated users while debugging
    else {
      // console.log('Route access check:', {
      //   route: to.path,
      //   userRole: authStore.userRole,
      //   userPermissions: authStore.userPermissions,
      //   requiredRoles: to.meta.roles,
      //   requiredPermissions: to.meta.permissions
      // })
      next() // Allow navigation for now
    }
  } else {
    next() // Allow navigation for public routes
  }
})

export default router
