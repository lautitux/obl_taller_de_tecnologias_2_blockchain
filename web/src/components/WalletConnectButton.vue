<script setup lang="ts">
import { shallowRef, useId } from 'vue'

const { compact = false } = defineProps<{ compact?: boolean }>()
const dialogOpen = shallowRef(false)
const titleId = useId()
</script>

<template>
  <v-dialog v-model="dialogOpen" max-width="480" :aria-labelledby="titleId">
    <template #activator="{ props }">
      <v-btn
        v-bind="props"
        color="primary"
        prepend-icon="mdi-wallet-plus-outline"
        aria-label="Conectar billetera"
      >
        {{ compact ? 'Conectar' : 'Conectar billetera' }}
      </v-btn>
    </template>
    <v-card>
      <v-card-title :id="titleId" tag="h2" class="text-wrap">Conectar billetera</v-card-title>
      <v-card-text>
        La conexión con billeteras EVM estará disponible próximamente. Por ahora podés conocer las
        secciones de la aplicación desde Inicio.
      </v-card-text>
      <v-card-actions>
        <v-spacer />
        <v-btn color="primary" @click="dialogOpen = false">Cerrar</v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>
