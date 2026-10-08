import { describe,it,expect } from 'vitest'
import { documentTags,documentBody,maskFrontmatter,setDocumentTags } from './frontmatter'
describe('front-matter tags',()=>{
  it('adds portable tags without changing body',()=>{const text='# 正文\n';const next=setDocumentTags(text,['学习','工作']);expect(documentTags(next)).toEqual(['学习','工作']);expect(documentBody(next)).toBe(text)})
  it('preserves other fields, comments and exact body',()=>{const text='---\ntitle: "标题" # keep\ncustom:\n  nested: true\ntags: [旧标签]\n---\n# 正文\n\n';const next=setDocumentTags(text,['新标签']);expect(next).toContain('# keep');expect(next).toContain('nested: true');expect(documentBody(next)).toBe('# 正文\n\n');expect(documentTags(next)).toEqual(['新标签'])})
  it('masks metadata while preserving source line numbers',()=>{const text='---\ntags: [test]\n---\n# body';expect(maskFrontmatter(text)).toBe('\n\n\n# body')})
  it('refuses malformed metadata and incompatible tags',()=>{expect(()=>setDocumentTags('---\ntags: [bad\n---\nbody',['x'])).toThrow();expect(()=>setDocumentTags('---\ntags: {x: true}\n---\nbody',['x'])).toThrow();expect(()=>setDocumentTags('---\nunterminated',['x'])).toThrow()})
  it('handles empty metadata, scalar tags and removing the final tag',()=>{expect(documentTags('---\ntags: 学习\n---\nbody')).toEqual(['学习']);const next=setDocumentTags('---\ntitle: keep\ntags: [x]\n---\nbody',[]);expect(next).toContain('title: keep');expect(documentTags(next)).toEqual([]);expect(documentBody(next)).toBe('body')})
})
