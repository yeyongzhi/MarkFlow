export interface Match { start: number; end: number; value: string; replacement: string }
export function findMatches(text: string, query: string, sensitive = false, regex = false, replacement = ''): Match[] {
  if (!query) return []
  const pattern = regex ? query : query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const re = new RegExp(pattern, sensitive ? 'gu' : 'giu'), matches: Match[] = []
  let replacementSize = 0
  for (const m of text.matchAll(re)) {
    if (matches.length >= 5000) throw new Error('匹配超过 5000 处，请缩小搜索范围。')
    const value = regex ? replacement.replace(/\$(\$|&|`|'|\d{1,2}|<[^>]+>)/g, (literal, key: string) => {
      if (key === '$') return '$'
      if (key === '&') return m[0]
      if (key === '`') return text.slice(0, m.index)
      if (key === "'") return text.slice(m.index + m[0].length)
      if (key.startsWith('<')) return m.groups ? m.groups[key.slice(1,-1)] || '' : literal
      const number = Number(key)
      if (number > 0 && number < m.length) return m[number] || ''
      if (key.length === 2 && Number(key[0]) > 0 && Number(key[0]) < m.length) return (m[Number(key[0])] || '') + key[1]
      return literal
    }) : replacement
    replacementSize += value.length
    if (replacementSize > 20 * 1024 * 1024) throw new Error('替换内容总量过大，请缩小范围。')
    matches.push({ start: m.index, end: m.index + m[0].length, value: m[0], replacement: value })
  }
  return matches
}
export function replaceMatches(text: string, matches: Match[]) {
  const parts: string[] = []; let position = 0
  for (const match of matches) { parts.push(text.slice(position,match.start),match.replacement); position = match.end }
  parts.push(text.slice(position)); return parts.join('')
}
