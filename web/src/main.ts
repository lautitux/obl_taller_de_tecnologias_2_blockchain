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
import { persistQueryClient } from '@tanstack/query-persist-client-core'
import { hardhat } from '@wagmi/vue/chains'
import { createQueryCachePersister } from './services/query-persistence'

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

async function startApp() {
  try {
    const [, restorePromise] = persistQueryClient({
      queryClient,
      persister: createQueryCachePersister(),
      buster: 'agreement-events-v1',
      maxAge: 7 * 24 * 60 * 60 * 1_000,
      dehydrateOptions: {
        shouldDehydrateQuery: (query) =>
          query.state.status === 'success' &&
          query.queryKey[0] === 'agreement-events' &&
          query.queryKey[1] !== hardhat.id,
      },
    })

    await restorePromise
  } catch (error) {
    console.error('No se pudo restaurar la cache de eventos. La aplicación continuará.', error)
  }

  app.mount('#app')
}

void startApp()
