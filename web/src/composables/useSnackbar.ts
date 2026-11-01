import { inject, provide, shallowRef } from 'vue'
import type { InjectionKey } from 'vue'
import type { SnackbarMessage } from 'vuetify/lib/components/VSnackbarQueue/VSnackbarQueue.mjs'

interface SnackbarContext {
  notify: (message: SnackbarMessage) => void
}

const snackbarKey: InjectionKey<SnackbarContext> = Symbol('snackbar')

export function provideSnackbarQueue() {
  const messages = shallowRef<SnackbarMessage[]>([])

  provide(snackbarKey, {
    notify(message) {
      messages.value = [message, ...messages.value]
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
