// Set interval to count time spent every second
const timeoutTime = 1000;

setInterval(main, timeoutTime);

// Also check for video play attempts and pause if before midday
document.addEventListener("play", async (e) => {
    if (e.target.tagName === "VIDEO") {
        if (await isMiddayRestrictionEnabled() && isBeforeMidday()) {
            log("Midday restriction: preventing video from playing");
            e.target.pause();
            alert("Videos are disabled before midday (12:00 PM). Please come back later!");
        }
    }
}, true);

// Check if a video is playing on the page
function isPlaying() {
    const videoElement = document.querySelector("video");
    return videoElement && !videoElement.paused && !videoElement.ended;
}

function stopPlaying() {
    log("Stopping video playback");
    const videoElement = document.querySelector("video");
    if (videoElement) videoElement.pause();
}

async function countTime() {
    await ensureResetBoundary();
    
    // Check midday restriction
    if (await isMiddayRestrictionEnabled() && isBeforeMidday()) {
        if (isPlaying()) {
            log("Midday restriction: video playback disabled before 12:00 PM");
            stopPlaying();
            alert("Videos are disabled before midday (12:00 PM). Please come back later!");
        }
        return;
    }
    
    if (!isPlaying()) {
        return;
    }

    await incrementTimeSpent(timeoutTime / 1000);
    await addToHistory(timeoutTime / 1000);

    if (await dailyLimitReached()) {
        log("Weekly YouTube time limit reached!");
        stopPlaying();
        alert("Weekly YouTube time limit reached!");
    } else {
        const timeSpentSeconds = await getTimeSpent();
        log(`Video is playing - Total time: ${formatSeconds(timeSpentSeconds)}`);
    }
}

async function main() {
    await countTime();
    await updateCountdownTimer();
}
