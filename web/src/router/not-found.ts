import type { RouteLocationNormalized, RouteLocationRaw } from 'vue-router'

export function notFoundLocation(route: RouteLocationNormalized): RouteLocationRaw {
  return {
    name: 'not-found',
    params: { pathMatch: route.path.substring(1).split('/') },
    query: route.query,
    hash: route.hash,
  }
}
