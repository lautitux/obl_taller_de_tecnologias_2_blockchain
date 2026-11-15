import { vestingAbi } from '@/contracts/vestingAbi'
import { agreementEventsBaseQueryKey } from '@/composables/useAgreementEvents'
import type { Agreement, AgreementConfiguration, AgreementState } from '@/types/agreement'
import type { TransactionReceipt } from '@/types/transaction'
import { errorAsMessage, interpretError } from '@/utils/errors'
import { invalidateErc20Allowances } from '@/composables/useErc20'
import { useQueryClient, type QueryClient } from '@tanstack/vue-query'
import { useChainId, useConfig, useReadContract, useWriteContract } from '@wagmi/vue'
import {
  simulateContract,
  waitForTransactionReceipt,
  writeContract,
  type WriteContractErrorType,
} from '@wagmi/vue/actions'
import { readContractQueryKey } from '@wagmi/vue/query'
import { maxUint256, type Address } from 'viem'
import { computed, ref, toValue, unref, type MaybeRef, type MaybeRefOrGetter, type Ref } from 'vue'

type VestingReadAgreementsRespones = readonly [
  payer: Address,
  {
    beneficiary: Address
    token: Address
    totalAmount: bigint
    startDate: bigint
    endDate: bigint
    revocable: boolean
  },
  state: number,
  bigint,
  bigint,
]

interface VestingReadOptions {
  enabled?: MaybeRefOrGetter<boolean>
}

const MISSING_CONTRACT_MESSAGE = 'El contrato no está desplegado en la red actual.'

type VestingReadFunction = 'agreements' | 'vestedAmountOf'

function invalidateAgreementReads(
  queryClient: QueryClient,
  address: Address,
  agreementId: bigint,
  chainId: number,
  functionNames: readonly VestingReadFunction[],
) {
  return Promise.all(
    functionNames.map((functionName) =>
      queryClient.invalidateQueries({
        queryKey: readContractQueryKey({
          abi: vestingAbi,
          address,
          functionName,
          args: [agreementId],
          chainId,
        }),
      }),
    ),
  )
}

export function useReadVestingAgreement(
  address: MaybeRef<Address | undefined>,
  agreementId: MaybeRefOrGetter<bigint>,
  options: VestingReadOptions = {},
) {
  const { enabled: isEnabled = true } = options
  const args = computed(() => [toValue(agreementId)] as const)
  const enabled = computed(() => toValue(isEnabled) && unref(address) !== undefined)

  const { data, isSuccess, isLoading, isError, error, refetch } = useReadContract({
    abi: vestingAbi,
    address,
    functionName: 'agreements',
    args,
    query: { enabled },
  })

  const agreement: Ref<Agreement | undefined> = computed(() => {
    if (isSuccess.value && data.value != null) {
      return vestingReadAgreementsResponseToAgreement(data.value)
    } else {
      return undefined
    }
  })

  return { agreement, isLoading, isError, error, refetch }
}

function vestingReadAgreementsResponseToAgreement(
  response: VestingReadAgreementsRespones,
): Agreement {
  return {
    payer: response[0],
    configuration: response[1] as AgreementConfiguration,
    state: response[2] as AgreementState,
    vestedAmountBeforeCancelled: response[3],
    alreadyWithdrawnAmount: response[4],
  }
}

export function useReadVestedAmount(
  address: MaybeRef<Address | undefined>,
  agreementId: MaybeRefOrGetter<bigint>,
  options: VestingReadOptions = {},
) {
  const { enabled: isEnabled = true } = options
  const args = computed(() => [toValue(agreementId)] as const)
  const enabled = computed(() => toValue(isEnabled) && unref(address) !== undefined)

  const { data, isSuccess, isLoading, isError, error, refetch } = useReadContract({
    abi: vestingAbi,
    address,
    functionName: 'vestedAmountOf',
    args,
    query: { enabled },
  })

  return { vestedAmount: data, isSuccess, isLoading, isError, error, refetch }
}

export function useCreateVestingAgreement(address: MaybeRefOrGetter<Address | undefined>) {
  const isCreated = ref<boolean>(false)
  const isCreating = ref<boolean>(false)
  const receipt = ref<TransactionReceipt | null>(null)
  const error = ref<Error | WriteContractErrorType | null>(null)
  const errorMessage = ref<string | null>(null)

  const { mutateAsync } = useWriteContract()
  const config = useConfig()
  const chainId = useChainId()
  const queryClient = useQueryClient()

  const create = async (configuration: AgreementConfiguration) => {
    if (isCreating.value) return
    isCreated.value = false
    receipt.value = null
    error.value = null
    errorMessage.value = null
    isCreating.value = true

    try {
      const contract = toValue(address)
      if (contract === undefined) throw new Error(MISSING_CONTRACT_MESSAGE)
      const networkId = chainId.value
      const { totalAmount } = configuration

      if (totalAmount == null || totalAmount <= 0n || totalAmount > maxUint256) {
        throw new Error('Ingresá un monto válido antes de crear el acuerdo.')
      }

      const { request } = await simulateContract(config, {
        abi: vestingAbi,
        address: contract,
        chainId: networkId,
        functionName: 'createAgreement',
        args: [configuration],
      })

      const hash = await mutateAsync({
        ...request,
        chainId: networkId,
      })

      receipt.value = await waitForTransactionReceipt(config, { hash, chainId: networkId })
      if (receipt.value.status === 'reverted') {
        throw new Error('La transacción revirtio')
      }

      isCreated.value = true
      void queryClient.invalidateQueries({ queryKey: agreementEventsBaseQueryKey() })
      void invalidateErc20Allowances(queryClient, configuration.token, networkId)
    } catch (err) {
      error.value = err as Error
      const interpretedError = interpretError(err)
      errorMessage.value = errorAsMessage(interpretedError)
      isCreated.value = false
    } finally {
      isCreating.value = false
    }
  }

  return { create, isCreated, isCreating, receipt, error, errorMessage }
}

export function useCancelVestingAgreement(address: MaybeRefOrGetter<Address | undefined>) {
  const error = ref<Error | WriteContractErrorType | null>(null)
  const errorMessage = ref<string | null>(null)
  const receipt = ref<TransactionReceipt | null>(null)
  const isCancelled = ref<boolean>(false)
  const isCancelling = ref<boolean>(false)

  const config = useConfig()
  const chainId = useChainId()
  const queryClient = useQueryClient()

  const cancel = async (agreementId: bigint) => {
    if (isCancelling.value) return

    error.value = null
    errorMessage.value = null
    receipt.value = null
    isCancelled.value = false
    isCancelling.value = true

    try {
      const contract = toValue(address)
      if (contract === undefined) throw new Error(MISSING_CONTRACT_MESSAGE)
      const networkId = chainId.value

      const { request } = await simulateContract(config, {
        abi: vestingAbi,
        chainId: networkId,
        address: contract,
        functionName: 'cancelAgreement',
        args: [agreementId],
      })

      const hash = await writeContract(config, { ...request, chainId: networkId })

      receipt.value = await waitForTransactionReceipt(config, { hash, chainId: networkId })
      if (receipt.value.status === 'reverted') {
        throw new Error('La transacción revirtio')
      }

      isCancelled.value = true
      void invalidateAgreementReads(queryClient, contract, agreementId, networkId, [
        'agreements',
        'vestedAmountOf',
      ])
      void queryClient.invalidateQueries({ queryKey: agreementEventsBaseQueryKey() })
    } catch (err) {
      error.value = err as Error
      const interpretedError = interpretError(err)
      errorMessage.value = errorAsMessage(interpretedError)
      isCancelled.value = false
    } finally {
      isCancelling.value = false
    }
  }

  return { cancel, isCancelling, isCancelled, receipt, error, errorMessage }
}

export function useClaimVestedAmount(address: MaybeRefOrGetter<Address | undefined>) {
  const error = ref<Error | WriteContractErrorType | null>(null)
  const errorMessage = ref<string | null>(null)
  const receipt = ref<TransactionReceipt | null>(null)
  const isClaimed = ref<boolean>(false)
  const isClaiming = ref<boolean>(false)

  const config = useConfig()
  const chainId = useChainId()
  const queryClient = useQueryClient()

  const claim = async (agreementId: bigint, amount: bigint): Promise<void> => {
    if (isClaiming.value) return

    error.value = null
    errorMessage.value = null
    receipt.value = null
    isClaimed.value = false
    isClaiming.value = true

    try {
      const contract = toValue(address)
      if (contract === undefined) throw new Error(MISSING_CONTRACT_MESSAGE)
      if (amount <= 0) {
        throw new Error('La cantidad a reclamar debe ser superior a 0')
      }
      const networkId = chainId.value

      const { request } = await simulateContract(config, {
        abi: vestingAbi,
        chainId: networkId,
        address: contract,
        functionName: 'claimAmountFrom',
        args: [agreementId, amount],
      })

      const hash = await writeContract(config, { ...request, chainId: networkId })

      receipt.value = await waitForTransactionReceipt(config, { hash, chainId: networkId })
      if (receipt.value.status === 'reverted') {
        throw new Error('La transacción revirtio')
      }

      isClaimed.value = true
      void queryClient.invalidateQueries({ queryKey: agreementEventsBaseQueryKey() })
      await invalidateAgreementReads(queryClient, contract, agreementId, networkId, ['agreements'])
    } catch (err) {
      error.value = err as Error
      const interpretedError = interpretError(err)
      errorMessage.value = errorAsMessage(interpretedError)
      isClaimed.value = false
    } finally {
      isClaiming.value = false
    }
  }

  return { claim, isClaiming, isClaimed, receipt, error, errorMessage }
}
