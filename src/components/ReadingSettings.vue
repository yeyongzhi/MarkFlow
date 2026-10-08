<script setup lang="ts">
import { useWorkbench } from '@/stores/workbench'
import SettingsRow from './SettingsRow.vue'
import { Switch } from '@/components/ui/switch'
import { Select, SelectTrigger, SelectValue, SelectContent, SelectGroup, SelectItem } from '@/components/ui/select'
const p=useWorkbench().preferences
</script>
<template><SettingsRow label="正文显示主题" description="独立于界面主题，可使用暗色界面配亮色正文。"><Select v-model="p.bodyTheme"><SelectTrigger aria-label="正文显示主题"><SelectValue /></SelectTrigger><SelectContent><SelectGroup><SelectItem value="auto">跟随界面</SelectItem><SelectItem value="light">浅色纸张</SelectItem><SelectItem value="dark">深色纸张</SelectItem></SelectGroup></SelectContent></Select></SettingsRow><SettingsRow label="动效强度" description="系统减少动态效果设置始终优先。"><Select v-model="p.motion"><SelectTrigger aria-label="动效强度"><SelectValue /></SelectTrigger><SelectContent><SelectGroup><SelectItem value="off">关闭</SelectItem><SelectItem value="light">轻量</SelectItem><SelectItem value="standard">标准</SelectItem></SelectGroup></SelectContent></Select></SettingsRow><SettingsRow label="降低材质效果" description="低性能设备可减少模糊效果，优先保持输入流畅。"><Switch v-model="p.lowEffects" aria-label="降低材质效果"/></SettingsRow><SettingsRow label="代码自动换行"><Switch v-model="p.codeWrap" aria-label="代码自动换行"/></SettingsRow><SettingsRow label="代码块行号"><Switch v-model="p.codeNumbers" aria-label="代码块行号"/></SettingsRow><SettingsRow label="代码语法高亮"><Switch v-model="p.codeHighlight" aria-label="代码语法高亮"/></SettingsRow></template>
