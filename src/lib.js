/// <reference types="webextension-polyfill" />

// Keys and constants
const TIME_SPENT_KEY = "yttl_time_spent";
const LAST_RESET_DAY_KEY = "yttl_last_reset_day"; // stores date key aligned to reset time
const HISTORY_KEY = "yttl_history";
const DAILY_LIMIT_MIN_KEY = "yttl_daily_limit_min";
const RESET_TIME_KEY = "yttl_reset_time"; // "HH:MM"
const DEBUG = false;

// Keys that should sync across devices
const SYNC_KEYS = new Set([TIME_SPENT_KEY, LAST_RESET_DAY_KEY]);

// Helper function to determine which storage area to use
function getStorageArea(key) {
    return SYNC_KEYS.has(key) ? browser.storage.sync : browser.storage.local;
}

// Helper function to get numeric item from storage with a default value
async function getItem(key, defaultValue) {
    try {
        const storage = getStorageArea(key);
        const value = (await storage.get({ [key]: defaultValue }))[key];
        if (value === undefined || value === null) {
            return defaultValue;
        }
        return Number(value);
    } catch (error) {
        console.error(`Error getting ${key} from storage:`, error);
        return defaultValue;
    }
}

// Helper to get raw (non-numeric) values
async function getRawItem(key, defaultValue) {
    try {
        const storage = getStorageArea(key);
        const value = (await storage.get({ [key]: defaultValue }))[key];
        return value === undefined ? defaultValue : value;
    } catch (e) {
        console.error(`Error getting raw ${key}:`, e);
        return defaultValue;
    }
}

// Helper function to set an item in storage
async function setItem(key, value) {
    try {
        const storage = getStorageArea(key);
        await storage.set({ [key]: value });
    } catch (error) {
        console.error(`Unexpected error setting ${key} in storage:`, error);
        return Promise.reject(error);
    }
}

// Settings helpers
// Weekly limit: fixed 7 hours (420 minutes)
async function getDailyLimitMinutes() {
    // Keep function name for backward compatibility; now returns weekly minutes (7h = 420min)
    return 420;
}
async function setDailyLimitMinutes(m) {
    // No-op: limit is fixed in code now
}
async function getDailyLimitSeconds() {
    // Weekly limit in seconds
    return (await getDailyLimitMinutes()) * 60;
}

// Reset time settings are deprecated; kept for backward compatibility with storage structure
async function getResetTimeString() {
    return "00:00";
}
async function setResetTimeString(v) {
    // No-op in fixed-schedule mode
}

function parseResetOffsetMinutes(str) {
    const [hh, mm] = str.split(":").map(Number);
    return hh * 60 + mm;
}

function getShiftedDateKey(date, resetMinutes) {
    // Shift date backwards by resetMinutes to align day boundary (used for per-day history)
    const d = new Date(date.getTime() - resetMinutes * 60 * 1000);
    return d.toISOString().slice(0, 10); // YYYY-MM-DD
}

function getWeekKey(date) {
    // Returns YYYY-MM-DD for the Monday of the current week (local time)
    const d = new Date(date);
    d.setHours(0, 0, 0, 0);
    const day = d.getDay(); // 0=Sun,1=Mon,...
    const diffFromMonday = (day + 6) % 7; // 0 when Monday
    d.setDate(d.getDate() - diffFromMonday);
    return d.toISOString().slice(0, 10);
}

async function getHistory() {
    return await getRawItem(HISTORY_KEY, {});
}
async function setHistory(h) {
    await setItem(HISTORY_KEY, h);
}
async function addToHistory(seconds) {
    // Keep daily history (aligned to midnight) for charting purposes
    const key = getShiftedDateKey(new Date(), 0);
    const history = await getHistory();
    history[key] = (history[key] || 0) + seconds;
    await setHistory(history);
}

async function buildHistoryCsv() {
    const history = await getHistory();
    const rows = ["date,seconds,minutes"];
    const keys = Object.keys(history).sort();
    for (const k of keys) {
        const sec = Math.round(history[k] || 0);
        const min = (sec / 60).toFixed(2);
        rows.push(`${k},${sec},${min}`);
    }
    return rows.join("\n");
}

async function getTimeSpent() {
    return await getItem(TIME_SPENT_KEY, 0);
}

async function ensureResetBoundary() {
    // Reset if we crossed the weekly boundary (Monday 00:00 local time)
    const now = new Date();
    const lastKey = await getRawItem(LAST_RESET_DAY_KEY, null);
    const currentKey = getWeekKey(now);
    if (lastKey !== currentKey) {
        await setItem(LAST_RESET_DAY_KEY, currentKey);
        await resetTimeSpent();
        // start the new week fresh
    }
}

async function getTimeRemaining() {
    const max = await getDailyLimitSeconds();
    return max - Math.min(await getTimeSpent(), max);
}

async function resetTimeSpent() {
    await setItem(TIME_SPENT_KEY, 0);
}

async function incrementTimeSpent(seconds) {
    let new_time = (await getTimeSpent()) + seconds;
    await setItem(TIME_SPENT_KEY, new_time);
}

function formatSeconds(time) {
    const bounded = Math.max(0, Math.floor(time));
    const hours = Math.floor(bounded / 3600);
    const minutes = Math.floor((bounded % 3600) / 60);
    const seconds = bounded % 60;
    return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

function log(message) {
    console.log(`[TY Time Limiter] ${message}`);
}

// Function to update the countdown timer and replace YouTube logo
async function updateCountdownTimer() {
    const secondsElapsed = await getTimeSpent();
    const max = await getDailyLimitSeconds();
    let time = max - Math.min(secondsElapsed, max);
    const logoElement = document.getElementById("logo");
    if (!logoElement) return;

    logoElement.innerHTML = `<a href="/"> ${formatSeconds(time)} </a>`;
    logoElement.style.fontWeight = "bold";
    logoElement.style.fontSize = "xxx-large";
}

async function dailyLimitReached() {
    return (await getTimeSpent()) >= (await getDailyLimitSeconds());
}

// For backward compatibility (old code may call swapDay/button funcs)
async function swapDay() {
    await ensureResetBoundary();
}
// No-op legacy button API retained to avoid runtime errors
async function getButtonPresses() {
    return 0;
}
async function incrementButtonPresses() {
    /* removed feature */
}
async function decrementButtonPresses() {
    /* removed feature */
}
