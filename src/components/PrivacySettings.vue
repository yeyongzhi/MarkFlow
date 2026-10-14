<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { call, message } from '@/services/api'
import { configured, privacyStatus } from '@/services/privacy'
const current=ref(''),password=ref(''),repeat=ref(''),error=ref(''),success=ref(''),busy=ref(false)
onMounted(privacyStatus)
async function save(remove=false){error.value='';success.value='';if(!remove&&(password.value!==repeat.value||password.value.length<6)){error.value='请输入至少 6 位且一致的新密码。';return}busy.value=true;try{await call('privacy_password',{current:current.value,password:remove?'':password.value});configured.value=!remove;current.value=password.value=repeat.value='';success.value=remove?'已移除锁屏密码':'已保存锁屏密码，下次启动需要解锁。'}catch(e){error.value=message(e)}finally{busy.value=false}}
</script>
<template><form class="flex max-w-lg flex-col gap-4 pb-0 pt-4" @submit.prevent="save()"><p class="text-sm leading-6 text-muted-foreground">锁屏隐藏应用中的文档与文件列表。密码设置后，启动时自动锁定。此功能保护界面隐私，磁盘 Markdown 文件仍保持原有格式。</p><label v-if="configured" class="space-y-2 text-sm">当前密码<Input v-model="current" type="password" autocomplete="current-password" aria-label="当前密码"/></label><label class="space-y-2 text-sm">新密码<Input v-model="password" type="password" autocomplete="new-password" aria-label="新密码"/></label><label class="space-y-2 text-sm">确认新密码<Input v-model="repeat" type="password" autocomplete="new-password" aria-label="确认新密码"/></label><p v-if="error" role="alert" class="text-sm text-destructive">{{error}}</p><p v-if="success" role="status" class="text-sm text-primary">{{success}}</p><div class="flex gap-2"><Button :disabled="busy">保存密码</Button><Button v-if="configured" type="button" variant="outline" :disabled="busy||!current" @click="save(true)">移除密码</Button></div></form></template>
