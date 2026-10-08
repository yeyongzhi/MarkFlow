<script setup lang="ts">
import { Field, FieldContent, FieldLabel, FieldDescription } from '@/components/ui/field'
defineProps<{ label: string; description?: string; id?: string }>()
</script>
<template>
  <Field orientation="horizontal" class="flex-col items-stretch gap-4 border-b border-border/60 py-5 last:border-0 sm:flex-row sm:items-center">
    <FieldContent class="min-w-0 gap-1.5"><FieldLabel :for="id">{{ label }}</FieldLabel><FieldDescription v-if="description" class="text-xs leading-relaxed">{{ description }}</FieldDescription></FieldContent>
    <div class="w-full shrink-0 sm:w-[min(44%,260px)]"><slot /></div>
  </Field>
</template>
