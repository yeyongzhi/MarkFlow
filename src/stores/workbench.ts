import { invalidateKnowledge } from '@/services/knowledge-cache'
import { record, travel, type HistoryState } from '@/services/history'
import { computed, ref, watch } from 'vue'
import { defineStore } from 'pinia'
import { toast } from 'vue-sonner'
import { call, code, message, desktop } from '@/services/api'
import { documentTags } from '@/services/frontmatter'
import { defaults, type Bootstrap, type DiskDocument, type Document, type Draft, type Entry, type Preferences, type View, type Workspace } from '@/types'

export const treeKey = (workspace: string, path: string) => `${workspace}|${path}`
export const useWorkbench = defineStore('workbench', () => {
  const workspaces = ref<Workspace[]>([]), documents = ref<Document[]>([]), activeId = ref(''), tree = ref<Record<string, Entry[]>>({}), expanded = ref<Record<string, boolean>>({}), preferences = ref<Preferences>(JSON.parse(JSON.stringify(defaults))), drafts = ref<Draft[]>([]), ready = ref(false)
  const active = computed(() => documents.value.find(d => d.id === activeId.value))
  const timers = new Map<string, ReturnType<typeof setTimeout>>(), maxTimers = new Map<string, ReturnType<typeof setTimeout>>(), recoveryTimers = new Map<string, ReturnType<typeof setTimeout>>()
  const operationGroups=new Map<string,string>()
  const histories = new Map<string, HistoryState>(), closedTabs = ref<{workspaceId:string;path:string;view:View}[]>([]), navigation = ref<{workspaceId:string;path:string;position:number}[]>([]), navigationIndex = ref(-1)
  let travelling = false
  const flights = new Map<string, Promise<boolean>>()
  let prefTimer: ReturnType<typeof setTimeout> | undefined, prefFlight = Promise.resolve()
  function persist() {
    if (!ready.value) return
    clearTimeout(prefTimer); prefTimer = setTimeout(() => {
      const snapshot = JSON.parse(JSON.stringify({ ...preferences.value, tabs: documents.value.filter(d=>!d.temporary).map(d => ({ workspaceId: d.workspaceId, path: d.path, view: d.view, pinned:d.pinned, absolutePath:d.workspaceId.startsWith('file-')?workspaces.value.find(w=>w.id===d.workspaceId)?.path+'/'+d.path:undefined })), activePath: active.value ? `${active.value.workspaceId}|${active.value.path}` : '' }))
      prefFlight = prefFlight.catch(() => {}).then(() => call('save_preferences', { preferences: snapshot })).then(() => {}).catch(e => { toast.error(`设置保存失败：${message(e)}`) })
    }, 200)
  }
  async function persistNow() { clearTimeout(prefTimer); await prefFlight; await call('save_preferences', { preferences: JSON.parse(JSON.stringify({ ...preferences.value, tabs: documents.value.filter(d=>!d.temporary).map(d => ({ workspaceId: d.workspaceId, path: d.path, view: d.view, pinned:d.pinned, absolutePath:d.workspaceId.startsWith('file-')?workspaces.value.find(w=>w.id===d.workspaceId)?.path+'/'+d.path:undefined })), activePath: active.value ? `${active.value.workspaceId}|${active.value.path}` : '' })) }) }
  watch(preferences, persist, { deep: true })
  watch(expanded,()=>{preferences.value.treeExpanded={...expanded.value}},{deep:true})
  watch(()=>preferences.value.autoSave,enabled=>{if(!enabled)for(const d of documents.value)cancelTimers(d);else for(const d of documents.value)if(d.revision>d.savedRevision)void save(d)})
  async function loadDirectory(workspaceId: string, path = '') { try { tree.value[treeKey(workspaceId, path)] = await call<Entry[]>('list_directory', { workspaceId, path }); if (!path) { const w = workspaces.value.find(w => w.id === workspaceId); if (w) w.available = true } } catch(e) { tree.value[treeKey(workspaceId, path)] = []; if (!path) { const w = workspaces.value.find(w => w.id === workspaceId); if (w) w.available = false }; throw e } }
  async function toggleDirectory(workspaceId: string, path = '') { const key = treeKey(workspaceId, path); expanded.value[key] = !expanded.value[key]; if (expanded.value[key]) await loadDirectory(workspaceId, path) }
  const opening = new Map<string,Promise<Document>>()
  async function open(workspaceId:string,path:string,view?:View){const key=treeKey(workspaceId,path);let flight=opening.get(key);if(!flight){flight=openOnce(workspaceId,path,view);opening.set(key,flight)}try{return await flight}finally{if(opening.get(key)===flight)opening.delete(key)}}
  async function openOnce(workspaceId: string, path: string, view?: View) {
    const existing = documents.value.find(d => d.workspaceId === workspaceId && d.path === path)
    if (existing) { activate(existing.id); return existing }
    const disk = await call<DiskDocument>('open_document', { workspaceId, path })
    const d: Document = { ...disk, revision: 0, savedRevision: 0, status: 'clean', error: '', view: view || preferences.value.defaultView, generation: 0 }
    documents.value.push(d); for (const tag of documentTags(d.text)) if (tag.length<=40 && !preferences.value.tags.includes(tag) && preferences.value.tags.length<100) preferences.value.tags.push(tag); activate(d.id); remember(d); persist(); return documents.value.find(x=>x.id===d.id)!
  }
  function remember(d:Document) { if(d.temporary)return; const previous=preferences.value.recentFiles.find(f=>f.workspaceId===d.workspaceId&&f.path===d.path); preferences.value.recentFiles=[{workspaceId:d.workspaceId,path:d.path,openedAt:Date.now(),editedAt:previous?.editedAt,absolutePath:d.workspaceId.startsWith('file-')?workspaces.value.find(w=>w.id===d.workspaceId)?.path+'/'+d.path:undefined},...preferences.value.recentFiles.filter(f=>f.workspaceId!==d.workspaceId||f.path!==d.path)].slice(0,100) }
  function favorite(d:Pick<Document,'workspaceId'|'path'>) { if(!d.workspaceId)return; const i=preferences.value.favorites.findIndex(f=>f.workspaceId===d.workspaceId&&f.path===d.path);if(i>=0)preferences.value.favorites.splice(i,1);else preferences.value.favorites.push({workspaceId:d.workspaceId,path:d.path,openedAt:Date.now(),absolutePath:d.workspaceId.startsWith('file-')?workspaces.value.find(w=>w.id===d.workspaceId)?.path+'/'+d.path:undefined});toast.success(i>=0?'已取消收藏':'已收藏文档') }
  function pin(d:Document) { d.pinned=!d.pinned;persist();toast.success(d.pinned?'标签已固定':'标签已取消固定') }
  function reorder(id:string,before:string) { const from=documents.value.findIndex(d=>d.id===id),to=documents.value.findIndex(d=>d.id===before);if(from<0||to<0||from===to)return;const [d]=documents.value.splice(from,1);documents.value.splice(to,0,d!);persist() }
  async function reopen() { const tab=closedTabs.value.pop();if(tab)await open(tab.workspaceId,tab.path,tab.view) }
  async function reveal(d=active.value) { if(!d)return;const paths=['',...d.path.split('/').slice(0,-1).map((_,i)=>d.path.split('/').slice(0,i+1).join('/'))];for(const path of paths){expanded.value[treeKey(d.workspaceId,path)]=true;await loadDirectory(d.workspaceId,path)} }
  async function navigate(delta:number) { const i=navigationIndex.value+delta;if(i<0||i>=navigation.value.length)return;navigationIndex.value=i;travelling=true;try{const item=navigation.value[i]!;await open(item.workspaceId,item.path);return item.position}finally{travelling=false} }
  function checkpoint(position:number) { const item=navigation.value[navigationIndex.value];if(item)item.position=position }
  function activate(id: string) { const previous = active.value; if (previous && previous.id !== id && preferences.value.saveOnBlur) void save(previous); activeId.value = id; const d=active.value;if(d&&!d.temporary){remember(d);if(!travelling && (!previous||previous.id!==id)){navigation.value.splice(navigationIndex.value+1);navigation.value.push({workspaceId:d.workspaceId,path:d.path,position:0});navigationIndex.value=navigation.value.length-1}if(preferences.value.autoReveal)void reveal(d).catch(()=>{})};persist() }
  function cancelTimers(d: Document) { clearTimeout(timers.get(d.id)); clearTimeout(maxTimers.get(d.id)); timers.delete(d.id); maxTimers.delete(d.id) }
  function beginOperation(d:Document,group:string){operationGroups.set(d.id,group)}
  function change(d: Document, text: string, group = 'typing', capture = true) {
    if (text === d.text) return
    group=operationGroups.get(d.id)||group;operationGroups.delete(d.id);if (capture) { const h=histories.get(d.id)||{past:[],future:[],updated:0,group:''};record(h,d.text,group);histories.set(d.id,h) };d.text = text; d.revision++; if (!['conflict', 'missing'].includes(d.status)) d.status = 'dirty'
    if(d.temporary)return
    if (preferences.value.autoSave) { clearTimeout(timers.get(d.id)); timers.set(d.id, setTimeout(() => void save(d), Math.max(200,Math.min(30000,preferences.value.autoSaveDelay))))
    if (!maxTimers.has(d.id)) maxTimers.set(d.id, setTimeout(() => void save(d), Math.max(2000,preferences.value.autoSaveDelay*4))) }
    clearTimeout(recoveryTimers.get(d.id)); recoveryTimers.set(d.id, setTimeout(() => void recovery(d), 200))
  }
  function undo(d:Document,redo=false) { const h=histories.get(d.id);if(!h)return;const text=travel(h,d.text,redo);if(text!==undefined){change(d,text,'history',false);d.generation++} }
  function canUndo(d:Document,redo=false) { void d.revision; const h=histories.get(d.id);return !!(redo?h?.future.length:h?.past.length) }
  async function recovery(d: Document) { if(d.temporary)return true; if (d.revision <= d.savedRevision) return true; try { await call('write_recovery', { documentId: d.id, text: d.text, hash: d.hash }); return true } catch(e) { toast.error(`草稿保护失败：${message(e)}`); return false } }
  async function suspend(){for(const d of documents.value){cancelTimers(d);clearTimeout(recoveryTimers.get(d.id))}await Promise.all(flights.values())}
  async function protectDrafts() { return (await Promise.all(documents.value.map(d => { clearTimeout(recoveryTimers.get(d.id)); return recovery(d) }))).every(Boolean) }
  async function save(d: Document): Promise<boolean> {
    cancelTimers(d)
    if(d.temporary)return false
    if (flights.has(d.id)) return flights.get(d.id)!
    if (d.revision <= d.savedRevision) return true
    if (['conflict', 'missing'].includes(d.status)) return false
    const flight = (async () => {
      while (d.revision > d.savedRevision) {
        const revision = d.revision, text = d.text, expectedHash = d.hash; d.status = 'saving'
        try {
          const result = await call<{ hash: string; revision: number }>('save_document', { documentId: d.id, text, expectedHash, revision, backup: false })
          d.hash = result.hash; d.savedRevision = Math.max(d.savedRevision, result.revision); d.error = ''; d.status = d.revision > d.savedRevision ? 'dirty' : 'clean'
        } catch(e) { d.status = code(e) === 'CONFLICT' ? 'conflict' : code(e) === 'MISSING' ? 'missing' : 'error'; d.error = message(e); await recovery(d); return false }
      }
      const recent=preferences.value.recentFiles.find(f=>f.workspaceId===d.workspaceId&&f.path===d.path);if(recent)recent.editedAt=Date.now();const h=histories.get(d.id);if(h){h.group='';h.updated=0}
      return true
    })()
    flights.set(d.id, flight); try { return await flight } finally { flights.delete(d.id) }
  }
  async function flush(workspaceId?: string) { const results = await Promise.all(documents.value.filter(d => !d.temporary && (!workspaceId || d.workspaceId === workspaceId)).map(save)); return results.every(Boolean) }
  async function close(id: string, discard = false) {
    const d = documents.value.find(d => d.id === id); if (!d) return true
    if(d.temporary){if(!discard)return false;const index=documents.value.findIndex(x=>x.id===id);documents.value.splice(index,1);histories.delete(id);if(activeId.value===id)activeId.value=documents.value[Math.min(index,documents.value.length-1)]?.id||'';persist();return true}
    if (!discard && !await save(d)) return false
    cancelTimers(d); clearTimeout(recoveryTimers.get(id)); if (discard) await call('discard_recovery', { draftId: await draftHash(d) }); await call('close_document', { documentId: id })
    closedTabs.value.push({workspaceId:d.workspaceId,path:d.path,view:d.view});if(closedTabs.value.length>20)closedTabs.value.shift();histories.delete(id);
    const index = documents.value.findIndex(d => d.id === id); documents.value.splice(index, 1); if (activeId.value === id) activeId.value = documents.value[Math.min(index, documents.value.length - 1)]?.id || ''; persist(); return true
  }
  async function draftHash(d: { workspaceId: string; path: string }) { const bytes = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(`${d.workspaceId}\0${d.path}`)); return [...new Uint8Array(bytes)].map(b => b.toString(16).padStart(2, '0')).join('') }
  function setView(view: View) { if (active.value) { active.value.view = view; persist() } }
  async function reload(d: Document) { const disk = await call<DiskDocument>('open_document', { workspaceId: d.workspaceId, path: d.path }); Object.assign(d, disk, { revision: 0, savedRevision: 0, status: 'clean', error: '', generation: d.generation + 1 }); histories.delete(d.id);await call('discard_recovery', { draftId: await draftHash(d) }) }
  async function overwrite(d: Document, expectedHash: string) { const revision = d.revision; const result = await call<{ hash: string }>('save_document', { documentId: d.id, text: d.text, expectedHash, revision, backup: true }); d.hash = result.hash; d.savedRevision = revision; d.status = d.revision === revision ? 'clean' : 'dirty'; d.error = '' }
  async function saveAs(d: Document) { if(d.temporary){const revision=d.revision;const path=await call<string|null>('save_temporary_document',{name:d.path,text:d.text});if(!path)return false;await openLocal([path]);if(d.revision===revision)await close(d.id,true);return true;} const saved=await call<boolean>('save_document_as', { documentId: d.id, text: d.text });if(saved)toast.success('副本已保存');return saved }
  async function restore(draft: Draft) {
    let d: Document
    try { d = await open(draft.workspaceId, draft.path, 'source') }
    catch {
      const disk = await call<DiskDocument>('open_recovery', { draftId: draft.id })
      d = { ...disk, revision: 1, savedRevision: 0, status: 'missing', error: '原文件或工作区无法访问，草稿已找回。请另存副本以保留内容。', view: 'source', generation: 0 }
      documents.value.push(d); for (const tag of documentTags(d.text)) if (tag.length<=40 && !preferences.value.tags.includes(tag) && preferences.value.tags.length<100) preferences.value.tags.push(tag); activeId.value = d.id; persist()
    }
    change(d, draft.text)
    if (d.status !== 'missing' && d.hash !== draft.hash) { d.status = 'conflict'; d.error = '恢复草稿的基准与当前磁盘不同，请选择如何保留两个版本。' }
    drafts.value = drafts.value.filter(x => x.id !== draft.id)
  }
  async function discardDraft(draft: Draft) { await call('discard_recovery', { draftId: draft.id }); drafts.value = drafts.value.filter(x => x.id !== draft.id) }
  async function refresh(workspaceId?: string) {
    let failures = 0
    const ids = workspaceId ? [workspaceId] : workspaces.value.map(w => w.id)
    for (const id of ids) for (const key of Object.keys(expanded.value).filter(k => k.startsWith(`${id}|`) && expanded.value[k])) { try { await loadDirectory(id, key.slice(id.length + 1)) } catch { failures++ } }
    for (const d of documents.value.filter(d => ids.includes(d.workspaceId))) {
      if (flights.has(d.id)) continue
      try { const diskHash = await call<string>('check_document', { documentId: d.id }); if (diskHash !== d.hash) { if (d.revision > d.savedRevision) { d.status = 'conflict'; d.error = '文件已被其他程序修改，自动保存已暂停。' } else await reload(d) } }
      catch(e) { d.status = code(e) === 'MISSING' ? 'missing' : 'error'; d.error = message(e) }
    }
    return failures
  }
  async function addWorkspace() { const ws = await call<Workspace | null>('select_workspace'); if (!ws) return null; const added = !workspaces.value.some(w => w.id === ws.id); if (added) workspaces.value.push(ws); expanded.value[treeKey(ws.id, '')] = true; await loadDirectory(ws.id); return { workspace: ws, added } }
  async function removeWorkspace(id: string) { if (!await flush(id)) throw new Error('工作区有未保存的文档，请先处理保存状态。'); for (const d of [...documents.value].filter(d => d.workspaceId === id)) await close(d.id); await call('remove_workspace', { workspaceId: id }); workspaces.value = workspaces.value.filter(w => w.id !== id); if(preferences.value.activeWorkspace===id)preferences.value.activeWorkspace='';persist() }
  async function create(workspaceId: string, parent: string, name: string, isDir: boolean) { if (!isDir && !name.toLowerCase().endsWith('.md')) name += '.md'; const path = await call<string>('create_entry', { workspaceId, parent, name, isDir }); expanded.value[treeKey(workspaceId, parent)] = true; await loadDirectory(workspaceId, parent); if (!isDir) await open(workspaceId, path) }
  async function relocate(workspaceId: string, path: string, destination: string, name?: string, targetWorkspaceId = workspaceId) {
    if (!await flush(workspaceId) || targetWorkspaceId !== workspaceId && !await flush(targetWorkspaceId)) throw new Error('有未保存内容，请先解决保存问题。')
    const result = await call<{ documents: DiskDocument[]; oldPath:string; newPath:string }>(targetWorkspaceId === workspaceId ? 'relocate_entry' : 'relocate_entry_between_workspaces', { workspaceId, targetWorkspaceId, path, destination, name: name || null })
    const moved=(p:string)=>p===result.oldPath||p.startsWith(result.oldPath+'/')
    for(const items of [preferences.value.recentFiles,preferences.value.favorites,navigation.value,closedTabs.value])for(const item of items)if(item.workspaceId===workspaceId&&moved(item.path)){item.path=result.newPath+item.path.slice(result.oldPath.length);item.workspaceId=targetWorkspaceId;const workspace=workspaces.value.find(w=>w.id===targetWorkspaceId);if('absolutePath' in item&&item.absolutePath&&workspace)item.absolutePath=workspace.path+'/'+item.path}
    for(const key of Object.keys(expanded.value)){const prefix=workspaceId+'|';if(key.startsWith(prefix)&&moved(key.slice(prefix.length))){const next=targetWorkspaceId+'|'+result.newPath+key.slice(prefix.length+result.oldPath.length);expanded.value[next]=expanded.value[key]!;delete expanded.value[key]}}
    for (const disk of result.documents) { const d = documents.value.find(d => d.id === disk.id); if (d) Object.assign(d, disk, { generation: d.generation + 1 }) }
    await refresh(workspaceId);if(targetWorkspaceId!==workspaceId){expanded.value[treeKey(targetWorkspaceId,destination)]=true;await refresh(targetWorkspaceId);await loadDirectory(targetWorkspaceId,destination)}invalidateKnowledge(); persist()
  }
  async function archive(workspaceId: string, path: string) { if (!await flush(workspaceId)) throw new Error('请先处理未保存内容。'); await call('archive_document',{workspaceId,path}); for (const d of [...documents.value].filter(d => d.workspaceId===workspaceId && d.path===path)) await close(d.id,true); await refresh(workspaceId) }
  async function trash(workspaceId: string, path: string) {
    if (!await flush(workspaceId)) throw new Error('有未保存内容，请先解决保存问题。')
    await call('trash_entry', { workspaceId, path }); for (const d of [...documents.value].filter(d => d.workspaceId === workspaceId && (d.path === path || d.path.startsWith(`${path}/`)))) { cancelTimers(d); clearTimeout(recoveryTimers.get(d.id)); documents.value = documents.value.filter(x => x.id !== d.id) }; if (!active.value) activeId.value = documents.value.at(-1)?.id || ''; await refresh(workspaceId);invalidateKnowledge(); persist()
  }
  async function initialize() {
    const data = await call<Bootstrap>('bootstrap'); workspaces.value = data.workspaces; drafts.value = data.drafts
    for (const key of Object.keys(defaults) as (keyof Preferences)[]) { const value = data.preferences[key]; if (typeof value === typeof defaults[key]) (preferences.value as any)[key] = value }
    preferences.value.tags = Array.isArray(preferences.value.tags) ? [...new Set(preferences.value.tags.filter(tag => typeof tag === 'string' && tag.trim() && tag.length<=40))].slice(0,100) : []
    preferences.value.lineHeight = Number.isFinite(preferences.value.lineHeight) ? Math.max(1.2,Math.min(3,preferences.value.lineHeight)) : 1.9
    if (!['light','dark','system'].includes(preferences.value.mode)) preferences.value.mode = defaults.mode
    preferences.value.uiSize = Number.isFinite(preferences.value.uiSize) ? Math.min(20, Math.max(12, preferences.value.uiSize)) : defaults.uiSize
    preferences.value.collapsedSidebarWidth = Number.isFinite(preferences.value.collapsedSidebarWidth) ? Math.min(120, Math.max(40, preferences.value.collapsedSidebarWidth)) : defaults.collapsedSidebarWidth
    if(!['solid','soft','glass'].includes(preferences.value.material))preferences.value.material=defaults.material
    preferences.value.cornerRadius=Number.isFinite(preferences.value.cornerRadius)?Math.max(0,Math.min(20,preferences.value.cornerRadius)):defaults.cornerRadius
    preferences.value.glassBlur=Number.isFinite(preferences.value.glassBlur)?Math.max(8,Math.min(28,preferences.value.glassBlur)):defaults.glassBlur
    if (!/^#[\da-f]{6}$/i.test(preferences.value.accent)) preferences.value.accent = defaults.accent
    for (const key of ['bodySize','codeSize'] as const) preferences.value[key] = Math.min(36, Math.max(10, preferences.value[key]))
    if (!['live','source','split','preview'].includes(preferences.value.defaultView)) preferences.value.defaultView = defaults.defaultView
    if (!['standard','wide'].includes(preferences.value.documentStyle)) preferences.value.documentStyle = defaults.documentStyle
    for (const ws of workspaces.value) { expanded.value[treeKey(ws.id, '')] = true; try { await loadDirectory(ws.id) } catch {} }
    for (const tab of data.preferences.tabs || []) { try { if(tab.absolutePath)await openLocal([tab.absolutePath]);else await open(tab.workspaceId, tab.path, tab.view);if(active.value)active.value.pinned=tab.pinned } catch {} }
    if (data.preferences.activePath) { const d = documents.value.find(d => `${d.workspaceId}|${d.path}` === data.preferences.activePath); if (d) activeId.value = d.id }
    if (!desktop && !documents.value.length) await open('demo', '欢迎.md')
    if (data.pendingOperations) toast.error('检测到未完成的文件操作，请检查应用数据目录 operations 中的恢复材料。', { duration: Infinity })
    if (desktop) {
      try {
        const valid = await call<Pick<Preferences, 'recentFiles' | 'favorites'>>('valid_file_references')
        preferences.value.recentFiles = valid.recentFiles
        preferences.value.favorites = valid.favorites
      } catch (e) { toast.error(`文档记录检查失败：${message(e)}`) }
    }
    expanded.value={...expanded.value,...preferences.value.treeExpanded};ready.value = true
    persist()
  }
  async function openLocal(paths?:string[]) { const result=await call<{workspaces:Workspace[];documents:DiskDocument[]}>('open_local_paths',{paths:paths||null});for(const ws of result.workspaces)if(!workspaces.value.some(w=>w.id===ws.id))workspaces.value.push(ws);for(const disk of result.documents){const existing=documents.value.find(d=>d.id===disk.id);if(!existing)documents.value.push({...disk,revision:0,savedRevision:0,status:'clean',error:'',view:preferences.value.defaultView,generation:0});activate(disk.id)}for(const ws of result.workspaces)await loadDirectory(ws.id);persist() }
  function createTemporary(){let count=1;while(documents.value.some(d=>d.path===(count===1?'未命名.md':`未命名 ${count}.md`)))count++;const d:Document={id:crypto.randomUUID(),workspaceId:'',path:count===1?'未命名.md':`未命名 ${count}.md`,text:'',hash:'',bom:false,crlf:false,revision:1,savedRevision:0,status:'dirty',error:'',view:'live',generation:0,temporary:true};documents.value.push(d);activate(d.id);return d}
  return { createTemporary,suspend,beginOperation,undo,canUndo,favorite,pin,reorder,reopen,reveal,navigate,checkpoint,closedTabs,navigation,navigationIndex,openLocal,workspaces, documents, activeId, active, tree, expanded, preferences, drafts, ready, initialize, loadDirectory, toggleDirectory, open, activate, change, save, flush, close, setView, reload, overwrite, saveAs, restore, discardDraft, refresh, addWorkspace, removeWorkspace, create, relocate, archive, trash, persist, persistNow, protectDrafts }
})
