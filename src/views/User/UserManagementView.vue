<script setup >
import { ref } from 'vue'
import BreadcrumbDefault from '../../components/Breadcrumbs/BreadcrumbDefault.vue'
import UserManagement from '../../components/User/UserManagement.vue'
import DefaultLayout from '../../layouts/DefaultLayout.vue'

const pageTitle = ref('User Management')
</script>

<template>
  <DefaultLayout>
    <div class="mx-auto max-w-8xl">
      <!-- Breadcrumb Start -->
      <BreadcrumbDefault :pageTitle="pageTitle" />
      <!-- BreadcruAmb End -->
      <UserManagement />
    </div>
  </DefaultLayout>
</template>
