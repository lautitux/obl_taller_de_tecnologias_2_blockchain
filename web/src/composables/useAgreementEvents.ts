import { useQuery, useQueryClient } from '@tanstack/vue-query'
import { useChainId, useConfig } from '@wagmi/vue'
import { computed, toValue, type MaybeRefOrGetter } from 'vue'
import type { Address } from 'viem'
import type { ExtendedAgreementEvent } from '@/types/agreement-event'
import type { AgreementEventsQueryData } from '@/types/cached-event'
import { getVestingDeploymentBlock } from '@/config/contract-deployments'
import {
  cachedEventToExtendedEvent,
  matchesFilter,
  syncContractEvents,
  type AgreementEventFilter,
} from '@/services/event-sync/event-sync-service'
import { isPersistableChain, queryPersister } from '@/services/query-persistence'

interface AgreementEventSearchInput extends AgreementEventFilter {
  address: Address
}

const EVENTS_QUERY_SCOPE = 'agreement-events'
const REFRESH_INTERVAL = 12_000

export function agreementEventsQueryKey(chainId: number, address: Address) {
  return [EVENTS_QUERY_SCOPE, chainId, address.toLowerCase()] as const
}

export function agreementEventsBaseQueryKey() {
  return [EVENTS_QUERY_SCOPE] as const
}

export function useGetAgreementEvents(
  agreementSearch: MaybeRefOrGetter<AgreementEventSearchInput>,
) {
  const search = computed(() => toValue(agreementSearch))
  const chainId = useChainId()
  const config = useConfig()
  const queryClient = useQueryClient()

  const deploymentBlock = computed(() => getVestingDeploymentBlock(chainId.value))
  const queryKey = computed(() => agreementEventsQueryKey(chainId.value, search.value.address))

  const persist = computed(() => isPersistableChain(chainId.value))

  const query = useQuery<AgreementEventsQueryData>(() => ({
    queryKey: queryKey.value,
    enabled: deploymentBlock.value !== undefined && search.value.address !== undefined,
    queryFn: () => {
      const key = queryKey.value
      const shouldPersist = persist.value
      return syncContractEvents(
        config,
        {
          address: search.value.address,
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
    const filter = search.value
    const mapped = new Map<string, ExtendedAgreementEvent>()
    for (const event of query.data.value?.events ?? []) {
      if (matchesFilter(event, filter)) mapped.set(event.id, cachedEventToExtendedEvent(event))
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
