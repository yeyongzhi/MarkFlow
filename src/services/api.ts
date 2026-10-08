import { invoke, isTauri } from '@tauri-apps/api/core'
import type { DiskDocument, Workspace } from '@/types'

export const desktop = isTauri()
// Explicitly labelled browser preview. Desktop always uses the real Rust file service.
const sample = `# 给想法一个安静的地方\n\n欢迎来到 **MarkFlow**。这是浏览器中的示例工作区；桌面版直接打开你的本地文件夹。\n\n## 从一份笔记开始\n\n在左侧打开文档，在上方切换编辑视图。写下的内容会自动保存，右侧的大纲让长文档也容易导航。\n\n> 好的工具，让注意力回到内容本身。\n\n### 今天想做的事\n\n- [x] 建立自己的工作区\n- [ ] 记录一个值得保留的想法\n- [ ] 整理最近的学习笔记\n\n## Markdown，熟悉的表达方式\n\n你可以使用 *强调*、**粗体**、~~删除线~~ 和 \`行内代码\`。\n\n| 视图 | 适合的场景 |\n| --- | --- |\n| 所见即所得 | 专注写作 |\n| 源码 | 精确调整语法 |\n| 分屏 | 一边编辑，一边预览 |\n| 预览 | 安静地阅读 |\n\n### 代码也有自己的位置\n\n\`\`\`javascript\nconst idea = { title: '一个新的开始', done: false }\nconsole.log(idea.title)\n\`\`\`\n\n## 下一站\n\n试着打开 [写作清单](写作清单.md)，或者在设置里找到适合你的字体与配色。\n`
const files = new Map<string, string>([['欢迎.md', sample], ['写作清单.md', '# 写作清单\n\n## 本周\n\n- [ ] 一篇技术笔记\n- [ ] 一个产品想法\n\n## 灵感\n\n让文字慢慢长出来。\n'], ['笔记/语法参考.md', '# Markdown 语法参考\n\n## 基础\n\n**粗体** 与 *斜体*。\n\n---\n\n## 引用\n\n> 可以嵌套引用。\n\n## 列表\n\n1. 第一项\n2. 第二项\n']])
const dirs = new Set(['笔记', 'assets'])
const docs = new Map<string, DiskDocument>()
const archived = new Map<string, {id:string;originalPath:string;archivedAt:number;text:string}>()
const images = new Map<string, string>()
const workspace: Workspace = { id: 'demo', name: '示例工作区', path: '浏览器预览 · 示例数据', available: true }
const hash = (s: string) => s // In-memory demo identity; real files use SHA-256 in Rust.
function demo(command: string, a: Record<string, any>): any {
  switch (command) {
    case 'bootstrap': { let prefs = {}; try { prefs = JSON.parse(localStorage.getItem('lexly-preview-settings') || '{}') } catch {} return { workspaces: [workspace], preferences: prefs, drafts: [], pendingOperations: 0 } }
    case 'select_workspace': throw { message: '请启动桌面版，通过系统目录选择器添加真实工作区。' }
    case 'archive_document': { if (!files.has(a.path)) throw new Error('文档已不存在'); const id=crypto.randomUUID();archived.set(id,{id,originalPath:a.path,archivedAt:Date.now(),text:files.get(a.path)!});files.delete(a.path);for(const d of docs.values())if(d.path===a.path)docs.delete(d.id);return }
    case 'list_archives': return [...archived.values()].map(({text,...entry})=>entry)
    case 'restore_archive': { const entry=archived.get(a.id);if(!entry)throw new Error('归档不存在');let path=entry.originalPath,index=1;while(files.has(path))path=entry.originalPath.replace(/\.md$/i,`（恢复${index++}）.md`);files.set(path,entry.text);const parts=path.split('/').slice(0,-1);for(let i=1;i<=parts.length;i++)dirs.add(parts.slice(0,i).join('/'));archived.delete(a.id);return path }
    case 'delete_archive': if(!archived.has(a.id))throw new Error('归档不存在');archived.delete(a.id);return
    case 'tag_candidates': return [...files].map(([path,text])=>({workspaceId:'demo',path,text,hash:hash(text)})).concat([...archived.values()].map(e=>({workspaceId:'demo',path:`.lexly-archive/${e.id}/document.md`,text:e.text,hash:hash(e.text)})))
    case 'apply_tag_changes': { for(const c of a.changes){const entry=c.path.startsWith('.lexly-archive/')?archived.get(c.path.split('/')[1]):undefined;const text=entry?entry.text:files.get(c.path);if(text!==c.expectedHash)throw new Error('文档已变化');}const updated:DiskDocument[]=[];for(const c of a.changes){const entry=archived.get(c.path.split('/')[1]);if(c.path.startsWith('.lexly-archive/')&&entry)entry.text=c.text;else files.set(c.path,c.text);for(const d of docs.values())if(d.path===c.path){d.text=c.text;d.hash=hash(c.text);updated.push({...d})}}return updated }
    case 'open_in_system_directory': throw { message: '请在桌面版中打开真实系统目录。' }
    case 'data_directory': return '浏览器预览 · 设置保存在 localStorage'
    case 'open_data_directory': throw { message: '请在桌面版中打开数据目录。' }
    case 'search_workspace': {
      const q = a.sensitive ? a.query : a.query.toLowerCase(), hits: { workspaceId: string; path: string; line: number; snippet: string }[] = []
      for (const [path, text] of files) {
        if (!a.content) { if ((a.sensitive ? path : path.toLowerCase()).includes(q)) hits.push({ workspaceId: 'demo', path, line: 1, snippet: '' }); continue }
        text.split('\n').forEach((line, index) => { if ((a.sensitive ? line : line.toLowerCase()).includes(q)) hits.push({ workspaceId: 'demo', path, line: index + 1, snippet: line.slice(0, 160) }) })
      }
      return { hits: hits.slice(0, 300), truncated: hits.length > 300, skipped: 0 }
    }
    case 'export_file': { const bytes = Uint8Array.from(atob(a.data), c => c.charCodeAt(0)); const url = URL.createObjectURL(new Blob([bytes])); const link = document.createElement('a'); link.href = url; link.download = docs.get(a.documentId)!.path.split('/').at(-1)!.replace(/\.md$/i, '') + '.' + a.format; link.click(); setTimeout(() => URL.revokeObjectURL(url), 1000); return true }
    case 'document_metadata': return { createdAt: null, modifiedAt: null }
    case 'list_directory': {
      const prefix = a.path ? `${a.path}/` : ''
      return [...dirs].filter(p => p.startsWith(prefix) && !p.slice(prefix.length).includes('/')).map(path => ({ name: path.slice(prefix.length), path, isDir: true })).concat([...files.keys()].filter(p => p.startsWith(prefix) && !p.slice(prefix.length).includes('/')).map(path => ({ name: path.slice(prefix.length), path, isDir: false })))
    }
    case 'open_document': {
      if (!files.has(a.path)) throw { code: 'MISSING', message: '文档已不存在' }
      const existing = [...docs.values()].find(d => d.path === a.path)
      const d = { id: existing?.id || crypto.randomUUID(), workspaceId: 'demo', path: a.path, text: files.get(a.path)!, hash: hash(files.get(a.path)!), bom: false, crlf: false }
      docs.set(d.id, d); return { ...d }
    }
    case 'check_document': { const d = docs.get(a.documentId)!; if (!files.has(d.path)) throw { code: 'MISSING', message: '文档已不存在' }; return hash(files.get(d.path)!) }
    case 'save_document': { const d = docs.get(a.documentId)!; if (hash(files.get(d.path)!) !== a.expectedHash) throw { code: 'CONFLICT', message: '文档已被修改' }; files.set(d.path, a.text); d.hash = hash(a.text); return { hash: d.hash, revision: a.revision } }
    case 'close_document': docs.delete(a.documentId); return
    case 'write_recovery': case 'discard_recovery': return
    case 'save_preferences': localStorage.setItem('lexly-preview-settings', JSON.stringify(a.preferences)); return
    case 'create_entry': { const path = [a.parent, a.name].filter(Boolean).join('/'); if (files.has(path) || dirs.has(path)) throw { message: '已存在同名对象' }; if (a.isDir) dirs.add(path); else files.set(path, ''); return path }
    case 'relocate_entry': {
      const newPath = [a.destination, a.name || a.path.split('/').at(-1)].filter(Boolean).join('/'); if (files.has(newPath) || dirs.has(newPath)) throw { message: '目标已存在' }
      for (const [path, text] of [...files]) if (path === a.path || path.startsWith(`${a.path}/`)) { files.delete(path); files.set(newPath + path.slice(a.path.length), text) }
      for (const path of [...dirs]) if (path === a.path || path.startsWith(`${a.path}/`)) { dirs.delete(path); dirs.add(newPath + path.slice(a.path.length)) }
      const updated: DiskDocument[] = []; for (const d of docs.values()) if (d.path === a.path || d.path.startsWith(`${a.path}/`)) { d.path = newPath + d.path.slice(a.path.length); updated.push({ ...d }) }
      return { oldPath: a.path, newPath, documents: updated }
    }
    case 'trash_entry': for (const path of [...files.keys()]) if (path === a.path || path.startsWith(`${a.path}/`)) files.delete(path); dirs.delete(a.path); return
    case 'remove_workspace': return
    case 'import_image': { const path = `assets/${crypto.randomUUID()}.png`; images.set(path, `data:image/png;base64,${a.data}`); const doc = docs.get(a.documentId)!; return (doc.path.includes('/') ? '../' : '') + path }
    case 'resolve_image': { const key = a.url.replace(/^\.\.\//, ''); return images.get(key) || '' }
    case 'resolve_markdown_link': { const doc = docs.get(a.documentId)!; const base = doc.path.split('/').slice(0, -1); for (const part of decodeURIComponent(a.url).split('/')) { if (part === '..') base.pop(); else if (part !== '.') base.push(part) }; return base.join('/') }
    case 'save_document_as': { const blob = new Blob([a.text], { type: 'text/markdown;charset=utf-8' }); const link = document.createElement('a'); link.href = URL.createObjectURL(blob); link.download = docs.get(a.documentId)!.path.split('/').at(-1)!; link.click(); URL.revokeObjectURL(link.href); return true }
    default: throw new Error(`Unknown preview command: ${command}`)
  }
}
export async function call<T>(command: string, args: Record<string, unknown> = {}): Promise<T> { return desktop ? invoke<T>(command, args) : demo(command, args) }
export function message(e: unknown) { return typeof e === 'object' && e && 'message' in e ? String(e.message) : String(e) }
export function code(e: unknown) { return typeof e === 'object' && e && 'code' in e ? String(e.code) : 'ERROR' }
