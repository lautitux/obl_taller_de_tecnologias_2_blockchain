import { createApp } from 'vue'
import App from './App.vue'
import router from './router'

import '@mdi/font/css/materialdesignicons.css'
import 'vuetify/styles'
import { createVuetify } from 'vuetify'
import { es } from 'vuetify/locale'

import { WagmiPlugin } from '@wagmi/vue'
import { wagmiConfig } from './wagmi-config'

import { QueryClient, VueQueryPlugin } from '@tanstack/vue-query'

const app = createApp(App)

app.use(router)

const vuetify = createVuetify({
  locale: {
    locale: 'es',
    messages: { es },
  },
})
app.use(vuetify)

app.use(WagmiPlugin, { config: wagmiConfig })

const queryClient = new QueryClient()
app.use(VueQueryPlugin, { queryClient })

app.mount('#app')
