import type { Address } from "viem"

export interface AgreementCreated {
  agreementId: bigint
  payer: Address
  beneficiary: Address
  token: Address
  totalAmount: bigint
  startDate: bigint
  endDate: bigint
  revocable: boolean
}

export interface AgreementWithdrawal {
  agreementId: bigint
  beneficiary: Address
  amount: bigint
}

export interface AgreementCancelled {
  agreementId: bigint
  payer: Address
  beneficiary: Address
  token: Address
  vestedAmount: bigint
  refundedAmount: bigint
}

export type AgreementEventName = 'AgreementCreated' | 'AgreementWithdrawal' | 'AgreementCancelled'

export type AgreementEvent = AgreementCreated | AgreementWithdrawal | AgreementCancelled

export type ExtendedAgreementEvent = AgreementEvent & { eventName: string; blockTimestamp?: bigint | null }
