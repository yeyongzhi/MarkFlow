import { readFile } from 'node:fs/promises'
import { spawn } from 'node:child_process'
import { dirname, resolve } from 'node:path'

// Keep signing material out of source control and command-line output.
const privateKey = process.env.TAURI_SIGNING_PRIVATE_KEY || (await readFile(resolve('.local/updater.key'), 'utf8')).trim()
const env = { ...process.env, TAURI_SIGNING_PRIVATE_KEY: privateKey, TAURI_SIGNING_PRIVATE_KEY_PASSWORD: process.env.TAURI_SIGNING_PRIVATE_KEY_PASSWORD || '' }
const pathKey = Object.keys(env).find(key => key.toLowerCase() === 'path') || 'PATH'
env[pathKey] = dirname(process.execPath) + (process.platform === 'win32' ? ';' : ':') + (env[pathKey] || '')
const child = spawn(process.execPath, [resolve('node_modules/@tauri-apps/cli/tauri.js'), 'build', '--bundles', 'nsis', '--', '--locked'], { env, stdio: 'inherit' })
child.on('error', () => { console.error('无法启动构建进程'); process.exitCode = 1 })
child.on('exit', code => { process.exitCode = code ?? 1 })
