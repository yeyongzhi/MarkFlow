import {describe,it,expect} from 'vitest'
import {record,travel,type HistoryState} from '../src/services/history'
import {tidy,moveParagraph,fuzzy,templates,templateText} from '../src/services/writing'
describe('unified history',()=>{
 it('groups continuous input but isolates image and tag operations',()=>{const state:HistoryState={past:[],future:[],updated:0,group:''};record(state,'','typing',100);record(state,'a','typing',200);record(state,'ab','image',250);record(state,'ab![x](x.png)','tags',300);expect(travel(state,'with tags')).toBe('ab![x](x.png)');expect(travel(state,'ab![x](x.png)')).toBe('ab');expect(travel(state,'ab')).toBe('');expect(travel(state,'',true)).toBe('ab')})
 it('discards redo after a new branch',()=>{const state:HistoryState={past:[],future:[],updated:0,group:''};record(state,'before','format');travel(state,'after');record(state,'before','tags');expect(state.future).toEqual([])})
})
describe('writing transformations',()=>{
 it('keeps code and frontmatter untouched while tidying prose',()=>{const header='---\ntitle: note\ncustom: |\n  * keep\n---\n';const code='```text\n* unchanged   \n\n\n\n```';const value=tidy(header+'* item\n\n\n\n'+code);expect(value.startsWith(header)).toBe(true);expect(value).toContain('- item');expect(value).toContain(code);expect(value).not.toContain('item\n\n\n\n')})
 it('moves paragraphs without merging them',()=>{expect(moveParagraph('first\n\nsecond',7,7,-1)?.text).toBe('second\n\nfirst');expect(moveParagraph('first\n\nsecond',0,0,1)?.text).toBe('second\n\nfirst')})
 it('moves headings with their entire section and keeps lists separate',()=>{expect(moveParagraph('# A\n\nalpha\n\n# B\n\nbeta\n',0,0,1)?.text).toBe('# B\n\nbeta\n\n# A\n\nalpha\n');expect(moveParagraph('- a\n- b',4,4,-1)?.text).toBe('- b\n- a')})
 it('matches subsequences and expands template placeholders into real lines',()=>{expect(fuzzy('xmd','notes/example.md')).toBe(true);expect(fuzzy('zz','example.md')).toBe(false);expect(fuzzy('TEST','test.md',true)).toBe(false);expect(fuzzy('TEST','test.md')).toBe(true);const t=templates.find(t=>t.id==='meeting')!;expect(templateText(t.text,'Meeting.md')).toContain('# Meeting\n');expect(templateText(t.text,'Meeting.md')).not.toContain('{{date}}')})
})
