<script setup lang="ts">
import { computed, onBeforeUnmount, ref } from 'vue'
import { Update } from '@tauri-apps/plugin-updater'
import { relaunch } from '@tauri-apps/plugin-process'
import { installProtectedUpdate } from '@/services/update-install'
import { toast } from 'vue-sonner'
import { Button } from '@/components/ui/button'
import { RefreshCwIcon } from '@lucide/vue'
import { useWorkbench } from '@/stores/workbench'
import { call, desktop, message } from '@/services/api'
import { renderMarkdown } from '@/services/markdown'

const store = useWorkbench(), checking = ref(false), installing = ref(false), checked = ref(false), error = ref(''), version = ref(''), notes = ref(''), progress = ref(''), installed = ref(false)
const visibleNotes = computed(() => notes.value.split('\n').filter(line => !line.includes('安装包包含 Tauri 更新签名') && !line.includes('SHA256SUMS.txt')).join('\n').trim())
const renderedNotes = computed(() => renderMarkdown(visibleNotes.value))
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
  <div class="flex w-full max-w-2xl flex-col items-start gap-3 border-t pt-5" aria-live="polite">
    <Button v-if="!installed" class="min-w-28" :disabled="checking || installing" @click="checkUpdate"><RefreshCwIcon data-icon="inline-start" :class="checking && 'animate-spin'" />{{ checking ? '正在检查…' : '检查更新' }}</Button>
    <p v-if="checked && !version" class="text-sm text-muted-foreground">当前已是最新版本。</p>
    <template v-if="version && !installed">
      <p class="text-sm font-medium">发现新版本 {{ version }}</p>
      <div v-if="visibleNotes" class="update-notes w-full rounded-xl border border-border/70 bg-muted/20 p-4 text-sm leading-6" v-html="renderedNotes" />
      <Button class="min-w-36" :disabled="installing" @click="installUpdate">{{ installing ? progress || '准备更新…' : '下载并安装更新' }}</Button>
      <p class="text-xs text-muted-foreground">安装前保存文档并验证更新包签名。Windows 安装程序可能关闭并重新启动应用。</p>
    </template>
    <Button v-if="installed" @click="restart">重启应用</Button>
  </div>
</template>

<style scoped>
.update-notes :deep(h1), .update-notes :deep(h2), .update-notes :deep(h3) { margin: 0.75rem 0 0.35rem; font-weight: 600; line-height: 1.4; }
.update-notes :deep(h1:first-child), .update-notes :deep(h2:first-child), .update-notes :deep(h3:first-child) { margin-top: 0; }
.update-notes :deep(p) { margin: 0.4rem 0; }
.update-notes :deep(ul) { list-style: disc; padding-left: 1.25rem; }
.update-notes :deep(li) { margin: 0.2rem 0; }
</style>
