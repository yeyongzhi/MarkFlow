<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import Vditor from 'vditor'
import 'vditor/dist/index.css'
import { toast } from 'vue-sonner'
import { openUrl } from '@tauri-apps/plugin-opener'
import { useWorkbench } from '@/stores/workbench'
import { call, desktop, message } from '@/services/api'
import { indentSelection } from '@/services/indent'
import { openKnowledgeLink,loadKnowledge,knowledgeDocs } from '@/services/knowledge'
import { decorateRichContent } from '@/services/rich-content'
import { markdown, renderMarkdown, headings, type Heading } from '@/services/markdown'
import { frontmatter, documentBody } from '@/services/frontmatter'
import type { Document } from '@/types'
import { toolbarItems,moveParagraph } from '@/services/writing'
import { Button } from '@/components/ui/button'
import ImageTools, { type SelectedImage } from './ImageTools.vue'
import { imageReferences, imageMarkdown, type ImageReference } from '@/services/image-markdown'

const props = defineProps<{ document: Document; active: boolean; dark: boolean }>(), store = useWorkbench()
const live = ref<HTMLElement>(), preview = ref<HTMLElement>(), source = ref<HTMLTextAreaElement>(), host = ref<HTMLElement>(), initializing = ref(false)
const emit = defineEmits<{ structure:[kind:'table'|'code',index:number]; selection: [text: string] }>()
const tableActions = ref({ open: false, top: 0, left: 0, index: 0, rows: 0, columns: 0 })
let hoveredTable: HTMLTableElement | undefined, tableActionsCloseTimer: ReturnType<typeof setTimeout> | undefined
const wikiQuery=ref<string|null>(null),wikiIndex=ref(0),wikiStart=ref(0)
const wikiOptions=computed(()=>knowledgeDocs.value.filter(d=>d.workspaceId===props.document.workspaceId).flatMap(d=>{const query=wikiQuery.value||'',hash=query.indexOf('#');return hash>=0?d.path.replace(/\.md$/i,'')===query.slice(0,hash)?d.titles.filter(h=>h.text.includes(query.slice(hash+1))).map(h=>({target:d.path.replace(/\.md$/i,'')+'#'+h.text,label:d.path+' · '+h.text})):[]:d.path.toLowerCase().includes(query.toLowerCase())?[{target:d.path.replace(/\.md$/i,''),label:d.path}]:[]}).slice(0,12))
async function updateWiki(){const el=source.value;if(!el||props.document.view==='live')return;const match=/\[\[([^\]\n]*)$/.exec(el.value.slice(0,el.selectionStart));wikiQuery.value=match?.[1]??null;wikiIndex.value=0;if(match){wikiStart.value=el.selectionStart-match[0].length;try{await loadKnowledge()}catch{}}}
function chooseWiki(item=wikiOptions.value[wikiIndex.value]){const el=source.value;if(!el||!item)return;const end=el.selectionStart+(el.value.slice(el.selectionStart,el.selectionStart+2)===']]'?2:0);el.setRangeText('[['+item.target+']]',wikiStart.value,end,'end');store.change(props.document,el.value,'link');wikiQuery.value=null;el.focus()}
const html = ref(''), slashQuery=ref<string|null>(null), slashIndex=ref(0)
let slashRange:{start:number;end:number}|undefined, slashLiveRange:Range|undefined
const slashItems=[{id:'heading',label:'标题',text:'# '},{id:'list',label:'列表',text:'- '},{id:'quote',label:'引用',text:'> '},{id:'task',label:'任务列表',text:'- [ ] '},{id:'table',label:'表格',text:'| 标题 | 标题 |\n| --- | --- |\n| 内容 | 内容 |\n'},{id:'code',label:'代码块',text:'```text\n\n```'},{id:'image',label:'图片',text:''},{id:'math',label:'数学公式',text:'$$\nx^2+y^2=z^2\n$$\n'},{id:'mermaid',label:'Mermaid 图表',text:'```mermaid\nflowchart LR\n  A[开始] --> B[完成]\n```\n'},{id:'footnote',label:'脚注',text:'注释[^1]\n\n[^1]: 注释内容\n'},{id:'callout',label:'提示块',text:'> [!NOTE]\n> 提示内容\n'},{id:'divider',label:'分隔线',text:'---\n'}]
const slashOptions=computed(()=>slashItems.filter(i=>!slashQuery.value||i.label.includes(slashQuery.value)||i.id.includes(slashQuery.value)))
const imageInput = ref<HTMLInputElement>(), imageTools = ref<InstanceType<typeof ImageTools>>(), selectedImage = ref<SelectedImage>(), imageBusy = ref(false)
const tablePicker = ref({ open: false, top: 0, left: 0, rows: 2, columns: 2 })
let tableOpenTimer: ReturnType<typeof setTimeout> | undefined, tableCloseTimer: ReturnType<typeof setTimeout> | undefined
let imageTarget: { reference: ImageReference; snapshot: string } | undefined
let importTarget: typeof imageTarget, insertionSnapshot = '', insertionRange: { start: number; end: number } | undefined
let liveInsertionRange: Range | undefined
function clearImage() { selectedImage.value = undefined; imageTarget = undefined }
function pickImage(replace = false) {
  if (props.document.view === 'preview' || imageBusy.value || initializing.value) return
  syncLive()
  importTarget = replace ? imageTarget : undefined
  if (replace && !importTarget) return
  insertionSnapshot = props.document.text
  insertionRange = props.document.view === 'live' ? undefined : { start: source.value?.selectionStart || 0, end: source.value?.selectionEnd || 0 }
  const selected = window.getSelection()
  liveInsertionRange = props.document.view === 'live' && selected?.rangeCount && live.value?.contains(selected.anchorNode) ? selected.getRangeAt(0).cloneRange() : undefined
  // Keep Vditor's caret bookmark while the system picker is open.
  imageInput.value?.click()
}
async function chosenImage(event: Event) {
  const input = event.target as HTMLInputElement, files = Array.from(input.files || [])
  try {
    if (!importTarget && liveInsertionRange && props.document.view === 'live' && props.document.text === insertionSnapshot) { const selected = window.getSelection(); selected?.removeAllRanges(); selected?.addRange(liveInsertionRange) }
    await filesToMarkdown(files, importTarget, insertionSnapshot, insertionRange)
  } finally { input.value = ''; importTarget = undefined; liveInsertionRange = undefined }
}
function applyImage(value: string) {
  syncLive()
  const target = imageTarget
  if (!target || props.document.text !== target.snapshot) { toast.warning('文档已变化，请重新选择图片。'); clearImage(); return false }
  const { start, end } = target.reference
  store.change(props.document, target.snapshot.slice(0, start) + value + target.snapshot.slice(end),'image'); props.document.generation++; clearImage(); return true
}
function describeImage(alt: string) { if (imageTarget) applyImage(imageMarkdown(alt, imageTarget.reference.url, imageTarget.reference.title)) }
async function copyImagePath() { try { if (selectedImage.value) { await navigator.clipboard.writeText(selectedImage.value.url); toast.success('图片路径已复制') } } catch(e) { toast.error(message(e)) } }
async function imageDirectory() { try { if (selectedImage.value) await call('open_image_directory', { documentId: props.document.id, url: selectedImage.value.url }) } catch(e) { toast.error(message(e)) } }
function selectImage(img: HTMLImageElement) {
  syncLive()
  const url = img.dataset.markflowUrl || reverseImages.get(img.src) || img.getAttribute('src') || ''
  const container = preview.value?.contains(img) ? preview.value : live.value
  const peers = Array.from(container?.querySelectorAll<HTMLImageElement>('img') || []).filter(el => (el.dataset.markflowUrl || reverseImages.get(el.src) || el.getAttribute('src')) === url)
  const references = imageReferences(props.document.text).filter(ref => ref.url === url)
  const reference = peers.length === references.length ? references[peers.indexOf(img)] : undefined
  imageTarget = reference ? { reference, snapshot: props.document.text } : undefined
  selectedImage.value = { url, alt: reference?.alt || img.alt, src: img.src, unavailable: img.dataset.markflowUnavailable === 'true' || !img.getAttribute('src'), editable: !!reference }
}
async function imageDoubleClick(event: MouseEvent) { const img = (event.target as HTMLElement).closest('img'); if (!img) return; event.preventDefault(); event.stopPropagation(); selectImage(img); await nextTick(); imageTools.value?.openPreview() }
watch(() => [props.document.view, props.active, props.document.generation], clearImage)
let renderTimer: ReturnType<typeof setTimeout>
watch(() => [props.document.text, props.document.view, props.active], () => {
  clearTimeout(renderTimer)
  if (!props.active || !['split', 'preview'].includes(props.document.view)) return
  if (props.document.text.length > 2 * 1024 * 1024) { store.setView('source'); toast.info('超过 2MiB 的文档使用源码视图，保持输入流畅。'); return }
  renderTimer = setTimeout(() => { html.value = renderMarkdown(props.document.text) }, props.document.text.length > 100000 ? 300 : 80)
}, { immediate: true })
let scrollLock = false, scrollFrame = 0
function scroll(event: Event) {
  queueLineNumbers()
  clearTimeout(imageTimer); imageTimer = setTimeout(() => { void decorateImages(preview.value); void decorateImages(live.value) }, 120)
  if (scrollLock || props.document.view !== 'split' || !store.preferences.syncScroll) return
  const origin = event.target as HTMLElement, destination = origin === source.value ? preview.value : origin === preview.value ? source.value : undefined
  if (!destination) return
  scrollLock = true; const range = origin.scrollHeight - origin.clientHeight
  destination.scrollTop = (range > 0 ? origin.scrollTop / range : 0) * (destination.scrollHeight - destination.clientHeight)
  cancelAnimationFrame(scrollFrame); scrollFrame = requestAnimationFrame(() => { scrollLock = false })
}
function selection() {
  if (!props.active) return
  const el = source.value, selected = window.getSelection()
  const text = document.activeElement === el && el ? el.value.slice(el.selectionStart, el.selectionEnd) : selected?.anchorNode && host.value?.contains(selected.anchorNode) ? selected.toString() : ''
  emit('selection', text);if(document.activeElement===el&&el)store.checkpoint(el.selectionStart);else if(selected?.anchorNode&&live.value?.contains(selected.anchorNode))store.checkpoint(currentPosition())
}
async function selectRange(start: number, end: number) {
  syncLive(); store.setView('source'); await nextTick()
  const el = source.value; if (!el) return
  el.focus(); el.setSelectionRange(start,end)
  const line = props.document.text.slice(0,start).split('\n').length - 1
  el.scrollTop = Math.max(0, line * parseFloat(getComputedStyle(el).lineHeight) - el.clientHeight / 3)
  selection()
}
async function jumpLine(line: number) { const start = props.document.text.split('\n').slice(0, Math.max(0,line-1)).reduce((sum,value) => sum+value.length+1,0); await selectRange(start,start) }
const composition = ref(false)
const lineMarks = ref<{ line: number; top: number; left: number }[]>([])
let lineFrame = 0, lineResize: ResizeObserver | undefined
function queueLineNumbers() {
  cancelAnimationFrame(lineFrame)
  lineFrame = requestAnimationFrame(updateLineNumbers)
}
function updateLineNumbers() {
  const container = host.value
  if (!container || !props.active || !store.preferences.lineNumbers) { lineMarks.value = []; return }
  const bounds = container.getBoundingClientRect(), marks: typeof lineMarks.value = []
  const starts = (props.document.view === 'source' ? [] : markdown.parse(props.document.text, {})).filter(t => t.level === 0 && t.map && t.nesting !== -1).map(t => t.map![0] + 1)
  function blockMarks(root: HTMLElement | null | undefined) {
    if (!root) return
    const viewport = root.parentElement!.getBoundingClientRect()
    Array.from(root.children).forEach((block, index) => {
      const rect = block.getBoundingClientRect()
      if (rect.bottom < viewport.top || rect.top > viewport.bottom) return
      marks.push({ line: starts[index] || index + 1, top: Math.max(rect.top, viewport.top) - bounds.top, left: Math.max(4, rect.left - bounds.left - 44) })
    })
  }
  if (props.document.view === 'live') blockMarks(live.value?.querySelector<HTMLElement>('.vditor-ir .vditor-reset'))
  if (props.document.view === 'preview' || props.document.view === 'split') blockMarks(preview.value)
  if (props.document.view === 'source' || props.document.view === 'split') {
    const el = source.value
    if (el) {
      const rect = el.getBoundingClientRect(), style = getComputedStyle(el), height = parseFloat(style.lineHeight), padding = parseFloat(style.paddingTop)
      const count = props.document.text.split('\n').length
      for (let index = Math.max(0, Math.floor((el.scrollTop - padding) / height)); index < count; index++) {
        const top = rect.top + padding + index * height - el.scrollTop
        if (top > rect.bottom - height) break
        if (top < rect.top) continue
        marks.push({ line: index + 1, top: top - bounds.top, left: rect.left - bounds.left + parseFloat(style.paddingLeft) - 34 })
      }
    }
  }
  lineMarks.value = marks
}
watch(() => [store.preferences.lineNumbers, store.preferences.documentStyle, store.preferences.bodySize, store.preferences.codeSize, store.preferences.uiSize, props.document.text, props.document.view, props.active], () => void nextTick(queueLineNumbers))
let editor: Vditor | undefined, suppress = false, observer: MutationObserver | undefined, disposed = false, liveText = '', imageTimer: ReturnType<typeof setTimeout> | undefined
let externalToolbar: HTMLElement | undefined, bookmarkedRange: Range | undefined
function bookmark() {
  const selected = window.getSelection()
  if (selected?.rangeCount && live.value?.contains(selected.anchorNode)) bookmarkedRange = selected.getRangeAt(0).cloneRange()
}
function restoreBookmark() {
  if (bookmarkedRange?.startContainer.isConnected && live.value?.contains(bookmarkedRange.startContainer)) { const selected = window.getSelection(); selected?.removeAllRanges(); selected?.addRange(bookmarkedRange) }
}
function placeToolbar() {
  const target = document.getElementById(`format-${props.document.id}`)
  const toolbar = externalToolbar || live.value?.querySelector<HTMLElement>('.vditor-toolbar')
  if (target && toolbar) { toolbar.classList.add('markflow-format-toolbar'); target.appendChild(toolbar); externalToolbar = toolbar;configureToolbar() }
}
function configureToolbar(){if(!externalToolbar)return;const ids=[...store.preferences.toolbarOrder,...toolbarItems.map(i=>i.id)].filter((id,i,a)=>a.indexOf(id)===i);for(const id of ids){const button=externalToolbar.querySelector<HTMLButtonElement>(`button[data-type="${id}"]`);const item=button?.closest<HTMLElement>('.vditor-toolbar__item');if(item){item.hidden=store.preferences.toolbarHidden.includes(id);externalToolbar.appendChild(item)}if(id==='table'&&button){button.title='';button.setAttribute('aria-label','插入表格')}}externalToolbar.querySelectorAll('.vditor-toolbar__divider').forEach(d=>d.remove())
}
function openTablePicker(button: HTMLElement) {
  clearTimeout(tableCloseTimer)
  const rect = button.getBoundingClientRect(), width = 236, height = 300
  tablePicker.value = { open: true, top: Math.max(8, Math.min(rect.bottom + 8, innerHeight - height - 8)), left: Math.max(8, Math.min(rect.left, innerWidth - width - 8)), rows: 2, columns: 2 }
}
function scheduleTablePickerClose() { clearTimeout(tableOpenTimer); clearTimeout(tableCloseTimer); tableCloseTimer = setTimeout(() => { tablePicker.value.open = false }, 220) }
function keepTablePickerOpen() { clearTimeout(tableCloseTimer) }
function toolbarPointerOver(event: Event) {
  const button = (event.target as HTMLElement).closest<HTMLElement>('button[data-type="table"]')
  if (!button) return
  clearTimeout(tableCloseTimer)
  if (tablePicker.value.open || tableOpenTimer) return
  bookmark()
  tableOpenTimer = setTimeout(() => { tableOpenTimer = undefined; openTablePicker(button) }, 160)
}
function toolbarPointerOut(event: Event) {
  const button = (event.target as HTMLElement).closest<HTMLElement>('button[data-type="table"]')
  const item = button?.closest<HTMLElement>('.vditor-toolbar__item')
  if (item && !item.contains((event as PointerEvent).relatedTarget as Node | null)) scheduleTablePickerClose()
}
function insertTable(rows: number, columns: number) {
  if (!editor || props.document.view !== 'live') return
  const header = '| ' + Array.from({ length: columns }, () => '标题').join(' | ') + ' |'
  const separator = '| ' + Array.from({ length: columns }, () => '---').join(' | ') + ' |'
  const row = '| ' + Array.from({ length: columns }, () => '内容').join(' | ') + ' |'
  store.beginOperation(props.document, 'format'); restoreBookmark(); editor.focus(); editor.insertValue([header, separator, ...Array.from({ length: rows - 1 }, () => row)].join('\n') + '\n'); syncLive()
  tablePicker.value.open = false
}
function toolbarClick(e:Event){const button=(e.target as HTMLElement).closest<HTMLElement>('button[data-type]');if(button?.dataset.type==='table'){e.preventDefault();e.stopImmediatePropagation();bookmark();openTablePicker(button);return}if(button?.dataset.type==='undo'||button?.dataset.type==='redo'){e.preventDefault();e.stopImmediatePropagation();syncLive();store.undo(props.document,button.dataset.type==='redo')}
}
watch(()=>[store.preferences.toolbarOrder.join(),store.preferences.toolbarHidden.join()],configureToolbar)
function toolbarReady(){externalToolbar?.addEventListener('click',toolbarClick,true);externalToolbar?.addEventListener('pointerover',toolbarPointerOver);externalToolbar?.addEventListener('pointerout',toolbarPointerOut)
}
function showTableActions(table: HTMLTableElement) {
  clearTimeout(tableActionsCloseTimer)
  if (hoveredTable === table && tableActions.value.open) return
  const tableRoot = table.closest<HTMLElement>('.markdown-body, .vditor-reset')
  if (!tableRoot) return
  const index = [...tableRoot.querySelectorAll('table')].indexOf(table)
  if (index < 0) return
  hoveredTable = table
  const rect = table.getBoundingClientRect(), width = 390, height = 52
  tableActions.value = { open: true, top: Math.max(8, rect.top - height - 6), left: Math.max(8, Math.min(rect.right - width, innerWidth - width - 8)), index, rows: table.querySelectorAll('tr').length, columns: table.querySelector('tr')?.children.length || 0 }
}
function tablePointerOver(event: PointerEvent) {
  const table = (event.target as HTMLElement).closest<HTMLTableElement>('table')
  if (table) showTableActions(table)
}
function closeTableActionsLater() { clearTimeout(tableActionsCloseTimer); tableActionsCloseTimer = setTimeout(() => { tableActions.value.open = false; hoveredTable = undefined }, 260) }
function keepTableActionsOpen() { clearTimeout(tableActionsCloseTimer) }
function tablePointerOut(event: PointerEvent) {
  const table = (event.target as HTMLElement).closest<HTMLTableElement>('table')
  if (table && !table.contains(event.relatedTarget as Node | null)) closeTableActionsLater()
}
function pipeCells(line: string) {
  let value = line.trim()
  if (value.startsWith('|')) value = value.slice(1)
  if (value.endsWith('|') && !value.endsWith('\\|')) value = value.slice(0, -1)
  const cells: string[] = []; let cell = '', escaped = false
  for (const char of value) { if (char === '|' && !escaped) { cells.push(cell.trim()); cell = ''; continue }; cell += char; escaped = char === '\\' ? !escaped : false }
  cells.push(cell.trim())
  return cells
}
function changeTable(operation: 'add-row' | 'delete-row' | 'add-column' | 'delete-column') {
  const d = props.document
  if (d.view === 'live') syncLive()
  const tables = markdown.parse(d.text, {}).filter(token => token.type === 'table_open' && token.map)
  const block = tables[tableActions.value.index]?.map
  if (!block) { toast.warning('表格已变化，请重新悬停后再试。'); tableActions.value.open = false; return }
  const lines = d.text.split('\n'), rows = lines.slice(block[0], block[1]).map(pipeCells), width = Math.max(0, ...rows.map(row => row.length))
  if (operation === 'add-row') { if (rows.length >= 101) { toast.info('表格最多支持 100 行。'); return }; rows.push(Array(width).fill('')) }
  if (operation === 'delete-row') { if (rows.length <= 2) { toast.info('表格至少保留标题行。'); return }; rows.pop() }
  if (operation === 'add-column') { if (width >= 20) { toast.info('表格最多支持 20 列。'); return }; rows.forEach((row, index) => row.push(index === 1 ? '---' : '')) }
  if (operation === 'delete-column') { if (width <= 1) { toast.info('表格至少保留一列。'); return }; rows.forEach(row => row.pop()) }
  const next = [...lines.slice(0, block[0]), ...rows.map(row => '| ' + row.join(' | ') + ' |'), ...lines.slice(block[1])].join('\n')
  store.beginOperation(d, 'table'); store.change(d, next, 'table'); d.generation++
  tableActions.value.open = false; hoveredTable = undefined
}
function format(name: string) {
  if(name==='undo'||name==='redo'){syncLive();store.undo(props.document,name==='redo');return}
  if (props.document.view === 'preview' || initializing.value) return
  if (props.document.view === 'live' && editor) {
    store.beginOperation(props.document,'format');restoreBookmark(); editor.focus()
    if (name === 'heading') externalToolbar?.querySelector<HTMLButtonElement>('button[data-tag="h1"]')?.click()
    else externalToolbar?.querySelector<HTMLButtonElement>(`button[data-type="${name}"]`)?.click()
    syncLive(); return
  }
  const el = source.value; if (!el) return
  el.focus()
  if (name === 'undo' || name === 'redo') { document.execCommand(name); store.change(props.document, el.value); return }
  const start = el.selectionStart, end = el.selectionEnd, selected = el.value.slice(start, end)
  const markers: Record<string, [string, string]> = { bold:['**','**'], italic:['*','*'], heading:['# ',''], list:['- ',''], quote:['> ',''] }
  const marker = markers[name]; if (!marker) return
  const value = marker[0] + (selected || '文字') + marker[1]
  el.setRangeText(value, start, end, 'end'); store.change(props.document, el.value,'format')
  el.setSelectionRange(start + marker[0].length, start + value.length - marker[1].length)
}
const imageCache = new Map<string, string>(), reverseImages = new Map<string, string>()
function destroyLive() {
  if (!editor) return
  const instance = editor; editor = undefined
  // Vditor 4's destroy() unconditionally accesses the unused WYSIWYG engine in IR mode.
  const engine = instance.vditor.wysiwyg
  if (!engine) instance.vditor.wysiwyg = { unbindListener: () => {} } as NonNullable<Vditor['vditor']['wysiwyg']>
  try { instance.destroy() } finally { if (!engine) instance.vditor.wysiwyg = engine; clearTimeout(tableOpenTimer);clearTimeout(tableCloseTimer);tablePicker.value.open=false;externalToolbar?.removeEventListener('click',toolbarClick,true);externalToolbar?.removeEventListener('pointerover',toolbarPointerOver);externalToolbar?.removeEventListener('pointerout',toolbarPointerOut);externalToolbar?.remove(); externalToolbar = undefined }
}
function canonical(value: string) { for (const [data, url] of reverseImages) value = value.replaceAll(data, url); return value }
function hydrateImage(img: HTMLImageElement, data: string, url: string) {
  // Distinguish equal image bytes referenced by different Markdown paths.
  const resolved = `${data}#markflow-${encodeURIComponent(url)}`
  reverseImages.set(resolved, url); img.dataset.markflowUnavailable = 'false'; img.removeAttribute('title'); img.src = resolved
}
function unavailableImage(img: HTMLImageElement, url: string, title: string) {
  const svg = '<svg xmlns="http://www.w3.org/2000/svg" width="400" height="88"><rect width="400" height="88" rx="6" fill="#eeeeee"/><text x="18" y="36" fill="#555555" font-size="16">图片无法显示</text><text x="18" y="64" fill="#555555" font-size="13">点击图片查看路径或重新选择图片</text></svg>'
  hydrateImage(img, 'data:image/svg+xml;base64,' + btoa(unescape(encodeURIComponent(svg))), url)
  img.dataset.markflowUnavailable = 'true'; img.setAttribute('aria-label', `${title}\n${url}`)
}
function imageError(event: Event) {
  const img = event.target
  if (!(img instanceof HTMLImageElement) || img.dataset.markflowUnavailable === 'true') return
  const container = preview.value?.contains(img) ? preview.value : live.value?.contains(img) ? live.value : undefined
  if (container && img.dataset.markflowUrl) unavailableImage(img, img.dataset.markflowUrl, '图片无法解码，请重新选择图片。')
}
async function decorateImages(container?: HTMLElement) {
  if (!container || !props.active) return
  for (const img of container.querySelectorAll<HTMLImageElement>('img')) {
    let url = img.dataset.markflowUrl || img.getAttribute('src') || ''
    const existing = img.getAttribute('src') || ''
    if (existing.startsWith('data:') && reverseImages.has(existing)) continue
    if (url.startsWith('data:') && reverseImages.has(url)) continue
    if (!url || img.dataset.markflowLoading === 'true') continue
    const viewport = container.getBoundingClientRect(), bounds = img.getBoundingClientRect()
    if (bounds.top > viewport.bottom + 300 || bounds.bottom < viewport.top - 300) continue
    img.dataset.markflowUrl = url
    if (/^(https?:|\/\/|data:|file:)/i.test(url)) { unavailableImage(img, url, '远程或内嵌图片默认不加载，请使用本地附件。'); continue }
    img.dataset.markflowLoading = 'true'
    try { let data = imageCache.get(url); if (!data) { data = await call<string>('resolve_image', { documentId: props.document.id, url }); if (!data) throw new Error('图片不存在'); if (data.length <= 8 * 1024 * 1024) { if (imageCache.size >= 12) imageCache.delete(imageCache.keys().next().value!); imageCache.set(url, data) } }; if (data && img.isConnected && props.active) hydrateImage(img, data, url) }
    catch { unavailableImage(img, url, `无法访问图片：${url}`) }
    finally { delete img.dataset.markflowLoading }
  }
}
function syncLive() {
  if (!editor || suppress || initializing.value || disposed || props.document.view !== 'live' || composition.value) return
  const text = canonical(editor.getValue()); if (text === liveText) return; liveText = text; const meta = frontmatter(props.document.text); store.change(props.document, (meta.error ? '' : meta.prefix + (meta.prefix && !meta.prefix.endsWith('\n') ? '\n' : '')) + text)
}
async function initLive() {
  if (!live.value || props.document.view !== 'live' || !props.active) return
  if (props.document.text.length > 512000) { if (!initializing.value) { observer?.disconnect(); destroyLive() }; store.setView('source'); toast.info('大文档已使用源码视图，避免可视化编辑卡顿。'); return }
  if (editor || initializing.value) return
  initializing.value = true
  const initialGeneration = props.document.generation
  editor = new Vditor(live.value, {
    mode: 'ir', value: documentBody(props.document.text), height: '100%', minHeight: 200, cache: { enable: false }, cdn: `${location.origin}/vendor/vditor`, theme: props.dark ? 'dark' : 'classic', lang: 'zh_CN',
    toolbar: ['headings','bold','italic','strike','|','list','ordered-list','check','quote','|','code','inline-code','link','table','|','undo','redo'],
    undoDelay: 100, hint: { emoji: {} }, link: { isOpen: false }, image: { isPreview: false },
    preview: { delay: 100, hljs: { enable: store.preferences.codeHighlight, lineNumber: store.preferences.codeNumbers, style: props.dark?'dracula':'github' }, markdown: { sanitize: true, footnotes: true, toc: false, autoSpace: false, fixTermTypo: false, mathBlockPreview: true, codeBlockPreview: false, callout: true, mark: false, sup: false, sub: false, gfmAutoLink: true } },
    after: () => { if (disposed) { destroyLive(); return }; if (props.document.generation !== initialGeneration) { suppress = true; editor!.setValue(documentBody(props.document.text), true); suppress = false }; liveText = canonical(editor!.getValue()); initializing.value = false; placeToolbar();toolbarReady(); observer = new MutationObserver(() => { queueLineNumbers(); clearTimeout(imageTimer); imageTimer = setTimeout(() => void decorateImages(live.value), 100) }); observer.observe(live.value!, { childList: true, subtree: true }); queueLineNumbers(); void decorateImages(live.value) },
    input: () => {syncLive(); updateSlash(); typewriter()},
  })
}
watch(() => props.document.view, async view => { tableActions.value.open=false;hoveredTable=undefined;await nextTick(); if (view === 'live') { await initLive(); if (props.document.view === 'live' && editor && !initializing.value && documentBody(props.document.text) !== liveText) { suppress = true; editor.setValue(documentBody(props.document.text), true); liveText = canonical(editor.getValue()); suppress = false } }; void decorateImages(preview.value) })
watch(() => props.document.generation, () => { imageCache.clear(); if (props.document.text.length > 512000 && !initializing.value) { observer?.disconnect(); destroyLive() }; if (editor && !initializing.value) { suppress = true; editor.setValue(documentBody(props.document.text), true); liveText = canonical(editor.getValue()); suppress = false }; void nextTick(() => decorateImages(preview.value)) })
watch(()=>[html.value,store.preferences.codeWrap,store.preferences.codeNumbers,store.preferences.codeHighlight], () => void nextTick(async () => {await decorateImages(preview.value);await decorateRichContent(preview.value,{fold:true,wrap:store.preferences.codeWrap,numbers:store.preferences.codeNumbers,highlight:store.preferences.codeHighlight,edit:index=>emit('structure','code',index)})}))
watch(() => props.dark, value => editor?.setTheme(value ? 'dark' : 'classic'))
watch(() => [props.active, props.document.view], () => void nextTick(placeToolbar))
let idleTimer: ReturnType<typeof setTimeout>
watch(() => props.active, active => {
  clearTimeout(idleTimer)
  if(!active){clearTimeout(tableActionsCloseTimer);tableActions.value.open=false;hoveredTable=undefined}
  if (active) void nextTick(() => { void initLive(); void decorateImages(preview.value) })
  else idleTimer = setTimeout(() => { if (!initializing.value) { observer?.disconnect(); destroyLive(); imageCache.clear(); reverseImages.clear(); html.value = ''; preview.value?.querySelectorAll('img').forEach(img => img.removeAttribute('src')) } },60000)
})
function sourceInput(event: Event) { if (!composition.value) {store.change(props.document, (event.target as HTMLTextAreaElement).value);updateSlash();void updateWiki();typewriter()} }
function compositionEnd(event: CompositionEvent) { composition.value = false; if (props.document.view === 'live') syncLive(); else sourceInput(event) }
function sourceKey(event: KeyboardEvent) {
  if(event.isComposing||event.ctrlKey||event.metaKey)return
  if(event.altKey&&(event.key==='ArrowUp'||event.key==='ArrowDown')){event.preventDefault();void moveBlock(event.key==='ArrowUp'?-1:1);return}
  const el=source.value!;const start=el.selectionStart,end=el.selectionEnd
  if(event.key==='Tab'){event.preventDefault();const result=indentSelection(el.value,start,end,event.shiftKey);el.value=result.text;el.setSelectionRange(result.start,result.end);store.change(props.document,el.value,'indent');return}
  if(!store.preferences.syntaxAssist||event.altKey)return
  const pairs:Record<string,string>={'(':')','[':']','{':'}','"':'"',"'":"'",'`':'`'}
  if(pairs[event.key]){event.preventDefault();const selected=el.value.slice(start,end);el.setRangeText(event.key+selected+pairs[event.key],start,end,'end');el.setSelectionRange(start+1,start+1+selected.length);store.change(props.document,el.value);void updateWiki();return}
  if(event.key==='Enter'&&start===end){const line=el.value.slice(0,start).split('\n').at(-1)||'';const match=/^(\s*)([-+*]|\d+\.) (\[[ xX]\] )?(.*)$/.exec(line);if(match){event.preventDefault();if(!match[4])el.setRangeText('\n',start-line.length,start,'end');else{const marker=/\d/.test(match[2]!)?`${parseInt(match[2]!)+1}.`:match[2];el.setRangeText(`\n${match[1]}${marker} ${match[3]?'[ ] ':''}`,start,end,'end')}store.change(props.document,el.value);return}
    const fence=/^\s*(`{3,}|~{3,})([a-z\d-]*)$/.exec(line);if(fence){event.preventDefault();el.setRangeText(`\n\n${fence[1]}`,start,end,'end');el.setSelectionRange(start+1,start+1);store.change(props.document,el.value)}
  }
}
function currentPosition(){if(props.document.view!=='live')return source.value?.selectionStart||0;const sel=window.getSelection();let block=sel?.anchorNode?.parentElement;const root=live.value?.querySelector('.vditor-reset');while(block&&block.parentElement!==root)block=block.parentElement;if(!block||!root)return 0;const index=[...root.children].indexOf(block);const maps=markdown.parse(documentBody(props.document.text),{}).filter(t=>t.level===0&&t.block&&t.map&&t.nesting!==-1);const line=maps[index]?.map?.[0]||0;const prefix=frontmatter(props.document.text).prefix;return prefix.length+documentBody(props.document.text).split('\n').slice(0,line).reduce((n,l)=>n+l.length+1,0)}
async function moveBlock(delta:number){syncLive();if(props.document.view==='live'){const position=currentPosition();await selectRange(position,position)}const el=source.value;if(!el)return;const result=moveParagraph(props.document.text,el.selectionStart,el.selectionEnd,delta);if(result){store.change(props.document,result.text,'move-paragraph');props.document.generation++;await nextTick();el.focus();el.setSelectionRange(result.start,result.start)}}
function updateSlash(){if(!store.preferences.slashCommands||props.document.view==='preview'){slashQuery.value=null;return}let line='';if(props.document.view==='live'){const sel=window.getSelection();if(!sel?.anchorNode||!live.value?.contains(sel.anchorNode)){slashQuery.value=null;return}const block=sel.anchorNode.parentElement?.closest('[data-block]');line=block?.textContent?.replace(/​/g,'').trim()||'';if(/^[/][^ ]*$/.test(line)&&sel.rangeCount){const range=sel.getRangeAt(0).cloneRange();range.selectNodeContents(block!);slashLiveRange=range}}else{const el=source.value;if(!el)return;const start=el.value.lastIndexOf('\n',Math.max(0,el.selectionStart-1))+1;line=el.value.slice(start,el.selectionStart);slashRange={start,end:el.selectionStart}}slashQuery.value=/^[/][^ ]*$/.test(line)?line.slice(1):null;slashIndex.value=0}
async function chooseSlash(item=slashOptions.value[slashIndex.value]){if(!item)return;slashQuery.value=null;if(props.document.view==='live'&&editor){if(slashLiveRange){const sel=window.getSelection();sel?.removeAllRanges();sel?.addRange(slashLiveRange)}editor.deleteValue();syncLive();if(item.id==='image'){pickImage();return}insert(item.text)}else if(source.value&&slashRange){source.value.setSelectionRange(slashRange.start,slashRange.end);if(item.id==='image'){insert('');pickImage();return}insert(item.text)}}
function editorKey(e:KeyboardEvent){if(e.isComposing)return;if(wikiQuery.value!==null){if(['ArrowDown','ArrowUp'].includes(e.key)){e.preventDefault();e.stopImmediatePropagation();wikiIndex.value=(wikiIndex.value+(e.key==='ArrowDown'?1:-1)+wikiOptions.value.length)%Math.max(1,wikiOptions.value.length);return}if(e.key==='Enter'&&wikiOptions.value.length){e.preventDefault();e.stopImmediatePropagation();chooseWiki();return}if(e.key==='Escape'){e.preventDefault();e.stopImmediatePropagation();wikiQuery.value=null;return}}if(slashQuery.value!==null){if(e.key==='ArrowDown'||e.key==='ArrowUp'){e.preventDefault();e.stopImmediatePropagation();slashIndex.value=(slashIndex.value+(e.key==='ArrowDown'?1:-1)+slashOptions.value.length)%Math.max(1,slashOptions.value.length);return}if(e.key==='Enter'){e.preventDefault();e.stopImmediatePropagation();void chooseSlash();return}if(e.key==='Escape'){e.preventDefault();e.stopImmediatePropagation();slashQuery.value=null;return}}if(e.altKey&&(e.key==='ArrowUp'||e.key==='ArrowDown')){e.preventDefault();e.stopImmediatePropagation();void moveBlock(e.key==='ArrowUp'?-1:1)}}
function typewriter(){if(!store.preferences.typewriter||!props.active)return;requestAnimationFrame(()=>{const target=source.value;if(props.document.view!=='live'&&target){const line=target.value.slice(0,target.selectionStart).split('\n').length-1;const height=parseFloat(getComputedStyle(target).lineHeight)||store.preferences.codeSize*1.8;target.scrollTop=Math.max(0,line*height-target.clientHeight*Math.max(.2,Math.min(.8,store.preferences.typewriterPosition/100)))}else{const sel=window.getSelection();const block=sel?.anchorNode?.parentElement?.closest('[data-block]');const scroller=live.value?.querySelector<HTMLElement>('.vditor-ir');if(block&&scroller){const r=block.getBoundingClientRect(),s=scroller.getBoundingClientRect();scroller.scrollTop+=r.top-s.top-scroller.clientHeight*Math.max(.2,Math.min(.8,store.preferences.typewriterPosition/100))}}})}
async function filesToMarkdown(files: FileList | File[], replacement?: typeof imageTarget, snapshot?: string, range?: { start: number; end: number }) {
  if(props.document.temporary){toast.info('请先保存临时文档，再插入本地图片。');return}
  if (props.document.view === 'preview' || imageBusy.value) return
  imageBusy.value = true
  syncLive()
  snapshot ??= props.document.text
  if (!range && props.document.view !== 'live') range = { start: source.value?.selectionStart || 0, end: source.value?.selectionEnd || 0 }
  try {
  for (const file of Array.from(files)) {
    if (!file.type.startsWith('image/') && !/\.(png|jpe?g|gif|webp)$/i.test(file.name)) continue
    try {
      if (snapshot !== undefined && props.document.text !== snapshot) throw new Error('文档已变化，请重新插入图片。')
      if (file.size > 20 * 1024 * 1024) throw new Error('单张图片不能超过 20MiB')
      const data = await new Promise<string>((resolve, reject) => { const reader = new FileReader(); reader.onload = () => resolve(String(reader.result).split(',')[1]!); reader.onerror = reject; reader.readAsDataURL(file) })
      const url = await call<string>('import_image', { documentId: props.document.id, data })
      if (disposed || !props.active || (props.document.view as string) === 'preview') break
      syncLive()
      if (snapshot !== undefined && props.document.text !== snapshot) throw new Error('文档已变化，图片已导入附件目录，请重新插入。')
      if (replacement) { imageTarget = replacement; applyImage(imageMarkdown(replacement.reference.alt, url, replacement.reference.title)); break }
      const value = imageMarkdown(file.name || '图片', url)
      if (range && source.value) { source.value.setSelectionRange(range.start, range.end); insert(value); range = { start: source.value.selectionStart, end: source.value.selectionEnd } }
      else insert(value)
      if (snapshot !== undefined) snapshot = props.document.text
    } catch(e) { toast.error(message(e)) }
  }
  } finally { imageBusy.value = false }
}
function insert(text: string) { store.beginOperation(props.document,'insert');if (props.document.view === 'live' && editor) { editor.focus(); editor.insertValue(text); syncLive() } else { const el = source.value!; el.focus(); el.setRangeText(text, el.selectionStart, el.selectionEnd, 'end'); store.change(props.document, el.value) } }
function paste(event: ClipboardEvent) { if (event.clipboardData?.files.length) { event.preventDefault(); event.stopImmediatePropagation(); void filesToMarkdown(event.clipboardData.files) } }
function drop(event: DragEvent) { if (event.dataTransfer?.files.length) { event.preventDefault(); event.stopImmediatePropagation(); void filesToMarkdown(event.dataTransfer.files) } }
async function click(event: MouseEvent) {
  const image = (event.target as HTMLElement).closest<HTMLImageElement>('img')
  if (image) { event.preventDefault(); event.stopPropagation(); selectImage(image); return }
  clearImage()
  const link = (event.target as HTMLElement).closest<HTMLAnchorElement>('a[href]'); if (!link) return
  event.preventDefault(); event.stopPropagation(); const url = link.getAttribute('href') || ''
  try {
    if(link.dataset.wiki){await openKnowledgeLink(props.document,link.dataset.wiki,true);return}
    if (/^https?:\/\//i.test(url)) { if (desktop) await openUrl(url); else window.open(url, '_blank', 'noopener,noreferrer'); return }
    if(url.includes('#')&&!url.startsWith('#')){await openKnowledgeLink(props.document,url);return}
    if (url.startsWith('#')) {const anchor=decodeURIComponent(url.slice(1));const target=preview.value?.querySelector<HTMLElement>(`[id="${CSS.escape(anchor)}"]`);if(!target){const heading=headings(props.document.text).find(h=>h.text===anchor||h.text.toLowerCase().replace(/[^\p{L}\p{N} -]/gu,'').replace(/ /g,'-')===anchor);if(heading)jump(heading);else toast.warning('目标章节或脚注不存在');return}for(let p=target?.parentElement;p;p=p.parentElement)if(p instanceof HTMLDetailsElement)p.open=true;target?.scrollIntoView({ behavior: 'smooth', block: 'start' }); return }
    const path = await call<string>('resolve_markdown_link', { documentId: props.document.id, url }); await store.open(props.document.workspaceId, path)
  } catch(e) { toast.error(message(e)) }
}
function headingEvent(e:Event){if(props.active)jump((e as CustomEvent<Heading>).detail)}
async function jump(heading: Heading) {
  await nextTick();if(['split','preview'].includes(props.document.view)){html.value=renderMarkdown(props.document.text);await nextTick()}
  if (props.document.view === 'source' || props.document.view === 'split') { const el = source.value!; const position = props.document.text.split('\n').slice(0, heading.line).reduce((total, line) => total + line.length + 1, 0); el.focus(); el.setSelectionRange(position, position); const lineHeight = store.preferences.codeSize * 1.8; el.scrollTop = Math.max(0, heading.line * lineHeight - 80) }
  if (props.document.view === 'live') { live.value?.querySelectorAll('h1,h2,h3,h4,h5,h6')[heading.index]?.scrollIntoView({ behavior: 'smooth', block: 'start' }) }
  else {const el=preview.value?.querySelector<HTMLElement>(`#${heading.id}`);for(let parent=el?.parentElement;parent;parent=parent.parentElement)if(parent instanceof HTMLDetailsElement)parent.open=true;el?.scrollIntoView({ behavior: 'smooth', block: 'start' })}
}
onMounted(() => {window.addEventListener('markflow-heading',headingEvent); void initLive(); document.addEventListener('selectionchange', selection); lineResize = new ResizeObserver(queueLineNumbers); if (host.value) lineResize.observe(host.value); queueLineNumbers() }); onBeforeUnmount(() => {window.removeEventListener('markflow-heading',headingEvent); disposed = true; document.removeEventListener('selectionchange', selection); clearTimeout(renderTimer); clearTimeout(idleTimer); cancelAnimationFrame(scrollFrame); cancelAnimationFrame(lineFrame); lineResize?.disconnect(); observer?.disconnect(); clearTimeout(imageTimer); destroyLive() })
defineExpose({ jump, jumpLine, selectRange, sync: syncLive, pickImage, bookmark, format, moveBlock })
</script>
<template>
  <div ref="host" class="editor-pane" :data-view="document.view" :data-line-numbers="store.preferences.lineNumbers" :data-document-style="store.preferences.documentStyle" @keydown.capture="editorKey" @scroll.capture="scroll" @load.capture="queueLineNumbers" @error.capture="imageError" @paste.capture="paste" @drop.capture="drop" @dragover.prevent @compositionstart="composition = true" @compositionend="compositionEnd" @click="click" @dblclick="imageDoubleClick" @pointerover="tablePointerOver" @pointerout="tablePointerOut">
    <input ref="imageInput" type="file" accept="image/png,image/jpeg,image/gif,image/webp" :multiple="!importTarget" hidden aria-label="选择本地图片" @change="chosenImage" />
    <div v-show="document.view === 'live'" ref="live" class="live-editor" />
    <div v-if="initializing && document.view === 'live'" class="editor-loading">正在准备编辑器…</div>
    <div v-show="document.view !== 'live'" class="source-preview-layout" :class="{ 'is-split': document.view === 'split' }">
      <div v-show="document.view === 'source' || document.view === 'split'" class="source-wrapper">
        <div v-if="document.view === 'split'" class="pane-label">源码</div>
        <textarea ref="source" :value="document.text" :wrap="store.preferences.lineNumbers ? 'off' : 'soft'" class="source-editor" aria-label="Markdown 源码" spellcheck="false" @input="sourceInput" @keydown="sourceKey" @blur="store.preferences.saveOnBlur && store.save(document)" />
      </div>
      <div v-show="document.view === 'split' || document.view === 'preview'" class="preview-wrapper">
        <div v-if="document.view === 'split'" class="pane-label">预览</div>
        <article ref="preview" class="markdown-body" v-html="html" />
      </div>
    </div>
    <div v-if="store.preferences.lineNumbers" class="line-number-layer" aria-hidden="true"><span v-for="(mark, index) in lineMarks" :key="index" :style="{ top: mark.top + 'px', left: mark.left + 'px' }">{{ mark.line }}</span></div>
    <div v-if="active&&wikiQuery!==null" role="listbox" aria-label="文档链接补全" class="absolute bottom-5 left-8 z-20 flex max-h-72 w-80 flex-col overflow-auto rounded-xl border bg-popover p-1 shadow-lg"><Button v-for="(item,index) in wikiOptions" :key="item.target" :variant="index===wikiIndex?'secondary':'ghost'" role="option" :aria-selected="index===wikiIndex" class="justify-start truncate" @mousedown.prevent @click="chooseWiki(item)">{{item.label}}</Button><p v-if="!wikiOptions.length" class="p-3 text-xs text-muted-foreground">未找到文档；输入 # 可选择章节。</p></div><div v-if="active && slashQuery!==null" class="absolute bottom-5 left-8 z-20 flex max-h-72 w-56 flex-col overflow-auto rounded-xl border bg-popover p-1 shadow-lg" role="listbox" aria-label="斜杠命令"><Button v-for="(item,index) in slashOptions" :key="item.id" :variant="index===slashIndex?'secondary':'ghost'" role="option" :aria-selected="index===slashIndex" class="justify-start" @mousedown.prevent @click="chooseSlash(item)">{{item.label}}</Button><p v-if="!slashOptions.length" class="p-3 text-sm text-muted-foreground">没有匹配命令。</p></div><ImageTools v-if="active" ref="imageTools" :image="selectedImage" :busy="imageBusy" :readonly="document.view === 'preview'" :desktop="desktop" @close="clearImage" @replace="pickImage(true)" @describe="describeImage" @remove="applyImage('')" @copy="copyImagePath" @directory="imageDirectory" />
    <Teleport to="body"><div v-if="tablePicker.open" class="table-size-picker fixed z-[100] w-60 rounded-xl border bg-popover p-3 text-popover-foreground shadow-xl" :style="{ top: `${tablePicker.top}px`, left: `${tablePicker.left}px` }" role="dialog" aria-label="选择表格大小" @pointerenter="keepTablePickerOpen" @pointerleave="scheduleTablePickerClose" @keydown.esc.prevent.stop="tablePicker.open=false"><div class="mb-2 flex items-center justify-between gap-3"><span class="text-sm font-medium">插入表格</span><span class="whitespace-nowrap text-xs text-muted-foreground">{{ tablePicker.rows }} 行 × {{ tablePicker.columns }} 列</span></div><div class="grid grid-cols-10 gap-1" role="group" aria-label="表格行列数"><template v-for="row in 8" :key="row"><button v-for="column in 10" :key="column" type="button" class="size-4 rounded-[3px] border transition-colors" :class="row<=tablePicker.rows&&column<=tablePicker.columns?'border-primary bg-primary':'border-border bg-background hover:border-primary'" :aria-label="`插入 ${row} 行 ${column} 列表格`" :aria-pressed="row===tablePicker.rows&&column===tablePicker.columns" @pointerenter="tablePicker.rows=row;tablePicker.columns=column" @focus="tablePicker.rows=row;tablePicker.columns=column" @pointerdown.prevent @click="insertTable(row,column)" /></template></div><p class="mt-2 text-[11px] text-muted-foreground">悬停选择，点击插入</p></div></Teleport>
    <Teleport to="body"><div v-if="tableActions.open" class="table-hover-actions fixed z-[100] flex items-center gap-1 rounded-xl border bg-popover p-1 text-popover-foreground shadow-lg" :style="{ top: `${tableActions.top}px`, left: `${tableActions.left}px` }" role="toolbar" aria-label="表格快捷操作" @pointerenter="keepTableActionsOpen" @pointerleave="closeTableActionsLater"><button type="button" title="添加行" aria-label="添加行" class="table-action-button" :disabled="tableActions.rows>=100" @pointerdown.prevent @click="changeTable('add-row')">＋行</button><button type="button" title="删除末行" aria-label="删除末行" class="table-action-button" :disabled="tableActions.rows<=1" @pointerdown.prevent @click="changeTable('delete-row')">－行</button><span class="table-action-divider" aria-hidden="true"/><button type="button" title="添加列" aria-label="添加列" class="table-action-button" :disabled="tableActions.columns>=20" @pointerdown.prevent @click="changeTable('add-column')">＋列</button><button type="button" title="删除末列" aria-label="删除末列" class="table-action-button" :disabled="tableActions.columns<=1" @pointerdown.prevent @click="changeTable('delete-column')">－列</button><span class="table-action-divider" aria-hidden="true"/><button type="button" title="完整编辑表格" aria-label="完整编辑表格" class="table-action-button" @pointerdown.prevent @click="emit('structure','table',tableActions.index);tableActions.open=false">编辑</button></div></Teleport>
  </div>
</template>
