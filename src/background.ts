import {
    addToHistory,
    getHistory,
    consumeQuota,
    getQuota,
    quotaRemainingSeconds,
    saveQuota,
} from "./lib/time-limiter";

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

    return undefined;
});
