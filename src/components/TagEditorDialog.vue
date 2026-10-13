<script setup lang="ts">
import { shallowRef, watch } from 'vue'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import { CheckIcon } from '@lucide/vue'
import { tagColorPresets } from '@/services/tag-colors'
const props = defineProps<{ open: boolean; tag?: string; color: string; busy: boolean; error: string }>()
const emit = defineEmits<{ 'update:open': [value: boolean]; save: [name: string, color: string] }>()
const name = shallowRef(''), color = shallowRef('')
watch(() => props.open, open => { if (open) { name.value = props.tag || ''; color.value = props.color } }, { immediate: true })
</script>
<template>
  <Dialog :open="open" @update:open="v=>{if(!busy)emit('update:open',v)}"><DialogContent :show-close-button="!busy" class="sm:max-w-md" @escape-key-down="e=>{if(busy)e.preventDefault()}" @interact-outside="e=>{if(busy)e.preventDefault()}">
    <DialogHeader><DialogTitle>{{tag?'编辑标签':'新增标签'}}</DialogTitle><DialogDescription>{{tag?'修改名称会同步更新工作区文档及归档，原文备份保留在应用数据目录。':'设置标签名称和颜色。'}}</DialogDescription></DialogHeader>
    <form class="flex flex-col gap-4" @submit.prevent="emit('save',name,color)">
      <label class="flex flex-col gap-2 text-sm">标签名称<Input v-model="name" aria-label="标签名称" maxlength="40" :disabled="busy" placeholder="输入标签名称"/></label>
      <div class="flex flex-col gap-2"><span class="text-sm">标签颜色</span>
        <ToggleGroup type="single" :model-value="color.toLowerCase()" :spacing="1" :disabled="busy" aria-label="预设标签颜色" class="flex-wrap justify-start" @update:model-value="v=>{if(v)color=String(v)}">
          <ToggleGroupItem v-for="preset in tagColorPresets" :key="preset.value" :value="preset.value" :aria-label="`标签颜色 ${preset.name}`" class="size-9 min-w-0 p-1">
            <span class="flex size-5 items-center justify-center rounded-full" :style="{backgroundColor:preset.value,color:preset.name==='黄色'?'#422006':'#ffffff'}"><CheckIcon v-if="color.toLowerCase()===preset.value" class="size-3"/></span>
          </ToggleGroupItem>
        </ToggleGroup>
        <label class="flex items-center justify-between text-xs text-muted-foreground">自定义颜色<input v-model="color" type="color" aria-label="标签颜色" class="size-8 cursor-pointer" :disabled="busy"/></label>
      </div>
      <p v-if="error" role="alert" class="text-sm text-destructive">{{error}}</p>
      <DialogFooter><Button type="button" variant="outline" :disabled="busy" @click="emit('update:open',false)">取消</Button><Button type="submit" :disabled="busy">{{busy?'保存中…':'保存'}}</Button></DialogFooter>
    </form>
  </DialogContent></Dialog>
</template>
