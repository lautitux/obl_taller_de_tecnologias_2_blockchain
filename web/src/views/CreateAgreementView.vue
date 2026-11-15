<script setup lang="ts">
import { computed, reactive, shallowRef } from 'vue'
import { useAgreementPeriod } from '@/composables/useAgreementPeriod'
import { addressRules, amountRules, dateRangeRules, timeRules } from '@/validation/agreement-rules'
import { useConnection } from '@wagmi/vue'
import { useVestingDeployment } from '@/composables/useVestingDeployment'
import {
  useApproveErc20,
  useParseAmountErc20,
  useReadAllowanceErc20,
  useReadErc20,
} from '@/composables/useErc20'
import { getAddress, isAddress, type Address } from 'viem'
import { useCreateVestingAgreement } from '@/composables/useVesting'
import TransactionLink from '@/components/wallet/TransactionLink.vue'
const { isConnected, isDisconnected, address: clientAddress } = useConnection()

const formValid = shallowRef<boolean | null>(null)

const agreement = reactive({
  beneficiary: '',
  token: '',
  totalAmount: '',
  dateRange: [] as Date[] | null,
  customTimes: false,
  startTime: '00:00',
  endTime: '00:00',
  revocable: false,
})

const { startDate, endDate, periodError } = useAgreementPeriod(agreement)
const { contractAddress } = useVestingDeployment()

const tokenAddress = computed(() =>
  isAddress(agreement.token) ? getAddress(agreement.token) : undefined,
)

const {
  decimals: tokenDecimals,
  decimalsError: tokenError,
  isNotFound: isTokenNotFound,
} = useReadErc20(tokenAddress)

// Without this the approve button just stays disabled and the user can't tell why.
const tokenErrorMessage = computed(() => {
  if (isTokenNotFound.value) {
    return 'No hay un token ERC-20 en esa dirección en la red actual. Revisá la dirección y la red de tu billetera.'
  }
  if (tokenError.value) return 'No se pudo leer el token. Revisá tu conexión e intentá de nuevo.'
  return null
})

const { allowance: tokenAllowance } = useReadAllowanceErc20(
  tokenAddress,
  clientAddress,
  contractAddress,
)

const { amount: tokenAmount } = useParseAmountErc20(
  () => agreement.totalAmount,
  () => tokenDecimals.value ?? 0,
)
const hasEnoughAllowance = computed(() =>
  Boolean(tokenAllowance.value && tokenAmount.value && tokenAllowance.value >= tokenAmount.value),
)

const {
  approve: approveTokens,
  isApproving,
  receipt: approvalTransaction,
  errorMessage: approvalError,
} = useApproveErc20(tokenAddress)

const {
  create: createAgreement,
  isCreating,
  isCreated,
  receipt: creationTransaction,
  errorMessage: creationError,
} = useCreateVestingAgreement(contractAddress)

const canSubmit = computed(
  () =>
    isConnected.value &&
    formValid.value === true &&
    contractAddress.value !== undefined &&
    !periodError.value &&
    startDate.value != null &&
    endDate.value != null &&
    tokenDecimals.value != null &&
    tokenAmount.value != null &&
    tokenAllowance.value !== undefined &&
    !isApproving.value &&
    !isCreating.value &&
    !isCreated.value,
)
const canApprove = computed(() => canSubmit.value && !hasEnoughAllowance.value)
const canCreate = computed(() => canSubmit.value && hasEnoughAllowance.value)

async function onApprove() {
  if (!canApprove.value) return
  await approveTokens(contractAddress.value, tokenAmount.value)
}

async function onCreate() {
  if (!canCreate.value || tokenAddress.value === undefined) return
  await createAgreement({
    beneficiary: agreement.beneficiary as Address,
    token: tokenAddress.value,
    totalAmount: tokenAmount.value ?? 0n,
    startDate: BigInt((startDate.value?.getTime() ?? 0) / 1000),
    endDate: BigInt((endDate.value?.getTime() ?? 0) / 1000),
    revocable: agreement.revocable,
  })
}

const timeFields = [
  { key: 'startTime', label: 'Hora de inicio' },
  { key: 'endTime', label: 'Hora de finalización' },
] as const

const revocabilityHint = computed(() =>
  agreement.revocable
    ? 'Podrás cancelar antes de la fecha de finalización. Recuperarás los tokens no devengados; el beneficiario conservará el derecho a reclamar lo devengado.'
    : 'Una vez creado, no podrás cancelar el acuerdo ni recuperar los tokens comprometidos.',
)
</script>

<template>
  <div>
    <header class="mb-6">
      <h1 class="text-h4 mb-4">Crear acuerdo</h1>
      <p>Definí quién recibirá los tokens y durante qué período se liberarán gradualmente.</p>
    </header>

    <v-alert v-if="isDisconnected" type="info" variant="tonal" class="mb-6">
      Para crear un acuerdo es necesario que conectes una billetera.
    </v-alert>

    <v-row>
      <v-col cols="12" md="8">
        <v-form
          v-model="formValid"
          :disabled="!isConnected || isApproving || isCreating || isCreated"
          validate-on="blur"
          @submit.prevent
        >
          <v-card>
            <v-card-title tag="h2" class="font-weight-regular">Datos del acuerdo</v-card-title>
            <v-card-text>
              <p class="mb-4">
                Todos los campos son obligatorios, excepto las horas personalizadas.
              </p>
              <v-text-field
                v-model="agreement.beneficiary"
                label="Dirección del beneficiario"
                placeholder="0x…"
                hint="Billetera que podrá reclamar los tokens. Revisá la dirección antes de confirmar."
                persistent-hint
                :rules="addressRules"
                autocomplete="off"
                autocapitalize="off"
                :spellcheck="false"
                required
              />

              <v-text-field
                v-model="agreement.token"
                label="Dirección del token ERC-20"
                placeholder="0x…"
                hint="Dirección del contrato del token en la red donde crearás el acuerdo."
                persistent-hint
                :rules="addressRules"
                autocomplete="off"
                autocapitalize="off"
                :spellcheck="false"
                required
                class="mt-4"
              />
              <v-alert
                v-if="tokenErrorMessage"
                type="error"
                variant="tonal"
                density="compact"
                class="mt-2"
                aria-live="polite"
              >
                {{ tokenErrorMessage }}
              </v-alert>

              <v-text-field
                v-model="agreement.totalAmount"
                label="Monto total de tokens"
                placeholder="Ej.: 1000.50"
                hint="Expresado en tokens, no en dinero. Usá punto como separador decimal."
                persistent-hint
                inputmode="decimal"
                :rules="amountRules"
                required
                class="mt-4"
              />

              <v-divider class="my-6" />

              <h2 class="text-h6 font-weight-regular mb-4">Período de liberación</h2>
              <v-date-input
                v-model="agreement.dateRange"
                multiple="range"
                label="Fecha de inicio y finalización"
                hint="Elegí inicio y fin. Para usar el mismo día, seleccioná una sola fecha y personalizá las horas."
                persistent-hint
                :rules="dateRangeRules"
                :error="!!periodError"
                cancel-text="Cancelar"
                ok-text="Aceptar"
                clearable
                required
              />

              <v-switch
                v-model="agreement.customTimes"
                label="Personalizar horas de inicio y fin"
                color="primary"
                hide-details
                class="mt-4"
              />

              <v-row v-if="agreement.customTimes">
                <v-col v-for="field in timeFields" :key="field.key" cols="12" sm="6">
                  <v-dialog max-width="360">
                    <template #activator="{ props }">
                      <v-text-field
                        v-bind="props"
                        :model-value="agreement[field.key]"
                        :label="field.label"
                        :aria-label="`Elegir ${field.label.toLowerCase()}`"
                        prepend-icon="mdi-clock-outline"
                        hint="Formato de 24 horas."
                        persistent-hint
                        :rules="timeRules"
                        readonly
                        @keydown.enter.prevent="props.onClick($event)"
                        @keydown.space.prevent="props.onClick($event)"
                      />
                    </template>
                    <template #default="{ isActive }">
                      <v-time-picker
                        v-model="agreement[field.key]"
                        :title="field.label"
                        :aria-label="field.label"
                        format="24hr"
                        width="100%"
                      >
                        <template #actions>
                          <v-btn color="primary" @click="isActive.value = false">Aceptar</v-btn>
                        </template>
                      </v-time-picker>
                    </template>
                  </v-dialog>
                </v-col>
              </v-row>
              <p class="text-body-2 mt-4">
                {{
                  agreement.customTimes
                    ? 'Las horas se interpretan en tu zona horaria, en formato de 24 horas.'
                    : 'Sin horas personalizadas, el inicio y el fin se interpretan a las 00:00 en tu zona horaria.'
                }}
              </p>
              <v-alert v-if="periodError" type="error" variant="tonal" class="mt-4">
                {{ periodError }}
              </v-alert>

              <v-divider class="my-6" />

              <h2 class="text-h6 font-weight-regular mb-4">Condiciones de cancelación</h2>
              <v-switch
                v-model="agreement.revocable"
                label="Acuerdo revocable"
                color="primary"
                hide-details
              />
              <v-alert :type="agreement.revocable ? 'info' : 'warning'" variant="tonal">
                {{ revocabilityHint }}
              </v-alert>
            </v-card-text>
          </v-card>
        </v-form>
      </v-col>

      <v-col cols="12" md="4">
        <v-card>
          <v-card-title tag="h2" class="text-wrap">Aprobación y creación</v-card-title>
          <v-card-text>
            <p class="mb-4">
              Se realizan en este orden, con una confirmación en tu billetera por paso.
            </p>

            <h3 class="text-subtitle-1">1. Aprobar tokens</h3>
            <p class="mb-4">
              Autorizá al contrato a utilizar el monto indicado. La aprobación no crea el acuerdo.
            </p>
            <v-btn
              block
              color="success"
              :disabled="!canApprove"
              :loading="isApproving"
              prepend-icon="mdi-check-circle-outline"
              @click="onApprove"
              >{{ hasEnoughAllowance ? 'Tokens aprobados' : 'Aprobar tokens' }}</v-btn
            >
            <v-alert v-if="isApproving" type="info" variant="tonal" class="mt-4" aria-live="polite">
              Confirmá la transacción en tu billetera y esperá a que se complete.
            </v-alert>
            <v-alert
              v-else-if="hasEnoughAllowance"
              type="success"
              variant="tonal"
              class="mt-4"
              aria-live="polite"
            >
              El contrato tiene autorización para utilizar el monto indicado.
            </v-alert>
            <v-alert
              v-else-if="approvalError"
              type="error"
              variant="tonal"
              class="mt-4"
              aria-live="polite"
            >
              {{ approvalError }}
            </v-alert>
            <p v-if="approvalTransaction" class="text-body-2 text-break mt-4">
              Transacción:
              <TransactionLink
                :chain-id="approvalTransaction.chainId"
                :transaction-hash="approvalTransaction.transactionHash"
              />
            </p>

            <v-divider class="my-6" />

            <h3 class="text-subtitle-1">2. Crear acuerdo</h3>
            <p class="mb-4">
              Después de confirmar la aprobación, se transferirá el monto total al contrato y se
              registrará el acuerdo.
            </p>
            <v-btn
              block
              color="primary"
              :disabled="!canCreate"
              :loading="isCreating"
              prepend-icon="mdi-file-document-plus-outline"
              @click="onCreate"
            >
              {{ isCreated ? 'Acuerdo creado' : 'Crear acuerdo' }}
            </v-btn>
            <v-alert v-if="isCreating" type="info" variant="tonal" class="mt-4" aria-live="polite">
              Confirmá la transacción en tu billetera y esperá a que se complete.
            </v-alert>
            <v-alert
              v-else-if="isCreated"
              type="success"
              variant="tonal"
              class="mt-4"
              aria-live="polite"
            >
              El acuerdo se confirmó en la blockchain y los tokens quedaron depositados en el
              contrato. Para crear otro acuerdo, recargá esta página.
            </v-alert>

            <v-alert
              v-else-if="creationError"
              type="error"
              variant="tonal"
              class="mt-4"
              aria-live="polite"
            >
              {{ creationError }}
            </v-alert>

            <p v-if="creationTransaction" class="text-body-2 text-break mt-4">
              Transacción:
              <TransactionLink
                :chain-id="creationTransaction.chainId"
                :transaction-hash="creationTransaction.transactionHash"
              />
            </p>
          </v-card-text>
        </v-card>

        <v-alert type="warning" variant="tonal" title="Antes de confirmar" class="mt-6">
          Verificá la cuenta y la red en la barra superior. Necesitarás saldo del token elegido y
          moneda nativa de la red para pagar las comisiones.
        </v-alert>
      </v-col>
    </v-row>
  </div>
</template>
