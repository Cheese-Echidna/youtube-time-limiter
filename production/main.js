// Set interval to count time spent every second
const timeoutTime = 1000;
setInterval(countTimeSpentMinutes, timeoutTime);

// URL to redirect the user to when they exceed their daily limit
const redirectUrl = "about:blank";

// Check if a video is playing on the page
function isPlaying() {
    const videoElement = document.querySelector('video');
    return videoElement && !videoElement.paused && !videoElement.ended;
}

async function countTimeSpentMinutes() {
    let timeSpentSeconds = getLocalStorageItem("ytb_time_spent", 0);
    updateCountdownTimer(timeSpentSeconds);
    if (!isPlaying()) {
        log(`Video is NOT playing
Total time: ${formatSeconds(timeSpentSeconds)}`);
        return;
    }

    const today = new Date();
    const currentDay = today.getDate();

    let lastSessionDay = getLocalStorageItem("ytb_last_session_day", -1);

    if (currentDay !== lastSessionDay) {
        // If it's a new day, reset time spent
        setLocalStorageItem("ytb_time_spent", 0);
    }


    // Update the last session day
    setLocalStorageItem("ytb_last_session_day", currentDay);

    timeSpentSeconds += timeoutTime / 1000;

    setLocalStorageItem("ytb_time_spent", timeSpentSeconds);

    log(`Video is playing
Total time: ${formatSeconds(timeSpentSeconds)}`);

    // Check if the daily limit of 1 hour is reached
    if (timeSpentSeconds >= 3600) {
        alert("Daily YouTube time limit of 1 hour reached!");
        window.location.href = redirectUrl;
    }
}

// Helper function to get item from localStorage with default value
function getLocalStorageItem(key, defaultValue) {
    try {
        const value = localStorage.getItem(key);
        return value !== null ? Number(value) : defaultValue;
    } catch (error) {
        console.error(`Error getting ${key} from localStorage:`, error);
        return defaultValue;
    }
}

// Helper function to set item in localStorage
function setLocalStorageItem(key, value) {
    try {
        localStorage.setItem(key, value);
    } catch (error) {
        console.error(`Error setting ${key} in localStorage:`, error);
    }
}

function log(message) {
    console.log(`[YT-Limiter]\n${message}`);
}

function formatSeconds(time) {
    let seconds = time % 60;
    let minutes = Math.floor(time / 60);
    return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

// Function to update the countdown timer and replace YouTube logo
function updateCountdownTimer(secondsElapsed) {
    let time = 60*60 - secondsElapsed;
    const logoElement = document.querySelector('#logo-icon');
    if (!logoElement) return;

    logoElement.textContent = formatSeconds(time)

}
