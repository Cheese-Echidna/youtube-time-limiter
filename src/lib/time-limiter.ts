import {
    ACCRUED_SECONDS_PER_MILLISECOND,
    DAILY_ALLOWANCE_SECONDS,
    MAX_BALANCE_SECONDS,
    STORAGE_KEYS,
} from "./constants";
import { toDateKey } from "./date";
import { getNumberFromStorage, getValueFromStorage, setValueInStorage } from "./storage";

export type UsageHistory = Record<string, number>;

export type Quota = {
    availableSeconds: number;
    updatedAt: number;
};

function sanitizeHistory(rawValue: unknown): UsageHistory {
    if (!rawValue || typeof rawValue !== "object" || Array.isArray(rawValue)) {
        return {};
    }

    const history: UsageHistory = {};
    for (const [dateKey, value] of Object.entries(rawValue as Record<string, unknown>)) {
        const seconds = Number(value);
        if (!Number.isFinite(seconds) || seconds <= 0) {
            continue;
        }

        history[dateKey] = Math.round(seconds);
    }

    return history;
}

export async function getHistory(): Promise<UsageHistory> {
    const rawHistory = await getValueFromStorage<unknown>(STORAGE_KEYS.history, {});
    return sanitizeHistory(rawHistory);
}

async function setHistory(history: UsageHistory): Promise<void> {
    await setValueInStorage(STORAGE_KEYS.history, history);
}

export async function addToHistory(seconds: number): Promise<void> {
    const normalizedSeconds = Math.max(0, Math.round(seconds));
    if (normalizedSeconds === 0) {
        return;
    }

    const dateKey = toDateKey(new Date());
    const history = await getHistory();
    history[dateKey] = (history[dateKey] ?? 0) + normalizedSeconds;
    await setHistory(history);
}

export async function buildHistoryCsv(): Promise<string> {
    const history = await getHistory();
    const rows: string[] = ["date,seconds,minutes"];

    for (const dateKey of Object.keys(history).sort()) {
        const seconds = Math.round(history[dateKey] ?? 0);
        const minutes = (seconds / 60).toFixed(2);
        rows.push(`${dateKey},${seconds},${minutes}`);
    }

    return rows.join("\n");
}

function sanitizeQuota(rawValue: unknown): Quota | null {
    if (!rawValue || typeof rawValue !== "object" || Array.isArray(rawValue)) {
        return null;
    }

    const rawQuota = rawValue as Record<string, unknown>;
    const availableSeconds = Number(rawQuota.availableSeconds);
    const updatedAt = Number(rawQuota.updatedAt);

    if (!Number.isFinite(availableSeconds) || !Number.isFinite(updatedAt) || updatedAt <= 0) {
        return null;
    }

    return {
        availableSeconds: Math.min(MAX_BALANCE_SECONDS, Math.max(0, availableSeconds)),
        // Do not move a future timestamp backwards. This prevents a clock change
        // on one synced device from creating extra allowance on another one.
        updatedAt,
    };
}

function accrue(quota: Quota, now: number): Quota {
    const elapsedMilliseconds = Math.max(0, now - quota.updatedAt);
    return {
        availableSeconds: Math.min(
            MAX_BALANCE_SECONDS,
            quota.availableSeconds + elapsedMilliseconds * ACCRUED_SECONDS_PER_MILLISECOND,
        ),
        updatedAt: Math.max(quota.updatedAt, now),
    };
}

async function getStoredQuota(now: number): Promise<Quota> {
    const rawQuota = await getValueFromStorage<unknown>(STORAGE_KEYS.quota, null);
    const quota = sanitizeQuota(rawQuota);
    if (quota) {
        return quota;
    }

    // Preserve an existing install's current daily balance when upgrading from
    // the midnight-reset model. New installs begin with one day's allowance.
    const legacySpentSeconds = await getNumberFromStorage(STORAGE_KEYS.timeSpentSeconds, 0);
    return {
        availableSeconds: Math.max(0, DAILY_ALLOWANCE_SECONDS - legacySpentSeconds),
        updatedAt: now,
    };
}

export async function getQuota(now: Date = new Date()): Promise<Quota> {
    const timestamp = now.getTime();
    return accrue(await getStoredQuota(timestamp), timestamp);
}

export async function saveQuota(quota: Quota): Promise<void> {
    await setValueInStorage(STORAGE_KEYS.quota, quota);
}

export function consumeQuota(quota: Quota, seconds: number): Quota {
    const requestedSeconds = Number(seconds);
    const chargeSeconds = Number.isFinite(requestedSeconds) ? Math.max(0, requestedSeconds) : 0;
    return {
        ...quota,
        availableSeconds: Math.max(0, quota.availableSeconds - chargeSeconds),
    };
}

export function quotaRemainingSeconds(quota: Quota): number {
    return Math.max(0, Math.floor(quota.availableSeconds));
}
