<script setup lang="ts">
import { useWorkbench } from '@/stores/workbench'
import { Select, SelectTrigger, SelectValue, SelectContent, SelectGroup, SelectItem } from '@/components/ui/select'
import SettingsRow from './SettingsRow.vue'
const p=useWorkbench().preferences
</script><template><SettingsRow label="最近文档显示数量" description="侧栏显示指定数量，完整列表仍可从文件菜单打开。"><Select :model-value="String(p.recentLimit)" @update:model-value="p.recentLimit = Number($event)"><SelectTrigger aria-label="最近文档显示数量"><SelectValue /></SelectTrigger><SelectContent><SelectGroup><SelectItem v-for="n in [5,10,20,50,100]" :key="n" :value="String(n)">{{n}} 篇</SelectItem></SelectGroup></SelectContent></Select></SettingsRow><SettingsRow label="最近文档排序"><Select v-model="p.recentSort"><SelectTrigger aria-label="最近文档排序"><SelectValue /></SelectTrigger><SelectContent><SelectGroup><SelectItem value="opened">最近打开</SelectItem><SelectItem value="edited">最近编辑</SelectItem></SelectGroup></SelectContent></Select></SettingsRow></template>
