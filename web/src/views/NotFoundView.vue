<template>
  <v-row align="center" justify="center" class="not-found">
    <v-col cols="12" md="6" lg="5" class="text-center text-md-start">
      <h1 class="text-h3 font-weight-bold mb-4">¿Te perdiste?</h1>
      <p class="text-h6 font-weight-regular text-medium-emphasis">
        Revisamos todos los bloques y esta página no aparece. Ni siquiera en el mempool.
      </p>
    </v-col>
    <v-col cols="12" md="4" class="d-flex justify-center order-first order-md-last">
      <v-icon
        icon="mdi-map-marker-question-outline"
        color="primary"
        class="not-found__icon"
        aria-hidden="true"
      />
    </v-col>
  </v-row>
</template>

<style scoped>
.not-found {
  min-height: 60vh;
}

.not-found__icon {
  font-size: clamp(120px, 20vw, 220px);
  width: auto;
  height: auto;
}
</style>
