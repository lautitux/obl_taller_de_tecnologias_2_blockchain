<script setup lang="ts">
const sections = [
  {
    title: 'Crear acuerdo',
    icon: 'mdi-file-document-plus-outline',
    description:
      'Definí quién recibirá los tokens, el monto y el período durante el que se liberarán.',
    detail: 'Elegí si el acuerdo será revocable y autorizá el uso de tokens antes de crearlo.',
  },
  {
    title: 'Acuerdos creados',
    icon: 'mdi-file-document-multiple-outline',
    description: 'Consultá los acuerdos donde tu billetera sea pagadora y seguí su evolución.',
    detail: 'Revisá el monto total, lo devengado y la posibilidad de cancelar cuando corresponda.',
  },
  {
    title: 'Mis ingresos',
    icon: 'mdi-wallet-outline',
    description:
      'Encontrá los acuerdos donde tu billetera sea beneficiaria y los tokens por recibir.',
    detail: 'Consultá lo devengado, lo ya reclamado y el monto disponible para reclamar.',
  },
]
</script>

<template>
  <div>
    <header class="mb-6">
      <p class="text-overline">Inicio</p>
      <h1 class="text-h4 mb-4">Tus acuerdos, en un solo lugar</h1>
      <p>
        Organizá la entrega gradual de tokens: definí un período, seguí el progreso de tus acuerdos
        y consultá los ingresos que podrás reclamar.
      </p>
    </header>

    <v-alert type="info" title="Estamos preparando tu espacio" class="mb-6">
      Las operaciones estarán disponibles próximamente. Mientras tanto, conocé qué podrás hacer en
      cada sección.
    </v-alert>

    <section aria-labelledby="sections-title">
      <h2 id="sections-title" class="text-h6 mb-4">¿Qué podrás hacer?</h2>
      <v-row>
        <v-col v-for="section in sections" :key="section.title" cols="12" sm="6" lg="4">
          <v-card tag="article" :prepend-icon="section.icon" class="h-100">
            <template #title>
              <h3 class="text-h6">{{ section.title }}</h3>
            </template>
            <v-card-text>
              <p>{{ section.description }}</p>
              <p class="mt-4">{{ section.detail }}</p>
              <v-chip size="small" prepend-icon="mdi-clock-outline" class="mt-4">
                Próximamente
              </v-chip>
            </v-card-text>
          </v-card>
        </v-col>
      </v-row>
    </section>

    <v-card class="mt-6">
      <v-card-title tag="h2" class="text-wrap">¿Cómo funciona un acuerdo?</v-card-title>
      <v-card-text>
        El pagador aporta los tokens y define las fechas. Durante ese período, el beneficiario
        acumula el derecho a recibirlos: ese es el monto devengado. Podrá reclamar lo devengado que
        todavía no haya retirado. Cada acuerdo tendrá su detalle con fechas, estado, progreso e
        historial.
      </v-card-text>
    </v-card>
  </div>
</template>
