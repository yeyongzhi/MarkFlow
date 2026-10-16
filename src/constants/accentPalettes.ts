export type AccentColor = { name: string; value: string }

export const accentPalettes = {
  ordinary: {
    name: '普通色系',
    description: '常用的清晰主题色',
    colors: [
      { value: '#e11d48', name: '红色' }, { value: '#ea580c', name: '橙色' },
      { value: '#eab308', name: '黄色' }, { value: '#16a34a', name: '绿色' },
      { value: '#2563eb', name: '蓝色' }, { value: '#4f46e5', name: '靛色' },
      { value: '#9333ea', name: '紫色' },
    ],
  },
  morandi: {
    name: '莫兰迪色系',
    description: '低饱和、柔和耐看的主题色',
    colors: [
      { name: '雾霾蓝', value: '#8FA3AD' }, { name: '灰蓝', value: '#A3B5C2' },
      { name: '灰豆绿', value: '#A3B18A' }, { name: '鼠尾草绿', value: '#9BAF9B' },
      { name: '烟粉', value: '#D4A6A6' }, { name: '藕灰', value: '#C7A7A1' },
      { name: '烟灰紫', value: '#A99BA7' }, { name: '燕麦色', value: '#D6C6B2' },
      { name: '奶咖色', value: '#B9A895' }, { name: '灰杏', value: '#D8BFA8' },
      { name: '岩灰', value: '#9A9892' }, { name: '石墨灰', value: '#737A7A' },
    ],
  },
  natural: {
    name: '自然色系',
    description: '从森林、海洋与大地中取色',
    colors: [
      { name: '鼠尾草', value: '#A8B89A' }, { name: '蕨叶绿', value: '#6F8D73' },
      { name: '苔藓绿', value: '#8A9A5B' }, { name: '松林绿', value: '#456B5D' },
      { name: '浅海蓝', value: '#8DB4C7' }, { name: '海湾蓝', value: '#4C8194' },
      { name: '陶土', value: '#C48D6A' }, { name: '沙岩', value: '#D7BD92' },
    ],
  },
  neutral: {
    name: '中性色系',
    description: '克制耐看，适合长时间写作',
    colors: [
      { name: '粉笔白', value: '#EEECE6' }, { name: '珍珠灰', value: '#D8D4CB' },
      { name: '暖灰', value: '#B8B4AA' }, { name: '卵石灰', value: '#9B9A93' },
      { name: '石板灰', value: '#777E80' }, { name: '石墨灰', value: '#555C60' },
      { name: '墨色', value: '#333A3D' }, { name: '灰褐', value: '#B4A89B' },
    ],
  },
  macaron: {
    name: '马卡龙色系',
    description: '明亮轻柔的粉彩配色',
    colors: [
      { name: '草莓牛奶', value: '#F4B7C2' }, { name: '蜜桃', value: '#F7C7A3' },
      { name: '柠檬奶油', value: '#F3E39B' }, { name: '薄荷', value: '#B8DEC5' },
      { name: '晴空', value: '#B7D8F0' }, { name: '丁香', value: '#CBB9E8' },
      { name: '薰衣草', value: '#D3C9E4' }, { name: '开心果', value: '#D2E3A7' },
    ],
  },
} as const
