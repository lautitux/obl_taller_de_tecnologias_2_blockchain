<script setup lang="ts">
import { computed } from 'vue'
import type { MyAgreement } from '@/composables/useReadVesting'
import {
  agreementStatuses,
  formatAgreementAmount,
  formatAgreementDate,
} from '@/utils/agreementDisplay'

const { agreement, disabled = false } = defineProps<{
  agreement: MyAgreement
  disabled?: boolean
}>()
defineEmits<{ cancel: [agreement: MyAgreement] }>()
const status = computed(() => agreementStatuses[agreement.status])
const cancellationHint = computed(() => {
  if (agreement.status === 'cancelled') return 'El monto devengado quedó fijado al cancelar.'
  if (!agreement.revocable) return 'Este acuerdo no admite cancelación.'
  if (!agreement.canCancel) return 'El período de cancelación terminó.'
  return 'Podés recuperar los tokens que todavía no se devengaron.'
})
</script>

<template>
  <v-card tag="article" variant="tonal" class="h-100 d-flex flex-column">
    <v-card-item class="pb-2">
      <template #title
        ><h2 class="text-subtitle-1 font-weight-medium">Acuerdo #{{ agreement.id }}</h2></template
      >
      <template #append>
        <v-chip :color="status.color" :prepend-icon="status.icon" size="small" variant="tonal">{{
          status.title
        }}</v-chip>
      </template>
    </v-card-item>
    <v-card-text class="flex-grow-1 pb-2">
      <p class="text-caption text-medium-emphasis">Beneficiario</p>
      <p class="text-body-2 text-break mb-3">{{ agreement.beneficiary }}</p>
      <v-row dense>
        <v-col cols="6">
          <p class="text-caption text-medium-emphasis">Monto total</p>
          <p class="text-subtitle-1 font-weight-medium text-break">
            {{ formatAgreementAmount(agreement.totalAmount, agreement) }}
          </p>
        </v-col>
        <v-col cols="6">
          <p class="text-caption text-medium-emphasis">Monto devengado</p>
          <p class="text-subtitle-1 font-weight-medium text-break">
            {{ formatAgreementAmount(agreement.vestedAmount, agreement) }}
          </p>
        </v-col>
      </v-row>
      <div class="d-flex justify-space-between ga-2 mt-3 mb-1 text-caption">
        <span>Progreso devengado</span><span>{{ agreement.progress }} %</span>
      </div>
      <v-progress-linear
        :model-value="agreement.progress"
        :color="status.color"
        height="6"
        rounded
        :aria-label="`Progreso devengado del acuerdo ${agreement.id}`"
      />
      <v-row dense class="mt-2 text-caption">
        <v-col cols="6"
          ><p class="text-medium-emphasis">Inicio</p>
          <p>{{ formatAgreementDate(agreement.startDate) }}</p></v-col
        >
        <v-col cols="6"
          ><p class="text-medium-emphasis">Fin</p>
          <p>{{ formatAgreementDate(agreement.endDate) }}</p></v-col
        >
      </v-row>
      <p class="text-caption text-medium-emphasis mt-2">
        Token: <span class="text-break">{{ agreement.token }}</span>
      </p>
    </v-card-text>
    <v-card-actions class="px-4 pb-3 pt-0">
      <v-btn
        v-if="agreement.canCancel"
        color="error"
        variant="text"
        prepend-icon="mdi-cancel"
        :disabled="disabled"
        @click="$emit('cancel', agreement)"
        >Cancelar acuerdo</v-btn
      >
      <p v-else class="text-caption text-medium-emphasis">{{ cancellationHint }}</p>
    </v-card-actions>
  </v-card>
</template>
