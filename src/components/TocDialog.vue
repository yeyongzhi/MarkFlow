<script setup lang="ts">
import { computed,ref,watch } from 'vue'
import { Button } from '@/components/ui/button'
import { Dialog,DialogContent,DialogHeader,DialogTitle,DialogDescription,DialogFooter } from '@/components/ui/dialog'
import { tableOfContents } from '@/services/markdown-extensions'
import { markdown } from '@/services/markdown'
import { frontmatter } from '@/services/frontmatter'
import { useWorkbench } from '@/stores/workbench'
import { Select, SelectTrigger, SelectValue, SelectContent, SelectGroup, SelectItem } from '@/components/ui/select'
import { toast } from 'vue-sonner'
const props=defineProps<{open:boolean}>(),emit=defineEmits<{'update:open':[boolean]}>(),store=useWorkbench(),min=ref(1),max=ref(3),snapshot=ref(''),id=ref('')
watch(()=>props.open,v=>{if(v){snapshot.value=store.active?.text||'';id.value=store.active?.id||''}})
const toc=computed(()=>tableOfContents(markdown,snapshot.value,min.value,max.value))
function apply(){const d=store.active;if(!d||d.id!==id.value||d.text!==snapshot.value){toast.error('文档已变化，请重新生成目录');return}const fm=frontmatter(d.text);if(fm.error){toast.error(fm.error);return}store.change(d,fm.prefix+'<!-- lexly-toc -->'+String.fromCharCode(10)+toc.value+String.fromCharCode(10)+'<!-- /lexly-toc -->'+String.fromCharCode(10,10)+fm.body.replace(/<!-- lexly-toc -->[\s\S]*?<!-- \/lexly-toc -->\n*/g,''),'toc');d.generation++;emit('update:open',false)}
</script><template><Dialog :open="open" @update:open="emit('update:open',$event)"><DialogContent><DialogHeader><DialogTitle>生成文档目录</DialogTitle><DialogDescription>选择标题层级，插入或更新正文开头的 Markdown 目录。</DialogDescription></DialogHeader><div class="flex gap-4 text-sm"><label class="flex items-center gap-2">起始层级<Select :model-value="String(min)" @update:model-value="min=Number($event)"><SelectTrigger aria-label="目录起始层级" class="w-24"><SelectValue/></SelectTrigger><SelectContent><SelectGroup><SelectItem v-for="n in 6" :key="n" :value="String(n)">H{{n}}</SelectItem></SelectGroup></SelectContent></Select></label><label class="flex items-center gap-2">结束层级<Select :model-value="String(max)" @update:model-value="max=Number($event)"><SelectTrigger aria-label="目录结束层级" class="w-24"><SelectValue/></SelectTrigger><SelectContent><SelectGroup><SelectItem v-for="n in 6" :key="n" :value="String(n)">H{{n}}</SelectItem></SelectGroup></SelectContent></Select></label></div><pre class="max-h-64 overflow-auto rounded-lg bg-muted p-4 text-xs">{{toc||'当前范围没有标题。'}}</pre><DialogFooter><Button variant="outline" @click="emit('update:open',false)">取消</Button><Button :disabled="!toc||min>max" @click="apply">插入 / 更新目录</Button></DialogFooter></DialogContent></Dialog></template>
