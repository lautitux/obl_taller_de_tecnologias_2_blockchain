import { getBlockNumber, getContractEvents } from '@wagmi/vue/actions'
import type { Address, Hash } from 'viem'
import { vestingAbi } from '@/contracts/vestingAbi'
import { getVestingDeploymentBlock } from '@/config/contract-deployments'
import type {
  AgreementEvent,
  AgreementEventName,
  ExtendedAgreementEvent,
} from '@/types/agreement-event'
import type {
  AgreementEventsQueryData,
  CachedAgreementEvent,
  EventSyncState,
} from '@/types/cached-event'

type Config = Parameters<typeof getBlockNumber>[0]

const BLOCK_CHUNK_SIZE = 2_000n
const REORG_OVERLAP = 32n

export interface AgreementEventSearch {
  address: Address
  chainId: number
  eventName?: AgreementEventName
  agreementId?: bigint
  payer?: Address
  beneficiary?: Address
}

interface RawAgreementLog {
  eventName: AgreementEventName
  args: AgreementEvent
  blockNumber: bigint
  blockHash: Hash | null
  transactionHash: Hash
  logIndex: number
  blockTimestamp?: bigint | null
}

export async function syncAgreementEvents(
  config: Config,
  search: AgreementEventSearch,
  previous?: AgreementEventsQueryData,
): Promise<AgreementEventsQueryData> {
  const latestBlock = await getBlockNumber(config, { chainId: search.chainId })
  const deploymentBlock = getVestingDeploymentBlock(search.chainId)
  let state = previous?.sync
  let events = previous?.events ?? []

  if (state === undefined) {
    const result = await syncDescending(
      config,
      search,
      latestBlock,
      deploymentBlock,
      events,
      initialSyncState(latestBlock),
    )
    events = result.events
    state = result.sync
  } else {
    const refreshFrom =
      state.newestScannedBlock > REORG_OVERLAP
        ? state.newestScannedBlock - REORG_OVERLAP
        : deploymentBlock

    if (latestBlock >= refreshFrom) {
      const result = await syncRange(
        config,
        search,
        refreshFrom,
        latestBlock,
        events,
        state,
        deploymentBlock,
      )
      events = result.events
      state = result.sync
    }

    if (!state.complete && refreshFrom > deploymentBlock) {
      const result = await syncDescending(
        config,
        search,
        refreshFrom - 1n,
        deploymentBlock,
        events,
        state,
      )
      events = result.events
      state = result.sync
    }
  }

  return {
    events: events.filter((event) => matchesSearch(event, search)).sort(compareEvents),
    sync: state,
  }
}

async function syncDescending(
  config: Config,
  search: AgreementEventSearch,
  fromBlock: bigint,
  deploymentBlock: bigint,
  events: CachedAgreementEvent[],
  state: EventSyncState,
): Promise<AgreementEventsQueryData> {
  let endBlock = fromBlock
  let result = { events, sync: state }

  while (endBlock >= deploymentBlock) {
    const startBlock =
      endBlock - BLOCK_CHUNK_SIZE + 1n > deploymentBlock
        ? endBlock - BLOCK_CHUNK_SIZE + 1n
        : deploymentBlock

    result = await syncRange(
      config,
      search,
      startBlock,
      endBlock,
      result.events,
      result.sync,
      deploymentBlock,
    )
    endBlock = startBlock - 1n
  }

  return result
}

async function syncRange(
  config: Config,
  search: AgreementEventSearch,
  fromBlock: bigint,
  toBlock: bigint,
  currentEvents: CachedAgreementEvent[],
  currentState: EventSyncState,
  deploymentBlock: bigint,
): Promise<AgreementEventsQueryData> {
  if (fromBlock > toBlock) return { events: currentEvents, sync: currentState }

  const logs = (await getContractEvents(config, {
    abi: vestingAbi,
    strict: true,
    chainId: search.chainId,
    fromBlock,
    toBlock,
    address: search.address,
    eventName: search.eventName,
  })) as RawAgreementLog[]

  const rangeEvents = logs.map((log) => ({
    id: `${log.transactionHash}:${log.logIndex}`,
    chainId: search.chainId,
    contractAddress: search.address,
    eventName: log.eventName,
    args: log.args,
    blockNumber: log.blockNumber,
    blockHash: log.blockHash,
    transactionHash: log.transactionHash,
    logIndex: log.logIndex,
    blockTimestamp: log.blockTimestamp,
  }))

  const events = currentEvents.filter(
    (event) => event.blockNumber < fromBlock || event.blockNumber > toBlock,
  )
  const byId = new Map(events.map((event) => [event.id, event]))
  for (const event of rangeEvents) byId.set(event.id, event)

  return {
    events: [...byId.values()],
    sync: {
      oldestScannedBlock:
        fromBlock < currentState.oldestScannedBlock
          ? fromBlock
          : currentState.oldestScannedBlock,
      newestScannedBlock:
        toBlock > currentState.newestScannedBlock
          ? toBlock
          : currentState.newestScannedBlock,
      complete:
        currentState.complete ||
        (fromBlock <= deploymentBlock && toBlock >= deploymentBlock),
    },
  }
}

function initialSyncState(latestBlock: bigint): EventSyncState {
  return {
    oldestScannedBlock: latestBlock + 1n,
    newestScannedBlock: latestBlock,
    complete: false,
  }
}

function matchesSearch(event: CachedAgreementEvent, search: AgreementEventSearch): boolean {
  if (search.eventName !== undefined && event.eventName !== search.eventName) return false
  if (search.agreementId !== undefined && event.args.agreementId !== search.agreementId) {
    return false
  }
  if (
    search.payer !== undefined &&
    (!('payer' in event.args) || event.args.payer.toLowerCase() !== search.payer.toLowerCase())
  ) {
    return false
  }
  if (
    search.beneficiary !== undefined &&
    event.args.beneficiary.toLowerCase() !== search.beneficiary.toLowerCase()
  ) {
    return false
  }
  return true
}

function compareEvents(left: CachedAgreementEvent, right: CachedAgreementEvent): number {
  if (left.blockNumber < right.blockNumber) return -1
  if (left.blockNumber > right.blockNumber) return 1
  return left.logIndex - right.logIndex
}

export function cachedEventToExtendedEvent(event: CachedAgreementEvent): ExtendedAgreementEvent {
  return {
    ...event.args,
    eventName: event.eventName,
    blockTimestamp: event.blockTimestamp,
  }
}
