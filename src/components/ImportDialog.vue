<script setup lang="ts">
import { ref, watch } from 'vue'
import { toast } from 'vue-sonner'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog'
import { Field, FieldGroup, FieldLabel, FieldDescription } from '@/components/ui/field'
import { Select, SelectTrigger, SelectValue, SelectContent, SelectGroup, SelectItem } from '@/components/ui/select'
import { Button } from '@/components/ui/button'
import DirectoryTreeSelect from './DirectoryTreeSelect.vue'
import { call, desktop, message } from '@/services/api'
import { useWorkbench } from '@/stores/workbench'

const props=defineProps<{open:boolean}>(),emit=defineEmits<{ 'update:open':[value:boolean] }>()
const store=useWorkbench(),workspaceId=ref(''),destination=ref(''),files=ref<File[]>([]),busy=ref(false),picker=ref<HTMLInputElement>()
watch(()=>props.open,open=>{if(open){workspaceId.value=store.active?.workspaceId||store.workspaces[0]?.id||'';destination.value='';files.value=[];if(workspaceId.value)void store.loadDirectory(workspaceId.value)}})
watch(workspaceId,id=>{destination.value='';if(id)void store.loadDirectory(id)})
function selectFiles(event:Event){files.value=Array.from((event.target as HTMLInputElement).files||[])}
async function submit(){if(busy.value||!workspaceId.value||!files.value.length)return;busy.value=true;try{const items=await Promise.all(files.value.map(async file=>({name:file.name,text:await file.text()})));const paths=await call<string[]>('import_documents',{workspaceId:workspaceId.value,parent:destination.value.replace(/^\/+|\/+$/g,''),files:items});await store.loadDirectory(workspaceId.value,destination.value.replace(/^\/+|\/+$/g,''));toast.success(`已导入 ${paths.length} 个 Markdown 文档`);if(paths[0])await store.open(workspaceId.value,paths[0]);emit('update:open',false)}catch(error){toast.error(message(error))}finally{busy.value=false}}
</script>

<template><Dialog :open="open" @update:open="emit('update:open',$event)"><DialogContent class="productivity-dialog sm:max-w-lg"><DialogHeader><DialogTitle>导入 Markdown 文档</DialogTitle><DialogDescription>选择目标工作区和文件夹，再选择要导入的 Markdown 文件。</DialogDescription></DialogHeader><form class="flex flex-col gap-4" @submit.prevent="submit"><FieldGroup><Field><FieldLabel for="import-workspace">第一步：选择工作区</FieldLabel><Select v-model="workspaceId"><SelectTrigger id="import-workspace" aria-label="目标工作区"><SelectValue placeholder="选择工作区"/></SelectTrigger><SelectContent><SelectGroup><SelectItem v-for="workspace in store.workspaces" :key="workspace.id" :value="workspace.id">{{workspace.name}}</SelectItem></SelectGroup></SelectContent></Select></Field><Field><FieldLabel>第二步：选择导入位置</FieldLabel><DirectoryTreeSelect v-model="destination" :workspace-id="workspaceId"/></Field><Field><FieldLabel>第三步：选择文件</FieldLabel><input ref="picker" class="sr-only" type="file" multiple accept=".md,.markdown,text/markdown" @change="selectFiles"/><Button type="button" variant="outline" class="justify-start" :disabled="!workspaceId" @click="picker?.click()">选择 Markdown 文件</Button><FieldDescription>{{files.length?`已选择 ${files.length} 个文件：${files.map(file=>file.name).join('、')}`:'支持 .md 和 .markdown 文件；重名时保留原文件并自动创建副本。'}}</FieldDescription></Field></FieldGroup><DialogFooter><Button type="button" variant="outline" @click="emit('update:open',false)">取消</Button><Button type="submit" :disabled="busy||!workspaceId||!files.length">{{busy?'正在导入…':'导入'}}</Button></DialogFooter></form><p v-if="!desktop" class="text-xs text-muted-foreground">浏览器预览只导入到示例工作区的临时数据。</p></DialogContent></Dialog></template>
