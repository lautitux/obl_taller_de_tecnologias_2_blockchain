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
  defaults: {
    VTextField: { variant: 'outlined' },
    VDateInput: { variant: 'outlined' },
    VSelect: { variant: 'outlined' },
    VAutocomplete: { variant: 'outlined' },
    VCombobox: { variant: 'outlined' },
    VTextarea: { variant: 'outlined' },
  },
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
