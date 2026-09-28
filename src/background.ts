import { addToHistory, getHistory, consumeQuota, getQuota, quotaRemainingSeconds, saveQuota } from "./lib/time-limiter";
import { getSavedVideos, removeVideo, saveVideo, videoIdFromUrl } from "./lib/saved-videos";

type UsageSnapshot = {
    remainingSeconds: number;
    limitReached: boolean;
};

let operationQueue: Promise<void> = Promise.resolve();

function queueOperation<T>(operation: () => Promise<T>): Promise<T> {
    const result = operationQueue.then(operation, operation);
    operationQueue = result.then(
        () => undefined,
        () => undefined,
    );
    return result;
}

async function getUsageSnapshot(): Promise<UsageSnapshot> {
    const quota = await getQuota();
    const remainingSeconds = quotaRemainingSeconds(quota);
    return {
        remainingSeconds,
        limitReached: remainingSeconds === 0,
    };
}

async function getCurrentUsage(): Promise<UsageSnapshot> {
    return queueOperation(async () => {
        return getUsageSnapshot();
    });
}

async function consumePlayback(seconds: unknown): Promise<UsageSnapshot> {
    return queueOperation(async () => {
        const requestedSeconds = Number(seconds);
        const chargeSeconds = Number.isFinite(requestedSeconds) ? Math.max(0, requestedSeconds) : 0;
        const quota = await getQuota();
        const allowedSeconds = Math.min(chargeSeconds, quota.availableSeconds);

        if (allowedSeconds > 0) {
            await saveQuota(consumeQuota(quota, allowedSeconds));
            await addToHistory(allowedSeconds);
        }

        return getUsageSnapshot();
    });
}

browser.runtime.onMessage.addListener((message: unknown, sender): Promise<unknown> | undefined => {
    if (sender.id !== browser.runtime.id || !message || typeof message !== "object") {
        return undefined;
    }

    const type = (message as { type?: unknown }).type;
    if (type === "yttl:get-usage") {
        return getCurrentUsage();
    }

    if (type === "yttl:consume-playback") {
        return consumePlayback((message as { seconds?: unknown }).seconds);
    }

    if (type === "yttl:get-history") {
        return getHistory();
    }

    if (type === "yttl:get-saved") return queueOperation(getSavedVideos);
    if (type === "yttl:save-video") return queueOperation(() => saveVideo((message as { video?: unknown }).video));
    if (type === "yttl:remove-video") return queueOperation(() => removeVideo((message as { id?: unknown }).id));
    if (type === "yttl:update-saved-playback") {
        return queueOperation(async () => {
            const details = (message as { video?: unknown }).video;
            if (!details || typeof details !== "object") return;
            const data = details as Record<string, unknown>;
            const id = typeof data.url === "string" ? videoIdFromUrl(data.url) : null;
            if (!id) return;
            const saved = (await getSavedVideos()).find((video) => video.id === id);
            if (!saved || (data.positionOnStop !== true && saved.durationSeconds !== null)) return;
            await saveVideo({
                ...data,
                rating: saved.rating,
                positionSeconds: data.positionOnStop === true ? data.positionSeconds : saved.positionSeconds,
            });
        });
    }

    return undefined;
});
