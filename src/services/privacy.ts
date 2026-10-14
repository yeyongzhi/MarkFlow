import { ref } from 'vue'
import { call, desktop } from './api'
export const locked=ref(true), configured=ref(false)
export async function privacyStatus(){if(!desktop){locked.value=false;return}const status=await call<{locked:boolean;configured:boolean;theme?:{mode?:'light'|'dark'|'system';accent?:string}}>('privacy_status');locked.value=status.locked;configured.value=status.configured;if(status.theme){const root=document.documentElement,accent=status.theme.accent;if(accent&&/^#[0-9a-f]{6}$/i.test(accent)){root.style.setProperty('--primary',accent);root.style.setProperty('--ring',accent)}if(status.theme.mode){const dark=status.theme.mode==='dark'||(status.theme.mode==='system'&&matchMedia('(prefers-color-scheme: dark)').matches);root.classList.toggle('dark',dark)}}}
