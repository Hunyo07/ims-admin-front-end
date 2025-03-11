<script setup lang="ts">
import { ref } from 'vue'
import BreadcrumbDefault from '@/components/Breadcrumbs/BreadcrumbDefault.vue'
import ProductManagement from '@/components/Product/ProductManagement.vue'
import DefaultLayout from '@/layouts/DefaultLayout.vue'

const pageTitle = ref('Product Management')
</script>

<template>
  <DefaultLayout>
    <div class="mx-auto max-w-8xl">
      <!-- Breadcrumb Start -->
      <BreadcrumbDefault :pageTitle="pageTitle" />
      <!-- Breadcrumb End -->
      <ProductManagement />
    </div>
  </DefaultLayout>
</template>
