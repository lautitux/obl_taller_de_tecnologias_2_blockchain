<script setup lang="ts">
import MyAgreementCard from '@/components/MyAgreementCard.vue'
import { useSettings } from '@/composables/useSettings'
import { useGetAgreementEvents } from '@/composables/useVesting'
import { useConnection } from '@wagmi/vue'
import type { Address } from 'viem'

const { address } = useConnection()
const { settings } = useSettings()
const { events: agreementEvents } = useGetAgreementEvents(() => ({
  address: settings.contractAddress as Address,
  eventName: 'AgreementCreated',
  payer: address.value,
}))
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
    <section>
      <v-row>
        <v-col v-for="[id, event] in agreementEvents" :key="id">
          <MyAgreementCard :event="event" />
        </v-col>
      </v-row>
    </section>
  </div>
</template>
