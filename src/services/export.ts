import katexStyles from 'katex/dist/katex.min.css?inline'
import { decorateRichContent } from './rich-content'
import { call } from './api'
import { renderMarkdown } from './markdown'
import type { Document } from '@/types'
export interface ExportOptions { paper: 'a4' | 'letter'; margin: number; size: number; numbers: boolean; font?: string }
const css = `body{color:#202b30;background:white;font-family:system-ui,'Microsoft YaHei','PingFang SC',sans-serif;line-height:1.75;overflow-wrap:anywhere}article{max-width:900px;margin:auto}h1,h2{border-bottom:1px solid #ddd;padding-bottom:.3em}pre{white-space:pre-wrap;background:#f4f5f6;padding:16px;border-radius:6px}code{font-family:ui-monospace,monospace}img{max-width:100%;height:auto}table{border-collapse:collapse;width:100%}th,td{border:1px solid #ddd;padding:8px}blockquote{border-left:3px solid #aaa;margin-left:0;padding-left:16px}a{color:#245ca6}input{accent-color:#245ca6}.callout{border-left:4px solid #277c62;border-radius:8px;padding:8px 16px;background:#f1f8f5}.callout-warning,.callout-caution{border-color:#b7791f;background:#fff9ed}.hljs-keyword,.hljs-meta{color:#8550a5}.hljs-string,.hljs-attr{color:#277c62}.hljs-number,.hljs-literal{color:#a34b20}.hljs-comment{color:#69747d}.hljs-title,.hljs-built_in{color:#326bc0}`
function base64(bytes: Uint8Array) { let binary = ''; for (let i = 0; i < bytes.length; i += 32768) binary += String.fromCharCode(...bytes.subarray(i, i + 32768)); return btoa(binary) }
async function prepared(d: Document) {
  const element = document.createElement('article'); element.innerHTML = renderMarkdown(d.text)
  await decorateRichContent(element,{exporting:true,highlight:true});
  for(const code of element.querySelectorAll('pre[data-rendered="true"] code.language-mermaid'))code.parentElement?.remove();
  const assets = new Map<string, string>(); let total = 0
  for (const img of element.querySelectorAll<HTMLImageElement>('img')) {
    const url = img.dataset.lexlyUrl || ''; let data = assets.get(url)
    if (!data) { data = await call<string>('resolve_image', { documentId: d.id, url }); if (!data) throw new Error(`图片无法导出：${url}`); total += data.length; if (total > 90 * 1024 * 1024) throw new Error('图片总量过大，请减少图片后导出。'); assets.set(url, data) }
    img.src = data; img.removeAttribute('loading'); delete img.dataset.lexlyUrl
  }
  for(const svg of element.querySelectorAll<SVGSVGElement>('.mermaid-diagram svg')){const view=svg.viewBox.baseVal;svg.setAttribute('width',String(view.width||800));svg.setAttribute('height',String(view.height||400));const img=document.createElement('img');img.alt='Mermaid 图表';img.src='data:image/svg+xml;base64,'+base64(new TextEncoder().encode(new XMLSerializer().serializeToString(svg)));svg.replaceWith(img)}
  return { element, assets }
}
let fontCss:Promise<string>|undefined
async function mathCss(){return fontCss||= (async()=>{let result=katexStyles;const urls=[...new Set(Array.from(result.matchAll(/url\(([^)]+)\)/g),m=>m[1]!.replace(/['"]/g,'')))];for(const url of urls){if(url.startsWith('data:'))continue;const response=await fetch(url);if(!response.ok)throw new Error('公式字体加载失败，请重试导出');const bytes=new Uint8Array(await response.arrayBuffer());result=result.split(url).join('data:'+(url.includes('.woff2')?'font/woff2':url.includes('.woff')?'font/woff':'font/ttf')+';base64,'+base64(bytes))}return result})().catch(e=>{fontCss=undefined;throw e})}
export async function renderExportHtml(d:Document,options:ExportOptions,preparedElement?:HTMLElement,preparedCss?:string){
 const element=preparedElement||(await prepared(d)).element,contentCss=preparedCss??(css+(d.text.includes('$')?await mathCss():''));const font=JSON.stringify(options.font||'system-ui').replaceAll('<','\\3c '),title=d.path.split('/').at(-1)!.replace(/[&<>"']/g,c=>`&#${c.charCodeAt(0)};`)
 return `<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src data:; style-src 'unsafe-inline'; font-src data:"><title>${title}</title><style>${contentCss}body{padding:32px;font-size:${options.size}px;font-family:${font},system-ui,sans-serif}</style></head><body>${element.outerHTML}</body></html>`
}
export async function renderExportBytes(d: Document, format: 'html' | 'pdf' | 'zip', options: ExportOptions) {
  const font = JSON.stringify(options.font || 'system-ui').replaceAll('<', '\\3c ')
  const { element, assets } = await prepared(d)
  const contentCss=css+(d.text.includes('$')?await mathCss():'')
  let bytes: Uint8Array
  if (format === 'html') {
    bytes = new TextEncoder().encode(await renderExportHtml(d,options,element,contentCss))
  } else if (format === 'zip') {
    const { zip, strToU8 } = await import('fflate'), files: Record<string, Uint8Array> = { [d.path]: strToU8(d.text) }
    for (const [url, data] of assets) {
      const path = d.path.split('/').slice(0, -1)
      for (const part of decodeURIComponent(url.split('#')[0]!).split('/')) { if (part === '..') { if (!path.length) throw new Error('图片路径超出工作区。'); path.pop() } else if (part && part !== '.') path.push(part) }
      const name = path.join('/'); if (!name || name === d.path || /[\\:]/.test(name)) throw new Error('图片路径无法打包。')
      files[name] = Uint8Array.from(atob(data.split(',')[1]!), c => c.charCodeAt(0))
    }
    bytes = await new Promise<Uint8Array>((resolve, reject) => zip(files, { level: 6 }, (err, value) => err ? reject(err) : resolve(value)))
  } else {
    const [{ default: html2canvas }, { jsPDF }] = await Promise.all([import('html2canvas'), import('jspdf')])
    const pdf = new jsPDF({ unit: 'mm', format: options.paper, compress: true }), width = pdf.internal.pageSize.getWidth(), height = pdf.internal.pageSize.getHeight(), margin = options.margin
    const contentWidth = width - margin * 2, contentHeight = height - margin * 2 - (options.numbers ? 8 : 0), pixels = 96 / 25.4, pageHeight = Math.floor(contentHeight * pixels)
    const frame = document.createElement('iframe'); frame.title = '导出渲染'; frame.style.cssText = `position:fixed;left:-100000px;top:0;width:${contentWidth * pixels}px;height:800px;border:0;pointer-events:none`
    document.body.append(frame)
    try {
      const doc = frame.contentDocument!; doc.open(); doc.write(`<!doctype html><html><head><style>${contentCss}article{display:flow-root;margin:0}body{display:flow-root;margin:0;font-size:${options.size}px;font-family:${font},system-ui,sans-serif}img{max-height:${pageHeight - 16}px;object-fit:contain}</style></head><body></body></html>`); doc.close(); doc.body.append(element)
      await doc.fonts.ready
      await Promise.all(Array.from(element.querySelectorAll('img')).map(img => img.decode().catch(() => { throw new Error('图片解码失败，无法导出 PDF。') })))
      // Choose whitespace between text lines, rows and images instead of cutting a line in half.
      const origin = element.getBoundingClientRect().top, boxes: { top: number; bottom: number }[] = [], walker = doc.createTreeWalker(element, NodeFilter.SHOW_TEXT)
      while (walker.nextNode()) { const node = walker.currentNode; if (!node.textContent?.trim()) continue; const range = doc.createRange(); range.selectNodeContents(node); for (const rect of range.getClientRects()) boxes.push({ top: rect.top - origin, bottom: rect.bottom - origin }) }
      element.querySelectorAll('img,tr,p,h1,h2,h3,h4,h5,h6,li,pre').forEach(node => { const r = node.getBoundingClientRect(); if (r.height < pageHeight * .9) boxes.push({ top: r.top-origin, bottom: r.bottom-origin }) })
      boxes.sort((a,b) => a.top-b.top)
      let boxIndex = 0, bottom = 0
      const candidates = [...new Set(boxes.map(box => Math.ceil(box.bottom)+12))].sort((a,b) => a-b).filter(y => { while (boxIndex < boxes.length && boxes[boxIndex]!.top < y) bottom = Math.max(bottom,boxes[boxIndex++]!.bottom); return bottom <= y }), slices: { start: number; height: number }[] = []
      const totalHeight = Math.max(1,element.scrollHeight)
      for (let start = 0; start < totalHeight; ) {
        let end = Math.min(start+pageHeight,totalHeight)
        if (end < totalHeight) { const safe = candidates.filter(y => y > start + pageHeight*.45 && y <= end); if (safe.length) end = safe.at(-1)! }
        slices.push({ start, height: Math.max(1,end-start) }); start = end
        if (slices.length > 100) throw new Error('PDF 超过 100 页，请拆分文档后导出。')
      }
      for (let page = 0; page < slices.length; page++) {
        const slice = slices[page]!
        const canvas = await html2canvas(element, { backgroundColor: '#ffffff', scale: 2, width: contentWidth * pixels, height: slice.height, y: slice.start, logging: false })
        if (page) pdf.addPage(); pdf.addImage(canvas.toDataURL('image/png'), 'PNG', margin, margin, contentWidth, slice.height / pixels, undefined, 'FAST')
        if (options.numbers) { pdf.setFontSize(9); pdf.text(`${page + 1} / ${slices.length}`, width / 2, height - margin / 2, { align: 'center' }) }
        canvas.width = canvas.height = 0
      }
      const bounds=element.getBoundingClientRect()
      for(const link of element.querySelectorAll<HTMLAnchorElement>('a[href]')){const href=link.getAttribute('href')||'';if(!href.startsWith('#')||href==='#')continue;let id:string;try{id=decodeURIComponent(href.slice(1))}catch{continue}const target=element.querySelector<HTMLElement>(`[id="${CSS.escape(id)}"]`);if(!target)continue;const destY=target.getBoundingClientRect().top-bounds.top,destination=slices.findIndex(s=>destY>=s.start&&destY<s.start+s.height);if(destination<0)continue;for(const rect of link.getClientRects()){const top=rect.top-bounds.top;const page=slices.findIndex(s=>top>=s.start&&top<s.start+s.height);if(page<0)continue;pdf.setPage(page+1);pdf.link(margin+(rect.left-bounds.left)/pixels,margin+(top-slices[page]!.start)/pixels,rect.width/pixels,rect.height/pixels,{pageNumber:destination+1,top:margin+(destY-slices[destination]!.start)/pixels})}}
      bytes = new Uint8Array(pdf.output('arraybuffer'))
    } finally { frame.remove() }
  }
  if (bytes.length > 100 * 1024 * 1024) throw new Error('导出文件不能超过 100MiB。')
  return bytes
}

export async function exportDocument(d:Document,format:'html'|'pdf'|'zip',options:ExportOptions){const bytes=await renderExportBytes(d,format,options);return call<boolean>('export_file',{documentId:d.id,format,data:base64(bytes)})}
