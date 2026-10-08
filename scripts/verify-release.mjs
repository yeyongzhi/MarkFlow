import { chromium, expect } from '@playwright/test'
import { spawn } from 'node:child_process'
import { resolve } from 'node:path'
import { mkdir, readdir, rm } from 'node:fs/promises'
import assert from 'node:assert/strict'

// Smoke-test embedded assets with a temporary frontend-only document inside an isolated release data directory.
await mkdir('artifacts', { recursive:true })
const data = resolve('artifacts/release-data')
await rm(data, { recursive:true, force:true })
await mkdir(data, { recursive:true })
const child = spawn(resolve('src-tauri/target/release/markflow.exe'), [], { windowsHide:true, env:{...process.env,LEXLY_DATA_DIR:data,WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS:'--remote-debugging-port=9224'}, stdio:'ignore' })
let browser, page
try {
  let ready = false
  for (let i=0; i<100; i++) { try { if ((await fetch('http://127.0.0.1:9224/json/version')).ok) { ready=true; break } } catch {} await new Promise(r=>setTimeout(r,100)) }
  assert(ready, 'Release WebView must start')
  browser = await chromium.connectOverCDP('http://127.0.0.1:9224'); page = browser.contexts()[0].pages()[0]
  const errors=[], remote=[]; page.on('pageerror', e=>errors.push(e.message)); page.on('request',r=>{if(/^https?:/.test(r.url())&&!['http://tauri.localhost','http://ipc.localhost'].includes(new URL(r.url()).origin))remote.push(r.url())})
  await page.getByRole('button',{name:'添加工作区',exact:true}).first().waitFor()
  assert(!page.url().includes('127.0.0.1:1420'), 'Release must use embedded frontend')
  assert.equal(await page.getByText('浏览器预览 · 示例数据',{exact:true}).count(),0)
  const boot = await page.evaluate(()=>window.__TAURI_INTERNALS__.invoke('bootstrap'))
  assert(Array.isArray(boot.workspaces))
  const dataDir = await page.evaluate(()=>window.__TAURI_INTERNALS__.invoke('data_directory'))
  assert.equal(dataDir.toLowerCase(), data.toLowerCase(), 'Release build must use the requested data directory')
  let profile = 0
  for (let i=0; i<40 && !profile; i++) { profile = await readdir(resolve(data,'webview')).then(e=>e.length,()=>0); if (!profile) await new Promise(r=>setTimeout(r,100)) }
  assert(profile, 'WebView2 profile must be created inside the data directory')
  const injected = await page.evaluate(()=>{
    const pinia=document.querySelector('#app').__vue_app__.config.globalProperties.$pinia
    const store=pinia._s.get('workbench'); if(store.documents.length) return false
    store.documents.push({id:'smoke-test',workspaceId:'smoke-test',path:'打包验证.md',text:'# 离线桌面编辑器\n\n## 本地资源\n\n**已打包**，支持实时排版。\n\n- [x] 编辑器脚本\n- [x] 中文界面\n',hash:'smoke-test',bom:false,crlf:false,revision:0,savedRevision:0,status:'clean',error:'',view:'live',generation:0})
    store.activeId='smoke-test'; return true
  })
  if (injected) {
    await page.locator('.vditor-ir [contenteditable=true]').waitFor()
    await expect(page.locator('.vditor-ir h1')).toContainText('离线桌面编辑器')
    assert.equal(await page.locator('.outline-panel nav button').count(),2)
    await page.screenshot({path:'artifacts/lexly-release.png'})
    // Clear only the injected in-memory document; never touch existing user sessions.
    await page.evaluate(()=>{const s=document.querySelector('#app').__vue_app__.config.globalProperties.$pinia._s.get('workbench');s.documents=[];s.activeId=''})
  }
  assert.deepEqual(errors,[]); assert.deepEqual(remote,[])
  console.log('Release verified: embedded frontend, native IPC, offline editor scripts, outline and self-contained data directory:', dataDir)
} catch(e) { if(page)await page.screenshot({path:'artifacts/lexly-release-failure.png'}).catch(()=>{});throw e }
finally { if(browser)await browser.close().catch(()=>{});child.kill() }
