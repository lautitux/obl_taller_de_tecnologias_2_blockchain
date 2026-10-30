import { createConfig, http } from '@wagmi/vue'
import { mainnet, sepolia, hardhat } from '@wagmi/vue/chains'
import { injected } from '@wagmi/vue/connectors'

export const wagmiConfig = createConfig({
  chains: [mainnet, sepolia, hardhat],
  connectors: [injected()],
  transports: {
    [mainnet.id]: http(),
    [sepolia.id]: http(),
    [hardhat.id]: http(),
  },
})
