<script setup lang="ts">
import { FileTextIcon, ArchiveRestoreIcon, Trash2Icon } from '@lucide/vue'
import { Button } from '@/components/ui/button'
defineProps<{ entries: { id: string; originalPath: string; archivedAt: number }[]; layout: string; busy: boolean }>()
const emit = defineEmits<{ restore: [id: string]; remove: [id: string] }>()
const filename = (path: string) => path.split(/[/\\]/).pop() || path
</script>

<template>
  <div :class="layout==='grid' ? 'grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3' : 'flex flex-col gap-2'" aria-label="回收站文档">
    <article v-for="entry in entries" :key="entry.id" class="flex min-w-0 gap-4 rounded-xl border border-border/70 bg-card p-4" :class="layout==='grid'?'flex-col':'items-center'">
      <div class="flex min-w-0 flex-1 items-center gap-3"><FileTextIcon class="size-5 shrink-0 text-primary"/><div class="min-w-0 flex-1"><h3 class="truncate text-sm font-medium" :title="entry.originalPath">{{filename(entry.originalPath)}}</h3><p class="mt-1 truncate text-xs text-muted-foreground">{{entry.originalPath}}</p><p class="mt-1 text-xs text-muted-foreground">删除于 {{new Date(entry.archivedAt < 1e12 ? entry.archivedAt * 1000 : entry.archivedAt).toLocaleString('zh-CN',{hour12:false})}}</p></div></div>
      <div class="flex shrink-0 items-center justify-end gap-2"><Button variant="outline" size="sm" :aria-label="`恢复 ${entry.originalPath}`" :disabled="busy" @click="emit('restore',entry.id)"><ArchiveRestoreIcon/>恢复</Button><Button variant="ghost" size="icon-sm" :aria-label="`彻底删除 ${entry.originalPath}`" :disabled="busy" @click="emit('remove',entry.id)"><Trash2Icon class="text-destructive"/></Button></div>
    </article>
  </div>
</template>
