import { STORAGE_KEYS } from "./constants";
import { getValueFromStorage, setValueInStorage } from "./storage";

export type SavedVideo = {
    id: string;
    title: string;
    rating: number;
    durationSeconds: number | null;
    positionSeconds: number;
    savedAt: number;
};

export function videoIdFromUrl(url: string): string | null {
    try {
        const parsed = new URL(url);
        if (
            parsed.protocol !== "https:" ||
            !["youtube.com", "www.youtube.com", "m.youtube.com"].includes(parsed.hostname) ||
            parsed.pathname !== "/watch"
        ) {
            return null;
        }
        const id = parsed.searchParams.get("v");
        return id && /^[a-zA-Z0-9_-]{11}$/.test(id) ? id : null;
    } catch {
        return null;
    }
}

export function savedVideoUrl(video: SavedVideo): string {
    const url = new URL("https://www.youtube.com/watch");
    url.searchParams.set("v", video.id);
    if (video.positionSeconds >= 1) url.searchParams.set("t", String(Math.floor(video.positionSeconds)));
    return url.toString();
}

export async function getSavedVideos(): Promise<SavedVideo[]> {
    const value = await getValueFromStorage<unknown>(STORAGE_KEYS.savedVideos, []);
    if (!Array.isArray(value)) return [];
    return value.filter((item): item is SavedVideo => {
        if (!item || typeof item !== "object") return false;
        const video = item as Record<string, unknown>;
        return (
            typeof video.id === "string" &&
            /^[a-zA-Z0-9_-]{11}$/.test(video.id) &&
            typeof video.title === "string" &&
            typeof video.rating === "number" &&
            Number.isInteger(video.rating) &&
            video.rating >= 1 &&
            video.rating <= 10 &&
            (video.durationSeconds === null ||
                (typeof video.durationSeconds === "number" &&
                    Number.isFinite(video.durationSeconds) &&
                    video.durationSeconds >= 0)) &&
            typeof video.positionSeconds === "number" &&
            Number.isFinite(video.positionSeconds) &&
            video.positionSeconds >= 0 &&
            typeof video.savedAt === "number" &&
            Number.isFinite(video.savedAt)
        );
    });
}

export async function saveVideo(input: unknown): Promise<SavedVideo[]> {
    if (!input || typeof input !== "object") throw new Error("Invalid video");
    const data = input as Record<string, unknown>;
    const id = typeof data.url === "string" ? videoIdFromUrl(data.url) : null;
    const rating = Number(data.rating);
    if (!id || !Number.isInteger(rating) || rating < 1 || rating > 10) throw new Error("Invalid video or rating");

    const videos = await getSavedVideos();
    const previous = videos.find((video) => video.id === id);
    const durationSeconds =
        typeof data.durationSeconds === "number" && Number.isFinite(data.durationSeconds) && data.durationSeconds > 0
            ? data.durationSeconds
            : (previous?.durationSeconds ?? null);
    const positionSeconds =
        typeof data.positionSeconds === "number" && Number.isFinite(data.positionSeconds)
            ? Math.max(0, Math.min(data.positionSeconds, durationSeconds ?? Infinity))
            : (previous?.positionSeconds ?? 0);
    const title =
        typeof data.title === "string" && data.title.trim()
            ? data.title.trim().slice(0, 300)
            : (previous?.title ?? "YouTube video");
    const saved: SavedVideo = {
        id,
        title,
        rating,
        durationSeconds,
        positionSeconds,
        savedAt: previous?.savedAt ?? Date.now(),
    };
    const updated = [...videos.filter((video) => video.id !== id), saved];
    await setValueInStorage(STORAGE_KEYS.savedVideos, updated);
    return updated;
}

export async function removeVideo(id: unknown): Promise<SavedVideo[]> {
    if (typeof id !== "string" || !/^[a-zA-Z0-9_-]{11}$/.test(id)) throw new Error("Invalid video");
    const videos = await getSavedVideos();
    const updated = videos.filter((video) => video.id !== id);
    if (updated.length === videos.length) return videos;
    await setValueInStorage(STORAGE_KEYS.savedVideos, updated);
    return updated;
}
