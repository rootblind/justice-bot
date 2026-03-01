import { CacheEntry } from "../Interfaces/helper_types.js";

/**
 * In order to avoid stressing out the database with queries, it is encouraged to use caching.
 *
 * This class is used by database repositories to cache the content of tables.
 *
 * Some repositories can have multiple caches depending on the specific of the data that they must return.
 *
 * The constructor can be optionally provided with the number of milliseconds that the cache is valid for.
 * Upon expiration, the data is auto-deleted.
 *
 * Providing no input maintains the cache through out the session.
 *
 * Make sure to note that in order to avoid fetching invalid data, methods that delete rows from database
 * must also handle clearing that data from the cache too, if another method cached it in.
 * 
 * @param ttlMs Lifetime in milliseconds.
 */
export class SelfCache<K, V> {
    private cache = new Map<K, CacheEntry<V>>();

    constructor(private readonly ttlMs: number | null = null) { };

    /**
     * Return the entire map of the cache
     */
    fetchCache(): Map<K, CacheEntry<V>> {
        return this.cache;
    }

    /**
     * Fetch data from the cache by key.
     * @param key The key associated with the cached data
     * @returns Tha data or undefined if there is no data associated with the key.
     */
    get(key: K): V | undefined {
        const entry = this.cache.get(key);
        if (!entry) return undefined;

        if (Date.now() > entry.expiresAt && entry.expiresAt > 0) {
            // expiresAt = 0 persists until bot restart
            this.cache.delete(key);
            return undefined;
        }

        return entry.value;
    }

    /**
     * Caching data in the map. Expiration is set based on the cache's declaration.
     * @param key The key to be associated with the cached data
     * @param value The data to be cached
     */
    set(key: K, value: V): void {
        this.cache.set(key, {
            value,
            expiresAt: this.ttlMs ?
                Date.now() + this.ttlMs :
                0
        });
    }

    /**
     *
     * @param key The key of the data to be cleared
     */
    delete(key: K): void {
        this.cache.delete(key);
    }

    /**
     * Use this method only if delete(key) isn't enough.
     *
     * Delete data based on the logic function that has the key-value given.
     * @param predicate The logic to determine the clean up of data.
     * @returns Number of key-value pairs deleted
     */
    deleteByValue(
        predicate: (value: V, key: K) => boolean
    ): number {
        let deletedEntries = 0;

        for (const [key, entry] of this.cache.entries()) {
            if (predicate(entry.value, key)) {
                this.cache.delete(key);
                ++deletedEntries;
            }
        }

        return deletedEntries;
    }

    /**
     * Use this method only if get(key) is not enough.
     *
     * Query the cache using the predicate function based on key-value to fetch data.
     * @param predicate The logic to determine which data must be fetched from the cache.
     * @returns Array of data or undefined if none was found.
     */
    getByValue(
        predicate: (value: V, key: K) => boolean
    ): V[] | undefined {
        const res: V[] = []
        for (const [key, entry] of this.cache.entries()) {
            if (predicate(entry.value, key)) {
                if (Date.now() > entry.expiresAt && entry.expiresAt > 0) {
                    // expiresAt = 0 persists until bot restart
                    this.cache.delete(key);
                    continue;
                }
                res.push(entry.value);
            }
        }

        if (res.length) {
            return res;
        } else {
            return undefined;
        }
    }

    /**
     * Wipe the entire cache.
     */
    clear(): void {
        this.cache.clear();
    }
}
