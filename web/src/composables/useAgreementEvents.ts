import { useQuery, useQueryClient } from '@tanstack/vue-query'
import { useChainId, useConfig } from '@wagmi/vue'
import { computed, toValue, type MaybeRefOrGetter } from 'vue'
import type { Address } from 'viem'
import type { ExtendedAgreementEvent } from '@/types/agreement-event'
import type { AgreementEventsQueryData } from '@/types/cached-event'
import { useVestingDeployment } from '@/composables/useVestingDeployment'
import {
  cachedEventToExtendedEvent,
  matchesFilter,
  syncContractEvents,
  type AgreementEventFilter,
} from '@/services/event-sync/event-sync-service'
import { isPersistableChain, queryPersister } from '@/services/query-persistence'

const EVENTS_QUERY_SCOPE = 'agreement-events'
const REFRESH_INTERVAL = 12_000

export function agreementEventsQueryKey(chainId: number, address: Address | undefined) {
  return [EVENTS_QUERY_SCOPE, chainId, address?.toLowerCase() ?? null] as const
}

export function agreementEventsBaseQueryKey() {
  return [EVENTS_QUERY_SCOPE] as const
}

interface AgreementEventsOptions {
  filter?: MaybeRefOrGetter<AgreementEventFilter>
  enabled?: MaybeRefOrGetter<boolean>
}

export function useGetAgreementEvents(
  address: MaybeRefOrGetter<Address | undefined>,
  options: AgreementEventsOptions = {},
) {
  const { filter = {}, enabled: isEnabled = true } = options
  const contract = computed(() => toValue(address))
  const chainId = useChainId()
  const config = useConfig()
  const queryClient = useQueryClient()

  const { deploymentBlock } = useVestingDeployment()
  const queryKey = computed(() => agreementEventsQueryKey(chainId.value, contract.value))
  const enabled = computed(
    () => toValue(isEnabled) && deploymentBlock.value !== undefined && contract.value !== undefined,
  )

  const persist = computed(() => isPersistableChain(chainId.value))

  const query = useQuery<AgreementEventsQueryData>(() => ({
    queryKey: queryKey.value,
    enabled: enabled.value,
    queryFn: () => {
      const key = queryKey.value
      const shouldPersist = persist.value
      const contractAddress = contract.value
      if (contractAddress === undefined) throw new Error('Falta la dirección del contrato.')
      return syncContractEvents(
        config,
        {
          address: contractAddress,
          chainId: chainId.value,
          deploymentBlock: deploymentBlock.value ?? 0n,
        },
        queryClient.getQueryData<AgreementEventsQueryData>(key),
        (partial) => {
          queryClient.setQueryData(key, partial)
          if (shouldPersist) void queryPersister.persistQueryByKey(key, queryClient)
        },
      )
    },
    persister: persist.value ? queryPersister.persisterFn : undefined,
    staleTime: REFRESH_INTERVAL,
    refetchInterval: REFRESH_INTERVAL,
    refetchOnWindowFocus: false,
    retry: 3,
    retryDelay: (attempt: number) => Math.min(2_000 * 2 ** attempt, 30_000),
  }))

  const events = computed(() => {
    const mapped = new Map<string, ExtendedAgreementEvent>()
    // The cache is shared per contract: while disabled, hide data synced by other consumers.
    if (!enabled.value) return mapped
    const eventFilter = toValue(filter)
    for (const event of query.data.value?.events ?? []) {
      if (matchesFilter(event, eventFilter)) mapped.set(event.id, cachedEventToExtendedEvent(event))
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
