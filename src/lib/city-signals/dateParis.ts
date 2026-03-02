/**
 * Today and month in Europe/Paris for daily pack resolution.
 */

export function getTodayParis(): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Paris',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date())
  const y = parts.find((p) => p.type === 'year')?.value ?? ''
  const m = parts.find((p) => p.type === 'month')?.value ?? ''
  const d = parts.find((p) => p.type === 'day')?.value ?? ''
  return `${y}-${m}-${d}`
}

export function getMonthFromDate(date: string): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return date.slice(0, 7)
  return date.slice(0, 7)
}
