<script setup lang="ts">
import { watch } from 'vue'
import type { MyAgreement } from '@/composables/useReadVesting'
import { useCancelAgreement } from '@/composables/useCancelAgreement'
import { formatAgreementAmount } from '@/utils/agreementDisplay'

const agreement = defineModel<MyAgreement | null>({ required: true })
const emit = defineEmits<{ cancelled: [] }>()
const { cancel, reset, isCancelling, statusText, errorMessage, transactionHash } =
  useCancelAgreement()
watch(() => agreement.value?.id, reset)

async function confirm() {
  if (!agreement.value) return
  if (await cancel(agreement.value)) {
    agreement.value = null
    emit('cancelled')
  }
}
</script>

<template>
  <v-dialog
    :model-value="!!agreement"
    :persistent="isCancelling"
    max-width="560"
    aria-labelledby="cancel-agreement-title"
    @update:model-value="!$event && (agreement = null)"
  >
    <v-card v-if="agreement">
      <v-card-title id="cancel-agreement-title" tag="h2" class="text-wrap"
        >¿Cancelar el acuerdo #{{ agreement.id }}?</v-card-title
      >
      <v-card-text>
        <p>El acuerdo dejará de devengar tokens. Esta acción no se puede deshacer.</p>
        <v-list class="my-3" bg-color="transparent">
          <v-list-item prepend-icon="mdi-wallet-outline" title="Devolución estimada a tu billetera">
            <p class="text-body-1 text-break">
              {{ formatAgreementAmount(agreement.totalAmount - agreement.vestedAmount, agreement) }}
            </p>
          </v-list-item>
          <v-list-item
            prepend-icon="mdi-account-check-outline"
            title="Devengado a favor del beneficiario"
          >
            <p class="text-body-1 text-break">
              {{ formatAgreementAmount(agreement.vestedAmount, agreement) }}
            </p>
          </v-list-item>
        </v-list>
        <p class="text-body-2 text-medium-emphasis">
          Los montos finales se calculan al confirmar la transacción. El beneficiario conserva el
          derecho a reclamar lo devengado que aún no haya retirado.
        </p>
        <v-alert v-if="statusText" type="info" variant="tonal" class="mt-4" aria-live="polite">{{
          statusText
        }}</v-alert>
        <v-alert v-if="errorMessage" type="error" variant="tonal" class="mt-4" aria-live="polite">{{
          errorMessage
        }}</v-alert>
        <p v-if="transactionHash" class="text-body-2 text-break mt-4">
          Transacción: {{ transactionHash }}
        </p>
      </v-card-text>
      <v-card-actions class="flex-wrap">
        <v-btn :disabled="isCancelling" @click="agreement = null">Volver</v-btn>
        <v-btn
          color="error"
          variant="flat"
          :loading="isCancelling"
          :disabled="!agreement.canCancel"
          @click="confirm"
          >Confirmar cancelación</v-btn
        >
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>
