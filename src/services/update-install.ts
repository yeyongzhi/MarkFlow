import type { DownloadEvent, Update } from '@tauri-apps/plugin-updater'

interface ProtectedSession {
  flush(): Promise<boolean>
  protectDrafts(): Promise<boolean>
  persistNow(): Promise<void>
}
export async function installProtectedUpdate(update: Pick<Update, 'download' | 'install'>, session: ProtectedSession, sync: () => void, progress: (event: DownloadEvent) => void) {
  async function saveSession() {
    sync()
    if (!await session.flush() || !await session.protectDrafts()) throw new Error('存在未保存内容或冲突，请处理后再更新')
    await session.persistNow()
  }
  await saveSession()
  await update.download(progress)
  // Changes made while downloading must also be saved before the installer can exit the app.
  await saveSession()
  await update.install()
}
