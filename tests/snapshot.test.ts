import { describe, expect, it } from 'vitest'
import { compute, fromSnapshots, generateSnapshots, pendingMonths } from '../src/domain/stats'
import { C, P, pmap, sub } from './helpers'

const products = [P(1, '蛋白素', 1000), P(2, '鈣片', 500)]
const customers = [C(1, '王')]
const today = '2026-10-15'

describe('Snapshotter (ported from SnapshotTest.kt)', () => {
  it('pending from earliest start up to last completed month', () => {
    const subs = [sub(5, { start: '2026-07-20', id: 1 }), sub(5, { start: '2026-09-01', id: 2 })]
    expect(pendingMonths(subs, new Set(), today)).toEqual(['2026-07', '2026-08', '2026-09'])
  })
  it('skips already snapshotted and no subs', () => {
    const subs = [sub(5, { start: '2026-08-01', id: 1 })]
    expect(pendingMonths(subs, new Set(['2026-08']), today)).toEqual(['2026-09'])
    expect(pendingMonths([], new Set(), today)).toEqual([])
    expect(pendingMonths(subs, new Set(['2026-08', '2026-09']), today)).toEqual([])
  })
  it('crosses year boundary', () => {
    expect(pendingMonths([sub(1, { start: '2025-11-30' })], new Set(), '2026-02-01')).toEqual(['2025-11', '2025-12', '2026-01'])
  })
  it('rows freeze values and respect rules', () => {
    const subs = [
      sub(5, { start: '2026-07-20', id: 1 }),
      sub(31, { qty: 2, pid: 2, start: '2026-09-01', id: 2 }),
      sub(1, { st: 'PAUSED', start: '2026-07-01', id: 3 }),
    ]
    const r = generateSnapshots(subs, products, customers, new Set(), today, 42)
    expect(r.months.map(m => m.yearMonth)).toEqual(['2026-07', '2026-08', '2026-09'])
    expect(r.months.every(m => m.createdAt === 42)).toBe(true)
    expect(r.rows.filter(x => x.yearMonth === '2026-07')).toEqual([])
    const sep = r.rows.filter(x => x.yearMonth === '2026-09')
    expect(sep.map(x => x.amount)).toEqual([1000, 1000])
    const calcium = sep.find(x => x.productName === '鈣片')!
    expect(calcium.unitPrice).toBe(500); expect(calcium.quantity).toBe(2)
    expect(calcium.debitDate).toBe('2026-09-30'); expect(calcium.customerName).toBe('王')
    expect(calcium.subscriptionId).toBe(2)
  })
  it('snapshot stats ignore later price changes', () => {
    const subs = [sub(5, { id: 1, start: '2026-09-01' })]
    const rows = generateSnapshots(subs, products, customers, new Set(), today).rows
    const st = fromSnapshots(rows, '2026-09-30')
    expect(st.total).toBe(1000); expect(st.fromSnapshot).toBe(true)
    expect(compute(subs, pmap(P(1, '蛋白素', 1200)), new Map(), today).total).toBe(1200)
    const mid = fromSnapshots(rows, '2026-09-04')
    expect(mid.debited).toBe(0); expect(mid.remaining).toBe(1000)
  })
})
