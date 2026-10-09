<script setup lang="ts">
import { computed, ref, watch, nextTick, onMounted } from 'vue'
import { call, desktop } from '@/services/api'
import { version as appVersion } from '../../package.json'
import { ArrowLeftIcon, SunIcon, MoonIcon, MonitorIcon, RotateCcwIcon, PenLineIcon, CodeXmlIcon, Columns2Icon, BookOpenIcon, PaletteIcon, SlidersHorizontalIcon, TypeIcon, TagsIcon, KeyboardIcon, InfoIcon, FileTextIcon, SettingsIcon, CheckIcon, CheckCircle2Icon } from '@lucide/vue'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { FieldGroup, Field, FieldLabel } from '@/components/ui/field'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Select, SelectTrigger, SelectValue, SelectContent, SelectGroup, SelectItem } from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { Badge } from '@/components/ui/badge'
import AdvancedSettings from './AdvancedSettings.vue'
import ReadingSettings from './ReadingSettings.vue'
import NavigationSettings from './NavigationSettings.vue'
import PrivacySettings from './PrivacySettings.vue'
import MaterialSettings from './MaterialSettings.vue'
import TagManager from '@/components/TagManager.vue'
import SettingsNumberSelect from '@/components/SettingsNumberSelect.vue'
import SettingsRow from '@/components/SettingsRow.vue'
import { useWorkbench } from '@/stores/workbench'
import { defaults, views, type Preferences } from '@/types'

const props = defineProps<{ open: boolean; section?: string }>()
const emit = defineEmits<{ 'update:open': [value: boolean] }>()
const store = useWorkbench(), p = computed(() => store.preferences), tagBusy = ref(false), category = ref('general')
const categories = [
{value:'privacy',label:'隐私与锁屏',icon:SettingsIcon,description:'管理应用锁定与解锁密码。'},
  { value: 'general', label: '通用', icon: SlidersHorizontalIcon, description: '调整工作区布局与日常编辑习惯。' },
  { value: 'appearance', label: '外观', icon: PaletteIcon, description: '选择适合你的主题与界面尺寸。' },
  { value: 'typography', label: '排版', icon: TypeIcon, description: '让文字以舒服的字体、字号和行距呈现。' },
  { value:'safety',label:'保存与备份',icon:FileTextIcon,description:'管理保存策略、历史版本与工作区备份。' },
  { value:'writing',label:'写作',icon:PenLineIcon,description:'配置写作辅助与个人模板。' },
  { value:'toolbar',label:'工具栏',icon:SlidersHorizontalIcon,description:'调整格式工具的顺序和显示。' },
  { value: 'templates', label: '模板管理', icon: FileTextIcon, description: '保存常用文档结构，在新建文档时选择使用。' },
  { value: 'tags', label: '标签管理', icon: TagsIcon, description: '整理工作区中的文档标签。' },
  { value: 'shortcuts', label: '快捷键', icon: KeyboardIcon, description: '少一点点击，让写作更连贯。' },
  { value: 'about', label: '关于', icon: InfoIcon, description: '一个安静的本地 Markdown 写作空间。' },
  { value:'desktop',label:'其它',icon:MonitorIcon,description:'配置桌面行为与其它偏好。' },
]
const settingsQuery=ref('')
const settingIndex=[...categories.map(c=>({category:c.value,label:c.label})),...['锁屏密码','新密码','修改密码','移除密码'].map(label=>({category:'privacy',label})),...['最近文档显示数量','最近文档排序'].map(label=>({category:'general',label})),...['正文显示主题','动效强度','降低材质效果','代码自动换行','代码块行号','代码语法高亮'].map(label=>({category:'appearance',label})),...['默认编辑模式','同步滚动','显示顶部菜单','显示工作区侧栏','显示文档大纲'].map(label=>({category:'general',label})),...['界面材质','界面圆角','毛玻璃模糊','显示模式','主题色','全局界面字号','界面密度','背景颜色','正文颜色','代码主题'].map(label=>({category:'appearance',label})),...['正文字体','正文字号','正文行高','代码字体','代码字号'].map(label=>({category:'typography',label})),...['关闭到系统托盘'].map(label=>({category:'desktop',label})),{category:'about',label:'检查更新'},...['自动保存','自动保存延迟','失焦保存','关闭前保存','历史版本保留数量','工作区备份目录','备份保留数量','定期备份'].map(label=>({category:'safety',label})),...['打字机滚动','打字机位置','Markdown 语法补全','斜杠命令','自动定位当前文档',].map(label=>({category:'writing',label}))]
settingIndex.push(...['自定义模板名称','模板 Markdown','占位符'].map(label=>({category:'templates',label})))
const settingsResults=computed(()=>settingsQuery.value.trim()?settingIndex.filter(s=>s.label.toLowerCase().includes(settingsQuery.value.toLowerCase())):[])
async function locate(item:{category:string;label:string}){category.value=item.category;settingsQuery.value='';await nextTick();const labels=[...document.querySelectorAll<HTMLElement>('.settings-dialog [data-slot=field-label]')];labels.find(el=>el.textContent?.includes(item.label))?.closest('[data-slot=field]')?.scrollIntoView({block:'center',behavior:'smooth'})}
const currentCategory = computed(() => categories.find(c => c.value === category.value) || categories[0]!)
watch(() => props.open, open => { if (open && props.section && categories.some(c => c.value === props.section)) category.value = props.section }, {immediate:true})
const colors = [{ value:'#277c62',name:'松绿' },{value:'#0d9488',name:'青绿'},{value:'#0891b2',name:'湖蓝'},{value:'#5474b4',name:'雾蓝'},{value:'#4f46e5',name:'靛蓝'},{value:'#8a62a9',name:'紫藤'},{value:'#c026d3',name:'兰紫'},{value:'#b85667',name:'玫瑰'},{value:'#e11d48',name:'绯红'},{value:'#ea580c',name:'橙红'},{value:'#b8773c',name:'琥珀'},{value:'#64748b',name:'岩灰'}]
const systemFonts=ref<string[]>([]),fontError=ref('')
const fontOptions=computed(()=>[...new Set(['system-ui','ui-monospace',p.value.bodyFont,p.value.codeFont,...systemFonts.value])].filter(Boolean))
onMounted(async()=>{if(!desktop){fontError.value='浏览器预览仅提供默认字体；桌面版显示本机字体。';return}try{systemFonts.value=await call<string[]>('list_system_fonts')}catch{fontError.value='系统字体读取失败，保留当前字体和系统默认选项。'}})
const selectedColor = computed(() => colors.find(color => color.value === p.value.accent.toLowerCase())?.name || '自定义')
const viewIcons = { live: PenLineIcon, source: CodeXmlIcon, split: Columns2Icon, preview: BookOpenIcon }
const uiSizes = [{value:12,label:'小'},{value:14,label:'标准'},{value:16,label:'大'},{value:18,label:'特大'}]
const bodySizes = [{value:14,label:'小'},{value:16,label:'标准'},{value:18,label:'大'},{value:20,label:'特大'}]
const widthSizes = [{value:40,label:'紧凑'},{value:50,label:'标准'},{value:60,label:'宽松'},{value:80,label:'加宽'}]
const resetKeys: Record<string, (keyof Preferences)[]> = { general:['recentLimit','recentSort','defaultView','syncScroll','sidebar','outline','header','collapsedSidebarWidth'], appearance:['bodyTheme','motion','lowEffects','codeWrap','codeNumbers','codeHighlight','material','cornerRadius','glassBlur','mode','accent','uiSize','density','background','textColor','codeTheme'], typography:['bodyFont','bodySize','codeFont','codeSize','lineHeight','documentStyle','lineNumbers'] }
function resetCategory() { for (const key of resetKeys[category.value] || []) Object.assign(store.preferences, { [key]: defaults[key] }) }
const shortcuts = [ ['搜索命令','Ctrl / Cmd + K'], ['新建文档','Ctrl / Cmd + N'], ['保存文档','Ctrl / Cmd + S'], ['关闭当前标签','Ctrl / Cmd + W'], ['快速打开文档','Ctrl / Cmd + P'], ['查找与替换','Ctrl / Cmd + F'], ['工作区全文搜索','Ctrl / Cmd + Shift + F'], ['专注模式','Ctrl / Cmd + Shift + Enter'], ['打开设置','Ctrl / Cmd + ,'], ['关闭弹窗 / 退出专注模式','Esc'] ]
</script>
<template>
  <section v-show="open" class="settings-dialog flex min-h-0 flex-1 flex-col overflow-hidden bg-background" aria-label="设置">
      <Tabs v-model="category" orientation="vertical" class="min-h-0 flex-1 gap-0 overflow-hidden">
        <aside class="flex min-h-0 w-[150px] shrink-0 flex-col gap-4 border-r border-border/60 bg-muted/35 p-3 sm:w-[190px] sm:p-4">
          <Button variant="ghost" class="justify-start" :disabled="tagBusy" @click="emit('update:open',false)"><ArrowLeftIcon/>返回应用</Button><p class="px-2 pt-1 text-[11px] font-medium tracking-wider text-muted-foreground">设置</p>
          <TabsList variant="navigation" aria-label="设置分类" class="min-h-0 w-full flex-1 justify-start overflow-y-auto overflow-x-hidden">
            <TabsTrigger v-for="item in categories" :key="item.value" :value="item.value" :disabled="tagBusy" class="h-10 flex-none justify-start gap-3 px-3"><component :is="item.icon" />{{ item.label }}</TabsTrigger>
          </TabsList>
          <div class="mt-auto flex items-center gap-2 px-2 pb-1 text-xs text-muted-foreground"><CheckCircle2Icon class="size-3.5 shrink-0" />修改后自动保存</div>
        </aside>
        <div class="flex min-h-0 min-w-0 flex-1 flex-col">      <div class="relative border-b px-6 py-2"><Input v-model="settingsQuery" aria-label="搜索设置" placeholder="搜索设置，例如自动保存、字体…"/><div v-if="settingsQuery" class="absolute inset-x-6 top-full z-10 max-h-64 overflow-auto rounded-lg border bg-popover p-1 shadow-lg"><Button v-for="item in settingsResults" :key="item.category+item.label" variant="ghost" class="w-full justify-start" @click="locate(item)">{{item.label}}<span class="ml-auto text-xs text-muted-foreground">{{categories.find(c=>c.value===item.category)?.label}}</span></Button><p v-if="!settingsResults.length" class="p-3 text-sm text-muted-foreground">没有匹配设置。</p></div></div>

          <div class="shrink-0 px-6 pt-6 sm:px-8"><h2 class="text-lg font-semibold tracking-tight">{{ currentCategory.label }}</h2><p class="mt-1.5 text-xs leading-relaxed text-muted-foreground">{{ currentCategory.description }}</p></div>
          <div class="min-h-0 flex-1 overflow-y-auto px-6 pb-6 pt-2 sm:px-8" :key="category">
            <TabsContent value="privacy"><PrivacySettings/></TabsContent>
<TabsContent value="general" class="m-0 outline-none">
              <FieldGroup class="gap-0">
<NavigationSettings/>
                <SettingsRow label="默认编辑视图" description="首次打开文档时使用的编辑方式。"><Select :model-value="p.defaultView" @update:model-value="v => p.defaultView = v as typeof p.defaultView"><SelectTrigger aria-label="默认编辑视图"><SelectValue /></SelectTrigger><SelectContent><SelectGroup><SelectItem v-for="view in views" :key="view.value" :value="view.value"><component :is="viewIcons[view.value]" />{{ view.label }}</SelectItem></SelectGroup></SelectContent></Select></SettingsRow>
                <SettingsRow id="sync-scroll" label="分屏同步滚动" description="编辑源码时，让右侧预览跟随阅读位置。"><div class="flex justify-end"><Switch id="sync-scroll" v-model="p.syncScroll" /></div></SettingsRow>
                <SettingsRow id="sidebar-visible" label="显示工作区侧栏" description="在左侧浏览本地文件夹和文档。"><div class="flex justify-end"><Switch id="sidebar-visible" v-model="p.sidebar" /></div></SettingsRow>
                <SettingsRow id="outline-visible" label="显示文档大纲" description="在右侧查看章节，并快速跳转。"><div class="flex justify-end"><Switch id="outline-visible" v-model="p.outline" /></div></SettingsRow>
                <SettingsRow id="header-visible" label="显示顶部菜单" description="提供文件、编辑、视图和导出的完整入口。"><div class="flex justify-end"><Switch id="header-visible" v-model="p.header" /></div></SettingsRow>
                <SettingsRow label="收起侧栏宽度" description="调整折叠侧栏的图标区域，默认 50px。"><SettingsNumberSelect v-model="p.collapsedSidebarWidth" :min="40" :max="120" :presets="widthSizes" label="收起侧栏宽度" /></SettingsRow>
              </FieldGroup>
            </TabsContent>
            <TabsContent value="appearance" class="m-0 outline-none">
              <FieldGroup class="gap-0">
                <MaterialSettings /><ReadingSettings/>
                <SettingsRow label="显示模式" description="跟随系统可以自动切换亮色与暗色。"><ToggleGroup type="single" variant="segmented" :spacing="1" :model-value="p.mode" aria-label="显示模式" @update:model-value="v => { if (v) p.mode = v as typeof p.mode }"><ToggleGroupItem value="light"><SunIcon />亮色</ToggleGroupItem><ToggleGroupItem value="dark"><MoonIcon />暗色</ToggleGroupItem><ToggleGroupItem value="system"><MonitorIcon />系统</ToggleGroupItem></ToggleGroup></SettingsRow>
                <SettingsRow label="界面密度" description="调整列表与工具栏的留白。"><Select v-model="p.density"><SelectTrigger aria-label="界面密度"><SelectValue/></SelectTrigger><SelectContent><SelectGroup><SelectItem value="compact">紧凑</SelectItem><SelectItem value="standard">标准</SelectItem><SelectItem value="comfortable">宽松</SelectItem></SelectGroup></SelectContent></Select></SettingsRow><SettingsRow label="背景颜色" description="立即预览自定义背景，可恢复主题默认。"><div class="flex items-center gap-2"><input :value="p.background||'#ffffff'" type="color" aria-label="自定义背景颜色" class="size-8" @input="p.background=($event.target as HTMLInputElement).value"/><Button variant="ghost" size="sm" @click="p.background=''">默认</Button></div></SettingsRow><SettingsRow label="正文颜色" description="对比度不足时自动使用清晰的文字颜色。"><div class="flex items-center gap-2"><input :value="p.textColor||'#333333'" type="color" aria-label="自定义正文颜色" class="size-8" @input="p.textColor=($event.target as HTMLInputElement).value"/><Button variant="ghost" size="sm" @click="p.textColor=''">默认</Button></div></SettingsRow><SettingsRow label="代码主题"><Select v-model="p.codeTheme"><SelectTrigger aria-label="代码主题"><SelectValue/></SelectTrigger><SelectContent><SelectGroup><SelectItem value="auto">跟随界面</SelectItem><SelectItem value="light">亮色代码</SelectItem><SelectItem value="dark">暗色代码</SelectItem><SelectItem value="nord">极地</SelectItem><SelectItem value="sepia">暖纸</SelectItem></SelectGroup></SelectContent></Select></SettingsRow><SettingsRow label="全局界面字号" description="调整菜单、设置和按钮大小，不影响正文字号。"><SettingsNumberSelect v-model="p.uiSize" :min="12" :max="20" :presets="uiSizes" label="全局界面字号" /></SettingsRow>
                <Field class="gap-4 py-5"><FieldLabel>主题色</FieldLabel><div class="flex flex-wrap items-center gap-4"><ToggleGroup type="single" :spacing="2" :model-value="p.accent.toLowerCase()" aria-label="预设主题色" class="flex-wrap" @update:model-value="v => { if (v) p.accent = String(v) }"><ToggleGroupItem v-for="color in colors" :key="color.value" :value="color.value" :aria-label="`主题色 ${color.name}`" :title="color.name" class="size-9 rounded-full border-2 border-transparent p-1 data-[state=on]:border-primary"><span class="flex size-6 items-center justify-center rounded-full text-primary-foreground" :style="{ backgroundColor: color.value }"><CheckIcon v-if="p.accent.toLowerCase() === color.value" class="size-3.5" /></span></ToggleGroupItem></ToggleGroup><input v-model="p.accent" type="color" class="size-8 cursor-pointer rounded-lg border-0 bg-transparent p-0" aria-label="自定义主题色" /></div><p class="text-xs text-muted-foreground">当前：{{ selectedColor }} · {{ p.accent.toUpperCase() }}</p></Field>
              </FieldGroup>
              <div class="mt-4 rounded-xl border border-border/70 bg-muted/30 p-5"><p class="text-[11px] text-muted-foreground">主题预览</p><div class="mt-3 flex items-center gap-3"><div class="flex size-9 items-center justify-center rounded-lg bg-accent text-accent-foreground"><FileTextIcon class="size-4" /></div><div><p class="text-sm font-medium">一份新的写作灵感</p><p class="mt-1 text-xs text-muted-foreground">主题色用于选中状态与重要入口</p></div></div></div>
            </TabsContent>
            <TabsContent value="typography" class="m-0 outline-none">
              <p v-if="fontError" class="py-2 text-xs text-muted-foreground">{{fontError}}</p><FieldGroup class="gap-0">
                <SettingsRow id="bodyFont" label="正文字体" description="选择本机已安装字体，或跟随系统默认字体。"><Select v-model="p.bodyFont"><SelectTrigger id="bodyFont" aria-label="正文字体" class="w-full"><SelectValue/></SelectTrigger><SelectContent><SelectGroup><SelectItem v-for="font in fontOptions" :key="font" :value="font">{{font==='system-ui'?'系统默认字体':font==='ui-monospace'?'系统等宽字体':font}}</SelectItem></SelectGroup></SelectContent></Select></SettingsRow>
                <SettingsRow label="正文字号"><SettingsNumberSelect v-model="p.bodySize" :min="10" :max="36" :presets="bodySizes" label="正文字号" /></SettingsRow>
                <SettingsRow label="正文行高" description="应用于可视化编辑和阅读预览。"><Select :model-value="String(p.lineHeight)" @update:model-value="v => p.lineHeight = Number(v)"><SelectTrigger aria-label="正文行高"><SelectValue /></SelectTrigger><SelectContent><SelectGroup><SelectItem v-for="height in [...new Set([1.4,1.6,1.8,1.9,2,2.2,2.5,p.lineHeight])].sort()" :key="height" :value="String(height)">{{ height }} 倍{{ height === 1.9 ? '（默认）' : '' }}</SelectItem></SelectGroup></SelectContent></Select></SettingsRow>
                <SettingsRow label="正文宽度" description="标准模式保持约 760px 的阅读宽度。"><Select v-model="p.documentStyle"><SelectTrigger aria-label="文档显示样式"><SelectValue /></SelectTrigger><SelectContent><SelectGroup><SelectItem value="standard">标准模式</SelectItem><SelectItem value="wide">超宽模式</SelectItem></SelectGroup></SelectContent></Select></SettingsRow>
                <div class="my-4 overflow-hidden rounded-xl border border-border/70 bg-muted/20 p-5"><p class="mb-3 text-[11px] text-muted-foreground">排版预览</p><p class="break-words font-[family-name:var(--body-font)] text-[length:var(--body-size)] leading-[var(--body-line-height)]">把想法写下来，让文字慢慢长出来。<br />A quiet space for your next idea.</p></div>
                <SettingsRow id="codeFont" label="源码 / 代码字体"><Select v-model="p.codeFont"><SelectTrigger id="codeFont" aria-label="源码 / 代码字体" class="w-full"><SelectValue/></SelectTrigger><SelectContent><SelectGroup><SelectItem v-for="font in fontOptions" :key="font" :value="font">{{font==='system-ui'?'系统默认字体':font==='ui-monospace'?'系统等宽字体':font}}</SelectItem></SelectGroup></SelectContent></Select></SettingsRow>
                <SettingsRow label="源码 / 代码字号"><SettingsNumberSelect v-model="p.codeSize" :min="10" :max="36" :presets="uiSizes" label="源码 / 代码字号" /></SettingsRow>
                <SettingsRow id="line-numbers" label="显示行号" description="源码显示行号，其余视图显示内容块的起始行号。"><div class="flex justify-end"><Switch id="line-numbers" v-model="p.lineNumbers" /></div></SettingsRow>
              </FieldGroup>
            </TabsContent>
            <TabsContent v-for="section in ['safety','writing','templates','toolbar','desktop']" :key="section" :value="section" class="settings-content m-0 px-7 pb-8"><AdvancedSettings :section="section"/></TabsContent>
          <TabsContent value="tags" class="m-0 pt-5 outline-none"><TagManager @busy="tagBusy = $event" /></TabsContent>
            <TabsContent value="shortcuts" class="m-0 pt-4 outline-none"><dl class="flex flex-col"><div v-for="[label, shortcut] in shortcuts" :key="label" class="flex flex-wrap items-center justify-between gap-3 border-b border-border/60 py-4 last:border-0"><dt class="text-sm">{{ label }}</dt><dd><kbd class="rounded-md border border-border bg-muted/50 px-2 py-1 text-xs text-muted-foreground">{{ shortcut }}</kbd></dd></div></dl></TabsContent>
            <TabsContent value="about" class="m-0 pt-6 outline-none"><div class="flex flex-col items-start gap-5"><img src="/markflow.svg" alt="MarkFlow" class="size-14 rounded-2xl" /><div class="flex items-center gap-3"><h3 class="text-2xl font-semibold tracking-tight">MarkFlow</h3><Badge variant="secondary">v{{ appVersion }}</Badge></div><p class="max-w-md text-sm leading-7 text-muted-foreground">本地 Markdown 编辑器。让注意力回到文字，让文档留在你自己的文件夹里。</p><div class="rounded-xl border border-border/70 bg-muted/25 p-5 text-xs leading-6 text-muted-foreground">文档以 Markdown 文件保存，图片附件使用相对路径。<br />支持可视化、源码、分屏和阅读预览。</div><AdvancedSettings section="about" class="w-full"/></div></TabsContent>
          </div>
          <div class="flex shrink-0 items-center justify-between gap-3 border-t border-border/60 px-6 py-4 sm:px-8"><Button v-if="resetKeys[category]" variant="ghost" size="sm" :disabled="tagBusy" @click="resetCategory"><RotateCcwIcon data-icon="inline-start" />恢复此分类默认设置</Button><span v-else class="text-xs text-muted-foreground">MarkFlow · 本地优先</span></div>
        </div>
      </Tabs>
    </section>
</template>
