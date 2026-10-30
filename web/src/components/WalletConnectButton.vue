<script setup lang="ts">
import { useConnect, useConnectors, useConnection, useDisconnect } from '@wagmi/vue'
import { useSnackbar } from '@/composables/useSnackbar'

const { compact = false } = defineProps<{ compact?: boolean }>()

const { notify } = useSnackbar()

const connectors = useConnectors()
const { mutate: connect, isPending } = useConnect({
  mutation: {
    onError() {
      notify({
        text: 'Error de conexión con la billetera.',
        color: 'error',
        variant: 'tonal',
        prependIcon: 'mdi-sync-off',
      })
    },
  },
})
const { mutate: disconnect } = useDisconnect()
const { isConnected, connector } = useConnection()
</script>

<template>
  <v-menu v-if="!isConnected">
    <template v-slot:activator="{ props }">
      <v-btn
        color="primary"
        v-bind="props"
        prepend-icon="mdi-wallet-plus-outline"
        aria-label="Conectar billetera"
      >
        {{ compact ? 'Conectar' : 'Conectar billetera' }}
      </v-btn>
    </template>
    <v-list>
      <v-list-item
        v-for="connector in connectors"
        :key="connector.uid"
        :disabled="isPending"
        @click="connect({ connector })"
      >
        <template #prepend>
          <v-avatar size="24" rounded="0">
            <v-img
              v-if="connector.icon"
              :src="connector.icon"
              :alt="`Icono de ${connector.name}`"
              :cover="false"
            />
            <v-icon v-else>mdi-wallet-outline</v-icon>
          </v-avatar>
        </template>
        <v-list-item-title>{{ connector.name }}</v-list-item-title>
      </v-list-item>
    </v-list>
  </v-menu>
  <v-btn v-else color="error" prepend-icon="mdi-logout" @click="disconnect({ connector })">
    Desconectar
  </v-btn>
</template>
