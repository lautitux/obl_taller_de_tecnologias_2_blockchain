import { inject, provide, ref } from 'vue'
import type { InjectionKey } from 'vue'
import type { SnackbarMessage } from 'vuetify/lib/components/VSnackbarQueue/VSnackbarQueue.mjs'

interface SnackbarContext {
  notify: (message: SnackbarMessage) => void
}

const snackbarKey: InjectionKey<SnackbarContext> = Symbol('snackbar')

export function provideSnackbarQueue() {
  const messages = ref<SnackbarMessage[]>([])

  provide(snackbarKey, {
    notify(message) {
      messages.value.push(message)
    },
  })

  return { messages }
}

export function useSnackbar() {
  const snackbar = inject(snackbarKey)

  if (!snackbar) {
    throw new Error('useSnackbar debe usarse dentro del proveedor de App.vue')
  }

  return snackbar
}
