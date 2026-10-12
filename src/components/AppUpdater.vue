<script setup lang="ts">
import { onBeforeUnmount, ref } from 'vue'
import { Update } from '@tauri-apps/plugin-updater'
import { relaunch } from '@tauri-apps/plugin-process'
import { installProtectedUpdate } from '@/services/update-install'
import { toast } from 'vue-sonner'
import { Button } from '@/components/ui/button'
import { useWorkbench } from '@/stores/workbench'
import { call, desktop, message } from '@/services/api'

const store = useWorkbench(), checking = ref(false), installing = ref(false), checked = ref(false), error = ref(''), version = ref(''), notes = ref(''), progress = ref(''), installed = ref(false)
let update: Update | null = null
let disposed = false
onBeforeUnmount(() => { disposed = true; if (!installing.value) void update?.close() })
async function checkUpdate() {
  if (!desktop) { toast.info('请在桌面版中检查更新'); return }
  checking.value = true; checked.value = false; error.value = ''; version.value = ''; notes.value = ''
  try {
    await update?.close(); update = null
    const release = await call<{ noRelease?: boolean; available: boolean }>('check_release')
    if (release.noRelease) { toast.info('当前更新通道尚无公开版本'); return }
    if (release.available) {
      const metadata = await call<ConstructorParameters<typeof Update>[0] | null>('check_signed_update')
      update = metadata ? new Update(metadata) : null
      if (!update) throw new Error('发现新版本，但该版本的签名更新清单尚不可用')
    }
    version.value = update?.version || ''; notes.value = update?.body || ''; checked.value = true
    if (!update) toast.success('当前已是最新版本')
  } catch (e) { error.value = `检查失败：${message(e)}。请确认网络及该版本的更新包已发布。`; toast.error('检查更新失败') }
  finally { checking.value = false; if (disposed) await update?.close() }
}
async function installUpdate() {
  if (!update || installing.value) return
  installing.value = true; error.value = ''; let downloaded = 0, total = 0
  try {
    await installProtectedUpdate(update, store, () => window.dispatchEvent(new CustomEvent('lexly-sync-editors')), event => {
      if (event.event === 'Started') total = event.data.contentLength || 0
      if (event.event === 'Progress') downloaded += event.data.chunkLength
      progress.value = total ? `正在下载 ${Math.min(100, Math.round(downloaded / total * 100))}%` : `已下载 ${(downloaded / 1048576).toFixed(1)} MiB`
    })
    installed.value = true; toast.success('更新已安装，请重启应用')
  } catch (e) { error.value = message(e); toast.error('更新未完成', { description: error.value }) }
  finally { installing.value = false; if (disposed) await update?.close() }
}
async function restart() {
  try { window.dispatchEvent(new CustomEvent('lexly-sync-editors')); if (!await store.flush() || !await store.protectDrafts()) throw new Error('请先处理未保存文档'); await store.persistNow(); await relaunch() }
  catch (e) { toast.error(message(e)) }
}
</script>
<template>
  <div class="flex w-full flex-col gap-3 border-t pt-5" aria-live="polite">
    <Button v-if="!installed" variant="outline" :disabled="checking || installing" @click="checkUpdate">{{ checking ? '正在检查…' : '检查更新' }}</Button>
    <p v-if="checked && !version" class="text-sm text-muted-foreground">当前已是最新版本。</p>
    <template v-if="version && !installed">
      <p class="text-sm font-medium">发现新版本 {{ version }}</p>
      <p v-if="notes" class="whitespace-pre-wrap rounded-lg border p-3 text-sm">{{ notes }}</p>
      <Button :disabled="installing" @click="installUpdate">{{ installing ? progress || '准备更新…' : '下载并安装更新' }}</Button>
      <p class="text-xs text-muted-foreground">安装前保存文档并验证更新包签名。Windows 安装程序可能关闭并重新启动应用。</p>
    </template>
    <Button v-if="installed" @click="restart">重启应用</Button>
    <p v-if="error" role="alert" class="text-sm text-destructive">{{ error }}</p>
  </div>
</template>
