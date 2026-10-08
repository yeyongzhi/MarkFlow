import { ref } from 'vue'
export const knowledgeVersion=ref(0)
export function invalidateKnowledge(){knowledgeVersion.value++}
