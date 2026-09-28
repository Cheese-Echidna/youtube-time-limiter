import { STORAGE_KEYS, TICK_INTERVAL_MS } from "./lib/constants";
import { formatSeconds } from "./lib/format";
import { videoIdFromUrl } from "./lib/saved-videos";
import { getValueFromStorage, setValueInStorage } from "./lib/storage";
import { AUDIO_ONLY_USAGE_MULTIPLIER, secondsToFinish, secondsUntilDepleted } from "./lib/watch-planning";

type UsageSnapshot = { remainingSeconds: number; limitReached: boolean };
type VideoDetails = { url: string; title: string; durationSeconds: number | null; positionSeconds: number };

const activities = [
    "go for a walk",
    "go for a bike ride",
    "code",
    "play video games",
    "watch TV",
    "play Go",
    "practice Mandarin",
    "do work",
];
const HOME_RECOMMENDATION_THRESHOLD_SECONDS = 5 * 60;
let audioOnlyMode = false;
let lastUsage: UsageSnapshot | null = null;
let currentVideoId: string | null = null;
let playerNotice: HTMLElement | null = null;
let finishText: HTMLElement | null = null;
let countdownText: HTMLElement | null = null;
let watchSaveButton: HTMLButtonElement | null = null;
let activePicker: HTMLElement | null = null;
let activePickerTrigger: HTMLButtonElement | null = null;
let tickRunning = false;
let lastAutoSavedPosition = -1;
let watchWarningUntil = Infinity;
const audioOnlyStyle = document.createElement("style");
audioOnlyStyle.id = "yttl-audio-only-style";
audioOnlyStyle.textContent = "video { visibility: hidden !important; }";

function getVideo(): HTMLVideoElement | null {
    const video = document.querySelector("video");
    return video instanceof HTMLVideoElement ? video : null;
}

function detailsForWatch(): VideoDetails | null {
    const video = getVideo();
    if (!videoIdFromUrl(location.href)) return null;
    const heading = document.querySelector("ytd-watch-metadata h1, #title h1");
    return {
        url: location.href,
        title: heading?.textContent?.trim() || document.title.replace(/ - YouTube$/, ""),
        durationSeconds: video && Number.isFinite(video.duration) ? video.duration : null,
        positionSeconds: video && Number.isFinite(video.currentTime) ? video.currentTime : 0,
    };
}

function parseDuration(label: string): number | null {
    const parts = label.trim().split(":").map(Number);
    if (parts.length < 2 || parts.length > 3 || parts.some((part) => !Number.isInteger(part))) return null;
    return parts.reduce((total, part) => total * 60 + part, 0);
}

function closePicker(restoreFocus = false): void {
    activePicker?.remove();
    activePickerTrigger?.setAttribute("aria-expanded", "false");
    if (restoreFocus) activePickerTrigger?.focus();
    activePicker = null;
    activePickerTrigger = null;
}

function picker(button: HTMLButtonElement, details: VideoDetails): void {
    if (activePickerTrigger === button) {
        closePicker(true);
        return;
    }
    closePicker();
    const panel = document.createElement("div");
    panel.className = "yttl-picker";
    panel.id = "yttl-rating-picker";
    panel.setAttribute("role", "group");
    panel.setAttribute("aria-label", "Rate this video before saving");
    const label = document.createElement("span");
    label.textContent = "How much do you want to watch it?";
    panel.append(label);
    const choices = document.createElement("div");
    choices.className = "yttl-picker__choices";
    for (let rating = 1; rating <= 10; rating += 1) {
        const choice = document.createElement("button");
        choice.type = "button";
        choice.textContent = String(rating);
        choice.title = `Save with rating ${rating} out of 10`;
        choice.setAttribute("aria-label", `${rating} out of 10`);
        choice.addEventListener("click", (event) => {
            event.stopPropagation();
            choice.disabled = true;
            // Read watch position at the moment of saving, not when the picker opened.
            const latest = videoIdFromUrl(location.href) === videoIdFromUrl(details.url) ? detailsForWatch() : null;
            void browser.runtime
                .sendMessage({
                    type: "yttl:save-video",
                    video: {
                        ...details,
                        positionSeconds: latest?.positionSeconds ?? details.positionSeconds,
                        durationSeconds: latest?.durationSeconds ?? details.durationSeconds,
                        rating,
                    },
                })
                .then(() => {
                    button.textContent = "Saved";
                    if (activePicker === panel) closePicker(true);
                })
                .catch(() => {
                    choice.disabled = false;
                    label.textContent = "Could not save. Try again.";
                });
        });
        choices.append(choice);
    }
    panel.append(choices);
    const close = document.createElement("button");
    close.type = "button";
    close.className = "yttl-picker__close";
    close.textContent = "Cancel";
    close.addEventListener("click", (event) => {
        event.stopPropagation();
        closePicker(true);
    });
    panel.append(close);
    panel.addEventListener("click", (event) => event.stopPropagation());
    document.body.append(panel);
    const bounds = button.getBoundingClientRect();
    const width = panel.getBoundingClientRect().width;
    const height = panel.getBoundingClientRect().height;
    panel.style.left = `${Math.max(8, Math.min(bounds.left, window.innerWidth - width - 8))}px`;
    panel.style.top = `${bounds.bottom + height + 8 <= window.innerHeight ? bounds.bottom + 6 : Math.max(8, bounds.top - height - 6)}px`;
    activePicker = panel;
    activePickerTrigger = button;
    button.setAttribute("aria-expanded", "true");
    button.setAttribute("aria-controls", panel.id);
    choices.querySelector("button")?.focus();
}

function decorateCards(): void {
    const cards = document.querySelectorAll(
        'ytd-rich-item-renderer, ytd-rich-grid-media, yt-lockup-view-model, ytd-browse[page-subtype="home"] ytd-video-renderer, ytd-browse[page-subtype="home"] ytd-grid-video-renderer, ytd-notification-renderer',
    );
    for (const card of Array.from(cards)) {
        // The rich item is the stable wrapper on both legacy and newer home layouts.
        // Fall back to the inner card only when there is no rich item wrapper.
        if (!card.matches("ytd-rich-item-renderer") && card.closest("ytd-rich-item-renderer")) continue;
        if (card.matches("yt-lockup-view-model") && card.closest("ytd-rich-grid-media")) continue;
        if (card.querySelector(":scope > .yttl-card-save")) continue;
        const link = Array.from(card.querySelectorAll<HTMLAnchorElement>('a[href*="/watch"]')).find((anchor) =>
            videoIdFromUrl(anchor.href),
        );
        if (!link) continue;
        const button = document.createElement("button");
        button.type = "button";
        button.className = "yttl-card-save";
        button.textContent = "Save + rate";
        button.setAttribute("aria-label", "Save and rate video");
        button.addEventListener("click", (event) => {
            event.preventDefault();
            event.stopPropagation();
            const currentLink = Array.from(card.querySelectorAll<HTMLAnchorElement>('a[href*="/watch"]')).find(
                (anchor) => videoIdFromUrl(anchor.href),
            );
            if (!currentLink) return;
            const title =
                card.querySelector("#video-title, .message, #title, h3")?.textContent?.trim() ||
                currentLink.title ||
                currentLink.getAttribute("aria-label") ||
                "YouTube video";
            const duration = card.querySelector("ytd-thumbnail-overlay-time-status-renderer")?.textContent || "";
            picker(button, {
                url: currentLink.href,
                title,
                durationSeconds: parseDuration(duration),
                positionSeconds: 0,
            });
        });
        card.append(button);
    }
}

function decorateWatchActions(): void {
    if (!videoIdFromUrl(location.href)) return;
    const actions = document.querySelector("ytd-watch-metadata #actions-inner, ytd-watch-metadata #actions");
    if (!actions || actions.querySelector(".yttl-watch-action")) return;
    const button = document.createElement("button");
    button.className = "yttl-card-save yttl-watch-action";
    button.type = "button";
    button.textContent = "Save + rate";
    button.addEventListener("click", (event) => {
        event.stopPropagation();
        const details = detailsForWatch();
        if (details) picker(button, details);
    });
    actions.append(button);
}

async function updateSavedWatchDetails(positionOnStop: boolean): Promise<void> {
    const details = detailsForWatch();
    if (!details || details.durationSeconds === null) return;
    if (positionOnStop && Math.abs(lastAutoSavedPosition - details.positionSeconds) < 1) return;
    await browser.runtime.sendMessage({
        type: "yttl:update-saved-playback",
        video: { ...details, positionOnStop },
    });
    if (positionOnStop) lastAutoSavedPosition = details.positionSeconds;
}

function renderHome(usage: UsageSnapshot): void {
    const home = document.querySelector('ytd-browse[page-subtype="home"]');
    const showBreak = usage.remainingSeconds <= HOME_RECOMMENDATION_THRESHOLD_SECONDS;
    document.documentElement.classList.toggle("yttl-home-rest", showBreak);
    if (!home) return;
    let banner = home.querySelector<HTMLElement>(".yttl-home-banner");
    if (!showBreak) {
        banner?.remove();
        return;
    }
    if (banner) {
        const heading = banner.querySelector("h2");
        if (heading)
            heading.textContent = usage.limitReached
                ? "You’re out of YouTube minutes for now"
                : "You’re nearly out of YouTube minutes";
        return;
    }
    banner = document.createElement("section");
    banner.className = "yttl-home-banner";
    const heading = document.createElement("h2");
    heading.textContent = usage.limitReached
        ? "You’re out of YouTube minutes for now"
        : "You’re nearly out of YouTube minutes";
    const description = document.createElement("p");
    description.textContent = "Your time is refilling. Consider another way to spend this moment:";
    const options = document.createElement("p");
    options.textContent = `${activities.slice(0, -1).join(", ")}, or ${activities.at(-1)}.`;
    const hint = document.createElement("p");
    hint.textContent = "Your saved videos are in the extension popup.";
    banner.append(heading, description, options, hint);
    (home.querySelector("#primary") ?? home).prepend(banner);
}

function ensurePlayerNotice(): void {
    const player = document.querySelector("#movie_player");
    if (!player || !videoIdFromUrl(location.href)) {
        playerNotice?.remove();
        playerNotice = null;
        return;
    }
    if (playerNotice?.parentElement === player) return;
    playerNotice?.remove();
    const notice = document.createElement("div");
    notice.className = "yttl-player-notice";
    const finish = document.createElement("div");
    finish.className = "yttl-finish";
    finish.setAttribute("role", "status");
    const countdown = document.createElement("div");
    countdown.className = "yttl-countdown";
    const saveButton = document.createElement("button");
    saveButton.className = "yttl-watch-save";
    saveButton.type = "button";
    saveButton.textContent = "Save + rate";
    saveButton.addEventListener("click", (event) => {
        event.stopPropagation();
        const details = detailsForWatch();
        if (details) picker(saveButton, details);
    });
    notice.append(finish, countdown, saveButton);
    player.append(notice);
    playerNotice = notice;
    finishText = finish;
    countdownText = countdown;
    watchSaveButton = saveButton;
}

function renderWatch(usage: UsageSnapshot): void {
    const id = videoIdFromUrl(location.href);
    if (id !== currentVideoId) {
        currentVideoId = id;
        lastAutoSavedPosition = -1;
        watchWarningUntil = getVideo()?.paused === false ? Date.now() + 9000 : Infinity;
        closePicker();
        if (watchSaveButton) watchSaveButton.textContent = "Save + rate";
    }
    ensurePlayerNotice();
    if (!playerNotice || !finishText || !countdownText || !watchSaveButton) return;
    const video = getVideo();
    const seconds = secondsUntilDepleted(usage.remainingSeconds, audioOnlyMode);
    if (video && Number.isFinite(video.duration) && video.duration > 0) {
        const remaining = Math.max(0, video.duration - video.currentTime);
        const required = secondsToFinish(remaining, video.playbackRate);
        if (required > seconds && remaining > 0) {
            const videoMinutesRemaining = Math.ceil(Math.max(0, remaining - seconds * video.playbackRate) / 60);
            const message = usage.limitReached
                ? `Time is up. This video is paused at ${formatSeconds(video.currentTime)}. Your minutes are refilling.`
                : video.paused || Date.now() < watchWarningUntil
                  ? `This video won’t fit at ${video.playbackRate}×. About ${videoMinutesRemaining} min of the video will remain when time runs out.`
                  : `Won’t fit at ${video.playbackRate}×`;
            if (finishText.textContent !== message) finishText.textContent = message;
            finishText.hidden = false;
            watchSaveButton.hidden = false;
        } else {
            finishText.hidden = true;
            watchSaveButton.hidden = true;
        }
    } else {
        finishText.hidden = true;
        watchSaveButton.hidden = true;
    }
    if (!usage.limitReached && seconds <= 600 && video && !video.paused && !video.ended) {
        countdownText.hidden = false;
        countdownText.classList.toggle("yttl-countdown--soon", seconds <= 300);
        countdownText.textContent =
            seconds > 120
                ? `About ${Math.ceil(seconds / 60)} min left`
                : `${Math.floor(Math.ceil(seconds) / 60)}:${String(Math.ceil(seconds) % 60).padStart(2, "0")} left`;
    } else countdownText.hidden = true;
    playerNotice.hidden = finishText.hidden && countdownText.hidden;
}

async function tick(): Promise<void> {
    if (tickRunning) return;
    tickRunning = true;
    try {
        const video = getVideo();
        let usage = (await browser.runtime.sendMessage({ type: "yttl:get-usage" })) as UsageSnapshot;
        if (video && !video.paused && !video.ended) {
            if (usage.limitReached) {
                video.pause();
                void updateSavedWatchDetails(true).catch(console.error);
            } else {
                usage = (await browser.runtime.sendMessage({
                    type: "yttl:consume-playback",
                    seconds: (TICK_INTERVAL_MS / 1000) * (audioOnlyMode ? AUDIO_ONLY_USAGE_MULTIPLIER : 1),
                })) as UsageSnapshot;
                if (usage.limitReached) {
                    video.pause();
                    void updateSavedWatchDetails(true).catch(console.error);
                }
            }
        }
        lastUsage = usage;
        renderHome(usage);
        renderWatch(usage);
        const logo = document.getElementById("logo");
        if (logo) {
            let link = logo.querySelector("a.yttl-logo-link");
            if (!link) {
                logo.replaceChildren();
                link = document.createElement("a");
                link.className = "yttl-logo-link";
                link.setAttribute("href", "/");
                logo.append(link);
            }
            link.textContent = formatSeconds(usage.remainingSeconds);
            logo.style.fontWeight = "700";
            logo.style.fontSize = "5rem";
        }
        decorateCards();
        decorateWatchActions();
    } catch (error) {
        console.error("Failed to update YouTube time limiter.", error);
    } finally {
        tickRunning = false;
    }
}

function refreshOnNavigation(): void {
    currentVideoId = null;
    playerNotice?.remove();
    playerNotice = null;
    closePicker();
    if (lastUsage) {
        renderHome(lastUsage);
        renderWatch(lastUsage);
    }
    void tick();
}

document.addEventListener("yt-navigate-finish", refreshOnNavigation);
window.addEventListener("popstate", refreshOnNavigation);
document.addEventListener(
    "pointerdown",
    (event) => {
        const target = event.target;
        if (
            target instanceof Node &&
            activePicker &&
            !activePicker.contains(target) &&
            !activePickerTrigger?.contains(target)
        ) {
            closePicker();
        }
    },
    true,
);
document.addEventListener(
    "keydown",
    (event) => {
        if (event.key === "Escape" && activePicker) {
            event.stopPropagation();
            closePicker(true);
        }
    },
    true,
);
window.addEventListener("scroll", () => closePicker(), true);
document.addEventListener(
    "ratechange",
    (event) => {
        if (event.target instanceof HTMLVideoElement) {
            void setValueInStorage(STORAGE_KEYS.playbackRate, event.target.playbackRate);
            watchWarningUntil = Date.now() + 9000;
            if (lastUsage) renderWatch(lastUsage);
        }
    },
    true,
);
document.addEventListener(
    "loadedmetadata",
    (event) => {
        if (event.target instanceof HTMLVideoElement) {
            watchWarningUntil = Date.now() + 9000;
            void setValueInStorage(STORAGE_KEYS.playbackRate, event.target.playbackRate);
            void updateSavedWatchDetails(false).catch(console.error);
            if (lastUsage) renderWatch(lastUsage);
        }
    },
    true,
);
document.addEventListener(
    "play",
    (event) => {
        if (event.target instanceof HTMLVideoElement) {
            watchWarningUntil = Date.now() + 9000;
            if (lastUsage) renderWatch(lastUsage);
            // Enforce immediately without charging a full second for a play event.
            void browser.runtime.sendMessage({ type: "yttl:get-usage" }).then((usage) => {
                if ((usage as UsageSnapshot).limitReached) (event.target as HTMLVideoElement).pause();
            });
        }
    },
    true,
);
document.addEventListener(
    "ended",
    (event) => {
        if (!(event.target instanceof HTMLVideoElement)) return;
        const player = document.querySelector("#movie_player");
        const id = videoIdFromUrl(location.href);
        if (!id || !player || player.classList.contains("ad-showing") || !player.contains(event.target)) return;
        void browser.runtime.sendMessage({ type: "yttl:remove-video", id }).catch(console.error);
    },
    true,
);

browser.storage.onChanged.addListener((changes, area) => {
    const change = changes[STORAGE_KEYS.audioOnlyMode];
    if (area === "local" && change) {
        audioOnlyMode = change.newValue === true;
        if (audioOnlyMode) document.documentElement.append(audioOnlyStyle);
        else audioOnlyStyle.remove();
        if (lastUsage) renderWatch(lastUsage);
    }
});

void (async () => {
    audioOnlyMode = await getValueFromStorage(STORAGE_KEYS.audioOnlyMode, false);
    if (audioOnlyMode) document.documentElement.append(audioOnlyStyle);
    await tick();
    setInterval(() => {
        void tick();
    }, TICK_INTERVAL_MS);
})();
