import { inject, provide, shallowRef } from 'vue'
import type { InjectionKey } from 'vue'
import type { SnackbarMessage } from 'vuetify/lib/components/VSnackbarQueue/VSnackbarQueue.mjs'

interface SnackbarContext {
  notify: (message: SnackbarMessage) => void
}

const snackbarKey: InjectionKey<SnackbarContext> = Symbol('snackbar')

const notificationIcons = {
  error: 'mdi-alert-circle-outline',
  success: 'mdi-check-circle-outline',
  info: 'mdi-information-outline',
} as const

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

  const { notify } = snackbar

  function notifyStatus(text: string, status: keyof typeof notificationIcons) {
    notify({
      text,
      color: status,
      variant: 'tonal',
      rounded: 'lg',
      prependIcon: notificationIcons[status],
    })
  }

  return {
    notify,
    notifyError: (text: string) => notifyStatus(text, 'error'),
    notifySuccess: (text: string) => notifyStatus(text, 'success'),
    notifyInfo: (text: string) => notifyStatus(text, 'info'),
  }
}
