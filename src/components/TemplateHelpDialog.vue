<script setup lang="ts">
import { Dialog,DialogContent,DialogHeader,DialogTitle,DialogDescription } from '@/components/ui/dialog'
const open=defineModel<boolean>('open',{required:true})
</script>
<template><Dialog v-model:open="open"><DialogContent class="sm:max-w-2xl"><DialogHeader><DialogTitle>模板使用说明</DialogTitle><DialogDescription>了解占位符和新建文档时的使用方式。</DialogDescription></DialogHeader><div class="rounded-lg border bg-muted/20 p-4 text-sm leading-7"><p>占位符会在新建文档时自动替换：</p><p><code v-pre>{{title}}</code> → 新文档名称（不含 .md）；<code v-pre>{{date}}</code> → 创建文档当天的日期。</p><p>例如模板填写下面的内容：</p><pre class="mt-2 whitespace-pre-wrap rounded-md bg-muted p-3 text-xs" v-pre># {{title}}

日期：{{date}}

## 正文</pre><p class="mt-2">保存模板后，通过“文件 → 新建文档”或 Ctrl+N，在“文档模板”中选择它。双击标签栏创建的空白临时文档不会套用模板。</p></div></DialogContent></Dialog></template>
