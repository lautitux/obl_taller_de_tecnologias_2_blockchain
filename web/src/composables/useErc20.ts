import type { TransactionReceipt } from '@/types/transaction'
import { errorAsMessage, interpretError } from '@/utils/errors'
import { useChainId, useConfig, useReadContract } from '@wagmi/vue'
import { simulateContract, waitForTransactionReceipt, writeContract } from '@wagmi/vue/actions'
import { erc20Abi, maxUint256, parseUnits, type Address, type WriteContractErrorType } from 'viem'
import { ref, toValue, computed, type MaybeRefOrGetter, watchEffect } from 'vue'

interface Erc20ReadInfo {
  address: Address
  enabled?: boolean | undefined
}

export function useReadErc20(erc20ReadInfo: MaybeRefOrGetter<Erc20ReadInfo>) {
  const info = computed(() => toValue(erc20ReadInfo))
  const address = computed(() => info.value.address)
  const enabled = computed(() => info.value.enabled ?? true)

  const {
    data: name,
    error: nameError,
    isLoading: nameIsLoading,
  } = useReadContract({
    abi: erc20Abi,
    address,
    functionName: 'name',
    query: { enabled },
  })

  const {
    data: symbol,
    error: symbolError,
    isLoading: symbolIsLoading,
  } = useReadContract({
    abi: erc20Abi,
    address,
    functionName: 'symbol',
    query: { enabled },
  })

  const {
    data: decimals,
    error: decimalsError,
    isLoading: decimalsIsLoading,
  } = useReadContract({
    abi: erc20Abi,
    address,
    functionName: 'decimals',
    query: { enabled },
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
  enabled?: boolean | undefined
}

export function useReadAllowanceErc20(erc20AllowanceInfo: MaybeRefOrGetter<Erc20AllowanceInfo>) {
  const info = computed(() => toValue(erc20AllowanceInfo))
  const address = computed(() => info.value.address)
  const args = computed(() => {
    const { owner, spender } = info.value
    return [owner, spender] as const
  })
  const isQueryEnabled = computed(() => info.value.enabled ?? true)

  const {
    data: allowance,
    error,
    isLoading,
    refetch,
  } = useReadContract({
    abi: erc20Abi,
    address,
    functionName: 'allowance',
    args,
    query: { enabled: isQueryEnabled },
  })

  return { allowance, error, isLoading, refresh: refetch }
}

interface Erc20ApprovalInfo {
  address: Address
  spender: Address
  value: bigint | null
}

export function useApproveErc20(erc20ApprovalInfo: MaybeRefOrGetter<Erc20ApprovalInfo>) {
  const error = ref<Error | WriteContractErrorType | null>(null)
  const errorMessage = ref<string | null>(null)
  const receipt = ref<TransactionReceipt | null>(null)
  const isApproved = ref<boolean>(false)
  const isApproving = ref<boolean>(false)

  const config = useConfig()
  const chainId = useChainId()

  const approve = async () => {
    if (isApproving.value) return

    error.value = null
    errorMessage.value = null
    receipt.value = null
    isApproved.value = false
    isApproving.value = true

    try {
      const { address, spender, value } = toValue(erc20ApprovalInfo)
      const networkId = chainId.value

      if (value == null || value <= 0n || value > maxUint256) {
        throw new Error('Ingresá un monto válido antes de aprobar.')
      }

      const { request, result } = await simulateContract(config, {
        abi: erc20Abi,
        chainId: networkId,
        address,
        functionName: 'approve',
        args: [spender, value],
      })

      if (result === false) {
        throw new Error('La aprobación falló sin revertir.')
      }

      const hash = await writeContract(config, { ...request, chainId: networkId })

      receipt.value = await waitForTransactionReceipt(config, { hash, chainId: networkId })

      if (receipt.value.status === 'reverted') {
        throw new Error('La transacción revirtio')
      }

      isApproved.value = true
    } catch (err) {
      error.value = err as Error
      const interpretedError = interpretError(err)
      errorMessage.value = errorAsMessage(interpretedError)
      isApproved.value = false
    } finally {
      isApproving.value = false
    }
  }

  return { approve, isApproving, isApproved, receipt, error, errorMessage }
}

interface Erc20ParseAmountInfo {
  amountString: string
  decimals: number
}

export function useParseAmountErc20(erc20ParseAmountInfo: MaybeRefOrGetter<Erc20ParseAmountInfo>) {
  const error = ref<string | null>(null)
  const amount = ref<bigint | null>(null)

  const parseAmount = () => {
    const { amountString, decimals } = toValue(erc20ParseAmountInfo)
    const amount = amountString.trim()
    if (!/^\d+(\.\d+)?$/.test(amount)) {
      throw new Error('Ingresá un monto válido. Usá punto para los decimales.')
    }

    const fraction = amount.split('.')[1] ?? ''
    if (fraction.replace(/0+$/, '').length > decimals) {
      throw new Error(`El token admite hasta ${decimals} decimales.`)
    }

    const units = parseUnits(amount, decimals)
    if (units <= 0n || units > maxUint256) {
      throw new Error(
        'El monto debe ser mayor a cero y estar dentro del rango permitido por el token.',
      )
    }

    return units
  }

  watchEffect(() => {
    error.value = null
    amount.value = null

    try {
      amount.value = parseAmount()
    } catch (err) {
      error.value = (err as Error).message
    }
  })

  return { amount, error }
}
