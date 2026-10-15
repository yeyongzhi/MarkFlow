import { createApp } from 'vue'
import { createPinia } from 'pinia'
import App from './App.vue'
import './styles.css'

if (!import.meta.env.DEV) document.addEventListener('contextmenu', event => event.preventDefault())

createApp(App).use(createPinia()).mount('#app')
