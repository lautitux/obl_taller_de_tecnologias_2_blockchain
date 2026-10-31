<script setup lang="ts">
import { ref } from 'vue'
import { RouterView } from 'vue-router'
import AppHeader from '@/components/AppHeader.vue'
import AppNavigation from '@/components/AppNavigation.vue'
import { provideSnackbarQueue } from '@/composables/useSnackbar'

const drawerOpen = ref(false)
const { messages } = provideSnackbarQueue()
</script>

<template>
  <v-app lang="es">
    <AppHeader :navigation-open="drawerOpen" @toggle-navigation="drawerOpen = !drawerOpen" />
    <AppNavigation v-model="drawerOpen" />

    <v-main id="main-content" tabindex="-1">
      <v-container>
        <RouterView v-slot="{ Component, route }">
          <v-slide-x-transition mode="out-in">
            <div :key="route.path">
              <component :is="Component" />
            </div>
          </v-slide-x-transition>
        </RouterView>
      </v-container>
    </v-main>

    <v-snackbar-queue
      v-model="messages"
      color="info"
      :timeout="3000"
      timer="bottom"
      timer-color="text"
      closable
      close-text="Descartar"
    />
  </v-app>
</template>
