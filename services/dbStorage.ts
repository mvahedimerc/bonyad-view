/**
 * Persistent Data Storage Engine for Yadegaran System
 * Uses IndexedDB to safely preserve all documents, profiles, memoirs, and creations
 * with virtually unlimited storage capacity, surviving page reloads and cache wipes.
 */

const DB_NAME = 'YadegaranAlborzDB';
const DB_VERSION = 1;
const STORES = {
    DOCUMENTS: 'documents',
    PROFILES: 'profiles',
    MEMOIRS: 'memoirs',
    EVENTS: 'events',
    TAGS: 'tags'
};

function openDB(): Promise<IDBDatabase> {
    return new Promise((resolve, reject) => {
        if (!window.indexedDB) {
            reject(new Error("IndexedDB is not supported in this browser environment."));
            return;
        }

        const request = window.indexedDB.open(DB_NAME, DB_VERSION);

        request.onupgradeneeded = (event: any) => {
            const db = event.target.result;
            if (!db.objectStoreNames.contains(STORES.DOCUMENTS)) {
                db.createObjectStore(STORES.DOCUMENTS, { keyPath: 'id' });
            }
            if (!db.objectStoreNames.contains(STORES.PROFILES)) {
                db.createObjectStore(STORES.PROFILES, { keyPath: 'id' });
            }
            if (!db.objectStoreNames.contains(STORES.MEMOIRS)) {
                db.createObjectStore(STORES.MEMOIRS, { keyPath: 'id' });
            }
            if (!db.objectStoreNames.contains(STORES.EVENTS)) {
                db.createObjectStore(STORES.EVENTS, { keyPath: 'day' });
            }
            if (!db.objectStoreNames.contains(STORES.TAGS)) {
                db.createObjectStore(STORES.TAGS, { keyPath: 'name' });
            }
        };

        request.onsuccess = (event: any) => {
            resolve(event.target.result);
        };

        request.onerror = (event: any) => {
            console.error("IndexedDB open error:", event.target.error);
            reject(event.target.error);
        };
    });
}

// Generic Save All Items
export async function saveAllItems<T>(storeName: string, items: T[]): Promise<void> {
    try {
        const db = await openDB();
        const tx = db.transaction(storeName, 'readwrite');
        const store = tx.objectStore(storeName);
        
        // Clear old and rewrite all items
        store.clear();
        items.forEach((item: any) => {
            if (storeName === STORES.TAGS && typeof item === 'string') {
                store.put({ name: item });
            } else {
                store.put(item);
            }
        });

        return new Promise((resolve, reject) => {
            tx.oncomplete = () => resolve();
            tx.onerror = () => reject(tx.error);
        });
    } catch (e) {
        console.warn(`IndexedDB save error for ${storeName}, falling back to localStorage:`, e);
        try {
            localStorage.setItem(`idb_fallback_${storeName}`, JSON.stringify(items));
        } catch (lsErr) {
            console.error("LocalStorage fallback error:", lsErr);
        }
    }
}

// Generic Get All Items
export async function getAllItems<T>(storeName: string, defaultItems: T[]): Promise<T[]> {
    try {
        const db = await openDB();
        const tx = db.transaction(storeName, 'readonly');
        const store = tx.objectStore(storeName);
        const request = store.getAll();

        return new Promise((resolve) => {
            request.onsuccess = () => {
                const results = request.result;
                if (results && results.length > 0) {
                    if (storeName === STORES.TAGS) {
                        const tagList = results.map((r: any) => (typeof r === 'string' ? r : r.name)).filter(Boolean);
                        resolve(tagList as unknown as T[]);
                    } else {
                        resolve(results as T[]);
                    }
                } else {
                    resolve(defaultItems);
                }
            };
            request.onerror = () => resolve(defaultItems);
        });
    } catch (e) {
        console.warn(`IndexedDB read error for ${storeName}, checking localStorage fallback:`, e);
        try {
            const saved = localStorage.getItem(`idb_fallback_${storeName}`);
            return saved ? JSON.parse(saved) : defaultItems;
        } catch (lsErr) {
            return defaultItems;
        }
    }
}

// Save Single Item
export async function saveSingleItem<T>(storeName: string, item: T): Promise<void> {
    try {
        const db = await openDB();
        const tx = db.transaction(storeName, 'readwrite');
        const store = tx.objectStore(storeName);
        store.put(item);
        return new Promise((resolve, reject) => {
            tx.oncomplete = () => resolve();
            tx.onerror = () => reject(tx.error);
        });
    } catch (e) {
        console.error(`IndexedDB single item save error for ${storeName}:`, e);
    }
}

// Delete Single Item
export async function deleteSingleItem(storeName: string, key: string | number): Promise<void> {
    try {
        const db = await openDB();
        const tx = db.transaction(storeName, 'readwrite');
        const store = tx.objectStore(storeName);
        store.delete(key);
        return new Promise((resolve, reject) => {
            tx.oncomplete = () => resolve();
            tx.onerror = () => reject(tx.error);
        });
    } catch (e) {
        console.error(`IndexedDB delete error for ${storeName}:`, e);
    }
}

export { STORES };
