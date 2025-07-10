import { createRouter, createWebHistory } from 'vue-router'
import SigninView from '@/views/Authentication/SigninView.vue'
import SignupView from '@/views/Authentication/SignupView.vue'
import CalendarView from '@/views/CalendarView.vue'
import BasicChartView from '@/views/Charts/BasicChartView.vue'
import ECommerceView from '@/views/Dashboard/ECommerceView.vue'
import FormElementsView from '@/views/Forms/FormElementsView.vue'
import FormLayoutView from '@/views/Forms/FormLayoutView.vue'
import SettingsView from '@/views/Pages/SettingsView.vue'
import ProfileView from '@/views/ProfileView.vue'
import TablesView from '@/views/TablesView.vue'
import AlertsView from '@/views/UiElements/AlertsView.vue'
import ButtonsView from '@/views/UiElements/ButtonsView.vue'
import UserManagementView from '@/views/User/UserManagementView.vue'
import CustomerManagementView from '@/views/Customer/CustomerManagementView.vue'
import SupplierManagementView from '@/views/Supplier/SupplierManagementView.vue'
import MainCategoryView from '@/views/Category/MainCategoryView.vue'
import SubCategoryView from '@/views/Category/SubCategoryView.vue'
import ProductManagementView from '@/views/Product/ProductManagementView.vue'
import SalesManagementView from '@/views/Sales/SalesManagementView.vue'
import CreatSaleView from '@/views/Sales/CreateSaleView.vue'
import BarcodesView from '@/views/Barcodes/BarcodeManagementView.vue'
import ReorderView from '@/views/Reorder/PurchaseMangementView.vue'
import ReorderPointView from '@/views/Settings/ReorderPointView.vue'
import InventoryCounts from '@/views/Inventory/InventoryCountsView.vue'
import StockAdjustments from '@/views/Inventory/StockAdjustmentsView.vue'
import ForgotPasswordView from '@/views/Authentication/ForgotPasswordView.vue';
import ResetPasswordView from '@/views/Authentication/ResetPasswordView.vue';
import ActivityLogView from '@/views/ActivityLog/ActivityLogView.vue';

// Add this to your imports
import { useAuthStore } from '@/stores/auth'

const routes = [
  {
    path: '/',
    name: 'signin',
    component: SigninView,
    meta: {
      title: 'Signin',
      requiresAuth: false
    }
  },
  {
    path: '/auth/signup',
    name: 'signup',
    component: SignupView,
    meta: {
      title: 'Signup',
      requiresAuth: false
    }
  },
  {
    path: '/forgot-password',
    name: 'forgot-password',
    component: ForgotPasswordView,
    meta: {
      title: 'Forgot Password',
      requiresAuth: false
    }
  },
  {
    path: '/reset-password/:token',
    name: 'reset-password',
    component: ResetPasswordView,
    meta: {
      title: 'Reset Password',
      requiresAuth: false
    }
  },
  {
    path: '/eCommerce',
    name: 'eCommerce',
    component: ECommerceView,
    meta: {
      title: 'eCommerce Dashboard',
      requiresAuth: true
    }
  },
  {
    path: '/inventory-counts',
    name: 'Inventory Counts',
    component: InventoryCounts,
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
    component: StockAdjustments,
    meta: {
      requiresAuth: true
    }
  },
  {
    path: '/stock-adjustments',
    name: 'Stock Adjustments',
    component: StockAdjustments,
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
    component: UserManagementView,
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
    component: ActivityLogView,
    meta: {
      title: 'Activity Logs',
      requiresAuth: true,
      roles: ['superadmin'],
      permissions: ['view_activity_logs']
    }
  },
  {
    path: '/customer',
    name: 'customer',
    component: CustomerManagementView,
    meta: {
      title: 'Customer Management',
      requiresAuth: true,
      roles: ['superadmin', 'admin', 'staff'],
      permissions: ['view_customers', 'manage_customers']
    }
  },
  {
    path: '/pos',
    name: 'POS',
    component: CreatSaleView,
    meta: {
      title: 'POS Management',
      requiresAuth: true,
      roles: ['superadmin', 'admin', 'staff'],
      permissions: ['use_pos']
    }
  },
  {
    path: '/sales',
    name: 'sales',
    component: SalesManagementView,
    meta: {
      title: 'Sales Management',
      requiresAuth: true,
      roles: ['superadmin', 'admin', 'staff'],
      permissions: ['view_sales', 'process_sales']
    }
  },
  {
    path: '/supplier',
    name: 'supllier',
    component: SupplierManagementView,
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
    component: MainCategoryView,
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
    component: SubCategoryView,
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
    component: ReorderPointView,
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
    component: ProductManagementView,
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
    component: ReorderView,
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
    component: BarcodesView,
    meta: {
      title: 'Product Management',
      requiresAuth: true,
      roles: ['superadmin', 'admin'],
      permissions: ['view_barcodes', 'manage_barcodes']
    }
  },
  {
    path: '/calendar',
    name: 'calendar',
    component: CalendarView,
    meta: {
      title: 'Calendar',
      requiresAuth: true
    }
  },
  {
    path: '/profile',
    name: 'profile',
    component: ProfileView,
    meta: {
      title: 'Profile',
      requiresAuth: true
    }
  },
  {
    path: '/forms/form-elements',
    name: 'formElements',
    component: FormElementsView,
    meta: {
      title: 'Form Elements',
      requiresAuth: true
    }
  },
  {
    path: '/forms/form-layout',
    name: 'formLayout',
    component: FormLayoutView,
    meta: {
      title: 'Form Layout',
      requiresAuth: true
    }
  },
  {
    path: '/tables',
    name: 'tables',
    component: TablesView,
    meta: {
      title: 'Tables',
      requiresAuth: true
    }
  },
  {
    path: '/pages/settings',
    name: 'settings',
    component: SettingsView,
    meta: {
      title: 'Settings',
      requiresAuth: true
    }
  },
  {
    path: '/charts/basic-chart',
    name: 'basicChart',
    component: BasicChartView,
    meta: {
      title: 'Basic Chart',
      requiresAuth: true
    }
  },
  {
    path: '/ui-elements/alerts',
    name: 'alerts',
    component: AlertsView,
    meta: {
      title: 'Alerts',
      requiresAuth: true
    }
  },
  {
    path: '/ui-elements/buttons',
    name: 'buttons',
    component: ButtonsView,
    meta: {
      title: 'Buttons',
      requiresAuth: true
    }
  },
  {
    path: '/settings/account',
    name: 'account-settings',
    component: SettingsView,
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
router.beforeEach((to, from, next) => {
  document.title = `Books & Clothes House ${to.meta.title} | Cloud-Based IMS - Books & Clothes House`

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
