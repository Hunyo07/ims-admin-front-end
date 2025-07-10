<script setup>
import { ref } from 'vue'
import BreadcrumbDefault from '../components/Breadcrumbs/BreadcrumbDefault.vue'
import DefaultLayout from '../layouts/DefaultLayout.vue'

const pageTitle = ref('Profile')
</script>

<template>
  <DefaultLayout>
    <div class="mx-auto max-w-242.5">
      <!-- Breadcrumb Start -->
      <BreadcrumbDefault :pageTitle="pageTitle" />
      <!-- Breadcrumb End -->
      <!-- Remove <ProfileCard /> -->
    </div>
  </DefaultLayout>
</template>
