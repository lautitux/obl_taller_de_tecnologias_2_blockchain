import type { Address, Hash, Hex, Log, TransactionType } from "viem"

export interface TransactionReceipt {
  blobGasPrice?: bigint | undefined
  blobGasUsed?: bigint | undefined
  blockHash: Address
  blockNumber: bigint
  blockTimestamp?: bigint | undefined
  contractAddress: Address | null | undefined
  cumulativeGasUsed: bigint
  effectiveGasPrice: bigint
  from: Address
  gasUsed: bigint
  logs: Log<bigint, number, false>[]
  logsBloom: Hex
  root?: Address | undefined
  status: 'success' | 'reverted'
  to: Address | null
  transactionHash: Hash
  transactionIndex: number
  type: TransactionType
  chainId: number
}
