<script setup lang="ts">
import { computed, ref, watch, nextTick, onMounted } from 'vue'
import { call, desktop } from '@/services/api'
import TemplateHelpDialog from './TemplateHelpDialog.vue'
import { version as appVersion } from '../../package.json'
import { ArrowLeftIcon, SunIcon, MoonIcon, MonitorIcon, RotateCcwIcon, PenLineIcon, CodeXmlIcon, Columns2Icon, BookOpenIcon, PaletteIcon, SlidersHorizontalIcon, TagsIcon, KeyboardIcon, FileTextIcon, CheckIcon, CircleHelpIcon } from '@lucide/vue'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { FieldGroup, Field, FieldLabel } from '@/components/ui/field'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
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
import SettingsSection from '@/components/SettingsSection.vue'
import { useWorkbench } from '@/stores/workbench'
import { defaults, views, type Preferences } from '@/types'

const props = defineProps<{ open: boolean; section?: string }>()
const emit = defineEmits<{ 'update:open': [value: boolean] }>()
const store = useWorkbench(), p = computed(() => store.preferences), tagBusy = ref(false), category = ref('general')
const categories = [
  { value: 'general', label: '通用', icon: SlidersHorizontalIcon, description: '管理工作区布局、隐私与应用信息。' },
  { value: 'appearance', label: '外观', icon: PaletteIcon, description: '选择适合你的主题与界面尺寸。' },
  { value:'safety',label:'保存与备份',icon:FileTextIcon,description:'管理保存策略、历史版本与工作区备份。' },
  { value:'writing',label:'写作',icon:PenLineIcon,description:'配置编辑辅助、正文排版与源码显示。' },
  { value: 'templates', label: '模板管理', icon: FileTextIcon, description: '保存常用文档结构，在新建文档时选择使用。' },
  { value: 'tags', label: '标签管理', icon: TagsIcon, description: '管理标签名称与颜色；重命名或删除会同步更新工作区文档（含归档）。' },
  { value: 'shortcuts', label: '快捷键', icon: KeyboardIcon, description: '少一点点击，让写作更连贯。' },
  { value:'desktop',label:'其它',icon:MonitorIcon,description:'配置桌面行为与其它偏好。' },
]
const templateHelp=ref(false)
const settingsQuery=ref('')
const settingIndex=[...categories.map(c=>({category:c.value,label:c.label})),...['锁屏密码','新密码','修改密码','移除密码'].map(label=>({category:'general',label})),...['最近文档显示数量','最近文档排序'].map(label=>({category:'general',label})),...['正文显示主题','动效强度','降低材质效果','代码自动换行','代码块行号','代码语法高亮'].map(label=>({category:'appearance',label})),...['默认编辑模式','同步滚动','显示顶部菜单','显示工作区侧栏','显示文档大纲'].map(label=>({category:'general',label})),...['界面材质','界面圆角','毛玻璃模糊','显示模式','主题色','全局界面字号','界面密度','背景颜色','正文颜色','代码主题'].map(label=>({category:'appearance',label})),...['正文字体','正文字号','正文行高','代码字体','代码字号'].map(label=>({category:'writing',label})),...['关闭到系统托盘'].map(label=>({category:'desktop',label})),{category:'general',label:'检查更新'},...['自动保存','自动保存延迟','失焦保存','关闭前保存','历史版本保留数量','工作区备份目录','备份保留数量','定期备份'].map(label=>({category:'safety',label})),...['打字机滚动','打字机位置','Markdown 语法补全','斜杠命令','自动定位当前文档',].map(label=>({category:'writing',label}))]
settingIndex.push({category:'general',label:'隐私与锁屏'},{category:'general',label:'关于 MarkFlow'},{category:'writing',label:'正文排版'},{category:'writing',label:'源码与代码'},...['自定义模板名称','模板 Markdown','占位符'].map(label=>({category:'templates',label})))
const settingsResults=computed(()=>settingsQuery.value.trim()?settingIndex.filter(s=>s.label.toLowerCase().includes(settingsQuery.value.toLowerCase())):[])
async function locate(item:{category:string;label:string}){category.value=item.category;settingsQuery.value='';await nextTick();const labels=[...document.querySelectorAll<HTMLElement>('.settings-dialog [data-slot=field-label], .settings-dialog h3')];labels.find(el=>el.textContent?.includes(item.label))?.closest('[data-slot=field], .settings-section')?.scrollIntoView({block:'center',behavior:'smooth'})}
const currentCategory = computed(() => categories.find(c => c.value === category.value) || categories[0]!)
const sectionAliases: Record<string, string> = { privacy: 'general', about: 'general', typography: 'writing', toolbar: 'writing' }
watch(() => [props.open, props.section] as const, async ([open, section]) => {
  if (!open || !section) return
  const target = sectionAliases[section] || section
  if (!categories.some(c => c.value === target)) return
  category.value = target
  await nextTick()
  document.getElementById(`settings-${section}`)?.scrollIntoView({ block: 'start' })
}, { immediate: true })
const colors = [{ value:'#e11d48',name:'红色' },{ value:'#ea580c',name:'橙色' },{ value:'#eab308',name:'黄色' },{ value:'#16a34a',name:'绿色' },{ value:'#2563eb',name:'蓝色' },{ value:'#4f46e5',name:'靛色' },{ value:'#9333ea',name:'紫色' }]
const systemFonts=ref<string[]>([]),fontError=ref('')
const fontOptions=computed(()=>[...new Set(['system-ui','ui-monospace',p.value.bodyFont,p.value.codeFont,...systemFonts.value])].filter(Boolean))
onMounted(async()=>{if(!desktop){fontError.value='浏览器预览仅提供默认字体；桌面版显示本机字体。';return}try{systemFonts.value=await call<string[]>('list_system_fonts')}catch{fontError.value='系统字体读取失败，保留当前字体和系统默认选项。'}})
const viewIcons = { live: PenLineIcon, source: CodeXmlIcon, split: Columns2Icon, preview: BookOpenIcon }
const uiSizes = [{value:12,label:'小'},{value:14,label:'标准'},{value:16,label:'大'},{value:18,label:'特大'}]
const bodySizes = [{value:14,label:'小'},{value:16,label:'标准'},{value:18,label:'大'},{value:20,label:'特大'}]
const widthSizes = [{value:40,label:'紧凑'},{value:50,label:'标准'},{value:60,label:'宽松'},{value:80,label:'加宽'}]
const resetKeys: Record<string, (keyof Preferences)[]> = { general:['recentLimit','recentSort','defaultView','syncScroll','sidebar','outline','header','collapsedSidebarWidth'], appearance:['bodyTheme','motion','lowEffects','codeWrap','codeNumbers','codeHighlight','material','cornerRadius','glassBlur','mode','accent','uiSize','density','background','textColor','codeTheme'], writing:['typewriter','typewriterPosition','syntaxAssist','slashCommands','autoReveal','bodyFont','bodySize','codeFont','codeSize','lineHeight','documentStyle','lineNumbers'] }
function resetCategory() { for (const key of resetKeys[category.value] || []) Object.assign(store.preferences, { [key]: defaults[key] }) }
const shortcuts = [ ['搜索命令','Ctrl / Cmd + K'], ['新建文档','Ctrl / Cmd + N'], ['保存文档','Ctrl / Cmd + S'], ['关闭当前标签','Ctrl / Cmd + W'], ['快速打开文档','Ctrl / Cmd + P'], ['查找与替换','Ctrl / Cmd + F'], ['工作区全文搜索','Ctrl / Cmd + Shift + F'], ['专注模式','Ctrl / Cmd + Shift + Enter'], ['打开设置','Ctrl / Cmd + ,'], ['关闭弹窗 / 退出专注模式','Esc'] ]
</script>
<template>
  <section v-show="open" class="settings-dialog flex min-h-0 flex-1 flex-col overflow-hidden bg-transparent p-2" aria-label="设置">
      <Tabs v-model="category" orientation="vertical" class="min-h-0 flex-1 gap-3 overflow-hidden">
        <Card role="complementary" aria-label="设置导航" class="min-h-0 w-[150px] shrink-0 gap-4 overflow-hidden border-border/70 bg-sidebar p-3 sm:w-[190px] sm:p-4">
          <Button variant="ghost" class="justify-start" :disabled="tagBusy" @click="emit('update:open',false)"><ArrowLeftIcon/>返回应用</Button>
          <TabsList variant="navigation" aria-label="设置分类" class="min-h-0 w-full flex-1 justify-start overflow-y-auto overflow-x-hidden">
            <TabsTrigger v-for="item in categories" :key="item.value" :value="item.value" :disabled="tagBusy" class="h-10 flex-none justify-start gap-3 px-3"><component :is="item.icon" />{{ item.label }}</TabsTrigger>
          </TabsList>
        </Card>
        <Card class="min-h-0 min-w-0 flex-1 gap-0 overflow-hidden border-border/70 py-0">      <div class="relative border-b px-6 py-2"><Input v-model="settingsQuery" aria-label="搜索设置" placeholder="搜索设置，例如自动保存、字体…"/><div v-if="settingsQuery" class="absolute inset-x-6 top-full z-10 max-h-64 overflow-auto rounded-lg border bg-popover p-1 shadow-lg"><Button v-for="item in settingsResults" :key="item.category+item.label" variant="ghost" class="w-full justify-start" @click="locate(item)">{{item.label}}<span class="ml-auto text-xs text-muted-foreground">{{categories.find(c=>c.value===item.category)?.label}}</span></Button><p v-if="!settingsResults.length" class="p-3 text-sm text-muted-foreground">没有匹配设置。</p></div></div>

          <div class="shrink-0 px-6 pt-6 sm:px-8"><div class="flex items-center gap-2"><h2 class="text-lg font-semibold tracking-tight">{{ currentCategory.label }}</h2><Button v-if="category==='templates'" variant="ghost" size="icon-xs" aria-label="模板使用说明" @click="templateHelp=true"><CircleHelpIcon/></Button></div><p class="mt-1.5 text-xs leading-relaxed text-muted-foreground">{{ currentCategory.description }}</p></div>
          <div class="min-h-0 flex-1 overflow-y-auto px-6 pb-6 pt-2 sm:px-8" :key="category">

<TabsContent value="general" class="m-0 outline-none">
              <FieldGroup class="gap-0">
<SettingsSection title="文档导航"><NavigationSettings/></SettingsSection>
<SettingsSection title="工作区布局">
                <SettingsRow label="默认编辑视图" description="首次打开文档时使用的编辑方式。"><Select :model-value="p.defaultView" @update:model-value="v => p.defaultView = v as typeof p.defaultView"><SelectTrigger aria-label="默认编辑视图"><SelectValue /></SelectTrigger><SelectContent><SelectGroup><SelectItem v-for="view in views" :key="view.value" :value="view.value"><component :is="viewIcons[view.value]" />{{ view.label }}</SelectItem></SelectGroup></SelectContent></Select></SettingsRow>
                <SettingsRow id="sync-scroll" label="分屏同步滚动" description="编辑源码时，让右侧预览跟随阅读位置。"><div class="flex justify-end"><Switch id="sync-scroll" v-model="p.syncScroll" /></div></SettingsRow>
                <SettingsRow id="sidebar-visible" label="显示工作区侧栏" description="在左侧浏览本地文件夹和文档。"><div class="flex justify-end"><Switch id="sidebar-visible" v-model="p.sidebar" /></div></SettingsRow>
                <SettingsRow id="outline-visible" label="显示文档大纲" description="在右侧查看章节，并快速跳转。"><div class="flex justify-end"><Switch id="outline-visible" v-model="p.outline" /></div></SettingsRow>
                <SettingsRow id="header-visible" label="显示顶部菜单" description="提供文件、编辑、视图和导出的完整入口。"><div class="flex justify-end"><Switch id="header-visible" v-model="p.header" /></div></SettingsRow>
                <SettingsRow label="收起侧栏宽度" description="调整折叠侧栏的图标区域，默认 50px。"><SettingsNumberSelect v-model="p.collapsedSidebarWidth" :min="40" :max="120" :presets="widthSizes" label="收起侧栏宽度" /></SettingsRow>
              </SettingsSection>
              </FieldGroup>
              <SettingsSection id="settings-privacy" title="隐私与锁屏"><PrivacySettings/></SettingsSection>
              <SettingsSection id="settings-about" title="关于 MarkFlow"><div class="flex flex-col items-start gap-5"><svg role="img" aria-label="MarkFlow" viewBox="0 0 256 256" class="size-14 rounded-2xl text-primary"><rect width="256" height="256" rx="64" fill="currentColor"/><path d="M74 56h75l33 34v110H74z" fill="var(--primary-foreground)"/><path d="M149 56v34h33" fill="currentColor" opacity=".25"/><path d="M96 120h64M96 144h64M96 168h40" stroke="currentColor" stroke-width="10" stroke-linecap="round"/></svg><div class="flex items-center gap-3"><h3 class="text-2xl font-semibold tracking-tight">MarkFlow</h3><Badge variant="secondary">v{{ appVersion }}</Badge></div><p class="max-w-md text-sm leading-7 text-muted-foreground">本地 Markdown 编辑器。让注意力回到文字，让文档留在你自己的文件夹里。</p><div class="rounded-xl border border-border/70 bg-muted/25 p-5 text-xs leading-6 text-muted-foreground">文档以 Markdown 文件保存，图片附件使用相对路径。<br />支持可视化、源码、分屏和阅读预览。</div><div class="w-full"><AdvancedSettings section="about"/></div></div></SettingsSection>
            </TabsContent>
            <TabsContent value="appearance" class="m-0 outline-none">
              <FieldGroup class="gap-0">
                <SettingsSection title="界面材质"><MaterialSettings /></SettingsSection><SettingsSection title="阅读与代码显示"><ReadingSettings/></SettingsSection><SettingsSection title="主题与界面">
                <SettingsRow label="显示模式" description="跟随系统可以自动切换亮色与暗色。"><ToggleGroup type="single" variant="segmented" :spacing="1" :model-value="p.mode" aria-label="显示模式" @update:model-value="v => { if (v) p.mode = v as typeof p.mode }"><ToggleGroupItem value="light"><SunIcon />亮色</ToggleGroupItem><ToggleGroupItem value="dark"><MoonIcon />暗色</ToggleGroupItem><ToggleGroupItem value="system"><MonitorIcon />系统</ToggleGroupItem></ToggleGroup></SettingsRow>
                <SettingsRow label="界面密度" description="调整列表与工具栏的留白。"><Select v-model="p.density"><SelectTrigger aria-label="界面密度"><SelectValue/></SelectTrigger><SelectContent><SelectGroup><SelectItem value="compact">紧凑</SelectItem><SelectItem value="standard">标准</SelectItem><SelectItem value="comfortable">宽松</SelectItem></SelectGroup></SelectContent></Select></SettingsRow><SettingsRow label="背景颜色" description="立即预览自定义背景，可恢复主题默认。"><div class="flex items-center gap-2"><input :value="p.background||'#ffffff'" type="color" aria-label="自定义背景颜色" class="size-8" @input="p.background=($event.target as HTMLInputElement).value"/><Button variant="ghost" size="sm" @click="p.background=''">默认</Button></div></SettingsRow><SettingsRow label="正文颜色" description="对比度不足时自动使用清晰的文字颜色。"><div class="flex items-center gap-2"><input :value="p.textColor||'#333333'" type="color" aria-label="自定义正文颜色" class="size-8" @input="p.textColor=($event.target as HTMLInputElement).value"/><Button variant="ghost" size="sm" @click="p.textColor=''">默认</Button></div></SettingsRow><SettingsRow label="代码主题"><Select v-model="p.codeTheme"><SelectTrigger aria-label="代码主题"><SelectValue/></SelectTrigger><SelectContent><SelectGroup><SelectItem value="auto">跟随界面</SelectItem><SelectItem value="light">亮色代码</SelectItem><SelectItem value="dark">暗色代码</SelectItem><SelectItem value="nord">极地</SelectItem><SelectItem value="sepia">暖纸</SelectItem></SelectGroup></SelectContent></Select></SettingsRow><SettingsRow label="全局界面字号" description="调整菜单、设置和按钮大小，不影响正文字号。"><SettingsNumberSelect v-model="p.uiSize" :min="12" :max="20" :presets="uiSizes" label="全局界面字号" /></SettingsRow>
                <Field class="gap-4 py-5">
                  <FieldLabel>主题色</FieldLabel>
                  <div class="flex flex-wrap items-start gap-3">
                    <ToggleGroup type="single" :spacing="2" :model-value="p.accent.toLowerCase()" aria-label="预设主题色" class="flex-wrap" @update:model-value="v => { if (v) p.accent = String(v) }">
                      <ToggleGroupItem v-for="color in colors" :key="color.value" :value="color.value" :aria-label="`主题色 ${color.name}`" class="h-auto shrink-0 gap-2 rounded-lg px-2 py-2">
                        <span class="flex size-5 items-center justify-center rounded-full" :class="{ 'ring-2 ring-primary ring-offset-2 ring-offset-card': p.accent.toLowerCase() === color.value }" :style="{ backgroundColor: color.value, color: color.name === '黄色' ? '#422006' : '#ffffff' }"><CheckIcon v-if="p.accent.toLowerCase() === color.value" class="size-3.5" /></span>
                        <span class="whitespace-nowrap text-xs">{{ color.name }}</span>
                      </ToggleGroupItem>
                    </ToggleGroup>
                    <label class="flex shrink-0 cursor-pointer items-center gap-2 whitespace-nowrap rounded-lg px-2 py-2 text-xs text-muted-foreground">
                      <span class="relative block size-5 overflow-hidden rounded-full ring-1 ring-border focus-within:ring-2 focus-within:ring-ring" :style="{ backgroundColor: p.accent }"><input v-model="p.accent" type="color" class="absolute inset-0 size-full cursor-pointer opacity-0" aria-label="自定义主题色" /></span>
                      <span>自定义</span>
                    </label>
                  </div>

                </Field>
              </SettingsSection></FieldGroup>
              <div class="mt-4 rounded-xl border border-border/70 bg-muted/30 p-5"><p class="text-[11px] text-muted-foreground">主题预览</p><div class="mt-3 flex items-center gap-3"><div class="flex size-9 items-center justify-center rounded-lg bg-accent text-accent-foreground"><FileTextIcon class="size-4" /></div><div><p class="text-sm font-medium">一份新的写作灵感</p><p class="mt-1 text-xs text-muted-foreground">主题色用于选中状态与重要入口</p></div></div></div>
            </TabsContent>

<TabsContent value="writing" class="m-0 outline-none"><SettingsSection title="编辑辅助"><AdvancedSettings section="writing"/></SettingsSection><div id="settings-typography">
              <p v-if="fontError" class="py-2 text-xs text-muted-foreground">{{fontError}}</p><FieldGroup class="gap-0"><SettingsSection title="正文排版">
                <SettingsRow id="bodyFont" label="正文字体" description="选择本机已安装字体，或跟随系统默认字体。"><Select v-model="p.bodyFont"><SelectTrigger id="bodyFont" aria-label="正文字体" class="w-full"><SelectValue/></SelectTrigger><SelectContent><SelectGroup><SelectItem v-for="font in fontOptions" :key="font" :value="font">{{font==='system-ui'?'系统默认字体':font==='ui-monospace'?'系统等宽字体':font}}</SelectItem></SelectGroup></SelectContent></Select></SettingsRow>
                <SettingsRow label="正文字号"><SettingsNumberSelect v-model="p.bodySize" :min="10" :max="36" :presets="bodySizes" label="正文字号" /></SettingsRow>
                <SettingsRow label="正文行高" description="应用于可视化编辑和阅读预览。"><Select :model-value="String(p.lineHeight)" @update:model-value="v => p.lineHeight = Number(v)"><SelectTrigger aria-label="正文行高"><SelectValue /></SelectTrigger><SelectContent><SelectGroup><SelectItem v-for="height in [...new Set([1.4,1.6,1.8,1.9,2,2.2,2.5,p.lineHeight])].sort()" :key="height" :value="String(height)">{{ height }} 倍{{ height === 1.9 ? '（默认）' : '' }}</SelectItem></SelectGroup></SelectContent></Select></SettingsRow>
                <SettingsRow label="正文宽度" description="标准模式保持约 760px 的阅读宽度。"><Select v-model="p.documentStyle"><SelectTrigger aria-label="文档显示样式"><SelectValue /></SelectTrigger><SelectContent><SelectGroup><SelectItem value="standard">标准模式</SelectItem><SelectItem value="wide">超宽模式</SelectItem></SelectGroup></SelectContent></Select></SettingsRow>
                <div class="my-4 overflow-hidden rounded-xl border border-border/70 bg-muted/20 p-5"><p class="mb-3 text-[11px] text-muted-foreground">排版预览</p><p class="break-words font-[family-name:var(--body-font)] text-[length:var(--body-size)] leading-[var(--body-line-height)]">把想法写下来，让文字慢慢长出来。<br />A quiet space for your next idea.</p></div>
</SettingsSection><SettingsSection title="源码与代码">
                <SettingsRow id="codeFont" label="源码 / 代码字体"><Select v-model="p.codeFont"><SelectTrigger id="codeFont" aria-label="源码 / 代码字体" class="w-full"><SelectValue/></SelectTrigger><SelectContent><SelectGroup><SelectItem v-for="font in fontOptions" :key="font" :value="font">{{font==='system-ui'?'系统默认字体':font==='ui-monospace'?'系统等宽字体':font}}</SelectItem></SelectGroup></SelectContent></Select></SettingsRow>
                <SettingsRow label="源码 / 代码字号"><SettingsNumberSelect v-model="p.codeSize" :min="10" :max="36" :presets="uiSizes" label="源码 / 代码字号" /></SettingsRow>
                <SettingsRow id="line-numbers" label="显示行号" description="源码显示行号，其余视图显示内容块的起始行号。"><div class="flex justify-end"><Switch id="line-numbers" v-model="p.lineNumbers" /></div></SettingsRow>
              </SettingsSection></FieldGroup>
            </div></TabsContent>
            <TabsContent v-for="section in ['safety','templates','desktop']" :key="section" :value="section" class="settings-content m-0 outline-none"><AdvancedSettings :section="section"/></TabsContent>
          <TabsContent value="tags" class="m-0 pt-5 outline-none"><TagManager @busy="tagBusy = $event" /></TabsContent>
            <TabsContent value="shortcuts" class="m-0 pt-4 outline-none"><dl class="flex flex-col"><div v-for="[label, shortcut] in shortcuts" :key="label" class="flex flex-wrap items-center justify-between gap-3 border-b border-border/60 py-4 last:border-0"><dt class="text-sm">{{ label }}</dt><dd><kbd class="rounded-md border border-border bg-muted/50 px-2 py-1 text-xs text-muted-foreground">{{ shortcut }}</kbd></dd></div></dl></TabsContent>

          </div>
          <div v-if="resetKeys[category]" class="flex shrink-0 items-center justify-between gap-3 border-t border-border/60 px-6 py-4 sm:px-8"><Button variant="ghost" size="sm" :disabled="tagBusy" @click="resetCategory"><RotateCcwIcon data-icon="inline-start" />恢复此分类默认设置</Button></div>
        </Card>
      </Tabs>
    </section>
<TemplateHelpDialog v-model:open="templateHelp"/>
</template>
