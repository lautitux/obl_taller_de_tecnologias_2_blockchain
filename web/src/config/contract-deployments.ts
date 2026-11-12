import { hardhat, sepolia } from '@wagmi/vue/chains'

// Keep this map updated when a contract is deployed to a new network.
export const vestingDeploymentBlocks: Readonly<Record<number, bigint>> = {
  [hardhat.id]: 0n,
  [sepolia.id]: 12_121_622n,
}

export function getVestingDeploymentBlock(chainId: number): bigint {
  return vestingDeploymentBlocks[chainId] ?? 0n
}
