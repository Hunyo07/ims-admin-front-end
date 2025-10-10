<script setup>
import { ref } from 'vue'
import BreadcrumbDefault from '../../components/Breadcrumbs/BreadcrumbDefault.vue'
import DepartmentManagement from '../../components/Department/DepartmentManagement.vue'
import DefaultLayout from '../../layouts/DefaultLayout.vue'

const pageTitle = ref('Department Management')
</script>

<template>
  <DefaultLayout>
    <div class="mx-auto max-w-8xl">
      <BreadcrumbDefault :pageTitle="pageTitle" />
      <DepartmentManagement />
    </div>
  </DefaultLayout>
</template>