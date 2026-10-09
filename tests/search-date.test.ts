import { expect,it } from 'vitest'
import { inCreationRange } from '../src/services/search-date'
it('includes the full local start and end days',()=>{
 expect(inCreationRange(new Date(2026,9,1,0,0).getTime(),'2026-10-01','2026-10-02')).toBe(true)
 expect(inCreationRange(new Date(2026,9,2,23,59,59).getTime(),'2026-10-01','2026-10-02')).toBe(true)
 expect(inCreationRange(new Date(2026,9,3,0,0).getTime(),'2026-10-01','2026-10-02')).toBe(false)
})
it('handles unknown dates and open ranges',()=>{
 expect(inCreationRange(null,'','')).toBe(true)
 expect(inCreationRange(null,'2026-10-01','')).toBe(false)
 expect(inCreationRange(new Date(2026,9,2).getTime(),'','2026-10-01')).toBe(false)
 expect(inCreationRange(new Date(2026,9,2).getTime(),'2026-10-01','')).toBe(true)
 expect(inCreationRange(0,'2026-10-02','2026-10-01')).toBe(false)
})
