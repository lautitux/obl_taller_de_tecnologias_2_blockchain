import {
  useChainId,
  useConfig,
  useReadContract,
  useSimulateContract,
  useWriteContract,
} from '@wagmi/vue'
import { readContracts, simulateContract, waitForTransactionReceipt } from '@wagmi/vue/actions'
import { BaseError, erc20Abi, type Address, type WriteContractErrorType } from 'viem'
import { ref, toValue, computed, type MaybeRefOrGetter, type WatchEffect } from 'vue'

export function useReadErc20(
  erc20Address: MaybeRefOrGetter<Address | undefined>,
  enabled: MaybeRefOrGetter<boolean> = true,
) {
  const address = computed(() => toValue(erc20Address))
  const isQueryEnabled = computed(() => toValue(enabled))

  const {
    data: name,
    error: nameError,
    isLoading: nameIsLoading,
  } = useReadContract({
    abi: erc20Abi,
    address,
    functionName: 'name',
    query: { enabled: isQueryEnabled },
  })

  const {
    data: symbol,
    error: symbolError,
    isLoading: symbolIsLoading,
  } = useReadContract({
    abi: erc20Abi,
    address,
    functionName: 'symbol',
    query: { enabled: isQueryEnabled },
  })

  const {
    data: decimals,
    error: decimalsError,
    isLoading: decimalsIsLoading,
  } = useReadContract({
    abi: erc20Abi,
    address,
    functionName: 'decimals',
    query: { enabled: isQueryEnabled },
  })

  const isLoading = computed(
    () => nameIsLoading.value || symbolIsLoading.value || decimalsIsLoading.value,
  )

  return {
    name,
    symbol,
    decimals,
    nameError,
    symbolError,
    decimalsError,
    isLoading,
    nameIsLoading,
    symbolIsLoading,
    decimalsIsLoading,
  }
}

interface Erc20AllowanceInfo {
  address: Address
  owner: Address
  spender: Address
  enabled: boolean
}

export function useReadAllowance(erc20AllowanceInfo: Erc20AllowanceInfo) {
  const info = computed(() => toValue(erc20AllowanceInfo))
  const address = computed(() => info.value.address)
  const args = computed(() => {
    const { owner, spender } = info.value
    return [owner, spender] as const
  })
  const isQueryEnabled = computed(() => info.value.enabled)

  const {
    data: allowance,
    error,
    isLoading,
  } = useReadContract({
    abi: erc20Abi,
    address,
    functionName: 'allowance',
    args,
    query: { enabled: isQueryEnabled },
  })

  return { allowance, error, isLoading }
}

interface Erc20ApprovalInfo {
  address: Address
  spender: Address
  value: bigint
}

export function useApproveErc20(erc20ApprovalInfo: Erc20ApprovalInfo) {
  const error = ref<Error | WriteContractErrorType | null>(null)
  const errorMessage = ref<string | null>(null)
  const isApproved = ref<boolean>(false)
  const isApproving = ref<boolean>(false)

  const config = useConfig()
  const chainId = useChainId()
  const { mutateAsync, error: writeError } = useWriteContract()

  const approveToken = async () => {
    const { address, spender, value } = toValue(erc20ApprovalInfo)

    error.value = null
    errorMessage.value = null
    isApproved.value = false
    isApproving.value = true

    try {
      const { request, result } = await simulateContract(config, {
        abi: erc20Abi,
        chainId: toValue(chainId),
        address,
        functionName: 'approve',
        args: [spender, value],
      })

      if (result === false) {
        throw new Error('La aprobación falló sin revertir.')
      }

      const hash = await mutateAsync(request)
      if (writeError.value !== null) {
        throw writeError.value
      }

      const receipt = await waitForTransactionReceipt(config, { hash })
      if (receipt.status === 'reverted') {
        throw new Error('La transacción revirtio')
      }

      isApproved.value = true
      return receipt
    } catch (err) {
      error.value = err as Error
      if (err instanceof BaseError) {
        errorMessage.value = err.shortMessage

        const isUserRejected = err.message.includes('User rejected the request')
        if (isUserRejected) {
          errorMessage.value = 'Transacción cancelada por el usuario.'
        }
      } else {
        errorMessage.value = error.value.message
      }
      isApproved.value = false
    } finally {
      isApproving.value = false
    }
  }

  return { approveToken, isApproving, isApproved, error, errorMessage }
}
