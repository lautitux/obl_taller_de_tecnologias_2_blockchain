import { useQuery, useQueryClient } from '@tanstack/vue-query'
import { useChainId, useConfig, useWatchContractEvent } from '@wagmi/vue'
import { computed, toValue, type MaybeRefOrGetter } from 'vue'
import { isAddressEqual, type Address } from 'viem'
import { vestingAbi } from '@/contracts/vestingAbi'
import type {
  AgreementEvent,
  AgreementEventName,
  ExtendedAgreementEvent,
} from '@/types/agreement-event'
import {
  cachedEventToExtendedEvent,
  syncAgreementEvents,
  type AgreementEventSearch,
} from '@/services/event-sync/event-sync-service'
import type {
  AgreementEventsQueryData,
  CachedAgreementEvent,
} from '@/types/cached-event'

interface AgreementEventSearchInput {
  address: Address
  eventName?: AgreementEventName
  agreementId?: bigint
  payer?: Address
  beneficiary?: Address
}

export function useGetAgreementEvents(
  agreementSearch: MaybeRefOrGetter<AgreementEventSearchInput>,
) {
  const info = computed(() => toValue(agreementSearch))
  const chainId = useChainId()
  const config = useConfig()
  const queryClient = useQueryClient()

  const queryKey = computed(() => [
    'agreement-events',
    chainId.value,
    info.value.address.toLowerCase(),
    info.value.eventName ?? 'all',
    info.value.agreementId?.toString() ?? null,
    info.value.payer?.toLowerCase() ?? null,
    info.value.beneficiary?.toLowerCase() ?? null,
  ] as const)

  const query = useQuery(() => ({
    queryKey: queryKey.value,
    queryFn: () => {
      const previous = queryClient.getQueryData<AgreementEventsQueryData>(queryKey.value)
      const search: AgreementEventSearch = {
        ...info.value,
        chainId: chainId.value,
      }
      return syncAgreementEvents(config, search, previous)
    },
    staleTime: 30_000,
    gcTime: 7 * 24 * 60 * 60 * 1_000,
    refetchOnWindowFocus: false,
    retry: 2,
  }))

  useWatchContractEvent({
    abi: vestingAbi,
    strict: true,
    address: computed(() => info.value.address),
    eventName: computed(() => info.value.eventName),
    onLogs(logs) {
      queryClient.setQueryData<AgreementEventsQueryData | undefined>(
        queryKey.value,
        (current) => {
          const events = new Map((current?.events ?? []).map((event) => [event.id, event]))
          for (const log of logs) {
            if (!matchesSearch(log.args, log.eventName, info.value)) continue
            const event = logToCachedEvent(log, chainId.value, info.value.address)
            events.set(event.id, event)
          }

          return {
            events: [...events.values()].sort(compareEvents),
            sync: current?.sync ?? {
              oldestScannedBlock: eventBlock(logs[0]) ?? 0n,
              newestScannedBlock: eventBlock(logs[0]) ?? 0n,
              complete: false,
            },
          }
        },
      )
    },
  })

  const events = computed(() => {
    const mapped = new Map<string, ExtendedAgreementEvent>()
    for (const event of query.data.value?.events ?? []) {
      mapped.set(event.id, cachedEventToExtendedEvent(event))
    }
    return mapped
  })

  return {
    events,
    isLoading: query.isPending,
    isSyncing: query.isFetching,
    isComplete: computed(() => query.data.value?.sync.complete ?? false),
    error: query.error,
    refetch: query.refetch,
  }
}

function logToCachedEvent(
  log: {
    eventName: AgreementEventName
    args: AgreementEvent
    blockNumber?: bigint
    blockHash?: `0x${string}` | null
    transactionHash: `0x${string}`
    logIndex: number
    blockTimestamp?: bigint | null
  },
  chainId: number,
  contractAddress: Address,
): CachedAgreementEvent {
  return {
    id: `${log.transactionHash}:${log.logIndex}`,
    chainId,
    contractAddress,
    eventName: log.eventName,
    args: log.args,
    blockNumber: log.blockNumber ?? 0n,
    blockHash: log.blockHash ?? null,
    transactionHash: log.transactionHash,
    logIndex: log.logIndex,
    blockTimestamp: log.blockTimestamp,
  }
}

function eventBlock(log: { blockNumber?: bigint } | undefined): bigint | undefined {
  return log?.blockNumber
}

function matchesSearch(
  event: AgreementEvent,
  eventName: AgreementEventName,
  search: AgreementEventSearchInput,
): boolean {
  if (search.eventName !== undefined && search.eventName !== eventName) return false
  if (search.agreementId !== undefined && event.agreementId !== search.agreementId) return false
  if (
    search.payer !== undefined &&
    (!('payer' in event) || !isAddressEqual(search.payer, event.payer))
  ) {
    return false
  }
  if (
    search.beneficiary !== undefined &&
    !isAddressEqual(search.beneficiary, event.beneficiary)
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
