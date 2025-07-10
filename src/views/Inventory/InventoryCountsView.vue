<script setup >
import { ref } from 'vue'
import BreadcrumbDefault from '../../components/Breadcrumbs/BreadcrumbDefault.vue'
import InventoryCounts from '../../components/Inventory/InventoryCounts.vue'
import DefaultLayout from '../../layouts/DefaultLayout.vue'

const pageTitle = ref('Inventory Counts')
</script>

<template>
  <DefaultLayout>
    <div class="mx-auto max-w-8xl">
      <!-- Breadcrumb Start -->
      <BreadcrumbDefault :pageTitle="pageTitle" />
      <!-- Breadcrumb End -->
      <InventoryCounts />
    </div>
  </DefaultLayout>
</template>
