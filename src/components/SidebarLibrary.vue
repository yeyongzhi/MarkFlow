<script setup lang="ts">
import { computed, ref } from 'vue'
import { FileTextIcon, LocateFixedIcon } from '@lucide/vue'
import { Button } from '@/components/ui/button'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { useWorkbench } from '@/stores/workbench'
import { code, message } from '@/services/api'
import { cn } from '@/lib/utils'
import type { FileRef } from '@/types'

const emit = defineEmits<{ reveal: [] }>()
const store = useWorkbench(), category = ref('recent'), error = ref(''), opening = ref('')
const rows = computed(() => category.value === 'recent' ? [...store.preferences.recentFiles].sort((a,b)=>store.preferences.recentSort==='edited'?(b.editedAt||b.openedAt)-(a.editedAt||a.openedAt):b.openedAt-a.openedAt).slice(0,store.preferences.recentLimit) : store.preferences.favorites)
const key = (file: FileRef) => `${file.workspaceId}|${file.path}`
function context(file: FileRef) { return `${store.workspaces.find(w => w.id === file.workspaceId)?.name || '本地文档'}/${file.path}` }
async function open(file: FileRef) {
  opening.value = key(file); error.value = ''
  try { if (file.absolutePath) await store.openLocal([file.absolutePath]); else await store.open(file.workspaceId, file.path) }
  catch (e) {
    if (['MISSING', 'SCOPE'].includes(code(e))) {
      for (const list of ['recentFiles', 'favorites'] as const) store.preferences[list] = store.preferences[list].filter(item => key(item) !== key(file))
      error.value = '已清除失效文档记录'
    } else error.value = message(e)
  }
  finally { opening.value = '' }
}

</script>

<template>
  <section class="flex min-h-0 shrink-0 flex-col border-b border-border/60 px-2 pb-3" aria-label="文档快捷列表">
    <Tabs v-model="category" class="min-h-0 gap-0" @update:model-value="error=''">
    <div class="mb-2 flex min-w-0 items-center gap-1 px-1">
      <div class="min-w-0 flex-1">
        <TabsList class="h-8 w-full" aria-label="侧栏文档列表">
          <TabsTrigger value="recent">最近</TabsTrigger>
          <TabsTrigger value="favorites">收藏</TabsTrigger>
        </TabsList>
      </div>
      <Tooltip><TooltipTrigger as-child><Button variant="ghost" size="icon-xs" class="shrink-0" aria-label="在文件树中定位当前文档" :disabled="!store.active || store.active.workspaceId.startsWith('file-')" @click="emit('reveal')"><LocateFixedIcon /></Button></TooltipTrigger><TooltipContent side="right">在文件树中找到当前文档</TooltipContent></Tooltip>
    </div>
    <p v-if="error" role="alert" class="px-2 pb-2 text-xs text-destructive">{{ error }}</p>
    <TabsContent :value="category" class="max-h-[min(30vh,16rem)] min-h-0 overflow-y-auto overscroll-contain" :aria-label="category==='recent'?'最近文档列表':'收藏文档列表'">
      <div v-for="file in rows" :key="key(file)" class="group flex min-w-0 items-center gap-1 rounded-lg hover:bg-muted">
        <Button :variant="store.active?.workspaceId===file.workspaceId && store.active.path===file.path?'secondary':'ghost'" :class="cn('h-auto min-w-0 flex-1 justify-start gap-2 px-2 py-2 text-left')" :aria-label="`打开${category==='recent'?'最近':'收藏'}文档 ${file.path}`" :title="file.absolutePath || context(file)" :disabled="opening===key(file)" @click="open(file)">
          <FileTextIcon class="size-3.5 shrink-0" />
          <span class="min-w-0 flex-1"><span class="block truncate text-xs">{{ file.path.split('/').pop() }}</span><span class="block truncate text-[11px] text-muted-foreground">{{ context(file) }}</span></span>
        </Button>

      </div>
      <p v-if="!rows.length" class="px-2 py-4 text-center text-xs leading-5 text-muted-foreground">{{ category==='recent'?'打开文档后，会显示在这里。':'暂无收藏文档，可在文档菜单中收藏。' }}</p>
    </TabsContent>
    </Tabs>
  </section>
</template>
