import { useChainId, useConfig } from '@wagmi/vue'
import { readContracts } from '@wagmi/vue/actions'
import { erc20Abi, type Address } from 'viem'
import { ref, toValue, watchEffect, type MaybeRefOrGetter, type WatchEffect } from 'vue'

export function useReadToken(
  tokenAddress: MaybeRefOrGetter<Address>,
  enabled: MaybeRefOrGetter<boolean> = true,
) {
  const name = ref<string | null>(null)
  const symbol = ref<string | null>(null)
  const decimals = ref<number | null>(null)
  const error = ref<string | null>(null)
  const isLoading = ref(false)

  const config = useConfig()
  const chainId = useChainId()

  const readToken: WatchEffect = (onCleanup) => {
    let active = true
    onCleanup(() => {
      active = false
    })

    name.value = null
    symbol.value = null
    decimals.value = null
    error.value = null
    isLoading.value = false

    if (!toValue(enabled)) return
    isLoading.value = true

    const contract = {
      abi: erc20Abi,
      address: toValue(tokenAddress),
      chainId: chainId.value,
    } as const

    readContracts(config, {
      contracts: [
        { ...contract, functionName: 'name' },
        { ...contract, functionName: 'symbol' },
        { ...contract, functionName: 'decimals' },
      ] as const,
      allowFailure: false,
    })
      .then((contracts) => {
        if (!active) return
        name.value = contracts[0]
        symbol.value = contracts[1]
        decimals.value = contracts[2]
      })
      .catch((err: unknown) => {
        if (!active) return
        error.value = err instanceof Error ? err.message : String(err)
      })
      .finally(() => {
        if (active) isLoading.value = false
      })
  }

  watchEffect(readToken)

  return { name, symbol, decimals, error, isLoading }
}
