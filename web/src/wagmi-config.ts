import { createConfig, fallback, http } from '@wagmi/vue'
import { mainnet, sepolia, hardhat } from '@wagmi/vue/chains'
import { injected } from '@wagmi/vue/connectors'

// Cutom RPC url (e.g. Alchemy, Infura, etc.). If not defined, public RPCs are used in order.
// `fallback` skips to the next one when one fails or rate limits.
const sepoliaRpcUrl = import.meta.env.VITE_SEPOLIA_RPC_URL as string | undefined

export const wagmiConfig = createConfig({
  chains: [mainnet, sepolia, hardhat],
  connectors: [injected()],
  transports: {
    [mainnet.id]: http(),
    [sepolia.id]: fallback([
      ...(sepoliaRpcUrl ? [http(sepoliaRpcUrl)] : []),
      http('https://ethereum-sepolia-rpc.publicnode.com'),
      http(),
    ]),
    [hardhat.id]: http(),
  },
})
