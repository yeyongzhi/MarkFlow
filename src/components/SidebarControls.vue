<script setup lang="ts">
import { CheckIcon, MonitorIcon, MoonIcon, PanelLeftCloseIcon, PanelLeftOpenIcon, SettingsIcon, SunIcon, Trash2Icon } from '@lucide/vue'
import { Button } from '@/components/ui/button'
import { DropdownMenu, DropdownMenuContent, DropdownMenuGroup, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import type { Preferences } from '@/types'

const props = withDefaults(defineProps<{ collapsed?: boolean; compact?: boolean; mode?: Preferences['mode']; dark?: boolean }>(), { mode: 'system' })
defineEmits<{ toggle: []; archives: []; settings: []; theme: [mode: Preferences['mode']] }>()
const modes = [{ value: 'light', label: '亮色', icon: SunIcon }, { value: 'dark', label: '暗色', icon: MoonIcon }, { value: 'system', label: '跟随系统', icon: MonitorIcon }] as const
const size = () => (props.compact ? 'icon-sm' : 'icon')
</script>

<template>
  <div class="sidebar-controls flex items-center gap-1" :data-collapsed="!!collapsed" role="toolbar" aria-label="侧栏操作">
    <Tooltip>
      <TooltipTrigger as-child>
        <Button variant="ghost" :size="size()" aria-label="切换左侧栏" @click="$emit('toggle')">
          <component :is="collapsed ? PanelLeftOpenIcon : PanelLeftCloseIcon" />
        </Button>
      </TooltipTrigger>
      <TooltipContent :side="collapsed ? 'right' : 'top'">{{ collapsed ? '显示工作区侧栏' : '隐藏工作区侧栏' }}</TooltipContent>
    </Tooltip>
    <Tooltip v-if="!collapsed"><TooltipTrigger as-child><Button variant="ghost" :size="size()" aria-label="回收站" @click="$emit('archives')"><Trash2Icon /></Button></TooltipTrigger><TooltipContent side="top">工作区回收站</TooltipContent></Tooltip>
    <Tooltip v-if="!collapsed">
      <TooltipTrigger as-child>
        <span class="inline-flex">
          <DropdownMenu>
            <DropdownMenuTrigger as-child><Button variant="ghost" :size="size()" aria-label="切换主题"><MonitorIcon v-if="mode === 'system'" /><MoonIcon v-else-if="dark" /><SunIcon v-else /></Button></DropdownMenuTrigger>
            <DropdownMenuContent align="end" class="min-w-40"><DropdownMenuGroup><DropdownMenuItem v-for="option in modes" :key="option.value" @select="$emit('theme', option.value)"><component :is="option.icon" />{{ option.label }}<CheckIcon v-if="mode === option.value" class="ml-auto" /></DropdownMenuItem></DropdownMenuGroup></DropdownMenuContent>
          </DropdownMenu>
        </span>
      </TooltipTrigger>
      <TooltipContent side="top">切换主题</TooltipContent>
    </Tooltip>
    <Tooltip v-if="!collapsed">
      <TooltipTrigger as-child>
        <Button variant="ghost" :size="size()" aria-label="设置" @click="$emit('settings')"><SettingsIcon /></Button>
      </TooltipTrigger>
      <TooltipContent side="top">设置 · Ctrl/Cmd+,</TooltipContent>
    </Tooltip>
  </div>
</template>
