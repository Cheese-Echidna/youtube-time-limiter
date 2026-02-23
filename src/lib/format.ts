export function formatSeconds(totalSeconds: number): string {
    const bounded = Math.max(0, Math.floor(totalSeconds));
    const hours = Math.floor(bounded / 3600);
    const minutes = Math.floor((bounded % 3600) / 60);
    const seconds = bounded % 60;

    return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}
