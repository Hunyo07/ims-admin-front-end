<script setup lang="ts">
defineOptions({ name: 'Breadcrumb' })

const props = defineProps<{
  pageTitle?: string
  breadcrumbs?: Array<{ title: string; to?: string }>
}>()
</script>

<template>
  <div class="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
    <h2 class="text-title-md2 font-semibold text-black dark:text-white">
      {{ props.pageTitle }}
    </h2>

    <div class="flex items-center gap-3">
      <nav>
        <ol class="flex items-center gap-2">
          <li v-if="!props.breadcrumbs || props.breadcrumbs.length === 0">
            <router-link class="font-medium" to="/"> Dashboard / </router-link>
          </li>
          <template v-else>
            <li v-for="(crumb, index) in props.breadcrumbs" :key="index">
              <template v-if="crumb.to">
                <router-link class="font-medium" :to="crumb.to">
                  {{ crumb.title }}
                  <span v-if="index < props.breadcrumbs.length - 1"> / </span>
                </router-link>
              </template>
              <template v-else>
                <span class="font-medium text-primary">{{ crumb.title }}</span>
              </template>
            </li>
          </template>
        </ol>
      </nav>

      <slot name="actions"></slot>
    </div>
  </div>
</template>