import { readableText } from './theme'

export const tagColorPresets = [
  { value: '#e11d48', name: '红色' },
  { value: '#ea580c', name: '橙色' },
  { value: '#eab308', name: '黄色' },
  { value: '#16a34a', name: '绿色' },
  { value: '#2563eb', name: '蓝色' },
  { value: '#4f46e5', name: '靛色' },
  { value: '#9333ea', name: '紫色' },
  { value: '#64748b', name: '灰色' },
] as const

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
