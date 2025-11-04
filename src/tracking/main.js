// Set interval to count time spent every second
const timeoutTime = 1000;

setInterval(main, timeoutTime);

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
