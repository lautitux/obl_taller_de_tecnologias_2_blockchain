<script setup lang="ts">
import { useDisplay } from 'vuetify'
import WalletConnectButton from '@/components/WalletConnectButton.vue'

defineProps<{ navigationOpen: boolean }>()
const emit = defineEmits<{ toggleNavigation: [] }>()

const { mdAndUp } = useDisplay()
</script>

<template>
  <v-app-bar>
    <v-app-bar-nav-icon
      v-if="!mdAndUp"
      aria-label="Abrir o cerrar navegación"
      aria-controls="main-navigation"
      :aria-expanded="navigationOpen"
      @click="emit('toggleNavigation')"
    />
    <v-app-bar-title>Acuerdos</v-app-bar-title>

    <template v-if="mdAndUp">
      <v-chip prepend-icon="mdi-wallet-outline" class="mr-2">Billetera sin conectar</v-chip>
      <v-chip prepend-icon="mdi-lan-disconnect" class="mr-2">Red no disponible</v-chip>
    </template>

    <WalletConnectButton :compact="!mdAndUp" />

    <template v-if="!mdAndUp" #extension>
      <v-spacer />
      <v-chip prepend-icon="mdi-wallet-outline" class="mr-2">Billetera sin conectar</v-chip>
      <v-spacer />
      <v-chip prepend-icon="mdi-lan-disconnect" class="mr-2">Red no disponible</v-chip>
      <v-spacer />
    </template>
  </v-app-bar>
</template>
