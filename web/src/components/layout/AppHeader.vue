<script setup lang="ts">
import { useDisplay } from 'vuetify'
import WalletConnectButton from '@/components/wallet/WalletConnectButton.vue'
import AccountChip from '@/components/wallet/AccountChip.vue'
import NetworkChip from '@/components/wallet/NetworkChip.vue'

defineProps<{ navigationOpen: boolean }>()
const emit = defineEmits<{ toggleNavigation: [] }>()

const { mdAndUp } = useDisplay()

const logoUrl = `${import.meta.env.BASE_URL}favicon.svg`
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
    <v-app-bar-title>
      <router-link :to="{ name: 'home' }" class="app-brand">
        <img :src="logoUrl" alt="" width="28" height="28" />
        <span>Acuerdos</span>
      </router-link>
    </v-app-bar-title>

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

<style scoped>
.app-brand {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  color: inherit;
  text-decoration: none;
}
</style>
