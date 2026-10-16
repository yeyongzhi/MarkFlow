import { extensions } from './markdown-extensions'
import MarkdownIt from 'markdown-it'
import taskLists from 'markdown-it-task-lists'
import { maskFrontmatter } from './frontmatter'
import DOMPurify from 'dompurify'

export interface Heading { id: string; level: number; text: string; line: number; index: number }
export const markdown = new MarkdownIt({ html: true, linkify: true, typographer: false }).use(taskLists).use(extensions)
markdown.core.ruler.before('normalize','frontmatter', state => { state.src = maskFrontmatter(state.src) })
markdown.renderer.rules.heading_open = (tokens, index, _options, env, self) => { const position = Number(env?.headingIndex || 0); tokens[index]!.attrSet('id', `heading-${position}`); if (env) env.headingIndex = position + 1; return self.renderToken(tokens, index, _options) }
for(const kind of ['th_open','td_open'])markdown.renderer.rules[kind]=(tokens,index,options,_env,self)=>{const token=tokens[index]!,style=String(token.attrGet('style')||''),align=/text-align:(left|center|right)/.exec(style)?.[1];if(align)token.attrSet('align',align);return self.renderToken(tokens,index,options)}
markdown.renderer.rules.image = (tokens, index) => {
  const token = tokens[index]!, url = String(token.attrGet('src') || ''), alt = token.children?.map(t => t.content).join('') || token.content
  return `<img data-markflow-url="${markdown.utils.escapeHtml(url)}" alt="${markdown.utils.escapeHtml(alt)}" loading="lazy">`
}
DOMPurify.addHook('afterSanitizeAttributes', node => {
  if (node.tagName === 'IMG') { const src = node.getAttribute('src'); if (src) node.setAttribute('data-markflow-url', src); node.removeAttribute('src') }
  if (node.tagName === 'A') { node.removeAttribute('target'); node.removeAttribute('download') }
  if (node.tagName === 'INPUT') { if (node.getAttribute('type') !== 'checkbox') node.remove(); else node.setAttribute('disabled', '') }
})
export function headings(text: string): Heading[] {
  const tokens = markdown.parse(text, {}), result: Heading[] = []
  tokens.forEach((token, i) => { if (token.type === 'heading_open') { const inline = tokens[i + 1]; const title = inline?.children?.filter(t => ['text','code_inline','image'].includes(t.type)).map(t => t.content).join('') || inline?.content || ''; result.push({ id: `heading-${result.length}`, level: Number(token.tag.slice(1)), text: title, line: token.map?.[0] || 0, index: result.length }) } })
  return result
}
export function renderMarkdown(text: string) { return DOMPurify.sanitize(markdown.render(text, { headingIndex: 0 }), { FORBID_TAGS: ['script','style','iframe','object','embed','form','button'], FORBID_ATTR: ['style'], ADD_TAGS: ['input'], ADD_ATTR: ['checked','disabled','type','align'] }) }

export function plainText(text: string) {
  const doc = new DOMParser().parseFromString(renderMarkdown(text), 'text/html')
  function extract(node: Node): string {
    if (node.nodeType === Node.TEXT_NODE) {
      const value = node.textContent || ''
      return !value.trim() && ['TABLE','THEAD','TBODY','TR','UL','OL'].includes(node.parentElement?.tagName || '') ? '' : value
    }
    if (!(node instanceof Element)) return Array.from(node.childNodes).map(extract).join('')
    if (node.tagName === 'IMG') return node.getAttribute('alt') || ''
    if (node.tagName === 'BR') return '\n'
    if (node.tagName === 'INPUT') return node.hasAttribute('checked') ? '[x] ' : '[ ] '
    const value = Array.from(node.childNodes).map(extract).join('')
    if (['TD', 'TH'].includes(node.tagName)) return value + '\t'
    if (['H1','H2','H3','H4','H5','H6','P','PRE','BLOCKQUOTE','UL','OL','LI','TR','TABLE','DIV','HR'].includes(node.tagName)) return value + '\n'
    return value
  }
  return extract(doc.body).replace(/[ \t]+\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim()
}
