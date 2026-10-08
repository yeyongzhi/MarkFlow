<script setup lang="ts">
import { ref, watch, onBeforeUnmount } from 'vue'
import { toast } from 'vue-sonner'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import { SearchIcon, FileSearchIcon } from '@lucide/vue'
import { fuzzy } from '@/services/writing'
import { call, message } from '@/services/api'
import { useWorkbench } from '@/stores/workbench'
const props = defineProps<{ open: boolean; content: boolean }>()
const emit = defineEmits<{ 'update:open': [open: boolean]; jump: [line: number] }>()
type Hit = { workspaceId: string; path: string; line: number; snippet: string }
const store = useWorkbench(), query = ref(''), options = ref<string[]>([]), hits = ref<Hit[]>([]), loading = ref(false), error = ref(''), notice = ref(''), selected = ref(0)
let timer: ReturnType<typeof setTimeout>, request = 0
async function search() {
  const seq = ++request; error.value = ''; hits.value = []; selected.value = 0; notice.value = ''
  if (!props.open || (props.content && !query.value.trim())) { loading.value = false; return }
  loading.value = true
  try {
    const args = { query: query.value, sensitive: options.value.includes('case') }
    const [files, contents] = await Promise.all([
      call<{ hits: Hit[]; truncated: boolean; skipped: number }>('search_workspace', { ...args, content: false }),
      props.content ? call<{ hits: Hit[]; truncated: boolean; skipped: number }>('search_workspace', { ...args, content: true }) : Promise.resolve({ hits: [] as Hit[], truncated: false, skipped: 0 })
    ])
    const result = { hits: [...files.hits.map(hit => ({ ...hit, line: 0 })), ...contents.hits], truncated: files.truncated || contents.truncated, skipped: Math.max(files.skipped, contents.skipped) }
    if (seq !== request) return
    // Open documents are authoritative so unsaved edits appear in workspace search.
    const open = store.documents.filter(d => store.workspaces.some(w => w.id === d.workspaceId))
    let values = result.hits.filter(h => !open.some(d => d.workspaceId === h.workspaceId && d.path === h.path))
    const q = options.value.includes('case') ? query.value : query.value.toLowerCase()
    for (const d of open) {
      if (fuzzy(q,d.path,options.value.includes('case'))) values.push({ workspaceId: d.workspaceId, path: d.path, line: 0, snippet: '' })
      if (props.content) d.text.split('\n').forEach((line, index) => { if ((options.value.includes('case') ? line : line.toLowerCase()).includes(q)) values.push({ workspaceId: d.workspaceId, path: d.path, line: index + 1, snippet: line.slice(0, 160) }) })
    }
    notice.value = [result.truncated || values.length > 300 ? '结果已截断，请缩小搜索范围。' : '', result.skipped ? `${result.skipped} 个不可访问路径或超过 2MiB 的文档已跳过。` : ''].filter(Boolean).join(' ')
    values.sort((a,b)=>Number(a.line>0)-Number(b.line>0)||(a.line===0&&b.line===0?Number(b.path.toLowerCase().includes(q))-Number(a.path.toLowerCase().includes(q))||a.path.length-b.path.length:0))
    hits.value = values.slice(0, 300)
  } catch (e) { if (seq === request) error.value = message(e) }
  finally { if (seq === request) loading.value = false }
}
watch(() => [props.open, props.content, query.value, options.value.join()], () => { request++; hits.value = []; selected.value = 0; loading.value = props.open && (!props.content || !!query.value.trim()); clearTimeout(timer); timer = setTimeout(search, 200) })
async function choose(hit?: Hit) { if (!hit) return; try { await store.open(hit.workspaceId, hit.path, hit.line > 0 ? 'source' : undefined); if(hit.line>0)store.setView('source');emit('update:open', false); if (hit.line > 0) emit('jump', hit.line) } catch (e) { toast.error(message(e)) } }
function key(e: KeyboardEvent) { if (e.key === 'Enter') { e.preventDefault(); void choose(hits.value[selected.value]) }; if (e.key === 'ArrowDown' || e.key === 'ArrowUp') { e.preventDefault(); selected.value = Math.max(0, Math.min(hits.value.length - 1, selected.value + (e.key === 'ArrowDown' ? 1 : -1))); document.getElementById(`search-result-${selected.value}`)?.scrollIntoView({ block: 'nearest' }) } }
onBeforeUnmount(() => { request++; clearTimeout(timer) })
</script>
<template>
  <Dialog :open="open" @update:open="emit('update:open', $event)"><DialogContent class="productivity-dialog sm:max-w-2xl" @keydown="key">
    <DialogHeader><DialogTitle>{{ content ? '工作区搜索' : '快速打开文档' }}</DialogTitle><DialogDescription>{{ content ? '搜索文件名、路径与 Markdown 正文，包含尚未保存的修改。' : '输入文件名或路径，使用方向键选择、Enter 打开。' }}</DialogDescription></DialogHeader>
    <div class="flex gap-2"><Input v-model="query" :aria-label="content ? '工作区搜索内容' : '搜索文件名'" :placeholder="content ? '输入文件名、路径或正文关键词' : '输入文件名或路径'" /><ToggleGroup v-if="content" v-model="options" type="multiple" variant="outline"><ToggleGroupItem value="case" title="区分大小写">Aa</ToggleGroupItem></ToggleGroup></div>
    <p v-if="loading" role="status">搜索中…</p><p v-if="error" class="text-destructive" role="alert">{{ error }}</p><p v-if="notice" class="text-muted-foreground text-sm">{{ notice }}</p>
    <div class="search-results" role="listbox" aria-label="搜索结果"><Button v-for="(hit, index) in hits" :id="`search-result-${index}`" :key="`${hit.workspaceId}/${hit.path}/${hit.line}`" variant="ghost" role="option" :aria-selected="index === selected" class="search-result" @click="choose(hit)"><component :is="hit.line > 0 ? SearchIcon : FileSearchIcon" /><span class="min-w-0"><span class="block truncate">{{ hit.path }}{{ hit.line > 0 ? ` : ${hit.line}` : '' }}</span><span class="block truncate text-muted-foreground text-xs">{{ store.workspaces.find(w => w.id === hit.workspaceId)?.name }}{{ hit.snippet ? ` · ${hit.snippet}` : content ? ' · 文件名或路径匹配' : '' }}</span></span></Button></div>
    <p v-if="!loading && !hits.length && !error" class="text-muted-foreground text-sm">{{ content && !query ? '输入关键词开始搜索。' : '未找到匹配文档。' }}</p>
  </DialogContent></Dialog>
</template>
