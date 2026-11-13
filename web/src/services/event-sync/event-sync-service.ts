import { getBlock, getBlockNumber, getContractEvents } from '@wagmi/vue/actions'
import type { Address, Hash } from 'viem'
import { vestingAbi } from '@/contracts/vestingAbi'
import type {
  AgreementEvent,
  AgreementEventName,
  ExtendedAgreementEvent,
} from '@/types/agreement-event'
import type { AgreementEventsQueryData, CachedAgreementEvent } from '@/types/cached-event'

type Config = Parameters<typeof getBlockNumber>[0]

// Sepolia's default public RPC (thirdweb) rejects eth_getLogs ranges over 1,000 blocks.
const BLOCK_CHUNK_SIZE = 1_000n
const REORG_OVERLAP = 32n

export interface ContractEventSource {
  address: Address
  chainId: number
  deploymentBlock: bigint
}

export interface AgreementEventFilter {
  eventName?: AgreementEventName | undefined
  agreementId?: bigint | undefined
  payer?: Address | undefined
  beneficiary?: Address | undefined
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

/**
 * Incrementally syncs all of the contract's events.
 *
 * - Without previous data: scans from the latest block down to the deployment block.
 * - With previous data: fetches the new blocks (with an overlap to tolerate reorgs) and, if
 *   the historical scan is incomplete, resumes it from `oldestScannedBlock`.
 *
 * `onProgress` is called after each chunk so partial progress is kept in the cache (and
 * persisted) even if a later request fails due to RPC limits.
 */
export async function syncContractEvents(
  config: Config,
  source: ContractEventSource,
  previous: AgreementEventsQueryData | undefined,
  onProgress: (data: AgreementEventsQueryData) => void,
): Promise<AgreementEventsQueryData> {
  const latestBlock = await getBlockNumber(config, { chainId: source.chainId, cacheTime: 0 })

  let data: AgreementEventsQueryData = previous ?? {
    events: [],
    sync: {
      oldestScannedBlock: latestBlock + 1n,
      newestScannedBlock: latestBlock,
      complete: false,
    },
  }

  // 1. New blocks since the last sync.
  if (previous !== undefined) {
    const overlapStart = data.sync.newestScannedBlock - REORG_OVERLAP
    const refreshFrom =
      overlapStart > source.deploymentBlock ? overlapStart : source.deploymentBlock
    for (const [from, to] of ascendingChunks(refreshFrom, latestBlock)) {
      data = await syncRange(config, source, from, to, data)
      onProgress(data)
    }
  }

  // 2. Remaining history, in descending chunks from where the last scan stopped.
  if (!data.sync.complete) {
    const resumeFrom = data.sync.oldestScannedBlock - 1n
    for (const [from, to] of descendingChunks(resumeFrom, source.deploymentBlock)) {
      data = await syncRange(config, source, from, to, data)
      onProgress(data)
    }
    data = { ...data, sync: { ...data.sync, complete: true } }
  }

  return data
}

function* ascendingChunks(from: bigint, to: bigint): Generator<[bigint, bigint]> {
  for (let start = from; start <= to; start += BLOCK_CHUNK_SIZE) {
    const end = start + BLOCK_CHUNK_SIZE - 1n
    yield [start, end < to ? end : to]
  }
}

function* descendingChunks(from: bigint, lowest: bigint): Generator<[bigint, bigint]> {
  for (let end = from; end >= lowest; end -= BLOCK_CHUNK_SIZE) {
    const start = end - BLOCK_CHUNK_SIZE + 1n
    yield [start > lowest ? start : lowest, end]
  }
}

async function syncRange(
  config: Config,
  source: ContractEventSource,
  fromBlock: bigint,
  toBlock: bigint,
  current: AgreementEventsQueryData,
): Promise<AgreementEventsQueryData> {
  const logs = (await getContractEvents(config, {
    abi: vestingAbi,
    strict: true,
    chainId: source.chainId,
    address: source.address,
    fromBlock,
    toBlock,
  })) as RawAgreementLog[]

  const timestamps = await getBlockTimestamps(config, source.chainId, logs)

  // Events in the range are fully replaced: if there was a reorg, the stale ones are dropped.
  const byId = new Map(
    current.events
      .filter((event) => event.blockNumber < fromBlock || event.blockNumber > toBlock)
      .map((event) => [event.id, event]),
  )
  for (const log of logs) {
    const event = logToCachedEvent(log, source, timestamps.get(log.blockNumber))
    byId.set(event.id, event)
  }

  const { sync } = current
  return {
    events: [...byId.values()].sort(compareEvents),
    sync: {
      oldestScannedBlock: fromBlock < sync.oldestScannedBlock ? fromBlock : sync.oldestScannedBlock,
      newestScannedBlock: toBlock > sync.newestScannedBlock ? toBlock : sync.newestScannedBlock,
      complete: sync.complete || fromBlock <= source.deploymentBlock,
    },
  }
}

async function getBlockTimestamps(
  config: Config,
  chainId: number,
  logs: RawAgreementLog[],
): Promise<Map<bigint, bigint>> {
  const timestamps = new Map<bigint, bigint>()
  for (const log of logs) {
    if (log.blockTimestamp != null) timestamps.set(log.blockNumber, log.blockTimestamp)
  }
  for (const blockNumber of new Set(logs.map((log) => log.blockNumber))) {
    if (timestamps.has(blockNumber)) continue
    const block = await getBlock(config, { chainId, blockNumber })
    timestamps.set(blockNumber, block.timestamp)
  }
  return timestamps
}

function logToCachedEvent(
  log: RawAgreementLog,
  source: ContractEventSource,
  blockTimestamp: bigint | undefined,
): CachedAgreementEvent {
  return {
    id: `${log.transactionHash}:${log.logIndex}`,
    chainId: source.chainId,
    contractAddress: source.address,
    eventName: log.eventName,
    args: log.args,
    blockNumber: log.blockNumber,
    blockHash: log.blockHash,
    transactionHash: log.transactionHash,
    logIndex: log.logIndex,
    blockTimestamp: blockTimestamp ?? log.blockTimestamp ?? null,
  }
}

export function matchesFilter(event: CachedAgreementEvent, filter: AgreementEventFilter): boolean {
  if (filter.eventName !== undefined && event.eventName !== filter.eventName) return false
  if (filter.agreementId !== undefined && event.args.agreementId !== filter.agreementId) {
    return false
  }
  if (
    filter.payer !== undefined &&
    (!('payer' in event.args) || event.args.payer.toLowerCase() !== filter.payer.toLowerCase())
  ) {
    return false
  }
  if (
    filter.beneficiary !== undefined &&
    event.args.beneficiary.toLowerCase() !== filter.beneficiary.toLowerCase()
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
