<script setup>
import { ref } from 'vue'
import BreadcrumbDefault from '../../components/Breadcrumbs/BreadcrumbDefault.vue'
import ACNManagement from '../../components/ACN/ACNManagement.vue'
import DefaultLayout from '../../layouts/DefaultLayout.vue'

const pageTitle = ref('ACN Management')
</script>

<template>
  <DefaultLayout>
    <div class="mx-auto max-w-8xl">
      <!-- Breadcrumb Start -->
      <BreadcrumbDefault :pageTitle="pageTitle" />
      <!-- Breadcrumb End -->
      <ACNManagement />
    </div>
  </DefaultLayout>
</template>
