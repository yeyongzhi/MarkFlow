<script setup lang="ts">
defineProps<{ title: string }>()
</script>

<template>
  <section class="settings-section mb-4 scroll-mt-4 rounded-xl border border-border/70 bg-card px-5 py-5 shadow-sm last:mb-0">
    <h3 class="mb-1 border-b border-border/60 pb-3 text-sm font-semibold text-foreground">{{ title }}</h3>
    <slot />
  </section>
</template>
