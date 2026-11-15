<script setup lang="ts">
import { AgreementState } from '@/types/agreement'
import { useNow } from '@/composables/useNow'
import { computed } from 'vue'

const { state, startDate, endDate } = defineProps<{
  state: AgreementState
  startDate?: bigint
  endDate?: bigint
}>()

const agreementStatusDisplay: Record<typeof status.value, { icon: string; color: string }> = {
  Cancelado: { color: 'error', icon: 'mdi-file-cancel-outline' },
  Completado: { color: 'success', icon: 'mdi-file-check-outline' },
  Programado: { color: 'teal', icon: 'mdi-file-clock-outline' },
  Finalizado: { color: 'success', icon: 'mdi-file-outline' },
  Activo: { color: 'primary', icon: 'mdi-file-send-outline' },
  Indeterminado: { color: 'warning', icon: 'mdi-file-question-outline' },
}

const currentTime = useNow()

const status = computed(() => {
  const now = Math.floor(currentTime.value / 1000)
  switch (state) {
    case AgreementState.Cancelled:
      return 'Cancelado'
    case AgreementState.Completed:
      return 'Completado'
    case AgreementState.Active:
      if (startDate && now < startDate) {
        return 'Programado'
      } else if (endDate && now >= endDate) {
        return 'Finalizado'
      } else {
        return 'Activo'
      }
    default:
      return 'Indeterminado'
  }
})
</script>

<template>
  <v-chip :color="agreementStatusDisplay[status].color"
    ><v-icon :icon="agreementStatusDisplay[status].icon" start />{{ status }}</v-chip
  >
</template>
