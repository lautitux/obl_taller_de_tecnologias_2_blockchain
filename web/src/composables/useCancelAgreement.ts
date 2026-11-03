import { computed, readonly, shallowRef } from 'vue'
import { useConfig, useConnection, useWriteContract } from '@wagmi/vue'
import { BaseError, UserRejectedRequestError, isAddress, publicActions, type Hash } from 'viem'
import { vestingAbi } from '@/contracts/vestingAbi'
import { useSettings } from '@/composables/useSettings'
import { useSnackbar } from '@/composables/useSnackbar'
import type { MyAgreement } from '@/composables/useReadVesting'

export function useCancelAgreement() {
  const config = useConfig()
  const { address, chainId, isConnected } = useConnection()
  const { settings } = useSettings()
  const { mutateAsync: writeContract } = useWriteContract()
  const { notifySuccess, notifyError } = useSnackbar()
  const stage = shallowRef<'idle' | 'checking' | 'signing' | 'confirming'>('idle')
  const errorMessage = shallowRef('')
  const transactionHash = shallowRef<Hash | null>(null)
  const isCancelling = computed(() => stage.value !== 'idle')
  const statusText = computed(
    () =>
      ({
        idle: '',
        checking: 'Verificando que el acuerdo se pueda cancelar…',
        signing: 'Confirmá la cancelación en tu billetera.',
        confirming: 'Esperando la confirmación de la cancelación…',
      })[stage.value],
  )
  const requestKey = () => JSON.stringify([address.value, chainId.value, settings.contractAddress])

  function reset() {
    if (isCancelling.value) return
    errorMessage.value = ''
    transactionHash.value = null
  }

  async function cancel(agreement: MyAgreement) {
    if (isCancelling.value || !agreement.canCancel) return false
    reset()
    const key = requestKey()
    const owner = address.value
    const networkId = chainId.value
    const contract = settings.contractAddress ?? ''
    stage.value = 'checking'

    try {
      if (
        !isConnected.value ||
        !owner ||
        networkId === undefined ||
        !isAddress(contract) ||
        !config.chains.some((chain) => chain.id === networkId) ||
        owner.toLowerCase() !== agreement.payer.toLowerCase()
      ) {
        throw new Error('Revisá la billetera, la red y el contrato antes de cancelar.')
      }
      const client = config.getClient({ chainId: networkId }).extend(publicActions)
      const { request } = await client.simulateContract({
        address: contract,
        abi: vestingAbi,
        functionName: 'cancelAgreement',
        args: [BigInt(agreement.id)],
        account: owner,
      })
      if (requestKey() !== key || !isConnected.value) {
        throw new Error(
          'La billetera, la red o el contrato cambiaron. Volvé a seleccionar el acuerdo.',
        )
      }
      stage.value = 'signing'
      const hash = await writeContract({ ...request, chainId: networkId })
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
      if (replaced)
        throw new Error(
          'La transacción fue cancelada o reemplazada. Actualizá el listado para revisar su resultado.',
        )
      if (receipt.status !== 'success') throw new Error('La cancelación falló en la blockchain.')
      notifySuccess(`Acuerdo #${agreement.id} cancelado. Se devolvieron los tokens no devengados.`)
      return true
    } catch (error) {
      errorMessage.value =
        error instanceof BaseError
          ? error.walk((cause) => cause instanceof UserRejectedRequestError) instanceof
            UserRejectedRequestError
            ? 'Cancelaste la solicitud en tu billetera.'
            : error.shortMessage
          : error instanceof Error
            ? error.message
            : 'No se pudo cancelar el acuerdo.'
      notifyError(errorMessage.value)
      return false
    } finally {
      stage.value = 'idle'
    }
  }

  return {
    cancel,
    reset,
    isCancelling,
    statusText,
    errorMessage: readonly(errorMessage),
    transactionHash: readonly(transactionHash),
  }
}
