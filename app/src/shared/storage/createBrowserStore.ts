type StorageKind = 'local' | 'session'

interface CreateBrowserStoreOptions<T> {
  key: string
  storage?: StorageKind
  fallback: T | (() => T)
  deserialize?: (raw: string) => T | null
  serialize?: (value: T) => string
}

type Listener<T> = (value: T) => void

function resolveFallback<T>(fallback: T | (() => T)): T {
  return typeof fallback === 'function' ? (fallback as () => T)() : fallback
}

function getStorage(kind: StorageKind): Storage | null {
  if (typeof window === 'undefined') return null
  return kind === 'session' ? window.sessionStorage : window.localStorage
}

export function createBrowserStore<T>(options: CreateBrowserStoreOptions<T>) {
  const {
    key,
    storage = 'local',
    fallback,
    deserialize = (raw) => JSON.parse(raw) as T,
    serialize = (value) => JSON.stringify(value),
  } = options

  const listeners = new Set<Listener<T>>()
  let subscribedToWindow = false

  const emit = (value: T) => {
    listeners.forEach((listener) => listener(value))
  }

  const read = (): T => {
    const target = getStorage(storage)
    if (!target) return resolveFallback(fallback)

    try {
      const raw = target.getItem(key)
      if (!raw) return resolveFallback(fallback)

      const parsed = deserialize(raw)
      return parsed ?? resolveFallback(fallback)
    } catch {
      return resolveFallback(fallback)
    }
  }

  const write = (value: T) => {
    const target = getStorage(storage)
    if (!target) return

    target.setItem(key, serialize(value))
    emit(value)
  }

  const remove = () => {
    const target = getStorage(storage)
    if (!target) return

    target.removeItem(key)
    emit(resolveFallback(fallback))
  }

  const ensureWindowSubscription = () => {
    if (subscribedToWindow || typeof window === 'undefined') return

    window.addEventListener('storage', (event) => {
      if (event.key !== key) return
      emit(read())
    })

    subscribedToWindow = true
  }

  const subscribe = (listener: Listener<T>) => {
    ensureWindowSubscription()
    listeners.add(listener)
    return () => {
      listeners.delete(listener)
    }
  }

  return {
    get: read,
    set: write,
    remove,
    subscribe,
  }
}
