import { formatUnits } from 'viem'
import { type MyAgreement } from '@/composables/useReadVesting'

export const agreementStatuses = {
  scheduled: { title: 'Programado', color: 'info', icon: 'mdi-clock-outline' },
  active: { title: 'En curso', color: 'primary', icon: 'mdi-progress-clock' },
  ended: { title: 'Finalizado', color: 'success', icon: 'mdi-calendar-check-outline' },
  completed: { title: 'Completado', color: 'success', icon: 'mdi-check-circle-outline' },
  cancelled: { title: 'Cancelado', color: 'error', icon: 'mdi-cancel' },
} as const

export function formatAgreementAmount(
  amount: bigint,
  agreement: Pick<MyAgreement, 'decimals' | 'symbol'>,
) {
  if (agreement.decimals === null) return `${amount} unidades mínimas`
  return `${formatUnits(amount, agreement.decimals)} ${agreement.symbol}`
}

const dateFormatter = new Intl.DateTimeFormat('es-UY', { dateStyle: 'medium', timeStyle: 'short' })

export function formatAgreementDate(timestamp: bigint) {
  const date = new Date(Number(timestamp) * 1000)
  return Number.isNaN(date.getTime()) ? 'Fecha fuera de rango' : dateFormatter.format(date)
}
