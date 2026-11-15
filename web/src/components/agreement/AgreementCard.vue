<script setup lang="ts">
import { useReadErc20 } from '@/composables/useErc20'
import { useNow } from '@/composables/useNow'
import { useSnackbar } from '@/composables/useSnackbar'
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
  claim: [agreementId: bigint, claimedAmount: bigint]
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

const { notifyError, notifySuccess } = useSnackbar()

const { cancel, isCancelling, isCancelled } = useCancelVestingAgreement(contractAddress, {
  onSuccess: () => notifySuccess('Acuerdo cancelado.'),
  onError: notifyError,
})

const availableAmount = computed(
  () => (vestedAmount?.value ?? 0n) - (agreement.value?.alreadyWithdrawnAmount ?? 0n),
)

const { claim, isClaiming } = useClaimVestedAmount(contractAddress, {
  onSuccess: () => notifySuccess('Tokens reclamados.'),
  onError: notifyError,
})

const { address } = useConnection()
const now = useNow()

const canCancel = computed(() =>
  Boolean(
    showCancelButton &&
    address.value !== undefined &&
    agreement.value !== undefined &&
    agreement.value.configuration.revocable &&
    !isCancelled.value &&
    agreement.value.state === AgreementState.Active &&
    Math.floor(now.value / 1000) < agreement.value.configuration.endDate &&
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
  if (await cancel(event.agreementId)) emit('cancel', event.agreementId)
}

async function onClaim() {
  const amount = availableAmount.value
  if (!(await claim(event.agreementId, amount))) return
  await refetchVested()
  emit('claim', event.agreementId, amount)
}

const RELOAD_COOLDOWN_MS = 5_000
const isReloading = shallowRef(false)
const lastReloadAt = shallowRef(0)
const canReload = computed(() => now.value - lastReloadAt.value >= RELOAD_COOLDOWN_MS)

async function onReload() {
  if (!canReload.value) return
  lastReloadAt.value = Date.now()
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
        aria-label="Recargar acuerdo"
        :loading="isReloading"
        :disabled="!canReload"
        @click="onReload"
      />
      <AgreementStateChip
        :state="agreement.state"
        :start-date="agreement.configuration.startDate"
        :end-date="agreement.configuration.endDate"
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
        :to="{ name: 'agreement', params: { id: event.agreementId.toString() } }"
        >Ver detalles</v-btn
      >
      <v-btn
        v-if="canCancel"
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
