import { HISTORY_DAYS_VISIBLE, TICK_INTERVAL_MS } from "../lib/constants";
import { lastNDates } from "../lib/date";
import { formatSeconds } from "../lib/format";

type UsageSnapshot = {
    remainingSeconds: number;
    limitReached: boolean;
};

type UsageHistory = Record<string, number>;

type PopupElements = {
    output: HTMLElement;
    statusText: HTMLElement;
    exportCsvButton: HTMLButtonElement;
    historyCanvas: HTMLCanvasElement;
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
        historyCanvas: getRequiredElement<HTMLCanvasElement>("history-chart"),
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
    const { remainingSeconds, limitReached } = await getUsage();

    elements.output.textContent = limitReached ? "00:00:00" : formatSeconds(remainingSeconds);
    elements.statusText.textContent = limitReached ? "Time depleted — refilling continuously" : "Available time";

    document.body.classList.toggle("is-depleted", limitReached);
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

async function initializePopup(): Promise<void> {
    popupElements = getPopupElements();

    popupElements.exportCsvButton.addEventListener("click", () => {
        void exportHistoryCsv();
    });

    await refreshPopup();

    setInterval(() => {
        void refreshPopup();
    }, TICK_INTERVAL_MS);
}

document.addEventListener("DOMContentLoaded", () => {
    void initializePopup();
});
