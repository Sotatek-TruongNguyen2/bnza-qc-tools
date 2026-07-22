/** Format ISO / Date for QC UI, always in UTC. */
export function formatUtcDateTime(isoOrDate: string | Date | null | undefined): string {
  if (!isoOrDate) return '—'
  const date = typeof isoOrDate === 'string' ? new Date(isoOrDate) : isoOrDate
  if (Number.isNaN(date.getTime())) return String(isoOrDate)

  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'UTC',
    year: 'numeric',
    month: 'short',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  }).formatToParts(date)

  const get = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((p) => p.type === type)?.value ?? ''

  // e.g. 22 Jul 2026, 01:41:51 UTC
  return `${get('day')} ${get('month')} ${get('year')}, ${get('hour')}:${get('minute')}:${get('second')} UTC`
}
