<script setup lang="ts">
import { Menubar, MenubarMenu, MenubarTrigger, MenubarContent, MenubarGroup, MenubarItem, MenubarShortcut } from '@/components/ui/menubar'
import { commandMenus, type AppCommand } from '@/types/commands'
defineProps<{ commands: AppCommand[] }>()
defineEmits<{ execute: [id: string] }>()
</script>
<template>
  <Menubar aria-label="应用菜单" class="shrink-0 border-transparent bg-transparent">
    <MenubarMenu v-for="menu in commandMenus" :key="menu">
      <MenubarTrigger class="focus-visible:ring-2 focus-visible:ring-ring/50">{{ menu }}</MenubarTrigger>
      <MenubarContent class="min-w-64 rounded-xl p-1.5" :side-offset="8">
        <MenubarGroup>
          <MenubarItem v-for="command in commands.filter(c => c.menu === menu)" :key="command.id" :disabled="command.disabled" class="min-h-9 gap-3 px-2.5" @select="$emit('execute', command.id)">
            <component :is="command.icon" /><span>{{ command.label }}</span><MenubarShortcut v-if="command.shortcut">{{ command.shortcut }}</MenubarShortcut>
          </MenubarItem>
        </MenubarGroup>
      </MenubarContent>
    </MenubarMenu>
  </Menubar>
</template>
