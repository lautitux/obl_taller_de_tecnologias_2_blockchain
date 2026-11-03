import { maxUint256, parseUnits } from 'viem'

export function parseTokenAmount(value: string, decimals: number) {
  const amount = value.trim()
  if (!/^\d+(\.\d+)?$/.test(amount)) {
    throw new Error('Ingresá un monto válido. Usá punto para los decimales.')
  }

  const fraction = amount.split('.')[1] ?? ''
  if (fraction.replace(/0+$/, '').length > decimals) {
    throw new Error(`El token admite hasta ${decimals} decimales.`)
  }

  const units = parseUnits(amount, decimals)
  if (units <= 0n || units > maxUint256) {
    throw new Error(
      'El monto debe ser mayor a cero y estar dentro del rango permitido por el token.',
    )
  }
  return units
}
