<script setup lang="ts">
import { ref, watch, onBeforeUnmount } from 'vue'
import SearchWorker from '@/services/search.worker?worker'
import type { Match } from '@/services/search'
import { replaceMatches } from '@/services/search'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import { XIcon, ArrowUpIcon, ArrowDownIcon } from '@lucide/vue'
import type { Document } from '@/types'
import { useWorkbench } from '@/stores/workbench'
const props = defineProps<{ document: Document }>()
const emit = defineEmits<{ close: []; select: [start: number, end: number] }>()
const store = useWorkbench(), query = ref(''), replacement = ref(''), options = ref<string[]>([]), matches = ref<Match[]>([]), index = ref(0), error = ref(''), pending = ref(false)
let timer: ReturnType<typeof setTimeout>, timeout: ReturnType<typeof setTimeout>, worker: Worker | undefined
function search() {
  worker?.terminate(); clearTimeout(timeout); matches.value = []; error.value = ''; pending.value = false
  if (!query.value) return
  pending.value = true; worker = new SearchWorker()
  worker.onmessage = e => { clearTimeout(timeout); pending.value = false; error.value = e.data.error || ''; matches.value = e.data.matches || []; index.value = 0; worker?.terminate() }
  worker.postMessage({ text: props.document.text, query: query.value, replacement: replacement.value, sensitive: options.value.includes('case'), regex: options.value.includes('regex') })
  timeout = setTimeout(() => { worker?.terminate(); pending.value = false; error.value = '搜索超时，请简化正则表达式。' }, 1000)
}
watch(() => [query.value, replacement.value, options.value.join(), props.document.text, props.document.id], () => { worker?.terminate(); clearTimeout(timeout); matches.value = []; clearTimeout(timer); timer = setTimeout(search, 160) })
function move(offset: number) { if (!matches.value.length) return; index.value = (index.value + offset + matches.value.length) % matches.value.length; const m = matches.value[index.value]!; emit('select', m.start, m.end) }
function replace(all: boolean) { if (!matches.value.length || pending.value) return; const selected = all ? matches.value : [matches.value[index.value]!]; store.change(props.document, replaceMatches(props.document.text, selected)); props.document.generation++ }
onBeforeUnmount(() => { clearTimeout(timer); clearTimeout(timeout); worker?.terminate() })
</script>
<template>
  <div class="find-bar" role="search" aria-label="当前文档查找替换" @keydown.esc="$emit('close')">
    <Input v-model="query" autofocus aria-label="查找内容" placeholder="查找内容" @keydown.enter.prevent="move($event.shiftKey ? -1 : 0)" />
    <ToggleGroup v-model="options" type="multiple" variant="outline" :spacing="1" aria-label="查找选项"><ToggleGroupItem value="case" title="区分大小写">Aa</ToggleGroupItem><ToggleGroupItem value="regex" title="正则表达式">.*</ToggleGroupItem></ToggleGroup>
    <span class="find-count" aria-live="polite">{{ pending ? '搜索中…' : matches.length ? `${index + 1}/${matches.length}` : '0/0' }}</span>
    <Button variant="ghost" size="icon-sm" aria-label="上一处" :disabled="!matches.length" @click="move(-1)"><ArrowUpIcon /></Button><Button variant="ghost" size="icon-sm" aria-label="下一处" :disabled="!matches.length" @click="move(1)"><ArrowDownIcon /></Button>
    <Input v-model="replacement" aria-label="替换内容" placeholder="替换为" /><Button variant="outline" size="sm" :disabled="!matches.length" @click="replace(false)">替换</Button><Button variant="outline" size="sm" :disabled="!matches.length" @click="replace(true)">全部替换</Button>
    <Button variant="ghost" size="icon-sm" aria-label="关闭查找" @click="$emit('close')"><XIcon /></Button><p v-if="error" class="text-destructive w-full" role="alert">{{ error }}</p>
  </div>
</template>
