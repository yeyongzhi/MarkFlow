<script setup lang="ts">
import { ref,watch } from 'vue'
import { toast } from 'vue-sonner'
import { ArchiveRestoreIcon,Trash2Icon } from '@lucide/vue'
import { Dialog,DialogContent,DialogHeader,DialogTitle,DialogDescription } from '@/components/ui/dialog'
import { AlertDialog,AlertDialogContent,AlertDialogHeader,AlertDialogTitle,AlertDialogDescription,AlertDialogFooter,AlertDialogCancel } from '@/components/ui/alert-dialog'
import { Select,SelectTrigger,SelectValue,SelectContent,SelectGroup,SelectItem } from '@/components/ui/select'
import { Button } from '@/components/ui/button'
import { useWorkbench } from '@/stores/workbench'
import { call,message } from '@/services/api'
const props=defineProps<{open:boolean}>(),emit=defineEmits<{'update:open':[value:boolean]}>(),store=useWorkbench(),workspaceId=ref(''),entries=ref<{id:string;originalPath:string;archivedAt:number}[]>([]),busy=ref(false),loading=ref(false),error=ref(''),deleting=ref<string>()
let request=0
watch(()=>props.open,open=>{if(open)workspaceId.value=store.active?.workspaceId||store.workspaces[0]?.id||'';else request++})
async function load(){const seq=++request;entries.value=[];error.value='';if(!props.open||!workspaceId.value)return;loading.value=true;try{const values=await call<typeof entries.value>('list_archives',{workspaceId:workspaceId.value});if(seq===request)entries.value=values}catch(e){if(seq===request)error.value=message(e)}finally{if(seq===request)loading.value=false}}
watch(()=>[props.open,workspaceId.value],load)
async function restore(id:string){busy.value=true;try{const path=await call<string>('restore_archive',{workspaceId:workspaceId.value,id});await store.refresh(workspaceId.value);await load();toast.success('文档已恢复',{description:path})}catch(e){toast.error(message(e))}finally{busy.value=false}}
async function remove(){if(!deleting.value)return;busy.value=true;try{await call('delete_archive',{workspaceId:workspaceId.value,id:deleting.value});deleting.value=undefined;await load();toast.success('归档文档已彻底删除')}catch(e){toast.error(message(e))}finally{busy.value=false}}
</script>
<template><Dialog :open="open" @update:open="v=>{if(!busy)emit('update:open',v)}"><DialogContent class="productivity-dialog sm:max-w-2xl"><DialogHeader><DialogTitle>回收站</DialogTitle><DialogDescription>每个工作区独立存放归档文档。恢复时保留原文；遇到同名文件会另存一份。</DialogDescription></DialogHeader><Select v-model="workspaceId" :disabled="busy"><SelectTrigger aria-label="回收站工作区"><SelectValue placeholder="选择工作区"/></SelectTrigger><SelectContent><SelectGroup><SelectItem v-for="workspace in store.workspaces" :key="workspace.id" :value="workspace.id">{{workspace.name}}</SelectItem></SelectGroup></SelectContent></Select><p v-if="loading" role="status">正在加载…</p><p v-else-if="error" class="text-destructive" role="alert">{{error}}</p><p v-else-if="!entries.length" class="text-muted-foreground">此工作区的回收站为空。</p><div class="archive-results"><div v-for="entry in entries" :key="entry.id" class="archive-item"><div class="flex-1 min-w-0"><p class="truncate" :title="entry.originalPath">{{entry.originalPath}}</p><p class="text-muted-foreground text-xs">归档于 {{new Date(entry.archivedAt).toLocaleString('zh-CN',{hour12:false})}}</p></div><Button variant="outline" size="sm" :aria-label="`恢复 ${entry.originalPath}`" :disabled="busy" @click="restore(entry.id)"><ArchiveRestoreIcon data-icon="inline-start"/>恢复</Button><Button variant="ghost" size="icon-sm" :aria-label="`彻底删除 ${entry.originalPath}`" title="彻底删除" :disabled="busy" @click="deleting=entry.id"><Trash2Icon/></Button></div></div>
<AlertDialog :open="!!deleting" @update:open="v=>{if(!v&&!busy)deleting=undefined}"><AlertDialogContent><AlertDialogHeader><AlertDialogTitle>彻底删除这份归档文档？</AlertDialogTitle><AlertDialogDescription>将直接删除归档文件，不经过系统回收站，无法恢复。工作区中的图片附件不会删除。</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel :disabled="busy">取消</AlertDialogCancel><Button variant="destructive" :disabled="busy" @click="remove">彻底删除</Button></AlertDialogFooter></AlertDialogContent></AlertDialog>
</DialogContent></Dialog></template>
