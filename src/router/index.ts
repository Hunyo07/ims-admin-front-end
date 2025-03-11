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
import BranchManagementView from '@/views/Branch/BranchManagementView.vue'
import CustomerManagementView from '@/views/Customer/CustomerManagementView.vue'
import SupplierManagementView from '@/views/Supplier/SupplierManagementView.vue'
import MainCategoryView from '@/views/Category/MainCategoryView.vue'
import SubCategoryView from '@/views/Category/SubCategoryView.vue'
import ProductManagementView from '@/views/Product/ProductManagementView.vue'
import SalesManagementView from '@/views/Sales/SalesManagementView.vue'
import CreatSaleView from '@/views/Sales/CreateSaleView.vue'

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
    path: '/eCommerce',
    name: 'eCommerce',
    component: ECommerceView,
    meta: {
      title: 'eCommerce Dashboard',
      requiresAuth: true
    }
  },
  {
    path: '/users',
    name: 'users',
    component: UserManagementView,
    meta: {
      title: 'User Management',
      requiresAuth: true
    }
  },
  {
    path: '/branch',
    name: 'branch',
    component: BranchManagementView,
    meta: {
      title: 'Branch Management',
      requiresAuth: true
    }
  },
  {
    path: '/customer',
    name: 'customer',
    component: CustomerManagementView,
    meta: {
      title: 'Customer Management',
      requiresAuth: true
    }
  },
  {
    path: '/pos',
    name: 'POS',
    component: CreatSaleView,
    meta: {
      title: 'POS Management',
      requiresAuth: true
    }
  },
  {
    path: '/sales',
    name: 'sales',
    component: SalesManagementView,
    meta: {
      title: 'Sales Management',
      requiresAuth: true
    }
  },
  {
    path: '/supplier',
    name: 'supllier',
    component: SupplierManagementView,
    meta: {
      title: 'Supplier Management',
      requiresAuth: true
    }
  },
  {
    path: '/main-category',
    name: 'main-category',
    component: MainCategoryView,
    meta: {
      title: 'Category Management',
      requiresAuth: true
    }
  },
  {
    path: '/sub-category',
    name: 'sub-category',
    component: SubCategoryView,
    meta: {
      title: 'Sub Category Management',
      requiresAuth: true
    }
  },
  {
    path: '/product',
    name: 'product',
    component: ProductManagementView,
    meta: {
      title: 'Product Management',
      requiresAuth: true
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

  const isAuthenticated = localStorage.getItem('token') // Adjust this based on your auth system

  // Prevent authenticated users from accessing signin/signup
  if (isAuthenticated && (to.name === 'signin' || to.name === 'signup')) {
    next({ name: 'eCommerce' }) // Redirect to dashboard or another page
  }
  // Prevent unauthenticated users from accessing protected routes
  else if (to.meta.requiresAuth && !isAuthenticated) {
    next({ name: 'signin' }) // Redirect to login if not authenticated
  } else {
    next() // Allow navigation
  }
})

export default router
