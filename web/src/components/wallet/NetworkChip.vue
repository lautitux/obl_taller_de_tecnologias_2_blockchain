<script setup lang="ts">
import { useConnection } from '@wagmi/vue'

const { chain, isConnected } = useConnection()
</script>

<template>
  <v-chip
    v-if="isConnected"
    :color="chain ? 'primary' : 'warning'"
    prepend-icon="mdi-lan"
    class="mr-2"
  >
    {{ chain ? chain.name : 'Red desconocida' }}
  </v-chip>
  <v-chip v-else prepend-icon="mdi-lan-disconnect" class="mr-2"> Red no disponible </v-chip>
</template>
