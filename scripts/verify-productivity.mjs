import { chromium, expect } from '@playwright/test'
import assert from 'node:assert/strict'
import { readFile, mkdir } from 'node:fs/promises'
import { unzipSync, strFromU8 } from 'fflate'
const browser = await chromium.launch({channel:'msedge',headless:true}), page = await browser.newPage({viewport:{width:1440,height:900}}), errors=[]
page.on('pageerror', e=>errors.push(e.message));page.setDefaultTimeout(12000)
const action = async name => {await page.getByRole('button',{name:'文章操作',exact:true}).click();await page.getByRole('menuitem',{name}).click()}
const view = async name => page.getByLabel('编辑视图').getByLabel(name, { exact: true }).click()
try {
 await mkdir('artifacts',{recursive:true});await page.goto('http://127.0.0.1:1420');await page.getByRole('tab',{name:'欢迎.md',exact:true}).waitFor()
 await view('源码编辑');const source=page.getByRole('textbox',{name:'Markdown 源码'});await source.fill('# 搜索测试\n\nHello hello\n\n| A | B |\n| :--- | ---: |\n| one | two |\n\n```javascript\nconst a = 1\n```\n')
 await source.press('Control+f');await page.getByRole('textbox',{name:'查找内容',exact:true}).fill('hello');await expect(page.locator('.find-count')).toHaveText('1/2')
 await page.getByRole('button',{name:'下一处',exact:true}).click();assert.equal(await source.evaluate(el=>el.value.slice(el.selectionStart,el.selectionEnd)),'hello')
 await page.getByRole('textbox',{name:'替换内容',exact:true}).fill('world');await expect(page.locator('.find-count')).toHaveText('1/2');await page.getByRole('button',{name:'全部替换',exact:true}).click();await expect(source).toHaveValue(/world world/)
 await page.getByRole('button',{name:'关闭查找',exact:true}).click()
 await source.press('Control+Shift+f');await page.getByRole('textbox',{name:'工作区搜索内容',exact:true}).fill('world');await expect(page.getByRole('option')).toHaveCount(1);await page.getByRole('option').click();await expect(source).toBeFocused()
 await source.press('Control+p');await page.getByRole('textbox',{name:'搜索文件名',exact:true}).fill('写作清单');await expect(page.getByRole('option')).toHaveCount(1);await page.getByRole('textbox',{name:'搜索文件名',exact:true}).press('Enter');await page.getByRole('tab',{name:'写作清单.md',exact:true}).waitFor();await page.getByRole('tab',{name:'欢迎.md',exact:true}).click()
 await action('进入专注模式');await expect(page.locator('.workspace-sidebar')).toBeHidden();await page.keyboard.press('Escape');await expect(page.locator('.workspace-sidebar')).toBeVisible()
 await action('编辑表格');await page.getByRole('combobox',{name:'编辑对象',exact:true}).click();await page.getByRole('option',{name:/第 1 个表格/}).click();await page.getByRole('textbox',{name:'表格第 2 行第 1 列',exact:true}).fill('updated');await page.getByRole('button',{name:'添加行',exact:true}).click();await page.getByRole('button',{name:'添加列',exact:true}).click();await page.getByRole('button',{name:'应用',exact:true}).click();await expect(source).toHaveValue(/updated/);assert.equal((await source.inputValue()).match(/\|/g).length,16)
 await action('编辑代码块');await page.getByRole('combobox',{name:'编辑对象',exact:true}).click();await page.getByRole('option',{name:/第 1 个代码块/}).click();await page.getByRole('combobox',{name:'代码语言',exact:true}).click();await page.getByRole('option',{name:'typescript',exact:true}).click();await page.getByRole('button',{name:'应用',exact:true}).click();await expect(source).toHaveValue(/```typescript/)
 await source.press('Control+End')
 await source.evaluate(el => { const canvas=document.createElement('canvas');canvas.width=canvas.height=40;canvas.getContext('2d').fillStyle='#0d9488';canvas.getContext('2d').fillRect(0,0,40,40);const bytes=Uint8Array.from(atob(canvas.toDataURL('image/png').split(',')[1]),c=>c.charCodeAt(0));const transfer=new DataTransfer();transfer.items.add(new File([bytes],'fixture.png',{type:'image/png'}));el.dispatchEvent(new ClipboardEvent('paste',{bubbles:true,clipboardData:transfer})) })
 await expect(source).toHaveValue(/assets\/.*\.png/)
 // Export HTML, ZIP and PDF via their actual dialogs, including browser download delivery.
 for(const format of ['html','zip','pdf']) {
   await action('导出文档');await page.getByRole('combobox',{name:'导出格式',exact:true}).click();await page.getByRole('option',{name:{html:'独立 HTML 页面',zip:'Markdown 与图片 ZIP',pdf:'PDF 文档'}[format],exact:true}).click()
   const downloadPromise=page.waitForEvent('download',{timeout:40000});await page.getByRole('button',{name:'导出',exact:true}).click();const download=await downloadPromise;const path=`artifacts/productivity-export.${format}`;await download.saveAs(path);const bytes=await readFile(path)
   if(format==='html'){assert(bytes.toString().includes('world world'));assert(bytes.toString().includes('Content-Security-Policy'));assert(bytes.toString().includes('src="data:image/png;base64,'))}
   if(format==='zip'){const files=unzipSync(bytes);assert(strFromU8(files['欢迎.md']).includes('```typescript'));assert.equal(Object.keys(files).length,2)}
   if(format==='pdf'){assert(bytes.subarray(0,5).toString()==='%PDF-');assert(bytes.length>10000)}
   await page.getByRole('dialog').waitFor({state:'hidden'})
 }
 await source.fill(Array.from({length:220},(_,i)=>`## Section ${i}\n\nParagraph ${i} body text.\n`).join('\n'));await view('分屏编辑');const preview=page.locator('.document-panel:visible .markdown-body');await expect(preview.locator('h2')).toHaveCount(220)
 await source.evaluate(el=>{el.scrollTop=(el.scrollHeight-el.clientHeight)*.6;el.dispatchEvent(new Event('scroll'))});await expect.poll(()=>preview.evaluate(el=>el.scrollTop/(el.scrollHeight-el.clientHeight))).toBeCloseTo(.6,1)
 await action('导出文档');const multipage=page.waitForEvent('download',{timeout:60000});await page.getByRole('button',{name:'导出',exact:true}).click();await (await multipage).saveAs('artifacts/productivity-multipage.pdf');assert((await readFile('artifacts/productivity-multipage.pdf')).toString('latin1').match(/\/Type \/Page\b/g).length>1);await page.getByRole('dialog').waitFor({state:'hidden'})
 await view('源码编辑');await source.evaluate(el=>{el.setSelectionRange(0,10);el.focus();document.dispatchEvent(new Event('selectionchange'))});await expect(page.locator('.status-details')).toContainText('选中 10 字符')
 await page.screenshot({path:'artifacts/markflow-productivity.png'});assert.deepEqual(errors,[]);console.log('Productivity verified: find/replace, workspace search, quick open, focus, table rows/columns, code languages, HTML/ZIP/PDF, synchronized scrolling, selection statistics.')
} catch(e){await page.screenshot({path:'artifacts/productivity-failure.png'});console.log('Runtime errors:',errors);throw e} finally{await browser.close()}
