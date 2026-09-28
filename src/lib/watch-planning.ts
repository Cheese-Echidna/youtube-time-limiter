import { ACCRUED_SECONDS_PER_MILLISECOND } from "./constants";

export const AUDIO_ONLY_USAGE_MULTIPLIER = 0.5;
const REFILL_PER_SECOND = ACCRUED_SECONDS_PER_MILLISECOND * 1000;

export function secondsUntilDepleted(balance: number, audioOnly: boolean): number {
    const netCost = (audioOnly ? AUDIO_ONLY_USAGE_MULTIPLIER : 1) - REFILL_PER_SECOND;
    return Math.max(0, balance) / netCost;
}

export function secondsToFinish(videoSeconds: number, playbackRate: number): number {
    return Math.max(0, videoSeconds) / (playbackRate > 0 ? playbackRate : 1);
}

export function canFinish(videoSeconds: number, playbackRate: number, balance: number, audioOnly: boolean): boolean {
    return secondsToFinish(videoSeconds, playbackRate) <= secondsUntilDepleted(balance, audioOnly);
}
