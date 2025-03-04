<template>
  <div
    class="rounded-sm border border-stroke bg-white shadow-default dark:border-strokedark dark:bg-boxdark"
  >
    <div class="flex flex-wrap items-center">
      <div class="hidden w-full xl:block xl:w-1/2" v-if="showIllustration">
        <div class="py-17.5 px-26 text-center">
          <router-link class="mb-5.5 inline-block" to="/">
            <img class="hidden dark:block" src="@/assets/images/logo/logo.svg" alt="Logo" />
            <img class="dark:hidden" src="@/assets/images/logo/logo-dark.svg" alt="Logo" />
          </router-link>

          <p class="font-medium 2xl:px-20">
            A comprehensive solution for managing your inventory efficiently and effectively.
          </p>

          <span class="mt-15 inline-block">
            <img src="@/assets/images/illustration/illustration-03.svg" alt="illustration" />
          </span>
        </div>
      </div>

      <div class="w-full border-stroke dark:border-strokedark xl:w-1/2 xl:border-l-2">
        <div class="w-full p-4 sm:p-12.5 xl:p-17.5">
          <span class="mb-1.5 block font-medium text-gray-700 dark:text-gray-300">{{
            props.subtitle
          }}</span>
          <h2 class="mb-9 text-2xl font-bold text-black dark:text-white sm:text-title-xl2">
            {{ props.title }}
          </h2>

          <div class="relative">
            <slot></slot>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
const props = defineProps({
  subtitle: String,
  title: String,
  customClasses: String,
  showIllustration: {
    type: Boolean,
    default: true
  }
})
</script>

<style>
/* Move styles to InputGroup component where they belong */
/* Remove the scoped attribute to allow proper CSS inheritance */
.auth-form {
  @apply w-full max-w-md space-y-6;
}

.auth-card {
  @apply flex min-h-full flex-col justify-center py-12 sm:px-6 lg:px-8;
}

.auth-title {
  @apply -mx-4 mb-8 border-b border-stroke px-4 pb-4 dark:border-strokedark;
}
</style>
