import { createRouter, createWebHistory } from 'vue-router'

import HomeView from '@/views/HomeView.vue'
import CreateAgreementView from '@/views/CreateAgreementView.vue'
import SettingsView from '@/views/SettingsView.vue'

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: '/settings',
      name: 'settings',
      component: SettingsView,
    },
    {
      path: '/',
      name: 'home',
      component: HomeView,
    },
    {
      path: '/agreements/create',
      name: 'create-agreement',
      component: CreateAgreementView,
    },
  ],
})

export default router
