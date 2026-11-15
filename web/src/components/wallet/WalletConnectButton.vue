<script setup lang="ts">
import { useConnect, useConnectors, useConnection, useDisconnect } from '@wagmi/vue'
import { useSnackbar } from '@/composables/useSnackbar'

const { compact = false } = defineProps<{ compact?: boolean }>()

const { notifyError } = useSnackbar()

const connectors = useConnectors()
const { mutate: connect, isPending } = useConnect({
  mutation: {
    onError() {
      notifyError('Error de conexión con la billetera.')
    },
  },
})
const { mutate: disconnect } = useDisconnect()
const { isConnected, connector } = useConnection()
</script>

<template>
  <v-menu v-if="!isConnected">
    <template #activator="{ props }">
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
        v-for="availableConnector in connectors"
        :key="availableConnector.uid"
        :disabled="isPending"
        @click="connect({ connector: availableConnector })"
      >
        <template #prepend>
          <v-avatar size="24" rounded="0">
            <v-img
              v-if="availableConnector.icon"
              :src="availableConnector.icon"
              :alt="`Icono de ${availableConnector.name}`"
              :cover="false"
            />
            <v-icon v-else>mdi-wallet-outline</v-icon>
          </v-avatar>
        </template>
        <v-list-item-title>{{ availableConnector.name }}</v-list-item-title>
      </v-list-item>
    </v-list>
  </v-menu>
  <v-btn v-else color="error" prepend-icon="mdi-logout" @click="disconnect({ connector })">
    Desconectar
  </v-btn>
</template>
