/// <reference types="webextension-polyfill" />

// Helper function to get numeric item from storage with a default value
async function getItem(key, defaultValue) {
  try {
    const value = (await browser.storage.local.get({ [key]: defaultValue }))[key];
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
    const value = (await browser.storage.local.get({ [key]: defaultValue }))[key];
    return value === undefined ? defaultValue : value;
  } catch (e) {
    console.error(`Error getting raw ${key}:`, e);
    return defaultValue;
  }
}

// Helper function to set an item in storage
async function setItem(key, value) {
  try {
    await browser.storage.local.set({ [key]: value });
  } catch (error) {
    console.error(`Unexpected error setting ${key} in storage:`, error);
    return Promise.reject(error);
  }
}

// Settings helpers
async function getDailyLimitMinutes() {
  return await getItem(DAILY_LIMIT_MIN_KEY, 60);
}
async function setDailyLimitMinutes(m) {
  await setItem(DAILY_LIMIT_MIN_KEY, Math.max(1, Math.floor(m)));
}
async function getDailyLimitSeconds() {
  return (await getDailyLimitMinutes()) * 60;
}

async function getResetTimeString() {
  // Format HH:MM (24h)
  const s = await getRawItem(RESET_TIME_KEY, '00:00');
  return typeof s === 'string' && /^\d{2}:\d{2}$/.test(s) ? s : '00:00';
}
async function setResetTimeString(v) {
  await setItem(RESET_TIME_KEY, v);
}

function parseResetOffsetMinutes(str) {
  const [hh, mm] = str.split(':').map(Number);
  return hh * 60 + mm;
}

function getShiftedDateKey(date, resetMinutes) {
  // Shift date backwards by resetMinutes to align day boundary
  const d = new Date(date.getTime() - resetMinutes * 60 * 1000);
  return d.toISOString().slice(0, 10); // YYYY-MM-DD
}

async function getHistory() {
  return await getRawItem(HISTORY_KEY, {});
}
async function setHistory(h) {
  await setItem(HISTORY_KEY, h);
}
async function addToHistory(seconds) {
  const resetMinutes = parseResetOffsetMinutes(await getResetTimeString());
  const key = getShiftedDateKey(new Date(), resetMinutes);
  const history = await getHistory();
  history[key] = (history[key] || 0) + seconds;
  await setHistory(history);
}

async function buildHistoryCsv() {
  const history = await getHistory();
  const rows = ['date,seconds,minutes'];
  const keys = Object.keys(history).sort();
  for (const k of keys) {
    const sec = Math.round(history[k] || 0);
    const min = (sec / 60).toFixed(2);
    rows.push(`${k},${sec},${min}`);
  }
  return rows.join('\n');
}

async function getTimeSpent() {
  return await getItem(TIME_SPENT_KEY, 0);
}

async function ensureResetBoundary() {
  // Reset if we crossed the configured daily boundary
  const resetStr = await getResetTimeString();
  const resetMinutes = parseResetOffsetMinutes(resetStr);
  const now = new Date();
  const lastKey = await getRawItem(LAST_RESET_DAY_KEY, null);
  const currentKey = getShiftedDateKey(now, resetMinutes);
  if (lastKey !== currentKey) {
    await setItem(LAST_RESET_DAY_KEY, currentKey);
    await resetTimeSpent();
    // ensure we start counting the new day fresh
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
  let seconds = bounded % 60;
  let minutes = Math.floor(bounded / 60);
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

function log(message) {
  console.log(`[TY Time Limiter] ${message}`);
}

// Function to update the countdown timer and replace YouTube logo
async function updateCountdownTimer() {
  const secondsElapsed = await getTimeSpent();
  const max = await getDailyLimitSeconds();
  let time = max - Math.min(secondsElapsed, max);
  const logoElement = document.getElementById('logo');
  if (!logoElement) return;

  logoElement.innerHTML = `<a href="/"> ${formatSeconds(time)} </a>`;
  logoElement.style.fontWeight = 'bold';
  logoElement.style.fontSize = 'xxx-large';
}

async function dailyLimitReached() {
  return (await getTimeSpent()) >= (await getDailyLimitSeconds());
}

// Keys and constants
const TIME_SPENT_KEY = 'yttl_time_spent';
const LAST_RESET_DAY_KEY = 'yttl_last_reset_day'; // stores date key aligned to reset time
const HISTORY_KEY = 'yttl_history';
const DAILY_LIMIT_MIN_KEY = 'yttl_daily_limit_min';
const RESET_TIME_KEY = 'yttl_reset_time'; // "HH:MM"
const DEBUG = false;

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
