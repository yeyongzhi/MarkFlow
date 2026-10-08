import { readFile, writeFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'

const root = new URL('../', import.meta.url)
const files = ['package.json', 'src-tauri/tauri.conf.json', 'src-tauri/Cargo.toml', 'src-tauri/Cargo.lock']
const contents = await Promise.all(files.map(file => readFile(new URL(file, root), 'utf8')))
const cargoPattern = /(\[package\][\s\S]*?\nversion\s*=\s*")([^"]+)(")/
const lockPattern = /(\[\[package\]\]\r?\nname = "markflow"\r?\nversion = ")([^"]+)(")/
const versions = [JSON.parse(contents[0]).version, JSON.parse(contents[1]).version, cargoPattern.exec(contents[2])?.[2], lockPattern.exec(contents[3])?.[2]]
const [operation = 'check', argument] = process.argv.slice(2)
const validVersion = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-((?:0|[1-9]\d*|\d*[a-zA-Z-][0-9a-zA-Z-]*)(?:\.(?:0|[1-9]\d*|\d*[a-zA-Z-][0-9a-zA-Z-]*))*))?$/
if (operation === 'set') {
  if (!argument || !validVersion.test(argument)) throw new Error('使用 node scripts/version.mjs set 0.2.0（也支持 0.2.0-beta.1）')
  if (versions.some(version => !version)) throw new Error('无法定位版本字段，未修改文件')
  const next = contents.map((content, index) => index < 2
    ? content.replace(/("version"\s*:\s*")[^"]+(")/, `$1${argument}$2`)
    : content.replace(index === 2 ? cargoPattern : lockPattern, `$1${argument}$3`))
  for (let index = 0; index < files.length; index++) await writeFile(new URL(files[index], root), next[index])
  console.log(`版本已同步为 ${argument}；请更新 CHANGELOG.md 后提交。`)
} else if (operation === 'check') {
  if (!validVersion.test(versions[0]) || versions.some(version => version !== versions[0])) {
    throw new Error(`版本不一致：${files.map((file, index) => `${file}=${versions[index]}`).join(', ')}`)
  }
  if (argument && argument !== `v${versions[0]}`) throw new Error(`标签 ${argument} 与版本 v${versions[0]} 不一致`)
  console.log(`版本检查通过：v${versions[0]} (${fileURLToPath(root)})`)
} else throw new Error('支持 check [v版本号] 或 set 版本号')
