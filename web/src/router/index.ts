import { createRouter, createWebHistory } from 'vue-router'

import HomeView from '@/views/HomeView.vue'
import CreateAgreementView from '@/views/CreateAgreementView.vue'
import MyAgreementsView from '@/views/MyAgreementsView.vue'
import MyBenefitsView from '@/views/MyBenefitsView.vue'
import AgreementView from '@/views/AgreementView.vue'
import NotFoundView from '@/views/NotFoundView.vue'
import { notFoundLocation } from '@/router/not-found'
import { AGREEMENT_ID_PATTERN, parseAgreementId } from '@/utils/agreement-id'

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: '/agreements',
      name: 'my-agreements',
      component: MyAgreementsView,
    },
    {
      path: `/agreements/:id(${AGREEMENT_ID_PATTERN})`,
      name: 'agreement',
      component: AgreementView,
      beforeEnter: (to) =>
        parseAgreementId(to.params.id) === undefined ? notFoundLocation(to) : true,
    },
    {
      path: '/benefits',
      name: 'my-benefits',
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
    {
      path: '/:pathMatch(.*)*',
      name: 'not-found',
      component: NotFoundView,
    },
  ],
})

export default router
