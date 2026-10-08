import { chromium, expect } from '@playwright/test'
import { mkdir, writeFile, readFile, readdir, stat } from 'node:fs/promises'
import { resolve } from 'node:path'
import { spawn } from 'node:child_process'
import assert from 'node:assert/strict'

const run = resolve(`artifacts/interaction-${Date.now()}`), root = resolve(run, 'workspace'), data = resolve(run, 'app-data')
await mkdir(root, { recursive: true }); await mkdir(data, { recursive: true })
await writeFile(resolve(root, '写作手记.md'), '# 让想法，慢慢长出来\n\n在这里，留一处安静的空间。把今天的灵感，写成明天值得回看的文字。\n\n## 从一份笔记开始\n\n**专注于内容**，让工具退到恰好的位置。\n\n> 好的写作体验，是每一次打开都感到自在。\n\n## 今天想做的事\n\n- [x] 整理本周的写作灵感\n- [ ] 记录一个值得保留的想法\n- [ ] 写下一份新的产品笔记\n\n## 熟悉的表达方式\n\n| 功能 | 适合的场景 |\n| --- | --- |\n| 可视化编辑 | 专注写作 |\n| 分屏编辑 | 查看语法与效果 |\n| 阅读预览 | 安静地阅读 |\n')
await writeFile(resolve(root, '灵感清单.md'), '# 灵感清单\n\n从小想法开始。\n')
await writeFile(resolve(data, 'workspaces.json'), JSON.stringify([{ id: 'design', name: '我的写作空间', path: root, available: true }]))
await writeFile(resolve(data, 'preferences.json'), JSON.stringify({ defaultView: 'source', mode: 'light', autoSave: false }))
const child = spawn(resolve('src-tauri/target/debug/markflow.exe'), [], { windowsHide: true, env: { ...process.env, LEXLY_DEV_DATA_DIR: data, WEBVIEW2_USER_DATA_FOLDER: resolve(data, 'webview'), LEXLY_DEV_HEADLESS: '1', WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS: '--remote-debugging-port=9239' }, stdio: ['ignore','pipe','pipe'] })
let browser, page, logs = ''
child.stderr.on('data', b => { logs += b }); child.stdout.on('data', b => { logs += b })
try {
  for (let i = 0; i < 150; i++) { try { if ((await fetch('http://127.0.0.1:9239/json/version')).ok) break } catch {} if (child.exitCode !== null) throw new Error(logs); await new Promise(r => setTimeout(r, 100)) }
  browser = await chromium.connectOverCDP('http://127.0.0.1:9239'); page = browser.contexts()[0].pages()[0]; page.setDefaultTimeout(15000)

  const errors=[];page.on('pageerror',e=>errors.push(e.message))
  const api=(command,args={})=>page.evaluate(async({command,args})=>(await import('/src/services/api.ts')).call(command,args),{command,args})
  await page.waitForURL('http://127.0.0.1:1420/');await page.getByRole('button',{name:'写作手记.md',exact:true}).waitFor()
  const model=(name,args={})=>page.evaluate(async({name,args})=>{const s=(await import('/src/stores/workbench.ts')).useWorkbench();if(name==='prefs'){Object.assign(s.preferences,args);await s.persistNow()}if(name==='active')return JSON.parse(JSON.stringify(s.active));if(name==='save')return s.save(s.active)},{name,args})
  await page.getByRole('button',{name:'写作手记.md',exact:true}).dblclick();const source=page.getByRole('textbox',{name:'Markdown 源码',exact:true});await source.waitFor()
  await model('prefs',{background:'#111111',textColor:'#111111',uiSize:20})
  assert.equal(await page.evaluate(()=>getComputedStyle(document.documentElement).getPropertyValue('--foreground').trim()),'#ffffff')
  await model('prefs',{background:'#ffffff',textColor:'#333333'})
  assert.equal(await page.evaluate(()=>getComputedStyle(document.documentElement).getPropertyValue('--foreground').trim()),'#333333')
  await model('prefs',{background:'',textColor:'',uiSize:13})
  await page.keyboard.press('Control+Shift+Enter');await expect(page.getByRole('button',{name:'退出专注模式 · Esc',exact:true})).toBeVisible();await page.keyboard.press('Escape');await expect(page.getByRole('button',{name:'退出专注模式 · Esc',exact:true})).toHaveCount(0)
  await page.setViewportSize({width:820,height:620})
  await page.getByLabel('编辑视图').getByLabel('可视化编辑',{exact:true}).click();await expect(page.getByRole('button',{name:'文本格式',exact:true})).toBeVisible()
  await page.getByLabel('编辑视图').getByLabel('源码编辑',{exact:true}).click()
  await source.fill('line1\\n\\nline2');await model('save');await source.press('Control+End')
  await page.getByRole('button',{name:'灵感清单.md',exact:true}).dblclick();await source.waitFor();await page.keyboard.press('Alt+ArrowLeft');await expect(source).toHaveValue('line1\\n\\nline2');await page.keyboard.press('Alt+ArrowRight');await expect(source).toHaveValue(/灵感清单/)
  await model('prefs',{closeToTray:true,saveOnBlur:false});await source.fill('tray protected draft');await page.getByRole('button',{name:'关闭窗口',exact:true}).click();await expect.poll(async()=>page.evaluate(async()=>(await import('/node_modules/.vite/deps/@tauri-apps_api_window.js')).getCurrentWindow().isVisible())).toBe(false)
  assert((await api('bootstrap')).drafts.some(x=>x.text==='tray protected draft'));assert((JSON.parse(await readFile(resolve(data,'window.json'),'utf8'))).width>0)
  assert.deepEqual(errors,[])
  console.log('Interaction native verified: custom contrast, focus exit, responsive toolbar, navigation forward/back, close-to-tray recovery and window geometry.')
}finally{await browser?.close();child.kill()}
