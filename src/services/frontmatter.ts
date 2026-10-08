import { isMap, parseDocument } from 'yaml'
export function frontmatter(text: string) {
  const opening = /^---[ \t]*\r?\n/.exec(text)
  if (!opening) return { prefix: '', body: text, yaml: '', error: '' }
  const ending = /^(?:---|\.\.\.)[ \t]*(?:\r?\n|$)/gm; ending.lastIndex = opening[0].length
  const close = ending.exec(text)
  if (!close) return { prefix: '', body: text, yaml: '', error: 'front-matter 缺少结束分隔线。' }
  const yaml = text.slice(opening[0].length,close.index), prefix = text.slice(0,close.index+close[0].length)
  if (yaml.length > 65536) return { prefix, body: text.slice(prefix.length), yaml, error: 'front-matter 超过 64KiB，暂不支持修改标签。' }
  const doc = parseDocument(yaml, { uniqueKeys: true })
  const error = doc.errors.length ? 'front-matter 的 YAML 格式有误，请先在源码中修正。' : doc.contents && !isMap(doc.contents) ? 'front-matter 必须是键值映射。' : ''
  return { prefix, body: text.slice(prefix.length), yaml, error }
}
export function documentBody(text: string) { const value = frontmatter(text); return value.error ? text : value.body }
export function maskFrontmatter(text: string) { const value = frontmatter(text); return !value.prefix || value.error ? text : '\n'.repeat((value.prefix.match(/\n/g) || []).length) + value.body }
export function documentTags(text: string): string[] {
  const value = frontmatter(text); if (value.error || !value.prefix) return []
  try { const tags = parseDocument(value.yaml).toJS({maxAliasCount:50})?.tags; if (typeof tags === 'string') return [tags]; if (Array.isArray(tags)) return [...new Set(tags.filter((tag): tag is string => typeof tag === 'string' && !!tag.trim()))]; return [] } catch { return [] }
}
export function setDocumentTags(text: string, tags: string[]) {
  const value = frontmatter(text); if (value.error) throw new Error(value.error)
  const normalized = [...new Set(tags.map(tag => tag.trim()))]
  if (normalized.length > 100 || normalized.some(tag => !tag || tag.length > 40 || /[\r\n\x00-\x1f]/.test(tag))) throw new Error('标签最多 100 个，每个 1–40 字符。')
  const doc = parseDocument(value.yaml || '')
  const old = doc.toJS({maxAliasCount:50})?.tags
  if (old !== undefined && typeof old !== 'string' && (!Array.isArray(old) || old.some(tag => typeof tag !== 'string'))) throw new Error('已有 tags 字段不是字符串或字符串数组，请先在源码中修正。')
  if (normalized.length) doc.set('tags', normalized); else doc.delete('tags')
  if (!value.prefix && !normalized.length) return text
  return `---\n${doc.toString()}---\n${value.body}`
}

export function setDocumentField(text:string,key:string,value:string){const fm=frontmatter(text);if(fm.error)throw new Error(fm.error);const doc=parseDocument(fm.yaml||'');doc.set(key,value);return `---
${doc.toString()}---
${fm.body}`}
