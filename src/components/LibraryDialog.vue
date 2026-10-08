<script setup lang="ts">
import {computed,ref} from 'vue'
import {Dialog,DialogContent,DialogHeader,DialogTitle,DialogDescription} from '@/components/ui/dialog'
import {Button} from '@/components/ui/button'
import {Input} from '@/components/ui/input'
import {useWorkbench} from '@/stores/workbench'
import {fuzzy} from '@/services/writing'
import {call,message} from '@/services/api'
import type {FileRef} from '@/types'
const props=defineProps<{open:boolean;favorites?:boolean}>(),emit=defineEmits<{'update:open':[boolean]}>(),store=useWorkbench(),query=ref(''),error=ref(''),cleaning=ref(false)
const rows=computed(()=> (props.favorites?store.preferences.favorites:store.preferences.recentFiles).filter(f=>fuzzy(query.value,f.path)))
async function choose(f:FileRef){try{if(f.absolutePath)await store.openLocal([f.absolutePath]);else await store.open(f.workspaceId,f.path);emit('update:open',false)}catch(e){error.value=message(e)}}
function remove(f:FileRef){const key=props.favorites?'favorites':'recentFiles';store.preferences[key]=store.preferences[key].filter(x=>x!==f)}
async function clean(){cleaning.value=true;error.value='';try{await store.persistNow();const result=await call<{recentFiles:FileRef[];favorites:FileRef[]}>('valid_file_references');const key=props.favorites?'favorites':'recentFiles';store.preferences[key]=result[key]}catch(e){error.value=message(e)}finally{cleaning.value=false}}
</script><template><Dialog :open="open" @update:open="emit('update:open',$event)"><DialogContent class="productivity-dialog sm:max-w-xl"><DialogHeader><DialogTitle>{{favorites?'收藏文档':'最近文档'}}</DialogTitle><DialogDescription>选择文档打开；移除记录不会删除磁盘文件。</DialogDescription></DialogHeader><div class="flex items-center justify-end"><Button variant="outline" size="sm" :disabled="cleaning" @click="clean">{{cleaning?'检查中…':'清除失效记录'}}</Button></div><Input v-model="query" aria-label="筛选文档记录" placeholder="搜索文件名或路径"/><p v-if="error" role="alert" class="text-sm text-destructive">{{error}}</p><div class="flex max-h-96 flex-col gap-1 overflow-auto"><div v-for="f in rows" :key="f.workspaceId+f.path" class="flex min-w-0 items-center gap-2"><Button variant="ghost" class="h-auto min-w-0 flex-1 justify-start py-3 text-left" @click="choose(f)"><span class="min-w-0"><span class="block truncate" :title="f.path">{{f.path}}</span><small class="block truncate text-muted-foreground">{{store.workspaces.find(w=>w.id===f.workspaceId)?.name||'工作区不可用'}} · {{new Date(f.openedAt).toLocaleString()}}</small></span></Button><Button variant="ghost" size="sm" :aria-label="`移除记录 ${f.path}`" @click="remove(f)">移除</Button></div><p v-if="!rows.length" class="py-8 text-center text-sm text-muted-foreground">{{favorites?'还没有收藏文档。可在文件菜单中收藏当前文档。':'还没有最近记录。打开一份文档开始。'}}</p></div></DialogContent></Dialog></template>
