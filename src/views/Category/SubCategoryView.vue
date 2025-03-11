<script setup lang="ts">
import { ref } from 'vue'
import BreadcrumbDefault from '@/components/Breadcrumbs/BreadcrumbDefault.vue'
import SubCategoryManagement from '@/components/Category/SubCategory.vue'
import DefaultLayout from '@/layouts/DefaultLayout.vue'

const pageTitle = ref('Sub Category Management')
</script>

<template>
  <DefaultLayout>
    <div class="mx-auto max-w-8xl">
      <!-- Breadcrumb Start -->
      <BreadcrumbDefault :pageTitle="pageTitle" />
      <!-- Breadcrumb End -->
      <SubCategoryManagement />
    </div>
  </DefaultLayout>
</template>
