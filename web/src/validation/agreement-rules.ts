import { isAddress, zeroAddress } from 'viem'

export const addressRules = [
  (value: string) => !!value?.trim() || 'Ingresá una dirección.',
  (value: string) => isAddress(value?.trim() ?? '') || 'Ingresá una dirección EVM válida (0x…).',
  (value: string) =>
    value?.trim() !== zeroAddress || 'La dirección no puede ser la dirección cero.',
]

export const amountRules = [
  (value: string) => !!value?.trim() || 'Ingresá el monto total.',
  (value: string) =>
    (/^\d+(\.\d+)?$/.test(value?.trim() ?? '') && /[1-9]/.test(value)) ||
    'Ingresá un monto mayor a cero. Usá punto para los decimales.',
]

export const timeRules = [
  (value: string) => /^([01]\d|2[0-3]):[0-5]\d$/.test(value ?? '') || 'Seleccioná una hora válida.',
]

export const dateRangeRules = [
  (value: Date[] | null) =>
    (!!value && value.length >= 1 && value.every((date) => !Number.isNaN(date.getTime()))) ||
    'Seleccioná una fecha o un rango de fechas.',
]
