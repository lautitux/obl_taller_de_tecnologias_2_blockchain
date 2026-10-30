<script setup lang="ts">
import { ref } from 'vue'
import { RouterView } from 'vue-router'
import AppHeader from '@/components/AppHeader.vue'
import AppNavigation from '@/components/AppNavigation.vue'

const drawerOpen = ref(false)
</script>

<template>
  <v-app lang="es">
    <AppHeader :navigation-open="drawerOpen" @toggle-navigation="drawerOpen = !drawerOpen" />
    <AppNavigation v-model="drawerOpen" />

    <v-main id="main-content" tabindex="-1">
      <v-container>
        <RouterView />
      </v-container>
    </v-main>
  </v-app>
</template>
