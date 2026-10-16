<script setup lang="ts">
import { computed, ref, watch, nextTick, onMounted } from 'vue'
import { PopoverRoot, PopoverTrigger, PopoverPortal, PopoverContent } from 'reka-ui'
import { call, desktop } from '@/services/api'
import TemplateHelpDialog from './TemplateHelpDialog.vue'
import AccentPalettePicker from './AccentPalettePicker.vue'
import { version as appVersion } from '../../package.json'
import { ArrowLeftIcon, SunIcon, MoonIcon, MonitorIcon, RotateCcwIcon, PenLineIcon, CodeXmlIcon, Columns2Icon, BookOpenIcon, PaletteIcon, SlidersHorizontalIcon, FileTextIcon, CheckIcon, CircleHelpIcon, InfoIcon } from '@lucide/vue'
import { Tabs, TabsContent } from '@/components/ui/tabs'
import { FieldGroup, Field, FieldLabel } from '@/components/ui/field'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Select, SelectTrigger, SelectValue, SelectContent, SelectGroup, SelectItem } from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { Badge } from '@/components/ui/badge'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import AdvancedSettings from './AdvancedSettings.vue'
import BrandMark from './BrandMark.vue'
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
import { configured } from '@/services/privacy'
import { solarTermColors } from '@/constants/solarTermColors'
import { accentPalettes } from '@/constants/accentPalettes'

const props = defineProps<{ open: boolean; section?: string }>()
const emit = defineEmits<{ 'update:open': [value: boolean] }>()
const store = useWorkbench(), p = computed(() => store.preferences), tagBusy = ref(false), category = ref('general')
const categories = [
  { value: 'general', label: '通用', icon: SlidersHorizontalIcon, description: '管理工作区布局和桌面行为' },
  { value: 'appearance', label: '外观', icon: PaletteIcon, description: '选择适合你的主题与界面尺寸' },
  { value:'writing',label:'写作',icon:PenLineIcon,description: '管理编辑体验、模板、标签与快捷键' },
  { value:'safety',label:'数据与安全',icon:FileTextIcon,description: '管理保存、备份、数据目录与隐私' },
  { value:'about',label:'关于',icon:InfoIcon,description: '查看 MarkFlow 版本与更新' },
]
const templateHelp=ref(false)
const settingsQuery=ref('')
const settingIndex=[
  ...categories.map(c=>({category:c.value,label:c.label})),
  ...['最近文档显示数量','最近文档排序','默认编辑视图','分屏同步滚动','显示工作区侧栏','显示文档大纲','显示顶部菜单','收起侧栏宽度','关闭到系统托盘'].map(label=>({category:'general',label})),
  ...['正文显示主题','动效强度','降低材质效果','代码自动换行','代码块行号','代码语法高亮','界面材质','界面圆角','毛玻璃模糊','显示模式','主题色','全局界面字号','界面密度','背景颜色','正文颜色','代码主题'].map(label=>({category:'appearance',label})),
  ...['正文字体','正文字号','正文行高','代码字体','代码字号','打字机滚动','打字机位置','Markdown 语法补全','斜杠命令','自动定位当前文档','自定义模板名称','模板 Markdown','占位符','标签管理','快捷键'].map(label=>({category:'writing',label})),
  ...['自动保存','自动保存延迟','失焦保存','关闭前保存','历史版本保留数量','数据目录','工作区备份目录','备份保留数量','定期备份','隐私与锁屏','锁屏密码','新密码','修改密码','移除密码'].map(label=>({category:'safety',label})),
  {category:'about',label:'检查更新'},{category:'about',label:'关于 MarkFlow'},
  {category:'writing',label:'正文排版'},{category:'writing',label:'源码与代码'},
]
const settingsResults=computed(()=>settingsQuery.value.trim()?settingIndex.filter(s=>s.label.toLowerCase().includes(settingsQuery.value.toLowerCase())):[])
async function locate(item:{category:string;label:string}){category.value=item.category;settingsQuery.value='';await nextTick();const labels=[...document.querySelectorAll<HTMLElement>('.settings-dialog [data-slot=field-label], .settings-dialog h3')];labels.find(el=>el.textContent?.includes(item.label))?.closest('[data-slot=field], .settings-section')?.scrollIntoView({block:'center',behavior:'smooth'})}
const currentCategory = computed(() => categories.find(c => c.value === category.value) || categories[0]!)
const sectionAliases: Record<string, string> = { privacy: 'safety', typography: 'writing', toolbar: 'writing', templates: 'writing', tags: 'writing', shortcuts: 'writing', desktop: 'general' }
watch(() => [props.open, props.section] as const, async ([open, section]) => {
  if (!open || !section) return
  const target = sectionAliases[section] || section
  if (!categories.some(c => c.value === target)) return
  category.value = target
  await nextTick()
  document.getElementById(`settings-${section}`)?.scrollIntoView({ block: 'start' })
}, { immediate: true })
const brandColor = { value:'#4f9b75', name:'品牌色' }
const accentPaletteList = Object.values(accentPalettes)
const selectedAccentPaletteColor = computed(() => accentPaletteList.some(palette => palette.colors.some(color => color.value.toLowerCase() === p.value.accent.toLowerCase())))
const isBrandColor = computed(() => p.value.accent.toLowerCase() === brandColor.value)
const solarTermOpen = ref(false)
const selectedSolarTerm = ref(solarTermColors[0]!.name)
const activeSolarTerm = computed(() => solarTermColors.find(term => term.name === selectedSolarTerm.value) ?? solarTermColors[0]!)
const selectedSolarTermColor = computed(() => solarTermColors.flatMap(term => term.colors.map(color => ({ ...color, season: term.name }))).find(color => color.value === p.value.accent.toLowerCase()))
const isCustomAccent = computed(() => !isBrandColor.value && !selectedAccentPaletteColor.value && !selectedSolarTermColor.value)
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
          <ScrollArea class="min-h-0 w-full flex-1">
            <nav aria-label="设置分类" class="flex flex-col gap-1 p-1">
              <Button v-for="item in categories" :key="item.value" :variant="category === item.value ? 'secondary' : 'ghost'" :aria-current="category === item.value ? 'page' : undefined" :disabled="tagBusy" class="h-10 w-full shrink-0 justify-start gap-3 px-3" @click="category = item.value"><component :is="item.icon" />{{ item.label }}</Button>
            </nav>
          </ScrollArea>
          <Button variant="ghost" class="h-10 w-full shrink-0 justify-start gap-3 px-3 text-foreground/60 hover:bg-muted hover:text-foreground" :disabled="tagBusy" @click="emit('update:open',false)"><ArrowLeftIcon class="size-4" /><span>返回应用</span></Button>
        </Card>
        <div class="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">      <div class="relative border-b px-6 py-2"><Input v-model="settingsQuery" aria-label="搜索设置" placeholder="搜索设置，例如自动保存、字体…"/><div v-if="settingsQuery" class="absolute inset-x-6 top-full z-10"><ScrollArea class="h-64 rounded-lg border bg-popover shadow-lg"><div class="p-1"><Button v-for="item in settingsResults" :key="item.category+item.label" variant="ghost" class="w-full justify-start" @click="locate(item)">{{item.label}}<span class="ml-auto text-xs text-muted-foreground">{{categories.find(c=>c.value===item.category)?.label}}</span></Button><p v-if="!settingsResults.length" class="p-3 text-sm text-muted-foreground">没有匹配设置。</p></div></ScrollArea></div></div>

          <div class="relative z-10 shrink-0 bg-[color-mix(in_srgb,var(--muted)_40%,var(--background))] px-6 pb-3 pt-3 sm:px-8"><div class="flex items-center justify-between gap-3"><h2 class="min-w-0 text-lg font-semibold tracking-tight">{{ currentCategory.label }}</h2><Button v-if="resetKeys[category]" variant="ghost" size="sm" class="shrink-0" :disabled="tagBusy" @click="resetCategory"><RotateCcwIcon data-icon="inline-start" />恢复此分类默认设置</Button></div><p class="mt-1.5 text-xs leading-relaxed text-muted-foreground">{{ currentCategory.description }}</p></div>
          <ScrollArea :key="category" class="min-h-0 flex-1">
            <div class="px-6 pb-6 pt-3 sm:px-8">

<TabsContent value="general" class="m-0 outline-none">
              <FieldGroup class="gap-0">
<SettingsSection title="文档导航"><NavigationSettings/></SettingsSection>
<SettingsSection title="工作区布局">
                <SettingsRow label="默认编辑视图" description="首次打开文档时使用的编辑方式"><Select :model-value="p.defaultView" @update:model-value="v => p.defaultView = v as typeof p.defaultView"><SelectTrigger aria-label="默认编辑视图"><SelectValue /></SelectTrigger><SelectContent><SelectGroup><SelectItem v-for="view in views" :key="view.value" :value="view.value"><component :is="viewIcons[view.value]" />{{ view.label }}</SelectItem></SelectGroup></SelectContent></Select></SettingsRow>
                <SettingsRow id="sync-scroll" label="分屏同步滚动" description="编辑源码时，让右侧预览跟随阅读位置"><div class="flex justify-end"><Switch id="sync-scroll" v-model="p.syncScroll" /></div></SettingsRow>
                <SettingsRow id="sidebar-visible" label="显示工作区侧栏" description="在左侧浏览本地文件夹和文档"><div class="flex justify-end"><Switch id="sidebar-visible" v-model="p.sidebar" /></div></SettingsRow>
                <SettingsRow id="outline-visible" label="显示文档大纲" description="在右侧查看章节，并快速跳转"><div class="flex justify-end"><Switch id="outline-visible" v-model="p.outline" /></div></SettingsRow>
                <SettingsRow id="header-visible" label="显示顶部菜单" description="提供文件、编辑、视图和导出的完整入口"><div class="flex justify-end"><Switch id="header-visible" v-model="p.header" /></div></SettingsRow>
                <SettingsRow label="收起侧栏宽度" description="调整折叠侧栏的图标区域，默认 50px"><SettingsNumberSelect v-model="p.collapsedSidebarWidth" :min="40" :max="120" :presets="widthSizes" label="收起侧栏宽度" /></SettingsRow>
              </SettingsSection>
              </FieldGroup>
              <SettingsSection id="settings-desktop" title="桌面行为" class="mt-4"><AdvancedSettings section="desktop" /></SettingsSection>
            </TabsContent>
            <TabsContent value="appearance" class="m-0 outline-none">
              <FieldGroup class="gap-0">
                <SettingsSection title="主题与界面"><MaterialSettings />
                <SettingsRow label="显示模式" description="跟随系统可以自动切换亮色与暗色"><ToggleGroup type="single" variant="segmented" :spacing="1" :model-value="p.mode" aria-label="显示模式" @update:model-value="v => { if (v) p.mode = v as typeof p.mode }"><ToggleGroupItem value="light"><SunIcon />亮色</ToggleGroupItem><ToggleGroupItem value="dark"><MoonIcon />暗色</ToggleGroupItem><ToggleGroupItem value="system"><MonitorIcon />系统</ToggleGroupItem></ToggleGroup></SettingsRow>
                <SettingsRow label="界面密度" description="调整列表与工具栏的留白"><Select v-model="p.density"><SelectTrigger aria-label="界面密度"><SelectValue/></SelectTrigger><SelectContent><SelectGroup><SelectItem value="compact">紧凑</SelectItem><SelectItem value="standard">标准</SelectItem><SelectItem value="comfortable">宽松</SelectItem></SelectGroup></SelectContent></Select></SettingsRow><SettingsRow label="背景颜色" description="立即预览自定义背景，可恢复主题默认"><div class="flex items-center gap-2"><Input :model-value="p.background||'#ffffff'" type="color" aria-label="自定义背景颜色" class="size-8 p-1" @update:model-value="p.background=String($event)"/><Button variant="ghost" size="sm" @click="p.background=''">默认</Button></div></SettingsRow><SettingsRow label="正文颜色" description="对比度不足时自动使用清晰的文字颜色"><div class="flex items-center gap-2"><Input :model-value="p.textColor||'#333333'" type="color" aria-label="自定义正文颜色" class="size-8 p-1" @update:model-value="p.textColor=String($event)"/><Button variant="ghost" size="sm" @click="p.textColor=''">默认</Button></div></SettingsRow><SettingsRow label="代码主题"><Select v-model="p.codeTheme"><SelectTrigger aria-label="代码主题"><SelectValue/></SelectTrigger><SelectContent><SelectGroup><SelectItem value="auto">跟随界面</SelectItem><SelectItem value="light">亮色代码</SelectItem><SelectItem value="dark">暗色代码</SelectItem><SelectItem value="nord">极地</SelectItem><SelectItem value="sepia">暖纸</SelectItem></SelectGroup></SelectContent></Select></SettingsRow><SettingsRow label="全局界面字号" description="调整菜单、设置和按钮大小，不影响正文字号"><SettingsNumberSelect v-model="p.uiSize" :min="12" :max="20" :presets="uiSizes" label="全局界面字号" /></SettingsRow>
                <Field class="gap-4 py-5">
                  <FieldLabel>主题色</FieldLabel>
                  <div class="flex flex-wrap items-start gap-3">
                    <ToggleGroup type="single" :spacing="2" :model-value="p.accent.toLowerCase()" aria-label="预设主题色" class="flex-wrap" @update:model-value="v => { if (v) p.accent = String(v) }">
                      <ToggleGroupItem :value="brandColor.value" :aria-label="`主题色 ${brandColor.name}${isBrandColor ? ` ${brandColor.value.toUpperCase()}` : ''}`" class="h-auto shrink-0 gap-2 rounded-lg px-2 py-2" :class="isBrandColor && 'bg-accent text-accent-foreground ring-1 ring-primary/30'">
                        <span class="flex size-5 items-center justify-center rounded-full" :class="{ 'ring-2 ring-primary ring-offset-2 ring-offset-card': p.accent.toLowerCase() === brandColor.value }" :style="{ backgroundColor: brandColor.value, color: '#ffffff' }"><CheckIcon v-if="p.accent.toLowerCase() === brandColor.value" class="size-3.5" /></span>
                        <span class="whitespace-nowrap text-xs">{{ brandColor.name }}<template v-if="isBrandColor"> - {{ brandColor.value.toUpperCase() }}</template></span>
                      </ToggleGroupItem>
                    </ToggleGroup>


                    <AccentPalettePicker
                      v-for="palette in accentPaletteList"
                      :key="palette.name"
                      :name="palette.name"
                      :description="palette.description"
                      :colors="palette.colors"
                      :model-value="p.accent"
                      @update:model-value="p.accent = $event"
                    />
                    <PopoverRoot v-model:open="solarTermOpen">
                      <PopoverTrigger as-child>
                        <button type="button" :aria-label="`中国传统色・24节气${selectedSolarTermColor ? `，当前${selectedSolarTermColor.season} ${selectedSolarTermColor.name}` : ''}`" class="inline-flex h-auto shrink-0 items-center gap-2 rounded-lg px-2 py-2 text-xs transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:outline-2 focus-visible:outline-ring" :class="selectedSolarTermColor || solarTermOpen ? 'bg-accent text-accent-foreground ring-1 ring-primary/30' : 'text-muted-foreground'">
                          <span class="flex size-5 items-center justify-center rounded-full ring-1 ring-border" :style="{ backgroundColor: selectedSolarTermColor?.value ?? 'var(--muted)', color: '#ffffff' }"><CheckIcon v-if="selectedSolarTermColor" class="size-3.5" /><PaletteIcon v-else class="size-3.5" /></span>
                          <span>中国传统色・24节气<template v-if="selectedSolarTermColor"> - {{ selectedSolarTermColor.season }}·{{ selectedSolarTermColor.name }}</template></span>
                        </button>
                      </PopoverTrigger>
                      <PopoverPortal>
                        <PopoverContent align="start" :side-offset="6" class="w-[min(22rem,calc(100vw-2rem))] rounded-xl border border-border bg-popover p-3 text-popover-foreground shadow-md" @open-auto-focus.prevent>
                          <div class="mb-3 flex items-center justify-between gap-3">
                            <div>
                              <p class="text-sm font-medium">中国传统色・24节气</p>
                              <p class="mt-0.5 text-xs text-muted-foreground">按节气浏览传统配色</p>
                            </div>
                            <Select v-model="selectedSolarTerm">
                              <SelectTrigger aria-label="选择节气" class="h-8 w-28 text-xs"><SelectValue /></SelectTrigger>
                              <SelectContent><SelectGroup><SelectItem v-for="term in solarTermColors" :key="term.name" :value="term.name">{{ term.name }}</SelectItem></SelectGroup></SelectContent>
                            </Select>
                          </div>
                          <ScrollArea class="h-64 pr-1"><div role="group" :aria-label="`${activeSolarTerm.name}颜色`" class="grid grid-cols-2 gap-1">
                            <button v-for="color in activeSolarTerm.colors" :key="`${activeSolarTerm.name}-${color.name}-${color.value}`" type="button" :aria-label="`${activeSolarTerm.name} ${color.name} ${color.value}`" :aria-pressed="p.accent.toLowerCase() === color.value" class="flex min-w-0 items-center gap-2 rounded-md px-2 py-2 text-left text-xs transition-colors hover:bg-accent focus-visible:outline-2 focus-visible:outline-ring" :class="p.accent.toLowerCase() === color.value && 'bg-accent text-accent-foreground'" @click="p.accent = color.value; solarTermOpen = false">
                              <span class="size-5 shrink-0 rounded-full border border-border/70" :style="{ backgroundColor: color.value }"></span>
                              <span class="min-w-0 flex-1 truncate">{{ color.name }}</span>
                              <span class="shrink-0 font-mono text-[10px] text-muted-foreground">{{ color.value.toUpperCase() }}</span>
                            </button>
                          </div></ScrollArea>
                        </PopoverContent>
                      </PopoverPortal>
                    </PopoverRoot>
                    <label class="flex shrink-0 cursor-pointer items-center gap-2 whitespace-nowrap rounded-lg px-2 py-2 text-xs transition-colors hover:bg-accent hover:text-accent-foreground" :class="isCustomAccent ? 'bg-accent text-accent-foreground ring-1 ring-primary/30' : 'text-muted-foreground'">
                      <span class="relative block size-5 overflow-hidden rounded-full ring-1 ring-border focus-within:ring-2 focus-within:ring-ring" :style="{ backgroundColor: p.accent }"><Input v-model="p.accent" type="color" class="absolute inset-0 size-full cursor-pointer opacity-0" aria-label="自定义主题色" /></span>
                      <span>自定义<template v-if="isCustomAccent"> - {{ p.accent.toUpperCase() }}</template></span>
                    </label>
                  </div>

                </Field>
              </SettingsSection><SettingsSection title="阅读与代码显示"><ReadingSettings/></SettingsSection></FieldGroup>
              <Card class="mt-4 gap-0 border-border/70 bg-card p-5 shadow-sm"><p class="text-[11px] text-muted-foreground">主题预览</p><div class="mt-3 flex items-center gap-3"><div class="flex size-9 items-center justify-center rounded-lg bg-accent text-accent-foreground"><FileTextIcon class="size-4" /></div><div><p class="text-sm font-medium">一份新的写作灵感</p><p class="mt-1 text-xs text-muted-foreground">主题色用于选中状态与重要入口</p></div></div></Card>
            </TabsContent>

<TabsContent value="writing" class="m-0 outline-none"><SettingsSection title="编辑辅助"><AdvancedSettings section="writing"/></SettingsSection><div id="settings-typography">
              <p v-if="fontError" class="py-2 text-xs text-muted-foreground">{{fontError}}</p><FieldGroup class="gap-0"><SettingsSection title="正文排版">
                <SettingsRow id="bodyFont" label="正文字体" description="选择本机已安装字体，或跟随系统默认字体"><Select v-model="p.bodyFont"><SelectTrigger id="bodyFont" aria-label="正文字体" class="w-full"><SelectValue/></SelectTrigger><SelectContent><SelectGroup><SelectItem v-for="font in fontOptions" :key="font" :value="font">{{font==='system-ui'?'系统默认字体':font==='ui-monospace'?'系统等宽字体':font}}</SelectItem></SelectGroup></SelectContent></Select></SettingsRow>
                <SettingsRow label="正文字号"><SettingsNumberSelect v-model="p.bodySize" :min="10" :max="36" :presets="bodySizes" label="正文字号" /></SettingsRow>
                <SettingsRow label="正文行高" description="应用于可视化编辑和阅读预览"><Select :model-value="String(p.lineHeight)" @update:model-value="v => p.lineHeight = Number(v)"><SelectTrigger aria-label="正文行高"><SelectValue /></SelectTrigger><SelectContent><SelectGroup><SelectItem v-for="height in [...new Set([1.4,1.6,1.8,1.9,2,2.2,2.5,p.lineHeight])].sort()" :key="height" :value="String(height)">{{ height }} 倍{{ height === 1.9 ? '（默认）' : '' }}</SelectItem></SelectGroup></SelectContent></Select></SettingsRow>
                <SettingsRow label="正文宽度" description="标准模式保持约 760px 的阅读宽度"><Select v-model="p.documentStyle"><SelectTrigger aria-label="文档显示样式"><SelectValue /></SelectTrigger><SelectContent><SelectGroup><SelectItem value="standard">标准模式</SelectItem><SelectItem value="wide">超宽模式</SelectItem></SelectGroup></SelectContent></Select></SettingsRow>
                <div class="my-4 overflow-hidden rounded-xl border border-border/70 bg-muted/20 p-5"><p class="mb-3 text-[11px] text-muted-foreground">排版预览</p><p class="break-words font-[family-name:var(--body-font)] text-[length:var(--body-size)] leading-[var(--body-line-height)]">把想法写下来，让文字慢慢长出来。<br />A quiet space for your next idea.</p></div>
</SettingsSection><SettingsSection title="源码与代码">
                <SettingsRow id="codeFont" label="源码 / 代码字体"><Select v-model="p.codeFont"><SelectTrigger id="codeFont" aria-label="源码 / 代码字体" class="w-full"><SelectValue/></SelectTrigger><SelectContent><SelectGroup><SelectItem v-for="font in fontOptions" :key="font" :value="font">{{font==='system-ui'?'系统默认字体':font==='ui-monospace'?'系统等宽字体':font}}</SelectItem></SelectGroup></SelectContent></Select></SettingsRow>
                <SettingsRow label="源码 / 代码字号"><SettingsNumberSelect v-model="p.codeSize" :min="10" :max="36" :presets="uiSizes" label="源码 / 代码字号" /></SettingsRow>
                <SettingsRow id="line-numbers" label="显示行号" description="源码显示行号，其余视图显示内容块的起始行号"><div class="flex justify-end"><Switch id="line-numbers" v-model="p.lineNumbers" /></div></SettingsRow>
              </SettingsSection></FieldGroup>
            </div>
              <div id="settings-templates" class="scroll-mt-4 flow-root mb-4">
                <div class="mb-2 flex justify-end"><Button variant="ghost" size="sm" aria-label="模板使用说明" @click="templateHelp=true"><CircleHelpIcon data-icon="inline-start" />模板使用说明</Button></div>
                <SettingsSection title="模板管理"><AdvancedSettings section="templates" /></SettingsSection>
              </div>
              <SettingsSection id="settings-tags" title="标签管理"><TagManager @busy="tagBusy = $event" /></SettingsSection>
              <SettingsSection id="settings-shortcuts" title="常用快捷键"><dl class="flex flex-col"><div v-for="[label, shortcut] in shortcuts" :key="label" class="flex flex-wrap items-center justify-between gap-3 border-b border-border/60 py-4 last:border-0"><dt class="text-sm">{{ label }}</dt><dd><kbd class="rounded-md border border-border bg-muted/50 px-2 py-1 text-xs text-muted-foreground">{{ shortcut }}</kbd></dd></div></dl></SettingsSection>
            </TabsContent>
            <TabsContent value="safety" class="m-0 outline-none"><AdvancedSettings section="safety"/><SettingsSection id="settings-privacy" title="隐私与锁屏" class="mt-4" :status="configured ? '已设置密码' : '未设置密码'" :status-tone="configured ? 'primary' : 'muted'"><PrivacySettings/></SettingsSection></TabsContent>
            <TabsContent value="about" class="m-0 outline-none"><div id="settings-about" class="flex flex-col items-start gap-5 pt-4"><BrandMark role="img" aria-label="MarkFlow" class="size-14 rounded-2xl" /><div class="flex items-center gap-3"><h3 class="text-2xl font-semibold tracking-tight">MarkFlow</h3><Tooltip><TooltipTrigger as-child><Badge tabindex="0">v{{ appVersion }}</Badge></TooltipTrigger><TooltipContent>当前版本</TooltipContent></Tooltip></div><div class="w-full"><AdvancedSettings section="about"/></div></div></TabsContent>

            </div>
          </ScrollArea>
        </div>
      </Tabs>
    </section>
<TemplateHelpDialog v-model:open="templateHelp"/>
</template>
