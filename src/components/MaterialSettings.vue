<script setup lang="ts">
import { computed } from 'vue'
import { Select, SelectTrigger, SelectValue, SelectContent, SelectGroup, SelectItem } from '@/components/ui/select'
import SettingsRow from './SettingsRow.vue'
import { useWorkbench } from '@/stores/workbench'
const store=useWorkbench(), p=computed(()=>store.preferences)
</script>
<template>
  <SettingsRow label="界面材质" description="即时应用到侧栏、编辑面板和弹窗；正文保持清晰">
    <Select v-model="p.material"><SelectTrigger aria-label="界面材质"><SelectValue /></SelectTrigger><SelectContent><SelectGroup><SelectItem value="solid">简洁 · 实色</SelectItem><SelectItem value="soft">柔和 · 层次</SelectItem><SelectItem value="glass">毛玻璃 · 通透</SelectItem></SelectGroup></SelectContent></Select>
  </SettingsRow>
  <SettingsRow label="界面圆角" description="调整面板、标签和控件的圆角大小">
    <Select v-model="p.cornerRadius"><SelectTrigger aria-label="界面圆角"><SelectValue /></SelectTrigger><SelectContent><SelectGroup><SelectItem :value="0">利落 · 直角</SelectItem><SelectItem :value="8">轻微 · 8px</SelectItem><SelectItem :value="12">柔和 · 12px</SelectItem><SelectItem :value="18">圆润 · 18px</SelectItem></SelectGroup></SelectContent></Select>
  </SettingsRow>
  <SettingsRow v-if="p.material==='glass'" label="毛玻璃模糊" description="仅模糊面板背后的界面背景，不模糊正文；不透出桌面内容">
    <Select v-model="p.glassBlur"><SelectTrigger aria-label="毛玻璃模糊"><SelectValue /></SelectTrigger><SelectContent><SelectGroup><SelectItem :value="10">轻盈</SelectItem><SelectItem :value="18">标准</SelectItem><SelectItem :value="26">柔雾</SelectItem></SelectGroup></SelectContent></Select>
  </SettingsRow>
</template>
