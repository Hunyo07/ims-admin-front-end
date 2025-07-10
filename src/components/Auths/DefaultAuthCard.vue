<template>
  <div
    class="rounded-sm border border-stroke bg-white shadow-default dark:border-strokedark dark:bg-boxdark"
  >
    <div class="flex flex-wrap items-center">
      <div class="hidden w-full xl:block xl:w-1/2" v-if="showIllustration">
        <div class="py-17.5 px-26 text-center">
          <router-link class="mb-5.5 inline-block" to="/"> </router-link>

          <p class="font-medium 2xl:px-20">
            A comprehensive solution for managing your inventory efficiently and effectively.
          </p>

          <span class="inline-block">
            <!-- <img src="/src/assets/images/logo.png" alt="illustration" /> -->
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

<script setup>
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

</style>
