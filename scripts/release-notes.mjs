import { appendFileSync, readFileSync } from 'node:fs'
import { randomUUID } from 'node:crypto'

const tag = process.argv[2]
if (!tag) throw new Error('Usage: node scripts/release-notes.mjs <tag>')

const { parse } = await import('yaml')
const config = parse(readFileSync(new URL('../release.yml', import.meta.url), 'utf8'))
if (config.title !== tag) throw new Error('Release title must equal the version tag')
if (tag.includes('-') && !config.prerelease) throw new Error('Prerelease flag is required')
const notes = config.body?.trim()
if (!notes || !notes.startsWith('发布日期：')) throw new Error('Release notes must start with publication date')
if (tag.includes('-') && !notes.endsWith('> 测试版，请先备份重要文档；遇到问题请通过 Issues 反馈。')) throw new Error('Prerelease notice is required')

const output = process.env.GITHUB_OUTPUT
if (!output) {
  process.stdout.write(`${notes}\n`)
} else {
  const delimiter = `RELEASE_NOTES_${randomUUID().replaceAll('-', '')}`
  appendFileSync(output, `body<<${delimiter}\n${notes}\n${delimiter}\n`)
}
