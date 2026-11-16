import { hardhat, sepolia } from '@wagmi/vue/chains'
import type { Address } from 'viem'

export interface VestingDeployment {
  address: Address
  // First block to scan for events. Scanning from block 0 on a real network would take
  // thousands of RPC requests.
  deploymentBlock: bigint
}

// Keep this map updated when the contract is deployed to a new network
// (see blockchain/ignition/deployments/chain-<id>/deployed_addresses.json).
// Networks missing from this map are treated as unsupported.
export const vestingDeployments: Readonly<Record<number, VestingDeployment>> = {
  [hardhat.id]: {
    address: '0x5FbDB2315678afecb367f032d93F642f64180aa3',
    deploymentBlock: 0n,
  },
  [sepolia.id]: {
    address: '0x1d1CbE4EE8cfcfA3369130E7be891396322da590',
    deploymentBlock: 12_148_350n,
  },
}

export function getVestingDeployment(chainId: number): VestingDeployment | undefined {
  return vestingDeployments[chainId]
}
