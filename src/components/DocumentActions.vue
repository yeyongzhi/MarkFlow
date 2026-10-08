<script setup lang="ts">
import { StarIcon, SearchIcon, MaximizeIcon, DownloadIcon, TableIcon, SquareCodeIcon, MoreHorizontalIcon, PanelRightIcon, CodeXmlIcon, FileTextIcon, InfoIcon, FolderSearchIcon } from '@lucide/vue'
import { Button } from '@/components/ui/button'
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuGroup, DropdownMenuItem, DropdownMenuSeparator } from '@/components/ui/dropdown-menu'
defineProps<{ outline: boolean; focus: boolean; favorite: boolean }>()
defineEmits<{ toc: []; knowledge: []; favorite: []; find: []; search: []; quick: []; export: []; focus: []; table: []; code: []; toggleOutline: []; copy: [format: 'markdown' | 'text']; info: []; openDirectory: [] }>()
</script>

<template>
  <DropdownMenu>
    <DropdownMenuTrigger as-child><Button variant="ghost" size="icon-sm" aria-label="文章操作" title="更多文章操作"><MoreHorizontalIcon /></Button></DropdownMenuTrigger>
    <DropdownMenuContent align="end" class="min-w-52">
      <DropdownMenuGroup>
        <DropdownMenuItem @select="$emit('favorite')"><StarIcon :class="favorite && 'fill-current'" />{{favorite?'取消收藏':'收藏文档'}}</DropdownMenuItem>
        <DropdownMenuItem @select="$emit('find')"><SearchIcon />查找与替换 <span class="ml-auto text-muted-foreground text-xs">Ctrl/Cmd+F</span></DropdownMenuItem>
        <DropdownMenuItem @select="$emit('search')"><SearchIcon />工作区搜索</DropdownMenuItem>
        <DropdownMenuItem @select="$emit('quick')"><FileTextIcon />快速打开文档</DropdownMenuItem>
        <DropdownMenuItem @select="$emit('focus')"><MaximizeIcon />{{ focus ? '退出专注模式' : '进入专注模式' }}</DropdownMenuItem>
        <DropdownMenuItem @select="$emit('table')"><TableIcon />编辑表格</DropdownMenuItem>
        <DropdownMenuItem @select="$emit('toc')"><FileTextIcon/>生成文档目录</DropdownMenuItem><DropdownMenuItem @select="$emit('knowledge')"><FileTextIcon/>文档链接与标签</DropdownMenuItem><DropdownMenuItem @select="$emit('code')"><SquareCodeIcon />编辑代码块</DropdownMenuItem>
        <DropdownMenuItem @select="$emit('export')"><DownloadIcon />导出文档</DropdownMenuItem>
      </DropdownMenuGroup><DropdownMenuSeparator />
      <DropdownMenuGroup>
        <DropdownMenuItem @select="$emit('toggleOutline')"><PanelRightIcon />{{ outline ? '隐藏文档大纲' : '显示文档大纲' }}</DropdownMenuItem>
      </DropdownMenuGroup>
      <DropdownMenuSeparator />
      <DropdownMenuGroup>
        <DropdownMenuItem @select="$emit('copy', 'markdown')"><CodeXmlIcon />复制 Markdown 源码</DropdownMenuItem>
        <DropdownMenuItem @select="$emit('copy', 'text')"><FileTextIcon />复制纯文本</DropdownMenuItem>
      </DropdownMenuGroup>
      <DropdownMenuSeparator />
      <DropdownMenuGroup>
        <DropdownMenuItem @select="$emit('info')"><InfoIcon />查看文章信息</DropdownMenuItem>
        <DropdownMenuItem @select="$emit('openDirectory')"><FolderSearchIcon />打开系统目录位置</DropdownMenuItem>
      </DropdownMenuGroup>
    </DropdownMenuContent>
  </DropdownMenu>
</template>
