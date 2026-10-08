import { maskFrontmatter } from './frontmatter'
import MarkdownIt from 'markdown-it'
const parser = new MarkdownIt({ html: false })
self.onmessage = (event: MessageEvent<string>) => {
  const tokens = parser.parse(maskFrontmatter(event.data), {}), headings: { id: string; level: number; text: string; line: number; index: number }[] = []
  tokens.forEach((token,index) => { if (token.type === 'heading_open') { const inline = tokens[index+1]; const text = inline?.children?.filter(t => ['text','code_inline','image'].includes(t.type)).map(t => t.content).join('') || inline?.content || ''; headings.push({ id: `heading-${headings.length}`, level: Number(token.tag.slice(1)), text, line: token.map?.[0] || 0, index: headings.length }) } })
  const content = tokens.filter(t => ['inline','fence','code_block'].includes(t.type)).map(t => t.content).join('\n')
  const words = (content.match(/[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}]|[\p{L}\p{N}]+/gu) || []).length
  self.postMessage({ headings, words, minutes: Math.max(1,Math.ceil(words/350)) })
}
