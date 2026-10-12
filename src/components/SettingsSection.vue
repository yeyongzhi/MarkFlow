<script setup lang="ts">
defineProps<{ title: string }>()
</script>

<template>
  <section class="settings-section scroll-mt-4 py-4">
    <h3 class="mb-2 text-sm font-semibold text-foreground">{{ title }}</h3>
    <slot />
  </section>
</template>
