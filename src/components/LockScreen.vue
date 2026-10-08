<script setup lang="ts">
import { ref } from 'vue'
import { LockKeyholeIcon } from '@lucide/vue'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import WindowControls from './WindowControls.vue'
import { getCurrentWindow } from '@tauri-apps/api/window'
import { call, message, desktop } from '@/services/api'
import { locked } from '@/services/privacy'
const emit=defineEmits<{unlocked:[]}>(),password=ref(''),error=ref(''),busy=ref(false)
async function unlock(){busy.value=true;error.value='';try{await call('privacy_unlock',{password:password.value});password.value='';locked.value=false;emit('unlocked')}catch(e){error.value=message(e);password.value=''}finally{busy.value=false}}
</script>
<template><main class="fixed inset-0 z-[100] flex flex-col bg-background"><header data-tauri-drag-region class="flex h-11 justify-between border-b pl-4"><span class="self-center font-semibold">MarkFlow</span><WindowControls v-if="desktop" @close="getCurrentWindow().destroy()"/></header><div class="flex flex-1 items-center justify-center px-6"><form class="flex w-full max-w-sm flex-col items-center gap-5 rounded-2xl border bg-card p-8 shadow-sm" @submit.prevent="unlock"><LockKeyholeIcon class="size-10 text-primary"/><h1 class="text-xl font-semibold">应用已锁定</h1><p class="text-sm text-muted-foreground">输入密码，继续你的写作。</p><Input v-model="password" type="password" autocomplete="current-password" autofocus aria-label="解锁密码" :disabled="busy"/><p v-if="error" role="alert" class="text-sm text-destructive">{{error}}</p><Button class="w-full" :disabled="busy||!password">{{busy?'验证中…':'解锁'}}</Button></form></div></main></template>
