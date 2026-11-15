<script setup lang="ts">
import MyAgreementCard from '@/components/MyAgreementCard.vue'
import { useVestingDeployment } from '@/composables/useVestingDeployment'
import { useGetAgreementEvents } from '@/composables/useAgreementEvents'
import { useConnection } from '@wagmi/vue'

const { address, isDisconnected } = useConnection()
const { contractAddress } = useVestingDeployment()
const { events: agreementEvents } = useGetAgreementEvents(contractAddress, {
  filter: () => ({ eventName: 'AgreementCreated', payer: address.value }),
  enabled: () => address.value !== undefined,
})
</script>

<template>
  <div>
    <header class="d-flex flex-wrap align-center justify-space-between ga-4 mb-6">
      <div>
        <h1 id="agreements-title" class="text-h4 mb-4">Acuerdos creados</h1>
        <p>Seguí los acuerdos donde tu billetera es pagadora y la liberación de sus tokens.</p>
      </div>
      <v-btn color="primary" prepend-icon="mdi-plus" :to="{ name: 'create-agreement' }"
        >Crear acuerdo</v-btn
      >
    </header>

    <section v-if="isDisconnected">
      <v-alert type="info" variant="tonal">
        Conecta una billetera para hacer uso de esta funcionalidad.
      </v-alert>
    </section>
    <section v-else-if="agreementEvents.size === 0">
      <v-alert type="info" variant="tonal"> Aun no creaste ningún acuerdo. </v-alert>
    </section>
    <section v-else>
      <v-row>
        <v-col v-for="[id, event] in agreementEvents" :key="id">
          <MyAgreementCard showBeneficiary showCancelButton :event="event" />
        </v-col>
      </v-row>
    </section>
  </div>
</template>
