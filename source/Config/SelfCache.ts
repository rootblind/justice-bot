import { CacheEntry } from "../Interfaces/helper_types.js";

export class SelfCache<K, V> {
    private cache = new Map<K, CacheEntry<V>>();

    constructor(private readonly ttlMs: number | null = null) {};

    get(key: K): V | undefined {
        const entry = this.cache.get(key);
        if(!entry) return undefined;

        if(Date.now() > entry.expiresAt && entry.expiresAt > 0) {
            // expiresAt = 0 persists until bot restart
            this.cache.delete(key);
            return undefined;
        }

        return entry.value;
    }

    set(key: K, value: V): void {
        this.cache.set(key, {
            value,
            expiresAt: this.ttlMs ?
                Date.now() + this.ttlMs :
                0
        });
    }

    delete(key: K): void {
        this.cache.delete(key);
    }

    deleteByValue(
        predicate: (value: V, key: K) => boolean
    ): number {
        let deletedEntries = 0;

        for(const [key, entry] of this.cache.entries()) {
            if(predicate(entry.value, key)) {
                this.cache.delete(key);
                ++deletedEntries;
            }
        }

        return deletedEntries;
    }

    getByValue(
        predicate: (value: V, key: K) => boolean
    ): V[] | undefined {
        const res: V[] = []
        for(const [key, entry] of this.cache.entries()) {
            if(predicate(entry.value, key)) {
                if(Date.now() > entry.expiresAt && entry.expiresAt > 0) {
                    // expiresAt = 0 persists until bot restart
                    this.cache.delete(key);
                    continue;
                }
                res.push(entry.value);
            }
        }

        if(res.length) {
            return res;
        } else {
            return undefined;
        }
    }

    clear(): void {
        this.cache.clear();
    }
}