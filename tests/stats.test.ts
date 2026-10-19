import { describe, expect, it } from 'vitest'
import { compute, customerMonthTotal, debitDateIn, upcoming } from '../src/domain/stats'
import { C, P, pmap, sub } from './helpers'

const prod = pmap(P(1, 'x', 100))
const cust = new Map([[1, C(1, '王')]])
const calc = (subs: ReturnType<typeof sub>[], d: string, p = prod) => compute(subs, p, cust, d)

describe('StatsCalc (ported from StatsCalcTest.kt)', () => {
  it('debit day clamps to month end', () => {
    expect(debitDateIn('2026-02', 31)).toBe('2026-02-28')
    expect(debitDateIn('2028-02', 30)).toBe('2028-02-29')
    expect(debitDateIn('2026-04', 31)).toBe('2026-04-30')
    expect(debitDateIn('2026-01', 31)).toBe('2026-01-31')
    expect(debitDateIn('2026-03', 0)).toBe('2026-03-01')
  })
  it('splits debited and remaining, inclusive of chosen date', () => {
    const s = calc([sub(5, { qty: 2 }), sub(15, { qty: 3 }), sub(16)], '2026-10-15')
    expect(s.debited).toBe(500); expect(s.remaining).toBe(100); expect(s.total).toBe(600)
  })
  it('uses current product price', () => {
    expect(calc([sub(1, { qty: 2 })], '2026-10-15', pmap(P(1, 'x', 250))).total).toBe(500)
  })
  it('only ACTIVE counts', () => {
    expect(calc([sub(1, { st: 'PAUSED' }), sub(1, { st: 'ENDED' }), sub(1)], '2026-10-15').total).toBe(100)
  })
  it('start date must be on or before debit date', () => {
    const s = calc([
      sub(10, { qty: 1, start: '2026-10-10' }),
      sub(10, { qty: 5, start: '2026-10-11' }),
      sub(20, { qty: 2, start: '2026-10-16' }),
      sub(20, { qty: 9, start: '2026-11-01' }),
    ], '2026-10-15')
    expect(s.debited).toBe(100); expect(s.remaining).toBe(200)
  })
  it('clamped day debits on last day of month', () => {
    expect(calc([sub(31)], '2026-02-27').debited).toBe(0)
    expect(calc([sub(31)], '2026-02-28').debited).toBe(100)
  })
  it('empty is zero', () => { expect(calc([], '2026-01-01').total).toBe(0) })
  it('missing product is skipped', () => { expect(calc([sub(1, { pid: 99 })], '2026-01-01').lines).toHaveLength(0) })
  it('lines sorted by debit date and carry customer name', () => {
    const s = calc([sub(20), sub(3)], '2026-10-15')
    expect(s.lines.map(l => l.debitDate)).toEqual(['2026-10-03', '2026-10-20'])
    expect(s.lines[0].customerName).toBe('王')
  })
})

describe('Upcoming (ported from FormatTest.kt)', () => {
  it('next 7 days crosses month', () => {
    const subs = [sub(28, { id: 1 }), sub(30, { id: 2 }), sub(2, { id: 3 }), sub(10, { id: 4 }), sub(25, { id: 5 })]
    const u = upcoming(subs, prod, new Map(), '2026-10-27', 7)
    expect(u.map(l => l.debitDate)).toEqual(['2026-10-28', '2026-10-30', '2026-11-02'])
    expect(u.every(l => !l.debited)).toBe(true)
  })
  it('clamps month end', () => {
    expect(upcoming([sub(31)], prod, new Map(), '2026-02-25', 7).map(l => l.debitDate)).toEqual(['2026-02-28'])
  })
  it('10/27 → next month day 1 is 待扣款 (unpaid)', () => {
    const u = upcoming([sub(1)], prod, new Map(), '2026-10-27', 7)
    expect(u.map(l => l.debitDate)).toEqual(['2026-11-01'])
    expect(u[0].debited).toBe(false)
  })
  it('1/28 → 1/31, 2/1, 2/2 all unpaid', () => {
    const u = upcoming([sub(31, { id: 1 }), sub(1, { id: 2 }), sub(2, { id: 3 })], prod, new Map(), '2026-01-28', 7)
    expect(u.map(l => l.debitDate)).toEqual(['2026-01-31', '2026-02-01', '2026-02-02'])
    expect(u.some(l => l.debited)).toBe(false)
  })
  it('excludes the selected date itself, includes date+7', () => {
    const u = upcoming([sub(15, { id: 1 }), sub(22, { id: 2 }), sub(23, { id: 3 })], prod, new Map(), '2026-10-15', 7)
    expect(u.map(l => l.debitDate)).toEqual(['2026-10-22'])
  })
  it('year boundary 12/28 → 1/1', () => {
    const u = upcoming([sub(1)], prod, new Map(), '2026-12-28', 7)
    expect(u.map(l => [l.debitDate, l.debited])).toEqual([['2027-01-01', false]])
  })
  it('respects start date in the next month', () => {
    expect(upcoming([sub(1, { start: '2026-11-02' })], prod, new Map(), '2026-10-27', 7)).toHaveLength(0)
  })
})

describe('customerMonthTotal — single calculation source', () => {
  it('uses stats rules', () => {
    const subs = [
      sub(10, { qty: 2, start: '2026-01-01', id: 1 }),
      sub(5, { start: '2026-10-06', id: 2 }),
      sub(20, { start: '2026-10-15', id: 3 }),
      sub(1, { st: 'PAUSED', id: 4 }),
      sub(1, { id: 5, cid: 2 }),
    ]
    expect(customerMonthTotal(subs, prod, 1, '2026-10-15')).toBe(300)
    expect(customerMonthTotal(subs, prod, 1, '2026-10-15')).toBe(compute(subs.filter(s => s.customerId === 1), prod, new Map(), '2026-10-15').total)
  })
})
