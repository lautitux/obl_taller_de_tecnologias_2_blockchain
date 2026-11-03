<script setup lang="ts">
import { computed, shallowRef, watch } from 'vue'
import AgreementCard from '@/components/AgreementCard.vue'
import CancelAgreementDialog from '@/components/CancelAgreementDialog.vue'
import { useReadVesting, type MyAgreement } from '@/composables/useReadVesting'
import { agreementStatuses } from '@/utils/agreementDisplay'

const { agreements, unavailableReason, isLoading, isRefreshing, error, refresh, context } =
  useReadVesting()
const selectedAgreement = shallowRef<MyAgreement | null>(null)
const allStatuses = Object.keys(agreementStatuses) as MyAgreement['status'][]
const selectedStatuses = shallowRef([...allStatuses])
const statusOptions = Object.entries(agreementStatuses).map(([value, { title }]) => ({
  title,
  value,
}))
const filteredAgreements = computed(() =>
  agreements.value.filter((agreement) => selectedStatuses.value.includes(agreement.status)),
)
watch(context, () => {
  selectedAgreement.value = null
  selectedStatuses.value = [...allStatuses]
})
// Keep the confirmation amounts and eligibility aligned with refreshed contract state.
watch(agreements, (items) => {
  if (selectedAgreement.value) {
    selectedAgreement.value = items.find((item) => item.id === selectedAgreement.value?.id) ?? null
  }
})
</script>

<template>
  <div>
    <header class="d-flex flex-wrap align-center justify-space-between ga-4 mb-6">
      <div>
        <h1 id="agreements-title" class="text-h4 mb-4">Acuerdos creados</h1>
        <p>Seguí los acuerdos donde tu billetera es pagadora y la liberación de sus tokens.</p>
      </div>
      <v-btn color="primary" prepend-icon="mdi-plus" :to="{ name: 'create-agreement' }"
        >Crear acuerdo</v-btn
      >
    </header>

    <v-alert v-if="unavailableReason" type="info" variant="tonal">{{ unavailableReason }}</v-alert>
    <template v-else>
      <section aria-labelledby="agreements-title">
        <div class="d-flex flex-wrap align-center justify-space-between ga-2 mb-2">
          <v-chip-group
            v-model="selectedStatuses"
            multiple
            column
            color="primary"
            aria-label="Filtrar acuerdos por estados"
          >
            <v-chip
              v-for="option in statusOptions"
              :key="option.value"
              :value="option.value"
              variant="tonal"
              filter
            >
              {{ option.title }}
            </v-chip>
          </v-chip-group>
          <v-btn
            variant="text"
            prepend-icon="mdi-refresh"
            :loading="isRefreshing"
            @click="refresh()"
            >Actualizar</v-btn
          >
        </div>
        <p class="text-body-2 text-medium-emphasis mb-4">
          El progreso representa lo devengado sobre el monto total, incluidos los tokens ya
          retirados. Se actualiza cada 15 segundos.
        </p>
        <v-alert
          v-if="error"
          type="error"
          variant="tonal"
          class="mb-4"
          title="No pudimos actualizar los acuerdos"
        >
          Revisá la red y la dirección del contrato en Configuración e intentá nuevamente.
          <template #append
            ><v-btn variant="text" :disabled="isRefreshing" @click="refresh()"
              >Reintentar</v-btn
            ></template
          >
        </v-alert>
        <v-row v-if="isLoading" aria-label="Cargando acuerdos" aria-busy="true">
          <v-col v-for="item in 2" :key="item" cols="12" lg="6"
            ><v-skeleton-loader type="article, paragraph, actions"
          /></v-col>
        </v-row>
        <v-row v-else-if="filteredAgreements.length">
          <v-col v-for="agreement in filteredAgreements" :key="agreement.id" cols="12" lg="6">
            <AgreementCard
              :agreement="agreement"
              :disabled="!!error"
              @cancel="selectedAgreement = $event"
            />
          </v-col>
        </v-row>
        <v-empty-state
          v-else-if="!error"
          icon="mdi-file-document-multiple-outline"
          :title="
            agreements.length ? 'No hay acuerdos con estos estados' : 'Todavía no creaste acuerdos'
          "
          :text="
            agreements.length
              ? 'Elegí uno o más estados o seleccioná Ver todos para mostrar todos tus acuerdos.'
              : 'Cuando crees tu primer acuerdo con esta billetera, aparecerá acá.'
          "
        >
          <template #actions>
            <v-btn
              v-if="agreements.length"
              variant="text"
              @click="selectedStatuses = [...allStatuses]"
              >Ver todos</v-btn
            >
            <v-btn v-else color="primary" :to="{ name: 'create-agreement' }">Crear acuerdo</v-btn>
          </template>
        </v-empty-state>
      </section>
    </template>
    <CancelAgreementDialog v-model="selectedAgreement" @cancelled="refresh()" />
  </div>
</template>
