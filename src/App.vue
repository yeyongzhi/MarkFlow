<script setup lang="ts">
import TocDialog from '@/components/TocDialog.vue'
import OpenTabsDialog from '@/components/OpenTabsDialog.vue'
import { ListFilterIcon } from '@lucide/vue'
import KnowledgeDialog from '@/components/KnowledgeDialog.vue'
import { knowledgeOpen,knowledgeTab,tagFilter } from '@/services/knowledge'
import { NetworkIcon } from '@lucide/vue'
import LockScreen from '@/components/LockScreen.vue'
import { locked, configured, privacyStatus } from '@/services/privacy'
import { LockKeyholeIcon } from '@lucide/vue'
import {readableText} from '@/services/theme'
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { listen, type UnlistenFn } from '@tauri-apps/api/event'
import { getCurrentWindow } from '@tauri-apps/api/window'
import { toast } from 'vue-sonner'
import { SearchIcon, BookOpenIcon, PlusIcon, FolderPlusIcon, FilePlusIcon, XIcon, ChevronRightIcon, CheckIcon, CircleIcon, RefreshCwIcon, AlertCircleIcon, FileTextIcon, PenLineIcon, CodeXmlIcon, Columns2Icon, ClockIcon } from '@lucide/vue'
import { Button } from '@/components/ui/button'
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuGroup, DropdownMenuItem } from '@/components/ui/dropdown-menu'
import { Badge } from '@/components/ui/badge'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { Empty, EmptyHeader, EmptyMedia, EmptyTitle, EmptyDescription, EmptyContent } from '@/components/ui/empty'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog'
import { AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle, AlertDialogDescription, AlertDialogFooter, AlertDialogCancel } from '@/components/ui/alert-dialog'
import { Field, FieldGroup, FieldLabel, FieldDescription } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectTrigger, SelectValue, SelectContent, SelectGroup, SelectItem } from '@/components/ui/select'
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert'
import { Toaster } from '@/components/ui/sonner'
import TreeNode from '@/components/TreeNode.vue'
import SettingsDialog from '@/components/SettingsDialog.vue'
import SidebarControls from '@/components/SidebarControls.vue'
import SidebarLibrary from '@/components/SidebarLibrary.vue'
import EditorPane from '@/components/EditorPane.vue'
import { ImagePlusIcon } from '@lucide/vue'
import ArchiveDialog from '@/components/ArchiveDialog.vue'
import DocumentTags from '@/components/DocumentTags.vue'
import DocumentActions from '@/components/DocumentActions.vue'
import FindBar from '@/components/FindBar.vue'
import SearchDialog from '@/components/SearchDialog.vue'
import ExportDialog from '@/components/ExportDialog.vue'
import StructureDialog from '@/components/StructureDialog.vue'
import TabContextMenu from '@/components/TabContextMenu.vue'
import { useWorkbench } from '@/stores/workbench'
import { call, desktop, message } from '@/services/api'
import AnalysisWorker from '@/services/analysis.worker?worker'
import { headings, plainText } from '@/services/markdown'
import { views, type Document } from '@/types'
import { cn } from '@/lib/utils'
import SafetyDialog from '@/components/SafetyDialog.vue'
import LibraryDialog from '@/components/LibraryDialog.vue'
import { templateCatalog } from '@/services/template-catalog'
import { templateText,tidy } from '@/services/writing'
import AppMenubar from '@/components/AppMenubar.vue'
import WindowControls from '@/components/WindowControls.vue'
import CommandPalette from '@/components/CommandPalette.vue'
import { SettingsIcon, SunIcon, MoonIcon, MonitorIcon, CommandIcon, DownloadIcon, SaveIcon, Undo2Icon, Redo2Icon, BoldIcon, ItalicIcon, HeadingIcon, ListIcon, QuoteIcon, TableIcon, SquareCodeIcon, PanelLeftIcon, PanelRightIcon, MaximizeIcon, KeyboardIcon, InfoIcon, ArchiveIcon, FolderIcon } from '@lucide/vue'
import type { AppCommand } from '@/types/commands'

const codeBlockIndex=ref<number>(),tocOpen=ref(false),tabsOpen=ref(false)
const store = useWorkbench(), settings = ref(false), recovery = ref(false), busy = ref(false), bootError = ref(''), systemDark = ref(matchMedia('(prefers-color-scheme: dark)').matches)
const refreshing = ref(false), adding = ref(false)
const archivesOpen = ref(false), safetyOpen=ref(false), safetyKind=ref<'history'|'conflict'|'backups'|'format'>('history'), libraryOpen=ref(false), libraryFavorites=ref(false), templateId=ref('blank'), cleanupOpen=ref(false), cleanupText=ref(''), cleanupBefore=ref(''), draggedTab=ref(''), draftPreview=ref(''), toolbarHost=ref<HTMLElement>(), toolbarActions=ref<HTMLElement>(), toolbarWidth=ref(0), toolbarActionsWidth=ref(300)
function showSafety(kind:'history'|'conflict'|'backups'|'format'){syncEditors();safetyKind.value=kind;safetyOpen.value=true}
function showLibrary(favorites=false){libraryFavorites.value=favorites;libraryOpen.value=true}
function previewCleanup(){syncEditors();cleanupBefore.value=store.active?.text||'';cleanupText.value=tidy(cleanupBefore.value);cleanupOpen.value=true}
function applyCleanup(){if(store.active?.text!==cleanupBefore.value){toast.error('文档已变化，请重新预览。');return}store.change(store.active!,cleanupText.value,'tidy');store.active!.generation++;cleanupOpen.value=false;toast.success('Markdown 整理已应用')}
async function revealCurrentDocument(){await store.reveal();await nextTick();const target=document.querySelector<HTMLButtonElement>('.file-tree .tree-row-active .tree-label');target?.scrollIntoView({block:'nearest'});target?.focus({preventScroll:true})}
async function navigate(delta:number){syncEditors();const position=await store.navigate(delta);if(position!==undefined&&store.active){await nextTick();void panes.get(store.active.id)?.selectRange(position,position)}}
const fullToolbar=computed(()=>toolbarWidth.value-toolbarActionsWidth.value>Math.max(180,(14-store.preferences.toolbarHidden.length)*34+220))
let toolbarObserver:ResizeObserver|undefined
let backupTick:ReturnType<typeof setInterval>, backupRunning=false, lastBackup=Date.now()
const commandOpen = ref(false), settingsSection = ref('general'), exportFormat = ref<'pdf' | 'html' | 'zip'>('pdf')
async function lockApp(){if(!configured.value){openSettings('privacy');return}syncEditors();await store.suspend();if(!await store.protectDrafts())return;await store.persistNow();await call('privacy_lock');locked.value=true;settings.value=false;toast.dismiss()}
async function unlocked(){if(!store.ready)await bootWorkbench()}
function openSettings(section = 'general') { settingsSection.value = section; settings.value = true }
const documentInfo = ref(false), findOpen = ref(false), searchOpen = ref(false), searchContent = ref(false), exportOpen = ref(false), structureOpen = ref(false), structureKind = ref<'table' | 'code'>('table'), focusMode = ref(false), selectedText = ref('')
const readingStats = ref({ words: 0, minutes: 0 })
let statsTimer: ReturnType<typeof setTimeout>, analysisTimeout: ReturnType<typeof setTimeout>, analysisWorker: Worker | undefined
watch(tagFilter,tag=>{if(tag){syncEditors();searchContent.value=true;searchOpen.value=true}})
function openSearch(content: boolean) { syncEditors(); tagFilter.value='';searchContent.value = content; searchOpen.value = true }
function openStructure(kind: 'table' | 'code',index?:number) {codeBlockIndex.value=index; syncEditors(); structureKind.value = kind; structureOpen.value = true }
function openExport(format: 'pdf' | 'html' | 'zip' = 'pdf') { syncEditors(); exportFormat.value = format; exportOpen.value = true }
async function jumpSearch(line: number) { await nextTick(); if (store.active) await panes.get(store.active.id)?.jumpLine(line) }
async function selectMatch(start: number,end: number) { if (store.active) await panes.get(store.active.id)?.selectRange(start,end) }

const clockTime = ref(new Date())
const currentTime = computed(() => clockTime.value.toLocaleString('zh-CN', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false }))
const fileMetadata = ref<{ createdAt: number | null; modifiedAt: number | null; encoding?:string; readonly?:boolean }>({ createdAt: null, modifiedAt: null })
let metadataRequest = 0
async function refreshMetadata() {
  const request = ++metadataRequest, d = store.active
  if (!d || d.temporary) { fileMetadata.value = { createdAt: null, modifiedAt: null }; return }
  try { const value = await call<typeof fileMetadata.value>('document_metadata', { workspaceId: d.workspaceId, path: d.path }); if (request === metadataRequest) fileMetadata.value = value }
  catch { if (request === metadataRequest) fileMetadata.value = { createdAt: null, modifiedAt: null } }
}
watch(() => [store.active?.id, store.active?.path, store.active?.status], () => { void refreshMetadata() })
const formatTimestamp = (value: number | null) => value === null ? '不可用' : new Date(value).toLocaleString('zh-CN', { hour12: false })
const clockTimer = setInterval(() => { clockTime.value = new Date() }, 1000)
const metadataTimer = setInterval(() => { if (!locked.value && document.visibilityState === 'visible') void refreshMetadata() }, 5000)
const viewIcons = { live: PenLineIcon, source: CodeXmlIcon, split: Columns2Icon, preview: BookOpenIcon }
const dark = computed(() => store.preferences.mode === 'dark' || (store.preferences.mode === 'system' && systemDark.value))
const outline = ref<ReturnType<typeof headings>>([])
watch(() => [store.active?.id, store.active?.text], (value, previous) => {
  selectedText.value = ''; clearTimeout(statsTimer); clearTimeout(analysisTimeout); analysisWorker?.terminate()
  if (value[0] !== previous?.[0]) { outline.value = []; readingStats.value = { words: 0, minutes: 0 } }
  statsTimer = setTimeout(() => {
    analysisWorker = new AnalysisWorker()
    analysisWorker.onmessage = e => { outline.value = e.data.headings; readingStats.value = { words: e.data.words, minutes: e.data.minutes }; clearTimeout(analysisTimeout); analysisWorker?.terminate() }
    analysisWorker.postMessage(store.active?.text || '')
    analysisTimeout = setTimeout(() => { analysisWorker?.terminate() }, 5000)
  },180)
}, { immediate: true })
const workspace = computed(() => store.workspaces.find(w => w.id === store.active?.workspaceId)), filename = (path: string) => path.split('/').at(-1) || path
const currentFilePath = computed(() => { const d = store.active, w = workspace.value; if (!d) return ''; if (!w || !desktop) return [w?.name, d.path].filter(Boolean).join(' / '); const separator = w.path.includes('\\') ? '\\' : '/'; const displayRoot = w.path.startsWith('\\\\?\\UNC\\') ? '\\\\' + w.path.slice(8) : w.path.startsWith('\\\\?\\') ? w.path.slice(4) : w.path; return displayRoot.replace(/[\\/]+$/, '') + separator + d.path.replaceAll('/', separator) })
const statusLabels = { clean: '已保存', dirty: '待保存', saving: '保存中…', error: '保存失败', conflict: '外部修改冲突', missing: '文件已不存在' }
const panes = new Map<string, InstanceType<typeof EditorPane>>()
async function manualSave(d: Document) { try { if(await (d.temporary?store.saveAs(d):store.save(d)))toast.success('文档已保存');else toast.error('保存未完成，请处理冲突或错误'); }catch(e){toast.error(message(e))} }
window.addEventListener('lexly-sync-editors',syncEditors)
onBeforeUnmount(()=>window.removeEventListener('lexly-sync-editors',syncEditors))
const fileDialog = ref<{ type: string; workspaceId: string; path: string; isDir: boolean; name: string; destination: string } | null>(null)
const confirmation = ref<{ title: string; description: string; label: string; danger?: boolean; action: () => Promise<unknown> } | null>(null)
const directories = computed(() => { if (!fileDialog.value) return []; const id = fileDialog.value.workspaceId; return [...new Set(Object.entries(store.tree).filter(([key]) => key.startsWith(`${id}|`)).flatMap(([, entries]) => entries.filter(e => e.isDir).map(e => e.path)))] })
const media = matchMedia('(prefers-color-scheme: dark)'), disposers: UnlistenFn[] = []
let poll: ReturnType<typeof setInterval>, refreshTimer: ReturnType<typeof setTimeout>, closing = false
watch([dark, () => store.preferences], () => {
  document.documentElement.classList.toggle('dark', dark.value)
  const p = store.preferences, root = document.documentElement.style
  root.setProperty('--ui-scale', String(p.uiSize / 13))
  root.setProperty('font-size', `${16 * p.uiSize / 13}px`)
  root.setProperty('--primary', p.accent); root.setProperty('--ring', p.accent)
  root.setProperty('--primary-foreground', '#ffffff')
  root.setProperty('--body-line-height', String(p.lineHeight));
  root.setProperty('--body-font', `${JSON.stringify(p.bodyFont)}, system-ui, sans-serif`); root.setProperty('--body-size', `${p.bodySize}px`)
  const material = ['solid', 'soft', 'glass'].includes(p.material) ? p.material : 'soft'; document.documentElement.dataset.material = material;root.setProperty('--radius',Math.max(0,Math.min(20,p.cornerRadius||0))+'px');root.setProperty('--glass-blur',Math.max(8,Math.min(28,p.glassBlur||18))+'px');
  document.documentElement.dataset.bodyTheme=p.bodyTheme;document.documentElement.dataset.motion=p.motion;document.documentElement.dataset.lowEffects=String(p.lowEffects||navigator.hardwareConcurrency<=4);
  document.documentElement.dataset.density=p.density;document.documentElement.dataset.codeTheme=p.codeTheme==='auto'?(dark.value?'dark':'light'):p.codeTheme;
  const themed=['background','foreground','card','card-foreground','popover','popover-foreground','muted','muted-foreground','secondary','secondary-foreground','accent','accent-foreground','border','input','sidebar','sidebar-foreground','sidebar-accent','sidebar-accent-foreground','sidebar-border']
  for(const token of themed)root.removeProperty('--'+token)
  if(/^#[0-9a-f]{6}$/i.test(p.background)){
    const fg=readableText(p.background,p.textColor),surface=`color-mix(in srgb, ${p.background} 95%, ${fg})`
    for(const token of ['background','card','popover'])root.setProperty('--'+token,p.background)
    for(const token of ['foreground','card-foreground','popover-foreground','accent-foreground','secondary-foreground','muted-foreground','sidebar-foreground','sidebar-accent-foreground'])root.setProperty('--'+token,fg)
    for(const token of ['muted','secondary','accent','sidebar','sidebar-accent'])root.setProperty('--'+token,surface)
    for(const token of ['border','input','sidebar-border'])root.setProperty('--'+token,`color-mix(in srgb, ${p.background} 75%, ${fg})`)
  }else if(/^#[0-9a-f]{6}$/i.test(p.textColor))root.setProperty('--foreground',readableText(dark.value?'#000000':'#ffffff',p.textColor))
  root.setProperty('--code-font', `${JSON.stringify(p.codeFont)}, ui-monospace, monospace`); root.setProperty('--code-size', `${p.codeSize}px`)
}, { immediate: true, deep: true })
function report(e: unknown) { toast.error(message(e)) }
async function safely(action: () => Promise<unknown>) { try { await action() } catch(e) { report(e) } }
async function addWorkspace() {
  if (adding.value) return; adding.value = true
  try { const result = await store.addWorkspace(); if (result) { if (result.added) toast.success('工作区添加成功', { description: result.workspace.name }); else toast.info('该工作区已添加', { description: result.workspace.name }) } }
  catch(e) { report(e) } finally { adding.value = false }
}
async function refreshWorkspaces() {
  if (refreshing.value) return; refreshing.value = true
  try { const failures = await store.refresh(); if (failures) toast.warning('工作区已刷新，部分目录无法访问', { description: `${failures} 个目录读取失败，请检查路径或权限。` }); else toast.success('工作区刷新成功') }
  catch(e) { report(e) } finally { refreshing.value = false }
}
function syncEditors() { for (const pane of panes.values()) pane.sync() }
async function copyArticle(format: 'markdown' | 'text') {
  syncEditors()
  const d = store.active
  if (!d) return
  try { await navigator.clipboard.writeText(format === 'markdown' ? d.text : plainText(d.text)); toast.success(format === 'markdown' ? 'Markdown 源码已复制' : '纯文本已复制') }
  catch { toast.error('复制失败，请检查剪贴板访问权限。') }
}
function showDocumentInfo() { syncEditors(); documentInfo.value = true; void refreshMetadata() }
function changeView(view: string) { if (store.active) { panes.get(store.active.id)?.sync(); store.setView(view as typeof store.active.view) } }
async function closeTab(d: Document) {
  await closeTabs([d.id])
}
async function closeTabs(ids: string[]) {
  syncEditors()
  for (const [index, id] of ids.entries()) {
    const d = store.documents.find(document => document.id === id)
    if (!d) continue
    if(d.temporary){confirmation.value={title:'临时文档尚未保存',description:`${filename(d.path)} 尚未保存，直接关闭会丢失全部内容。请取消并保存，或确认关闭。`,label:'不保存并关闭',action:async()=>{await store.close(id,true);await closeTabs(ids.slice(index+1))}};return}
    if (await store.close(id)) continue
    confirmation.value = { title: '文档仍有未保存内容', description: `${filename(d.path)} 保存失败或存在冲突。取消会停止关闭；放弃会丢弃此文档的修改并继续关闭剩余标签。`, label: '放弃修改并继续关闭', action: async () => { await store.close(id, true); await closeTabs(ids.slice(index + 1)) } }
    return
  }
}
const isFavorite = (file: { workspaceId: string; path: string }) => store.preferences.favorites.some(f => f.workspaceId === file.workspaceId && f.path === file.path)
function closeTabScope(d: Document, scope: 'current' | 'others' | 'all' | 'left' | 'right') {
  const pivot=store.documents.findIndex(item=>item.id===d.id);const ids = scope === 'current' ? [d.id] : store.documents.filter((item,i) => scope==='left'?i<pivot:scope==='right'?i>pivot:scope === 'all' || item.id !== d.id).map(item => item.id)
  void safely(() => closeTabs(ids))
}
function action(type: string, workspaceId: string, path: string, isDir: boolean) {
  if(type==='reconnect'){void safely(async()=>{const ws=await call<any>('reconnect_workspace',{workspaceId});if(ws){Object.assign(store.workspaces.find(w=>w.id===workspaceId)!,ws);await store.refresh(workspaceId)}});return}
  if (type === 'open-system') { void safely(() => call('open_in_system_directory', { workspaceId, path })); return }
  if (type === 'archive') confirmation.value = { title: `归档“${filename(path)}”？`, description: '文档将移到此工作区的回收站，可随时恢复。', label: '归档', action: async () => { syncEditors(); await store.archive(workspaceId,path); toast.success('文档已归档') } }
  else if (type === 'trash') confirmation.value = { title: `将“${filename(path)}”移到回收站？`, description: '这会操作真实磁盘文件。文件夹中的所有内容也会移到系统回收站或废纸篓。', label: '移到回收站', danger: true, action: async () => { syncEditors(); await store.trash(workspaceId, path); toast.success('已移到回收站',{description:'删除前副本可从“工作区备份与操作恢复”中恢复。'}) } }
  else if (type === 'remove') confirmation.value = { title: '移除这个工作区？', description: '仅移除左侧入口并关闭相关标签。磁盘文件夹及其中的文档会保留。', label: '移除工作区', danger: true, action: async () => { syncEditors(); await store.removeWorkspace(workspaceId); toast.success('工作区已移除') } }
  else fileDialog.value = { type, workspaceId, path, isDir, name: type === 'rename' ? filename(path) : type === 'file' ? '未命名.md' : type === 'folder' ? '新建文件夹' : '', destination: path.split('/').slice(0, -1).join('/') }
}
async function submitFile() {
  if (!fileDialog.value || busy.value) return; busy.value = true
    try { syncEditors(); const f = fileDialog.value; if (f.type === 'file' || f.type === 'folder') { await store.create(f.workspaceId, f.path, f.name.trim(), f.type === 'folder');if(f.type==='file'&&store.active){const t=templateCatalog(store.preferences.templates,store.preferences.hiddenTemplates).find(t=>t.id===templateId.value);if(t?.text){store.change(store.active,templateText(t.text,f.name),'template');store.active.generation++}} } else await store.relocate(f.workspaceId, f.path, f.destination.replace(/^\/+|\/+$/g, ''), f.type === 'rename' ? f.name.trim() : undefined); toast.success(f.type === 'rename' ? '重命名成功' : f.type === 'move' ? '移动成功' : f.type === 'folder' ? '文件夹创建成功' : '文档创建成功'); fileDialog.value = null }
  catch(e) { report(e) } finally { busy.value = false }
}
function confirmReload(d: Document) { confirmation.value = { title: '重新加载磁盘版本？', description: '当前未保存修改会被放弃。可以先另存副本来保留这份内容。', label: '重新加载', action: () => store.reload(d) } }
async function confirmOverwrite(d: Document) { try { panes.get(d.id)?.sync(); const hash = await call<string>('check_document', { documentId: d.id }); confirmation.value = { title: '用当前内容覆盖磁盘版本？', description: '磁盘版本会先保存到本机冲突备份，再写入当前编辑内容。确认期间磁盘若再次变化，本次覆盖会中止。', label: '备份并覆盖', action: () => store.overwrite(d, hash) } } catch(e) { report(e) } }
async function submitConfirmation() { if (!confirmation.value || busy.value) return; busy.value = true; const item = confirmation.value; try { await item.action(); if (confirmation.value === item) confirmation.value = null } catch(e) { report(e) } finally { busy.value = false } }
function newFile() { templateId.value='blank'; const ws = workspace.value || store.workspaces[0]; if (ws) action('file', ws.id, store.active?.workspaceId === ws.id ? store.active.path.split('/').slice(0,-1).join('/') : '', true); else void addWorkspace() }
function newFolder() { const ws = workspace.value || store.workspaces[0]; if (ws) action('folder', ws.id, '', true) }
function formatDocument(name: string) { if (store.active) panes.get(store.active.id)?.format(name) }
function bookmarkEditor() { if (store.active) panes.get(store.active.id)?.bookmark() }
const commands = computed<AppCommand[]>(() => {
  const d = store.active, editable = !!d && d.view !== 'preview' && !fileMetadata.value.readonly
  return [
    { id:'new', label:'新建文档', menu:'文件', icon:FilePlusIcon, shortcut:'Ctrl/Cmd+N', run:newFile },
    {id:'open-file',label:'打开本地文件',menu:'文件',icon:FileTextIcon,run:()=>store.openLocal()},
    {id:'recent',label:'最近文档',menu:'文件',icon:ClockIcon,run:()=>showLibrary()},
    {id:'favorites',label:'收藏文档',menu:'文件',icon:BookOpenIcon,run:()=>showLibrary(true)},
    {id:'favorite',label:d&&isFavorite(d)?'取消收藏当前文档':'收藏当前文档',menu:'文件',icon:BookOpenIcon,disabled:!d,run:()=>d&&store.favorite(d)},
    {id:'format-file',label:'编码与换行格式',menu:'文件',icon:CodeXmlIcon,disabled:!d,run:()=>showSafety('format')},
    {id:'history',label:'历史版本',menu:'文件',icon:ClockIcon,disabled:!d,run:()=>showSafety('history')},
    {id:'backup',label:'工作区备份与操作恢复',menu:'文件',icon:ArchiveIcon,run:()=>showSafety('backups')},
    {id:'reopen',label:'重新打开关闭的标签',menu:'文件',icon:FileTextIcon,disabled:!store.closedTabs.length,shortcut:'Ctrl/Cmd+Shift+T',run:()=>store.reopen()},
    { id:'folder', label:'新建文件夹', menu:'文件', icon:FolderIcon, disabled:!store.workspaces.length, run:newFolder },
    { id:'workspace', label:'添加工作区', menu:'文件', icon:FolderPlusIcon, disabled:adding.value, run:addWorkspace },
    { id:'save', label:'保存文档', menu:'文件', icon:SaveIcon, shortcut:'Ctrl/Cmd+S', disabled:!d, run:() => { syncEditors(); if (d) return manualSave(d) } },
    { id:'save-as', label:'另存副本', menu:'文件', icon:FileTextIcon, disabled:!d, run:() => { syncEditors(); if (d) return store.saveAs(d) } },
    { id:'close', label:'关闭当前标签', menu:'文件', icon:XIcon, shortcut:'Ctrl/Cmd+W', disabled:!d, run:() => d && closeTab(d) },
    { id:'archives', label:'工作区回收站', menu:'文件', icon:ArchiveIcon, run:() => { archivesOpen.value = true } },
    { id:'undo', label:'撤销', menu:'编辑', icon:Undo2Icon, shortcut:'Ctrl/Cmd+Z', disabled:!d||!store.canUndo(d), run:() => {syncEditors();if(d)store.undo(d)} },
    { id:'redo', label:'重做', menu:'编辑', icon:Redo2Icon, shortcut:'Ctrl/Cmd+Shift+Z', disabled:!d||!store.canUndo(d,true), run:() => {syncEditors();if(d)store.undo(d,true)} },
    { id:'find', label:'查找与替换', menu:'编辑', icon:SearchIcon, shortcut:'Ctrl/Cmd+F', disabled:!d, run:() => { syncEditors(); findOpen.value = true } },
    { id:'search', label:'全局搜索文档', menu:'编辑', icon:SearchIcon, shortcut:'Ctrl/Cmd+Shift+F', run:() => openSearch(true) },
    { id:'quick', label:'快速打开文档', menu:'编辑', icon:FileTextIcon, shortcut:'Ctrl/Cmd+P', run:() => openSearch(false) },
    {id:'tidy',label:'整理 Markdown 文本',menu:'编辑',icon:CodeXmlIcon,disabled:!editable,run:previewCleanup},
    {id:'move-up',label:'上移段落',menu:'编辑',icon:ChevronRightIcon,disabled:!editable,run:()=>d&&panes.get(d.id)?.moveBlock(-1)},
    {id:'move-down',label:'下移段落',menu:'编辑',icon:ChevronRightIcon,disabled:!editable,run:()=>d&&panes.get(d.id)?.moveBlock(1)},
    { id:'copy', label:'复制 Markdown 源码', menu:'编辑', icon:CodeXmlIcon, disabled:!d, run:() => copyArticle('markdown') },
    { id:'heading', label:'一级标题', menu:'段落', icon:HeadingIcon, disabled:!editable, run:() => formatDocument('heading') },
    { id:'bold', label:'加粗', menu:'段落', icon:BoldIcon, disabled:!editable, run:() => formatDocument('bold') },
    { id:'italic', label:'斜体', menu:'段落', icon:ItalicIcon, disabled:!editable, run:() => formatDocument('italic') },
    { id:'list', label:'无序列表', menu:'段落', icon:ListIcon, disabled:!editable, run:() => formatDocument('list') },
    { id:'quote', label:'引用段落', menu:'段落', icon:QuoteIcon, disabled:!editable, run:() => formatDocument('quote') },
    { id:'image', label:'插入图片', menu:'段落', icon:ImagePlusIcon, disabled:!editable, run:() => { if (d) panes.get(d.id)?.pickImage() } },
    { id:'table', label:'编辑表格', menu:'段落', icon:TableIcon, disabled:!editable, run:() => openStructure('table') },
    { id:'code', label:'编辑代码块', menu:'段落', icon:SquareCodeIcon, disabled:!editable, run:() => openStructure('code') },
    ...views.map(view => ({ id:`view-${view.value}`, label:view.label, menu:'视图', icon:viewIcons[view.value], disabled:!d, run:() => changeView(view.value) })),
    {id:'back',label:'导航后退',menu:'视图',icon:ChevronRightIcon,disabled:store.navigationIndex<=0,run:()=>navigate(-1)},
    {id:'forward',label:'导航前进',menu:'视图',icon:ChevronRightIcon,disabled:store.navigationIndex>=store.navigation.length-1,run:()=>navigate(1)},
    {id:'reveal',label:'在文件树中定位',menu:'视图',icon:FolderIcon,disabled:!d,run:()=>store.reveal()},
    {id:'typewriter',label:'打字机滚动',menu:'视图',icon:PenLineIcon,run:()=>{store.preferences.typewriter=!store.preferences.typewriter}},
    { id:'sidebar', label:store.preferences.sidebar ? '隐藏工作区侧栏' : '显示工作区侧栏', menu:'视图', icon:PanelLeftIcon, run:() => { store.preferences.sidebar = !store.preferences.sidebar } },
    { id:'outline', label:store.preferences.outline ? '隐藏文档大纲' : '显示文档大纲', menu:'视图', icon:PanelRightIcon, run:() => { store.preferences.outline = !store.preferences.outline } },
    { id:'focus', label:focusMode.value ? '退出专注模式' : '进入专注模式', menu:'视图', icon:MaximizeIcon, shortcut:'Ctrl/Cmd+Shift+Enter', run:() => { focusMode.value = !focusMode.value } },
    { id:'light', label:'切换亮色主题', menu:'视图', icon:SunIcon, run:() => { store.preferences.mode = 'light' } },
    { id:'dark', label:'切换暗色主题', menu:'视图', icon:MoonIcon, run:() => { store.preferences.mode = 'dark' } },
    { id:'system', label:'主题跟随系统', menu:'视图', icon:MonitorIcon, run:() => { store.preferences.mode = 'system' } },
    { id:'pdf', label:'导出 PDF', menu:'导出', icon:DownloadIcon, disabled:!d, run:() => openExport('pdf') },
    { id:'html', label:'导出 HTML', menu:'导出', icon:CodeXmlIcon, disabled:!d, run:() => openExport('html') },
    { id:'zip', label:'导出 Markdown 与图片 ZIP', menu:'导出', icon:ArchiveIcon, disabled:!d, run:() => openExport('zip') },
    { id:'settings', label:'设置', menu:'帮助', icon:SettingsIcon, shortcut:'Ctrl/Cmd+,', run:() => openSettings() },
    { id:'shortcuts', label:'快捷键说明', menu:'帮助', icon:KeyboardIcon, run:() => openSettings('shortcuts') },
    { id:'about', label:'关于 MarkFlow', menu:'帮助', icon:InfoIcon, run:() => openSettings('about') },
  ]
})
async function executeCommand(id: string) {
  const command = commands.value.find(c => c.id === id); if (!command || command.disabled) return
  commandOpen.value = false
  // Wait for the menu/palette focus restoration before opening another overlay.
  await nextTick(); requestAnimationFrame(() => { void safely(async () => { await command.run() }) })
}
function resize(event: PointerEvent, which: 'sidebar' | 'outline') {
  const start = event.clientX, p = store.preferences, initial = which === 'sidebar' ? p.sidebarWidth : p.outlineWidth
  const move = (e: PointerEvent) => { const width = initial + (which === 'sidebar' ? e.clientX - start : start - e.clientX); if (which === 'sidebar') p.sidebarWidth = Math.max(180, Math.min(420, width)); else p.outlineWidth = Math.max(170, Math.min(360, width)) }
  const up = () => { document.removeEventListener('pointermove', move); document.removeEventListener('pointerup', up); document.body.classList.remove('resizing') }
  document.body.classList.add('resizing'); document.addEventListener('pointermove', move); document.addEventListener('pointerup', up, { once: true })
}
function shortcut(e: KeyboardEvent) {
 if(locked.value||settings.value||archivesOpen.value)return
  if (e.isComposing || e.defaultPrevented) return
  if (e.key === 'Escape' && focusMode.value && !document.querySelector('[role=dialog]')) { focusMode.value = false; return }
  if (!(e.ctrlKey || e.metaKey)) return
  if (document.querySelector('[role=dialog]')) return
  if (e.key.toLowerCase() === 'k') { e.preventDefault(); bookmarkEditor(); commandOpen.value = true; return }
  if (e.key.toLowerCase() === 'p' && !e.shiftKey) { e.preventDefault(); openSearch(false); return }
  if (e.key.toLowerCase() === 'f') { e.preventDefault(); if (e.shiftKey) openSearch(true); else if (store.active) { syncEditors(); findOpen.value = true }; return }
  if (e.key === 'Enter' && e.shiftKey) { e.preventDefault(); focusMode.value = !focusMode.value; return }
  if (!(e.ctrlKey || e.metaKey)) return
  if (e.key.toLowerCase() === 's') { e.preventDefault(); syncEditors(); if (store.active) void manualSave(store.active) }
  if (e.key.toLowerCase() === 'n') { e.preventDefault(); newFile() }
  if (e.key.toLowerCase() === 'w' && store.active) { e.preventDefault(); void closeTab(store.active) }
  if (e.key === ',') { e.preventDefault(); settings.value = true }
}
function commandShortcut(e: KeyboardEvent) {
 if(locked.value||settings.value||archivesOpen.value)return
  if(e.isComposing||document.querySelector('[role=dialog]'))return
  if(e.altKey&&(e.key==='ArrowLeft'||e.key==='ArrowRight')){e.preventDefault();void navigate(e.key==='ArrowLeft'?-1:1);return}
  if(!(e.ctrlKey||e.metaKey))return
  if(e.key.toLowerCase()==='z'||e.key.toLowerCase()==='y'){e.preventDefault();e.stopImmediatePropagation();syncEditors();if(store.active)store.undo(store.active,e.shiftKey||e.key.toLowerCase()==='y');return}
  if(e.key.toLowerCase()==='t'&&e.shiftKey){e.preventDefault();e.stopImmediatePropagation();void store.reopen();return}
  if(e.key.toLowerCase()!=='k')return
  e.preventDefault();e.stopImmediatePropagation();bookmarkEditor();commandOpen.value=true
}
function changedSystem(e: MediaQueryListEvent) { systemDark.value = e.matches }
async function requestClose(forceExit=false,discardTemporary=false) {
  syncEditors();
  if(!discardTemporary&&(!store.preferences.closeToTray||forceExit)&&store.documents.some(d=>d.temporary)){confirmation.value={title:'临时文档尚未保存',description:'临时文档尚未保存，直接退出会丢失全部内容。请取消并保存，或确认退出。',label:'不保存并退出',action:async()=>{for(const d of [...store.documents].filter(d=>d.temporary))await store.close(d.id,true);await requestClose(forceExit,true)}};return}
 if(locked.value){if(store.ready&&!configured.value){syncEditors();if(!await store.protectDrafts())return;await store.persistNow()}await getCurrentWindow().destroy();return}
  if(desktop)await call('save_window_geometry').catch(report)
  syncEditors();if(store.preferences.closeToTray&&!forceExit){if(await store.protectDrafts()){await store.persistNow();await getCurrentWindow().hide()}return}
  if(!store.preferences.saveOnClose&&store.documents.some(d=>!d.temporary&&d.revision>d.savedRevision)){confirmation.value={title:'退出前保留未保存内容？',description:'未保存修改会写入恢复草稿，下次启动可找回。',label:'保留草稿并退出',action:async()=>{if(!await store.protectDrafts())throw new Error('草稿保护失败');await store.persistNow();closing=true;await getCurrentWindow().destroy()}};return}
  if (await store.flush()) { await store.persistNow(); closing = true; await getCurrentWindow().destroy(); return }
  confirmation.value = { title: '还有文档尚未保存', description: '取消退出后，可以重试保存或另存副本。退出前会将当前修改写入恢复区，下次启动可恢复草稿。', label: '保留草稿并退出', action: async () => { if (!await store.protectDrafts()) throw new Error('草稿尚未成功保存，请另存副本后再退出。'); await store.persistNow(); closing = true; await getCurrentWindow().destroy() } }
}
async function bootWorkbench(){
  toolbarObserver=new ResizeObserver(()=>{toolbarWidth.value=toolbarHost.value?.clientWidth||0;toolbarActionsWidth.value=toolbarActions.value?.clientWidth||300});watch(toolbarHost,el=>{if(el)toolbarObserver?.observe(el)},{immediate:true});watch(toolbarActions,el=>{if(el)toolbarObserver?.observe(el)},{immediate:true});
  window.addEventListener('keydown', commandShortcut, true)
  window.addEventListener('keydown', shortcut); media.addEventListener('change', changedSystem)
  try {
    if(locked.value)return
    await store.initialize()
    backupTick=setInterval(()=>{const interval=store.preferences.backupInterval;if(locked.value||!desktop||!interval||backupRunning||Date.now()-lastBackup<interval*60000)return;backupRunning=true;void(async()=>{try{syncEditors();if(!await store.flush())throw new Error('定期备份暂停：请先处理保存冲突');for(const ws of store.workspaces.filter(w=>w.available&&!w.id.startsWith('file-')))await call('backup_workspace',{workspaceId:ws.id});lastBackup=Date.now()}catch(e){toast.error(message(e));lastBackup=Date.now()}finally{backupRunning=false}})()},30000)
    if (desktop) {
      disposers.push(await listen('tray-exit',()=>void requestClose(true)));disposers.push(await getCurrentWindow().onFocusChanged(e=>{if(!locked.value&&!e.payload&&store.preferences.saveOnBlur){syncEditors();void store.flush()}}));
      disposers.push(await getCurrentWindow().onDragDropEvent(event=>{if(!locked.value&&event.payload.type==='drop'){const paths=event.payload.paths;void safely(()=>store.openLocal(paths))}}));
      disposers.push(await listen('workspace-changed', () => { clearTimeout(refreshTimer); refreshTimer = setTimeout(() => {if(!locked.value)void store.refresh()}, 350) }))
      disposers.push(await getCurrentWindow().onCloseRequested(e => { if (!closing) { e.preventDefault(); void requestClose() } }))
      poll = setInterval(() => { if (!locked.value && document.visibilityState === 'visible') void store.refresh() }, 5000)
    }
  } catch(e) { bootError.value = message(e) }
}
onMounted(async()=>{try{await privacyStatus();if(!locked.value)await bootWorkbench()}catch(e){bootError.value=message(e)}})
onBeforeUnmount(() => { toolbarObserver?.disconnect();clearInterval(backupTick);window.removeEventListener('keydown', commandShortcut, true); clearTimeout(statsTimer); clearTimeout(analysisTimeout); analysisWorker?.terminate(); clearInterval(clockTimer); clearInterval(metadataTimer); window.removeEventListener('keydown', shortcut); media.removeEventListener('change', changedSystem); clearInterval(poll); clearTimeout(refreshTimer); disposers.forEach(fn => fn()) })
</script>

<template>
  <LockScreen v-if="locked" @unlocked="unlocked"/>
<TooltipProvider v-else :delay-duration="300">
<TocDialog v-model:open="tocOpen"/><KnowledgeDialog/><OpenTabsDialog v-model:open="tabsOpen" @close="id=>{const d=store.documents.find(d=>d.id===id);if(d)closeTab(d)}"/>
  <div class="workbench flex h-full flex-col bg-muted/40" :class="{ 'focus-mode': focusMode }" :style="{ '--collapsed-sidebar-width': store.preferences.collapsedSidebarWidth + 'px' }">
    <header v-if="desktop || (store.preferences.header && !focusMode)" data-tauri-drag-region class="app-header flex h-11 min-h-11 shrink-0 items-center justify-between gap-3 border-b border-border/50 pl-3" @dblclick.self="desktop && getCurrentWindow().toggleMaximize()" @pointerdown.capture="bookmarkEditor">
      <div data-tauri-drag-region class="flex h-full min-w-0 flex-1 items-center gap-3"><div data-tauri-drag-region class="brand flex shrink-0 items-center"><svg aria-hidden="true" viewBox="0 0 256 256" class="size-7 rounded-lg bg-primary text-primary-foreground"><path d="M74 56h75l33 34v110H74z" fill="currentColor"/><path d="M149 56v34h33" fill="var(--primary)" opacity="0.3"/><path d="M96 120h64M96 144h64M96 168h40" stroke="var(--primary)" stroke-width="10" stroke-linecap="round"/></svg></div><AppMenubar v-if="store.preferences.header && !focusMode" :commands="commands" @execute="executeCommand" /></div>
      <div class="flex h-full shrink-0 items-center gap-1">
        <Badge v-if="!desktop" variant="secondary" class="hidden xl:inline-flex">浏览器预览 · 示例数据</Badge>
        <Tooltip><TooltipTrigger as-child><Button variant="ghost" size="icon" aria-label="全局搜索文档" @click="openSearch(true)"><SearchIcon/></Button></TooltipTrigger><TooltipContent>搜索标题、内容或标签 · Ctrl/Cmd+Shift+F</TooltipContent></Tooltip><Tooltip><TooltipTrigger as-child><Button variant="ghost" size="icon" aria-label="工作区知识" @click="knowledgeTab='backlinks';knowledgeOpen=true"><NetworkIcon/></Button></TooltipTrigger><TooltipContent>工作区知识与标签筛选</TooltipContent></Tooltip>
<Tooltip><TooltipTrigger as-child><Button variant="ghost" size="icon" aria-label="锁定应用" @click="lockApp"><LockKeyholeIcon/></Button></TooltipTrigger><TooltipContent>锁定应用</TooltipContent></Tooltip>
<Tooltip><TooltipTrigger as-child><Button variant="ghost" size="icon" aria-label="搜索命令" @click="commandOpen = true"><CommandIcon /></Button></TooltipTrigger><TooltipContent>搜索命令 · Ctrl/Cmd+K</TooltipContent></Tooltip>
        <WindowControls v-if="desktop" class="ml-2" @close="requestClose" />
      </div>
    </header>
    <Button v-if="focusMode" variant="outline" class="fixed bottom-12 right-5 z-10" @click="focusMode=false">退出专注模式 · Esc</Button><SettingsDialog v-if="settings" v-model:open="settings" :section="settingsSection"/><ArchiveDialog v-else-if="archivesOpen" v-model:open="archivesOpen"/><div v-show="!settings && !archivesOpen" class="app-body flex min-h-0 flex-1 gap-2 px-2 pb-2 pt-2">
      <aside v-show="store.preferences.sidebar && !focusMode" class="workspace-sidebar flex min-w-[180px] shrink-0 flex-col rounded-xl bg-sidebar" :style="{ width: `${store.preferences.sidebarWidth}px` }" aria-label="工作区">
        <div class="sidebar-heading flex min-w-0 items-center justify-between gap-2 px-3 pb-3 pt-4 text-xs font-medium text-muted-foreground"><span class="truncate">工作区</span><div class="flex shrink-0 gap-1">

          <Tooltip><TooltipTrigger as-child><Button variant="ghost" size="icon-xs" aria-label="刷新工作区" :disabled="refreshing" @click="refreshWorkspaces"><RefreshCwIcon :class="cn(refreshing && 'animate-spin')" /></Button></TooltipTrigger><TooltipContent>刷新工作区</TooltipContent></Tooltip>
          <Tooltip><TooltipTrigger as-child><Button variant="ghost" size="icon-xs" aria-label="添加工作区" :disabled="adding" @click="addWorkspace"><FolderPlusIcon /></Button></TooltipTrigger><TooltipContent>添加工作区</TooltipContent></Tooltip>
        </div></div>
        <SidebarLibrary @reveal="safely(revealCurrentDocument)" />
        <nav class="file-tree min-h-0 flex-1 overflow-auto px-2 pb-3" role="tree" aria-label="文件目录"><TreeNode v-for="ws in store.workspaces.filter(w=>!w.id.startsWith('file-'))" :key="ws.id" :workspace="ws" :entry="{ name: ws.name, path: '', isDir: true }" root @action="action" @error="report" /></nav>
        <div v-if="store.drafts.length" class="sidebar-footer flex flex-col gap-2 p-3"><Button variant="ghost" class="w-full" @click="recovery = true">恢复草稿 <Badge variant="secondary">{{ store.drafts.length }}</Badge></Button></div>
      </aside>
      <div v-if="store.preferences.sidebar && !focusMode" class="panel-resizer relative w-0.5 shrink-0 cursor-col-resize rounded-full bg-transparent transition-colors hover:bg-primary/30 before:absolute before:-left-1 before:inset-y-0 before:w-2" role="separator" aria-label="调整工作区宽度" aria-orientation="vertical" @pointerdown="resize($event, 'sidebar')" />
      <aside v-if="!store.preferences.sidebar && !focusMode" class="collapsed-sidebar flex w-[var(--collapsed-sidebar-width)] min-w-[var(--collapsed-sidebar-width)] shrink-0 flex-col items-center gap-2 rounded-xl bg-sidebar py-3" aria-label="折叠侧栏"><Tooltip><TooltipTrigger as-child><Button variant="ghost" size="icon" aria-label="添加工作区" @click="addWorkspace"><FolderPlusIcon /></Button></TooltipTrigger><TooltipContent side="right">添加工作区</TooltipContent></Tooltip><Tooltip><TooltipTrigger as-child><Button variant="ghost" size="icon" aria-label="刷新工作区" @click="refreshWorkspaces"><RefreshCwIcon /></Button></TooltipTrigger><TooltipContent side="right">刷新工作区</TooltipContent></Tooltip></aside>
      <main class="document-area flex min-w-0 flex-1 flex-col overflow-hidden rounded-xl border border-border/70 bg-background shadow-sm">
        <div class="document-tabs flex h-11 min-h-11 items-center gap-1 overflow-x-auto border-b border-border/60 bg-muted/30 px-2 py-1" role="tablist" aria-label="打开的文档" @dblclick="e=>{if(e.target===e.currentTarget)store.createTemporary()}">
          <Button variant="ghost" size="icon-sm" aria-label="管理打开的标签" title="管理打开的标签" @click="tabsOpen=true"><ListFilterIcon/></Button><TabContextMenu v-for="d in store.documents" :key="d.id" :others="store.documents.length > 1" :pinned="d.pinned" :favorite="isFavorite(d)" :left="store.documents.indexOf(d)>0" :right="store.documents.indexOf(d)<store.documents.length-1" @pin="store.pin(d)" @favorite="store.favorite(d)" @close="scope => closeTabScope(d, scope)"><div draggable="true" @dragstart="draggedTab=d.id" @dragover.prevent @drop.stop="store.reorder(draggedTab,d.id)" :class="cn('document-tab group relative flex h-8 min-w-[120px] max-w-[220px] items-center rounded-lg pr-1 transition-colors hover:bg-muted', d.id === store.activeId && 'document-tab-active bg-background shadow-sm ring-1 ring-border/70')"><button class="flex min-w-0 flex-1 items-center gap-2 px-3 py-2 text-xs text-muted-foreground group-[.document-tab-active]:text-foreground" :id="`tab-${d.id}`" role="tab" :aria-label="filename(d.path)" :aria-selected="d.id === store.activeId" :aria-controls="`pane-${d.id}`" @click="store.activate(d.id)"><FileTextIcon class="size-3.5 shrink-0" /><span class="flex min-w-0 items-baseline whitespace-nowrap leading-5 pr-0.5" :title="d.path"><span class="truncate">{{d.pinned?'◆ ':''}}{{filename(d.path).slice(0,-3)}}</span><span class="shrink-0">{{filename(d.path).slice(-3)}}</span></span><span v-if="store.documents.some(other=>other.id!==d.id&&filename(other.path)===filename(d.path))" class="max-w-20 truncate text-[10px] text-muted-foreground" :title="d.path">{{d.path.split('/').slice(0,-1).join('/')||store.workspaces.find(w=>w.id===d.workspaceId)?.name}}</span><span v-if="d.temporary || d.revision > d.savedRevision" class="unsaved-dot size-1.5 shrink-0 rounded-full bg-primary" title="尚未保存" /></button><button :class="cn(d.id === store.activeId && 'opacity-100')" class="tab-close flex size-6 shrink-0 items-center justify-center rounded-md text-muted-foreground opacity-0 transition-colors hover:bg-muted hover:text-foreground group-hover:opacity-100 group-focus-within:opacity-100" :aria-label="`关闭 ${filename(d.path)}`" @click="closeTab(d)"><XIcon class="size-3.5" /></button></div></TabContextMenu>
          <Button variant="ghost" size="icon-sm" class="ml-2 shrink-0" aria-label="新建文档" title="新建临时文档" @click="store.createTemporary()"><PlusIcon /></Button><div class="h-full min-w-8 flex-1" title="双击新建临时文档" @dblclick.stop="store.createTemporary()"/>
        </div>
        <template v-if="store.active">
          <div ref="toolbarHost" class="document-toolbar flex min-h-12 shrink-0 items-center gap-3 border-b border-border/60 px-3 py-1.5" @pointerdown.capture="bookmarkEditor">
            <div class="flex min-w-0 flex-1 items-center gap-1.5">
              <div v-for="d in store.documents" :key="d.id" v-show="d.id === store.activeId && d.view === 'live'" :id="`format-${d.id}`" :class="cn('min-w-max',!fullToolbar&&'hidden')" />
              <DropdownMenu v-if="store.active.view === 'live'"><DropdownMenuTrigger as-child><Button variant="ghost" size="icon-sm" v-show="!fullToolbar" aria-label="文本格式"><HeadingIcon /></Button></DropdownMenuTrigger><DropdownMenuContent align="start" class="min-w-48"><DropdownMenuGroup><DropdownMenuItem v-for="command in commands.filter(c => c.menu === '段落' || ['undo','redo'].includes(c.id))" :key="command.id" :disabled="command.disabled" @select="executeCommand(command.id)"><component :is="command.icon" />{{ command.label }}</DropdownMenuItem></DropdownMenuGroup></DropdownMenuContent></DropdownMenu><div :class="cn('document-breadcrumb flex min-w-0 items-center gap-2 text-xs text-muted-foreground', store.active.view === 'live' && 'sr-only')"><FileTextIcon class="size-4 shrink-0" /><span class="truncate">{{ store.active.path }}</span></div>
              <Tooltip><TooltipTrigger as-child><Button variant="ghost" size="icon-sm" aria-label="插入图片" :disabled="store.active.view === 'preview'" @mousedown.prevent @click="panes.get(store.active.id)?.pickImage()"><ImagePlusIcon /></Button></TooltipTrigger><TooltipContent>插入本地图片</TooltipContent></Tooltip>
              <span class="mx-1 h-4 w-px shrink-0 bg-border" aria-hidden="true" />
              <DocumentTags :document="store.active" @sync="syncEditors" />
            </div>
            <div ref="toolbarActions" class="flex shrink-0 items-center gap-1.5">
              <ToggleGroup type="single" variant="segmented" :spacing="1" size="sm" :model-value="store.active.view" aria-label="编辑视图" @update:model-value="v => { if (v) changeView(String(v)) }"><ToggleGroupItem v-for="view in views" :key="view.value" :value="view.value" :aria-label="view.label"><component :is="viewIcons[view.value]" data-icon="inline-start" /><span :class="cn(store.active.view !== view.value && 'hidden 2xl:inline')">{{ view.label }}</span></ToggleGroupItem></ToggleGroup>
              <DocumentActions @toc="syncEditors();tocOpen=true" @knowledge="knowledgeTab='backlinks';knowledgeOpen=true" :favorite="isFavorite(store.active!)" @favorite="store.favorite(store.active!)" :focus="focusMode" @find="syncEditors(); findOpen = true" @search="openSearch(true)" @quick="openSearch(false)" @export="openExport()" @focus="focusMode = !focusMode" @table="openStructure('table')" @code="openStructure('code')" :outline="store.preferences.outline" @toggle-outline="store.preferences.outline = !store.preferences.outline" @copy="copyArticle" @info="showDocumentInfo" @open-directory="action('open-system', store.active.workspaceId, store.active.path, false)" />
            </div>
          </div>
          <Alert v-if="['error','conflict','missing'].includes(store.active.status)" variant="destructive" class="save-alert"><AlertCircleIcon /><AlertTitle>{{ store.active.temporary ? '临时文档 · 未保存' : statusLabels[store.active.status] }}</AlertTitle><AlertDescription>{{ store.active.error }}<div class="flex flex-wrap gap-2"><Button v-if="store.active.status === 'error'" size="sm" variant="outline" @click="manualSave(store.active)">重试保存</Button><Button size="sm" variant="outline" @click="safely(() => store.saveAs(store.active!))">另存副本</Button><Button v-if="store.active.status === 'conflict'" size="sm" variant="outline" @click="showSafety('conflict')">比较与合并</Button><Button v-if="store.active.status === 'conflict'" size="sm" variant="outline" @click="confirmReload(store.active)">重新加载</Button><Button v-if="store.active.status === 'conflict'" size="sm" variant="outline" @click="confirmOverwrite(store.active)">备份并覆盖</Button></div></AlertDescription></Alert>
        </template>
        <FindBar v-if="findOpen && store.active" :document="store.active" @close="findOpen = false" @select="selectMatch" /><div class="editor-and-outline flex min-h-0 flex-1">
          <div class="editor-stack relative flex min-h-0 min-w-0 flex-1 flex-col">
            <div v-for="d in store.documents" v-show="d.id === store.activeId" :id="`pane-${d.id}`" :key="d.id" role="tabpanel" :aria-labelledby="`tab-${d.id}`" class="document-panel h-full min-h-0"><EditorPane :ref="el => { if (el) panes.set(d.id, el as InstanceType<typeof EditorPane>); else panes.delete(d.id) }" :document="d" :active="d.id === store.activeId" :dark="dark" @structure="index=>openStructure('code',index)" @selection="text => { if (d.id === store.activeId) selectedText = text }" /></div>
            <Empty v-if="!store.active" class="welcome-empty"><EmptyHeader><EmptyMedia variant="icon"><BookOpenIcon /></EmptyMedia><EmptyTitle>留一处空间，写下你的想法。</EmptyTitle><EmptyDescription>打开本地文件夹，开始一份笔记。<br />文档始终属于你，保存在原来的位置。</EmptyDescription></EmptyHeader><EmptyContent class="w-full max-w-2xl"><Button :disabled="adding" @click="addWorkspace"><FolderPlusIcon data-icon="inline-start" />选择工作区</Button><Button variant="ghost" @click="store.createTemporary()"><FilePlusIcon data-icon="inline-start" />新建文档</Button><div class="mt-5 grid w-full max-w-2xl gap-6 text-left sm:grid-cols-2"><section v-for="group in [{title:'最近打开',files:store.preferences.recentFiles.slice(0,8)},{title:'收藏文档',files:store.preferences.favorites.slice(0,8)}]" :key="group.title" class="min-w-0 rounded-xl border border-border/60 p-4"><h3 class="mb-2 text-sm font-medium">{{group.title}}</h3><Button v-for="file in group.files" :key="file.workspaceId+file.path" variant="ghost" class="w-full justify-start" :title="file.path" @click="safely(()=>file.absolutePath?store.openLocal([file.absolutePath]):store.open(file.workspaceId,file.path))"><FileTextIcon/><span class="truncate">{{filename(file.path)}}</span></Button><p v-if="!group.files.length" class="py-2 text-xs text-muted-foreground">暂无文档</p></section></div></EmptyContent></Empty>
            <Alert v-if="bootError" variant="destructive" class="m-6"><AlertTitle>无法启动工作区</AlertTitle><AlertDescription>{{ bootError }}</AlertDescription></Alert>
          </div>
          <template v-if="store.preferences.outline && store.active && !focusMode"><div class="panel-resizer relative w-0.5 shrink-0 cursor-col-resize rounded-full bg-transparent transition-colors hover:bg-primary/30 before:absolute before:-left-1 before:inset-y-0 before:w-2" role="separator" aria-label="调整大纲宽度" aria-orientation="vertical" @pointerdown="resize($event, 'outline')" /><aside class="outline-panel flex shrink-0 flex-col bg-background max-lg:max-w-[180px]" :style="{ width: `${store.preferences.outlineWidth}px` }" aria-label="文档大纲"><div class="outline-heading flex items-center gap-2.5 px-4 pb-4 pt-6 text-xs font-medium text-muted-foreground"><span>文档大纲</span><Badge variant="secondary">{{ outline.length }}</Badge></div><nav class="min-h-0 flex-1 overflow-auto px-2 pb-4"><button class="mb-0.5 flex min-h-8 w-full items-start gap-2 rounded-lg py-2 pr-3 text-left text-xs text-muted-foreground transition-colors hover:bg-muted hover:text-foreground" v-for="heading in outline" :key="heading.id" :style="{ paddingLeft: `${16 + (heading.level - 1) * 12}px` }" :title="heading.text" @click="panes.get(store.active!.id)?.jump(heading)"><span class="outline-level mt-0.5 shrink-0 font-mono text-[10px] opacity-50">H{{ heading.level }}</span><span class="truncate">{{ heading.text || '无标题' }}</span></button><p v-if="!outline.length" class="outline-empty px-4 py-2 text-xs leading-6 text-muted-foreground">添加标题后，<br />章节会出现在这里。</p></nav></aside></template>
        </div>
      </main>
    </div>
    <footer v-show="!settings && !archivesOpen" class="statusbar flex min-h-9 shrink-0 items-center px-3 pb-1 text-xs text-muted-foreground" :style="{ '--status-sidebar-width': `${focusMode ? 0 : store.preferences.sidebar ? store.preferences.sidebarWidth + 12 : store.preferences.collapsedSidebarWidth + 12}px` }"><div class="status-sidebar-spacer flex w-[var(--status-sidebar-width)] shrink-0 items-center"><SidebarControls v-if="!focusMode" :collapsed="!store.preferences.sidebar" compact :mode="store.preferences.mode" :dark="dark" @toggle="store.preferences.sidebar = !store.preferences.sidebar" @settings="settings = true" @archives="archivesOpen = true" @theme="m => store.preferences.mode = m" /></div><div class="status-document flex min-w-0 flex-1 items-center justify-between gap-3 px-2"><div v-if="store.active" class="status-file flex min-w-0 max-w-[45%] items-center gap-1"><Tooltip><TooltipTrigger as-child><span class="status-path truncate" tabindex="0" aria-label="当前文章路径">{{ [workspace?.name, store.active.path].filter(Boolean).join(' / ') }}</span></TooltipTrigger><TooltipContent side="top"><span class="break-all">{{ currentFilePath }}</span></TooltipContent></Tooltip></div><div class="status-details ml-auto flex min-w-0 flex-wrap items-center justify-end gap-x-3 gap-y-1"><time class="hidden tabular-nums min-[1200px]:inline" aria-label="当前时间">{{ currentTime }}</time><template v-if="store.active"><Tooltip><TooltipTrigger as-child><Button variant="ghost" size="icon-sm" aria-label="文档创建与最近编辑时间"><ClockIcon /></Button></TooltipTrigger><TooltipContent side="top"><div class="file-timestamps flex flex-col gap-1 tabular-nums"><span>创建时间：{{ formatTimestamp(fileMetadata.createdAt) }}</span><span>最近编辑时间：{{ formatTimestamp(fileMetadata.modifiedAt) }}</span></div></TooltipContent></Tooltip><span :title="`${readingStats.words} 字词 · 预计阅读 ${readingStats.minutes} 分钟`">{{ selectedText ? `选中 ${selectedText.length} 字符` : `${store.active.text.length.toLocaleString()} 字符` }}</span><span>{{fileMetadata.encoding||'UTF-8'}}{{ store.active.bom ? ' BOM' : '' }}</span><span>{{ store.active.crlf ? 'CRLF' : 'LF' }}</span><button :class="cn('save-status flex min-h-7 items-center gap-1.5 rounded-md px-2 py-1 transition-colors hover:bg-muted [&_svg]:size-3.5', ['error','conflict','missing'].includes(store.active.status) && 'text-destructive')" @click="manualSave(store.active)"><CheckIcon v-if="store.active.status === 'clean'" /><RefreshCwIcon v-else-if="store.active.status === 'saving'" class="animate-spin" /><AlertCircleIcon v-else-if="['error','conflict','missing'].includes(store.active.status)" /><CircleIcon v-else />{{ store.active.temporary ? '临时文档 · 未保存' : statusLabels[store.active.status] }}</button></template></div></div></footer>
    <SafetyDialog v-model:open="safetyOpen" :kind="safetyKind"/><LibraryDialog v-model:open="libraryOpen" :favorites="libraryFavorites"/><Dialog v-model:open="cleanupOpen"><DialogContent class="productivity-dialog sm:max-w-3xl"><DialogHeader><DialogTitle>整理文本预览</DialogTitle><DialogDescription>清理过多空行、统一列表符号，保留代码块。应用后可撤销。</DialogDescription></DialogHeader><div class="grid grid-cols-2 gap-3"><Textarea :model-value="cleanupBefore" readonly aria-label="整理前" class="h-80 resize-none font-mono text-xs"/><Textarea :model-value="cleanupText" readonly aria-label="整理后" class="h-80 resize-none font-mono text-xs"/></div><DialogFooter><Button variant="outline" @click="cleanupOpen=false">取消</Button><Button @click="applyCleanup">应用整理</Button></DialogFooter></DialogContent></Dialog><CommandPalette v-model:open="commandOpen" :commands="commands" @execute="executeCommand" />

    <SearchDialog v-model:open="searchOpen" :content="searchContent" :initial-tag="tagFilter" @jump="jumpSearch" />
    <ExportDialog v-model:open="exportOpen" :document="store.active" :initial-format="exportFormat" />
    <StructureDialog v-model:open="structureOpen" :kind="structureKind" :document="store.active" :block-index="codeBlockIndex" />
    <Dialog v-model:open="documentInfo">
      <DialogContent class="sm:max-w-lg">
        <DialogHeader><DialogTitle>文章信息</DialogTitle><DialogDescription>当前文档的路径、内容统计与文件时间。</DialogDescription></DialogHeader>
        <dl v-if="store.active" class="document-info">
          <dt>文件名称</dt><dd>{{ filename(store.active.path) }}</dd>
          <dt>工作区</dt><dd>{{ workspace?.name }}</dd>
          <dt>文件路径</dt><dd>{{ currentFilePath }}</dd>
          <dt>字符数</dt><dd>{{ Array.from(store.active.text).length.toLocaleString() }}</dd>
          <dt>源码行数</dt><dd>{{ store.active.text.split('\n').length.toLocaleString() }}</dd>
          <dt>编码 / 换行</dt><dd>UTF-8{{ store.active.bom ? ' BOM' : '' }} / {{ store.active.crlf ? 'CRLF' : 'LF' }}</dd>
          <dt>创建时间</dt><dd>{{ formatTimestamp(fileMetadata.createdAt) }}</dd>
          <dt>最近编辑时间</dt><dd>{{ formatTimestamp(fileMetadata.modifiedAt) }}</dd>
          <dt>保存状态</dt><dd>{{ store.active.temporary ? '临时文档 · 未保存' : statusLabels[store.active.status] }}</dd>
        </dl>
        <DialogFooter><Button variant="outline" @click="documentInfo = false">关闭</Button></DialogFooter>
      </DialogContent>
    </Dialog>
    <Dialog :open="!!fileDialog" @update:open="v => { if (!v) fileDialog = null }"><DialogContent><DialogHeader><DialogTitle>{{ fileDialog?.type === 'rename' ? '重命名' : fileDialog?.type === 'move' ? '移动文档或文件夹' : fileDialog?.type === 'folder' ? '新建文件夹' : '新建 Markdown 文档' }}</DialogTitle><DialogDescription>{{ fileDialog?.type === 'move' ? '在当前工作区内移动，保留真实文件结构。' : '操作会直接反映在本地文件夹中。' }}</DialogDescription></DialogHeader><form v-if="fileDialog" @submit.prevent="submitFile"><FieldGroup><Field v-if="fileDialog.type !== 'move'"><FieldLabel for="entry-name">名称</FieldLabel><Input id="entry-name" v-model="fileDialog.name" autofocus required /></Field><Field v-else><FieldLabel for="destination">目标目录</FieldLabel><Input id="destination" v-model="fileDialog.destination" list="destination-folders" placeholder="工作区根目录（留空）" /><FieldDescription>选择已有目录或输入工作区内的相对路径。</FieldDescription><datalist id="destination-folders"><option v-for="dir in directories" :key="dir" :value="dir" /></datalist></Field><Field v-if="fileDialog.type==='file'"><FieldLabel>文档模板</FieldLabel><Select v-model="templateId"><SelectTrigger aria-label="文档模板" class="w-full"><SelectValue/></SelectTrigger><SelectContent><SelectGroup><SelectItem v-for="t in templateCatalog(store.preferences.templates,store.preferences.hiddenTemplates)" :key="t.id" :value="t.id">{{t.name}}</SelectItem></SelectGroup></SelectContent></Select></Field><DialogFooter><Button variant="outline" type="button" @click="fileDialog = null">取消</Button><Button type="submit" :disabled="busy">{{ busy ? '处理中…' : '确定' }}</Button></DialogFooter></FieldGroup></form></DialogContent></Dialog>
    <AlertDialog :open="!!confirmation" @update:open="v => { if (!v && !busy) confirmation = null }"><AlertDialogContent><AlertDialogHeader><AlertDialogTitle>{{ confirmation?.title }}</AlertDialogTitle><AlertDialogDescription>{{ confirmation?.description }}</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel :disabled="busy">取消</AlertDialogCancel><Button :variant="confirmation?.danger ? 'destructive' : 'default'" :disabled="busy" @click="submitConfirmation">{{ busy ? '处理中…' : confirmation?.label }}</Button></AlertDialogFooter></AlertDialogContent></AlertDialog>
    <Dialog v-model:open="recovery"><DialogContent class="sm:max-w-lg"><DialogHeader><DialogTitle>找回未保存的草稿</DialogTitle><DialogDescription>恢复前会检查原文件。存在外部修改时，会保留两个版本并提示冲突。</DialogDescription></DialogHeader><div class="recovery-list"><div v-for="draft in store.drafts" :key="draft.id" class="recovery-item"><div class="min-w-0"><strong class="block truncate" :title="draft.path">{{ filename(draft.path) }}</strong><p>{{store.workspaces.find(w=>w.id===draft.workspaceId)?.name||'工作区不可用'}} · {{ new Date(draft.updatedAt * 1000).toLocaleString() }}</p><Button variant="ghost" size="sm" @click="draftPreview=draftPreview===draft.id?'':draft.id">预览草稿</Button><Textarea v-if="draftPreview===draft.id" :model-value="draft.text" readonly aria-label="草稿内容预览" class="mt-2 h-32 font-mono text-xs"/></div><div class="flex gap-2"><Button variant="outline" size="sm" @click="safely(() => store.discardDraft(draft))">丢弃</Button><Button size="sm" @click="safely(() => store.restore(draft))">恢复</Button></div></div><p v-if="!store.drafts.length" class="text-muted-foreground">没有待恢复的草稿。</p></div></DialogContent></Dialog>
    <Toaster position="top-center" :offset="56" :mobile-offset="56" :theme="dark ? 'dark' : 'light'" rich-colors />
  </div>
  </TooltipProvider>
</template>

