<script setup lang="ts">
import { computed,ref } from 'vue'
import { useWorkbench } from '@/stores/workbench'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Dialog,DialogContent,DialogHeader,DialogTitle,DialogDescription } from '@/components/ui/dialog'
const props=defineProps<{open:boolean}>(),emit=defineEmits<{'update:open':[boolean];close:[string]}>(),store=useWorkbench(),query=ref('')
const tabs=computed(()=>store.documents.filter(d=>d.path.toLowerCase().includes(query.value.toLowerCase())))
</script><template><Dialog :open="props.open" @update:open="emit('update:open',$event)"><DialogContent class="sm:max-w-xl"><DialogHeader><DialogTitle>已打开文档 · {{store.documents.length}}</DialogTitle><DialogDescription>搜索并切换标签，文件名后缀与完整路径均保留。</DialogDescription></DialogHeader><Input v-model="query" aria-label="搜索打开的标签" placeholder="输入文件名或路径…"/><div class="max-h-[60vh] overflow-auto"><div v-for="d in tabs" :key="d.id" class="flex items-center gap-2"><Button variant="ghost" class="h-auto min-w-0 flex-1 flex-col items-start py-3" :title="d.path" @click="store.activate(d.id);emit('update:open',false)"><span class="break-all">{{d.path.split('/').pop()}}{{d.pinned?' · 固定':''}}</span><span class="max-w-full truncate text-xs text-muted-foreground">{{store.workspaces.find(w=>w.id===d.workspaceId)?.name}} / {{d.path}}</span></Button><Button variant="ghost" size="sm" :aria-label="`关闭标签 ${d.path}`" @click="emit('close',d.id)">关闭</Button></div><p v-if="!tabs.length" class="py-5 text-sm text-muted-foreground">没有匹配标签。</p></div></DialogContent></Dialog></template>
