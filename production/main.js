// Set interval to count time spent every second
setInterval(countTimeSpentMinutes, 1000);

// Check if a video is playing on the page
function isPlaying() {
    const videoElement = document.querySelector('video');
    return !videoElement.paused && !videoElement.ended;
}

async function countTimeSpentMinutes() {
    if (!isPlaying()) {
        log("Video is not playing")
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

    // Get current time spent and update it
    let timeSpentSeconds = getLocalStorageItem("ytb_time_spent", 0);
    timeSpentSeconds += 10; // Add 10 seconds
    setLocalStorageItem("ytb_time_spent", timeSpentSeconds);

    log(`Time spent today: ${timeSpentSeconds} seconds`);

    // Log every full minute
    if (timeSpentSeconds % 60 === 0) {
        console.log(`Full minute reached: ${timeSpentSeconds / 60} minutes spent today`);
    }

    // Check if the daily limit of 1 hour is reached
    if (timeSpentSeconds >= 3600) {
        alert("Daily YouTube time limit of 1 hour reached!");
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
    console.warn(`[YT-Limiter]\n${message}`)
}