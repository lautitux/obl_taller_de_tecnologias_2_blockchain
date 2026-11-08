<script setup lang="ts">
import { useReadErc20 } from '@/composables/useErc20'
import { useSettings } from '@/composables/useSettings'
import {
  useCancelVestingAgreement,
  useReadVestedAmount,
  useReadVestingAgreement,
} from '@/composables/useVesting'
import { AgreementState } from '@/types/agreement'
import type { AgreementEvent } from '@/types/agreement-event'
import { useConnection } from '@wagmi/vue'
import { formatUnits, isAddressEqual, type Address } from 'viem'
import { computed } from 'vue'

const { event } = defineProps<{ event: AgreementEvent }>()

const { settings } = useSettings()

const { agreement, isLoading } = useReadVestingAgreement(() => ({
  address: settings.contractAddress as Address,
  agreementId: event.agreementId,
}))

const { vestedAmount } = useReadVestedAmount(() => ({
  address: settings.contractAddress as Address,
  agreementId: event.agreementId,
}))

const { symbol, decimals } = useReadErc20(() => ({
  address: agreement.value?.configuration.token as Address,
  enabled: agreement.value != undefined,
}))

const { cancel, isCancelling, isCancelled } = useCancelVestingAgreement(() => ({
  address: settings.contractAddress as Address,
  agreementId: event.agreementId,
}))

const agreementStatusDisplay: Record<typeof status.value, { icon: string; color: string }> = {
  Cancelado: { color: 'error', icon: 'mdi-file-cancel-outline' },
  Completado: { color: 'success', icon: 'mdi-file-check-outline' },
  Programado: { color: 'teal', icon: 'mdi-file-clock-outline' },
  Finalizado: { color: 'success', icon: 'mdi-file-outline' },
  'En curso': { color: 'primary', icon: 'mdi-file-send-outline' },
  Indeterminado: { color: 'warning', icon: 'mdi-file-question-outline' },
}

const status = computed(() => {
  const now = Math.round(Date.now() / 1000)
  switch (agreement.value?.state) {
    case AgreementState.Cancelled:
      return 'Cancelado'
    case AgreementState.Completed:
      return 'Completado'
    case AgreementState.Active:
      if (now < agreement.value.configuration.startDate) {
        return 'Programado'
      } else if (now >= agreement.value.configuration.endDate) {
        return 'Finalizado'
      } else {
        return 'En curso'
      }
    default:
      return 'Indeterminado'
  }
})

const { address } = useConnection()

const canCanel = computed(() =>
  Boolean(
    address.value !== undefined &&
    agreement.value !== undefined &&
    agreement.value.configuration.revocable &&
    !isCancelled.value &&
    agreement.value.state === AgreementState.Active &&
    Date.now() / 1000 < agreement.value.configuration.endDate &&
    isAddressEqual(agreement.value.payer, address.value),
  ),
)
</script>

<template>
  <v-skeleton-loader v-if="isLoading" type="card"></v-skeleton-loader>
  <v-card v-if="agreement != undefined">
    <template #title>Acuerdo</template>
    <template #append>
      <v-chip :color="agreementStatusDisplay[status].color"
        ><v-icon :icon="agreementStatusDisplay[status].icon" start />{{ status }}</v-chip
      >
    </template>
    <template #subtitle>#{{ event.agreementId }}</template>
    <template #text>
      <span>Beneficiario: </span> <span>{{ agreement.configuration.beneficiary }}</span
      ><br />
      <span>Monto total: </span>
      <span>{{ formatUnits(agreement.configuration.totalAmount, decimals ?? 0) }} {{ symbol }}</span
      ><br />
      <span>Monto devengado: </span>
      <span>{{ formatUnits(vestedAmount ?? 0n, decimals ?? 0) }} {{ symbol }}</span
      ><br />
    </template>
    <template #actions>
      <v-btn color="primary" prepend-icon="mdi-arrow-top-right">Ver detalles</v-btn>
      <v-btn
        v-if="canCanel"
        :disable="isCancelling"
        :loading="isCancelling"
        color="error"
        prepend-icon="mdi-cancel"
        @click="cancel()"
      >
        <span v-if="isCancelled">Cancelado</span>
        <span v-else>Cancelar</span>
      </v-btn>
    </template>
  </v-card>
</template>
