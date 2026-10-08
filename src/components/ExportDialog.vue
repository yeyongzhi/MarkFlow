<script setup lang="ts">
import { reactive, ref, watch } from 'vue'
import { toast } from 'vue-sonner'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog'
import { Select, SelectTrigger, SelectValue, SelectContent, SelectGroup, SelectItem } from '@/components/ui/select'
import { Field, FieldGroup, FieldLabel, FieldDescription } from '@/components/ui/field'
import { Switch } from '@/components/ui/switch'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useWorkbench } from '@/stores/workbench'
import SettingsNumberSelect from './SettingsNumberSelect.vue'
import { exportDocument, type ExportOptions } from '@/services/export'
import { message } from '@/services/api'
import type { Document } from '@/types'
const props = defineProps<{ open: boolean; document?: Document; initialFormat?: 'html' | 'pdf' | 'zip' }>(), emit = defineEmits<{ 'update:open': [value: boolean] }>()
const format = ref<'html' | 'pdf' | 'zip'>('pdf'), busy = ref(false), options = reactive<ExportOptions>({ paper: 'a4', margin: 15, size: 16, numbers: true, font: useWorkbench().preferences.bodyFont })
const fontTouched = ref(false)
watch(() => props.open, open => { if (open) { if (props.initialFormat) format.value = props.initialFormat; if (!fontTouched.value) options.font = useWorkbench().preferences.bodyFont } })
async function save() { if (!props.document || busy.value) return; busy.value = true; const snapshot = { ...props.document }; try { if (await exportDocument(snapshot, format.value, { ...options })) { toast.success('文档导出成功'); emit('update:open', false) } } catch(e) { toast.error(message(e)) } finally { busy.value = false } }
</script>
<template><Dialog :open="open" @update:open="v => { if (!busy) emit('update:open', v) }"><DialogContent class="productivity-dialog export-dialog sm:max-w-lg" @interact-outside="e => { if (busy) e.preventDefault() }" @escape-key-down="e => { if (busy) e.preventDefault() }"><DialogHeader><DialogTitle>导出文档</DialogTitle><DialogDescription>导出当前内容，包括尚未保存的修改与本地图片。</DialogDescription></DialogHeader><FieldGroup>
  <Field><FieldLabel>导出格式</FieldLabel><Select v-model="format"><SelectTrigger aria-label="导出格式"><SelectValue /></SelectTrigger><SelectContent><SelectGroup><SelectItem value="pdf">PDF 文档</SelectItem><SelectItem value="html">独立 HTML 页面</SelectItem><SelectItem value="zip">Markdown 与图片 ZIP</SelectItem></SelectGroup></SelectContent></Select></Field>
  <template v-if="format === 'pdf'"><Field><FieldLabel>纸张</FieldLabel><Select v-model="options.paper"><SelectTrigger aria-label="导出纸张"><SelectValue /></SelectTrigger><SelectContent><SelectGroup><SelectItem value="a4">A4</SelectItem><SelectItem value="letter">Letter</SelectItem></SelectGroup></SelectContent></Select></Field><Field><FieldLabel>页边距（mm）</FieldLabel><SettingsNumberSelect v-model="options.margin" :min="5" :max="30" :presets="[{value:10,label:'窄'},{value:15,label:'标准'},{value:20,label:'宽'}]" label="导出页边距" unit="mm" /></Field><Field orientation="horizontal"><FieldLabel for="export-page-numbers">显示页码</FieldLabel><Switch id="export-page-numbers" v-model="options.numbers" /></Field><FieldDescription>PDF 保留屏幕排版与中文字体，以高清图像分页输出；文字不可选中复制。</FieldDescription></template>
  <Field v-if="format !== 'zip'"><FieldLabel for="export-font">导出字体</FieldLabel><Input id="export-font" v-model="options.font" @update:model-value="fontTouched = true" /><FieldDescription>使用已安装的系统字体，未安装时自动回退。</FieldDescription></Field>
  <Field v-if="format !== 'zip'"><FieldLabel>导出字号</FieldLabel><SettingsNumberSelect v-model="options.size" :min="10" :max="24" :presets="[{value:14,label:'小'},{value:16,label:'标准'},{value:18,label:'大'}]" label="导出字号" /></Field>
  <FieldDescription v-if="format === 'zip'">保留工作区内的相对目录结构。缺失或不允许访问的图片会阻止导出，避免生成不完整副本。</FieldDescription>
</FieldGroup><DialogFooter><Button variant="outline" :disabled="busy" @click="emit('update:open',false)">取消</Button><Button :disabled="busy || !document" @click="save">{{ busy ? '正在导出…' : '导出' }}</Button></DialogFooter></DialogContent></Dialog></template>
