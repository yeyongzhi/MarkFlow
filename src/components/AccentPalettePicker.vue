<script setup lang="ts">
import { computed, ref } from 'vue'
import { CheckIcon, PaletteIcon } from '@lucide/vue'
import { PopoverRoot, PopoverTrigger, PopoverPortal, PopoverContent } from 'reka-ui'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import type { AccentColor } from '@/constants/accentPalettes'

const props = defineProps<{
  name: string
  description: string
  colors: readonly AccentColor[]
  modelValue: string
}>()
const emit = defineEmits<{ 'update:modelValue': [value: string] }>()
const open = ref(false)
const selected = computed(() => props.colors.find(color => color.value.toLowerCase() === props.modelValue.toLowerCase()))
</script>

<template>
  <PopoverRoot v-model:open="open">
    <PopoverTrigger as-child>
      <Button
        variant="ghost"
        size="sm"
        :aria-label="`${name}${selected ? `，当前${selected.name}` : ''}`"
        :class="cn('h-auto shrink-0 gap-2 rounded-lg px-2 py-2 text-xs text-muted-foreground hover:bg-accent hover:text-accent-foreground', (selected || open) && 'bg-accent text-accent-foreground ring-1 ring-primary/30')"
      >
        <span class="flex size-5 items-center justify-center rounded-full ring-1 ring-border" :style="{ backgroundColor: selected?.value ?? 'var(--muted)', color: '#fff' }">
          <CheckIcon v-if="selected" class="size-3.5" />
          <PaletteIcon v-else class="size-3.5" />
        </span>
        <span class="whitespace-nowrap">{{ name }}<template v-if="selected"> - {{ selected.name }}</template></span>
      </Button>
    </PopoverTrigger>
    <PopoverPortal>
      <PopoverContent align="start" :side-offset="6" class="w-[min(22rem,calc(100vw-2rem))] rounded-xl border border-border bg-popover p-3 text-popover-foreground shadow-md" @open-auto-focus.prevent>
        <div class="mb-3">
          <p class="text-sm font-medium">{{ name }}</p>
          <p class="mt-0.5 text-xs text-muted-foreground">{{ description }}</p>
        </div>
        <div role="group" :aria-label="name" class="grid grid-cols-2 gap-1">
          <Button
            v-for="color in colors"
            :key="color.value"
            variant="ghost"
            size="sm"
            :aria-label="`${color.name} ${color.value}`"
            :aria-pressed="modelValue.toLowerCase() === color.value.toLowerCase()"
            :class="cn('h-auto min-w-0 justify-start gap-2 rounded-md px-2 py-2 text-left text-xs', modelValue.toLowerCase() === color.value.toLowerCase() && 'bg-accent text-accent-foreground')"
            @click="emit('update:modelValue', color.value); open = false"
          >
            <span class="size-5 shrink-0 rounded-full border border-border/70" :style="{ backgroundColor: color.value }" />
            <span class="min-w-0 flex-1 truncate">{{ color.name }}</span>
            <span class="shrink-0 font-mono text-[10px] text-muted-foreground">{{ color.value.toUpperCase() }}</span>
          </Button>
        </div>
      </PopoverContent>
    </PopoverPortal>
  </PopoverRoot>
</template>
