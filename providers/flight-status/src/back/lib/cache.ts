interface ICacheEntry<V> {
    value: V
    expires: number
}

/** TTL cache with coalescing: concurrent requests for the same key share one single call. */
export class TtlCache<V> {
    private store = new Map<string, ICacheEntry<V>>()
    private inflight = new Map<string, Promise<V>>()

    constructor(private readonly maxEntries = 5000) {}

    set(key: string, value: V, ttlMs: number): void {
        this.store.delete(key)
        this.store.set(key, { value, expires: Date.now() + ttlMs })
        // A Map iterates in insertion order: the first key is the oldest one
        while (this.store.size > this.maxEntries) {
            this.store.delete(this.store.keys().next().value as string)
        }
    }

    getOrLoad(key: string, loader: () => Promise<V>, ttlFor: (v: V) => number): Promise<V> {
        const entry = this.store.get(key)
        if (entry && entry.expires > Date.now()) return Promise.resolve(entry.value)
        const pending = this.inflight.get(key)
        if (pending) return pending
        const p = loader()
            .then(v => {
                this.set(key, v, ttlFor(v))
                return v
            })
            .finally(() => this.inflight.delete(key))
        this.inflight.set(key, p)
        return p
    }
}
