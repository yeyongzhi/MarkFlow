<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { call, message } from '@/services/api'
import { configured, privacyStatus } from '@/services/privacy'

type PasswordAction = 'set' | 'change' | 'remove'
const action = ref<PasswordAction>('set')
const open = ref(false), current = ref(''), password = ref(''), repeat = ref(''), error = ref(''), busy = ref(false)
const title = computed(() => action.value === 'set' ? '设置锁屏密码' : action.value === 'change' ? '更改锁屏密码' : '取消锁屏密码')
const description = computed(() => action.value === 'remove' ? '请输入当前密码以取消锁屏保护。' : action.value === 'change' ? '验证当前密码后设置新密码。' : '设置至少 6 位密码，应用启动时将自动锁定。')

onMounted(privacyStatus)

function show(next: PasswordAction) {
  action.value = next
  current.value = password.value = repeat.value = error.value = ''
  open.value = true
}

async function save() {
  error.value = ''
  if (action.value === 'remove' && !current.value) { error.value = '请输入当前密码。'; return }
  if (action.value !== 'remove' && (password.value.length < 6 || password.value !== repeat.value)) {
    error.value = '请输入至少 6 位且两次输入一致的新密码。'
    return
  }
  busy.value = true
  try {
    await call('privacy_password', { current: current.value, password: action.value === 'remove' ? '' : password.value })
    configured.value = action.value !== 'remove'
    open.value = false
  } catch (e) {
    error.value = message(e)
  } finally {
    busy.value = false
  }
}
</script>

<template>
  <div class="flex max-w-lg flex-col gap-4 pt-4">
    <p class="text-sm leading-6 text-muted-foreground">锁屏隐藏应用中的文档与文件列表。密码设置后，启动时自动锁定。此功能保护界面隐私，磁盘 Markdown 文件仍保持原有格式</p>

    <div class="flex flex-wrap gap-2">
      <Button v-if="!configured" @click="show('set')">设置密码</Button>
      <template v-else>
        <Button @click="show('change')">更改密码</Button>
        <Button variant="outline" @click="show('remove')">取消密码</Button>
      </template>
    </div>
  </div>

  <Dialog v-model:open="open">
    <DialogContent>
      <DialogHeader>
        <DialogTitle>{{ title }}</DialogTitle>
        <DialogDescription>{{ description }}</DialogDescription>
      </DialogHeader>
      <form class="flex flex-col gap-4" @submit.prevent="save">
        <label v-if="action !== 'set'" class="space-y-2 text-sm">当前密码<Input v-model="current" type="password" autocomplete="current-password" aria-label="当前密码" autofocus /></label>
        <template v-if="action !== 'remove'">
          <label class="space-y-2 text-sm">新密码<Input v-model="password" type="password" autocomplete="new-password" aria-label="新密码" :autofocus="action === 'set'" /></label>
          <label class="space-y-2 text-sm">确认新密码<Input v-model="repeat" type="password" autocomplete="new-password" aria-label="确认新密码" /></label>
        </template>
        <p v-if="error" role="alert" class="text-sm text-destructive">{{ error }}</p>
        <DialogFooter>
          <Button type="button" variant="outline" :disabled="busy" @click="open = false">返回</Button>
          <Button :disabled="busy">{{ busy ? '处理中…' : action === 'remove' ? '取消密码' : '保存密码' }}</Button>
        </DialogFooter>
      </form>
    </DialogContent>
  </Dialog>
</template>
