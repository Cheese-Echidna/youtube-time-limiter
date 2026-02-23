export function toDateKey(date: Date): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
}

export function getWeekKey(date: Date): string {
    const weekStart = new Date(date);
    weekStart.setHours(0, 0, 0, 0);

    const dayIndex = weekStart.getDay();
    const daysFromMonday = (dayIndex + 6) % 7;
    weekStart.setDate(weekStart.getDate() - daysFromMonday);

    return toDateKey(weekStart);
}

export function lastNDates(count: number): string[] {
    const days: string[] = [];

    for (let offset = count - 1; offset >= 0; offset -= 1) {
        const date = new Date();
        date.setDate(date.getDate() - offset);
        days.push(toDateKey(date));
    }

    return days;
}
