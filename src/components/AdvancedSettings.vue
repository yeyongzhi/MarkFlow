<script setup lang="ts">
import { computed,onMounted,ref } from 'vue'
import TemplateManager from './TemplateManager.vue'
import AppUpdater from './AppUpdater.vue'
import SettingsRow from './SettingsRow.vue'
import SettingsSection from './SettingsSection.vue'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'
import { Select,SelectTrigger,SelectValue,SelectContent,SelectGroup,SelectItem } from '@/components/ui/select'
import { useWorkbench } from '@/stores/workbench'
import { call,message } from '@/services/api'
defineProps<{section:string}>()
const store=useWorkbench(),p=computed(()=>store.preferences),error=ref(''),dataDir=ref('')
onMounted(async()=>{try{dataDir.value=await call<string>('data_directory')}catch{dataDir.value='当前环境未提供数据目录'}})
async function chooseBackup(){try{const path=await call<string|null>('choose_backup_directory');if(path)p.value.backupDirectory=path}catch(e){error.value=message(e)}}

</script>
<template><p v-if="error" role="alert" class="text-sm text-destructive">{{error}}</p><template v-if="section==='safety'">
<SettingsSection title="保存策略"><SettingsRow label="自动保存" description="停止输入后保存修改；关闭后仍会保护恢复草稿。"><Switch v-model="p.autoSave" aria-label="自动保存"/></SettingsRow>
<SettingsRow label="自动保存延迟" description="单位毫秒，可设置 200–30000。"><Input type="number" v-model.number="p.autoSaveDelay" min="200" max="30000" aria-label="自动保存延迟" class="w-32"/></SettingsRow>
<SettingsRow label="失焦保存" description="切换文档或应用失去焦点时保存。"><Switch v-model="p.saveOnBlur" aria-label="失焦保存"/></SettingsRow>
<SettingsRow label="关闭前保存" description="关闭前保存；关闭此项后会提示如何处理未保存内容。"><Switch v-model="p.saveOnClose" aria-label="关闭前保存"/></SettingsRow>
</SettingsSection><SettingsSection title="历史版本与数据"><SettingsRow label="历史版本保留数量" description="每个文档保留最近的 10–500 个版本。"><Input type="number" v-model.number="p.historyRetention" min="10" max="500" aria-label="历史版本保留数量" class="w-32"/></SettingsRow>
<SettingsRow label="数据目录" description="设置项、历史版本、工作区注册表与操作备份均存放在此，正文仍是工作区里的 .md。"><div class="flex max-w-72 flex-col gap-2"><span class="break-all text-xs text-muted-foreground">{{dataDir}}</span><Button variant="outline" @click="call('open_data_directory').catch(e=>error=message(e))">打开数据目录</Button></div></SettingsRow>
</SettingsSection><SettingsSection title="工作区备份"><SettingsRow label="工作区备份目录" description="备份包含 Markdown 与附件；默认保存在应用数据目录。"><div class="flex max-w-72 flex-col gap-2"><span class="break-all text-xs text-muted-foreground">{{p.backupDirectory||'应用数据目录'}}</span><Button variant="outline" @click="chooseBackup">选择备份目录</Button></div></SettingsRow>
<SettingsRow label="备份保留数量"><Input type="number" v-model.number="p.backupRetention" min="1" max="100" aria-label="备份保留数量" class="w-32"/></SettingsRow>
<SettingsRow label="定期备份" description="应用运行时执行；备份前保存文档，失败时保留提示。"><Select v-model="p.backupInterval"><SelectTrigger aria-label="定期备份" class="w-40"><SelectValue/></SelectTrigger><SelectContent><SelectGroup><SelectItem :value="0">仅手动备份</SelectItem><SelectItem :value="15">每 15 分钟</SelectItem><SelectItem :value="60">每小时</SelectItem><SelectItem :value="1440">每天</SelectItem></SelectGroup></SelectContent></Select></SettingsRow>
</SettingsSection></template><template v-if="section==='writing'">
<SettingsRow label="打字机滚动" description="让当前输入行保持在设置的位置。"><Switch v-model="p.typewriter" aria-label="打字机滚动"/></SettingsRow>
<SettingsRow label="打字机位置" description="输入行距编辑区顶部的百分比。"><Input type="number" v-model.number="p.typewriterPosition" min="20" max="80" aria-label="打字机位置" class="w-32"/></SettingsRow>
<SettingsRow label="Markdown 语法补全" description="补齐成对括号、引号、代码围栏；列表自动续写。"><Switch v-model="p.syntaxAssist" aria-label="Markdown 语法补全"/></SettingsRow>
<SettingsRow label="斜杠命令" description="在空行输入 /，选择标题、表格、图片、代码块等。"><Switch v-model="p.slashCommands" aria-label="斜杠命令"/></SettingsRow>
<SettingsRow label="自动定位当前文档" description="打开文档时展开文件树并定位。"><Switch v-model="p.autoReveal" aria-label="自动定位当前文档"/></SettingsRow>
</template><template v-if="section==='templates'"><div class="rounded-lg border bg-muted/20 p-4 text-sm leading-7"><p>占位符会在新建文档时自动替换：</p><p><code v-pre>{{title}}</code> → 新文档名称（不含 .md）；<code v-pre>{{date}}</code> → 创建文档当天的日期。</p><p>例如模板填写下面的内容：</p><pre class="mt-2 whitespace-pre-wrap rounded-md bg-muted p-3 text-xs" v-pre># {{title}}

日期：{{date}}

## 正文</pre><p class="mt-2">保存模板后，通过“文件 → 新建文档”或 Ctrl+N，在“文档模板”中选择它。双击标签栏创建的空白临时文档不会套用模板。</p></div><TemplateManager/>
</template><template v-if="section==='desktop'"><SettingsRow label="关闭到系统托盘" description="关闭按钮隐藏窗口；托盘菜单可显示窗口或保存后退出。"><Switch v-model="p.closeToTray" aria-label="关闭到系统托盘"/></SettingsRow></template><template v-if="section==='about'"><AppUpdater/></template></template>
