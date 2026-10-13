<script setup lang="ts">
import { ref,watch,shallowRef } from 'vue'
import { toast } from 'vue-sonner'
import { ArrowLeftIcon,ListIcon,LayoutGridIcon,Trash2Icon } from '@lucide/vue'
import { AlertDialog,AlertDialogContent,AlertDialogHeader,AlertDialogTitle,AlertDialogDescription,AlertDialogFooter,AlertDialogCancel } from '@/components/ui/alert-dialog'
import { Tabs,TabsList,TabsTrigger } from '@/components/ui/tabs'
import ArchiveEntries from './ArchiveEntries.vue'
import { Button } from '@/components/ui/button'
import { useWorkbench } from '@/stores/workbench'
import { call,message } from '@/services/api'
const props=defineProps<{open:boolean}>(),emit=defineEmits<{'update:open':[value:boolean]}>(),store=useWorkbench(),workspaceId=ref(''),entries=ref<{id:string;originalPath:string;archivedAt:number}[]>([]),busy=ref(false),loading=ref(false),error=ref(''),deleting=ref<string>()
const layout=shallowRef('list')
let request=0
watch(()=>props.open,open=>{if(open)workspaceId.value=store.workspaces.find(w=>w.id===store.active?.workspaceId&&!w.id.startsWith('file-'))?.id||store.workspaces.find(w=>!w.id.startsWith('file-'))?.id||'';else request++},{immediate:true})
async function load(){const seq=++request;entries.value=[];error.value='';if(!props.open||!workspaceId.value)return;loading.value=true;try{const values=await call<typeof entries.value>('list_archives',{workspaceId:workspaceId.value});if(seq===request)entries.value=values}catch(e){if(seq===request)error.value=message(e)}finally{if(seq===request)loading.value=false}}
watch(()=>[props.open,workspaceId.value],load,{immediate:true})
async function restore(id:string){busy.value=true;try{await call<string>('restore_archive',{workspaceId:workspaceId.value,id});await store.refresh(workspaceId.value);await load();toast.success('文档已恢复')}catch(e){toast.error(message(e))}finally{busy.value=false}}
async function remove(){if(!deleting.value)return;busy.value=true;try{await call('delete_archive',{workspaceId:workspaceId.value,id:deleting.value});deleting.value=undefined;await load();toast.success('归档文档已彻底删除')}catch(e){toast.error(message(e))}finally{busy.value=false}}
</script>
<template>
<section v-show="open" class="flex min-h-0 flex-1 bg-background" aria-label="回收站">
  <aside class="flex w-[150px] shrink-0 flex-col gap-4 border-r bg-sidebar p-3 sm:w-48 sm:p-4">
    <Button variant="ghost" class="justify-start" :disabled="busy" @click="emit('update:open',false)"><ArrowLeftIcon/>返回应用</Button>
    <h2 class="px-3 text-sm font-medium">工作区</h2>
    <Tabs v-model="workspaceId" orientation="vertical" class="min-h-0 overflow-y-auto overflow-x-hidden">
      <TabsList variant="navigation" aria-label="回收站工作区" class="w-full items-stretch">
        <TabsTrigger v-for="workspace in store.workspaces.filter(w=>!w.id.startsWith('file-'))" :key="workspace.id" :value="workspace.id" :disabled="busy" class="h-10 min-w-0 flex-none justify-start px-3"><span class="truncate">{{workspace.name}}</span></TabsTrigger>
      </TabsList>
    </Tabs>
  </aside>
  <div class="flex min-h-0 min-w-0 flex-1 flex-col gap-6 overflow-auto p-6 sm:p-8">
    <header class="flex flex-wrap items-center justify-between gap-3"><h1 class="text-xl font-semibold">回收站</h1>
      <Tabs v-model="layout"><TabsList class="h-8" aria-label="回收站展示方式"><TabsTrigger value="list" aria-label="列表展示" class="gap-1 px-2 text-xs"><ListIcon class="size-3.5"/>列表</TabsTrigger><TabsTrigger value="grid" aria-label="网格展示" class="gap-1 px-2 text-xs"><LayoutGridIcon class="size-3.5"/>网格</TabsTrigger></TabsList></Tabs>
    </header>
    <p v-if="loading" role="status" class="text-sm text-muted-foreground">正在加载…</p>
    <p v-else-if="error" class="text-destructive" role="alert">{{error}}</p>
    <div v-else-if="!entries.length" class="flex min-h-64 flex-1 flex-col items-center justify-center gap-3 rounded-xl border border-dashed text-muted-foreground"><Trash2Icon class="size-9 opacity-60"/><p>{{workspaceId?'此工作区的回收站为空':'添加工作区后，可在这里查看回收站'}}</p></div>
    <ArchiveEntries v-else :entries="entries" :layout="layout" :busy="busy" @restore="restore" @remove="deleting=$event"/>
<AlertDialog :open="!!deleting" @update:open="v=>{if(!v&&!busy)deleting=undefined}"><AlertDialogContent><AlertDialogHeader><AlertDialogTitle>彻底删除这份归档文档？</AlertDialogTitle><AlertDialogDescription>将直接删除归档文件，不经过系统回收站，无法恢复。工作区中的图片附件不会删除。</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel :disabled="busy">取消</AlertDialogCancel><Button variant="destructive" :disabled="busy" @click="remove">彻底删除</Button></AlertDialogFooter></AlertDialogContent></AlertDialog>
  </div>
</section>
</template>
