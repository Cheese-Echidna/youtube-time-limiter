import { TICK_INTERVAL_MS } from "./lib/constants";
import { formatSeconds } from "./lib/format";
import { log } from "./lib/logger";

const DAILY_LIMIT_ALERT_MESSAGE = "Your available YouTube time has been used. It refills continuously.";
const TICK_SECONDS = TICK_INTERVAL_MS / 1000;

type UsageSnapshot = {
    remainingSeconds: number;
    limitReached: boolean;
};

let hasShownDailyLimitAlert = false;

function getVideoElement(): HTMLVideoElement | null {
    const videoElement = document.querySelector("video");
    return videoElement instanceof HTMLVideoElement ? videoElement : null;
}

function isVideoPlaying(videoElement: HTMLVideoElement | null): videoElement is HTMLVideoElement {
    return Boolean(videoElement && !videoElement.paused && !videoElement.ended);
}

function showDailyLimitAlertOnce(): void {
    if (hasShownDailyLimitAlert) {
        return;
    }

    hasShownDailyLimitAlert = true;
    alert(DAILY_LIMIT_ALERT_MESSAGE);
}

async function getUsage(): Promise<UsageSnapshot> {
    return browser.runtime.sendMessage({ type: "yttl:get-usage" }) as Promise<UsageSnapshot>;
}

async function updateCountdownTimer(): Promise<void> {
    const logoElement = document.getElementById("logo");
    if (!logoElement) {
        return;
    }

    const { remainingSeconds } = await getUsage();
    logoElement.innerHTML = `<a href="/">${formatSeconds(remainingSeconds)}</a>`;
    logoElement.style.fontWeight = "700";
    logoElement.style.fontSize = "5rem";
}

async function enforcePlaybackRestrictions(videoElement: HTMLVideoElement): Promise<boolean> {
    if ((await getUsage()).limitReached) {
        videoElement.pause();
        log("Daily limit already reached; preventing playback.");
        showDailyLimitAlertOnce();
        return true;
    }

    hasShownDailyLimitAlert = false;
    return false;
}

async function handleVideoPlay(event: Event): Promise<void> {
    const target = event.target;
    if (!(target instanceof HTMLVideoElement)) {
        return;
    }

    await enforcePlaybackRestrictions(target);
}

async function tick(): Promise<void> {
    const videoElement = getVideoElement();
    if (!isVideoPlaying(videoElement)) {
        await updateCountdownTimer();
        return;
    }

    if (await enforcePlaybackRestrictions(videoElement)) {
        await updateCountdownTimer();
        return;
    }

    const usage = (await browser.runtime.sendMessage({
        type: "yttl:consume-playback",
        seconds: TICK_SECONDS,
    })) as UsageSnapshot;

    if (usage.limitReached) {
        videoElement.pause();
        log("Daily YouTube time limit reached.");
        showDailyLimitAlertOnce();
    } else {
        hasShownDailyLimitAlert = false;
        log(`Video is playing - available time: ${formatSeconds(usage.remainingSeconds)}`);
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
