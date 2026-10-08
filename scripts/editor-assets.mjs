import { cp, mkdir, rm } from 'node:fs/promises'
import { createRequire } from 'node:module'
import { dirname, resolve, sep } from 'node:path'

const require = createRequire(import.meta.url)
const root = resolve(dirname(require.resolve('vditor/package.json')), 'dist')
const target = resolve('public/vendor/vditor')
if (!target.startsWith(resolve('.') + sep)) throw new Error('Asset target must stay inside project')
await rm(target, { recursive: true, force: true })
await mkdir(resolve(target, 'dist'), { recursive: true })
await cp(root, resolve(target, 'dist'), { recursive: true })
console.log('Vditor offline assets prepared.')
