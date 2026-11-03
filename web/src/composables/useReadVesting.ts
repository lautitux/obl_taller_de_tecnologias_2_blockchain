import { computed } from 'vue'
import { useConfig, useConnection } from '@wagmi/vue'
import { useQuery } from '@tanstack/vue-query'
import { erc20Abi, isAddress, publicActions, zeroAddress } from 'viem'
import { vestingAbi } from '@/contracts/vestingAbi'
import { useSettings } from '@/composables/useSettings'

type AgreementStatus = 'scheduled' | 'active' | 'ended' | 'completed' | 'cancelled'

export function useReadVesting() {
  const config = useConfig()
  const { address, chainId, isConnected } = useConnection()
  const { settings } = useSettings()
  const context = computed(() => ({
    payer: address.value,
    chainId: chainId.value,
    contract: settings.contractAddress ?? '',
  }))
  const unavailableReason = computed(() => {
    if (!isConnected.value) return 'Conectá tu billetera para consultar los acuerdos que creaste.'
    if (!config.chains.some((chain) => chain.id === chainId.value)) {
      return 'Seleccioná una red compatible en tu billetera.'
    }
    if (!isAddress(context.value.contract) || context.value.contract === zeroAddress) {
      return 'Configurá una dirección válida para el contrato de acuerdos.'
    }
    return ''
  })

  const query = useQuery({
    queryKey: ['my-agreements', context],
    enabled: computed(() => !unavailableReason.value),
    refetchInterval: 15_000,
    async queryFn() {
      const { payer, chainId: networkId, contract } = context.value
      if (!payer || networkId === undefined || !isAddress(contract)) return []

      const client = config.getClient({ chainId: networkId }).extend(publicActions)
      const block = await client.getBlock()
      const events = await client.getContractEvents({
        address: contract,
        abi: vestingAbi,
        eventName: 'AgreementCreated',
        args: { payer },
        fromBlock: 0n,
        toBlock: block.number,
        strict: true,
      })
      const metadata = new Map<string, Promise<{ symbol: string; decimals: number | null }>>()

      return Promise.all(
        events.reverse().map(async ({ args: { agreementId } }) => {
          const [agreement, vestedAmount] = await Promise.all([
            client.readContract({
              address: contract,
              abi: vestingAbi,
              functionName: 'agreements',
              args: [agreementId],
              blockNumber: block.number,
            }),
            client.readContract({
              address: contract,
              abi: vestingAbi,
              functionName: 'vestedAmountOf',
              args: [agreementId],
              blockNumber: block.number,
            }),
          ])
          const [agreementPayer, configuration, state] = agreement
          const { token, totalAmount, startDate, endDate, revocable, beneficiary } = configuration
          if (!metadata.has(token)) {
            metadata.set(
              token,
              Promise.all([
                client
                  .readContract({ address: token, abi: erc20Abi, functionName: 'symbol' })
                  .catch(() => 'Token'),
                client
                  .readContract({ address: token, abi: erc20Abi, functionName: 'decimals' })
                  .catch(() => null),
              ]).then(([symbol, decimals]) => ({ symbol, decimals })),
            )
          }
          const tokenMetadata = await metadata.get(token)!
          const status: AgreementStatus =
            state === 1
              ? 'cancelled'
              : state === 2
                ? 'completed'
                : block.timestamp >= endDate
                  ? 'ended'
                  : block.timestamp < startDate
                    ? 'scheduled'
                    : 'active'

          return {
            id: agreementId.toString(),
            payer: agreementPayer,
            beneficiary,
            token,
            totalAmount,
            vestedAmount,
            startDate,
            endDate,
            revocable,
            status,
            ...tokenMetadata,
            progress: totalAmount === 0n ? 0 : Number((vestedAmount * 10_000n) / totalAmount) / 100,
            canCancel:
              state === 0 &&
              revocable &&
              block.timestamp < endDate &&
              agreementPayer.toLowerCase() === payer.toLowerCase(),
          }
        }),
      )
    },
  })

  return {
    agreements: computed(() => (unavailableReason.value ? [] : (query.data.value ?? []))),
    unavailableReason,
    isLoading: query.isLoading,
    isRefreshing: query.isFetching,
    error: query.error,
    refresh: query.refetch,
    context,
  }
}

export type MyAgreement = ReturnType<typeof useReadVesting>['agreements']['value'][number]
