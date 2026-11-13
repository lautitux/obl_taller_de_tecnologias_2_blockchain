import {
  experimental_createQueryPersister,
  type AsyncStorage,
  type PersistedQuery,
} from '@tanstack/query-persist-client-core'
import { hardhat } from '@wagmi/vue/chains'

const DATABASE_NAME = 'agreements-query-cache'
const DATABASE_VERSION = 2
const STORE_NAME = 'keyValue'

export const queryPersister = experimental_createQueryPersister<PersistedQuery>({
  storage: createIndexedDbStorage(),
  buster: 'agreement-events-v3',
  maxAge: 7 * 24 * 60 * 60 * 1_000,
  serialize: (persisted) => ({
    ...persisted,
    state: { ...persisted.state, error: null, fetchFailureReason: null, fetchMeta: null },
  }),
  deserialize: (stored) => stored,
})

export function isPersistableChain(chainId: number): boolean {
  return chainId !== hardhat.id
}

function createIndexedDbStorage(): AsyncStorage<PersistedQuery> | undefined {
  if (typeof indexedDB === 'undefined') return undefined

  let databasePromise: Promise<IDBDatabase> | undefined
  const openDatabase = () =>
    (databasePromise ??= new Promise((resolve, reject) => {
      const request = indexedDB.open(DATABASE_NAME, DATABASE_VERSION)
      request.onupgradeneeded = () => {
        const database = request.result
        if (database.objectStoreNames.contains(STORE_NAME)) database.deleteObjectStore(STORE_NAME)
        database.createObjectStore(STORE_NAME)
      }
      request.onsuccess = () => resolve(request.result)
      request.onerror = () => reject(request.error)
    }))

  async function run<T>(
    mode: IDBTransactionMode,
    operation: (store: IDBObjectStore) => IDBRequest<T>,
  ): Promise<T> {
    const database = await openDatabase()
    return requestToPromise(
      operation(database.transaction(STORE_NAME, mode).objectStore(STORE_NAME)),
    )
  }

  return {
    getItem: (key) => run('readonly', (store) => store.get(key)),
    setItem: (key, value) => run('readwrite', (store) => store.put(value, key)),
    removeItem: async (key) => {
      await run('readwrite', (store) => store.delete(key))
    },
    entries: async () => {
      const database = await openDatabase()
      const store = database.transaction(STORE_NAME, 'readonly').objectStore(STORE_NAME)
      const [keys, values] = await Promise.all([
        requestToPromise(store.getAllKeys()),
        requestToPromise(store.getAll() as IDBRequest<PersistedQuery[]>),
      ])
      return keys.map((key, index) => [String(key), values[index]!])
    },
  }
}

function requestToPromise<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
}
