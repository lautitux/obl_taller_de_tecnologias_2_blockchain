<script setup lang="ts">
import { watch } from 'vue'
import { useRoute } from 'vue-router'
import type { RouteLocationRaw } from 'vue-router'
import { useDisplay } from 'vuetify'

interface NavigationItem {
  title: string
  icon: string
  to?: RouteLocationRaw
  disabled: boolean
}

const navigationItems: NavigationItem[] = [
  { title: 'Inicio', icon: 'mdi-home-outline', to: { name: 'home' }, disabled: false },
  {
    title: 'Crear acuerdo',
    icon: 'mdi-file-document-plus-outline',
    to: { name: 'create-agreement' },
    disabled: false,
  },
  { title: 'Acuerdos creados', icon: 'mdi-file-document-multiple-outline', disabled: true },
  { title: 'Mis ingresos', icon: 'mdi-wallet-outline', disabled: true },
]

const open = defineModel<boolean>({ required: true })
const { mdAndUp } = useDisplay()
const route = useRoute()

watch(
  () => route.fullPath,
  () => {
    open.value = false
  },
)
</script>

<template>
  <v-navigation-drawer
    id="main-navigation"
    :model-value="mdAndUp || open"
    :permanent="mdAndUp"
    :temporary="!mdAndUp"
    @update:model-value="open = $event"
    @keydown.esc="open = false"
  >
    <nav aria-label="Navegación principal">
      <v-list nav>
        <v-list-subheader>Tu espacio</v-list-subheader>
        <v-list-item
          v-for="item in navigationItems"
          :key="item.title"
          :to="item.to"
          :disabled="item.disabled"
          :prepend-icon="item.icon"
          :title="item.title"
          :subtitle="item.disabled ? 'Próximamente' : undefined"
          @click="open = false"
        />
      </v-list>
    </nav>
    <template #append>
      <v-divider />
      <v-list nav aria-label="Configuración">
        <v-list-item
          title="Configuración"
          prepend-icon="mdi-cog-outline"
          :to="{ name: 'settings' }"
          @click="open = false"
        />
      </v-list>
    </template>
  </v-navigation-drawer>
</template>
