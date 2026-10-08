<script setup lang="ts">
import { XIcon, ListXIcon, CircleXIcon, StarIcon } from '@lucide/vue'
import { cn } from '@/lib/utils'
import { ContextMenu, ContextMenuTrigger, ContextMenuContent, ContextMenuGroup, ContextMenuItem, ContextMenuSeparator } from '@/components/ui/context-menu'
defineProps<{ others: boolean; left?:boolean; right?:boolean; pinned?: boolean; favorite?: boolean }>()
defineEmits<{ pin: []; favorite: []; close: [scope: 'current' | 'others' | 'all' | 'left' | 'right'] }>()
</script>
<template>
  <ContextMenu>
    <ContextMenuTrigger as-child><slot /></ContextMenuTrigger>
    <ContextMenuContent class="min-w-44">
      <ContextMenuGroup>
        <ContextMenuItem @select="$emit('pin')">{{pinned?'取消固定':'固定标签'}}</ContextMenuItem><ContextMenuItem @select="$emit('favorite')"><StarIcon :class="cn(favorite && 'fill-current')" />{{favorite?'取消收藏':'收藏文档'}}</ContextMenuItem><ContextMenuItem @select="$emit('close', 'current')"><XIcon />关闭当前</ContextMenuItem>
        <ContextMenuItem :disabled="!others" @select="$emit('close', 'others')"><ListXIcon />关闭其他</ContextMenuItem>
        <ContextMenuItem :disabled="!left" @select="$emit('close','left')">关闭左侧标签</ContextMenuItem><ContextMenuItem :disabled="!right" @select="$emit('close','right')">关闭右侧标签</ContextMenuItem><ContextMenuSeparator />
        <ContextMenuItem @select="$emit('close', 'all')"><CircleXIcon />关闭全部</ContextMenuItem>
      </ContextMenuGroup>
    </ContextMenuContent>
  </ContextMenu>
</template>
