import { templates } from './writing'
import type { Template } from '@/types'
export function templateCatalog(custom:Template[],hidden:string[]=[]):Template[]{
 const overrides=new Map(custom.map(t=>[t.id,t]))
 return [...templates.map(t=>overrides.get(t.id)||t),...custom.filter(t=>!templates.some(b=>b.id===t.id))].filter(t=>!hidden.includes(t.id))
}
