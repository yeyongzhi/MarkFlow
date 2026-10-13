<script setup lang="ts">
import { computed,ref,shallowRef,watch } from 'vue'
import { toast } from 'vue-sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { ListIcon, LayoutGridIcon, ChevronRightIcon } from '@lucide/vue'
import { Tabs,TabsList,TabsTrigger } from '@/components/ui/tabs'
import { AlertDialog,AlertDialogContent,AlertDialogHeader,AlertDialogTitle,AlertDialogDescription,AlertDialogFooter,AlertDialogCancel } from '@/components/ui/alert-dialog'
import TemplateCollection from './TemplateCollection.vue'
import { Field,FieldGroup,FieldLabel } from '@/components/ui/field'
import { useWorkbench } from '@/stores/workbench'
import { templates,templateText } from '@/services/writing'
import { templateCatalog } from '@/services/template-catalog'
import type { Template } from '@/types'
const store=useWorkbench(),query=ref(''),editing=ref<string|null>(null),formOpen=ref(false),name=ref(''),body=ref(''),error=ref('')
const catalog=computed(()=>templateCatalog(store.preferences.templates,store.preferences.hiddenTemplates).filter(t=>t.id!=='blank'))
const filtered=computed(()=>catalog.value.filter(t=>(t.name+' '+t.text).toLowerCase().includes(query.value.trim().toLowerCase())))
const preview=computed(()=>templateText(body.value,'示例文档.md'))
const builtin=(id:string)=>templates.some(t=>t.id===id)
const builtinIds=templates.map(t=>t.id),layout=shallowRef('list'),managing=shallowRef(false),selected=ref<string[]>([]),confirmBatch=shallowRef(false)
const visibleSelected=computed(()=>filtered.value.filter(t=>selected.value.includes(t.id)))
watch(query,()=>{selected.value=[]})
function select(id:string,checked:boolean){selected.value=checked?[...new Set([...selected.value,id])]:selected.value.filter(value=>value!==id)}
function manage(){managing.value=!managing.value;selected.value=[]}
function selectAll(){selected.value=visibleSelected.value.length===filtered.value.length?[]:filtered.value.map(t=>t.id)}
function removeSelected(){
 const removed=[...visibleSelected.value],ids=new Set(removed.map(t=>t.id));if(!ids.size)return
 store.preferences.hiddenTemplates=[...new Set([...store.preferences.hiddenTemplates,...removed.filter(t=>builtin(t.id)).map(t=>t.id)])]
 store.preferences.templates=store.preferences.templates.filter(t=>!ids.has(t.id)||builtin(t.id));selected.value=[];confirmBatch.value=false
 toast.success('所选模板已删除',{action:{label:'撤销',onClick:()=>{store.preferences.hiddenTemplates=store.preferences.hiddenTemplates.filter(id=>!ids.has(id));for(const t of removed)if(!builtin(t.id)&&!store.preferences.templates.some(value=>value.id===t.id))store.preferences.templates.push(t)}}})
}
function edit(t?:Template){editing.value=t?.id||null;name.value=t?.name||'';body.value=t?.text||'';formOpen.value=true;error.value=''}
function copy(t:Template){
 edit();body.value=t.text
 let index=1,candidate=''
 do {const suffix=index===1?' 副本':` 副本 ${index}`;candidate=t.name.slice(0,60-suffix.length)+suffix;index++} while(catalog.value.some(value=>value.name===candidate))
 name.value=candidate
}
function save(){
 const title=name.value.trim();if(!title||title.length>60){error.value='模板名称应为 1–60 个字符。';return}
 const id=editing.value||crypto.randomUUID(),others=store.preferences.templates.filter(t=>t.id!==id)
 if(catalog.value.some(t=>t.id!==id&&t.name===title)){error.value='已有同名模板，请换一个名称。';return}
 if((!editing.value&&others.length>=30)||body.value.length>32000||others.reduce((n,t)=>n+t.text.length,0)+body.value.length>256000){error.value='最多 30 个自定义模板，每个不超过 32K 字符，总计不超过 256K 字符。';return}
 store.preferences.templates=[...others,{id,name:title,text:body.value}];formOpen.value=false;toast.success(editing.value?'模板已更新':'模板已添加')
}
function remove(t:Template){if(builtin(t.id))store.preferences.hiddenTemplates=[...new Set([...store.preferences.hiddenTemplates,t.id])];else store.preferences.templates=store.preferences.templates.filter(x=>x.id!==t.id);if(editing.value===t.id)formOpen.value=false;toast.success('模板已删除',{action:{label:'撤销',onClick:()=>{if(builtin(t.id))store.preferences.hiddenTemplates=store.preferences.hiddenTemplates.filter(id=>id!==t.id);else if(!store.preferences.templates.some(x=>x.id===t.id))store.preferences.templates.push(t)}}})}

</script>
<template><div class="flex flex-col gap-4 pb-4 pt-1">
<template v-if="!formOpen">

  <div class="flex flex-wrap items-center gap-2"><Input v-model="query" aria-label="搜索模板" placeholder="搜索模板名称或内容…" class="min-w-40 flex-1"/><Tabs v-model="layout"><TabsList aria-label="模板展示方式" class="h-8! flex-row!"><TabsTrigger value="list" aria-label="模板列表展示" class="w-auto! flex-none!"><ListIcon/>列表</TabsTrigger><TabsTrigger value="grid" aria-label="模板网格展示" class="w-auto! flex-none!"><LayoutGridIcon/>网格</TabsTrigger></TabsList></Tabs><Button :disabled="managing" @click="edit()">新增模板</Button><Button variant="outline" @click="manage">{{managing?'退出管理':'批量管理'}}</Button></div>
  <div v-if="managing" class="flex flex-wrap items-center gap-2 rounded-lg bg-muted/40 p-3"><Button variant="outline" size="sm" :disabled="!filtered.length" @click="selectAll">{{filtered.length&&visibleSelected.length===filtered.length?'取消全选':'全选'}}</Button><span class="text-xs text-muted-foreground">已选择 {{visibleSelected.length}} 项</span><Button variant="destructive" size="sm" class="ml-auto" :disabled="!visibleSelected.length" @click="confirmBatch=true">删除所选</Button></div>
  <TemplateCollection :templates="filtered" :builtin-ids="builtinIds" :layout="layout" :managing="managing" :selected="selected" @edit="edit" @copy="copy" @remove="remove" @select="select"/>
  <p v-if="!filtered.length" class="py-8 text-center text-sm text-muted-foreground">没有匹配的模板。</p>
</template>
<form v-if="formOpen" class="flex flex-col gap-4 rounded-xl border p-5" @submit.prevent="save"><h3 class="font-medium">{{editing?'编辑模板':'新增模板'}}</h3><p v-if="error" role="alert" class="text-sm text-destructive">{{error}}</p><FieldGroup><Field><FieldLabel for="template-name">模板名称</FieldLabel><Input id="template-name" v-model="name" maxlength="60"/></Field><Field><FieldLabel for="template-body">模板 Markdown</FieldLabel><Textarea id="template-body" v-model="body" class="min-h-48 font-mono" placeholder="模板内容可以留空"/></Field></FieldGroup><p class="text-xs text-muted-foreground"><code v-pre>{{title}}</code> 替换为新文档名称，<code v-pre>{{date}}</code> 替换为当天日期。Ctrl+N 新建文档时选择此模板。</p><details class="group/template-preview rounded-lg bg-muted/30 p-3"><summary class="flex cursor-pointer list-none items-center gap-2 text-sm [&::-webkit-details-marker]:hidden"><ChevronRightIcon aria-hidden="true" class="size-4 shrink-0 text-muted-foreground transition-transform duration-150 group-open/template-preview:rotate-90 motion-reduce:transition-none"/>查看占位符替换预览</summary><pre class="mt-3 whitespace-pre-wrap text-xs">{{preview||'空白文档'}}</pre></details><div class="flex justify-end gap-2"><Button type="button" variant="outline" @click="formOpen=false">取消</Button><Button type="submit">保存模板</Button></div></form>

<AlertDialog v-model:open="confirmBatch"><AlertDialogContent><AlertDialogHeader><AlertDialogTitle>删除所选的 {{visibleSelected.length}} 个模板？</AlertDialogTitle><AlertDialogDescription>删除后不会影响已创建的文档，可通过提示中的“撤销”恢复模板。</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel>取消</AlertDialogCancel><Button variant="destructive" @click="removeSelected">删除模板</Button></AlertDialogFooter></AlertDialogContent></AlertDialog>
</div></template>
