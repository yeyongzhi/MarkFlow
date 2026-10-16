<script setup lang="ts">
import { computed,ref } from 'vue'
import { useWorkbench } from '@/stores/workbench'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Dialog,DialogContent,DialogHeader,DialogTitle,DialogDescription } from '@/components/ui/dialog'
import { Item, ItemActions, ItemContent, ItemDescription, ItemTitle } from '@/components/ui/item'
import { XIcon } from '@lucide/vue'
const props=defineProps<{open:boolean}>(),emit=defineEmits<{'update:open':[boolean];close:[string]}>(),store=useWorkbench(),query=ref('')
const tabs=computed(()=>store.documents.filter(d=>d.path.toLowerCase().includes(query.value.toLowerCase())))
</script><template><Dialog :open="props.open" @update:open="emit('update:open',$event)"><DialogContent class="sm:max-w-xl"><DialogHeader><DialogTitle>已打开文档 · {{store.documents.length}}</DialogTitle><DialogDescription>搜索并切换标签，文件名后缀与完整路径均保留。</DialogDescription></DialogHeader><Input v-model="query" aria-label="搜索打开的标签" placeholder="输入文件名或路径…"/><div class="max-h-[60vh] space-y-1.5 overflow-auto"><Item v-for="d in tabs" :key="d.id" variant="outline" size="xs" class="flex-nowrap gap-2 px-3 py-1.5"><ItemContent class="min-w-0"><button class="min-w-0 w-full rounded-sm text-left outline-none focus-visible:ring-2 focus-visible:ring-ring" :title="d.path" @click="store.activate(d.id);emit('update:open',false)"><ItemTitle class="max-w-full break-all">{{d.path.split('/').pop()}}{{d.pinned?' · 固定':''}}</ItemTitle><ItemDescription class="max-w-full truncate">{{store.workspaces.find(w=>w.id===d.workspaceId)?.name}} / {{d.path}}</ItemDescription></button></ItemContent><ItemActions><Button variant="ghost" size="icon-xs" :aria-label="`关闭标签 ${d.path}`" :title="`关闭 ${d.path}`" @click="emit('close',d.id)"><XIcon /></Button></ItemActions></Item><p v-if="!tabs.length" class="py-5 text-center text-sm text-muted-foreground">没有匹配标签。</p></div></DialogContent></Dialog></template>
