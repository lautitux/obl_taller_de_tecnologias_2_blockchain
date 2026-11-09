import { vestingAbi } from '@/contracts/vestingAbi'
import type { Agreement, AgreementConfiguration, AgreementState } from '@/types/agreement'
import type { AgreementEvent, AgreementEventName } from '@/types/agreement-event'
import type { TransactionReceipt } from '@/types/transaction'
import { errorAsMessage, interpretError } from '@/utils/errors'
import { useQueryClient } from '@tanstack/vue-query'
import {
  useChainId,
  useConfig,
  useReadContract,
  useWatchContractEvent,
  useWriteContract,
} from '@wagmi/vue'
import {
  getContractEvents,
  simulateContract,
  waitForTransactionReceipt,
  writeContract,
  type WriteContractErrorType,
} from '@wagmi/vue/actions'
import { readContractQueryKey } from '@wagmi/vue/query'
import { isAddressEqual, maxUint256, type Address } from 'viem'
import {
  computed,
  onWatcherCleanup,
  ref,
  toValue,
  watch,
  type MaybeRefOrGetter,
  type Ref,
} from 'vue'

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

interface VestingAgreementReadInfo {
  address: Address
  agreementId: bigint
  enabled?: boolean | undefined
}

export function useReadVestingAgreement(
  vestingAgreementReadInfo: MaybeRefOrGetter<VestingAgreementReadInfo>,
) {
  const info = computed(() => toValue(vestingAgreementReadInfo))
  const address = computed(() => info.value.address)
  const args = computed(() => [info.value.agreementId] as const)
  const enabled = computed(() => info.value.enabled ?? true)

  const { data, isSuccess, isLoading, isError, error } = useReadContract({
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

  return { agreement, isLoading, isError, error }
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
  vestingAgreementReadInfo: MaybeRefOrGetter<VestingAgreementReadInfo>,
) {
  const info = computed(() => toValue(vestingAgreementReadInfo))
  const address = computed(() => info.value.address)
  const args = computed(() => [info.value.agreementId] as const)
  const enabled = computed(() => info.value.enabled ?? true)

  const { data, isSuccess, isLoading, isError, error } = useReadContract({
    abi: vestingAbi,
    address,
    functionName: 'vestedAmountOf',
    args,
    query: { enabled },
  })

  return { vestedAmount: data, isSuccess, isLoading, isError, error }
}

interface VestingAgreementCreateInfo {
  address: Address
  configuration: AgreementConfiguration
}

export function useCreateVestingAgreement(
  vestingAgreementCreateInfo: MaybeRefOrGetter<VestingAgreementCreateInfo>,
) {
  const isCreated = ref<boolean>(false)
  const isCreating = ref<boolean>(false)
  const receipt = ref<TransactionReceipt | null>(null)
  const error = ref<Error | WriteContractErrorType | null>(null)
  const errorMessage = ref<string | null>(null)

  const { mutateAsync } = useWriteContract()
  const config = useConfig()
  const chainId = useChainId()

  const create = async () => {
    if (isCreating.value) return
    isCreated.value = false
    receipt.value = null
    error.value = null
    errorMessage.value = null
    isCreating.value = true

    try {
      const { address, configuration } = toValue(vestingAgreementCreateInfo)
      const networkId = chainId.value
      const { totalAmount } = configuration

      if (totalAmount == null || totalAmount <= 0n || totalAmount > maxUint256) {
        throw new Error('Ingresá un monto válido antes de crear el acuerdo.')
      }

      const { request } = await simulateContract(config, {
        abi: vestingAbi,
        address,
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

interface VestingAgreementCancelInfo {
  address: Address
  agreementId: bigint
}

export function useCancelVestingAgreement(
  vestingAgreementCancelInfo: MaybeRefOrGetter<VestingAgreementCancelInfo>,
) {
  const error = ref<Error | WriteContractErrorType | null>(null)
  const errorMessage = ref<string | null>(null)
  const receipt = ref<TransactionReceipt | null>(null)
  const isCancelled = ref<boolean>(false)
  const isCancelling = ref<boolean>(false)

  const config = useConfig()
  const chainId = useChainId()
  const queryClient = useQueryClient()

  const cancel = async () => {
    if (isCancelling.value) return

    error.value = null
    errorMessage.value = null
    receipt.value = null
    isCancelled.value = false
    isCancelling.value = true

    const { address, agreementId } = toValue(vestingAgreementCancelInfo)
    const networkId = chainId.value

    const readAgreementKey = readContractQueryKey({
      address,
      abi: vestingAbi,
      functionName: 'agreements',
      args: [agreementId],
      chainId: networkId,
    })

    try {
      const { request } = await simulateContract(config, {
        abi: vestingAbi,
        chainId: networkId,
        address,
        functionName: 'cancelAgreement',
        args: [agreementId],
      })

      const hash = await writeContract(config, { ...request, chainId: networkId })

      receipt.value = await waitForTransactionReceipt(config, { hash, chainId: networkId })
      if (receipt.value.status === 'reverted') {
        throw new Error('La transacción revirtio')
      }

      isCancelled.value = true
      void queryClient.invalidateQueries({ queryKey: readAgreementKey })
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

interface VestingAgreementClaimInfo {
  address: Address
  agreementId: bigint
  amount: bigint
}

export function useClaimVestedAmount(
  vestingAgreementUpdateInfo: MaybeRefOrGetter<VestingAgreementClaimInfo>,
) {
  const error = ref<Error | WriteContractErrorType | null>(null)
  const errorMessage = ref<string | null>(null)
  const receipt = ref<TransactionReceipt | null>(null)
  const isClaimed = ref<boolean>(false)
  const isClaiming = ref<boolean>(false)

  const config = useConfig()
  const chainId = useChainId()
  const queryClient = useQueryClient()

  const claim = async (): Promise<void> => {
    if (isClaiming.value) return

    error.value = null
    errorMessage.value = null
    receipt.value = null
    isClaimed.value = false
    isClaiming.value = true

    const { address, agreementId, amount } = toValue(vestingAgreementUpdateInfo)
    const networkId = chainId.value

    const readAgreementKey = readContractQueryKey({
      address,
      abi: vestingAbi,
      functionName: 'agreements',
      args: [agreementId],
      chainId: networkId,
    })

    try {
      if (amount <= 0) {
        throw new Error('La cantidad a reclamar debe ser superior a 0')
      }

      const { request } = await simulateContract(config, {
        abi: vestingAbi,
        chainId: networkId,
        address,
        functionName: 'claimAmountFrom',
        args: [agreementId, amount],
      })

      const hash = await writeContract(config, { ...request, chainId: networkId })

      receipt.value = await waitForTransactionReceipt(config, { hash, chainId: networkId })
      if (receipt.value.status === 'reverted') {
        throw new Error('La transacción revirtio')
      }

      isClaimed.value = true
      await queryClient.invalidateQueries({ queryKey: readAgreementKey })
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

interface VestingSearchAgreementsInfo {
  address: Address
  eventName?: AgreementEventName
  agreementId?: bigint | undefined
  payer?: Address | undefined
  beneficiary?: Address | undefined
}

export function useGetAgreementEvents(
  vestingSearchAgreementsInfo: MaybeRefOrGetter<VestingSearchAgreementsInfo>,
) {
  const info = computed(() => toValue(vestingSearchAgreementsInfo))
  const address = computed(() => info.value.address)
  const eventName = computed(() => info.value.eventName)
  const agreementId = computed(() => info.value.agreementId)
  const payer = computed(() => info.value.payer)
  const beneficiary = computed(() => info.value.beneficiary)

  const events = ref(new Map<string, AgreementEvent>())

  useWatchContractEvent({
    abi: vestingAbi,
    strict: true,
    address,
    eventName,
    onLogs(logs) {
      for (const log of logs) {
        if (eventName.value !== undefined && eventName.value !== log.eventName) continue

        const id = `${log.transactionHash}:${log.logIndex}`
        const event: AgreementEvent = log.args

        if (agreementId.value !== undefined && agreementId.value !== event.agreementId) continue
        if (
          payer.value !== undefined &&
          (!('payer' in event) || !isAddressEqual(payer.value, event.payer))
        )
          continue
        if (
          beneficiary.value !== undefined &&
          !isAddressEqual(beneficiary.value, event.beneficiary)
        )
          continue

        events.value.set(id, event)
      }
    },
  })

  const config = useConfig()
  const chainId = useChainId()

  watch(
    [info, chainId],
    () => {
      let stale = false
      events.value.clear()
      getContractEvents(config, {
        abi: vestingAbi,
        strict: true,
        chainId: chainId.value,
        fromBlock: 'earliest',
        toBlock: 'latest',
        address: address.value,
        eventName: eventName.value,
        args: {
          agreementId: agreementId.value,
          payer: payer.value,
          beneficiary: beneficiary.value,
        },
      }).then((logs) => {
        if (stale) return
        for (const log of logs) {
          const id = `${log.transactionHash}:${log.logIndex}`
          const event: AgreementEvent = log.args
          events.value.set(id, event)
        }
      })

      onWatcherCleanup(() => {
        stale = true
      })
    },
    { immediate: true },
  )

  return { events }
}
