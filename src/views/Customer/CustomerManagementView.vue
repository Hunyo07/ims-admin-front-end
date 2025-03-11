<script setup lang="ts">
import { ref } from 'vue'
import BreadcrumbDefault from '@/components/Breadcrumbs/BreadcrumbDefault.vue'
import CustomerManagement from '@/components/Customer/CustomerManagement.vue'
import DefaultLayout from '@/layouts/DefaultLayout.vue'

const pageTitle = ref('Customer Management')
</script>

<template>
  <DefaultLayout>
    <div class="mx-auto max-w-8xl">
      <!-- Breadcrumb Start -->
      <BreadcrumbDefault :pageTitle="pageTitle" />
      <!-- Breadcrumb End -->
      <CustomerManagement />
    </div>
  </DefaultLayout>
</template>
