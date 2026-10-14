<script setup lang="ts">
import { computed } from 'vue'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Item, ItemActions, ItemContent, ItemDescription, ItemTitle } from '@/components/ui/item'
import { useWorkbench } from '@/stores/workbench'
import { message } from '@/services/api'
import { toast } from 'vue-sonner'

const open = defineModel<boolean>('open', { required: true })
const store = useWorkbench()
const drafts = computed(() => store.drafts)
const filename = (path: string) => path.split(/[/\\]/).at(-1) || path
async function handle(action: () => Promise<unknown>) {
  try { await action() } catch (error) { toast.error(message(error)) }
}
</script>

<template>
  <Dialog v-model:open="open">
    <DialogContent class="sm:max-w-xl">
      <DialogHeader>
        <DialogTitle>找回未保存的草稿</DialogTitle>
        <DialogDescription>恢复前会检查原文件。存在外部修改时，会保留两个版本并提示冲突。</DialogDescription>
      </DialogHeader>
      <div class="max-h-[min(60vh,28rem)] space-y-2 overflow-y-auto">
        <Item v-for="draft in drafts" :key="draft.id" variant="outline" class="gap-3">
          <ItemContent class="min-w-0">
            <ItemTitle :title="draft.path">{{ filename(draft.path) }}</ItemTitle>
            <ItemDescription class="truncate">{{ store.workspaces.find(w => w.id === draft.workspaceId)?.name || '工作区不可用' }}<template v-if="draft.path"> / {{ draft.path }}</template> · {{ new Date(draft.updatedAt * 1000).toLocaleString('zh-CN') }}</ItemDescription>
          </ItemContent>
          <ItemActions class="shrink-0">
            <Button variant="outline" size="sm" @click="handle(() => store.discardDraft(draft))">丢弃</Button>
            <Button size="sm" @click="handle(() => store.restore(draft))">恢复</Button>
          </ItemActions>
        </Item>
        <p v-if="!drafts.length" class="py-4 text-sm text-muted-foreground">没有待恢复的草稿。</p>
      </div>
    </DialogContent>
  </Dialog>
</template>
