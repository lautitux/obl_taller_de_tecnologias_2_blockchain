import { createRouter, createWebHistory } from 'vue-router'

import HomeView from '@/views/HomeView.vue'
import CreateAgreementView from '@/views/CreateAgreementView.vue'

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
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
