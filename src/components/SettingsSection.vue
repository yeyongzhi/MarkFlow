<script setup lang="ts">
defineProps<{ title: string; status?: string; statusTone?: 'primary' | 'muted' }>()
</script>

<template>
  <section class="settings-section mb-4 scroll-mt-4 rounded-xl border border-border/70 bg-card px-5 py-5 shadow-sm last:mb-0">
    <div class="mb-1 flex items-center gap-3 border-b border-border/60 pb-3">
      <h3 class="text-sm font-semibold text-foreground">{{ title }}</h3>
      <span v-if="status" role="status" aria-live="polite" class="inline-flex shrink-0 items-center gap-2 rounded-full border px-3 py-1 text-xs font-medium">
        <span class="size-2 rounded-full" :class="statusTone === 'primary' ? 'bg-primary' : 'bg-muted-foreground/50'"></span>
        {{ status }}
      </span>
    </div>
    <slot />
  </section>
</template>
