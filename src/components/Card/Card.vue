<script setup lang="ts">
defineOptions({ name: 'Card' })

const props = defineProps<{
  title?: string
  hideHeader?: boolean
  padded?: boolean
}>()
</script>

<template>
  <div
    class="rounded-sm border border-stroke bg-white shadow-default dark:border-strokedark dark:bg-boxdark"
  >
    <template v-if="!props.hideHeader">
      <slot name="header">
        <div v-if="props.title" class="border-b border-stroke py-4 px-6.5 dark:border-strokedark">
          <h3 class="font-medium text-black dark:text-white">{{ props.title }}</h3>
        </div>
      </slot>
    </template>

    <div v-if="props.padded" class="p-5">
      <slot></slot>
    </div>
    <slot v-else></slot>

    <slot name="footer"></slot>
  </div>
</template>
