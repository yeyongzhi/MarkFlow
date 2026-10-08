<script setup lang="ts">
import { indentSelection } from '@/services/indent'
import { computed, ref, watch } from 'vue'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog'
import { Select, SelectTrigger, SelectValue, SelectContent, SelectGroup, SelectItem } from '@/components/ui/select'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Field, FieldGroup, FieldLabel } from '@/components/ui/field'
import { markdown } from '@/services/markdown'
import { useWorkbench } from '@/stores/workbench'
import type { Document } from '@/types'
import { toast } from 'vue-sonner'
const props = defineProps<{ open: boolean; kind: 'table' | 'code'; document?: Document; blockIndex?:number }>(), emit = defineEmits<{ 'update:open': [value: boolean] }>()
const store = useWorkbench(), target = ref('new'), cells = ref<string[][]>([]), language = ref(''), code = ref(''), snapshot = ref(''), alignments=ref<string[]>([]),pasteText=ref('')
const blocks = computed(() => { const tokens = markdown.parse(snapshot.value, {}); return tokens.flatMap((t, i) => {
  if (props.kind === 'code' && t.type === 'fence' && t.map) return [{ start: t.map[0], end: t.map[1], rows: [] as string[][], align: [] as string[], language: t.info.trim(), code: t.content }]
  if (props.kind !== 'table' || t.type !== 'table_open' || !t.map) return []
  const rows: string[][] = [], align: string[] = []; let row: string[] = []
  for (const cell of tokens.slice(i + 1)) { if (cell.type === 'table_close') break; if (cell.type === 'tr_open') { row = []; rows.push(row) }; if (cell.type === 'inline') row.push(cell.content); if (cell.type === 'th_open') align.push(String(cell.attrGet('style') || '')) }
  return [{ start: t.map[0], end: t.map[1], rows, align, language: '', code: '' }]
}) })
function load() { const block = blocks.value[Number(target.value)]; cells.value = block?.rows.length?block.rows.map(row => [...row]):[['标题 1', '标题 2'], ['', '']]; alignments.value=cells.value[0]!.map((_,i)=>block?.align[i]?.includes('center')?'center':block?.align[i]?.includes('right')?'right':block?.align[i]?.includes('left')?'left':'default');pasteText.value=''; language.value = block?.language || 'text'; code.value = block?.code || '' }
watch(() => props.open, open => { if (open) { snapshot.value = props.document?.text || ''; target.value = props.blockIndex===undefined?'new':String(props.blockIndex); load() } })
watch(target, load)
function apply() {
  const d = props.document; if (!d) return
  if (d.text !== snapshot.value) { toast.warning('文档已变化，请重新打开此编辑窗口。'); return }
  const block = blocks.value[Number(target.value)]
  let value: string
  if (props.kind === 'table') { const escape = (cell: string) => cell.replace(/\r?\n/g, '<br>').replace(/(?<!\\)\|/g, '\\|'); const row = (values: string[]) => '| ' + values.map(escape).join(' | ') + ' |'; const align = cells.value[0]!.map((_, index) => { const style = alignments.value[index] || ''; return style.includes('center') ? ':---:' : style.includes('right') ? '---:' : style.includes('left') ? ':---' : '---' }); value = [row(cells.value[0]!), row(align), ...cells.value.slice(1).map(row)].join('\n') + '\n' }
  else { const fence = '`'.repeat(Math.max(3, ...Array.from(code.value.matchAll(/`+/g), m => m[0].length + 1))); value = `${fence}${language.value.replace(/[\r\n\x00-\x1f]/g,'').slice(0,256)}\n${code.value.replace(/\n$/, '')}\n${fence}\n` }
  const lines = snapshot.value.split('\n'); const next = block ? [...lines.slice(0,block.start), value.replace(/\n$/, ''), ...lines.slice(block.end)].join('\n') : snapshot.value.replace(/\s*$/, '') + '\n\n' + value
  store.change(d, next,'structure'); d.generation++; emit('update:open', false)
}
function moveRow(i:number,delta:number){const j=i+delta;if(i<1||j<1||j>=cells.value.length)return;const item=cells.value.splice(i,1)[0]!;cells.value.splice(j,0,item)}
function moveColumn(i:number,delta:number){const j=i+delta;if(j<0||j>=cells.value[0]!.length)return;for(const row of cells.value){const item=row.splice(i,1)[0]!;row.splice(j,0,item)}const a=alignments.value.splice(i,1)[0]!;alignments.value.splice(j,0,a)}
function pasteTable(){const rows=pasteText.value.replace(/\r\n/g,'\n').trimEnd().split('\n').map(r=>r.split('\t'));const width=Math.max(...rows.map(r=>r.length));if(rows.length>100||width>20){toast.error('最多 100 行、20 列');return}cells.value=rows.map(r=>Array.from({length:width},(_,i)=>r[i]||''));alignments.value=Array(width).fill('default')}
function codeKey(e:KeyboardEvent){if(e.key!=='Tab')return;e.preventDefault();const el=e.target as HTMLTextAreaElement,result=indentSelection(el.value,el.selectionStart,el.selectionEnd,e.shiftKey);el.value=result.text;el.setSelectionRange(result.start,result.end);code.value=result.text}
</script>
<template><Dialog :open="open" @update:open="emit('update:open',$event)"><DialogContent class="productivity-dialog sm:max-w-3xl"><DialogHeader><DialogTitle>{{ kind === 'table' ? '编辑表格' : '编辑代码块' }}</DialogTitle><DialogDescription>{{ kind === 'table' ? '选择已有表格或在文末插入新表格，支持增删行列。' : '选择代码块并调整语言，或在文末插入新代码块。' }}</DialogDescription></DialogHeader>
  <FieldGroup><Field><FieldLabel>编辑对象</FieldLabel><Select v-model="target"><SelectTrigger aria-label="编辑对象"><SelectValue /></SelectTrigger><SelectContent><SelectGroup><SelectItem value="new">在文末插入</SelectItem><SelectItem v-for="(block,index) in blocks" :key="index" :value="String(index)">第 {{ index+1 }} 个{{ kind === 'table' ? '表格' : '代码块' }} · 第 {{ block.start+1 }} 行</SelectItem></SelectGroup></SelectContent></Select></Field></FieldGroup>
  <template v-if="kind === 'table'"><div class="structure-table"><table><tbody><tr v-for="(row,r) in cells" :key="r"><td v-for="(_,c) in row" :key="c"><Input v-model="row[c]" :aria-label="`表格第 ${r+1} 行第 ${c+1} 列`" /></td><td><Button variant="ghost" size="sm" :disabled="r<=1" @click="moveRow(r,-1)">↑</Button><Button variant="ghost" size="sm" :disabled="r===0||r===cells.length-1" @click="moveRow(r,1)">↓</Button><Button variant="ghost" size="sm" :disabled="r === 0" @click="cells.splice(r,1)">删除行</Button></td></tr><tr><td v-for="(_,c) in cells[0]" :key="c"><Select v-model="alignments[c]"><SelectTrigger size="sm" :aria-label="`第 ${c+1} 列对齐`" class="w-full"><SelectValue/></SelectTrigger><SelectContent><SelectGroup><SelectItem value="default">默认对齐</SelectItem><SelectItem value="left">左对齐</SelectItem><SelectItem value="center">居中</SelectItem><SelectItem value="right">右对齐</SelectItem></SelectGroup></SelectContent></Select><div><Button variant="ghost" size="sm" :disabled="c===0" @click="moveColumn(c,-1)">←</Button><Button variant="ghost" size="sm" :disabled="c===cells[0]!.length-1" @click="moveColumn(c,1)">→</Button></div><Button variant="ghost" size="sm" :disabled="cells[0]!.length <= 1" @click="cells.forEach(row => row.splice(c,1));alignments.splice(c,1)">删除列 {{ c+1 }}</Button></td></tr></tbody></table></div><div class="flex gap-2"><Button variant="outline" size="sm" :disabled="cells.length >= 100" @click="cells.push(cells[0]!.map(() => ''))">添加行</Button><Button variant="outline" size="sm" :disabled="cells[0]!.length >= 20" @click="cells.forEach(row => row.push(''));alignments.push('default')">添加列</Button></div><Textarea v-model="pasteText" aria-label="粘贴表格数据" placeholder="粘贴从电子表格复制的数据（制表符分隔）" class="min-h-20 text-sm"/><Button variant="outline" :disabled="!pasteText" @click="pasteTable">导入粘贴表格</Button></template>
  <FieldGroup v-else><Field><FieldLabel>代码语言</FieldLabel><Select v-model="language"><SelectTrigger aria-label="代码语言"><SelectValue /></SelectTrigger><SelectContent><SelectGroup><SelectItem v-if="!['text','javascript','typescript','python','rust','html','css','json','bash','sql','markdown'].includes(language)" :value="language">{{ language || '无语言' }}</SelectItem><SelectItem v-for="name in ['text','javascript','typescript','python','rust','html','css','json','bash','sql','markdown']" :key="name" :value="name">{{ name }}</SelectItem></SelectGroup></SelectContent></Select></Field><Field><FieldLabel for="code-block-content">代码内容</FieldLabel><textarea id="code-block-content" v-model="code" class="code-block-input" spellcheck="false" @keydown="codeKey" /></Field></FieldGroup>
  <DialogFooter><Button variant="outline" @click="emit('update:open',false)">取消</Button><Button @click="apply">应用</Button></DialogFooter>
</DialogContent></Dialog></template>

