import { computed, toValue, type MaybeRefOrGetter } from 'vue'

interface AgreementPeriod {
  readonly dateRange: readonly Date[] | null
  readonly customTimes: boolean
  readonly startTime: string
  readonly endTime: string
}

function dateWithTime(date: Date | undefined, time: string) {
  if (!date || Number.isNaN(date.getTime()) || !/^([01]\d|2[0-3]):[0-5]\d$/.test(time ?? '')) {
    return null
  }

  const result = new Date(date)
  const [hours = 0, minutes = 0] = time.split(':').map(Number)
  result.setHours(hours, minutes, 0, 0)
  return result
}

export function useAgreementPeriod(agreementPeriod: MaybeRefOrGetter<AgreementPeriod>) {
  const period = computed(() => toValue(agreementPeriod))
  const startDate = computed(() =>
    dateWithTime(
      period.value.dateRange?.[0],
      period.value.customTimes ? period.value.startTime : '00:00',
    ),
  )
  const endDate = computed(() =>
    dateWithTime(
      period.value.dateRange?.at(-1),
      period.value.customTimes ? period.value.endTime : '00:00',
    ),
  )

  const periodError = computed(() =>
    startDate.value && endDate.value && endDate.value.getTime() <= startDate.value.getTime()
      ? 'La fecha y hora de finalización deben ser posteriores al inicio.'
      : '',
  )

  return { startDate, endDate, periodError }
}
