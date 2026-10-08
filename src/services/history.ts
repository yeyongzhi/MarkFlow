export interface HistoryState { past: string[]; future: string[]; updated: number; group: string }
const MAX_BYTES = 32 * 1024 * 1024
export function record(state: HistoryState, before: string, group = 'typing', now = Date.now()) {
  if (!state.past.length || state.group !== group || group !== 'typing' || now - state.updated > 750) state.past.push(before)
  state.future = []; state.updated = now; state.group = group
  let bytes = state.past.reduce((n, s) => n + s.length * 2, 0)
  while (state.past.length > 1 && (state.past.length > 200 || bytes > MAX_BYTES)) bytes -= state.past.shift()!.length * 2
}
export function travel(state: HistoryState, current: string, redo = false) {
  const from = redo ? state.future : state.past, to = redo ? state.past : state.future
  const value = from.pop(); if (value === undefined) return undefined
  to.push(current); state.updated = 0; state.group = ''; return value
}
