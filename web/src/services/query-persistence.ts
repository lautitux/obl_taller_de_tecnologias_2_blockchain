import { createAsyncStoragePersister } from '@tanstack/query-async-storage-persister'
import type { AsyncStorage } from '@tanstack/query-persist-client-core'

const DATABASE_NAME = 'agreements-query-cache'
const STORE_NAME = 'keyValue'
const DATABASE_VERSION = 1
const BIGINT_KEY = '__agreement_bigint__'

export function createQueryCachePersister() {
  return createAsyncStoragePersister({
    storage: createIndexedDbStorage(),
    key: 'agreement-events-query-cache',
    throttleTime: 1_000,
    serialize: (value) => JSON.stringify(value, (_, item: unknown) => {
      if (typeof item === 'bigint') return { [BIGINT_KEY]: item.toString() }
      return item
    }),
    deserialize: (value) =>
      JSON.parse(value, (_, item: unknown) => {
        if (
          typeof item === 'object' &&
          item !== null &&
          BIGINT_KEY in item &&
          typeof item[BIGINT_KEY] === 'string'
        ) {
          return BigInt(item[BIGINT_KEY])
        }
        return item
      }),
  })
}

function createIndexedDbStorage(): AsyncStorage<string> {
  let databasePromise: Promise<IDBDatabase> | undefined

  function openDatabase(): Promise<IDBDatabase> {
    if (databasePromise !== undefined) return databasePromise
    if (typeof indexedDB === 'undefined') {
      throw new Error('IndexedDB no está disponible en este navegador.')
    }

    databasePromise = new Promise((resolve, reject) => {
      const request = indexedDB.open(DATABASE_NAME, DATABASE_VERSION)
      request.onerror = () => reject(request.error ?? new Error('No se pudo abrir IndexedDB.'))
      request.onupgradeneeded = () => request.result.createObjectStore(STORE_NAME)
      request.onsuccess = () => resolve(request.result)
    })
    return databasePromise
  }

  return {
    async getItem(key: string) {
      const database = await openDatabase()
      const request = database
        .transaction(STORE_NAME, 'readonly')
        .objectStore(STORE_NAME)
        .get(key)
      return requestToPromise(request)
    },
    async setItem(key: string, value: string) {
      const database = await openDatabase()
      const transaction = database.transaction(STORE_NAME, 'readwrite')
      transaction.objectStore(STORE_NAME).put(value, key)
      await transactionToPromise(transaction)
    },
    async removeItem(key: string) {
      const database = await openDatabase()
      const transaction = database.transaction(STORE_NAME, 'readwrite')
      transaction.objectStore(STORE_NAME).delete(key)
      await transactionToPromise(transaction)
    },
  }
}

function requestToPromise<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onerror = () => reject(request.error ?? new Error('Falló una operación IndexedDB.'))
    request.onsuccess = () => resolve(request.result)
  })
}

function transactionToPromise(transaction: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    transaction.onerror = () =>
      reject(transaction.error ?? new Error('Falló una transacción IndexedDB.'))
    transaction.onabort = () => reject(transaction.error ?? new Error('Se abortó IndexedDB.'))
    transaction.oncomplete = () => resolve()
  })
}
