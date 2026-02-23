import { MIDDAY_CUTOFF_HOUR, STORAGE_KEYS, WEEKLY_LIMIT_SECONDS } from "./constants";
import { getWeekKey, toDateKey } from "./date";
import { getNumberFromStorage, getValueFromStorage, setValueInStorage } from "./storage";

export type UsageHistory = Record<string, number>;

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

export async function getTimeSpentSeconds(): Promise<number> {
    return getNumberFromStorage(STORAGE_KEYS.timeSpentSeconds, 0);
}

export async function setTimeSpentSeconds(seconds: number): Promise<void> {
    const normalizedSeconds = Math.max(0, Math.round(seconds));
    await setValueInStorage(STORAGE_KEYS.timeSpentSeconds, normalizedSeconds);
}

export async function incrementTimeSpent(seconds: number): Promise<number> {
    const normalizedSeconds = Math.max(0, Math.round(seconds));
    if (normalizedSeconds === 0) {
        return getTimeSpentSeconds();
    }

    const nextValue = (await getTimeSpentSeconds()) + normalizedSeconds;
    await setTimeSpentSeconds(nextValue);
    return nextValue;
}

export async function ensureWeeklyBoundary(now: Date = new Date()): Promise<void> {
    const currentWeekKey = getWeekKey(now);
    const lastResetWeekKey = await getValueFromStorage<string | null>(STORAGE_KEYS.lastResetWeekKey, null);

    if (lastResetWeekKey === currentWeekKey) {
        return;
    }

    await setValueInStorage(STORAGE_KEYS.lastResetWeekKey, currentWeekKey);
    await setTimeSpentSeconds(0);
}

export async function getTimeRemainingSeconds(): Promise<number> {
    const spentSeconds = await getTimeSpentSeconds();
    const boundedSpentSeconds = Math.min(spentSeconds, WEEKLY_LIMIT_SECONDS);
    return Math.max(0, WEEKLY_LIMIT_SECONDS - boundedSpentSeconds);
}

export async function hasReachedWeeklyLimit(): Promise<boolean> {
    const spentSeconds = await getTimeSpentSeconds();
    return spentSeconds >= WEEKLY_LIMIT_SECONDS;
}

export async function isMiddayRestrictionEnabled(): Promise<boolean> {
    const value = await getValueFromStorage(STORAGE_KEYS.middayRestrictionEnabled, true);
    return Boolean(value);
}

export async function setMiddayRestrictionEnabled(enabled: boolean): Promise<void> {
    await setValueInStorage(STORAGE_KEYS.middayRestrictionEnabled, enabled);
}

export function isBeforeMidday(now: Date = new Date()): boolean {
    return now.getHours() < MIDDAY_CUTOFF_HOUR;
}
