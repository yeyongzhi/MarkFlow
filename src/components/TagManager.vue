<script setup lang="ts">
import { computed, shallowRef } from 'vue'
import { toast } from 'vue-sonner'
import { PlusIcon, Trash2Icon, PencilIcon, CopyIcon } from '@lucide/vue'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Item, ItemGroup, ItemMedia, ItemContent, ItemTitle, ItemActions } from '@/components/ui/item'
import { AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle, AlertDialogDescription, AlertDialogFooter, AlertDialogCancel } from '@/components/ui/alert-dialog'
import TagEditorDialog from './TagEditorDialog.vue'
import { useWorkbench } from '@/stores/workbench'
import { tagColor } from '@/services/tag-colors'
import { changeTag } from '@/services/tags'
import { message } from '@/services/api'
const emit = defineEmits<{ busy: [value: boolean] }>()
const store = useWorkbench(), query = shallowRef(''), busy = shallowRef(false), editing = shallowRef(false), original = shallowRef<string>(), error = shallowRef(''), deleting = shallowRef<string>()
const rows = computed(() => store.preferences.tags.filter(tag => tag.toLowerCase().includes(query.value.trim().toLowerCase())))
function edit(tag?: string) { original.value = tag; error.value = ''; editing.value = true }
function setBusy(value: boolean) { busy.value = value; emit('busy', value) }
async function save(name: string, color: string) {
  if (busy.value) return
  error.value = ''
  try {
    const next = name.trim(), old = original.value
    if (!next || next.length > 40 || /[\r\n\x00-\x1f]/.test(next)) throw new Error('标签名称应为 1–40 个字符。')
    if (next !== old && store.preferences.tags.includes(next)) throw new Error('标签名称已存在。')
    if (!old && store.preferences.tags.length >= 100) throw new Error('最多添加 100 个标签。')
    setBusy(true)
    if (old && next !== old) await changeTag(old, next)
    else if (!old) store.preferences.tags.push(next)
    store.preferences.tagColors[next] = color
    editing.value = false
    toast.success(old ? '标签已更新' : '标签已添加')
  } catch (e) { error.value = message(e) }
  finally { setBusy(false) }
}
async function remove() {
  if (!deleting.value || busy.value) return
  setBusy(true)
  try { await changeTag(deleting.value); deleting.value = undefined; toast.success('标签已删除') }
  catch (e) { toast.error(message(e)) }
  finally { setBusy(false) }
}
async function copy(tag: string) {
  try { await navigator.clipboard.writeText(tag); toast.success('标签已复制') }
  catch (e) { toast.error(message(e)) }
}
</script>
<template>
  <div class="flex flex-col gap-4">
    <div class="flex items-center gap-2"><Input v-model="query" aria-label="搜索标签" placeholder="搜索标签名称…" class="min-w-0 flex-1"/><Button :disabled="busy" @click="edit()"><PlusIcon/>添加</Button></div>
    <ItemGroup aria-label="标签列表">
      <Item v-for="tag in rows" :key="tag" role="listitem" size="sm" variant="outline" class="min-w-0 flex-nowrap">
        <ItemMedia><span class="size-4 shrink-0 rounded-full" :style="{backgroundColor:tagColor(store.preferences.tagColors,tag)}"/></ItemMedia>
        <ItemContent class="min-w-0"><ItemTitle class="block truncate" :title="tag">{{tag}}</ItemTitle></ItemContent>
        <ItemActions class="gap-1"><Button variant="ghost" size="icon-sm" :aria-label="`编辑标签 ${tag}`" :disabled="busy" @click="edit(tag)"><PencilIcon/></Button><Button variant="ghost" size="icon-sm" :aria-label="`复制标签 ${tag}`" :disabled="busy" @click="copy(tag)"><CopyIcon/></Button><Button variant="destructive" size="icon-sm" :aria-label="`删除标签 ${tag}`" :disabled="busy" @click="deleting=tag"><Trash2Icon/></Button></ItemActions>
      </Item>
    </ItemGroup>
    <p v-if="!rows.length" class="py-8 text-center text-sm text-muted-foreground">{{query.trim()?'没有匹配的标签。':'还没有标签。'}}</p>
    <TagEditorDialog :open="editing" :tag="original" :color="original?tagColor(store.preferences.tagColors,original):store.preferences.accent" :busy="busy" :error="error" @update:open="editing=$event" @save="save"/>
    <AlertDialog :open="!!deleting" @update:open="v=>{if(!v&&!busy)deleting=undefined}"><AlertDialogContent><AlertDialogHeader><AlertDialogTitle>删除标签“{{deleting}}”？</AlertDialogTitle><AlertDialogDescription>将从标签库及所有已添加工作区的文档中移除此标签，含归档文档。正文与其他元数据会保留。</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel :disabled="busy">取消</AlertDialogCancel><Button variant="destructive" :disabled="busy" @click="remove">{{busy?'正在更新…':'删除标签'}}</Button></AlertDialogFooter></AlertDialogContent></AlertDialog>
  </div>
</template>
