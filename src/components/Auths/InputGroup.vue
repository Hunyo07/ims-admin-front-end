<script setup lang="ts">
defineProps({
  label: String,
  type: String,
  placeholder: String,
  modelValue: String,
  required: Boolean
})

defineEmits(['update:modelValue'])
</script>

<template>
  <div class="form-group">
    <label :for="label" class="form-label">{{ label }}</label>
    <div class="relative">
      <span class="input-icon">
        <slot></slot>
      </span>
      <input
        :id="label"
        :type="type"
        :placeholder="placeholder"
        :value="modelValue"
        @input="$emit('update:modelValue', ($event.target as HTMLInputElement).value)"
        :required="required"
        class="form-input"
      />
    </div>
  </div>
</template>

<style scoped>
.form-group {
  @apply mb-4;
}

.input-icon {
  @apply absolute left-4 top-1/2 -translate-y-1/2 text-bodydark2;
}

.form-input {
  @apply w-full rounded-lg border border-stroke bg-transparent py-4 pl-12 pr-4 outline-none focus:border-primary focus-visible:shadow-none dark:border-strokedark dark:bg-meta-4 dark:focus:border-primary;
}

.form-label {
  @apply mb-2.5 block font-medium text-black dark:text-white;
}
</style>
