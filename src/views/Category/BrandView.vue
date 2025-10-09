<script setup>
import { ref } from 'vue'
import BreadcrumbDefault from '../../components/Breadcrumbs/BreadcrumbDefault.vue'
import CategoryManagement from '../../components/Category/MainCatagory.vue'
import DefaultLayout from '../../layouts/DefaultLayout.vue'

const pageTitle = ref('Main Category Management')
</script>

<template>
  <DefaultLayout>
    <div class="mx-auto max-w-8xl">
      <!-- Breadcrumb Start -->
      <BreadcrumbDefault :pageTitle="pageTitle" />
      <!-- Breadcrumb End -->
      <CategoryManagement />
    </div>
  </DefaultLayout>
</template>
