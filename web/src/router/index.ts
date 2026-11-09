import { createRouter, createWebHistory } from 'vue-router'

import HomeView from '@/views/HomeView.vue'
import CreateAgreementView from '@/views/CreateAgreementView.vue'
import SettingsView from '@/views/SettingsView.vue'
import MyAgreementsView from '@/views/MyAgreementsView.vue'
import MyBenefitsView from '@/views/MyBenefitsView.vue'

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: '/agreements',
      name: 'my-agreements',
      component: MyAgreementsView,
    },
    {
      path: '/benefit',
      name: 'my-benefit',
      component: MyBenefitsView,
    },
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
