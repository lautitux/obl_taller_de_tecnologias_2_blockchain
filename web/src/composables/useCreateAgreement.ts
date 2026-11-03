import { computed, readonly, shallowRef, toValue, type MaybeRefOrGetter } from 'vue'
import { useConfig, useConnection, useWriteContract } from '@wagmi/vue'
import {
  BaseError,
  UserRejectedRequestError,
  erc20Abi,
  getAddress,
  isAddress,
  publicActions,
  zeroAddress,
  type Hash,
} from 'viem'
import { vestingAbi } from '@/contracts/vestingAbi'
import { useSnackbar } from '@/composables/useSnackbar'
import { parseTokenAmount } from '@/utils/tokenAmount'

interface CreateAgreementInput {
  contractAddress: string
  beneficiary: string
  token: string
  amount: string
  startDate: Date | null
  endDate: Date | null
  revocable: boolean
  enabled: boolean
}

export function useCreateAgreement(input: MaybeRefOrGetter<CreateAgreementInput>) {
  const config = useConfig()
  const { address, chainId, isConnected } = useConnection()
  const { mutateAsync: writeContract } = useWriteContract()
  const { notifyError, notifySuccess } = useSnackbar()

  const stage = shallowRef<'idle' | 'checking' | 'signing' | 'confirming'>('idle')
  const isCreated = shallowRef(false)
  const transactionHash = shallowRef<Hash | null>(null)
  const errorMessage = shallowRef('')

  const isCreating = computed(() => stage.value !== 'idle')

  const canCreate = computed(
    () => toValue(input).enabled && isConnected.value && !isCreating.value && !isCreated.value,
  )

  const statusText = computed(() => {
    if (stage.value === 'checking') return 'Verificando los datos del acuerdo…'
    if (stage.value === 'signing') return 'Confirmá la creación en tu billetera.'
    if (stage.value === 'confirming') return 'Esperando la confirmación del acuerdo…'
    return ''
  })

  function currentRequestKey() {
    const values = toValue(input)

    return JSON.stringify([
      address.value,
      chainId.value,
      values.contractAddress,
      values.beneficiary,
      values.token,
      values.amount,
      values.startDate?.getTime(),
      values.endDate?.getTime(),
      values.revocable,
    ])
  }

  async function create() {
    if (!canCreate.value) return

    const values = toValue(input)
    const owner = address.value
    const networkId = chainId.value
    const requestKey = currentRequestKey()

    errorMessage.value = ''
    transactionHash.value = null
    stage.value = 'checking'

    try {
      if (
        !owner ||
        networkId === undefined ||
        !config.chains.some((chain) => chain.id === networkId)
      ) {
        throw new Error('Conectá una billetera en una red compatible.')
      }

      const contractAddress = values.contractAddress.trim()
      const beneficiary = values.beneficiary.trim()
      const tokenAddress = values.token.trim()

      if (
        !isAddress(contractAddress) ||
        contractAddress === zeroAddress ||
        !isAddress(beneficiary) ||
        beneficiary === zeroAddress ||
        !isAddress(tokenAddress) ||
        tokenAddress === zeroAddress
      ) {
        throw new Error('Revisá las direcciones del contrato, beneficiario y token.')
      }

      const startMilliseconds = values.startDate?.getTime()
      const endMilliseconds = values.endDate?.getTime()

      if (
        startMilliseconds === undefined ||
        endMilliseconds === undefined ||
        !Number.isFinite(startMilliseconds) ||
        !Number.isFinite(endMilliseconds) ||
        startMilliseconds < 0 ||
        endMilliseconds <= startMilliseconds
      ) {
        throw new Error('Seleccioná un período válido para el acuerdo.')
      }

      const client = config.getClient({ chainId: networkId }).extend(publicActions)

      const decimals = await client.readContract({
        address: getAddress(tokenAddress),
        abi: erc20Abi,
        functionName: 'decimals',
      })

      const totalAmount = parseTokenAmount(values.amount, decimals)

      const agreementConfiguration = {
        beneficiary: getAddress(beneficiary),
        token: getAddress(tokenAddress),
        totalAmount,
        startDate: BigInt(Math.floor(startMilliseconds / 1000)),
        endDate: BigInt(Math.floor(endMilliseconds / 1000)),
        revocable: values.revocable,
      }

      const { request } = await client.simulateContract({
        address: getAddress(contractAddress),
        abi: vestingAbi,
        functionName: 'createAgreement',
        args: [agreementConfiguration],
        account: owner,
      })

      if (currentRequestKey() !== requestKey || !isConnected.value || !toValue(input).enabled) {
        throw new Error('La cuenta, la red o los datos cambiaron. Revisalos y volvé a intentar.')
      }

      stage.value = 'signing'

      const hash = await writeContract({
        ...request,
        chainId: networkId,
      })

      transactionHash.value = hash
      stage.value = 'confirming'

      let replaced = false

      const receipt = await client.waitForTransactionReceipt({
        hash,
        onReplaced(replacement) {
          transactionHash.value = replacement.transaction.hash
          replaced ||= replacement.reason !== 'repriced'
        },
      })

      if (replaced) {
        throw new Error(
          'La transacción fue cancelada o reemplazada. Revisá su resultado antes de reintentar.',
        )
      }

      if (receipt.status !== 'success') {
        throw new Error('La creación del acuerdo falló en la blockchain.')
      }

      isCreated.value = true
      notifySuccess('Acuerdo creado. Los tokens se transfirieron al contrato.')
    } catch (error) {
      if (error instanceof BaseError) {
        const rejected = error.walk((cause) => cause instanceof UserRejectedRequestError)

        errorMessage.value =
          rejected instanceof UserRejectedRequestError
            ? 'Cancelaste la solicitud en tu billetera.'
            : error.shortMessage
      } else {
        errorMessage.value = error instanceof Error ? error.message : 'No se pudo crear el acuerdo.'
      }

      notifyError(errorMessage.value)
    } finally {
      stage.value = 'idle'
    }
  }

  return {
    create,
    canCreate,
    isCreating,
    isCreated: readonly(isCreated),
    statusText,
    transactionHash: readonly(transactionHash),
    errorMessage: readonly(errorMessage),
  }
}
