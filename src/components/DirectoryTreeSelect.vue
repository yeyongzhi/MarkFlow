<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { FolderIcon, FolderOpenIcon, ChevronDownIcon } from '@lucide/vue'
import { PopoverRoot, PopoverTrigger, PopoverPortal, PopoverContent } from 'reka-ui'
import { Button } from '@/components/ui/button'
import { useWorkbench, treeKey } from '@/stores/workbench'
import DirectoryTreeBranch from './DirectoryTreeBranch.vue'

const props=defineProps<{workspaceId:string;modelValue:string}>(),emit=defineEmits<{ 'update:modelValue':[path:string] }>(),store=useWorkbench(),open=ref(false)
const label=computed(()=>props.modelValue?props.modelValue.split('/').at(-1):'工作区根目录')
watch(()=>[open.value,props.workspaceId],async([visible,id])=>{if(visible&&id&&!store.tree[treeKey(String(id),'')])try{await store.loadDirectory(String(id))}catch{}})
function select(path:string){emit('update:modelValue',path);open.value=false}
</script>
<template><PopoverRoot v-model:open="open"><PopoverTrigger as-child><Button type="button" variant="outline" class="w-full justify-between gap-2 font-normal"><span class="flex min-w-0 items-center gap-2"><component :is="modelValue?FolderIcon:FolderOpenIcon" class="size-4 shrink-0 text-muted-foreground"/><span class="truncate">{{label}}</span></span><ChevronDownIcon class="size-4 shrink-0 text-muted-foreground"/></Button></PopoverTrigger><PopoverPortal><PopoverContent align="start" :side-offset="5" class="z-[70] w-(--reka-popover-trigger-width) min-w-64 rounded-xl border border-border bg-popover p-1 text-popover-foreground shadow-lg" @open-auto-focus.prevent><div role="tree" aria-label="选择目标文件夹" class="max-h-64 overflow-auto"><Button type="button" variant="ghost" size="sm" class="h-8 w-full justify-start gap-2 px-2" :class="!modelValue&&'bg-accent text-accent-foreground'" role="treeitem" :aria-selected="!modelValue" @click="select('')"><FolderOpenIcon class="size-4 text-muted-foreground"/>工作区根目录</Button><DirectoryTreeBranch :workspace-id="workspaceId" parent="" :model-value="modelValue" @select="select"/><p v-if="!store.tree[treeKey(workspaceId,'')]?.some(entry=>entry.isDir)" class="px-8 py-3 text-xs text-muted-foreground">没有子文件夹</p></div></PopoverContent></PopoverPortal></PopoverRoot></template>
