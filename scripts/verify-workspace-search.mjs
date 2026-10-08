import { chromium, expect } from '@playwright/test'
import { mkdir, writeFile, readFile, readdir, stat } from 'node:fs/promises'
import { resolve } from 'node:path'
import { spawn } from 'node:child_process'
import assert from 'node:assert/strict'

const run = resolve(`artifacts/workspace-search-${Date.now()}`), root = resolve(run, 'workspace'), data = resolve(run, 'app-data')
await mkdir(root, { recursive: true }); await mkdir(data, { recursive: true })
await writeFile(resolve(root, '写作手记.md'), '# 让想法，慢慢长出来\n\n在这里，留一处安静的空间。把今天的灵感，写成明天值得回看的文字。\n\n## 从一份笔记开始\n\n**专注于内容**，让工具退到恰好的位置。\n\n> 好的写作体验，是每一次打开都感到自在。\n\n## 今天想做的事\n\n- [x] 整理本周的写作灵感\n- [ ] 记录一个值得保留的想法\n- [ ] 写下一份新的产品笔记\n\n## 熟悉的表达方式\n\n| 功能 | 适合的场景 |\n| --- | --- |\n| 可视化编辑 | 专注写作 |\n| 分屏编辑 | 查看语法与效果 |\n| 阅读预览 | 安静地阅读 |\n')
await writeFile(resolve(root, '灵感清单.md'), '# 灵感清单\n\n从小想法开始。\n')
await writeFile(resolve(data, 'workspaces.json'), JSON.stringify([{ id: 'design', name: '我的写作空间', path: root, available: true }]))
await writeFile(resolve(data, 'preferences.json'), JSON.stringify({ defaultView: 'source', mode: 'light', autoSave: false }))
await writeFile(resolve(root,'test.md'),'13231\n3123');await writeFile(resolve(root,'notes.md'),'header\ntest in body');await mkdir(resolve(root,'folder-test'));await writeFile(resolve(root,'folder-test/other.md'),'numbers only')
await writeFile(resolve(data,'preferences.json'),JSON.stringify({defaultView:'live',autoSave:false,saveOnBlur:false}))
const child = spawn(resolve('src-tauri/target/debug/markflow.exe'), [], { windowsHide: true, env: { ...process.env, LEXLY_DEV_DATA_DIR: data, WEBVIEW2_USER_DATA_FOLDER: resolve(data, 'webview'), LEXLY_DEV_HEADLESS: '1', WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS: '--remote-debugging-port=9242' }, stdio: ['ignore','pipe','pipe'] })
let browser, page, logs = ''
child.stderr.on('data', b => { logs += b }); child.stdout.on('data', b => { logs += b })
try {
  for (let i = 0; i < 150; i++) { try { if ((await fetch('http://127.0.0.1:9242/json/version')).ok) break } catch {} if (child.exitCode !== null) throw new Error(logs); await new Promise(r => setTimeout(r, 100)) }
  browser = await chromium.connectOverCDP('http://127.0.0.1:9242'); page = browser.contexts()[0].pages()[0]; page.setDefaultTimeout(15000)

  const errors=[];page.on('pageerror',e=>errors.push(e.message))
  const api=(command,args={})=>page.evaluate(async({command,args})=>(await import('/src/services/api.ts')).call(command,args),{command,args})
  await page.waitForURL('http://127.0.0.1:1420/');await page.getByRole('button',{name:'写作手记.md',exact:true}).waitFor()
  const search=async(text)=>{await page.getByRole('complementary',{name:'工作区',exact:true}).getByRole('button',{name:'搜索工作区',exact:true}).click();await page.getByRole('textbox',{name:'工作区搜索内容',exact:true}).fill(text);await expect(page.getByRole('status').filter({hasText:'搜索中'})).toHaveCount(0)}
  await search('test')
  await expect(page.getByRole('option',{name:/^test.md.*文件名或路径匹配/})).toBeVisible();await expect(page.getByRole('option',{name:/^folder-test.*文件名或路径匹配/})).toBeVisible();await expect(page.getByRole('option',{name:/^notes.md : 2/})).toBeVisible()
  await page.getByRole('option',{name:/^test.md.*文件名或路径匹配/}).click();await page.getByRole('dialog').waitFor({state:'hidden'});await expect(page.locator('.vditor-ir [contenteditable=true]:visible')).toBeVisible()
  await search('test');await expect(page.getByRole('option',{name:/^test.md.*文件名或路径匹配/})).toBeVisible();await page.getByRole('dialog').getByRole('button',{name:'Close',exact:true}).click()
  await page.getByRole('button',{name:'notes.md',exact:true}).dblclick();await expect(page.locator('.vditor-ir [contenteditable=true]:visible')).toBeVisible();await search('test');await page.getByRole('option',{name:/^notes.md : 2/}).click();const source=page.getByRole('textbox',{name:'Markdown 源码',exact:true});await expect(source).toHaveValue('header\ntest in body')
  await source.fill('unsaved unique draft');await search('unique');await expect(page.getByRole('option',{name:/^notes.md : 1/})).toBeVisible();await page.getByRole('textbox',{name:'工作区搜索内容',exact:true}).fill('test');await expect(page.getByRole('option',{name:/^notes.md : 2/})).toHaveCount(0);await expect(page.getByRole('option',{name:/^test.md.*文件名或路径匹配/})).toBeVisible()
  await page.getByRole('textbox',{name:'工作区搜索内容',exact:true}).fill('TEST');await page.getByRole('button',{name:'Aa',exact:true}).click();await expect(page.getByRole('option')).toHaveCount(0);await page.getByRole('dialog').getByRole('button',{name:'Close',exact:true}).click()
  await page.getByRole('dialog').waitFor({state:'hidden'});await page.keyboard.press('Control+p');await page.getByRole('textbox',{name:'搜索文件名',exact:true}).fill('test');await expect(page.getByRole('option',{name:/^test.md/})).toBeVisible();await expect(page.getByRole('option',{name:/^notes.md/})).toHaveCount(0)
  assert.deepEqual(errors,[]);console.log('Workspace search native verified: closed/open filename matches, nested paths, body lines, unsaved content authority, case sensitivity, quick-open scope and source view for body jumps.')
}finally{await browser?.close();child.kill()}
