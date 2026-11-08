import type { Address } from "viem"

export interface AgreementConfiguration {
  beneficiary: Address
  token: Address
  totalAmount: bigint
  startDate: bigint
  endDate: bigint
  revocable: boolean
}

export enum AgreementState {
  Active,
  Cancelled,
  Completed,
}

export interface Agreement {
  payer: Address
  configuration: AgreementConfiguration
  state: AgreementState
  vestedAmountBeforeCancelled: bigint
  alreadyWithdrawnAmount: bigint
}
