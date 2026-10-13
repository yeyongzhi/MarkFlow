<script setup lang="ts">
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Item, ItemGroup, ItemContent, ItemTitle, ItemActions, ItemMedia } from '@/components/ui/item'
import { PencilIcon, CopyIcon, Trash2Icon } from '@lucide/vue'
import type { Template } from '@/types'
defineProps<{ templates: Template[]; builtinIds: string[]; layout: string; managing: boolean; selected: string[] }>()
const emit = defineEmits<{ edit: [template: Template]; copy: [template: Template]; remove: [template: Template]; select: [id: string, selected: boolean] }>()
</script>
<template>
  <ItemGroup aria-label="模板列表" :class="layout==='grid'?'grid gap-3 lg:grid-cols-2':'gap-2'">
    <Item v-for="t in templates" :key="t.id" as="section" role="listitem" variant="outline" size="sm" class="min-w-0 gap-3 rounded-xl p-4" :class="layout==='grid'?'flex-col items-stretch':'flex-nowrap'">
      <div class="flex min-w-0 flex-1 items-center gap-3">
        <ItemMedia v-if="managing"><input type="checkbox" :aria-label="`选择模板 ${t.name}`" :checked="selected.includes(t.id)" class="size-4 shrink-0 accent-primary" @change="emit('select',t.id,($event.target as HTMLInputElement).checked)"/></ItemMedia>
        <ItemContent class="min-w-0"><ItemTitle class="max-w-full"><h3 class="min-w-0 truncate text-sm font-medium">{{t.name}}</h3><Badge variant="outline" class="h-5 shrink-0 rounded-md px-1.5 text-[10px] font-normal" :class="builtinIds.includes(t.id)?'border-border/70 bg-muted/40 text-muted-foreground':'border-primary/20 bg-primary/10 text-primary'">{{builtinIds.includes(t.id)?'内置':'自定义'}}</Badge></ItemTitle><p v-if="layout==='list'" class="truncate text-xs text-muted-foreground">{{t.text.trim().split('\n').find(line=>line.trim())||'空白文档，不预填内容。'}}</p></ItemContent>
      </div>
      <pre v-if="layout==='grid'" class="max-h-24 overflow-auto whitespace-pre-wrap text-xs text-muted-foreground">{{t.text||'空白文档，不预填内容。'}}</pre>
      <ItemActions v-if="!managing" class="justify-end gap-1" :class="layout==='grid'?'mt-auto':''"><Button variant="ghost" size="icon-sm" :aria-label="`编辑模板 ${t.name}`" @click="emit('edit',t)"><PencilIcon/></Button><Button variant="ghost" size="icon-sm" :aria-label="`复制模板 ${t.name}`" @click="emit('copy',t)"><CopyIcon/></Button><Button variant="destructive" size="icon-sm" :aria-label="`删除模板 ${t.name}`" @click="emit('remove',t)"><Trash2Icon/></Button></ItemActions>
    </Item>
  </ItemGroup>
</template>
