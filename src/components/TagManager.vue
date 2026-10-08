<script setup lang="ts">
import { ref } from 'vue'
import { toast } from 'vue-sonner'
import { PlusIcon, Trash2Icon, CheckIcon } from '@lucide/vue'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Field, FieldLabel, FieldDescription } from '@/components/ui/field'
import { AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle, AlertDialogDescription, AlertDialogFooter, AlertDialogCancel } from '@/components/ui/alert-dialog'
import { useWorkbench } from '@/stores/workbench'
import { changeTag } from '@/services/tags'
import { message } from '@/services/api'
const emit=defineEmits<{busy:[value:boolean]}>(),store=useWorkbench(),name=ref(''),drafts=ref<Record<string,string>>({}),busy=ref(false),deleting=ref<string>()
function validate(value:string){const text=value.trim();if(!text || text.length>40 || /[\r\n\x00-\x1f]/.test(text))throw new Error('标签名称应为 1–40 个字符。');if(store.preferences.tags.includes(text))throw new Error('标签名称已存在。');return text}
function add(){try{if(store.preferences.tags.length>=100)throw new Error('最多添加 100 个标签。');store.preferences.tags.push(validate(name.value));name.value='';toast.success('标签已添加')}catch(e){toast.error(message(e))}}
async function update(old:string,remove=false){if(busy.value)return;try{const next=remove?undefined:validate(drafts.value[old]||old);busy.value=true;emit('busy',true);const count=await changeTag(old,next);deleting.value=undefined;toast.success(remove?'标签已删除':'标签已更新',{description:`同步更新 ${count} 份文档（含归档）。`})}catch(e){toast.error(message(e))}finally{busy.value=false;emit('busy',false)}}
</script>
<template><Field><FieldLabel>标签管理</FieldLabel><FieldDescription>标签写入文档 front-matter。重命名和删除会同步更新已添加工作区中的文档（含归档），原文备份保留在应用数据目录。</FieldDescription>
  <div class="tag-settings-row"><Input v-model="name" aria-label="新标签名称" placeholder="输入标签名称" :disabled="busy" @keydown.enter.prevent="add"/><Button variant="outline" :disabled="busy" @click="add"><PlusIcon data-icon="inline-start"/>添加</Button></div>
  <div class="tag-settings-list"><div v-for="tag in store.preferences.tags" :key="tag" class="tag-settings-row"><input type="color" :value="store.preferences.tagColors[tag]||store.preferences.accent" :aria-label="`标签 ${tag} 颜色`" class="size-8 shrink-0 cursor-pointer rounded" :disabled="busy" @input="store.preferences.tagColors[tag]=($event.target as HTMLInputElement).value"/><Input :model-value="drafts[tag] ?? tag" :aria-label="`标签 ${tag} 名称`" :disabled="busy" @update:model-value="v=>drafts[tag]=String(v)" @keydown.enter.prevent="update(tag)"/><Button variant="outline" size="icon-sm" :aria-label="`保存标签 ${tag}`" title="保存标签名称" :disabled="busy || !drafts[tag] || drafts[tag]===tag" @click="update(tag)"><CheckIcon/></Button><Button variant="ghost" size="icon-sm" :aria-label="`删除标签 ${tag}`" title="删除标签" :disabled="busy" @click="deleting=tag"><Trash2Icon/></Button></div></div><p v-if="!store.preferences.tags.length" class="text-muted-foreground text-sm">还没有标签。</p>
  <AlertDialog :open="!!deleting" @update:open="v=>{if(!v&&!busy)deleting=undefined}"><AlertDialogContent><AlertDialogHeader><AlertDialogTitle>删除标签“{{ deleting }}”？</AlertDialogTitle><AlertDialogDescription>将从标签库及所有已添加工作区的文档中移除此标签，含归档文档。正文与其他元数据会保留。</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel :disabled="busy">取消</AlertDialogCancel><Button variant="destructive" :disabled="busy" @click="update(deleting!,true)">{{busy?'正在更新…':'删除标签'}}</Button></AlertDialogFooter></AlertDialogContent></AlertDialog>
</Field></template>
