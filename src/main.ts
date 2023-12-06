import './assets/main.css'

import PirmeVue from 'primevue/config'
import { createApp } from 'vue'
import App from './App.vue'

import 'primevue/resources/themes/lara-light-blue/theme.css'

const app = createApp(App)
app.use(PirmeVue)
app.mount('#app')
