import { describe,it,expect } from 'vitest'
import MarkdownIt from 'markdown-it'
import { extensions,tableOfContents } from '../src/services/markdown-extensions'
import { setDocumentField,documentTags } from '../src/services/frontmatter'
const md=new MarkdownIt().use(extensions)
describe('extended Markdown preservation',()=>{
 it('recognizes links, formulas, footnotes and callouts while leaving code untouched',()=>{const raw='[[folder/文档#章节|链接]] $x^2$\n\n$$\na+b\n$$\n\n注释[^1]\n\n[^1]: 内容\n\n> [!NOTE]\n> 提示\n\n`[[unchanged]] $code$`\n';const value=md.render(raw);expect(value).toContain('data-wiki="folder/文档#章节"');expect(value).toContain('data-math="x^2"');expect(value).toContain('data-display="true"');expect(value).toContain('footnote-ref');expect(value).toContain('callout-note');expect(value).toContain('<code>[[unchanged]] $code$</code>')})
 it('does not treat escaped money and unmatched delimiters as formulas',()=>{expect(md.render('\\$20 and $30 or $unfinished')).not.toContain('data-math')})
 it('generates selected TOC levels with the original heading indexes',()=>{expect(tableOfContents(md,'# Title\n## Sub\n### Child\n',2,3)).toBe('- [Sub](#heading-1)\n  - [Child](#heading-2)')})
 it('updates status while preserving other metadata and body',()=>{const value=setDocumentField('---\ntags: [one]\ncustom: keep\n---\n# 文档\n','status','进行中');expect(documentTags(value)).toEqual(['one']);expect(value).toContain('custom: keep');expect(value).toContain('status: 进行中');expect(value).toContain('---\n# 文档\n')})
})
