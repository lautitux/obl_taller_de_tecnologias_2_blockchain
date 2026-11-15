import type { TransactionReceipt } from '@/types/transaction'
import { errorAsMessage, interpretError } from '@/utils/errors'
import { useConfig } from '@wagmi/vue'
import { waitForTransactionReceipt } from '@wagmi/vue/actions'
import type { Address, Hash } from 'viem'
import { readonly, shallowRef } from 'vue'

export interface TransactionCallbacks<TArgs extends unknown[]> {
  onSuccess?: (receipt: TransactionReceipt, ...args: TArgs) => void
  onError?: (message: string, error: unknown) => void
}

export interface SubmittedTransaction {
  hash: Hash
  chainId: number
  address: Address
}

interface ContractTransactionOptions<TArgs extends unknown[]> extends TransactionCallbacks<TArgs> {
  /**
   * Runs after the receipt is confirmed and before `onSuccess`, while the transaction is still
   * pending.
   */
  onConfirmed?: (transaction: SubmittedTransaction, ...args: TArgs) => unknown
}

export function useContractTransaction<TArgs extends unknown[]>(
  submit: (...args: TArgs) => Promise<SubmittedTransaction>,
  options: ContractTransactionOptions<TArgs> = {},
) {
  const { onConfirmed, onSuccess, onError } = options
  const config = useConfig()

  const isPending = shallowRef(false)
  const isSuccess = shallowRef(false)
  const receipt = shallowRef<TransactionReceipt | null>(null)
  const error = shallowRef<unknown>(null)
  const errorMessage = shallowRef<string | null>(null)

  async function execute(...args: TArgs): Promise<TransactionReceipt | null> {
    if (isPending.value) return null

    isPending.value = true
    isSuccess.value = false
    receipt.value = null
    error.value = null
    errorMessage.value = null

    let transaction: SubmittedTransaction
    let confirmed: TransactionReceipt
    try {
      transaction = await submit(...args)
      confirmed = await waitForTransactionReceipt(config, {
        hash: transaction.hash,
        chainId: transaction.chainId,
      })
      receipt.value = confirmed
      if (confirmed.status === 'reverted') throw new Error('La transacción revirtió.')
    } catch (err) {
      console.error(err)
      const message = errorAsMessage(interpretError(err))
      error.value = err
      errorMessage.value = message
      isPending.value = false
      onError?.(message, err)
      return null
    }

    isSuccess.value = true
    try {
      await onConfirmed?.(transaction, ...args)
    } finally {
      isPending.value = false
    }
    onSuccess?.(confirmed, ...args)
    return confirmed
  }

  return {
    execute,
    isPending: readonly(isPending),
    isSuccess: readonly(isSuccess),
    receipt: readonly(receipt),
    error: readonly(error),
    errorMessage: readonly(errorMessage),
  }
}
