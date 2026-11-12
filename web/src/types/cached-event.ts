import type { Address, Hash } from 'viem'
import type { AgreementEvent, AgreementEventName } from './agreement-event'

export interface CachedAgreementEvent {
  id: string
  chainId: number
  contractAddress: Address
  eventName: AgreementEventName
  args: AgreementEvent
  blockNumber: bigint
  blockHash: Hash | null
  transactionHash: Hash
  logIndex: number
  blockTimestamp?: bigint | null
}

export interface EventSyncState {
  oldestScannedBlock: bigint
  newestScannedBlock: bigint
  complete: boolean
}

export interface AgreementEventsQueryData {
  events: CachedAgreementEvent[]
  sync: EventSyncState
}
