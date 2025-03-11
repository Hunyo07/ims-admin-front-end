<script setup lang="ts">
import { ref } from 'vue'
import BreadcrumbDefault from '@/components/Breadcrumbs/BreadcrumbDefault.vue'
import SalesManagement from '@/components/Sales/SalesManagement.vue'
import DefaultLayout from '@/layouts/DefaultLayout.vue'

const pageTitle = ref('Sales Management')
</script>

<template>
  <DefaultLayout>
    <div class="mx-auto max-w-8xl">
      <!-- Breadcrumb Start -->
      <BreadcrumbDefault :pageTitle="pageTitle" />
      <!-- BreadcruAmb End -->
      <SalesManagement />
    </div>
  </DefaultLayout>
</template>
