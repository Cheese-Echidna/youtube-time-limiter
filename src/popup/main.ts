import { HISTORY_DAYS_VISIBLE, TICK_INTERVAL_MS, WEEKLY_LIMIT_HOURS } from "../lib/constants";
import { lastNDates } from "../lib/date";
import { formatSeconds } from "../lib/format";
import {
    buildHistoryCsv,
    ensureWeeklyBoundary,
    getHistory,
    getTimeRemainingSeconds,
    incrementTimeSpent,
    isMiddayRestrictionEnabled,
    setMiddayRestrictionEnabled,
} from "../lib/time-limiter";

type PopupElements = {
    output: HTMLElement;
    statusText: HTMLElement;
    exportCsvButton: HTMLButtonElement;
    discardSlider: HTMLInputElement;
    discardAmount: HTMLElement;
    discardButton: HTMLButtonElement;
    historyCanvas: HTMLCanvasElement;
    middayRestrictionToggle: HTMLInputElement;
};

let popupElements: PopupElements | null = null;
let updateInProgress = false;

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
        exportCsvButton: getRequiredElement<HTMLButtonElement>("export-csv"),
        discardSlider: getRequiredElement<HTMLInputElement>("discard-slider"),
        discardAmount: getRequiredElement<HTMLElement>("discard-amount"),
        discardButton: getRequiredElement<HTMLButtonElement>("discard-btn"),
        historyCanvas: getRequiredElement<HTMLCanvasElement>("history-chart"),
        middayRestrictionToggle: getRequiredElement<HTMLInputElement>("midday-restriction-toggle"),
    };
}

async function exportHistoryCsv(): Promise<void> {
    const csv = await buildHistoryCsv();
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

async function updateDiscardControls(elements: PopupElements): Promise<void> {
    elements.discardSlider.max = WEEKLY_LIMIT_HOURS.toFixed(1);

    const selectedHours = Number.parseFloat(elements.discardSlider.value) || 0;
    const remainingSeconds = await getTimeRemainingSeconds();
    const remainingHours = remainingSeconds / 3600;
    if (remainingHours <= 0 && selectedHours > 0) {
        elements.discardSlider.value = "0";
    }

    const currentSelectedHours = Number.parseFloat(elements.discardSlider.value) || 0;
    const maxHours = Number.parseFloat(elements.discardSlider.max) || WEEKLY_LIMIT_HOURS;
    const sliderProgress = maxHours > 0 ? Math.min((currentSelectedHours / maxHours) * 100, 100) : 0;

    elements.discardSlider.style.setProperty("--slider-progress", `${sliderProgress}%`);

    elements.discardSlider.disabled = remainingHours <= 0;
    elements.discardAmount.textContent = `${currentSelectedHours.toFixed(1)} hours selected`;
    elements.discardButton.disabled = currentSelectedHours <= 0 || currentSelectedHours > remainingHours;
}

async function discardSelectedTime(elements: PopupElements): Promise<void> {
    const selectedHours = Number.parseFloat(elements.discardSlider.value);
    if (!Number.isFinite(selectedHours) || selectedHours <= 0) {
        return;
    }

    const remainingSeconds = await getTimeRemainingSeconds();
    const secondsToDiscard = Math.round(selectedHours * 3600);

    if (secondsToDiscard > remainingSeconds) {
        const remainingHours = remainingSeconds / 3600;
        alert(`Cannot discard ${selectedHours.toFixed(1)} hours. Only ${remainingHours.toFixed(1)} hours remaining.`);
        return;
    }

    await incrementTimeSpent(secondsToDiscard);
    elements.discardSlider.value = "0";
    await refreshPopup();
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
    const remainingSeconds = await getTimeRemainingSeconds();
    const depleted = remainingSeconds <= 0;

    elements.output.textContent = depleted ? "00:00:00" : formatSeconds(remainingSeconds);
    elements.statusText.textContent = depleted ? "Weekly limit reached" : "Time remaining this week";

    document.body.classList.toggle("is-depleted", depleted);
}

async function refreshPopup(): Promise<void> {
    if (!popupElements || updateInProgress) {
        return;
    }

    updateInProgress = true;

    try {
        await ensureWeeklyBoundary();
        await updateRemainingTime(popupElements);
        await updateDiscardControls(popupElements);
        await drawHistoryChart(popupElements);
    } finally {
        updateInProgress = false;
    }
}

async function initializePopup(): Promise<void> {
    popupElements = getPopupElements();

    const middayEnabled = await isMiddayRestrictionEnabled();
    popupElements.middayRestrictionToggle.checked = middayEnabled;

    popupElements.exportCsvButton.addEventListener("click", () => {
        void exportHistoryCsv();
    });

    popupElements.discardSlider.addEventListener("input", () => {
        if (!popupElements) {
            return;
        }

        void updateDiscardControls(popupElements);
    });

    popupElements.discardButton.addEventListener("click", () => {
        if (!popupElements) {
            return;
        }

        void discardSelectedTime(popupElements);
    });

    popupElements.middayRestrictionToggle.addEventListener("change", () => {
        if (!popupElements) {
            return;
        }

        void setMiddayRestrictionEnabled(popupElements.middayRestrictionToggle.checked);
    });

    await refreshPopup();

    setInterval(() => {
        void refreshPopup();
    }, TICK_INTERVAL_MS);
}

document.addEventListener("DOMContentLoaded", () => {
    void initializePopup();
});
