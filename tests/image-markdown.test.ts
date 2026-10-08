import { describe, expect, it } from 'vitest'
import { imageReferences, imageMarkdown } from '../src/services/image-markdown'

describe('image source positions', () => {
  it('locates repeated references separately without touching code or metadata', () => {
    const text = '---\ncover: "![cover](assets/a.png)"\n---\n\n`![code](assets/a.png)`\n\n```md\n![code](assets/a.png)\n```\n\n![first](assets/a.png) ![second](assets/a.png)'
    const refs = imageReferences(text)
    expect(refs.map(r => r.alt)).toEqual(['first', 'second'])
    expect(text.slice(refs[1]!.start, refs[1]!.end)).toBe('![second](assets/a.png)')
  })
  it('handles reference images in lists and tables without changing shared definitions', () => {
    const text = '> - ![first][photo]\n\n| Image |\n| --- |\n| ![second][photo] |\n\n[photo]: assets/a.png "Caption"\n'
    const refs = imageReferences(text)
    expect(refs.map(r => [r.url, r.title])).toEqual([['assets/a.png', 'Caption'], ['assets/a.png', 'Caption']])
    const next = text.slice(0, refs[1]!.start) + imageMarkdown('new', 'assets/b.png') + text.slice(refs[1]!.end)
    expect(next).toContain('![first][photo]')
    expect(next).toContain('[photo]: assets/a.png "Caption"')
  })
  it('round trips escaped descriptions, spaces, parentheses and image titles', () => {
    const value = imageMarkdown('a [b] \\ c', 'assets/a (b).png', 'a "caption"')
    const refs = imageReferences(value)
    expect(refs).toHaveLength(1)
    expect(refs[0]).toMatchObject({ alt: 'a [b] \\ c', url: 'assets/a%20(b).png', title: 'a "caption"', start: 0, end: value.length })
    expect(imageReferences("![test](assets/foo's.png)")).toHaveLength(1)
  })
  it('skips escaped images and handles shortcut and collapsed references', () => {
    expect(imageReferences('\\![fake](a.png)\n\n![photo][] ![photo]\n\n[photo]: a.png').map(r => r.raw)).toEqual(['![photo][]', '![photo]'])
  })
  it('does not pair unmatched code ticks across separate paragraphs', () => {
    expect(imageReferences('A `\n\n![visible](a.png)\n\nB `').map(r => r.alt)).toEqual(['visible'])
  })
})
