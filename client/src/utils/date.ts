/**
 * Timezone-safe local calendar arithmetic and formatting.
 * Never use `.toISOString().split('T')[0]` to determine local date,
 * because `.toISOString()` converts local time to UTC, shifting
 * users in UTC+ offsets (e.g. India GMT+5:30) back to yesterday between 00:00 and 05:30 AM!
 */

export function getLocalDateString(d: Date = new Date()): string {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function getLocalTimeString(d: Date = new Date()): string {
  const hours = String(d.getHours()).padStart(2, '0');
  const minutes = String(d.getMinutes()).padStart(2, '0');
  return `${hours}:${minutes}`;
}

export function getTomorrowDateString(d: Date = new Date()): string {
  const tomorrow = new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1);
  return getLocalDateString(tomorrow);
}

export function getClientTimezone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'Asia/Kolkata';
  } catch {
    return 'UTC';
  }
}
