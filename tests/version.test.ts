import { afterEach, describe, expect, it } from 'vitest'
import { mkdtempSync, mkdirSync, copyFileSync, rmSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { execFileSync } from 'node:child_process'

const fixtures: string[] = []
function fixture() {
  const root = mkdtempSync(join(tmpdir(), 'markflow-version-'))
  fixtures.push(root)
  for (const directory of ['scripts', 'src-tauri']) mkdirSync(join(root, directory))
  for (const file of ['scripts/version.mjs', 'package.json', 'src-tauri/tauri.conf.json', 'src-tauri/Cargo.toml', 'src-tauri/Cargo.lock']) copyFileSync(resolve(file), join(root, file))
  return root
}
function run(root: string, ...args: string[]) {
  return execFileSync(process.execPath, [join(root, 'scripts/version.mjs'), ...args], { encoding: 'utf8', stdio: 'pipe' })
}
afterEach(() => { for (const root of fixtures.splice(0)) rmSync(root, { recursive: true, force: true }) })
describe('release version management', () => {
  it('synchronizes all version sources including the native lockfile', () => {
    const root = fixture()
    run(root, 'set', '0.2.0-beta.1')
    expect(run(root, 'check', 'v0.2.0-beta.1')).toContain('v0.2.0-beta.1')
    expect(JSON.parse(readFileSync(join(root, 'package.json'), 'utf8')).version).toBe('0.2.0-beta.1')
    expect(readFileSync(join(root, 'src-tauri/Cargo.lock'), 'utf8').replace(/\r\n/g, '\n')).toContain('name = "markflow"\nversion = "0.2.0-beta.1"')
  })
  it('rejects a tag mismatch and an inconsistent version source', () => {
    const root = fixture()
    expect(() => run(root, 'check', 'v9.9.9')).toThrow()
    const path = join(root, 'src-tauri/tauri.conf.json')
    const config = JSON.parse(readFileSync(path, 'utf8')); config.version = '9.9.9'
    writeFileSync(path, JSON.stringify(config))
    expect(() => run(root, 'check')).toThrow()
  })
  it('rejects invalid versions without modifying the project', () => {
    const root = fixture(), before = readFileSync(join(root, 'package.json'), 'utf8')
    for (const version of ['01.2.3', '0.2.0-beta.01', 'latest']) expect(() => run(root, 'set', version)).toThrow()
    expect(readFileSync(join(root, 'package.json'), 'utf8')).toBe(before)
  })
})
