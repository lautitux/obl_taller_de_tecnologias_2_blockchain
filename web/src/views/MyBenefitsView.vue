<script setup lang="ts">
import AgreementCard from '@/components/agreement/AgreementCard.vue'
import { useVestingDeployment } from '@/composables/useVestingDeployment'
import { useAgreementEvents } from '@/composables/useAgreementEvents'
import { useConnection } from '@wagmi/vue'

const { contractAddress } = useVestingDeployment()
const { address, isDisconnected } = useConnection()
const { events: agreementEvents } = useAgreementEvents(contractAddress, {
  filter: () => ({ eventName: 'AgreementCreated', beneficiary: address.value }),
  enabled: () => address.value !== undefined,
})
</script>

<template>
  <div>
    <header class="d-flex flex-wrap align-center justify-space-between ga-4 mb-6">
      <div>
        <h1 id="agreements-title" class="text-h4 mb-4">Mis ingresos</h1>
        <p>Seguí los acuerdos donde tu billetera es beneficiaria y la liberación de sus tokens.</p>
      </div>
    </header>

    <section v-if="isDisconnected">
      <v-alert type="info" variant="tonal">
        Conecta una billetera para hacer uso de esta funcionalidad.
      </v-alert>
    </section>
    <section v-else-if="agreementEvents.size === 0">
      <v-alert type="info" variant="tonal"> No hay acuerdos donde seas el beneficiario. </v-alert>
    </section>
    <section v-else>
      <v-row>
        <v-col v-for="[id, event] in agreementEvents" :key="id">
          <AgreementCard
            show-payer
            show-claimed-amount
            show-available-amount
            show-claim-button
            show-reload-button
            :event="event"
          />
        </v-col>
      </v-row>
    </section>
  </div>
</template>
