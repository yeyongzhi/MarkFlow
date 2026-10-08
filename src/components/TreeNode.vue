<script setup lang="ts">
import { computed, ref } from 'vue'
import { StarIcon, ChevronRightIcon, FolderIcon, FolderOpenIcon, FileTextIcon, MoreHorizontalIcon, FilePlusIcon, FolderPlusIcon, PencilIcon, FolderInputIcon, Trash2Icon, ArchiveIcon, FolderMinusIcon, FolderSearchIcon } from '@lucide/vue'
import { Button } from '@/components/ui/button'
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuGroup, DropdownMenuItem, DropdownMenuSeparator } from '@/components/ui/dropdown-menu'
import { useWorkbench, treeKey } from '@/stores/workbench'
import { cn } from '@/lib/utils'
import type { Entry, Workspace } from '@/types'
const props = defineProps<{ workspace: Workspace; entry: Entry; depth?: number; root?: boolean }>()
const emit = defineEmits<{ action: [type: string, workspaceId: string, path: string, isDir: boolean]; error: [error: unknown] }>()
const store = useWorkbench(), key = computed(() => treeKey(props.workspace.id, props.entry.path)), expanded = computed(() => store.expanded[key.value]), children = computed(() => store.tree[key.value] || [])
const visibleCount = ref(80)
const visibleChildren = computed(() => { const activeIndex = children.value.findIndex(e => store.active?.workspaceId === props.workspace.id && store.active.path.startsWith(e.path + (e.isDir ? '/' : ''))); return children.value.slice(0, Math.max(visibleCount.value, activeIndex + 1)) })
async function activate() { try { if (props.entry.isDir) await store.toggleDirectory(props.workspace.id, props.entry.path); else await store.open(props.workspace.id, props.entry.path) } catch(e) { emit('error', e) } }
function keydown(event: KeyboardEvent) {
  if (!['ArrowDown','ArrowUp','ArrowRight','ArrowLeft','Home','End'].includes(event.key)) return
  event.preventDefault()
  const labels = Array.from(document.querySelectorAll<HTMLButtonElement>('.file-tree .tree-label')).filter(el => el.offsetHeight), index = labels.indexOf(event.currentTarget as HTMLButtonElement)
  if (event.key === 'ArrowRight' && props.entry.isDir && !expanded.value || event.key === 'ArrowLeft' && props.entry.isDir && expanded.value) { void activate(); return }
  const next = event.key === 'Home' ? 0 : event.key === 'End' ? labels.length-1 : index + (event.key === 'ArrowUp' || event.key === 'ArrowLeft' ? -1 : 1)
  labels[Math.max(0,Math.min(labels.length-1,next))]?.focus()
}
const favorite=computed(()=>store.preferences.favorites.some(f=>f.workspaceId===props.workspace.id&&f.path===props.entry.path))
function action(type: string) { emit('action', type, props.workspace.id, props.entry.path, props.entry.isDir) }
</script>
<template>
  <div role="treeitem" :aria-expanded="entry.isDir ? !!expanded : undefined" :aria-selected="!entry.isDir && store.active?.workspaceId === workspace.id && store.active?.path === entry.path">
    <div :class="cn('tree-row group mb-0.5 flex min-h-9 items-center rounded-lg pr-1 transition-colors hover:bg-muted', root && 'workspace-row mb-1 mt-3 font-medium', !entry.isDir && store.active?.workspaceId === workspace.id && store.active.path === entry.path && 'tree-row-active bg-accent text-accent-foreground')" :style="{ paddingLeft: `${12 + (depth || 0) * 16}px` }">
      <button class="tree-label flex min-w-0 flex-1 items-center gap-2 py-2 text-left text-xs" @keydown="keydown" :title="root ? workspace.path : entry.path" @click="activate">
        <ChevronRightIcon v-if="entry.isDir" :class="cn('tree-chevron size-3 shrink-0 text-muted-foreground transition-transform duration-150', expanded && 'rotate-90')" />
        <span v-else class="w-3 shrink-0" />
        <component :is="entry.isDir ? expanded ? FolderOpenIcon : FolderIcon : FileTextIcon" :class="cn('tree-icon size-4 shrink-0 text-muted-foreground', root && 'text-primary', !entry.isDir && store.active?.path === entry.path && store.active?.workspaceId === workspace.id && 'text-accent-foreground')" />
        <span class="truncate">{{ entry.name }}</span>
        <span v-if="root && !workspace.available" class="text-xs text-destructive">不可访问</span>
      </button>
      <DropdownMenu>
        <DropdownMenuTrigger as-child><Button variant="ghost" size="icon-xs" class="tree-menu opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100" :aria-label="`${entry.name} 的菜单`"><MoreHorizontalIcon /></Button></DropdownMenuTrigger>
        <DropdownMenuContent align="start" class="min-w-48">
          <DropdownMenuGroup>
            <DropdownMenuItem v-if="entry.isDir" @select="action('file')"><FilePlusIcon />新建文档</DropdownMenuItem>
            <DropdownMenuItem v-if="entry.isDir" @select="action('folder')"><FolderPlusIcon />新建文件夹</DropdownMenuItem>
            <DropdownMenuItem v-if="!entry.isDir" @select="store.favorite({workspaceId:workspace.id,path:entry.path})"><StarIcon :class="cn(favorite && 'fill-current')" />{{favorite?'取消收藏':'收藏文档'}}</DropdownMenuItem>
            <DropdownMenuItem v-if="!root" @select="action('rename')"><PencilIcon />重命名</DropdownMenuItem>
            <DropdownMenuItem v-if="!root" @select="action('move')"><FolderInputIcon />移动到…</DropdownMenuItem>
            <DropdownMenuItem @select="action('open-system')"><FolderSearchIcon />在系统目录中打开</DropdownMenuItem>
          </DropdownMenuGroup>
          <DropdownMenuSeparator />
          <DropdownMenuGroup>
            <DropdownMenuItem v-if="root && !workspace.available" @select="action('reconnect')">重新选择工作区目录</DropdownMenuItem><DropdownMenuItem v-if="root" variant="destructive" @select="action('remove')"><FolderMinusIcon />移除工作区</DropdownMenuItem>
            <DropdownMenuItem v-else-if="entry.isDir" variant="destructive" @select="action('trash')"><Trash2Icon />移到回收站</DropdownMenuItem>
            <DropdownMenuItem v-else @select="action('archive')"><ArchiveIcon />归档</DropdownMenuItem>
          </DropdownMenuGroup>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
    <div v-if="entry.isDir && expanded" role="group">
      <TreeNode v-for="child in visibleChildren" :key="child.path" :workspace="workspace" :entry="child" :depth="(depth || 0) + 1" @action="(...args) => emit('action', ...args)" @error="e => emit('error', e)" />
      <Button v-if="visibleChildren.length < children.length" variant="ghost" size="sm" class="ml-6" @click="visibleCount += 80">显示更多（剩余 {{ children.length-visibleChildren.length }}）</Button>
      <p v-if="!children.length" class="py-2 text-xs text-muted-foreground" :style="{ paddingLeft: `${40 + (depth || 0) * 16}px` }">空文件夹</p>
    </div>
  </div>
</template>
