import { copyFileSync, readFileSync, writeFileSync } from 'node:fs'
import { execFileSync } from 'node:child_process'
import { resolve } from 'node:path'
const input = process.argv[2]
if (!input) throw new Error('Usage: node scripts/refresh-brand.mjs <imagegen-output.png>')
for (const path of ['public/markflow.png', 'website/public/markflow.png', 'src-tauri/icons/markflow-logo.png']) if (resolve(input) !== resolve(path)) copyFileSync(input, path)
// Keep existing SVG URLs compatible while using the same generated artwork.
const data = readFileSync(input).toString('base64')
const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024" viewBox="0 0 1024 1024" role="img" aria-label="MarkFlow"><image width="1024" height="1024" href="data:image/png;base64,${data}"/></svg>\n`
for (const path of ['public/markflow.svg', 'website/public/markflow.svg']) writeFileSync(path, svg)
execFileSync(process.execPath, ['node_modules/@tauri-apps/cli/tauri.js', 'icon', 'public/markflow.png'], { stdio: 'inherit' })
