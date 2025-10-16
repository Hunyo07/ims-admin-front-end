<script setup>
import { ref } from 'vue'
import BreadcrumbDefault from '../../components/Breadcrumbs/BreadcrumbDefault.vue'
import EmployeeManagement from '../../components/Employee/EmployeeManagement.vue'
import DefaultLayout from '../../layouts/DefaultLayout.vue'

const pageTitle = ref('Employee')
</script>

<template>
  <DefaultLayout>
    <div class="mx-auto max-w-8xl">
      <!-- Breadcrumb Start -->
      <BreadcrumbDefault :pageTitle="pageTitle" />
      <!-- Breadcrumb End -->
      <EmployeeManagement />
    </div>
  </DefaultLayout>
</template>
