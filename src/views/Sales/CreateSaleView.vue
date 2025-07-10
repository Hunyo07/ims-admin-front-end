<script setup >
import { ref, provide } from 'vue'
import BreadcrumbDefault from '../../components/Breadcrumbs/BreadcrumbDefault.vue'
import CreateSale from '../../components/Sales/CreateSale.vue'
import DefaultLayout from '../../layouts/DefaultLayout.vue'

const pageTitle = ref('POS')
// Provide a local placeholder image path
provide('placeholderImage', '/images/placeholder.png')
</script>

<template>
  <DefaultLayout>
    <div class="mx-auto max-w-8xl">
      <!-- Breadcrumb Start -->
      <BreadcrumbDefault :pageTitle="pageTitle" />
      <!-- BreadcruAmb End -->
      <CreateSale />
    </div>
  </DefaultLayout>
</template>
