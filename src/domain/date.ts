/** Calendar dates as ISO strings (YYYY-MM-DD), months as YYYY-MM. Pure, timezone-free arithmetic. */
const pad = (n: number, w = 2) => String(n).padStart(w, '0')

export function iso(y: number, m: number, d: number): string { return `${pad(y, 4)}-${pad(m)}-${pad(d)}` }
export function parts(date: string): [number, number, number] {
  const [y, m, d] = date.split('-').map(Number)
  return [y, m, d]
}
export function isValidIso(s: unknown): s is string {
  if (typeof s !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return false
  const [y, m, d] = parts(s)
  return m >= 1 && m <= 12 && d >= 1 && d <= daysInMonth(ymOf(y, m))
}
export function ymOf(y: number, m: number): string { return `${pad(y, 4)}-${pad(m)}` }
export function yearMonth(date: string): string { return date.slice(0, 7) }
export function ymParts(ym: string): [number, number] { const [y, m] = ym.split('-').map(Number); return [y, m] }
export function daysInMonth(ym: string): number { const [y, m] = ymParts(ym); return new Date(Date.UTC(y, m, 0)).getUTCDate() }
export function nextMonth(ym: string): string { const [y, m] = ymParts(ym); return m === 12 ? ymOf(y + 1, 1) : ymOf(y, m + 1) }
export function firstOfMonth(date: string): string { return yearMonth(date) + '-01' }
export function addDays(date: string, n: number): string {
  const [y, m, d] = parts(date)
  const t = new Date(Date.UTC(y, m - 1, d + n))
  return iso(t.getUTCFullYear(), t.getUTCMonth() + 1, t.getUTCDate())
}
export function dayOfMonth(date: string): number { return parts(date)[2] }
export function monthOf(date: string): number { return parts(date)[1] }
/** Today in the device's local time zone. */
export function today(now: Date = new Date()): string { return iso(now.getFullYear(), now.getMonth() + 1, now.getDate()) }
/** ISO strings compare correctly lexicographically. */
export const cmp = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0)
