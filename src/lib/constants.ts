export const STORAGE_KEYS = {
    timeSpentSeconds: "yttl_time_spent",
    lastResetWeekKey: "yttl_last_reset_day",
    history: "yttl_history",
    middayRestrictionEnabled: "yttl_midday_restriction_enabled",
} as const;

export const WEEKLY_LIMIT_HOURS = 7;
export const WEEKLY_LIMIT_MINUTES = WEEKLY_LIMIT_HOURS * 60;
export const WEEKLY_LIMIT_SECONDS = WEEKLY_LIMIT_MINUTES * 60;

export const MIDDAY_CUTOFF_HOUR = 12;
export const TICK_INTERVAL_MS = 1000;
export const HISTORY_DAYS_VISIBLE = 14;
