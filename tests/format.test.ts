import { describe, expect, it } from 'vitest'
import { subscriptionsCsv, statsCsv, esc } from '../src/domain/csv'
import { deleteCustomerMessage, money } from '../src/domain/format'
import { compute, fromSnapshots } from '../src/domain/stats'
import { C, P, pmap, sub } from './helpers'

describe('money', () => {
  it('NT$ format', () => {
    expect(money(0)).toBe('NT$0')
    expect(money(995)).toBe('NT$995')
    expect(money(1234)).toBe('NT$1,234')
    expect(money(1234567)).toBe('NT$1,234,567')
    expect(money(99999999)).toBe('NT$99,999,999')
    expect(money(-1500)).toBe('-NT$1,500')
  })
})

describe('deleteCustomerMessage', () => {
  it('states cascade count', () => {
    expect(deleteCustomerMessage('王', 3)).toContain('3 筆訂閱')
    expect(deleteCustomerMessage('王', 3)).toContain('快照紀錄保留')
    expect(deleteCustomerMessage('王', 0)).toContain('沒有訂閱')
  })
})

describe('CSV', () => {
  const cust = new Map([[1, { ...C(1, '王, 小明'), phone: '0912' }]])
  it('subscriptions CSV has BOM and escapes commas/quotes/newlines', () => {
    const c = subscriptionsCsv([{ ...sub(1), notes: '第一行\n第二行' }], cust, pmap(P(1, 'a,"b"', 1)))
    expect(c.startsWith('\uFEFF客戶,')).toBe(true)
    expect(c).toContain('"a,""b"""')
    expect(c).toContain('"王, 小明"')
    expect(c).toContain('"第一行\n第二行"')
    expect(c).toContain(',進行中,')
    expect(c.endsWith('\r\n')).toBe(true)
  })
  it('esc', () => {
    expect(esc('plain')).toBe('plain'); expect(esc(null)).toBe(''); expect(esc(12)).toBe('12'); expect(esc('a\rb')).toBe('"a\rb"')
  })
  it('BOM encodes as EF BB BF in UTF-8', () => {
    const bytes = new TextEncoder().encode(statsCsv(compute([], new Map(), new Map(), '2026-10-01')))
    expect([...bytes.slice(0, 3)]).toEqual([0xef, 0xbb, 0xbf])
  })
  it('stats CSV live vs snapshot', () => {
    const live = statsCsv(compute([sub(1), sub(20)], pmap(P(1, 'x', 100)), new Map([[1, C(1, '王')]]), '2026-10-15'))
    expect(live).toContain('資料來源,即時計算'); expect(live).toContain('已扣款,100'); expect(live).toContain('待扣款,100')
    expect(live).toContain('2026-10-01,王,x,100,1,100,已扣款'); expect(live).toContain('2026-10-20,王,x,100,1,100,待扣款')
    const snap = statsCsv(fromSnapshots([], '2026-09-30'))
    expect(snap).toContain('資料來源,月結快照')
  })
})
