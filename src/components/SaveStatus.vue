<script setup lang="ts">
import { computed, onBeforeUnmount, shallowRef } from 'vue'
import { CheckIcon, RefreshCwIcon, AlertCircleIcon, CircleIcon } from '@lucide/vue'
import { PopoverRoot, PopoverTrigger, PopoverPortal, PopoverContent } from 'reka-ui'
import { Switch } from '@/components/ui/switch'
import { useWorkbench } from '@/stores/workbench'
import type { Document } from '@/types'

const props = defineProps<{ document: Document }>()
const emit = defineEmits<{ save: [document: Document] }>()
const store = useWorkbench()
const labels = { clean: '已保存', dirty: '待保存', saving: '保存中…', error: '保存失败', conflict: '外部修改冲突', missing: '文件已不存在' }
const label = computed(() => props.document.temporary ? '临时文档 · 未保存' : props.document.status === 'clean' && store.preferences.autoSave ? '已自动保存' : labels[props.document.status])
const open = shallowRef(false)
let closeTimer: ReturnType<typeof setTimeout> | undefined
function show() { clearTimeout(closeTimer); open.value = true }
function hide() { clearTimeout(closeTimer); closeTimer = setTimeout(() => { open.value = false }, 150) }
onBeforeUnmount(() => clearTimeout(closeTimer))
</script>

<template>
  <PopoverRoot :open="open" @update:open="open = $event">
    <PopoverTrigger as-child>
      <button :class="['save-status flex min-h-7 items-center gap-1.5 rounded-md px-2 py-1 transition-colors hover:bg-muted [&_svg]:size-3.5', ['error','conflict','missing'].includes(document.status) && 'text-destructive']" @mouseenter="show" @mouseleave="hide" @focus="show" @click="emit('save', document)">
        <CheckIcon v-if="document.status === 'clean'" />
        <RefreshCwIcon v-else-if="document.status === 'saving'" class="animate-spin" />
        <AlertCircleIcon v-else-if="['error','conflict','missing'].includes(document.status)" />
        <CircleIcon v-else />{{ label }}
      </button>
    </PopoverTrigger>
    <PopoverPortal><PopoverContent side="top" :side-offset="6" class="z-50 flex items-center gap-3 rounded-lg border border-border bg-popover p-3 text-popover-foreground shadow-md" @mouseenter="show" @mouseleave="hide" @pointerdown.stop>
      <span class="text-sm">自动保存</span>
      <Switch v-model="store.preferences.autoSave" aria-label="自动保存" />
    </PopoverContent></PopoverPortal>
  </PopoverRoot>
</template>
