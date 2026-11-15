import { getCurrentScope, onScopeDispose, readonly, shallowRef } from 'vue'

interface UseNowOptions {
  intervalMilliseconds?: number
}

export function useNow(options: UseNowOptions = {}) {
  const { intervalMilliseconds: interval = 1_000 } = options
  const now = shallowRef(Date.now())

  const timer = setInterval(() => {
    now.value = Date.now()
  }, interval)
  if (getCurrentScope()) onScopeDispose(() => clearInterval(timer))

  return readonly(now)
}
