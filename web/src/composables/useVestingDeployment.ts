import { getVestingDeployment } from '@/config/contract-deployments'
import { useChainId } from '@wagmi/vue'
import { computed } from 'vue'

export function useVestingDeployment() {
  const chainId = useChainId()
  const deployment = computed(() => getVestingDeployment(chainId.value))

  return {
    contractAddress: computed(() => deployment.value?.address),
    deploymentBlock: computed(() => deployment.value?.deploymentBlock),
  }
}
