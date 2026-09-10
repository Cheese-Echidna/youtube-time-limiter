export const STORAGE_KEYS = {
    quota: "yttl_quota",
    timeSpentSeconds: "yttl_time_spent",
    history: "yttl_history",
} as const;

export const DAILY_ALLOWANCE_MINUTES = 60;
export const DAILY_ALLOWANCE_SECONDS = DAILY_ALLOWANCE_MINUTES * 60;
export const MAX_BALANCE_MINUTES = 120;
export const MAX_BALANCE_SECONDS = MAX_BALANCE_MINUTES * 60;
export const MILLISECONDS_PER_DAY = 24 * 60 * 60 * 1000;
export const ACCRUED_SECONDS_PER_MILLISECOND = DAILY_ALLOWANCE_SECONDS / MILLISECONDS_PER_DAY;

export const TICK_INTERVAL_MS = 1000;
export const HISTORY_DAYS_VISIBLE = 14;
