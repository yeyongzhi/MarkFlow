import { expect,it } from 'vitest'
import { templateCatalog } from '../src/services/template-catalog'
it('overrides and hides builtins without duplicating them',()=>{const result=templateCatalog([{id:'meeting',name:'新会议',text:'changed'},{id:'custom',name:'自定义',text:''}],['journal']);expect(result.find(t=>t.id==='meeting')?.text).toBe('changed');expect(result.filter(t=>t.id==='meeting')).toHaveLength(1);expect(result.some(t=>t.id==='journal')).toBe(false);expect(result.some(t=>t.id==='custom')).toBe(true)})
