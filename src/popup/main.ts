import { HISTORY_DAYS_VISIBLE, STORAGE_KEYS, TICK_INTERVAL_MS } from "../lib/constants";
import { lastNDates } from "../lib/date";
import { formatSeconds } from "../lib/format";
import { getValueFromStorage, setValueInStorage } from "../lib/storage";
import { SavedVideo, savedVideoUrl } from "../lib/saved-videos";
import { canFinish } from "../lib/watch-planning";

type UsageSnapshot = {
    remainingSeconds: number;
    limitReached: boolean;
};

type UsageHistory = Record<string, number>;

type PopupElements = {
    output: HTMLElement;
    statusText: HTMLElement;
    audioOnlyCheckbox: HTMLInputElement;
    exportCsvButton: HTMLButtonElement;
    historyCanvas: HTMLCanvasElement;
    savedList: HTMLUListElement;
    savedEmpty: HTMLElement;
    savedCount: HTMLElement;
    fitsToggle: HTMLButtonElement;
    planningSpeed: HTMLInputElement;
};

let popupElements: PopupElements | null = null;
let updateInProgress = false;
let savedVideos: SavedVideo[] = [];
let fitsOnly = false;
let lastListKey = "";
let remainingSeconds = 0;

function getRequiredElement<T extends HTMLElement>(id: string): T {
    const element = document.getElementById(id);
    if (!element) {
        throw new Error(`Missing required popup element: #${id}`);
    }

    return element as T;
}

function getPopupElements(): PopupElements {
    return {
        output: getRequiredElement<HTMLElement>("output"),
        statusText: getRequiredElement<HTMLElement>("status-text"),
        audioOnlyCheckbox: getRequiredElement<HTMLInputElement>("audio-only"),
        exportCsvButton: getRequiredElement<HTMLButtonElement>("export-csv"),
        historyCanvas: getRequiredElement<HTMLCanvasElement>("history-chart"),
        savedList: getRequiredElement<HTMLUListElement>("saved-list"),
        savedEmpty: getRequiredElement<HTMLElement>("saved-empty"),
        savedCount: getRequiredElement<HTMLElement>("saved-count"),
        fitsToggle: getRequiredElement<HTMLButtonElement>("fits-toggle"),
        planningSpeed: getRequiredElement<HTMLInputElement>("planning-speed"),
    };
}

async function getUsage(): Promise<UsageSnapshot> {
    return browser.runtime.sendMessage({ type: "yttl:get-usage" }) as Promise<UsageSnapshot>;
}

async function getHistory(): Promise<UsageHistory> {
    return browser.runtime.sendMessage({ type: "yttl:get-history" }) as Promise<UsageHistory>;
}

async function exportHistoryCsv(): Promise<void> {
    const history = await getHistory();
    const rows = ["date,seconds,minutes"];
    for (const dateKey of Object.keys(history).sort()) {
        const seconds = Math.round(history[dateKey] ?? 0);
        rows.push(`${dateKey},${seconds},${(seconds / 60).toFixed(2)}`);
    }

    const csv = rows.join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");

    link.href = url;
    link.download = "yt-time-limiter-history.csv";
    document.body.append(link);
    link.click();
    link.remove();

    URL.revokeObjectURL(url);
}

async function drawHistoryChart(elements: PopupElements): Promise<void> {
    const context = elements.historyCanvas.getContext("2d");
    if (!context) {
        return;
    }

    const documentStyles = getComputedStyle(document.body);
    const axisColor = documentStyles.getPropertyValue("--chart-axis").trim() || "#95a6bb";
    const barColor = documentStyles.getPropertyValue("--chart-bar").trim() || "#0f766e";

    const history = await getHistory();
    const dateKeys = lastNDates(HISTORY_DAYS_VISIBLE);
    const values = dateKeys.map((dateKey) => history[dateKey] ?? 0);
    const maxValue = Math.max(...values, 1);

    const canvasWidth = elements.historyCanvas.width;
    const canvasHeight = elements.historyCanvas.height;
    const padding = 10;
    const chartHeight = canvasHeight - padding * 2;
    const barWidth = (canvasWidth - padding * 2) / dateKeys.length;

    context.clearRect(0, 0, canvasWidth, canvasHeight);

    context.strokeStyle = axisColor;
    context.beginPath();
    context.moveTo(padding, canvasHeight - padding);
    context.lineTo(canvasWidth - padding, canvasHeight - padding);
    context.stroke();

    context.fillStyle = barColor;
    for (let index = 0; index < values.length; index += 1) {
        const value = values[index] ?? 0;
        const height = Math.round((value / maxValue) * chartHeight);
        const x = padding + index * barWidth + 2;
        const y = canvasHeight - padding - height;

        context.fillRect(x, y, Math.max(1, barWidth - 4), height);
    }
}

async function updateRemainingTime(elements: PopupElements): Promise<void> {
    const usage = await getUsage();
    const { limitReached } = usage;
    remainingSeconds = usage.remainingSeconds;

    elements.output.textContent = limitReached ? "00:00:00" : formatSeconds(remainingSeconds);
    elements.statusText.textContent = limitReached ? "Time depleted — refilling continuously" : "Available time";

    document.body.classList.toggle("is-depleted", limitReached);
    renderSavedVideos(elements);
}

function visibleVideos(elements: PopupElements): SavedVideo[] {
    const speed = Number(elements.planningSpeed.value);
    const validSpeed = Number.isFinite(speed) && speed >= 0.25 && speed <= 16;
    const audioOnly = elements.audioOnlyCheckbox.checked;
    return savedVideos
        .filter(
            (video) =>
                !fitsOnly ||
                (validSpeed &&
                    video.durationSeconds !== null &&
                    canFinish(
                        Math.max(0, video.durationSeconds - video.positionSeconds),
                        speed,
                        remainingSeconds,
                        audioOnly,
                    )),
        )
        .sort((first, second) => second.rating - first.rating || second.savedAt - first.savedAt);
}

function renderSavedVideos(elements: PopupElements, force = false): void {
    const videos = visibleVideos(elements);
    const key = `${fitsOnly}:${elements.planningSpeed.value}:${elements.audioOnlyCheckbox.checked}:${savedVideos.length}:${videos.map((video) => `${video.id}:${video.rating}:${video.positionSeconds}`).join(",")}`;
    if (!force && key === lastListKey) return;
    lastListKey = key;
    elements.savedCount.textContent = `${savedVideos.length} saved`;
    elements.fitsToggle.setAttribute("aria-pressed", String(fitsOnly));
    elements.fitsToggle.textContent = fitsOnly ? "Show all videos" : "Show videos that fit";
    elements.savedEmpty.hidden = videos.length > 0;
    elements.savedEmpty.textContent =
        savedVideos.length === 0
            ? "Save and rate videos on YouTube to find them here."
            : "No saved videos with a known duration fit right now. You can still see them all.";
    elements.savedList.replaceChildren();

    for (const video of videos) {
        const item = document.createElement("li");
        item.className = "saved-item";
        const thumbnailLink = document.createElement("a");
        thumbnailLink.className = "saved-item__thumbnail";
        thumbnailLink.href = savedVideoUrl(video);
        thumbnailLink.setAttribute("aria-label", `Watch ${video.title}`);
        const thumbnail = document.createElement("img");
        thumbnail.src = `https://i.ytimg.com/vi/${video.id}/mqdefault.jpg`;
        thumbnail.alt = "";
        thumbnail.loading = "lazy";
        thumbnail.width = 128;
        thumbnail.height = 72;
        thumbnail.addEventListener("error", () => {
            thumbnail.hidden = true;
        });
        thumbnailLink.append(thumbnail);
        const content = document.createElement("div");
        content.className = "saved-item__content";
        const link = document.createElement("a");
        link.className = "saved-item__link";
        link.href = savedVideoUrl(video);
        link.textContent = video.title;
        link.title = video.title;
        const openVideo = (event: MouseEvent): void => {
            event.preventDefault();
            void browser.tabs.create({ url: link.href });
        };
        link.addEventListener("click", openVideo);
        thumbnailLink.addEventListener("click", openVideo);
        const info = document.createElement("span");
        info.className = "saved-item__info";
        const duration =
            video.durationSeconds === null
                ? "Duration unknown"
                : `${Math.ceil(Math.max(0, video.durationSeconds - video.positionSeconds) / 60)} min left`;
        info.textContent =
            video.positionSeconds >= 1 ? `${duration} · resumes at ${formatSeconds(video.positionSeconds)}` : duration;
        const controls = document.createElement("div");
        controls.className = "saved-item__controls";
        const rating = document.createElement("select");
        rating.setAttribute("aria-label", `Rating for ${video.title}`);
        for (let score = 1; score <= 10; score += 1) {
            const option = document.createElement("option");
            option.value = String(score);
            option.textContent = `${score}/10`;
            rating.append(option);
        }
        rating.value = String(video.rating);
        rating.addEventListener("change", () => {
            rating.disabled = true;
            void browser.runtime
                .sendMessage({
                    type: "yttl:save-video",
                    video: { ...video, url: savedVideoUrl(video), rating: Number(rating.value) },
                })
                .then((updated) => {
                    savedVideos = updated as SavedVideo[];
                    renderSavedVideos(elements, true);
                })
                .catch(() => {
                    rating.value = String(video.rating);
                    rating.disabled = false;
                });
        });
        const remove = document.createElement("button");
        remove.type = "button";
        remove.className = "saved-item__remove";
        remove.textContent = "Remove";
        remove.setAttribute("aria-label", `Remove ${video.title}`);
        remove.addEventListener("click", () => {
            remove.disabled = true;
            void browser.runtime
                .sendMessage({ type: "yttl:remove-video", id: video.id })
                .then((updated) => {
                    savedVideos = updated as SavedVideo[];
                    renderSavedVideos(elements, true);
                })
                .catch(() => {
                    remove.disabled = false;
                });
        });
        controls.append(rating, remove);
        content.append(link, info, controls);
        item.append(thumbnailLink, content);
        elements.savedList.append(item);
    }
}

async function initializeSavedVideos(elements: PopupElements): Promise<void> {
    const storedRate = await getValueFromStorage(STORAGE_KEYS.playbackRate, 1);
    if (Number.isFinite(storedRate) && storedRate >= 0.25 && storedRate <= 16) {
        elements.planningSpeed.value = String(storedRate);
    }
    savedVideos = (await browser.runtime.sendMessage({ type: "yttl:get-saved" })) as SavedVideo[];
    elements.fitsToggle.addEventListener("click", () => {
        fitsOnly = !fitsOnly;
        renderSavedVideos(elements, true);
    });
    elements.planningSpeed.addEventListener("input", () => renderSavedVideos(elements, true));
    browser.storage.onChanged.addListener((changes, area) => {
        if (area === "local" && changes[STORAGE_KEYS.savedVideos]) {
            void browser.runtime.sendMessage({ type: "yttl:get-saved" }).then((videos) => {
                savedVideos = videos as SavedVideo[];
                renderSavedVideos(elements, true);
            });
        }
    });
    renderSavedVideos(elements, true);
}

async function refreshPopup(): Promise<void> {
    if (!popupElements || updateInProgress) {
        return;
    }

    updateInProgress = true;

    try {
        await updateRemainingTime(popupElements);
        await drawHistoryChart(popupElements);
    } finally {
        updateInProgress = false;
    }
}

async function initializeAudioOnlySetting(elements: PopupElements): Promise<void> {
    const storedValue = await getValueFromStorage<unknown>(STORAGE_KEYS.audioOnlyMode, false);
    elements.audioOnlyCheckbox.checked = storedValue === true;

    elements.audioOnlyCheckbox.addEventListener("change", () => {
        void saveAudioOnlySetting(elements.audioOnlyCheckbox);
    });
}

async function saveAudioOnlySetting(checkbox: HTMLInputElement): Promise<void> {
    const enabled = checkbox.checked;

    try {
        await setValueInStorage(STORAGE_KEYS.audioOnlyMode, enabled);
        if (popupElements) renderSavedVideos(popupElements, true);
    } catch {
        checkbox.checked = !enabled;
    }
}

async function initializePopup(): Promise<void> {
    popupElements = getPopupElements();

    popupElements.exportCsvButton.addEventListener("click", () => {
        void exportHistoryCsv();
    });

    await initializeAudioOnlySetting(popupElements);
    await initializeSavedVideos(popupElements);
    await refreshPopup();

    setInterval(() => {
        void refreshPopup();
    }, TICK_INTERVAL_MS);
}

document.addEventListener("DOMContentLoaded", () => {
    void initializePopup();
});
