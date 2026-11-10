<script setup lang="ts">
import AgreementStateChip from '@/components/AgreementStateChip.vue'
import { useReadErc20 } from '@/composables/useErc20'
import { useSettings } from '@/composables/useSettings'
import {
  useGetAgreementEvents,
  useReadVestedAmount,
  useReadVestingAgreement,
} from '@/composables/useVesting'
import { AgreementState } from '@/types/agreement'
import type { AgreementWithdrawal } from '@/types/agreement-event'
import { formatUnits, type Address } from 'viem'
import { computed, ref } from 'vue'
import { useRoute } from 'vue-router'

const route = useRoute()
const agreementId = computed(() => BigInt((route.params.id ?? '') as string))

const { settings } = useSettings()

const { agreement } = useReadVestingAgreement(() => ({
  address: settings.contractAddress as Address,
  agreementId: agreementId.value,
}))

const { vestedAmount } = useReadVestedAmount(() => ({
  address: settings.contractAddress as Address,
  agreementId: agreementId.value,
}))

const {
  name: tokenName,
  symbol,
  decimals,
} = useReadErc20(() => ({
  address: agreement.value?.configuration.token as Address,
}))

const { events } = useGetAgreementEvents(() => ({
  address: settings.contractAddress as Address,
  agreementId: agreementId.value,
}))

const eventPage = ref(1)

const eventItems = computed(() =>
  [...events.value.entries()].sort(
    ([, a], [, b]) => Number(b.blockTimestamp ?? 0) - Number(a.blockTimestamp ?? 0),
  ),
)

const claimedPercentage = computed(() =>
  Number(
    ((agreement.value?.alreadyWithdrawnAmount ?? 0n) * 100n) /
      (agreement.value?.configuration.totalAmount ?? 0n),
  ),
)
const vestedPercentage = computed(() =>
  Number(((vestedAmount.value ?? 0n) * 100n) / (agreement.value?.configuration.totalAmount ?? 0n)),
)
const agreementEvents: Record<string, { text: string; icon: string; color: string }> = {
  AgreementCreated: {
    text: 'Creación del acuerdo',
    icon: 'mdi-file-plus-outline',
    color: 'success',
  },
  AgreementWithdrawal: {
    text: 'Retiro de fondos',
    icon: 'mdi-file-move-outline',
    color: 'primary',
  },
  AgreementCancelled: {
    text: 'Cancelación del acuerdo',
    icon: 'mdi-file-remove-outline',
    color: 'error',
  },
}

function formatDate(date: bigint) {
  return new Date(Number(date) * 1000).toLocaleString()
}
</script>

<template>
  <div>
    <header class="mb-6">
      <h1 class="text-h4 mb-4">Acuerdo</h1>
      <p>Detalles del acuerdo #{{ agreementId }}.</p>
    </header>
    <v-row v-if="agreement">
      <v-col>
        <h2 class="text-h5 mb-4">Detalles</h2>
        <v-table>
          <tbody>
            <tr>
              <th>Progreso</th>
              <td>
                <span class="mr-4 d-inline-flex align-center"
                  ><v-icon color="primary">mdi-circle-medium</v-icon> Retirado</span
                >
                <span class="mr-4 d-inline-flex align-center"
                  ><v-icon color="success">mdi-circle-medium</v-icon> Devengado</span
                >
                <span class="mr-4 d-inline-flex align-center"
                  ><v-icon color="error">mdi-circle-medium</v-icon> Cancelado</span
                >
                <v-progress-linear
                  :location="null"
                  :buffer-color="agreement.state === AgreementState.Cancelled ? 'error' : 'success'"
                  buffer-opacity="1"
                  color="primary"
                  height="12"
                  max="100"
                  min="0"
                  :model-value="claimedPercentage"
                  :buffer-value="
                    agreement.state === AgreementState.Cancelled ? 100 : vestedPercentage
                  "
                  rounded
                ></v-progress-linear>
              </td>
            </tr>
            <tr>
              <th>Estado</th>
              <td>
                <AgreementStateChip :state="agreement.state" />
              </td>
            </tr>
            <tr>
              <th>Pagador</th>
              <td>{{ agreement.payer }}</td>
            </tr>
            <tr>
              <th>Beneficiario</th>
              <td>{{ agreement.configuration.beneficiary }}</td>
            </tr>
            <tr>
              <th>Token</th>
              <td class="py-2">
                <v-chip class="mr-2" prepend-icon="mdi-label-outline">{{ tokenName }}</v-chip>
                <v-chip class="mr-2" prepend-icon="mdi-circle-multiple-outline">{{
                  symbol
                }}</v-chip>
                <v-chip prepend-icon="mdi-decimal">{{ decimals }}</v-chip>
                <br />
                <span class="text-body-small">{{ agreement.configuration.token }}</span>
              </td>
            </tr>
            <tr>
              <th>Monto total</th>
              <td>
                {{ formatUnits(agreement.configuration.totalAmount, decimals ?? 0) }} {{ symbol }}
              </td>
            </tr>
            <tr>
              <th>Monto devengado</th>
              <td>{{ formatUnits(vestedAmount ?? 0n, decimals ?? 0) }} {{ symbol }}</td>
            </tr>
            <tr>
              <th>Fecha de inicio</th>
              <td>
                {{ formatDate(agreement.configuration.startDate) }}
                <br />
                <span class="text-body-small">{{
                  agreement.configuration.startDate.toString()
                }}</span>
              </td>
            </tr>
            <tr>
              <th>Fecha de finalización</th>
              <td>
                {{ formatDate(agreement.configuration.endDate) }}
                <br />
                <span class="text-body-small">{{
                  agreement.configuration.endDate.toString()
                }}</span>
              </td>
            </tr>
            <tr>
              <th>Revocable</th>
              <td>{{ agreement.configuration.revocable ? 'Si' : 'No' }}</td>
            </tr>
            <tr v-if="agreement.state === AgreementState.Cancelled">
              <th>Monto devengado antes de ser cancelado</th>
              <td>
                {{ formatUnits(agreement.vestedAmountBeforeCancelled, decimals ?? 0) }} {{ symbol }}
              </td>
            </tr>
            <tr>
              <th>Monto retirado</th>
              <td>
                {{ formatUnits(agreement.alreadyWithdrawnAmount, decimals ?? 0) }} {{ symbol }}
              </td>
            </tr>
          </tbody>
        </v-table>
      </v-col>
      <v-col>
        <h2 class="text-h5 mb-4">Eventos del acuerdo</h2>
        <v-data-iterator :items="eventItems" :page="eventPage" :items-per-page="5">
          <template #default="{ items }">
            <template v-for="{ raw: [id, event] } in items" :key="id">
              <v-card class="mb-2">
                <template #subtitle>{{
                  event.blockTimestamp ? formatDate(event.blockTimestamp) : 'Pendiente'
                }}</template>
                <template #text>
                  <div class="d-inline-flex align-center">
                    <v-icon class="mr-4" :color="agreementEvents[event.eventName]!.color">{{
                      agreementEvents[event.eventName]!.icon
                    }}</v-icon>
                    {{ agreementEvents[event.eventName]!.text }}
                    <span v-if="event.eventName === 'AgreementWithdrawal'"
                      >{{ formatUnits((event as AgreementWithdrawal).amount, decimals ?? 0) }}
                      {{ symbol }}</span
                    >
                  </div>
                </template>
              </v-card>
            </template>
          </template>
          <template #footer="{ pageCount }">
            <v-pagination v-model="eventPage" :length="pageCount"></v-pagination>
          </template>
        </v-data-iterator>
      </v-col>
    </v-row>
  </div>
</template>
