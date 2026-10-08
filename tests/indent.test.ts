import { it,expect } from 'vitest'
import { indentSelection } from '../src/services/indent'
it('indents selected lines without replacing the code',()=>{const original='const a = 1;\nconsole.log(a);\nnext';const result=indentSelection(original,0,27);expect(result.text).toBe('  const a = 1;\n  console.log(a);\nnext');expect(indentSelection(result.text,result.start,result.end,true).text).toBe(original)})
it('inserts spaces at a caret and outdents the current line',()=>{expect(indentSelection('x',0,0).text).toBe('  x');expect(indentSelection('  x',2,2,true).text).toBe('x')})
it('does not indent the next line when the selected range ends at its start',()=>{expect(indentSelection('a\nb\nc',0,4).text).toBe('  a\n  b\nc')})
