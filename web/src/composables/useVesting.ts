import { vestingAbi } from '@/contracts/vestingAbi'
import { agreementEventsBaseQueryKey } from '@/composables/useAgreementEvents'
import type { Agreement, AgreementConfiguration, AgreementState } from '@/types/agreement'
import {
  useContractTransaction,
  type TransactionCallbacks,
} from '@/composables/useContractTransaction'
import { invalidateErc20Allowances } from '@/composables/useErc20'
import { useQueryClient, type QueryClient } from '@tanstack/vue-query'
import { useChainId, useConfig, useReadContract } from '@wagmi/vue'
import { simulateContract, writeContract } from '@wagmi/vue/actions'
import { readContractQueryKey } from '@wagmi/vue/query'
import { maxUint256, type Address } from 'viem'
import { computed, toValue, unref, type MaybeRef, type MaybeRefOrGetter, type Ref } from 'vue'

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

function requireContract(address: MaybeRefOrGetter<Address | undefined>): Address {
  const contract = toValue(address)
  if (contract === undefined) throw new Error(MISSING_CONTRACT_MESSAGE)
  return contract
}

export function useCreateVestingAgreement(
  address: MaybeRefOrGetter<Address | undefined>,
  callbacks: TransactionCallbacks<[AgreementConfiguration]> = {},
) {
  const config = useConfig()
  const chainId = useChainId()
  const queryClient = useQueryClient()

  const { execute, isPending, isSuccess, receipt, error, errorMessage } = useContractTransaction(
    async (configuration: AgreementConfiguration) => {
      const contract = requireContract(address)
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
      const hash = await writeContract(config, { ...request, chainId: networkId })
      return { hash, chainId: networkId, address: contract }
    },
    {
      ...callbacks,
      onConfirmed: (transaction, configuration) => {
        void queryClient.invalidateQueries({ queryKey: agreementEventsBaseQueryKey() })
        void invalidateErc20Allowances(queryClient, configuration.token, transaction.chainId)
      },
    },
  )

  return {
    create: execute,
    isCreated: isSuccess,
    isCreating: isPending,
    receipt,
    error,
    errorMessage,
  }
}

export function useCancelVestingAgreement(
  address: MaybeRefOrGetter<Address | undefined>,
  callbacks: TransactionCallbacks<[agreementId: bigint]> = {},
) {
  const config = useConfig()
  const chainId = useChainId()
  const queryClient = useQueryClient()

  const { execute, isPending, isSuccess, receipt, error, errorMessage } = useContractTransaction(
    async (agreementId: bigint) => {
      const contract = requireContract(address)
      const networkId = chainId.value

      const { request } = await simulateContract(config, {
        abi: vestingAbi,
        chainId: networkId,
        address: contract,
        functionName: 'cancelAgreement',
        args: [agreementId],
      })
      const hash = await writeContract(config, { ...request, chainId: networkId })
      return { hash, chainId: networkId, address: contract }
    },
    {
      ...callbacks,
      onConfirmed: (transaction, agreementId) => {
        void invalidateAgreementReads(
          queryClient,
          transaction.address,
          agreementId,
          transaction.chainId,
          ['agreements', 'vestedAmountOf'],
        )
        void queryClient.invalidateQueries({ queryKey: agreementEventsBaseQueryKey() })
      },
    },
  )

  return {
    cancel: execute,
    isCancelled: isSuccess,
    isCancelling: isPending,
    receipt,
    error,
    errorMessage,
  }
}

export function useClaimVestedAmount(
  address: MaybeRefOrGetter<Address | undefined>,
  callbacks: TransactionCallbacks<[agreementId: bigint, amount: bigint]> = {},
) {
  const config = useConfig()
  const chainId = useChainId()
  const queryClient = useQueryClient()

  const { execute, isPending, isSuccess, receipt, error, errorMessage } = useContractTransaction(
    async (agreementId: bigint, amount: bigint) => {
      const contract = requireContract(address)
      if (amount <= 0n) throw new Error('La cantidad a reclamar debe ser superior a 0.')
      const networkId = chainId.value

      const { request } = await simulateContract(config, {
        abi: vestingAbi,
        chainId: networkId,
        address: contract,
        functionName: 'claimAmountFrom',
        args: [agreementId, amount],
      })
      const hash = await writeContract(config, { ...request, chainId: networkId })
      return { hash, chainId: networkId, address: contract }
    },
    {
      ...callbacks,
      onConfirmed: async (transaction, agreementId) => {
        void queryClient.invalidateQueries({ queryKey: agreementEventsBaseQueryKey() })
        await invalidateAgreementReads(
          queryClient,
          transaction.address,
          agreementId,
          transaction.chainId,
          ['agreements'],
        )
      },
    },
  )

  return {
    claim: execute,
    isClaimed: isSuccess,
    isClaiming: isPending,
    receipt,
    error,
    errorMessage,
  }
}
