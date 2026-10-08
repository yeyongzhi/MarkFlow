import { call } from './api'
import { useWorkbench } from '@/stores/workbench'
import { documentTags, setDocumentTags } from './frontmatter'
import type { DiskDocument } from '@/types'
export async function changeTag(old: string, next?: string) {
  const store=useWorkbench(); if (!await store.flush()) throw new Error('请先处理尚未保存或存在冲突的文档。')
  const files=await call<{workspaceId:string;path:string;text:string;hash:string}[]>('tag_candidates')
  const changes=files.flatMap(file => { const tags=documentTags(file.text); return tags.includes(old) ? [{workspaceId:file.workspaceId,path:file.path,expectedHash:file.hash,text:setDocumentTags(file.text,tags.flatMap(tag => tag===old ? next ? [next] : [] : [tag]))}] : [] })
  const updated=await call<DiskDocument[]>('apply_tag_changes',{changes})
  for(const value of updated){const doc=store.documents.find(d=>d.id===value.id);if(doc){store.change(doc,value.text,'bulk-tags');Object.assign(doc,value);doc.savedRevision=doc.revision;doc.status='clean';doc.generation++}}
  if(next&&store.preferences.tagColors[old])store.preferences.tagColors[next]=store.preferences.tagColors[old];delete store.preferences.tagColors[old];
  store.preferences.tags=store.preferences.tags.flatMap(tag=>tag===old ? next ? [next] : [] : [tag]);return changes.length
}
