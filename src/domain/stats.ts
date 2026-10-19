import { addDays, cmp, daysInMonth, firstOfMonth, nextMonth, yearMonth } from './date'
import type { Customer, DebitSnapshot, Product, SnapshotMonth, Subscription } from './types'
import { subStatus } from './types'

export interface DebitLine {
  customerId: number
  customerName: string
  productName: string
  unitPrice: number
  quantity: number
  amount: number
  debitDate: string
  debited: boolean
}
export interface MonthStats {
  date: string
  lines: DebitLine[]
  fromSnapshot: boolean
  debited: number
  remaining: number
  total: number
}
type Map_<T> = Map<number, T>

export function monthStats(date: string, lines: DebitLine[], fromSnapshot = false): MonthStats {
  const debited = lines.filter(l => l.debited).reduce((a, l) => a + l.amount, 0)
  const remaining = lines.filter(l => !l.debited).reduce((a, l) => a + l.amount, 0)
  return { date, lines, fromSnapshot, debited, remaining, total: debited + remaining }
}

/** Debit day beyond the month length falls on the last day of the month. */
export function debitDateIn(ym: string, debitDay: number): string {
  const d = Math.min(Math.max(debitDay, 1), daysInMonth(ym))
  return `${ym}-${String(d).padStart(2, '0')}`
}

const byDate = (a: { debitDate: string }, b: { debitDate: string }) => cmp(a.debitDate, b.debitDate)

/**
 * SINGLE calculation source for a month's debits (LESSONS: one function per money concept).
 * Counts only ACTIVE subscriptions whose start date <= this month's debit date, using CURRENT product prices.
 * A line is debited when its debit date is on or before [date].
 */
export function compute(subs: Subscription[], products: Map_<Product>, customers: Map_<Customer>, date: string): MonthStats {
  const ym = yearMonth(date)
  const lines: DebitLine[] = []
  for (const s of subs) {
    if (subStatus(s) !== 'ACTIVE') continue
    const p = products.get(s.productId)
    if (!p) continue
    const d = debitDateIn(ym, s.debitDay)
    if (s.startDate > d) continue
    lines.push({
      customerId: s.customerId, customerName: customers.get(s.customerId)?.name ?? '', productName: p.name,
      unitPrice: p.unitPrice, quantity: s.quantity, amount: p.unitPrice * s.quantity, debitDate: d, debited: d <= date,
    })
  }
  return monthStats(date, lines.sort(byDate))
}

/** Customer month total: same rules as stats (delegates to compute). */
export function customerMonthTotal(subs: Subscription[], products: Map_<Product>, customerId: number, date: string): number {
  return compute(subs.filter(s => s.customerId === customerId), products, new Map(), date).total
}

/** Stats for a past month from its frozen snapshot rows. */
export function fromSnapshots(rows: DebitSnapshot[], date: string): MonthStats {
  return monthStats(date, rows.map(r => ({
    customerId: r.customerId, customerName: r.customerName, productName: r.productName, unitPrice: r.unitPrice,
    quantity: r.quantity, amount: r.amount, debitDate: r.debitDate, debited: r.debitDate <= date,
  })).sort(byDate), true)
}

/**
 * Debits strictly after [date] and within [days] days (may cross into next month), live-calculated.
 * Every upcoming item is after the selected date, so it is ALWAYS 待扣款 — debited is judged against the
 * selected date, never the month-start basis used for the per-month compute (LESSONS 2026-10-17).
 */
export function upcoming(subs: Subscription[], products: Map_<Product>, customers: Map_<Customer>, date: string, days = 7): DebitLine[] {
  const end = addDays(date, days)
  const months = [...new Set([firstOfMonth(date), firstOfMonth(end)])]
  return months.flatMap(m => compute(subs, products, customers, m).lines)
    .filter(l => l.debitDate > date && l.debitDate <= end)
    .map(l => ({ ...l, debited: l.debitDate <= date }))
    .sort((a, b) => cmp(a.debitDate, b.debitDate) || cmp(a.customerName, b.customerName))
}

/** Completed months (strictly before today's month) from the earliest subscription start month, not yet snapshotted. */
export function pendingMonths(subs: Subscription[], done: Set<string>, todayIso: string): string[] {
  if (subs.length === 0) return []
  let m = yearMonth(subs.map(s => s.startDate).reduce((a, b) => (b < a ? b : a)))
  const current = yearMonth(todayIso)
  const out: string[] = []
  while (m < current) { if (!done.has(m)) out.push(m); m = nextMonth(m) }
  return out
}

export function snapshotRowsFor(ym: string, subs: Subscription[], products: Map_<Product>, customers: Map_<Customer>): DebitSnapshot[] {
  // Reuse the single calculation source with the month's last day so every line is included.
  const rows: DebitSnapshot[] = []
  for (const s of subs) {
    const st = compute([s], products, customers, debitDateIn(ym, 31))
    for (const l of st.lines) rows.push({
      yearMonth: ym, subscriptionId: s.id ?? 0, customerId: l.customerId, customerName: l.customerName,
      productName: l.productName, unitPrice: l.unitPrice, quantity: l.quantity, amount: l.amount, debitDate: l.debitDate,
    })
  }
  return rows.sort(byDate)
}

export function generateSnapshots(subs: Subscription[], products: Product[], customers: Customer[], done: Set<string>, todayIso: string, now = Date.now()) {
  const pm = new Map(products.map(p => [p.id!, p])); const cm = new Map(customers.map(c => [c.id!, c]))
  const months = pendingMonths(subs, done, todayIso)
  return {
    rows: months.flatMap(m => snapshotRowsFor(m, subs, pm, cm)),
    months: months.map<SnapshotMonth>(m => ({ yearMonth: m, createdAt: now })),
  }
}
