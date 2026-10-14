<script setup lang="ts">
import { computed, ref, watch, onBeforeUnmount } from 'vue'
import { toast } from 'vue-sonner'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Tabs,TabsList,TabsTrigger } from '@/components/ui/tabs'
import { ToggleGroup,ToggleGroupItem } from '@/components/ui/toggle-group'
import { tagStyle,tagColor } from '@/services/tag-colors'
import { documentTags } from '@/services/frontmatter'
import { Button } from '@/components/ui/button'
import { Item } from '@/components/ui/item'
import { SearchIcon, FileSearchIcon } from '@lucide/vue'
import { loadKnowledge, liveKnowledge, knowledgeDocs, knowledgeTruncated, knowledgeErrors } from '@/services/knowledge'
import { inCreationRange } from '@/services/search-date'
import { fuzzy } from '@/services/writing'
import { call, message } from '@/services/api'
import { useWorkbench } from '@/stores/workbench'
const props = defineProps<{ open: boolean; content: boolean; initialTag?: string }>()
const emit = defineEmits<{ 'update:open': [open: boolean]; jump: [line: number] }>()
type Hit = { workspaceId: string; path: string; line: number; snippet: string; documentId?: string; match?: string; tags?:string[]; createdAt?:number|null }
const store = useWorkbench(), query = ref(''), hits = ref<Hit[]>([]), loading = ref(false), error = ref(''), notice = ref(''), selected = ref(-1)
const scope=ref('all'),selectedTags=ref<string[]>([]),startDate=ref(''),endDate=ref('')
const tags=computed(()=>{void knowledgeDocs.value;return [...new Set([...liveKnowledge().flatMap(d=>d.tags),...store.documents.flatMap(d=>documentTags(d.text))])].sort()})
const chipStyle=(tag:string)=>({...tagStyle(store.preferences.tagColors,tag),borderColor:selectedTags.value.includes(tag)?tagColor(store.preferences.tagColors,tag):'var(--border)',backgroundColor:selectedTags.value.includes(tag)?tagStyle(store.preferences.tagColors,tag).backgroundColor:'var(--background)'})
watch(()=>[props.open,props.initialTag],()=>{if(props.open){if(props.initialTag){scope.value='tags';query.value='';selectedTags.value=[props.initialTag]}else selectedTags.value=[]}})
function clearFilters(){selectedTags.value=[];startDate.value='';endDate.value='';query.value=''}
const cardGroups=computed(()=>[{title:'最近打开',files:store.preferences.recentFiles.slice(0,5)},{title:'收藏文档',files:store.preferences.favorites.slice(0,5)}])
function resultPath(hit: Hit) { const root = store.workspaces.find(w => w.id === hit.workspaceId)?.path; return root ? `${root.replace(/[\\/]+$/, '')}/${hit.path}` : hit.path }
async function openReference(file:{workspaceId:string;path:string;absolutePath?:string}){try{if(file.absolutePath)await store.openLocal([file.absolutePath]);else await store.open(file.workspaceId,file.path);emit('update:open',false)}catch(e){toast.error(message(e))}}

let timer: ReturnType<typeof setTimeout>, request = 0
async function search() {
  const seq = ++request; error.value = ''; hits.value = []; selected.value = -1; notice.value = ''
  if (!props.open) { loading.value = false; return }
  loading.value = true
  try {
    const args = { query: query.value, sensitive: false }
    const [files, contents] = await Promise.all([
      call<{ hits: Hit[]; truncated: boolean; skipped: number }>('search_workspace', { ...args, content: false }),
      props.content && query.value.trim() ? call<{ hits: Hit[]; truncated: boolean; skipped: number }>('search_workspace', { ...args, content: true }) : Promise.resolve({ hits: [] as Hit[], truncated: false, skipped: 0 }),
      props.content ? loadKnowledge() : Promise.resolve()
    ])
    const result = { hits: [...files.hits.map(hit => ({ ...hit, line: 0 })), ...contents.hits], truncated: files.truncated || contents.truncated, skipped: Math.max(files.skipped, contents.skipped) }
    if (seq !== request) return
    // Open documents are authoritative so unsaved edits appear in workspace search.
    const open = store.documents.filter(d => d.temporary || store.workspaces.some(w => w.id === d.workspaceId))
    let values = result.hits.filter(h => !open.some(d => d.workspaceId === h.workspaceId && d.path === h.path))
    const q = query.value.toLowerCase()
    for (const d of open) {
      if (fuzzy(q,d.path,false)) values.push({ workspaceId: d.workspaceId, path: d.path, line: 0, snippet: '', documentId:d.id })
      if (props.content && q.trim()) d.text.split('\n').forEach((line, index) => { if ((line.toLowerCase()).includes(q)) values.push({ workspaceId: d.workspaceId, path: d.path, line: index + 1, snippet: line.slice(0, 160), documentId:d.id }) })
    }
    if(props.content){
      if(!q.trim())for(const d of liveKnowledge())if(!values.some(h=>h.workspaceId===d.workspaceId&&h.path===d.path))values.push({workspaceId:d.workspaceId,path:d.path,line:0,snippet:''})
      const matches=(value:string)=>(value.toLowerCase()).includes(q)
      for(const d of liveKnowledge()){
        const tags=d.tags.filter(matches),titles=d.titles.filter(h=>matches(h.text))
        if(!q.trim()||(!tags.length&&!titles.length))continue
        const existing=values.find(h=>h.workspaceId===d.workspaceId&&h.path===d.path&&h.line===0)
        const match=[tags.length?`标签：${tags.join('、')}`:'',titles.length?`标题：${titles.map(h=>h.text).join('、')}`:''].filter(Boolean).join(' · ')
        if(existing)existing.match=match;else values.push({workspaceId:d.workspaceId,path:d.path,line:0,snippet:'',match})
      }
    }
    notice.value = [result.truncated || values.length > 300 ? '结果已截断，请缩小搜索范围。' : '', result.skipped ? `${result.skipped} 个不可访问路径或超过 2MiB 的文档已跳过。` : ''].filter(Boolean).join(' ')
    values.sort((a,b)=>Number(a.line>0)-Number(b.line>0)||(a.line===0&&b.line===0?Number(b.path.toLowerCase().includes(q))-Number(a.path.toLowerCase().includes(q))||a.path.length-b.path.length:0))
    const documents = new Map<string,Hit>()
    for(const hit of values){
      const identity=JSON.stringify([hit.workspaceId,hit.path])
      const existing=documents.get(identity)
      if(!existing){documents.set(identity,{...hit});continue}
      existing.match ||= hit.match
      existing.documentId ||= hit.documentId
      if(!existing.snippet && hit.snippet){existing.snippet=hit.snippet;existing.line=hit.line}
    }
    let results=[...documents.values()]
    if(props.content){
      const indexed=liveKnowledge()
      if(startDate.value&&endDate.value&&startDate.value>endDate.value){error.value='开始日期不能晚于结束日期。';return}
      results=results.map(h=>{const d=indexed.find(d=>d.workspaceId===h.workspaceId&&d.path===h.path),open=store.documents.find(d=>d.id===h.documentId);return {...h,tags:open?documentTags(open.text):d?.tags||[],createdAt:d?.createdAt}}).filter(h=>{
        if(!selectedTags.value.every(tag=>h.tags.includes(tag)))return false
        if(!inCreationRange(h.createdAt,startDate.value,endDate.value))return false
        return true
      })

      notice.value=[notice.value,knowledgeTruncated.value?'部分文档超出索引上限，标签与时间筛选可能不完整。':'',...knowledgeErrors.value,startDate.value||endDate.value?'按文件创建日期筛选；没有创建时间的文档不参与。':''].filter(Boolean).join(' ')
    }
    hits.value = results.slice(0, 300)
  } catch (e) { if (seq === request) error.value = message(e) }
  finally { if (seq === request) loading.value = false }
}
watch(() => [props.open, props.content, query.value,selectedTags.value.join(),startDate.value,endDate.value], () => { request++; hits.value = []; selected.value = -1; loading.value = props.open; clearTimeout(timer); timer = setTimeout(search, 200) })
async function choose(hit?: Hit) { if (!hit) return; try { if(hit.documentId&&store.documents.some(d=>d.id===hit.documentId))store.activate(hit.documentId);else await store.open(hit.workspaceId, hit.path, hit.line > 0 ? 'source' : undefined); if(hit.line>0)store.setView('source');emit('update:open', false); if (hit.line > 0) emit('jump', hit.line) } catch (e) { toast.error(message(e)) } }
function key(e: KeyboardEvent) {
  if(!(e.target instanceof HTMLInputElement) || e.target.type==='date')return
  if(e.key==='Enter'){e.preventDefault();void choose(hits.value[selected.value < 0 ? 0 : selected.value])}
  if(e.key==='ArrowDown'||e.key==='ArrowUp'){e.preventDefault();if(!hits.value.length)return;selected.value=selected.value<0?(e.key==='ArrowDown'?0:hits.value.length-1):Math.max(0,Math.min(hits.value.length-1,selected.value+(e.key==='ArrowDown'?1:-1)));document.getElementById(`search-result-${selected.value}`)?.scrollIntoView({block:'nearest'})}
}
function highlight(text:string){
  const term=query.value.trim(),parts:{text:string;match:boolean}[]=[]
  if(!term)return [{text,match:false}]
  const lower=text.toLowerCase(),needle=term.toLowerCase();let offset=0,index=lower.indexOf(needle)
  while(index>=0){if(index>offset)parts.push({text:text.slice(offset,index),match:false});parts.push({text:text.slice(index,index+term.length),match:true});offset=index+term.length;index=lower.indexOf(needle,offset)}
  if(offset<text.length)parts.push({text:text.slice(offset),match:false});return parts
}

onBeforeUnmount(() => { request++; clearTimeout(timer) })
</script>
<template>
  <Dialog :open="open" @update:open="emit('update:open', $event)"><DialogContent class="productivity-dialog sm:max-w-2xl" @keydown="key">
    <DialogHeader><DialogTitle>{{ content ? '全局搜索文档' : '快速打开文档' }}</DialogTitle><DialogDescription>{{ content ? '搜索所有工作区的文档标题、正文和标签，包含已打开文档的未保存内容。' : '输入文件名或路径，使用方向键选择、Enter 打开。' }}</DialogDescription></DialogHeader>
    <Tabs v-if="content" v-model="scope"><TabsList><TabsTrigger value="all">全部文档</TabsTrigger><TabsTrigger value="tags">标签筛选</TabsTrigger><TabsTrigger value="dates">日期筛选</TabsTrigger></TabsList></Tabs>
    <div class="flex gap-2"><Input v-model="query" :aria-label="content ? '全局搜索关键词' : '搜索文件名'" :placeholder="content ? '输入标题、内容或标签关键词' : '输入文件名或路径'" /></div>
    <div v-if="content" class="flex flex-col gap-3"><div v-if="scope==='tags'" class="flex flex-col gap-2"><span class="text-xs text-muted-foreground">标签筛选（同时满足所选标签）</span><ToggleGroup v-model="selectedTags" type="multiple" variant="outline" :spacing="1" class="max-h-24 flex-wrap overflow-auto" aria-label="搜索标签筛选"><ToggleGroupItem v-for="tag in tags" :key="tag" :value="tag" :style="chipStyle(tag)">{{tag}}</ToggleGroupItem></ToggleGroup><p v-if="!tags.length" class="text-xs text-muted-foreground">暂无文档标签。</p></div><div v-if="scope==='dates'" class="flex flex-wrap items-end gap-2"><label class="flex flex-col gap-1 text-xs text-muted-foreground">创建日期：从<Input v-model="startDate" type="date" aria-label="创建日期开始" :max="endDate||undefined"/></label><label class="flex flex-col gap-1 text-xs text-muted-foreground">至<Input v-model="endDate" type="date" aria-label="创建日期结束" :min="startDate||undefined"/></label><Button variant="ghost" size="sm" @click="clearFilters">清空筛选</Button></div></div>
    <div v-if="content && scope==='all' && !query.trim() && !selectedTags.length && !startDate && !endDate" class="grid gap-3 sm:grid-cols-2"><section v-for="group in cardGroups" :key="group.title" class="min-w-0 rounded-xl border border-border bg-muted/20 p-3"><h3 class="mb-2 text-sm font-medium">{{group.title}}</h3><Button v-for="file in group.files" :key="file.workspaceId+file.path" variant="ghost" class="w-full justify-start" :title="file.path" @click="openReference(file)"><FileSearchIcon/><span class="truncate">{{file.path}}</span></Button><p v-if="!group.files.length" class="text-xs text-muted-foreground">暂无文档。</p></section></div>
    <div v-if="content && (selectedTags.length || startDate || endDate)" class="flex flex-wrap items-center gap-2 text-xs text-muted-foreground"><span>当前筛选：{{selectedTags.join('、')}} {{startDate||'不限'}} — {{endDate||'不限'}}</span><Button variant="ghost" size="sm" @click="clearFilters">清空筛选</Button></div>
    <p v-if="loading" role="status">搜索中…</p><p v-if="error" class="text-destructive" role="alert">{{ error }}</p><p v-if="notice" class="text-muted-foreground text-sm">{{ notice }}</p>
    <div class="search-results" role="listbox" aria-label="搜索结果"><Item v-for="(hit, index) in hits" as="button" :id="`search-result-${index}`" :key="`${hit.workspaceId}/${hit.path}/${hit.line}`" variant="muted" role="option" :aria-selected="index === selected" class="search-result" @click="choose(hit)"><component :is="hit.line > 0 ? SearchIcon : FileSearchIcon" /><span class="min-w-0 flex-1 text-left"><Tooltip><TooltipTrigger as-child><span class="block truncate"><template v-for="(part,i) in highlight(hit.path.split(/[/\\]/).pop() || hit.path)" :key="i"><mark v-if="part.match" class="rounded-sm bg-primary/15 px-0.5 text-foreground">{{part.text}}</mark><template v-else>{{part.text}}</template></template>{{ hit.line > 0 ? ` : ${hit.line}` : '' }}</span></TooltipTrigger><TooltipContent class="max-w-96 break-all">{{ resultPath(hit) }}</TooltipContent></Tooltip><span class="block truncate text-muted-foreground text-xs">{{ store.workspaces.find(w => w.id === hit.workspaceId)?.name || '临时文档' }}<template v-if="hit.snippet"> · <template v-for="(part,i) in highlight(hit.snippet)" :key="i"><mark v-if="part.match" class="rounded-sm bg-primary/15 px-0.5 text-foreground">{{part.text}}</mark><template v-else>{{part.text}}</template></template></template></span><span v-if="content && hit.createdAt!=null" class="mt-1 block text-xs text-muted-foreground">创建于 {{new Date(hit.createdAt).toLocaleDateString('zh-CN')}}</span></span><span v-if="content" class="ml-auto flex max-w-[35%] shrink-0 flex-wrap justify-end gap-1.5"><Badge v-for="tag in hit.tags" :key="tag" variant="outline" class="max-w-32 truncate" :title="tag" :style="tagStyle(store.preferences.tagColors,tag)"><template v-for="(part,i) in highlight(tag)" :key="i"><mark v-if="part.match" class="rounded-sm bg-primary/15 text-foreground">{{part.text}}</mark><template v-else>{{part.text}}</template></template></Badge></span></Item></div>
    <p v-if="!loading && !hits.length && !error" class="text-muted-foreground text-sm">未找到匹配文档。</p>
  </DialogContent></Dialog>
</template>
