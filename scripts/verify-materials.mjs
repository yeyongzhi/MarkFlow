import { chromium, expect } from '@playwright/test'
import { mkdir, writeFile, readFile, readdir, stat } from 'node:fs/promises'
import { resolve } from 'node:path'
import { spawn } from 'node:child_process'
import assert from 'node:assert/strict'

const run = resolve(`artifacts/material-${Date.now()}`), root = resolve(run, 'workspace'), data = resolve(run, 'app-data')
await mkdir(root, { recursive: true }); await mkdir(data, { recursive: true })
await writeFile(resolve(root, '写作手记.md'), '# 让想法，慢慢长出来\n\n在这里，留一处安静的空间。把今天的灵感，写成明天值得回看的文字。\n\n## 从一份笔记开始\n\n**专注于内容**，让工具退到恰好的位置。\n\n> 好的写作体验，是每一次打开都感到自在。\n\n## 今天想做的事\n\n- [x] 整理本周的写作灵感\n- [ ] 记录一个值得保留的想法\n- [ ] 写下一份新的产品笔记\n\n## 熟悉的表达方式\n\n| 功能 | 适合的场景 |\n| --- | --- |\n| 可视化编辑 | 专注写作 |\n| 分屏编辑 | 查看语法与效果 |\n| 阅读预览 | 安静地阅读 |\n')
await writeFile(resolve(root, '灵感清单.md'), '# 灵感清单\n\n从小想法开始。\n')
await writeFile(resolve(data, 'workspaces.json'), JSON.stringify([{ id: 'design', name: '我的写作空间', path: root, available: true }]))
await writeFile(resolve(data, 'preferences.json'), JSON.stringify({ defaultView: 'source', mode: 'light', autoSave: false }))
await writeFile(resolve(root,'test.md'),'# test');await writeFile(resolve(root,'这是一个非常长的文档名称用于后缀显示测试.md'),'# long')
const child = spawn(resolve('src-tauri/target/debug/markflow.exe'), [], { windowsHide: true, env: { ...process.env, LEXLY_DEV_DATA_DIR: data, WEBVIEW2_USER_DATA_FOLDER: resolve(data, 'webview'), LEXLY_DEV_HEADLESS: '1', WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS: '--remote-debugging-port=9243' }, stdio: ['ignore','pipe','pipe'] })
let browser, page, logs = ''
child.stderr.on('data', b => { logs += b }); child.stdout.on('data', b => { logs += b })
try {
  for (let i = 0; i < 150; i++) { try { if ((await fetch('http://127.0.0.1:9243/json/version')).ok) break } catch {} if (child.exitCode !== null) throw new Error(logs); await new Promise(r => setTimeout(r, 100)) }
  browser = await chromium.connectOverCDP('http://127.0.0.1:9243'); page = browser.contexts()[0].pages()[0]; page.setDefaultTimeout(15000)

  const errors=[];page.on('pageerror',e=>errors.push(e.message))
  const api=(command,args={})=>page.evaluate(async({command,args})=>(await import('/src/services/api.ts')).call(command,args),{command,args})
  await page.waitForURL('http://127.0.0.1:1420/');await page.getByRole('button',{name:'写作手记.md',exact:true}).waitFor()
  const sidebar=page.getByRole('complementary',{name:'工作区',exact:true})
  await page.getByRole('button',{name:'test.md',exact:true}).click();const tab=page.getByRole('tab',{name:'test.md',exact:true});await expect(tab).toBeVisible();assert(await tab.locator('span').filter({hasText:/^[.]md$/}).evaluate(el=>el.getBoundingClientRect().width>0&&el.scrollWidth<=el.clientWidth+1));assert.equal(await tab.evaluate(el=>getComputedStyle(el).fontStyle),'normal')
  await expect(sidebar.getByRole('button',{name:/列表移除/})).toHaveCount(0)
  await page.getByRole('button',{name:'test.md 的菜单',exact:true}).click();await page.getByRole('menuitem',{name:'收藏文档',exact:true}).click();await sidebar.getByRole('tab',{name:'收藏',exact:true}).click();await expect(sidebar.getByRole('button',{name:'打开收藏文档 test.md',exact:true})).toBeVisible()
  await page.getByRole('button',{name:'文章操作',exact:true}).click();await page.getByRole('menuitem',{name:'取消收藏',exact:true}).click();await expect(sidebar).toContainText('暂无收藏文档')
  await page.getByRole('button',{name:'文章操作',exact:true}).click();await page.getByRole('menuitem',{name:'收藏文档',exact:true}).click();await expect(sidebar.getByRole('button',{name:'打开收藏文档 test.md',exact:true})).toBeVisible()
  await page.getByRole('button',{name:'设置',exact:true}).click();await page.getByRole('tab',{name:'外观',exact:true}).click()
  await page.getByRole('combobox',{name:'界面材质',exact:true}).click();await page.getByRole('option',{name:'毛玻璃 · 通透',exact:true}).click();await expect(page.locator('html')).toHaveAttribute('data-material','glass');assert((await page.locator('.workspace-sidebar').evaluate(el=>getComputedStyle(el).backdropFilter)).includes('blur'))
  await page.getByRole('combobox',{name:'界面圆角',exact:true}).click();await page.getByRole('option',{name:'圆润 · 18px',exact:true}).click();assert.equal(await page.locator('html').evaluate(el=>getComputedStyle(el).getPropertyValue('--radius').trim()),'18px')
  await page.getByRole('combobox',{name:'毛玻璃模糊',exact:true}).click();await page.getByRole('option',{name:'柔雾',exact:true}).click();assert((await page.locator('.workspace-sidebar').evaluate(el=>getComputedStyle(el).backdropFilter)).includes('26px'))
  await page.getByRole('button',{name:'完成',exact:true}).click();await page.getByRole('dialog').waitFor({state:'hidden'});await page.waitForTimeout(300);const prefs=JSON.parse(await readFile(resolve(data,'preferences.json'),'utf8'));assert.equal(prefs.material,'glass');assert.equal(prefs.cornerRadius,18);assert(prefs.favorites.some(f=>f.path==='test.md'))
  await page.getByRole('button',{name:'这是一个非常长的文档名称用于后缀显示测试.md',exact:true}).click();const longTab=page.getByRole('tab',{name:'这是一个非常长的文档名称用于后缀显示测试.md',exact:true});await expect(longTab).toBeVisible();assert(await longTab.locator('span').filter({hasText:/^[.]md$/}).evaluate(el=>el.getBoundingClientRect().width>0&&el.scrollWidth<=el.clientWidth+1))
  await page.setViewportSize({width:820,height:620});await page.screenshot({path:resolve(run,'glass.png')});assert.deepEqual(errors,[]);console.log('Material native verified: sidebar removal hidden, filename suffix preserved, tree and article favorites synchronized and persisted, glass surface blur, radius and blur settings, long filename and narrow viewport.')
}finally{await browser?.close();child.kill()}
