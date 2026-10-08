<script setup lang="ts">
import { ref, watch } from 'vue'
import { ImageIcon, ReplaceIcon, CopyIcon, FolderOpenIcon, Trash2Icon, XIcon, ZoomInIcon, ZoomOutIcon } from '@lucide/vue'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { FieldGroup, Field, FieldLabel } from '@/components/ui/field'
export interface SelectedImage { url: string; alt: string; src: string; unavailable: boolean; editable: boolean }
const props = defineProps<{ image?: SelectedImage; busy: boolean; readonly: boolean; desktop: boolean }>()
const emit = defineEmits<{ close: []; replace: []; describe: [value: string]; remove: []; copy: []; directory: [] }>()
const previewOpen = ref(false), descriptionOpen = ref(false), description = ref(''), zoom = ref(1), naturalWidth = ref(0), stage = ref<HTMLElement>(), fitWidth = ref(0)
watch(() => props.image, () => { previewOpen.value = false; descriptionOpen.value = false })
function openPreview() { if (!props.image || props.image.unavailable) return; zoom.value = 1; naturalWidth.value = 0; previewOpen.value = true }
function loaded(event: Event) { naturalWidth.value = (event.target as HTMLImageElement).naturalWidth; fitWidth.value = Math.min(naturalWidth.value, (stage.value?.clientWidth || 800) - 32) }
function describe() { description.value = props.image?.alt || ''; descriptionOpen.value = true }
defineExpose({ openPreview })
</script>
<template>
  <div v-if="image" class="image-tools absolute inset-x-4 bottom-4 mx-auto flex max-w-[720px] flex-col gap-2 rounded-xl border border-border bg-popover p-3 text-popover-foreground shadow-lg" role="region" aria-label="图片操作" @click.stop @paste.stop @drop.stop>
    <div class="image-tools-path flex min-w-0 flex-col gap-0.5 text-xs"><strong>{{ image.unavailable ? '图片无法显示' : (image.alt || '图片') }}</strong><span class="truncate text-muted-foreground" :title="image.url">{{ image.url }}</span></div>
    <p v-if="image.unavailable" class="text-muted-foreground text-xs">本地图片可能已移动；远程及内嵌图片默认不加载。可以重新选择本地图片修复引用。</p>
    <div class="flex flex-wrap items-center gap-1">
      <Button variant="outline" size="sm" :disabled="image.unavailable" @click="openPreview"><ImageIcon data-icon="inline-start" />查看大图</Button>
      <Button v-if="!readonly" variant="outline" size="sm" :disabled="busy || !image.editable" @click="emit('replace')"><ReplaceIcon data-icon="inline-start" />{{ image.unavailable ? '重新选择图片' : '替换' }}</Button>
      <Button v-if="!readonly" variant="ghost" size="sm" :disabled="busy || !image.editable" @click="describe">描述</Button>
      <Button variant="ghost" size="sm" @click="emit('copy')"><CopyIcon data-icon="inline-start" />复制路径</Button>
      <Button v-if="desktop" variant="ghost" size="sm" :disabled="image.unavailable" @click="emit('directory')"><FolderOpenIcon data-icon="inline-start" />所在目录</Button>
      <Button v-if="!readonly" variant="ghost" size="sm" :disabled="busy || !image.editable" @click="emit('remove')"><Trash2Icon data-icon="inline-start" />删除引用</Button>
      <Button variant="ghost" size="icon-sm" aria-label="关闭图片操作" :disabled="busy" @click="emit('close')"><XIcon /></Button>
    </div>
    <p v-if="!readonly" class="text-muted-foreground text-xs">{{ image.editable ? '删除只移除当前引用，原图片文件会保留。' : '此图片使用 HTML 或复杂语法，请在源码中编辑。' }}</p>
  </div>
  <Dialog v-model:open="previewOpen"><DialogContent class="image-preview-dialog sm:max-w-5xl" @click.stop><DialogHeader><DialogTitle>{{ image?.alt || '图片预览' }}</DialogTitle><DialogDescription class="truncate">{{ image?.url }}</DialogDescription></DialogHeader>
    <div ref="stage" class="image-preview-stage h-[min(60vh,600px)] overflow-auto rounded-xl bg-muted p-4 text-center"><img v-if="image" class="inline-block h-auto max-w-none align-top" :src="image.src" :alt="image.alt" :style="naturalWidth ? { width: (fitWidth * zoom) + 'px' } : { maxWidth: '100%' }" @load="loaded" /></div>
    <DialogFooter><div class="flex items-center gap-2"><Button variant="outline" size="icon-sm" aria-label="缩小图片" :disabled="zoom <= .25" @click="zoom = Math.max(.25, zoom - .25)"><ZoomOutIcon /></Button><span class="text-sm">{{ Math.round(zoom * 100) }}%</span><Button variant="outline" size="icon-sm" aria-label="放大图片" :disabled="zoom >= 4" @click="zoom = Math.min(4, zoom + .25)"><ZoomInIcon /></Button><Button variant="ghost" size="sm" @click="zoom = 1">适应窗口</Button><Button variant="outline" size="sm" @click="previewOpen = false">关闭预览</Button></div></DialogFooter>
  </DialogContent></Dialog>
  <Dialog v-model:open="descriptionOpen"><DialogContent @click.stop><DialogHeader><DialogTitle>图片描述</DialogTitle><DialogDescription>描述会保存在 Markdown 中，也用于图片无法显示时的替代文字。</DialogDescription></DialogHeader><form @submit.prevent="emit('describe', description); descriptionOpen = false"><FieldGroup><Field><FieldLabel for="image-description">描述</FieldLabel><Input id="image-description" v-model="description" maxlength="1000" /></Field></FieldGroup><DialogFooter class="mt-4"><Button type="button" variant="outline" @click="descriptionOpen = false">取消</Button><Button type="submit" :disabled="busy">保存描述</Button></DialogFooter></form></DialogContent></Dialog>
</template>
