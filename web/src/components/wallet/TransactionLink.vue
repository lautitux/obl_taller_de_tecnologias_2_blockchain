<script setup lang="ts">
import { useChains } from '@wagmi/vue'
import type { Hex } from 'viem'
import { computed } from 'vue'

const { transactionHash, chainId } = defineProps<{ transactionHash: Hex; chainId: number }>()

const chains = useChains()

const explorer = computed(() => {
  const currentChain = chains.value.find((chain) => chain.id === chainId)
  return currentChain?.blockExplorers?.default
})
</script>

<template>
  <a
    v-if="explorer"
    :href="`${explorer.url}/tx/${transactionHash}`"
    target="_blank"
    rel="noopener noreferrer"
    >{{ transactionHash }}</a
  >
  <span v-else>{{ transactionHash }}</span>
</template>
