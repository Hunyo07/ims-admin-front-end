<script setup lang="ts">
import { ref } from 'vue'
import BreadcrumbDefault from '@/components/Breadcrumbs/BreadcrumbDefault.vue'
import ReorderPoint from '@/components/Reorder/ReordeRPoint.vue'
import DefaultLayout from '@/layouts/DefaultLayout.vue'

const pageTitle = ref('Reorder Management')
</script>

<template>
  <DefaultLayout>
    <div class="mx-auto max-w-8xl">
      <!-- Breadcrumb Start -->
      <BreadcrumbDefault :pageTitle="pageTitle" />
      <!-- Breadcrumb End -->
      <ReorderPoint />
    </div>
  </DefaultLayout>
</template>
