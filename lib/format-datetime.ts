/** Format ISO / Date for QC UI in the viewer's local timezone (default). */
export function formatLocalDateTime(isoOrDate: string | Date | null | undefined): string {
  if (!isoOrDate) return '—'
  const date = typeof isoOrDate === 'string' ? new Date(isoOrDate) : isoOrDate
  if (Number.isNaN(date.getTime())) return String(isoOrDate)

  const parts = new Intl.DateTimeFormat('en-GB', {
    year: 'numeric',
    month: 'short',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
    timeZoneName: 'short',
  }).formatToParts(date)

  const get = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((p) => p.type === type)?.value ?? ''

  // e.g. 20 Jul 2026, 14:51:51 GMT+7
  const tz = get('timeZoneName')
  return `${get('day')} ${get('month')} ${get('year')}, ${get('hour')}:${get('minute')}:${get('second')}${tz ? ` ${tz}` : ''}`
}

/** Explicit UTC when a fixed zone is needed (exports / cross-timezone compare). */
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

  return `${get('day')} ${get('month')} ${get('year')}, ${get('hour')}:${get('minute')}:${get('second')} UTC`
}

/** @deprecated Prefer formatLocalDateTime — local is the QC default. */
export const formatDateTime = formatLocalDateTime
