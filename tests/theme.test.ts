import {it,expect} from 'vitest'
import {contrast,readableText} from '../src/services/theme'
it('keeps custom text readable on light and dark surfaces',()=>{expect(contrast('#ffffff','#000000')).toBeCloseTo(21);expect(readableText('#ffffff','#ffffff')).toBe('#111111');expect(readableText('#111111','#111111')).toBe('#ffffff');expect(readableText('#ffffff','#333333')).toBe('#333333')})
