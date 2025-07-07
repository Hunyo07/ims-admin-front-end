<script setup lang="ts">
import { ref } from 'vue'
import BreadcrumbDefault from '@/components/Breadcrumbs/BreadcrumbDefault.vue'
import StockAdjustments from '@/components/Inventory/StockAdjustments.vue'
import DefaultLayout from '@/layouts/DefaultLayout.vue'

const pageTitle = ref('Stock Adjustments')
</script>

<template>
  <DefaultLayout>
    <div class="mx-auto max-w-8xl">
      <!-- Breadcrumb Start -->
      <BreadcrumbDefault :pageTitle="pageTitle" />
      <!-- Breadcrumb End -->
      <StockAdjustments />
    </div>
  </DefaultLayout>
</template>
