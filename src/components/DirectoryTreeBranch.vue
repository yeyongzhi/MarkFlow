<script setup lang="ts">
import { computed } from 'vue'
import { ChevronRightIcon, FolderIcon, FolderOpenIcon } from '@lucide/vue'
import { Button } from '@/components/ui/button'
import { useWorkbench, treeKey } from '@/stores/workbench'

defineOptions({name:'DirectoryTreeBranch'})
const props=defineProps<{workspaceId:string;parent:string;modelValue:string}>(),emit=defineEmits<{select:[path:string]}>(),store=useWorkbench()
const key=computed(()=>treeKey(props.workspaceId,props.parent)),entries=computed(()=>store.tree[key.value]?.filter(entry=>entry.isDir)||[])
function entryExpanded(path:string){return !!store.expanded[treeKey(props.workspaceId,path)]}
async function toggle(path:string){try{await store.toggleDirectory(props.workspaceId,path)}catch{}}
</script>
<template><div v-for="entry in entries" :key="entry.path" class="directory-tree-node"><div class="flex min-w-0 items-center gap-1"><Button type="button" variant="ghost" size="icon-xs" class="shrink-0 text-muted-foreground" :aria-label="`${entryExpanded(entry.path)?'折叠':'展开'} ${entry.name}`" @click="toggle(entry.path)"><ChevronRightIcon class="size-3 transition-transform" :class="entryExpanded(entry.path)&&'rotate-90'"/></Button><Button type="button" variant="ghost" size="sm" class="h-8 min-w-0 flex-1 justify-start gap-2 truncate px-2" :class="modelValue===entry.path&&'bg-accent text-accent-foreground'" role="treeitem" :aria-selected="modelValue===entry.path" @click="emit('select',entry.path)"><component :is="entryExpanded(entry.path)?FolderOpenIcon:FolderIcon" class="size-4 shrink-0 text-muted-foreground"/><span class="truncate">{{entry.name}}</span></Button></div><div v-if="entryExpanded(entry.path)" role="group" class="ml-4 border-l border-border pl-1"><DirectoryTreeBranch :workspace-id="workspaceId" :parent="entry.path" :model-value="modelValue" @select="emit('select',$event)"/></div></div></template>
