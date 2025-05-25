<script setup lang="ts">
import { ref } from 'vue'
import BreadcrumbDefault from '@/components/Breadcrumbs/BreadcrumbDefault.vue'
import StockAdustments from '@/components/Inventory/StockAdjustments.vue'
import DefaultLayout from '@/layouts/DefaultLayout.vue'

const pageTitle = ref('Stock Adustments')
</script>

<template>
  <DefaultLayout>
    <div class="mx-auto max-w-8xl">
      <!-- Breadcrumb Start -->
      <BreadcrumbDefault :pageTitle="pageTitle" />
      <!-- Breadcrumb End -->
      <StockAdustments />
    </div>
  </DefaultLayout>
</template>
