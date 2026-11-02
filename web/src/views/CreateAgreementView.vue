<script setup lang="ts">
import { computed, reactive, shallowRef } from 'vue'
import { useAgreementPeriod } from '@/composables/useAgreementPeriod'
import { addressRules, amountRules, dateRangeRules, timeRules } from '@/validation/agreementRules'
import { useConnection } from '@wagmi/vue'
import { useSettings } from '@/composables/useSettings'
import { useTokenApproval } from '@/composables/useTokenApproval'
import { useCreateAgreement } from '@/composables/useCreateAgreement'
const { isConnected, isDisconnected } = useConnection()

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
const { settings } = useSettings()
const {
  approve: approveTokens,
  canApprove,
  isApproving,
  isApproved,
  statusText: approvalStatus,
  transaction: approvalTransaction,
  errorMessage: approvalError,
} = useTokenApproval(() => ({
  token: agreement.token,
  amount: agreement.totalAmount,
  spender: settings.contractAddress ?? '',
  enabled: isConnected.value && formValid.value === true && !periodError.value,
}))

const {
  create: createAgreement,
  canCreate,
  isCreating,
  isCreated,
  statusText: creationStatus,
  transactionHash: creationTransactionHash,
  errorMessage: creationError,
} = useCreateAgreement(() => ({
  contractAddress: settings.contractAddress ?? '',
  beneficiary: agreement.beneficiary,
  token: agreement.token,
  amount: agreement.totalAmount,
  startDate: startDate.value,
  endDate: endDate.value,
  revocable: agreement.revocable,
  enabled:
    isConnected.value &&
    formValid.value === true &&
    !periodError.value &&
    isApproved.value &&
    !isApproving.value,
}))

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

    <v-alert v-if="isDisconnected" type="warning" variant="tonal" class="mb-6">
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
              :disabled="!canApprove || isCreating || isCreated"
              :loading="isApproving"
              prepend-icon="mdi-check-circle-outline"
              @click="approveTokens"
              >{{ isApproved ? 'Tokens aprobados' : 'Aprobar tokens' }}</v-btn
            >
            <v-alert
              v-if="approvalStatus"
              type="info"
              variant="tonal"
              class="mt-4"
              aria-live="polite"
            >
              {{ approvalStatus }}
            </v-alert>
            <v-alert
              v-else-if="isApproved"
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
              <a
                v-if="approvalTransaction.explorer"
                :href="`${approvalTransaction.explorer}/tx/${approvalTransaction.hash}`"
                target="_blank"
                rel="noopener noreferrer"
                >{{ approvalTransaction.hash }}</a
              >
              <span v-else>{{ approvalTransaction.hash }}</span>
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
              @click="createAgreement"
            >
              {{ isCreated ? 'Acuerdo creado' : 'Crear acuerdo' }}
            </v-btn>

            <v-alert
              v-if="creationStatus"
              type="info"
              variant="tonal"
              class="mt-4"
              aria-live="polite"
            >
              {{ creationStatus }}
            </v-alert>

            <v-alert
              v-else-if="isCreated"
              type="success"
              variant="tonal"
              class="mt-4"
              aria-live="polite"
            >
              El acuerdo se confirmó en la blockchain y los tokens quedaron depositados en el contrato.
              Para crear otro acuerdo, recargá esta página.
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

            <p v-if="creationTransactionHash" class="text-body-2 text-break mt-4">
              Transacción: {{ creationTransactionHash }}
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
