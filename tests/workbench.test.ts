import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { useWorkbench } from '@/stores/workbench'

const mocks = vi.hoisted(() => ({ call: vi.fn(), toast: vi.fn() }))
vi.mock('@/services/api', () => ({ call: mocks.call, desktop: true, code: (e: {code?: string}) => e.code || 'ERROR', message: (e: {message?: string}) => e.message || 'error' }))
vi.mock('vue-sonner', () => ({ toast: { error: mocks.toast, success: mocks.toast } }))
function seed(id = 'a') {
  const store = useWorkbench()
  store.documents.push({ id, workspaceId:'workspace', path:`${id}.md`, text:'original', hash:'original-hash', bom:false, crlf:false, revision:0, savedRevision:0, status:'clean', error:'', view:'source', generation:0 })
  store.activeId = id
  return store.documents.find(d => d.id === id)!
}
function deferred<T>() { let resolve!: (value:T) => void; const promise = new Promise<T>(r => { resolve = r }); return { promise, resolve } }
beforeEach(() => { setActivePinia(createPinia()); vi.useFakeTimers(); mocks.call.mockReset(); mocks.toast.mockReset(); mocks.call.mockImplementation(async (command: string, args: any) => command === 'save_document' ? {hash:`hash-${args.revision}`,revision:args.revision} : undefined) })
afterEach(() => { vi.clearAllTimers(); vi.useRealTimers() })

describe('document save coordination', () => {
  it('cleans invalid references at startup and persists the valid records', async () => {
    const store = useWorkbench()
    const valid = { workspaceId: 'workspace', path: 'kept.md', openedAt: 1 }
    const stale = { workspaceId: 'removed', path: 'stale.md', openedAt: 2 }
    mocks.call.mockImplementation(async (command: string) => {
      if (command === 'bootstrap') return { workspaces: [], drafts: [], preferences: { recentFiles: [stale, valid], favorites: [stale] }, pendingOperations: 0 }
      if (command === 'valid_file_references') return { recentFiles: [valid], favorites: [] }
    })
    await store.initialize()
    expect(store.preferences.recentFiles).toEqual([valid])
    expect(store.preferences.favorites).toEqual([])
    await vi.advanceTimersByTimeAsync(250)
    expect(mocks.call).toHaveBeenCalledWith('save_preferences', expect.objectContaining({ preferences: expect.objectContaining({ recentFiles: [valid], favorites: [] }) }))
  })
  it('announces adding and removing a favorite through the shared action', () => {
    const store = useWorkbench(), doc = seed()
    store.favorite(doc)
    expect(store.preferences.favorites).toHaveLength(1)
    expect(mocks.toast).toHaveBeenLastCalledWith('已收藏文档')
    store.favorite(doc)
    expect(store.preferences.favorites).toHaveLength(0)
    expect(mocks.toast).toHaveBeenLastCalledWith('已取消收藏')
  })
  it('keeps opened documents and activates an existing tab without reopening it', async () => {
    const store = useWorkbench()
    store.preferences.autoReveal = false
    mocks.call.mockImplementation(async (command: string, args: { path: string }) => command === 'open_document'
      ? { id: args.path, workspaceId: 'workspace', path: args.path, text: '# note', hash: 'hash', bom: false, crlf: false }
      : undefined)
    await store.open('workspace', 'one.md')
    await store.open('workspace', 'two.md', 'preview')
    expect(store.documents.map(d => d.path)).toEqual(['one.md', 'two.md'])
    expect(store.active?.view).toBe('preview')
    await store.open('workspace', 'one.md')
    expect(store.active?.path).toBe('one.md')
    expect(store.documents).toHaveLength(2)
    expect(mocks.call.mock.calls.filter(([command]) => command === 'open_document')).toHaveLength(2)
    expect(mocks.call.mock.calls.some(([command]) => command === 'close_document')).toBe(false)
  })
  it('does not rewrite a document just because it was opened or viewed', async () => {
    const store = useWorkbench(), doc = seed(); store.setView('preview'); store.setView('live'); store.setView('source'); await store.save(doc)
    expect(mocks.call).not.toHaveBeenCalledWith('save_document', expect.anything()); expect(doc.revision).toBe(0)
  })
  it('acknowledges only the saved snapshot and then saves newer input in order', async () => {
    const store = useWorkbench(), doc = seed(), first = deferred<{hash:string;revision:number}>(), second = deferred<{hash:string;revision:number}>()
    let count = 0; mocks.call.mockImplementation((command:string) => command === 'save_document' ? (++count === 1 ? first.promise : second.promise) : Promise.resolve())
    store.change(doc, 'revision one'); const saving = store.save(doc); store.change(doc, 'revision two')
    first.resolve({hash:'hash-one',revision:1}); await Promise.resolve(); await Promise.resolve()
    expect(doc.savedRevision).toBe(1); expect(doc.revision).toBe(2); expect(doc.status).not.toBe('clean')
    expect(mocks.call).toHaveBeenLastCalledWith('save_document', expect.objectContaining({text:'revision two', expectedHash:'hash-one', revision:2}))
    second.resolve({hash:'hash-two',revision:2}); expect(await saving).toBe(true); expect(doc.status).toBe('clean'); expect(doc.text).toBe('revision two')
  })
  it('never redirects an in-flight save to the newly active tab', async () => {
    const store = useWorkbench(), a = seed('a'), b = seed('b'); store.activeId = a.id; store.change(a, 'A changed'); await store.save(a)
    expect(mocks.call).toHaveBeenCalledWith('save_document', expect.objectContaining({documentId:'a',text:'A changed'})); expect(b.text).toBe('original'); expect(b.revision).toBe(0)
  })
  it('pauses subsequent automatic writes after an external conflict', async () => {
    const store = useWorkbench(), doc = seed(); mocks.call.mockImplementation(async (command:string) => { if (command === 'save_document') throw {code:'CONFLICT',message:'external edit'} })
    store.change(doc, 'local'); expect(await store.save(doc)).toBe(false); store.change(doc, 'local newer'); await vi.advanceTimersByTimeAsync(2200)
    expect(mocks.call.mock.calls.filter(([command]) => command === 'save_document')).toHaveLength(1); expect(doc.status).toBe('conflict'); expect(doc.text).toBe('local newer')
  })
  it('retains the buffer and refuses normal close when saving fails', async () => {
    const store = useWorkbench(), doc = seed(); mocks.call.mockImplementation(async (command:string) => { if (command === 'save_document') throw {code:'PERMISSION',message:'read only'} })
    store.change(doc, 'valuable draft'); expect(await store.close(doc.id)).toBe(false); expect(store.documents).toHaveLength(1); expect(doc.text).toBe('valuable draft'); expect(doc.status).toBe('error')
    expect(mocks.call).toHaveBeenCalledWith('write_recovery', expect.objectContaining({text:'valuable draft'}))
  })
  it('does not recreate an externally deleted document', async () => {
    const store = useWorkbench(), doc = seed(); mocks.call.mockImplementation(async (command:string) => { if (command === 'save_document') throw {code:'MISSING',message:'deleted'} })
    store.change(doc, 'draft'); await store.save(doc); store.change(doc, 'newer draft'); await store.save(doc)
    expect(doc.status).toBe('missing'); expect(mocks.call.mock.calls.filter(([command]) => command === 'save_document')).toHaveLength(1)
  })
  it('keeps the version approved by the confirmation instead of accepting a newer disk version', async () => {
    const store = useWorkbench(), doc = seed(); doc.status = 'conflict'; doc.revision = 1
    mocks.call.mockImplementation(async (command:string, args:any) => { if (command === 'save_document') { expect(args.expectedHash).toBe('confirmed-version'); throw {code:'CONFLICT',message:'changed again'} } })
    await expect(store.overwrite(doc, 'confirmed-version')).rejects.toMatchObject({code:'CONFLICT'})
    expect(doc.status).toBe('conflict'); expect(doc.savedRevision).toBe(0)
  })
  it('opens a recovery buffer even when the original file no longer exists', async () => {
    const store = useWorkbench(), draft = {id:'draft',workspaceId:'workspace',path:'deleted.md',text:'recovered text',hash:'old',updatedAt:1}
    store.drafts.push(draft)
    mocks.call.mockImplementation(async (command:string) => { if (command === 'open_document') throw {code:'MISSING'}; if (command === 'open_recovery') return {id:'recovered',workspaceId:'workspace',path:'deleted.md',text:draft.text,hash:'old',bom:false,crlf:false} })
    await store.restore(draft); expect(store.active?.text).toBe('recovered text'); expect(store.active?.status).toBe('missing'); expect(await store.save(store.active!)).toBe(false)
    expect(mocks.call.mock.calls.some(([command]) => command === 'save_document')).toBe(false)
  })
  it('requires all latest recovery snapshots to be persisted before a failed-save exit', async () => {
    const store = useWorkbench(), doc = seed(); store.change(doc, 'last keystroke'); doc.status = 'conflict'
    expect(await store.protectDrafts()).toBe(true)
    expect(mocks.call).toHaveBeenCalledWith('write_recovery', expect.objectContaining({text:'last keystroke'}))
    mocks.call.mockRejectedValue({code:'IO',message:'disk full'}); expect(await store.protectDrafts()).toBe(false)
  })
  it('submits a snapshot during continuous typing instead of waiting forever', async () => {
    const store = useWorkbench(), doc = seed();
    for (let i=0; i<7; i++) { store.change(doc, `typing-${i}`); await vi.advanceTimersByTimeAsync(300) }
    expect(mocks.call.mock.calls.filter(([command]) => command === 'save_document')).toHaveLength(1); expect(doc.savedRevision).toBe(7)
  })
})


describe('temporary documents',()=>{
 it('keeps edits in memory without save or recovery writes',async()=>{
  const store=useWorkbench();store.createTemporary();const doc=store.active!;
  store.change(doc,'# 临时内容');await vi.advanceTimersByTimeAsync(5000);
  expect(doc.temporary).toBe(true);expect(store.preferences.recentFiles).toHaveLength(0);
  expect(await store.flush()).toBe(true);expect(await store.protectDrafts()).toBe(true);
  expect(mocks.call).not.toHaveBeenCalled();
  expect(await store.close(doc.id)).toBe(false);expect(store.documents).toHaveLength(1);
  expect(await store.close(doc.id,true)).toBe(true);expect(store.documents).toHaveLength(0);
  expect(store.closedTabs).toHaveLength(0);expect(mocks.call).not.toHaveBeenCalled();
 });
 it('keeps the document when the save picker is cancelled',async()=>{
  const store=useWorkbench();store.createTemporary();const doc=store.active!;
  mocks.call.mockResolvedValue(null);expect(await store.saveAs(doc)).toBe(false);
  expect(store.active?.id).toBe(doc.id);expect(doc.temporary).toBe(true);
 });
 it('opens the saved file as a regular document',async()=>{
  const store=useWorkbench();store.createTemporary();const doc=store.active!;store.change(doc,'saved text');
  mocks.call.mockImplementation(async(command:string)=>command==='save_temporary_document'?'C:/notes/note.md':command==='open_local_paths'?{workspaces:[{id:'workspace',name:'notes',path:'C:/notes',available:true}],documents:[{id:'saved',workspaceId:'workspace',path:'note.md',text:'saved text',hash:'hash',bom:false,crlf:false}]}:[]);
  expect(await store.saveAs(doc)).toBe(true);expect(store.documents).toHaveLength(1);
  expect(store.active?.id).toBe('saved');expect(store.active?.temporary).toBeFalsy();
 });
});
