<script setup>
import { ref } from 'vue'
import BreadcrumbDefault from '../../components/Breadcrumbs/BreadcrumbDefault.vue'
import BarcodeManagement from '../../components/Barcodes/BarcodesManagement.vue'
import DefaultLayout from '../../layouts/DefaultLayout.vue'

const pageTitle = ref('Barcode Management')
</script>

<template>
  <DefaultLayout>
    <div class="mx-auto max-w-8xl">
      <!-- Breadcrumb Start -->
      <BreadcrumbDefault :pageTitle="pageTitle" />
      <!-- Breadcrumb End -->
      <BarcodeManagement />
    </div>
  </DefaultLayout>
</template>
