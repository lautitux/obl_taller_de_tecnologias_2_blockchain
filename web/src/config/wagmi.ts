import { createConfig, fallback, http } from '@wagmi/vue'
import { sepolia, hardhat } from '@wagmi/vue/chains'
import { injected } from '@wagmi/vue/connectors'

// Custom RPC url (e.g. Alchemy, Infura, etc.). If not defined, public RPCs are used in order.
// `fallback` skips to the next one when one fails or rate limits.
const sepoliaRpcUrl = import.meta.env.VITE_SEPOLIA_RPC_URL as string | undefined

// Only networks where the contract is deployed (see contract-deployments.ts). Sepolia goes
// first: it's the network used while no wallet is connected.
export const wagmiConfig = createConfig({
  chains: [sepolia, hardhat],
  connectors: [injected()],
  transports: {
    [sepolia.id]: fallback([
      ...(sepoliaRpcUrl ? [http(sepoliaRpcUrl)] : []),
      http('https://ethereum-sepolia-rpc.publicnode.com'),
      http(),
    ]),
    [hardhat.id]: http(),
  },
})
