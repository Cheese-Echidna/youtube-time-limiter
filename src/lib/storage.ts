import { STORAGE_KEYS } from "./constants";

// The quota is intentionally one synced value so a read never combines fields from
// different writes. Its updates are serialized by the background script.
const syncKeys: ReadonlySet<string> = new Set([STORAGE_KEYS.quota]);

function getStorageArea(key: string): browser.storage.StorageArea {
    return syncKeys.has(key) ? browser.storage.sync : browser.storage.local;
}

export async function getValueFromStorage<T>(key: string, fallback: T): Promise<T> {
    try {
        const storageArea = getStorageArea(key);
        const data = (await storageArea.get({ [key]: fallback })) as Record<string, unknown>;
        const value = data[key];
        return value === undefined ? fallback : (value as T);
    } catch (error) {
        console.error(`Failed to read key "${key}" from storage.`, error);
        return fallback;
    }
}

export async function getNumberFromStorage(key: string, fallback: number): Promise<number> {
    const value = await getValueFromStorage<unknown>(key, fallback);
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
}

export async function setValueInStorage<T>(key: string, value: T): Promise<void> {
    try {
        const storageArea = getStorageArea(key);
        await storageArea.set({ [key]: value });
    } catch (error) {
        console.error(`Failed to write key "${key}" to storage.`, error);
        throw error;
    }
}
