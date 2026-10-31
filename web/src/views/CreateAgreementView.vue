<script setup lang="ts">
import { computed, reactive } from 'vue'
import { isAddress, zeroAddress } from 'viem'
import { es } from 'vuetify/locale'

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

const addressRules = [
  (value: string) => !!value?.trim() || 'Ingresá una dirección.',
  (value: string) => isAddress(value?.trim() ?? '') || 'Ingresá una dirección EVM válida (0x…).',
  (value: string) =>
    value?.trim() !== zeroAddress || 'La dirección no puede ser la dirección cero.',
]

const amountRules = [
  (value: string) => !!value?.trim() || 'Ingresá el monto total.',
  (value: string) =>
    (/^\d+(\.\d+)?$/.test(value?.trim() ?? '') && /[1-9]/.test(value)) ||
    'Ingresá un monto mayor a cero. Usá punto para los decimales.',
]

const timeFields = [
  { key: 'startTime', label: 'Hora de inicio' },
  { key: 'endTime', label: 'Hora de finalización' },
] as const

const timeRules = [
  (value: string) => /^([01]\d|2[0-3]):[0-5]\d$/.test(value ?? '') || 'Seleccioná una hora válida.',
]

function dateWithTime(date: Date | undefined, time: string) {
  if (!date || Number.isNaN(date.getTime()) || !/^([01]\d|2[0-3]):[0-5]\d$/.test(time ?? '')) {
    return null
  }

  const result = new Date(date)
  const [hours = 0, minutes = 0] = time.split(':').map(Number)
  result.setHours(hours, minutes, 0, 0)
  return result
}

const startDate = computed(() =>
  dateWithTime(agreement.dateRange?.[0], agreement.customTimes ? agreement.startTime : '00:00'),
)
const endDate = computed(() =>
  (agreement.dateRange?.length ?? 0) >= 2
    ? dateWithTime(agreement.dateRange?.at(-1), agreement.customTimes ? agreement.endTime : '00:00')
    : null,
)

const periodError = computed(() =>
  startDate.value && endDate.value && endDate.value.getTime() <= startDate.value.getTime()
    ? 'La fecha y hora de finalización deben ser posteriores al inicio.'
    : '',
)

const dateRangeRules = [
  (value: Date[] | null) =>
    (!!value && value.length >= 2 && value.every((date) => !Number.isNaN(date.getTime()))) ||
    'Seleccioná la fecha de inicio y la fecha de finalización.',
]

const revocabilityHint = computed(() =>
  agreement.revocable
    ? 'Podrás cancelar antes de la fecha de finalización. Recuperarás los tokens no devengados; el beneficiario conservará el derecho a reclamar lo devengado.'
    : 'Una vez creado, no podrás cancelar el acuerdo ni recuperar los tokens comprometidos.',
)
</script>

<template>
  <v-locale-provider locale="es" :messages="{ es }">
    <div>
      <header class="mb-6">
        <h1 class="text-h4 mb-4">Crear acuerdo</h1>
        <p>Definí quién recibirá los tokens y durante qué período se liberarán gradualmente.</p>
      </header>

      <v-row>
        <v-col cols="12" md="8">
          <v-form validate-on="blur" @submit.prevent>
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
                  hint="Elegí primero el inicio y después el fin del período."
                  persistent-hint
                  :rules="dateRangeRules"
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
              <v-btn block color="success" disabled prepend-icon="mdi-check-circle-outline"
                >Aprobar tokens</v-btn
              >

              <v-divider class="my-6" />

              <h3 class="text-subtitle-1">2. Crear acuerdo</h3>
              <p class="mb-4">
                Después de confirmar la aprobación, se transferirá el monto total al contrato y se
                registrará el acuerdo.
              </p>
              <v-btn block color="primary" disabled prepend-icon="mdi-file-document-plus-outline">
                Crear acuerdo
              </v-btn>
            </v-card-text>
          </v-card>

          <v-alert type="warning" variant="tonal" title="Antes de confirmar" class="mt-6">
            Verificá la cuenta y la red en la barra superior. Necesitarás saldo del token elegido y
            moneda nativa de la red para pagar las comisiones.
          </v-alert>
        </v-col>
      </v-row>
    </div>
  </v-locale-provider>
</template>
