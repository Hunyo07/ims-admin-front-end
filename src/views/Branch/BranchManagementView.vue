<script setup lang="ts">
import { ref } from 'vue'
import BreadcrumbDefault from '@/components/Breadcrumbs/BreadcrumbDefault.vue'
import ProfileCard from '@/components/ProfileCard.vue'
import BranchManagement from '@/components/Branch/BranchManagement.vue'
import DefaultLayout from '@/layouts/DefaultLayout.vue'

const pageTitle = ref('Branch Management')
</script>

<template>
  <DefaultLayout>
    <div class="mx-auto max-w-7xl">
      <!-- Breadcrumb Start -->
      <BreadcrumbDefault :pageTitle="pageTitle" />
      <!-- Breadcrumb End -->
      <BranchManagement />
    </div>
  </DefaultLayout>
</template>
