<script setup >
import { ref } from 'vue'
import BreadcrumbDefault from '../../components/Breadcrumbs/BreadcrumbDefault.vue'
import SupplierManagement from '../../components/Supplier/SupplierManagement.vue'
import DefaultLayout from '../../layouts/DefaultLayout.vue'

const pageTitle = ref('Supplier Management')
</script>

<template>
  <DefaultLayout>
    <div class="mx-auto max-w-8xl">
      <!-- Breadcrumb Start -->
      <BreadcrumbDefault :pageTitle="pageTitle" />
      <!-- Breadcrumb End -->
      <SupplierManagement />
    </div>
  </DefaultLayout>
</template>
