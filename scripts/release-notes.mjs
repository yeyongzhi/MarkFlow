import { appendFileSync, readFileSync } from 'node:fs'
import { randomUUID } from 'node:crypto'

const tag = process.argv[2]
if (!tag) throw new Error('Usage: node scripts/release-notes.mjs <tag>')

const version = tag.replace(/^v/, '')
const changelog = readFileSync(new URL('../CHANGELOG.md', import.meta.url), 'utf8')
const lines = changelog.split(/\r?\n/)
const start = lines.findIndex(line => line.trim() === `## ${version}`)
if (start < 0) throw new Error(`CHANGELOG.md has no section for ${version}`)

const end = lines.findIndex((line, index) => index > start && /^##\s/.test(line))
const section = lines.slice(start + 1, end < 0 ? undefined : end)
const body = []
let skippingDownloadNotes = false

for (const line of section) {
  const heading = line.match(/^\s*(#{1,6})\s+(.+?)\s*#*\s*$/)
  if (heading) {
    skippingDownloadNotes = heading[2].trim() === '下载与更新'
    if (skippingDownloadNotes) continue
  }
  if (skippingDownloadNotes) continue

  const date = line.match(/^\s*<span class="changelog-date">(.*?)<\/span>\s*$/)
  body.push(date ? date[1].trim() : line)
}

const changelogNotes = body.join('\n').replace(/\n{3,}/g, '\n\n').trim()
if (!changelogNotes) throw new Error(`CHANGELOG.md section for ${version} is empty`)

const notes = `${changelogNotes}\n\n> 测试版，请先备份重要文档；遇到问题请通过 Issues 反馈。`

const output = process.env.GITHUB_OUTPUT
if (!output) {
  process.stdout.write(`${notes}\n`)
} else {
  const delimiter = `RELEASE_NOTES_${randomUUID().replaceAll('-', '')}`
  appendFileSync(output, `body<<${delimiter}\n${notes}\n${delimiter}\n`)
}
