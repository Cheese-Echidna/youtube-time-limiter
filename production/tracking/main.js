// Set interval to count time spent every second
const timeoutTime = 1000;

setInterval(main, timeoutTime);

// Check if a video is playing on the page
function isPlaying() {
    const videoElement = document.querySelector('video');
    return videoElement && !videoElement.paused && !videoElement.ended;
}

function stopPlaying() {
    log("Stopping video playback");
    const videoElement = document.querySelector('video');
    videoElement.pause();
}

async function countTime() {
    if (!isPlaying()) {
        return;
    } else {
        await swapDay();
    }

    let timeSpentSeconds = await getTimeSpent();

    await incrementTimeSpent(timeoutTime / 1000);

    if (await dailyLimitReached()) {
        log("Daily YouTube time limit of 1 hour reached!");
        stopPlaying();
        alert("Daily YouTube time limit of 1 hour reached!");
    } else {
        log(`Video is playing - Total time: ${formatSeconds(timeSpentSeconds)}`);
    }
}

async function main() {
    await countTime();
    await updateCountdownTimer();
}