import MarkdownIt from 'markdown-it'
import { frontmatter } from './frontmatter'

export interface ImageReference { start: number; end: number; raw: string; url: string; alt: string; title: string }
const parser = new MarkdownIt({ html: true })

function closing(text: string, start: number, open: string, close: string) {
  let depth = 0, quote = ''
  for (let i = start; i < text.length; i++) {
    const c = text[i]!
    if (c === '\\') { i++; continue }
    if (open === '(' && (c === '"' || c === "'") && (quote || /\s/.test(text[i - 1] || ''))) { if (!quote) quote = c; else if (quote === c) quote = ''; continue }
    if (open === '(' && c === '<' && !quote) { const end = text.indexOf('>', i + 1); if (end < 0) return -1; i = end; continue }
    if (quote) continue
    if (c === open) depth++
    if (c === close && --depth === 0) return i + 1
  }
  return -1
}

// Let Markdown's inline rules skip escapes and code spans. Keep offsets in the
// original file so repeated and reference-style images can be edited separately.
export function imageReferences(text: string): ImageReference[] {
  const meta = frontmatter(text), masked = text.split(''), env: Record<string, any> = {}
  const blank = (start: number, end: number) => { for (let i = start; i < end; i++) if (masked[i] !== '\n' && masked[i] !== '\r') masked[i] = ' ' }
  if (meta.prefix && !meta.error) blank(0, meta.prefix.length)
  const lines = [0]; for (let i = 0; i < text.length; i++) if (text[i] === '\n') lines.push(i + 1)
  for (const token of parser.parse(masked.join(''), env)) if (['fence', 'code_block', 'html_block'].includes(token.type) && token.map) blank(lines[token.map[0]]!, lines[token.map[1]] ?? text.length)
  for (const match of text.matchAll(/^ {0,3}\[[^\]\n]+\]:[^\n]*/gm)) blank(match.index!, match.index! + match[0].length)
  const content = masked.join(''), result: ImageReference[] = [], locator = new MarkdownIt()
  let section = content, offset = 0
  locator.inline.ruler.before('image', 'image_positions', (state, silent) => {
    const start = state.pos
    if (silent || state.src !== section || !state.src.startsWith('![', start)) return false
    let end = closing(section, start + 1, '[', ']'); if (end < 0) return false
    if (section[end] === '(') end = closing(section, end, '(', ')')
    else if (section[end] === '[') end = closing(section, end, '[', ']')
    if (end < 0) return false
    const children = parser.parseInline(section.slice(start, end), env)[0]?.children
    if (children?.length === 1 && children[0]!.type === 'image') {
      const token = children[0]!
      result.push({ start: start + offset, end: end + offset, raw: text.slice(start + offset, end + offset), url: String(token.attrGet('src') || ''), alt: token.children?.map(t => t.content).join('') || token.content, title: String(token.attrGet('title') || '') })
    }
    return false
  })
  // Code spans cannot continue across a blank paragraph boundary.
  for (const chunk of content.split(/(\r?\n[ \t]*\r?\n)/)) {
    section = chunk
    locator.parseInline(section, env)
    offset += chunk.length
  }
  return result
}

export function imageMarkdown(alt: string, url: string, title = '') {
  const escape = (value: string) => value.replace(/\\/g, '\\\\').replace(/[\[\]]/g, '\\$&').replace(/[\r\n]/g, ' ')
  const destination = url.replace(/</g, '%3C').replace(/>/g, '%3E').replace(/[\r\n]/g, '')
  return `![${escape(alt)}](${/[\s()]/.test(destination) ? `<${destination}>` : destination}${title ? ` "${title.replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/[\r\n]/g, ' ')}"` : ''})`
}
