import { findMatches } from './search'
self.onmessage = (event: MessageEvent) => {
  try { const { text, query, sensitive, regex, replacement } = event.data; self.postMessage({ matches: findMatches(text, query, sensitive, regex, replacement) }) }
  catch (e) { self.postMessage({ error: e instanceof Error ? e.message : String(e) }) }
}
