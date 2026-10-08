import { ref } from 'vue'
import { call, desktop } from './api'
export const locked=ref(true), configured=ref(false)
export async function privacyStatus(){if(!desktop){locked.value=false;return}const status=await call<{locked:boolean;configured:boolean}>('privacy_status');locked.value=status.locked;configured.value=status.configured}
