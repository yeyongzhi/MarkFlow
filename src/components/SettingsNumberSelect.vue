<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { Select, SelectTrigger, SelectValue, SelectContent, SelectGroup, SelectItem } from '@/components/ui/select'
import { Input } from '@/components/ui/input'
import { Field, FieldLabel, FieldDescription } from '@/components/ui/field'
const props = defineProps<{ unit?: string; modelValue: number; min: number; max: number; label: string; presets: { value: number; label: string }[] }>()
const emit = defineEmits<{ 'update:modelValue': [value: number] }>()
const custom = ref(!props.presets.some(item => item.value === props.modelValue))
const draft = ref(String(props.modelValue))
let ownUpdate: number | undefined
watch(() => props.modelValue, value => {
  draft.value = String(value)
  if (value !== ownUpdate) custom.value = !props.presets.some(item => item.value === value)
  ownUpdate = undefined
})
const selection = computed(() => custom.value ? 'custom' : String(props.modelValue))
function select(value: unknown) {
  custom.value = value === 'custom'
  if (!custom.value) emit('update:modelValue', Number(value))
}
function applyCustom() {
  const number = Number(draft.value)
  const value = draft.value.trim() && Number.isFinite(number) ? Math.max(props.min, Math.min(props.max, Math.round(number))) : props.modelValue
  draft.value = String(value); ownUpdate = value; emit('update:modelValue', value)
}
</script>
<template>
  <div class="flex min-w-0 flex-col gap-3">
    <Select :model-value="selection" @update:model-value="select">
      <SelectTrigger class="w-full" :aria-label="label"><SelectValue /></SelectTrigger>
      <SelectContent><SelectGroup>
        <SelectItem v-for="preset in presets" :key="preset.value" :value="String(preset.value)">{{ preset.label }}（{{ preset.value }}{{ unit || 'px' }}）</SelectItem>
        <SelectItem value="custom">自定义（{{ modelValue }}{{ unit || 'px' }}）</SelectItem>
      </SelectGroup></SelectContent>
    </Select>
    <Field v-if="custom">
      <FieldLabel>{{ label }}自定义值</FieldLabel>
      <Input :model-value="draft" type="number" :min="min" :max="max" :aria-label="`${label}自定义值`" @update:model-value="v => draft = String(v)" @change="applyCustom" @keydown.enter.prevent="applyCustom" />
      <FieldDescription>范围 {{ min }}–{{ max }}{{ unit || 'px' }}，按 Enter 或离开输入框后应用。</FieldDescription>
    </Field>
  </div>
</template>
