import { computed, readonly, shallowRef, toValue, watch, type MaybeRefOrGetter } from 'vue'
import { useConfig, useConnection, useWriteContract } from '@wagmi/vue'
import {
  BaseError,
  UserRejectedRequestError,
  erc20Abi,
  getAddress,
  getContract,
  isAddress,
  publicActions,
  zeroAddress,
  type Hash,
} from 'viem'
import { useSnackbar } from '@/composables/useSnackbar'
import { parseTokenAmount } from '@/utils/tokenAmount'

interface TokenApprovalInput {
  token: string
  amount: string
  spender: string
  enabled: boolean
}

export function useTokenApproval(input: MaybeRefOrGetter<TokenApprovalInput>) {
  const config = useConfig()
  const { address, chainId, isConnected } = useConnection()
  const { mutateAsync: writeContract } = useWriteContract()
  const { notifyError, notifySuccess, notifyInfo } = useSnackbar()
  const stage = shallowRef<'idle' | 'checking' | 'signing' | 'confirming'>('idle')
  const resettingAllowance = shallowRef(false)
  const transaction = shallowRef<{ hash: Hash; key: string; explorer?: string } | null>(null)
  const approvedKey = shallowRef<string | null>(null)
  const errorMessage = shallowRef('')

  const request = computed(() => {
    const values = toValue(input)
    const owner = address.value
    const networkId = chainId.value
    const token = values.token.trim()
    const spender = values.spender.trim()
    if (
      !isConnected.value ||
      !owner ||
      networkId === undefined ||
      !config.chains.some((chain) => chain.id === networkId) ||
      !isAddress(token) ||
      token === zeroAddress ||
      !isAddress(spender) ||
      spender === zeroAddress
    ) {
      return null
    }
    const amount = values.amount.trim()
    return {
      owner,
      chainId: networkId,
      token: getAddress(token),
      spender: getAddress(spender),
      amount,
      key: JSON.stringify([
        owner.toLowerCase(),
        networkId,
        token.toLowerCase(),
        spender.toLowerCase(),
        amount,
      ]),
    }
  })

  const isApproving = computed(() => stage.value !== 'idle')
  watch(
    () => request.value?.key,
    () => {
      approvedKey.value = null
      errorMessage.value = ''
    },
    { flush: 'sync' },
  )
  const isApproved = computed(() => !!request.value && approvedKey.value === request.value.key)
  const canApprove = computed(
    () => toValue(input).enabled && !!request.value && !isApproving.value && !isApproved.value,
  )
  const statusText = computed(() => {
    if (stage.value === 'checking') return 'Verificando el token y la autorización…'
    if (stage.value === 'signing') {
      return resettingAllowance.value
        ? 'Confirmá en tu billetera el restablecimiento de la autorización a cero.'
        : 'Confirmá la aprobación en tu billetera.'
    }
    if (stage.value === 'confirming') {
      return resettingAllowance.value
        ? 'Esperando la confirmación del restablecimiento…'
        : 'Esperando la confirmación de la aprobación…'
    }
    return ''
  })
  const currentTransaction = computed(() =>
    transaction.value?.key === request.value?.key ? transaction.value : null,
  )

  async function approve() {
    if (!canApprove.value || !request.value) return
    const snapshot = request.value
    approvedKey.value = null
    errorMessage.value = ''
    transaction.value = null
    stage.value = 'checking'

    function assertCurrentRequest() {
      if (request.value?.key !== snapshot.key || !toValue(input).enabled) {
        throw new Error(
          'La cuenta, la red o los datos cambiaron. Revisá el formulario y volvé a aprobar.',
        )
      }
    }

    try {
      const client = config.getClient({ chainId: snapshot.chainId }).extend(publicActions)
      const token = getContract({ address: snapshot.token, abi: erc20Abi, client })
      const [decimals, allowance, contractCode] = await Promise.all([
        token.read.decimals(),
        token.read.allowance([snapshot.owner, snapshot.spender]),
        client.getCode({ address: snapshot.spender }),
      ])
      assertCurrentRequest()
      if (!contractCode || contractCode === '0x') {
        throw new Error(
          'No hay un contrato en la dirección configurada para esta red. Revisá Configuración.',
        )
      }
      const amount = parseTokenAmount(snapshot.amount, decimals)
      if (allowance >= amount) {
        approvedKey.value = snapshot.key
        notifyInfo('Ya tenés una autorización suficiente para este monto.')
        return
      }

      async function sendApproval(value: bigint) {
        assertCurrentRequest()
        stage.value = 'signing'
        const hash = await writeContract({
          address: snapshot.token,
          abi: erc20Abi,
          functionName: 'approve',
          args: [snapshot.spender, value],
          account: snapshot.owner,
          chainId: snapshot.chainId,
        })
        const explorer = client.chain.blockExplorers?.default.url
        transaction.value = { hash, key: snapshot.key, explorer }
        stage.value = 'confirming'
        let replaced = false
        const receipt = await client.waitForTransactionReceipt({
          hash,
          onReplaced(replacement) {
            transaction.value = { hash: replacement.transaction.hash, key: snapshot.key, explorer }
            replaced ||= replacement.reason !== 'repriced'
          },
        })
        if (replaced)
          throw new Error(
            'La transacción fue cancelada o reemplazada. Volvé a verificar la autorización.',
          )
        if (receipt.status !== 'success')
          throw new Error('La transacción de aprobación falló en la blockchain.')
        assertCurrentRequest()
      }

      // Tokens such as USDT require clearing an existing allowance before changing it.
      if (allowance > 0n) {
        resettingAllowance.value = true
        notifyInfo(
          'Primero restablecé la autorización anterior a cero. Luego aprobarás el nuevo monto.',
        )
        await sendApproval(0n)
      }
      resettingAllowance.value = false
      await sendApproval(amount)
      const confirmedAllowance = await token.read.allowance([snapshot.owner, snapshot.spender])
      assertCurrentRequest()
      if (confirmedAllowance < amount) {
        throw new Error(
          'La transacción se confirmó, pero el token no autorizó el monto solicitado.',
        )
      }
      approvedKey.value = snapshot.key
      notifySuccess('Tokens aprobados. La autorización se confirmó en la blockchain.')
    } catch (error) {
      if (error instanceof BaseError) {
        const rejected = error.walk((cause) => cause instanceof UserRejectedRequestError)
        errorMessage.value =
          rejected instanceof UserRejectedRequestError
            ? 'Cancelaste la solicitud en tu billetera.'
            : error.shortMessage
      } else {
        errorMessage.value =
          error instanceof Error ? error.message : 'No se pudo aprobar el uso de tokens.'
      }
      notifyError(errorMessage.value)
    } finally {
      stage.value = 'idle'
      resettingAllowance.value = false
    }
  }

  return {
    approve,
    canApprove,
    isApproving,
    isApproved,
    statusText,
    transaction: currentTransaction,
    errorMessage: readonly(errorMessage),
  }
}
