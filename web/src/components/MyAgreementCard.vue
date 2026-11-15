<script setup lang="ts">
import { useReadErc20 } from '@/composables/useErc20'
import { useVestingDeployment } from '@/composables/useVestingDeployment'
import {
  useCancelVestingAgreement,
  useClaimVestedAmount,
  useReadVestedAmount,
  useReadVestingAgreement,
} from '@/composables/useVesting'
import { AgreementState } from '@/types/agreement'
import type { AgreementEvent } from '@/types/agreement-event'
import { useConnection } from '@wagmi/vue'
import { formatUnits, isAddressEqual } from 'viem'
import { computed, shallowRef } from 'vue'
import AgreementStateChip from './AgreementStateChip.vue'

interface AgreementCardConfiguration {
  showPayer?: boolean
  showBeneficiary?: boolean
  showClaimedAmount?: boolean
  showAvailableAmount?: boolean
  showCancelButton?: boolean
  showClaimButton?: boolean
  showReloadButton?: boolean
}

const {
  showPayer,
  showBeneficiary,
  showClaimedAmount,
  showAvailableAmount,
  showCancelButton,
  showClaimButton,
  showReloadButton,
  event,
} = defineProps<AgreementCardConfiguration & { event: AgreementEvent }>()

const emit = defineEmits<{
  cancel: [agreementId: bigint]
  claim: [agreementId: bigint, availableAmount: bigint]
}>()

const { contractAddress } = useVestingDeployment()
const agreementId = () => event.agreementId

const {
  agreement,
  isLoading,
  refetch: refetchAgreement,
} = useReadVestingAgreement(contractAddress, agreementId)

const { vestedAmount, refetch: refetchVested } = useReadVestedAmount(contractAddress, agreementId)

const tokenAddress = computed(() => agreement.value?.configuration.token)
const { symbol, decimals } = useReadErc20(tokenAddress)

const { cancel, isCancelling, isCancelled } = useCancelVestingAgreement(contractAddress)

const availableAmount = computed(
  () => (vestedAmount?.value ?? 0n) - (agreement.value?.alreadyWithdrawnAmount ?? 0n),
)

const { claim, isClaiming } = useClaimVestedAmount(contractAddress)

const { address } = useConnection()

const canCanel = computed(() =>
  Boolean(
    showCancelButton &&
    address.value !== undefined &&
    agreement.value !== undefined &&
    agreement.value.configuration.revocable &&
    !isCancelled.value &&
    agreement.value.state === AgreementState.Active &&
    Date.now() / 1000 < agreement.value.configuration.endDate &&
    isAddressEqual(agreement.value.payer, address.value),
  ),
)

const canClaim = computed(() =>
  Boolean(
    showClaimButton &&
    address.value !== undefined &&
    agreement.value !== undefined &&
    availableAmount.value > 0n &&
    isAddressEqual(agreement.value.configuration.beneficiary, address.value),
  ),
)

async function onCancel() {
  await cancel(event.agreementId)
  emit('cancel', event.agreementId)
}

async function onClaim() {
  await claim(event.agreementId, availableAmount.value)
  await refetchVested()
  emit('claim', event.agreementId, availableAmount.value)
}

const isReloading = shallowRef(false)

async function onReload() {
  isReloading.value = true
  try {
    await Promise.all([refetchAgreement(), refetchVested()])
  } finally {
    isReloading.value = false
  }
}
</script>

<template>
  <v-skeleton-loader v-if="isLoading" type="card"></v-skeleton-loader>
  <v-card v-if="agreement != undefined">
    <template #title>Acuerdo</template>
    <template #append>
      <v-btn
        v-if="showReloadButton"
        icon="mdi-reload"
        variant="text"
        :loading="isReloading"
        @click="onReload"
      />
      <AgreementStateChip
        :state="agreement.state"
        :startDate="agreement.configuration.startDate"
        :endDate="agreement.configuration.endDate"
      />
    </template>
    <template #subtitle>#{{ event.agreementId }}</template>
    <template #text>
      <span v-if="showPayer">
        <span>Pagador: </span>
        <span>{{ agreement.payer }}</span
        ><br />
      </span>
      <span v-if="showBeneficiary">
        <span>Beneficiario:</span>
        <span>{{ agreement.configuration.beneficiary }}</span
        ><br />
      </span>
      <span>
        <span>Monto total: </span>
        <span
          >{{ formatUnits(agreement.configuration.totalAmount, decimals ?? 0) }} {{ symbol }}</span
        ><br />
      </span>
      <span>
        <span>Monto devengado: </span>
        <span>{{ formatUnits(vestedAmount ?? 0n, decimals ?? 0) }} {{ symbol }}</span
        ><br />
      </span>
      <span v-if="showClaimedAmount">
        <span>Monto reclamado: </span>
        <span>{{ formatUnits(agreement.alreadyWithdrawnAmount, decimals ?? 0) }} {{ symbol }}</span
        ><br />
      </span>
      <span v-if="showAvailableAmount">
        <span>Monto disponible: </span>
        <span>{{ formatUnits(availableAmount, decimals ?? 0) }} {{ symbol }}</span
        ><br />
      </span>
    </template>
    <template #actions>
      <v-btn
        color="primary"
        prepend-icon="mdi-arrow-top-right"
        :to="'/agreements/' + event.agreementId"
        >Ver detalles</v-btn
      >
      <v-btn
        v-if="canCanel"
        :disabled="isCancelling"
        :loading="isCancelling"
        color="error"
        prepend-icon="mdi-cancel"
        @click="onCancel"
      >
        Cancelar
      </v-btn>
      <v-btn
        v-if="canClaim"
        :disabled="isClaiming"
        :loading="isClaiming"
        color="teal"
        prepend-icon="mdi-hand-coin-outline"
        @click="onClaim"
      >
        Reclamar
      </v-btn>
    </template>
  </v-card>
</template>
