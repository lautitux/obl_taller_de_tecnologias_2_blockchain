<script setup lang="ts">
import { useConnection } from '@wagmi/vue'

const { compact = false } = defineProps<{ compact?: boolean }>()
const { address, isConnected } = useConnection()
</script>

<template>
  <v-chip
    prepend-icon="mdi-wallet-outline"
    :color="isConnected ? 'primary' : undefined"
    class="mr-2"
  >
    <span v-if="isConnected">
      {{ compact ? address?.slice(0, 7) + '...' + address?.slice(-5) : address }}
    </span>
    <span v-else> Billetera sin conectar </span>
  </v-chip>
</template>
