import { describe, expect, it } from 'vitest'
import { filterProducts, matches, sortProducts } from '../src/domain/order'
import { P, sub } from './helpers'

const products = [P(1, 'B其他', 1), P(2, 'A其他', 1), P(3, '常用少', 1), P(4, '常用多', 1), P(5, '最愛Z', 1, true), P(6, '最愛A', 1, true)]
const subs = [sub(1, { pid: 3 }), sub(1, { pid: 4 }), sub(2, { pid: 4 }), sub(3, { pid: 5 }), sub(4, { pid: 5 }), sub(5, { pid: 5 })]

describe('ProductOrder (ported from ProductOrderTest.kt)', () => {
  it('favorites, then used, then others', () => {
    expect(sortProducts(products, subs).map(p => p.id)).toEqual([5, 6, 4, 3, 2, 1])
  })
  it('ties by name', () => {
    const ps = [P(1, '乙', 1), P(2, '甲', 1), P(3, 'Ab', 1)]
    expect(sortProducts(ps, []).map(p => p.name)).toEqual(ps.map(p => p.name).sort())
  })
  it('search is case and width insensitive', () => {
    const p = P(1, '優質蛋白素450g', 1), q = P(2, '強效Ｃ營養片', 1), x = P(3, 'XS活力飲', 1)
    expect(matches(p, '４５０Ｇ')).toBe(true)
    expect(matches(q, 'c營養')).toBe(true)
    expect(matches(x, 'ｘｓ')).toBe(true)
    expect(matches(x, '蛋白')).toBe(false)
    expect(matches(x, '  ')).toBe(true)
  })
  it('filter favorites and query', () => {
    expect(filterProducts(products, subs, '', true).map(p => p.id)).toEqual([5, 6])
    expect(filterProducts(products, subs, '常用', false).map(p => p.id)).toEqual([4, 3])
    expect(filterProducts(products, subs, 'a', true).map(p => p.id)).toEqual([6])
  })
  it('does not mutate input', () => {
    const copy = [...products]; sortProducts(products, subs); expect(products).toEqual(copy)
  })
})
