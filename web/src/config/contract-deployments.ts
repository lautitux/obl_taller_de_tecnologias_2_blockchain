import { hardhat, sepolia } from '@wagmi/vue/chains'

// Keep this map updated when a contract is deployed to a new network.
// Networks missing from this map are not scanned: scanning from block 0 on a real
// network would take thousands of RPC requests.
export const vestingDeploymentBlocks: Readonly<Record<number, bigint>> = {
  [hardhat.id]: 0n,
  [sepolia.id]: 12_121_622n,
}

export function getVestingDeploymentBlock(chainId: number): bigint | undefined {
  return vestingDeploymentBlocks[chainId]
}
