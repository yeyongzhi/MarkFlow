<script setup lang="ts">
import { MinusIcon, SquareIcon, CopyIcon, XIcon } from '@lucide/vue'
import { getCurrentWindow } from '@tauri-apps/api/window'
import { onMounted, onBeforeUnmount, ref } from 'vue'
import { toast } from 'vue-sonner'
import { message } from '@/services/api'
const emit = defineEmits<{ close: [] }>()
const maximized = ref(false)
let unlisten: (() => void) | undefined
async function update() { maximized.value = await getCurrentWindow().isMaximized() }
async function minimize() { try { await getCurrentWindow().minimize() } catch (e) { toast.error(message(e)) } }
async function maximize() { try { await getCurrentWindow().toggleMaximize(); await update() } catch (e) { toast.error(message(e)) } }
onMounted(async () => { await update(); unlisten = await getCurrentWindow().onResized(update) })
onBeforeUnmount(() => unlisten?.())
</script>
<template>
  <div class="flex h-full shrink-0 items-stretch" aria-label="窗口控制">
    <button class="flex w-11 items-center justify-center text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-2 focus-visible:outline-ring" aria-label="最小化窗口" @click="minimize"><MinusIcon class="size-4" /></button>
    <button class="flex w-11 items-center justify-center text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-2 focus-visible:outline-ring" :aria-label="maximized ? '还原窗口' : '最大化窗口'" @click="maximize"><CopyIcon v-if="maximized" class="size-3.5" /><SquareIcon v-else class="size-3.5" /></button>
    <button class="flex w-11 items-center justify-center text-muted-foreground transition-colors hover:bg-destructive hover:text-white focus-visible:outline-2 focus-visible:outline-ring" aria-label="关闭窗口" @click="emit('close')"><XIcon class="size-4" /></button>
  </div>
</template>
