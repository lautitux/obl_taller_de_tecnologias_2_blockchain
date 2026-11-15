import { createRouter, createWebHistory } from 'vue-router'

import HomeView from '@/views/HomeView.vue'
import CreateAgreementView from '@/views/CreateAgreementView.vue'
import MyAgreementsView from '@/views/MyAgreementsView.vue'
import MyBenefitsView from '@/views/MyBenefitsView.vue'
import AgreementView from '@/views/AgreementView.vue'

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: '/agreements',
      name: 'my-agreements',
      component: MyAgreementsView,
    },
    {
      path: '/agreements/:id',
      component: AgreementView,
    },
    {
      path: '/benefit',
      name: 'my-benefit',
      component: MyBenefitsView,
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
