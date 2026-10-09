<script setup lang="ts">
import { computed,ref } from 'vue'
import { toast } from 'vue-sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Field,FieldGroup,FieldLabel } from '@/components/ui/field'
import { useWorkbench } from '@/stores/workbench'
import { templates,templateText } from '@/services/writing'
import { templateCatalog } from '@/services/template-catalog'
import type { Template } from '@/types'
const store=useWorkbench(),query=ref(''),editing=ref<string|null>(null),formOpen=ref(false),name=ref(''),body=ref(''),error=ref('')
const catalog=computed(()=>templateCatalog(store.preferences.templates,store.preferences.hiddenTemplates))
const filtered=computed(()=>catalog.value.filter(t=>(t.name+' '+t.text).toLowerCase().includes(query.value.trim().toLowerCase())))
const preview=computed(()=>templateText(body.value,'示例文档.md'))
const builtin=(id:string)=>templates.some(t=>t.id===id)
function edit(t?:Template){editing.value=t?.id||null;name.value=t?.name||'';body.value=t?.text||'';formOpen.value=true;error.value=''}
function save(){
 const title=name.value.trim();if(!title||title.length>60){error.value='模板名称应为 1–60 个字符。';return}
 const id=editing.value||crypto.randomUUID(),others=store.preferences.templates.filter(t=>t.id!==id)
 if(catalog.value.some(t=>t.id!==id&&t.name===title)){error.value='已有同名模板，请换一个名称。';return}
 if((!editing.value&&others.length>=30)||body.value.length>32000||others.reduce((n,t)=>n+t.text.length,0)+body.value.length>256000){error.value='最多 30 个自定义模板，每个不超过 32K 字符，总计不超过 256K 字符。';return}
 store.preferences.templates=[...others,{id,name:title,text:body.value}];formOpen.value=false;toast.success(editing.value?'模板已更新':'模板已添加')
}
function remove(t:Template){if(builtin(t.id))store.preferences.hiddenTemplates=[...new Set([...store.preferences.hiddenTemplates,t.id])];else store.preferences.templates=store.preferences.templates.filter(x=>x.id!==t.id);if(editing.value===t.id)formOpen.value=false;toast.success('模板已删除',{action:{label:'撤销',onClick:()=>{if(builtin(t.id))store.preferences.hiddenTemplates=store.preferences.hiddenTemplates.filter(id=>id!==t.id);else if(!store.preferences.templates.some(x=>x.id===t.id))store.preferences.templates.push(t)}}})}
function restore(){store.preferences.hiddenTemplates=[];store.preferences.templates=store.preferences.templates.filter(t=>!builtin(t.id));toast.success('内置模板已恢复')}
</script>
<template><div class="flex flex-col gap-5 py-5"><div class="flex flex-wrap gap-2"><Input v-model="query" aria-label="搜索模板" placeholder="搜索模板名称或内容…" class="min-w-40 flex-1"/><Button @click="edit()">新增模板</Button><Button variant="outline" @click="restore">恢复内置模板</Button></div><p class="text-xs text-muted-foreground">{{catalog.length}} 个模板。点击编辑可查看或修改内容，修改后会用于新建文档。</p><div class="grid gap-3 lg:grid-cols-2"><section v-for="t in filtered" :key="t.id" class="flex min-w-0 flex-col gap-3 rounded-xl border p-4"><div class="flex items-center gap-2"><h3 class="min-w-0 flex-1 truncate font-medium">{{t.name}}</h3><Badge variant="secondary">{{builtin(t.id)?'内置':'自定义'}}</Badge></div><pre class="max-h-24 overflow-auto whitespace-pre-wrap text-xs text-muted-foreground">{{t.text||'空白文档，不预填内容。'}}</pre><div class="mt-auto flex justify-end gap-2"><Button variant="outline" size="sm" :aria-label="`编辑模板 ${t.name}`" @click="edit(t)">查看 / 编辑</Button><Button variant="ghost" size="sm" :aria-label="`删除模板 ${t.name}`" @click="remove(t)">删除</Button></div></section></div><p v-if="!filtered.length" class="text-sm text-muted-foreground">没有匹配的模板。</p><form v-if="formOpen" class="flex flex-col gap-4 rounded-xl border p-5" @submit.prevent="save"><h3 class="font-medium">{{editing?'编辑模板':'新增模板'}}</h3><p v-if="error" role="alert" class="text-sm text-destructive">{{error}}</p><FieldGroup><Field><FieldLabel for="template-name">模板名称</FieldLabel><Input id="template-name" v-model="name" maxlength="60"/></Field><Field><FieldLabel for="template-body">模板 Markdown</FieldLabel><Textarea id="template-body" v-model="body" class="min-h-48 font-mono" placeholder="模板内容可以留空"/></Field></FieldGroup><p class="text-xs text-muted-foreground"><code v-pre>{{title}}</code> 替换为新文档名称，<code v-pre>{{date}}</code> 替换为当天日期。Ctrl+N 新建文档时选择此模板。</p><details class="rounded-lg bg-muted/30 p-3"><summary class="cursor-pointer text-sm">查看占位符替换预览</summary><pre class="mt-3 whitespace-pre-wrap text-xs">{{preview||'空白文档'}}</pre></details><div class="flex justify-end gap-2"><Button type="button" variant="outline" @click="formOpen=false">取消</Button><Button type="submit">保存模板</Button></div></form></div></template>
