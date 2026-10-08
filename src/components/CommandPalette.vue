<script setup lang="ts">
import { CommandDialog, CommandInput, CommandList, CommandEmpty, CommandGroup, CommandItem, CommandShortcut } from '@/components/ui/command'
import { commandMenus, type AppCommand } from '@/types/commands'
defineProps<{ open: boolean; commands: AppCommand[] }>()
defineEmits<{ 'update:open': [value: boolean]; execute: [id: string] }>()
</script>
<template>
  <CommandDialog :open="open" title="搜索命令" description="搜索并执行 MarkFlow 的功能。使用方向键选择，Enter 执行，Esc 关闭。" class="sm:max-w-xl" @update:open="$emit('update:open', $event)">
    <CommandInput placeholder="搜索功能，例如：分屏、导出、主题…" aria-label="搜索命令" />
    <CommandList class="max-h-[min(420px,55vh)] p-1"><CommandEmpty>没有找到匹配的命令。</CommandEmpty>
      <CommandGroup v-for="menu in commandMenus" :key="menu" :heading="menu">
        <CommandItem v-for="command in commands.filter(c => c.menu === menu)" :key="command.id" :value="command.id" :disabled="command.disabled" class="min-h-10 gap-3 px-3" @select="$emit('execute', command.id)"><component :is="command.icon" /><span>{{ command.label }}</span><CommandShortcut v-if="command.shortcut">{{ command.shortcut }}</CommandShortcut></CommandItem>
      </CommandGroup>
    </CommandList>
    <div class="flex items-center justify-between px-4 py-3 text-xs text-muted-foreground"><span>↑ ↓ 选择 · Enter 执行</span><span>Esc 关闭</span></div>
  </CommandDialog>
</template>
