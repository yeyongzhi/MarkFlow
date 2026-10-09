import { chromium, expect } from '@playwright/test'
import { mkdir, writeFile, readFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { spawn } from 'node:child_process'
import assert from 'node:assert/strict'

const run = resolve(`artifacts/roadmap-${Date.now()}`), root = resolve(run, 'workspace'), data = resolve(run, 'app-data')
await mkdir(root, { recursive: true }); await mkdir(data, { recursive: true })
await writeFile(resolve(root, '写作手记.md'), '# 让想法，慢慢长出来\n\n在这里，留一处安静的空间。把今天的灵感，写成明天值得回看的文字。\n\n## 从一份笔记开始\n\n**专注于内容**，让工具退到恰好的位置。\n\n> 好的写作体验，是每一次打开都感到自在。\n\n## 今天想做的事\n\n- [x] 整理本周的写作灵感\n- [ ] 记录一个值得保留的想法\n- [ ] 写下一份新的产品笔记\n\n## 熟悉的表达方式\n\n| 功能 | 适合的场景 |\n| --- | --- |\n| 可视化编辑 | 专注写作 |\n| 分屏编辑 | 查看语法与效果 |\n| 阅读预览 | 安静地阅读 |\n')
await writeFile(resolve(root, '灵感清单.md'), '# 灵感清单\n\n从小想法开始。\n')
await writeFile(resolve(data, 'workspaces.json'), JSON.stringify([{ id: 'design', name: '我的写作空间', path: root, available: true }]))
await writeFile(resolve(data, 'preferences.json'), JSON.stringify({ defaultView: 'source', mode: 'light', autoSave: false }))
const child = spawn(resolve('src-tauri/target/debug/markflow.exe'), [], { windowsHide: true, env: { ...process.env, LEXLY_DEV_DATA_DIR: data, WEBVIEW2_USER_DATA_FOLDER: resolve(data, 'webview'), LEXLY_DEV_HEADLESS: '1', WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS: '--remote-debugging-port=9237' }, stdio: ['ignore','pipe','pipe'] })
let browser, page, logs = ''
child.stderr.on('data', b => { logs += b }); child.stdout.on('data', b => { logs += b })
try {
  for (let i = 0; i < 150; i++) { try { if ((await fetch('http://127.0.0.1:9237/json/version')).ok) break } catch {} if (child.exitCode !== null) throw new Error(logs); await new Promise(r => setTimeout(r, 100)) }
  browser = await chromium.connectOverCDP('http://127.0.0.1:9237'); page = browser.contexts()[0].pages()[0]; page.setDefaultTimeout(15000)

  const errors=[];page.on('pageerror',e=>errors.push(e.message))
  const api=(command,args={})=>page.evaluate(async({command,args})=>(await import('/src/services/api.ts')).call(command,args),{command,args})
  const model=async(operation,args={})=>page.evaluate(async({operation,args})=>{const s=(await import('/src/stores/workbench.ts')).useWorkbench();switch(operation){case 'prefs':Object.assign(s.preferences,args);await s.persistNow();return;case 'openLocal':return s.openLocal(args.paths);case 'save':return s.save(s.active);case 'refresh':return s.refresh();case 'view':s.setView(args.view);return;case 'undo':s.undo(s.active,args.redo);return;case 'active':return JSON.parse(JSON.stringify(s.active));case 'refs':return {recent:s.preferences.recentFiles,favorites:s.preferences.favorites};case 'tabs':return s.documents.map(d=>({id:d.id,path:d.path,pinned:d.pinned}));case 'reveal':return s.reveal();case 'flush':return s.flush()}},{operation,args})
  const view=label=>page.getByLabel('编辑视图').getByLabel(label,{exact:true}).click()
  const menu=async(group,item)=>{await page.getByRole('menuitem',{name:group,exact:true}).click();await page.getByRole('menuitem',{name:new RegExp('^'+item)}).click()}
  const close=async(name='关闭')=>{await page.getByRole('dialog').getByRole('button',{name,exact:true}).click();await page.getByRole('dialog').waitFor({state:'hidden'})}
  const pick=async(trigger,label)=>{await trigger.click();await page.getByRole('option',{name:label,exact:true}).click()}
  const toggle=async(name,on)=>{const s=page.getByRole('switch',{name,exact:true});if(((await s.getAttribute('aria-checked'))==='true')!==on)await s.click();await expect(s).toHaveAttribute('aria-checked',String(on))}
  await page.getByRole('button',{name:'写作手记.md',exact:true}).dblclick()
  const source=page.getByRole('textbox',{name:'Markdown 源码'})
  await expect(source).toBeVisible()
  await source.fill('before');await model('save')
  await source.fill('after');await source.press('Control+z');await expect(source).toHaveValue('before')
  await source.press('Control+Shift+z');await expect(source).toHaveValue('after')
  await view('可视化编辑');await page.locator('.vditor-ir [contenteditable=true]').waitFor();await page.keyboard.press('Control+z');await view('源码编辑');await expect(source).toHaveValue('before')
  await page.getByRole('button',{name:'编辑文档标签',exact:true}).click();await page.getByLabel('新标签',{exact:true}).fill('测试');await page.getByRole('dialog').getByRole('button',{name:'添加',exact:true}).click();await page.getByRole('button',{name:'应用标签',exact:true}).click();await page.getByRole('dialog').waitFor({state:'hidden'})
  await expect(source).toHaveValue(/tags:/);await source.press('Control+z');await expect(source).toHaveValue('before');await source.press('Control+Shift+z');await expect(source).toHaveValue(/tags:/)
  assert.equal(await model('save'),true)
  await menu('文件','历史版本');await expect(page.getByRole('dialog')).toContainText('恢复此版本');await expect.poll(async()=> (await api('list_versions',{documentId:(await model('active')).id})).length).toBeGreaterThan(1);await close()
  await source.fill('local draft');await writeFile(resolve(root,'写作手记.md'),'disk edit');await model('refresh');await expect(page.getByRole('button',{name:'比较与合并',exact:true})).toBeVisible();await page.getByRole('button',{name:'比较与合并',exact:true}).click();await expect(page.getByRole('textbox',{name:'版本比较内容',exact:true})).toHaveValue('disk edit');await page.getByRole('textbox',{name:'版本比较内容',exact:true}).fill('merged result');await page.getByRole('button',{name:'保存右侧合并结果',exact:true}).click();await page.getByRole('dialog').waitFor({state:'hidden'});assert.equal(await readFile(resolve(root,'写作手记.md'),'utf8'),'merged result')
  await model('prefs',{backupDirectory:run,backupRetention:1});await menu('文件','工作区备份与操作恢复');await page.getByRole('button',{name:'立即备份工作区',exact:true}).click();await expect(page.getByRole('dialog')).toContainText('个文件');await close()
  await menu('文件','编码与换行格式');await pick(page.getByLabel('文档编码',{exact:true}),'UTF-16LE');await toggle('使用 CRLF 换行',true);await page.getByRole('button',{name:'备份并转换格式',exact:true}).click();await page.getByRole('dialog').waitFor({state:'hidden'});const bytes=await readFile(resolve(root,'写作手记.md'));assert.equal(bytes[0],255);assert.equal(bytes[1],254);assert.equal(bytes.subarray(2).toString('utf16le'),'merged result')
  await source.fill('编码修改\nnext');await model('save');assert.equal((await readFile(resolve(root,'写作手记.md'))).subarray(2).toString('utf16le'),'编码修改\r\nnext')
  await menu('文件','编码与换行格式');await pick(page.getByLabel('文档编码',{exact:true}),'UTF-8');await toggle('使用 CRLF 换行',false);await page.getByRole('button',{name:'备份并转换格式',exact:true}).click();await page.getByRole('dialog').waitFor({state:'hidden'})
  await source.fill('');await source.pressSequentially('(');await expect(source).toHaveValue('()');await source.fill('- first');await source.press('Control+End');await source.press('Enter');await expect(source).toHaveValue('- first\n- ')
  await source.fill('');await source.pressSequentially('/');await expect(page.getByRole('listbox',{name:'斜杠命令',exact:true})).toBeVisible();await page.getByRole('option',{name:'标题',exact:true}).click();await expect(source).toHaveValue('# ')
  await source.fill('one\n\ntwo');await source.press('Control+End');await source.press('Alt+ArrowUp');await expect(source).toHaveValue('two\n\none')
  await source.fill('* item\n\n\n\n```text\n* code\n```');await menu('编辑','整理 Markdown 文本');await expect(page.getByRole('textbox',{name:'整理后',exact:true})).toHaveValue('- item\n\n\n```text\n* code\n```');await page.getByRole('button',{name:'应用整理',exact:true}).click();await page.getByRole('dialog').waitFor({state:'hidden'});await source.press('Control+z');await expect(source).toHaveValue('* item\n\n\n\n```text\n* code\n```');await model('save')
  await menu('文件','新建文档');await page.getByLabel('名称',{exact:true}).fill('模板.md');await pick(page.getByLabel('文档模板',{exact:true}),'会议记录');await page.getByRole('button',{name:'确定',exact:true}).click();await page.getByRole('dialog').waitFor({state:'hidden'});await expect(source).toHaveValue(/# 模板\n/);await model('save')
  await page.getByRole('button',{name:'灵感清单.md',exact:true}).click();assert((await model('tabs')).some(d=>d.path==='灵感清单.md'))
  await writeFile(resolve(root,'另一预览.md'),'# preview');await model('refresh');await page.getByRole('button',{name:'另一预览.md',exact:true}).click();await expect.poll(async()=>(await model('tabs')).some(d=>d.path==='灵感清单.md')).toBe(true);await page.getByRole('button',{name:'写作手记.md',exact:true}).click()
  await menu('文件','收藏当前文档');assert((await model('refs')).favorites.some(f=>f.path==='写作手记.md'));await page.getByRole('tab',{name:'写作手记.md',exact:true}).click({button:'right'});await expect(page.getByRole('menuitem',{name:'取消收藏',exact:true})).toBeVisible();await page.keyboard.press('Escape');await menu('文件','取消收藏当前文档');assert(!(await model('refs')).favorites.some(f=>f.path==='写作手记.md'));await page.getByRole('tab',{name:'写作手记.md',exact:true}).click({button:'right'});await expect(page.getByRole('menuitem',{name:'收藏文档',exact:true})).toBeVisible();await page.keyboard.press('Escape');await menu('文件','收藏当前文档');await menu('文件','收藏文档');await expect(page.getByRole('dialog')).toContainText('写作手记.md');await page.getByRole('dialog').getByRole('button',{name:'Close',exact:true}).click();await page.getByRole('dialog').waitFor({state:'hidden'})
  await page.getByRole('button',{name:'关闭 模板.md',exact:true}).click();await page.getByRole('tab',{name:'模板.md',exact:true}).waitFor({state:'hidden'});await page.keyboard.press('Control+Shift+t');await expect(page.getByRole('tab',{name:'模板.md',exact:true})).toBeVisible()
  const standalone=resolve(run,'独立文件.md');await writeFile(standalone,'# independent');await model('openLocal',{paths:[standalone]});await expect(source).toHaveValue('# independent');assert((await model('active')).workspaceId.startsWith('file-'))
  await page.getByRole('button',{name:'设置',exact:true}).click();await page.getByRole('textbox',{name:'搜索设置',exact:true}).fill('自动保存延迟');await page.getByRole('button',{name:/自动保存延迟/}).click();await expect(page.getByRole('tab',{name:'保存与备份',exact:true})).toHaveAttribute('data-state','active');await expect(page.getByRole('spinbutton',{name:'自动保存延迟',exact:true})).toBeVisible()
  await page.getByRole('tab',{name:'工具栏',exact:true}).click();await page.getByRole('switch',{name:'显示工具 bold',exact:true}).click();await page.getByRole('tab',{name:'外观',exact:true}).click();await page.getByRole('combobox',{name:'界面密度',exact:true}).click();await page.getByRole('option',{name:'紧凑',exact:true}).click();await expect(page.locator('html')).toHaveAttribute('data-density','compact')
  await page.getByRole('tab',{name:'关于',exact:true}).click();await expect(page.getByRole('textbox',{name:'更新发布地址',exact:true})).toHaveCount(0);await expect(page.getByRole('button',{name:'检查更新',exact:true})).toBeVisible();await close('完成');await view('可视化编辑');await page.waitForTimeout(300);await expect(page.locator('.lexly-format-toolbar button[data-type=bold]:visible')).toHaveCount(0)
  await page.screenshot({path:resolve(run,'verified.png')});assert.deepEqual(errors,[])
  console.log('Roadmap native verified: cross-view undo/redo, tags, history, conflict merge, workspace backups, UTF-16 conversion and preservation, syntax assist, slash commands, paragraph movement, tidy preview and undo, templates, retained tabs, favorites, reopen, standalone files, settings search, toolbar settings, density and update configuration.')
} catch(e) { if(page)await page.screenshot({path:resolve(run,'failure.png')}).catch(()=>{}); throw e } finally { await browser?.close(); child.kill() }
