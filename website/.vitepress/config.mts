import { defineConfig } from 'vitepress'

export default defineConfig({
  lang: 'zh-CN',
  title: 'MarkFlow',
  description: '本地 Markdown 编辑器，让文字留在自己的文件夹里。',
  base: '/MarkFlow/',
  cleanUrls: true,
  lastUpdated: true,
  sitemap: { hostname: 'https://yeyongzhi.github.io/MarkFlow/' },
  head: [['link', { rel: 'icon', href: '/MarkFlow/markflow.svg' }]],
  themeConfig: {
    logo: '/markflow.svg',
    nav: [
      { text: '功能', link: '/features' },
      { text: '使用指南', link: '/guide/getting-started' },
      { text: '下载', link: '/download' },
      { text: '更新日志', link: '/changelog' },
    ],
    sidebar: [
      { text: '认识 MarkFlow', items: [{ text: '功能清单', link: '/features' }, { text: '下载与安装', link: '/download' }] },
      { text: '使用指南', items: [{ text: '开始写作', link: '/guide/getting-started' }, { text: '编辑与阅读', link: '/guide/editing' }, { text: '数据与备份', link: '/guide/storage' }, { text: '常见问题', link: '/guide/faq' }] },
      { text: '项目资讯', items: [{ text: '更新日志', link: '/changelog' }] },
    ],
    socialLinks: [{ icon: 'github', link: 'https://github.com/yeyongzhi/MarkFlow' }],
    search: { provider: 'local' },
    outline: { label: '本页目录', level: [2, 3] },
    docFooter: { prev: '上一页', next: '下一页' },
    lastUpdated: { text: '最近更新' },
    footer: { message: '本地文件 · 自由写作', copyright: 'MarkFlow' },
  },
})
