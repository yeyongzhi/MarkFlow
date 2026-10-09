<script setup lang="ts">
import { computed,onMounted,ref } from 'vue'
import AppUpdater from './AppUpdater.vue'
import { toast } from 'vue-sonner'
import SettingsRow from './SettingsRow.vue'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'
import { Select,SelectTrigger,SelectValue,SelectContent,SelectGroup,SelectItem } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { Field,FieldGroup,FieldLabel } from '@/components/ui/field'
import { useWorkbench } from '@/stores/workbench'
import { call,message } from '@/services/api'
import { toolbarItems } from '@/services/writing'
defineProps<{section:string}>()
const store=useWorkbench(),p=computed(()=>store.preferences),templateName=ref(''),templateBody=ref(''),error=ref(''),dataDir=ref('')
onMounted(async()=>{try{dataDir.value=await call<string>('data_directory')}catch{dataDir.value='当前环境未提供数据目录'}})
const order=computed(()=>[...p.value.toolbarOrder,...toolbarItems.map(t=>t.id)].filter((id,i,a)=>a.indexOf(id)===i&&toolbarItems.some(t=>t.id===id)))
function move(id:string,delta:number){const ids=[...order.value],i=ids.indexOf(id),to=i+delta;if(to<0||to>=ids.length)return;ids.splice(i,1);ids.splice(to,0,id);p.value.toolbarOrder=ids}
async function chooseBackup(){try{const path=await call<string|null>('choose_backup_directory');if(path)p.value.backupDirectory=path}catch(e){error.value=message(e)}}
function addTemplate(){if(!templateName.value.trim()||!templateBody.value.trim()){error.value='请填写模板名称和内容。';return}if(p.value.templates.length>=30||templateBody.value.length>32000||p.value.templates.reduce((n,t)=>n+t.text.length,0)+templateBody.value.length>256000){error.value='最多 30 个模板，每个不超过 32K 字符，总计不超过 256K 字符。';return}p.value.templates.push({id:crypto.randomUUID(),name:templateName.value.trim(),text:templateBody.value});templateName.value='';templateBody.value='';error.value='';toast.success('模板已添加')}
</script>
<template><p v-if="error" role="alert" class="text-sm text-destructive">{{error}}</p><template v-if="section==='safety'">
<SettingsRow label="自动保存" description="停止输入后保存修改；关闭后仍会保护恢复草稿。"><Switch v-model="p.autoSave" aria-label="自动保存"/></SettingsRow>
<SettingsRow label="自动保存延迟" description="单位毫秒，可设置 200–30000。"><Input type="number" v-model.number="p.autoSaveDelay" min="200" max="30000" aria-label="自动保存延迟" class="w-32"/></SettingsRow>
<SettingsRow label="失焦保存" description="切换文档或应用失去焦点时保存。"><Switch v-model="p.saveOnBlur" aria-label="失焦保存"/></SettingsRow>
<SettingsRow label="关闭前保存" description="关闭前保存；关闭此项后会提示如何处理未保存内容。"><Switch v-model="p.saveOnClose" aria-label="关闭前保存"/></SettingsRow>
<SettingsRow label="历史版本保留数量" description="每个文档保留最近的 10–500 个版本。"><Input type="number" v-model.number="p.historyRetention" min="10" max="500" aria-label="历史版本保留数量" class="w-32"/></SettingsRow>
<SettingsRow label="数据目录" description="设置项、历史版本、工作区注册表与操作备份均存放在此，正文仍是工作区里的 .md。"><div class="flex max-w-72 flex-col gap-2"><span class="break-all text-xs text-muted-foreground">{{dataDir}}</span><Button variant="outline" @click="call('open_data_directory').catch(e=>error=message(e))">打开数据目录</Button></div></SettingsRow>
<SettingsRow label="工作区备份目录" description="备份包含 Markdown 与附件；默认保存在应用数据目录。"><div class="flex max-w-72 flex-col gap-2"><span class="break-all text-xs text-muted-foreground">{{p.backupDirectory||'应用数据目录'}}</span><Button variant="outline" @click="chooseBackup">选择备份目录</Button></div></SettingsRow>
<SettingsRow label="备份保留数量"><Input type="number" v-model.number="p.backupRetention" min="1" max="100" aria-label="备份保留数量" class="w-32"/></SettingsRow>
<SettingsRow label="定期备份" description="应用运行时执行；备份前保存文档，失败时保留提示。"><Select v-model="p.backupInterval"><SelectTrigger aria-label="定期备份" class="w-40"><SelectValue/></SelectTrigger><SelectContent><SelectGroup><SelectItem :value="0">仅手动备份</SelectItem><SelectItem :value="15">每 15 分钟</SelectItem><SelectItem :value="60">每小时</SelectItem><SelectItem :value="1440">每天</SelectItem></SelectGroup></SelectContent></Select></SettingsRow>
</template><template v-if="section==='writing'">
<SettingsRow label="打字机滚动" description="让当前输入行保持在设置的位置。"><Switch v-model="p.typewriter" aria-label="打字机滚动"/></SettingsRow>
<SettingsRow label="打字机位置" description="输入行距编辑区顶部的百分比。"><Input type="number" v-model.number="p.typewriterPosition" min="20" max="80" aria-label="打字机位置" class="w-32"/></SettingsRow>
<SettingsRow label="Markdown 语法补全" description="补齐成对括号、引号、代码围栏；列表自动续写。"><Switch v-model="p.syntaxAssist" aria-label="Markdown 语法补全"/></SettingsRow>
<SettingsRow label="斜杠命令" description="在空行输入 /，选择标题、表格、图片、代码块等。"><Switch v-model="p.slashCommands" aria-label="斜杠命令"/></SettingsRow>
<SettingsRow label="自动定位当前文档" description="打开文档时展开文件树并定位。"><Switch v-model="p.autoReveal" aria-label="自动定位当前文档"/></SettingsRow>
<FieldGroup class="py-5"><Field><FieldLabel for="template-name">自定义模板名称</FieldLabel><Input id="template-name" v-model="templateName" maxlength="60"/></Field><Field><FieldLabel for="template-body">模板 Markdown</FieldLabel><Textarea id="template-body" v-model="templateBody" placeholder="支持 {{date}} 和 {{title}} 占位符" class="min-h-36 font-mono"/></Field><Button @click="addTemplate">保存模板</Button><div v-for="t in p.templates" :key="t.id" class="flex items-center justify-between gap-3 rounded-lg border p-3"><span class="truncate" :title="t.name">{{t.name}}</span><Button variant="ghost" :aria-label="`删除模板 ${t.name}`" @click="p.templates=p.templates.filter(x=>x.id!==t.id)">删除</Button></div></FieldGroup>
</template><template v-if="section==='desktop'"><SettingsRow label="关闭到系统托盘" description="关闭按钮隐藏窗口；托盘菜单可显示窗口或保存后退出。"><Switch v-model="p.closeToTray" aria-label="关闭到系统托盘"/></SettingsRow></template><template v-if="section==='about'"><AppUpdater/></template><template v-if="section==='toolbar'"><p class="py-3 text-sm text-muted-foreground">控制格式按钮的顺序和显示。窗口空间不足时会自动折叠为菜单。</p><div v-for="id in order" :key="id" class="flex items-center justify-between gap-3 border-b py-3"><span>{{toolbarItems.find(t=>t.id===id)?.label}}</span><div class="flex items-center gap-2"><Button variant="ghost" size="sm" :disabled="order[0]===id" :aria-label="`上移工具 ${id}`" @click="move(id,-1)">上移</Button><Button variant="ghost" size="sm" :disabled="order.at(-1)===id" :aria-label="`下移工具 ${id}`" @click="move(id,1)">下移</Button><Switch :model-value="!p.toolbarHidden.includes(id)" :aria-label="`显示工具 ${id}`" @update:model-value="v=>p.toolbarHidden=v?p.toolbarHidden.filter(x=>x!==id):[...p.toolbarHidden,id]"/></div></div><Button variant="outline" class="mt-4" @click="p.toolbarOrder=[];p.toolbarHidden=[]">恢复默认工具栏</Button></template></template>
