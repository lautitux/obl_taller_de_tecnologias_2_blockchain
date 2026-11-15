import { maxUint256 } from 'viem'

export const AGREEMENT_ID_PATTERN = '\\d+|0[xX][0-9a-fA-F]+'

export function parseAgreementId(raw: unknown): bigint | undefined {
  if (typeof raw !== 'string' || !new RegExp(`^(?:${AGREEMENT_ID_PATTERN})$`).test(raw)) {
    return undefined
  }
  const id = BigInt(raw.toLowerCase())
  return id <= maxUint256 ? id : undefined
}
