<script setup >
import BreadcrumbDefault from '../../components/Breadcrumbs/BreadcrumbDefault.vue'
import AlertWarning from '../../components/Alerts/AlertWarning.vue'
import AlertSuccess from '../../components/Alerts/AlertSuccess.vue'
import AlertError from '../../components/Alerts/AlertError.vue'
import DefaultLayout from '../../layouts/DefaultLayout.vue'

import { ref } from 'vue'

const pageTitle = ref('Alerts')
</script>

<template>
  <DefaultLayout>
    <!-- Breadcrumb Start -->
    <BreadcrumbDefault :pageTitle="pageTitle" />
    <!-- Breadcrumb End -->

    <div
      class="rounded-sm border border-stroke bg-white p-4 shadow-default dark:border-strokedark dark:bg-boxdark md:p-6 xl:p-9"
    >
      <div class="flex flex-col gap-7.5">
        <!-- ====== AlertWarning Start -->
        <AlertWarning />
        <!-- ====== AlertWarning End -->

        <!-- ====== AlertSuccess Start -->
        <AlertSuccess />
        <!-- ====== AlertSuccess End -->

        <!-- ====== AlertError Start -->
        <AlertError />
        <!-- ====== AlertError End -->
      </div>
    </div>
  </DefaultLayout>
</template>
