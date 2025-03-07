/// <reference types="webextension-polyfill" />

// Helper function to get item from storage with a default value
async function getItem(key, defaultValue) {
    try {
        // Using computed property names to set the default value
        const value = (await browser.storage.local.get({[key]: defaultValue}))[key]
        if (!value) {
            return defaultValue;
        }
        // log(`${key} -> ${value}`);
        return Number(value);
    } catch (error) {
        console.error(`Error getting ${key} from storage:`, error);
        // Return a resolved promise with the default value if an error occurs
        return defaultValue;
    }
}

// Helper function to set an item in storage
async function setItem(key, value) {
    try {
        await browser.storage.local.set({[key]: value});
        // log(`${key} <- ${value}`);
    } catch (error) {
        console.error(`Unexpected error setting ${key} in storage:`, error);
        return Promise.reject(error);
    }
}

let timeSpent;

async function getTimeSpent() {
    if (timeSpent === undefined) {
        timeSpent = await getItem(TIME_SPENT_KEY, 0);
    }
    return timeSpent;
}

async function swapDay() {
    const currentDay = new Date().getDate();
    let lastSessionDay = await getItem(LAST_SESSION_DAY_KEY, -1);

    if (currentDay !== lastSessionDay) {
        log(`New day: ${currentDay}; Old day: ${lastSessionDay}`);

        let presses = 60 * await getButtonPresses();
        // If it's a new day, reset time spent

        await resetTimeSpent();
        await incrementTimeSpent(presses);

        log(`Reset time spent to ${presses} seconds`);
        // Update the last session day
        await setItem(LAST_SESSION_DAY_KEY, currentDay);
    }
}

async function getTimeRemaining() {
    return MAX_SECONDS - await getTimeSpent();
}

async function resetTimeSpent() {
    timeSpent = 0;
    await setItem(TIME_SPENT_KEY, 0);
}

async function incrementTimeSpent(seconds) {
    let new_time = await getTimeSpent() + seconds
    timeSpent = new_time;
    await setItem(TIME_SPENT_KEY, new_time);
}

async function getButtonPresses() {
    return await getItem(BUTTON, 0);
}

async function incrementButtonPresses() {
    await setItem(BUTTON, await getButtonPresses() + 1);
}

async function decrementButtonPresses() {
    await setItem(BUTTON, await getButtonPresses() - 1);
}

function formatSeconds(time) {
    let seconds = time % 60;
    let minutes = Math.floor(time / 60);
    return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

function log(message) {
    console.log(`[TY Time Limiter] ${message}`);
}

// Function to update the countdown timer and replace YouTube logo
async function updateCountdownTimer() {
    const secondsElapsed = await getTimeSpent();
    let time = MAX_SECONDS - Math.min(secondsElapsed, MAX_SECONDS);
    const logoElement = document.getElementById("logo");
    if (!logoElement) return;

    logoElement.innerHTML = `<a href="/"> ${formatSeconds(time)} </a>`
    logoElement.style.fontWeight = "bold";
    logoElement.style.fontSize = "xxx-large";
    // logoElement.style.color = "red";
}

async function dailyLimitReached() {
    return await getTimeSpent() >= MAX_SECONDS;
}

const TIME_SPENT_KEY = "yttl_time_spent";
const LAST_SESSION_DAY_KEY = "yttl_last_session_day";
const BUTTON = "yttl_extra_button";
const MAX_SECONDS = 60*60;
const DEBUG = false;
timeSpent = undefined;