import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { cleanName, doneVersion, isDouble, parseCurated, parseRaw, pending, singles, splitCsv, toInsert } from '../src/domain/seed'

const curated = parseCurated(readFileSync('src/domain/products_seed.csv', 'utf8'))
const raw = parseRaw(readFileSync('data/products_v2_raw.csv', 'utf8'))

describe('ProductSeed (ported from ProductSeedTest.kt)', () => {
  it('cleans names', () => {
    expect(cleanName('長客強健活力組合-單盒 ')).toBe('強健活力組合')
    expect(cleanName('長客營養早餐－單罐組')).toBe('營養早餐')
    expect(cleanName('長客DX綜合營養片補充包單盒')).toBe('DX綜合營養片補充包')
    expect(cleanName('長客優質蛋白素４５０ｇ－單罐')).toBe('優質蛋白素450g')
    expect(cleanName('長客活果維他纖飲－櫻桃－單罐')).toBe('活果維他纖飲-櫻桃')
    expect(cleanName('長客淨透深層卸妝乳－單支')).toBe('淨透深層卸妝乳')
    expect(cleanName('紐崔萊長客單罐兒童C+益生菌幫助維持消化道機能｜安麗電商台灣')).toBe('兒童C+益生菌幫助維持消化道機能')
  })
  it('detects double packs', () => {
    expect(isDouble('長客雙效B群能量片-單罐')).toBe(false)
    expect(isDouble('長客雙效B群能量片-雙罐')).toBe(true)
    expect(isDouble('長客優質蛋白素抹茶－雙罐組')).toBe(true)
    expect(isDouble('長客DX綜合營養片補充包雙盒')).toBe(true)
    expect(isDouble('長客某精華X2')).toBe(true)
  })
  it('curated asset (70 items) is consistent with raw source', () => {
    expect(raw).toHaveLength(139)
    expect(curated).toHaveLength(70)
    expect(curated.filter(c => c.version === 1)).toHaveLength(58)
    expect(curated.filter(c => c.version === 2)).toHaveLength(12)
    expect(new Set(curated.map(c => c.name)).size).toBe(70)
    const byCode = new Map(raw.map(r => [r.orderCode, r]))
    for (const c of curated) {
      const r = byCode.get(c.orderCode)
      expect(r, c.orderCode).toBeDefined()
      expect(r!.price).toBe(c.price)
      expect(isDouble(r!.rawName)).toBe(false)
      expect(c.name).not.toContain('長客'); expect(c.name).not.toContain('安麗')
    }
    const p = curated.find(c => c.orderCode === '2942')!
    expect([p.name, p.price]).toEqual(['複合益生菌90入', 4695])
    expect(curated.some(c => c.orderCode === '2943')).toBe(false)
    expect(curated.find(c => c.orderCode === '2881')!.price).toBe(1200)
    expect(singles(raw).length).toBeGreaterThanOrEqual(70)
  })
  it('versioned seeding: fresh=70, upgrade from v1 only adds v2, never overwrites / never re-adds deleted', () => {
    expect(doneVersion(0, false)).toBe(0)
    expect(doneVersion(0, true)).toBe(1)
    expect(doneVersion(2, true)).toBe(2)
    expect(pending(curated, 0)).toHaveLength(70)
    const upgrade = pending(curated, 1)
    expect(upgrade.map(u => u.name).sort()).toEqual(['蘅怡飲', '甘草薑黃維生素C飲', '營養超纖飲纖穀玉米', '三倍強效魚油膠囊',
      '加美D鈣錠', '女士益生菌', '兒童C+益生菌', '複合益生菌90入', '青春水潤淨化精華', '賦活緊緻抗老精華', '淨透深層卸妝乳', '超能亮維C精萃'].sort())
    const add = toInsert(upgrade, [{ name: '加美Ｄ鈣錠' }])
    expect(add).toHaveLength(11)
    expect(add.some(p => p.name === '纖維嚼錠' || p.name === '加美D鈣錠')).toBe(false)
    expect(pending(curated, 2)).toEqual([])
  })
  it('dedupe seeding never overwrites', () => {
    const seeds = [
      { name: '優質蛋白素450g', orderCode: '2852', price: 995, version: 1 },
      { name: '纖維嚼錠', orderCode: '2828', price: 670, version: 1 },
      { name: '纖維嚼錠', orderCode: 'x', price: 1, version: 1 },
    ]
    expect(toInsert(seeds, [{ name: ' 優質蛋白素４５０ｇ ' }])).toEqual([{ name: '纖維嚼錠', unitPrice: 670, isFavorite: false }])
  })
  it('csv split handles quotes', () => {
    expect(splitCsv('"a,""b""",1,2')).toEqual(['a,"b"', '1', '2'])
  })
})
