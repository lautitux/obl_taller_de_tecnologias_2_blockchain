import { createConfig, http } from '@wagmi/vue'
import { mainnet, sepolia } from '@wagmi/vue/chains'
import { injected } from '@wagmi/vue/connectors'

export const wagmiConfig = createConfig({
  chains: [mainnet, sepolia],
  connectors: [injected()],
  transports: {
    [mainnet.id]: http(),
    [sepolia.id]: http(),
  },
})
