import { chromium, expect } from '@playwright/test'
import { mkdir, writeFile, readFile, readdir, stat } from 'node:fs/promises'
import { resolve } from 'node:path'
import { spawn } from 'node:child_process'
import assert from 'node:assert/strict'

const run = resolve(`artifacts/sidebar-${Date.now()}`), root = resolve(run, 'workspace'), data = resolve(run, 'app-data')
await mkdir(root, { recursive: true }); await mkdir(data, { recursive: true })
await writeFile(resolve(root, '写作手记.md'), '# 让想法，慢慢长出来\n\n在这里，留一处安静的空间。把今天的灵感，写成明天值得回看的文字。\n\n## 从一份笔记开始\n\n**专注于内容**，让工具退到恰好的位置。\n\n> 好的写作体验，是每一次打开都感到自在。\n\n## 今天想做的事\n\n- [x] 整理本周的写作灵感\n- [ ] 记录一个值得保留的想法\n- [ ] 写下一份新的产品笔记\n\n## 熟悉的表达方式\n\n| 功能 | 适合的场景 |\n| --- | --- |\n| 可视化编辑 | 专注写作 |\n| 分屏编辑 | 查看语法与效果 |\n| 阅读预览 | 安静地阅读 |\n')
await writeFile(resolve(root, '灵感清单.md'), '# 灵感清单\n\n从小想法开始。\n')
await writeFile(resolve(data, 'workspaces.json'), JSON.stringify([{ id: 'design', name: '我的写作空间', path: root, available: true }]))
await writeFile(resolve(data, 'preferences.json'), JSON.stringify({ defaultView: 'source', mode: 'light', autoSave: false }))
const recent=[];for(let i=0;i<24;i++){const path='最近记录-'+i+'.md';await writeFile(resolve(root,path),'# note '+i);recent.push({workspaceId:'design',path,openedAt:Date.now()-i})}
await mkdir(resolve(root,'nested'),{recursive:true});await writeFile(resolve(root,'nested/定位文档.md'),'# locate')
await writeFile(resolve(data,'preferences.json'),JSON.stringify({defaultView:'source',autoSave:false,autoReveal:false,activeWorkspace:'missing',recentFiles:recent,favorites:[recent[3]]}))
const child = spawn(resolve('src-tauri/target/debug/markflow.exe'), [], { windowsHide: true, env: { ...process.env, LEXLY_DEV_DATA_DIR: data, WEBVIEW2_USER_DATA_FOLDER: resolve(data, 'webview'), LEXLY_DEV_HEADLESS: '1', WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS: '--remote-debugging-port=9241' }, stdio: ['ignore','pipe','pipe'] })
let browser, page, logs = ''
child.stderr.on('data', b => { logs += b }); child.stdout.on('data', b => { logs += b })
try {
  for (let i = 0; i < 150; i++) { try { if ((await fetch('http://127.0.0.1:9241/json/version')).ok) break } catch {} if (child.exitCode !== null) throw new Error(logs); await new Promise(r => setTimeout(r, 100)) }
  browser = await chromium.connectOverCDP('http://127.0.0.1:9241'); page = browser.contexts()[0].pages()[0]; page.setDefaultTimeout(15000)

  const errors=[];page.on('pageerror',e=>errors.push(e.message))
  const api=(command,args={})=>page.evaluate(async({command,args})=>(await import('/src/services/api.ts')).call(command,args),{command,args})
  await page.waitForURL('http://127.0.0.1:1420/');await page.getByRole('button',{name:'写作手记.md',exact:true}).waitFor()
  const sidebar=page.getByRole('complementary',{name:'工作区',exact:true})
  await expect(page.getByLabel('切换工作区',{exact:true})).toHaveCount(0)
  await expect(sidebar.getByRole('button',{name:'搜索工作区',exact:true})).toBeVisible()
  await expect(sidebar.getByRole('tree',{name:'文件目录'})).toContainText('我的写作空间')
  const recent=sidebar.getByRole('tabpanel',{name:'最近',exact:true});await expect(recent.getByRole('button',{name:/打开最近文档/})).toHaveCount(20)
  assert(await recent.evaluate(el=>el.scrollHeight>el.clientHeight))
  await page.getByRole('button',{name:'设置',exact:true}).click();await page.getByRole('tab',{name:'通用',exact:true}).click();await page.getByLabel('最近文档显示数量',{exact:true}).click();await page.getByRole('option',{name:'50 篇',exact:true}).click();await page.getByRole('button',{name:'完成',exact:true}).click();await page.getByRole('dialog').waitFor({state:'hidden'})
  await expect(recent.getByRole('button',{name:/打开最近文档/})).toHaveCount(24)
  await page.getByRole('button',{name:'设置',exact:true}).click();await page.getByRole('tab',{name:'通用',exact:true}).click();await page.getByLabel('最近文档显示数量',{exact:true}).click();await page.getByRole('option',{name:'20 篇',exact:true}).click();await page.getByRole('tab',{name:'保存与备份',exact:true}).click();await expect(page.getByRole('dialog')).toContainText(data);await expect(page.getByRole('button',{name:'打开数据目录',exact:true})).toBeVisible();await page.getByRole('button',{name:'完成',exact:true}).click();await page.getByRole('dialog').waitFor({state:'hidden'})
  await recent.getByRole('button',{name:'打开最近文档 最近记录-0.md',exact:true}).click();await expect(page.getByRole('textbox',{name:'Markdown 源码',exact:true})).toHaveValue('# note 0');await expect(page.getByRole('dialog')).toHaveCount(0)
  await sidebar.getByRole('tab',{name:'收藏',exact:true}).click();const favorites=sidebar.getByRole('tabpanel',{name:'收藏',exact:true});await favorites.getByRole('button',{name:'打开收藏文档 最近记录-3.md',exact:true}).click();await expect(page.getByRole('textbox',{name:'Markdown 源码',exact:true})).toHaveValue('# note 3')
  await page.getByRole('button',{name:'文章操作',exact:true}).click();await page.getByRole('menuitem',{name:'取消收藏',exact:true}).click();await expect(favorites).toContainText('暂无收藏文档');assert(await stat(resolve(root,'最近记录-3.md')))
  await sidebar.getByRole('button',{name:'搜索工作区',exact:true}).click();await expect(page.getByRole('dialog')).toBeVisible();await page.getByRole('dialog').getByRole('button',{name:'Close',exact:true}).click();await page.getByRole('dialog').waitFor({state:'hidden'})
  await page.evaluate(async()=>{const s=(await import('/src/stores/workbench.ts')).useWorkbench();await s.open('design','nested/定位文档.md')})
  await sidebar.getByRole('button',{name:'在文件树中定位当前文档',exact:true}).click();await expect(sidebar.getByRole('tree',{name:'文件目录'}).getByRole('button',{name:'定位文档.md',exact:true})).toBeFocused()
  await page.setViewportSize({width:820,height:620});assert(await sidebar.evaluate(el=>el.scrollWidth<=el.clientWidth+1))
  assert.deepEqual(errors,[]);await page.screenshot({path:resolve(run,'verified.png')});console.log('Sidebar native verified: selector removed, heading search icon, recent/favorites inline lists, scrolling, opening, removal without file deletion, stale workspace filter ignored, nested document reveal and the data directory row in settings.')
}finally{await browser?.close();child.kill()}
