<script setup lang="ts">
import { Field, FieldContent, FieldLabel, FieldDescription } from '@/components/ui/field'
defineProps<{ label: string; description?: string; id?: string }>()
</script>
<template>
  <Field orientation="horizontal" class="flex-col items-stretch gap-4 border-b border-border/60 py-4 first:pt-3 last:border-0 last:pb-0 sm:flex-row sm:items-center">
    <FieldContent class="min-w-0 gap-1.5"><FieldLabel :for="id">{{ label }}</FieldLabel><FieldDescription v-if="description" class="text-xs leading-relaxed">{{ description }}</FieldDescription></FieldContent>
    <div class="flex w-full shrink-0 justify-end sm:w-[min(44%,260px)] [&>div:not([data-slot=toggle-group])]:w-full"><slot /></div>
  </Field>
</template>
