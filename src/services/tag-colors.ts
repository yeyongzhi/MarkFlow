import { readableText } from './theme'

export function tagColor(colors: Record<string, string>, tag: string) {
  const color = colors[tag]
  return color && /^#[0-9a-f]{6}$/i.test(color) ? color : '#64748b'
}

export function tagStyle(colors: Record<string, string>, tag: string, selected = false) {
  const color = tagColor(colors, tag)
  return {
    borderColor: color,
    backgroundColor: selected ? color : `color-mix(in srgb, ${color} 12%, var(--background))`,
    color: selected ? readableText(color, '#ffffff') : 'var(--foreground)',
  }
}
