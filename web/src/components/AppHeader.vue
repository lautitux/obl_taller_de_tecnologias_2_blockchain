<script setup lang="ts">
import { useDisplay } from 'vuetify'
import WalletConnectButton from '@/components/WalletConnectButton.vue'
import AccountChip from './AccountChip.vue'
import NetworkChip from './NetworkChip.vue'

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
      <AccountChip :compact="!mdAndUp" />
      <NetworkChip :compact="!mdAndUp" />
    </template>

    <WalletConnectButton :compact="!mdAndUp" />

    <template v-if="!mdAndUp" #extension>
      <v-spacer />
      <AccountChip :compact="!mdAndUp" />
      <NetworkChip :compact="!mdAndUp" />
    </template>
  </v-app-bar>
</template>
