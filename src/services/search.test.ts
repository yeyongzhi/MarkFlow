import { describe, expect, it } from 'vitest'
import { findMatches, replaceMatches } from './search'
describe('document search', () => {
  it('treats metacharacters literally and respects case', () => { expect(findMatches('A.b a.B', 'a.b').length).toBe(2); expect(findMatches('A.b a.B', 'a.b', true)).toEqual([]) })
  it('replaces all from the end without shifting ranges', () => { const s = 'cat cat cat'; expect(replaceMatches(s, findMatches(s,'cat',false,false,'longer'))).toBe('longer longer longer') })
  it('preserves lookbehind context and capture replacements', () => { const s = 'a12 b34'; expect(replaceMatches(s, findMatches(s,'(?<=a)(\\d+)',true,true,'[$1]'))).toBe('a[12] b34') })
  it('handles named groups, Unicode and zero length matches', () => { expect(replaceMatches('你好',findMatches('你好','(?<c>你)',false,true,'$<c>们'))).toBe('你们好'); expect(findMatches('ab','(?=.)',false,true).length).toBe(2) })
  it('rejects malformed and excessive matches', () => { expect(() => findMatches('a','[',false,true)).toThrow(); expect(() => findMatches('a'.repeat(6000),'a')).toThrow() })
})
