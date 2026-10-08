import { chromium, expect } from '@playwright/test'
import { mkdir, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { spawn } from 'node:child_process'
import assert from 'node:assert/strict'

const run = resolve(`artifacts/design-${Date.now()}`), root = resolve(run, 'workspace'), data = resolve(run, 'app-data')
await mkdir(root, { recursive: true }); await mkdir(data, { recursive: true })
await writeFile(resolve(root, '写作手记.md'), '# 让想法，慢慢长出来\n\n在这里，留一处安静的空间。把今天的灵感，写成明天值得回看的文字。\n\n## 从一份笔记开始\n\n**专注于内容**，让工具退到恰好的位置。\n\n> 好的写作体验，是每一次打开都感到自在。\n\n## 今天想做的事\n\n- [x] 整理本周的写作灵感\n- [ ] 记录一个值得保留的想法\n- [ ] 写下一份新的产品笔记\n\n## 熟悉的表达方式\n\n| 功能 | 适合的场景 |\n| --- | --- |\n| 可视化编辑 | 专注写作 |\n| 分屏编辑 | 查看语法与效果 |\n| 阅读预览 | 安静地阅读 |\n')
await writeFile(resolve(root, '灵感清单.md'), '# 灵感清单\n\n从小想法开始。\n')
await writeFile(resolve(data, 'workspaces.json'), JSON.stringify([{ id: 'design', name: '我的写作空间', path: root, available: true }]))
await writeFile(resolve(data, 'preferences.json'), JSON.stringify({ defaultView: 'live', mode: 'light' }))
const child = spawn(resolve('src-tauri/target/debug/markflow.exe'), [], { windowsHide: true, env: { ...process.env, LEXLY_DEV_DATA_DIR: data, WEBVIEW2_USER_DATA_FOLDER: resolve(data, 'webview'), LEXLY_DEV_HEADLESS: '1', WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS: '--remote-debugging-port=9229' }, stdio: ['ignore','pipe','pipe'] })
let browser, page, logs = ''
child.stderr.on('data', b => { logs += b }); child.stdout.on('data', b => { logs += b })
try {
  for (let i = 0; i < 150; i++) { try { if ((await fetch('http://127.0.0.1:9229/json/version')).ok) break } catch {} if (child.exitCode !== null) throw new Error(logs); await new Promise(r => setTimeout(r, 100)) }
  browser = await chromium.connectOverCDP('http://127.0.0.1:9229'); page = browser.contexts()[0].pages()[0]; page.setDefaultTimeout(15000)
  const errors = [], remote = []; page.on('pageerror', e => errors.push(e.message)); page.on('request', r => { if (/^https?:/.test(r.url()) && !r.url().startsWith('http://127.0.0.1:1420') && new URL(r.url()).hostname !== 'ipc.localhost') remote.push(r.url()) })
  const api = (command,args={}) => page.evaluate(async ({command,args}) => (await import('/src/services/api.ts')).call(command,args), {command,args})
  const resize = (width,height) => page.setViewportSize({width,height})
  const view = label => page.getByLabel('编辑视图').getByLabel(label, { exact: true }).click()
  await page.getByRole('button', { name:'写作手记.md', exact:true }).click()
  await expect(page.locator('.lexly-format-toolbar')).toBeVisible()
  assert.equal(await page.locator('.live-editor .vditor-toolbar').count(), 0, 'Formatting toolbar must share the app action row')
  assert.equal((await page.locator('.app-header').boundingBox()).y, 0); await expect(page.getByRole('button',{name:'最小化窗口',exact:true})).toBeVisible(); await page.getByRole('button',{name:'最大化窗口',exact:true}).click(); await expect(page.getByRole('button',{name:'还原窗口',exact:true})).toBeVisible(); await page.getByRole('button',{name:'还原窗口',exact:true}).click(); await expect(page.getByRole('button',{name:'最大化窗口',exact:true})).toBeVisible(); assert.equal(await page.getByRole('button',{name:'在系统目录中打开当前文档',exact:true}).count(),0); await page.screenshot({path:resolve(run,'main-light.png')})
  await page.getByRole('button',{name:'切换主题',exact:true}).hover(); await expect(page.locator('[data-slot=tooltip-content]').filter({hasText:'切换主题'})).toBeVisible(); await page.getByRole('button',{name:'切换主题',exact:true}).click(); await page.getByRole('menuitem',{name:'暗色',exact:true}).click(); await expect(page.locator('html')).toHaveClass(/dark/); await page.getByRole('button',{name:'切换主题',exact:true}).click(); await page.getByRole('menuitem',{name:'亮色',exact:true}).click(); await expect(page.locator('html')).not.toHaveClass(/dark/); await page.getByRole('button',{name:'切换主题',exact:true}).focus(); await page.keyboard.press('Enter'); await page.getByRole('menuitem',{name:'跟随系统',exact:true}).click(); await expect.poll(async()=> (await api('bootstrap')).preferences.mode).toBe('system'); await page.getByRole('button',{name:'切换主题',exact:true}).click(); await page.getByRole('menuitem',{name:'亮色',exact:true}).click();
  await page.getByRole('menuitem', {name:'文件',exact:true}).click(); await page.getByRole('menuitem',{name:/新建文档/}).click()
  await expect(page.getByRole('dialog')).toContainText('新建 Markdown 文档'); await page.getByRole('button',{name:'取消',exact:true}).click(); await page.getByRole('dialog').waitFor({state:'hidden'})
  await page.keyboard.press('Control+k'); await page.locator('[data-slot=command-input]').fill('分屏')
  await expect(page.getByRole('option')).toHaveCount(1); await page.keyboard.press('ArrowDown'); await expect(page.getByRole('option',{name:'分屏编辑',exact:true})).toHaveAttribute('data-highlighted', ''); await page.keyboard.press('Enter')
  await expect(page.getByLabel('编辑视图').getByLabel('分屏编辑',{exact:true})).toHaveAttribute('data-state','on')
  await page.getByRole('menuitem',{name:'导出',exact:true}).click(); await page.getByRole('menuitem',{name:'导出 HTML',exact:true}).click()
  await expect(page.getByRole('combobox',{name:'导出格式',exact:true})).toContainText('独立 HTML 页面'); await page.getByRole('button',{name:'取消',exact:true}).click(); await page.getByRole('dialog').waitFor({state:'hidden'})
  await view('源码编辑'); const source=page.getByRole('textbox',{name:'Markdown 源码'})
  await source.fill('选中的文字'); await source.evaluate(el=>{el.focus();el.setSelectionRange(0,5)})
  await page.getByRole('menuitem',{name:'段落',exact:true}).click(); await page.getByRole('menuitem',{name:'加粗',exact:true}).click()
  await expect(source).toHaveValue('**选中的文字**'); await source.fill('可视化格式'); await view('可视化编辑'); const live=page.locator('.document-panel:visible .vditor-ir [contenteditable=true]'); await expect(live).toContainText('可视化格式'); await live.click(); await live.press('Control+a'); await page.waitForTimeout(350); await page.getByRole('menuitem',{name:'段落',exact:true}).click(); await page.getByRole('menuitem',{name:'加粗',exact:true}).click(); await view('源码编辑'); assert((await source.inputValue()).includes('**可视化格式**'), 'Live menu formatting must preserve the editor selection')
  await page.getByRole('button',{name:'设置',exact:true}).click()
  const dialog=page.locator('.settings-dialog')
  await expect(page.getByRole('tab',{name:'通用',exact:true})).toHaveAttribute('data-state','active')
  for(const label of ['外观','排版','标签管理','快捷键','关于']) { await page.getByRole('tab',{name:label,exact:true}).click(); assert(await dialog.evaluate(el=>el.scrollWidth<=el.clientWidth+1)) }
  await page.getByRole('tab',{name:'排版',exact:true}).click(); await page.getByRole('combobox',{name:'正文字号',exact:true}).click(); await page.getByRole('option',{name:'大（18px）',exact:true}).click()
  await page.getByRole('tab',{name:'外观',exact:true}).click(); await page.getByLabel('显示模式').getByText('暗色',{exact:true}).click()
  await page.getByRole('button',{name:'恢复此分类默认设置',exact:true}).click()
  await expect.poll(async () => (await api('bootstrap')).preferences.bodySize).toBe(18)
  await page.screenshot({path:resolve(run,'settings-light.png')})
  await page.getByLabel('显示模式').getByText('暗色',{exact:true}).click()
  await page.screenshot({path:resolve(run,'settings-dark.png')})
  await page.getByRole('button',{name:'完成',exact:true}).click(); await page.getByRole('dialog').waitFor({state:'hidden'}); await view('可视化编辑')
  await page.screenshot({path:resolve(run,'main-dark.png')})
  await resize(820,560)
  await page.getByRole('button',{name:'设置',exact:true}).click(); await page.getByRole('tab',{name:'外观',exact:true}).click()
  await page.getByRole('combobox',{name:'全局界面字号',exact:true}).click(); await page.getByRole('option',{name:'特大（18px）',exact:true}).click()
  assert(await dialog.evaluate(el=> { const r=el.getBoundingClientRect(); return r.left>=0 && r.right<=innerWidth+1 && r.top>=0 && r.bottom<=innerHeight+1 && el.scrollWidth<=el.clientWidth+1 }))
  await page.getByRole('button',{name:'完成',exact:true}).click(); await page.getByRole('dialog').waitFor({state:'hidden'}); await page.keyboard.press('Control+,'); await expect(dialog).toBeVisible()
  await page.getByRole('tab',{name:'通用',exact:true}).click(); await page.getByRole('switch',{name:'显示顶部菜单',exact:true}).click(); await page.getByRole('button',{name:'完成',exact:true}).click(); await page.getByRole('dialog').waitFor({state:'hidden'})
  await expect(page.getByLabel('应用菜单')).toBeHidden(); await page.getByRole('button',{name:'设置',exact:true}).click(); await expect(dialog).toBeVisible()
  await page.screenshot({path:resolve(run,'settings-small.png')})
  assert.deepEqual(errors,[]); assert.deepEqual(remote,[])
  console.log(`Native design verified: menubar actions, keyboard command search, export defaults, source formatting, all settings categories, scoped reset, large text/small window, theme switching, header-hidden settings access. Screenshots: ${run}`)
} catch(e) { if(page)await page.screenshot({path:resolve(run,'failure.png')}).catch(()=>{}); throw e } finally { await browser?.close(); child.kill() }


