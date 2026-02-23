import { TICK_INTERVAL_MS, WEEKLY_LIMIT_SECONDS } from "./lib/constants";
import { formatSeconds } from "./lib/format";
import { log } from "./lib/logger";
import {
    addToHistory,
    ensureWeeklyBoundary,
    getTimeRemainingSeconds,
    getTimeSpentSeconds,
    hasReachedWeeklyLimit,
    incrementTimeSpent,
    isBeforeMidday,
    isMiddayRestrictionEnabled,
} from "./lib/time-limiter";

const MIDDAY_ALERT_MESSAGE = "Videos are disabled before midday (12:00 PM). Please come back later!";
const WEEKLY_LIMIT_ALERT_MESSAGE = "Weekly YouTube time limit reached!";
const TICK_SECONDS = TICK_INTERVAL_MS / 1000;

let hasShownMiddayAlert = false;
let hasShownWeeklyLimitAlert = false;

function getVideoElement(): HTMLVideoElement | null {
    const videoElement = document.querySelector("video");
    return videoElement instanceof HTMLVideoElement ? videoElement : null;
}

function isVideoPlaying(videoElement: HTMLVideoElement | null): videoElement is HTMLVideoElement {
    return Boolean(videoElement && !videoElement.paused && !videoElement.ended);
}

function showMiddayAlertOnce(): void {
    if (hasShownMiddayAlert) {
        return;
    }

    hasShownMiddayAlert = true;
    alert(MIDDAY_ALERT_MESSAGE);
}

function showWeeklyLimitAlertOnce(): void {
    if (hasShownWeeklyLimitAlert) {
        return;
    }

    hasShownWeeklyLimitAlert = true;
    alert(WEEKLY_LIMIT_ALERT_MESSAGE);
}

async function updateCountdownTimer(): Promise<void> {
    const logoElement = document.getElementById("logo");
    if (!logoElement) {
        return;
    }

    const remainingSeconds = await getTimeRemainingSeconds();
    logoElement.innerHTML = `<a href="/">${formatSeconds(remainingSeconds)}</a>`;
    logoElement.style.fontWeight = "700";
    logoElement.style.fontSize = "5rem";
}

async function enforcePlaybackRestrictions(videoElement: HTMLVideoElement): Promise<boolean> {
    if ((await isMiddayRestrictionEnabled()) && isBeforeMidday()) {
        videoElement.pause();
        log("Midday restriction active; pausing video playback.");
        showMiddayAlertOnce();
        return true;
    }

    hasShownMiddayAlert = false;

    if (await hasReachedWeeklyLimit()) {
        videoElement.pause();
        log("Weekly limit already reached; preventing playback.");
        showWeeklyLimitAlertOnce();
        return true;
    }

    hasShownWeeklyLimitAlert = false;
    return false;
}

async function handleVideoPlay(event: Event): Promise<void> {
    const target = event.target;
    if (!(target instanceof HTMLVideoElement)) {
        return;
    }

    await ensureWeeklyBoundary();
    await enforcePlaybackRestrictions(target);
}

async function tick(): Promise<void> {
    await ensureWeeklyBoundary();

    const videoElement = getVideoElement();
    if (!isVideoPlaying(videoElement)) {
        await updateCountdownTimer();
        return;
    }

    if (await enforcePlaybackRestrictions(videoElement)) {
        await updateCountdownTimer();
        return;
    }

    const spentSeconds = await incrementTimeSpent(TICK_SECONDS);
    await addToHistory(TICK_SECONDS);

    if (spentSeconds >= WEEKLY_LIMIT_SECONDS) {
        videoElement.pause();
        log("Weekly YouTube time limit reached.");
        showWeeklyLimitAlertOnce();
    } else {
        hasShownWeeklyLimitAlert = false;
        const totalSeconds = await getTimeSpentSeconds();
        log(`Video is playing - total time: ${formatSeconds(totalSeconds)}`);
    }

    await updateCountdownTimer();
}

async function runTickSafely(): Promise<void> {
    try {
        await tick();
    } catch (error) {
        console.error("Failed to update content script timer.", error);
    }
}

document.addEventListener(
    "play",
    (event) => {
        void handleVideoPlay(event);
    },
    true,
);

void runTickSafely();
setInterval(() => {
    void runTickSafely();
}, TICK_INTERVAL_MS);
