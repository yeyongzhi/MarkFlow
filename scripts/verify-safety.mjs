import { chromium, expect } from '@playwright/test'
import { mkdir, writeFile, readFile, readdir, stat } from 'node:fs/promises'
import { resolve } from 'node:path'
import { spawn } from 'node:child_process'
import assert from 'node:assert/strict'

const run = resolve(`artifacts/safety-${Date.now()}`), root = resolve(run, 'workspace'), data = resolve(run, 'app-data')
await mkdir(root, { recursive: true }); await mkdir(data, { recursive: true })
await writeFile(resolve(root, '写作手记.md'), '# 让想法，慢慢长出来\n\n在这里，留一处安静的空间。把今天的灵感，写成明天值得回看的文字。\n\n## 从一份笔记开始\n\n**专注于内容**，让工具退到恰好的位置。\n\n> 好的写作体验，是每一次打开都感到自在。\n\n## 今天想做的事\n\n- [x] 整理本周的写作灵感\n- [ ] 记录一个值得保留的想法\n- [ ] 写下一份新的产品笔记\n\n## 熟悉的表达方式\n\n| 功能 | 适合的场景 |\n| --- | --- |\n| 可视化编辑 | 专注写作 |\n| 分屏编辑 | 查看语法与效果 |\n| 阅读预览 | 安静地阅读 |\n')
await writeFile(resolve(root, '灵感清单.md'), '# 灵感清单\n\n从小想法开始。\n')
await writeFile(resolve(data, 'workspaces.json'), JSON.stringify([{ id: 'design', name: '我的写作空间', path: root, available: true }]))
await writeFile(resolve(data, 'preferences.json'), JSON.stringify({ defaultView: 'source', mode: 'light', autoSave: false }))
const child = spawn(resolve('src-tauri/target/debug/markflow.exe'), [], { windowsHide: true, env: { ...process.env, MARKFLOW_DEV_DATA_DIR: data, WEBVIEW2_USER_DATA_FOLDER: resolve(data, 'webview'), MARKFLOW_DEV_HEADLESS: '1', WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS: '--remote-debugging-port=9238' }, stdio: ['ignore','pipe','pipe'] })
let browser, page, logs = ''
child.stderr.on('data', b => { logs += b }); child.stdout.on('data', b => { logs += b })
try {
  for (let i = 0; i < 150; i++) { try { if ((await fetch('http://127.0.0.1:9238/json/version')).ok) break } catch {} if (child.exitCode !== null) throw new Error(logs); await new Promise(r => setTimeout(r, 100)) }
  browser = await chromium.connectOverCDP('http://127.0.0.1:9238'); page = browser.contexts()[0].pages()[0]; page.setDefaultTimeout(15000)

  const errors=[];page.on('pageerror',e=>errors.push(e.message))
  const api=(command,args={})=>page.evaluate(async({command,args})=>(await import('/src/services/api.ts')).call(command,args),{command,args})
  await page.waitForURL('http://127.0.0.1:1420/');await page.getByRole('button',{name:'写作手记.md',exact:true}).waitFor()
  const doc=await api('open_document',{workspaceId:'design',path:'写作手记.md'})
  await api('snapshot_document',{documentId:doc.id,text:'original',reason:'test'})
  await api('snapshot_document',{documentId:doc.id,text:'edited',reason:'test'})
  const versions=await api('list_versions',{documentId:doc.id});assert.equal(versions.length,2);assert.equal((await api('read_version',{documentId:doc.id,id:versions[1].id})).text,'original')
  const converted=await api('convert_document_format',{documentId:doc.id,expectedHash:doc.hash,encoding:'UTF-16LE',bom:true,crlf:true})
  const formatBackup=(await api('list_operation_backups')).find(x=>x.kind==='format');assert(formatBackup)
  await api('restore_operation_backup',{id:formatBackup.id});assert.deepEqual(await readFile(resolve(root,'写作手记.md')),Buffer.from(doc.text))
  await api('write_recovery',{documentId:doc.id,text:'unsaved recovery',hash:doc.hash})
  const draft=(await api('bootstrap')).drafts[0];assert(draft&&draft.text==='unsaved recovery')
  await api('discard_recovery',{draftId:draft.id});assert.equal((await api('bootstrap')).drafts.length,0)
  const draftBackup=(await api('list_operation_backups')).find(x=>x.kind==='draft');await api('restore_operation_backup',{id:draftBackup.id});assert.equal((await api('bootstrap')).drafts[0].text,'unsaved recovery')
  await api('discard_recovery',{draftId:draft.id})
  const tagged='---\n'+ 'tags: [old]\n---\n\n![image](assets/x.png)\n';const utf16=Buffer.concat([Buffer.from([255,254]),Buffer.from(tagged.replaceAll('\n','\r\n'),'utf16le')])
  await mkdir(resolve(root,'assets'));await writeFile(resolve(root,'assets/x.png'),Buffer.from([1,2,3]));await writeFile(resolve(root,'编码标签.md'),utf16)
  const tagDoc=await api('open_document',{workspaceId:'design',path:'编码标签.md'})
  const candidates=await api('tag_candidates');assert(candidates.some(x=>x.path==='编码标签.md'))
  const changed=tagged.replace('[old]','[new]');await api('apply_tag_changes',{changes:[{workspaceId:'design',path:'编码标签.md',text:changed,expectedHash:tagDoc.hash}]})
  const tagBackup=(await api('list_operation_backups')).find(x=>x.kind==='tags');await api('restore_operation_backup',{id:tagBackup.id});assert.deepEqual(await readFile(resolve(root,'编码标签.md')),utf16)
  const safe=await api('open_document',{workspaceId:'design',path:'编码标签.md'})
  await api('snapshot_document',{documentId:safe.id,text:safe.text,reason:'before move'})
  await mkdir(resolve(root,'nested'));const moved=await api('relocate_entry',{workspaceId:'design',path:'编码标签.md',destination:'nested',name:null})
  assert.ok(moved.documents.some(d=>d.path==='nested/编码标签.md'),'Moved document is listed at its new path');const movedBytes=await readFile(resolve(root,'nested/编码标签.md'));assert.equal(movedBytes[0],255);assert.equal(movedBytes[1],254);assert(movedBytes.subarray(2).toString('utf16le').includes('../assets/x.png'));assert.equal((await api('list_versions',{documentId:safe.id})).length,1)
  await mkdir(resolve(root,'removed/empty'),{recursive:true});await writeFile(resolve(root,'removed/data.bin'),Buffer.from([0,255,10]))
  await api('trash_entry',{workspaceId:'design',path:'removed'});assert.equal(await stat(resolve(root,'removed')).then(()=>true,()=>false),false)
  const deletion=(await api('list_operation_backups')).find(x=>x.kind==='delete');await api('restore_operation_backup',{id:deletion.id});assert.deepEqual(await readFile(resolve(root,'removed/data.bin')),Buffer.from([0,255,10]));assert((await stat(resolve(root,'removed/empty'))).isDirectory())
  await api('save_preferences',{preferences:{recentFiles:[{workspaceId:'design',path:'写作手记.md',openedAt:1},{workspaceId:'design',path:'missing.md',openedAt:1}],favorites:[]}});assert.equal((await api('valid_file_references')).recentFiles.length,1)
  await api('save_window_geometry');assert((JSON.parse(await readFile(resolve(data,'window.json'),'utf8'))).width>0)
  assert.deepEqual(errors,[]);console.log('Safety native verified: raw encoding restore, history migration, UTF-16 image rewrite and bulk tags, binary/empty directory deletion restore, discarded draft restore, stale references and window geometry.')
}finally{await browser?.close();child.kill()}
