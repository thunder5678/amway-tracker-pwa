import 'fake-indexeddb/auto'
import { readFileSync } from 'node:fs'
import { beforeEach, describe, expect, it } from 'vitest'
import { AppDb, ProductInUseError, deleteCustomer, deleteProduct, exportData, restoreData, seedProducts, snapshotCompletedMonths } from '../src/db'
import { backupJson, parseBackup, BackupError } from '../src/domain/backup'
import { META_SEED_VERSION } from '../src/domain/seed'

const csv = readFileSync('src/domain/products_seed.csv', 'utf8')
let n = 0
let d: AppDb
beforeEach(async () => { d = new AppDb('test-' + n++); await d.open() })

async function sample(d: AppDb) {
  const c = (await d.customers.add({ name: '測試客戶', phone: '', notes: '' }))!
  const p = (await d.products.add({ name: '測試品', unitPrice: 1000, isFavorite: true }))!
  await d.subscriptions.add({ customerId: c, productId: p, quantity: 2, debitDay: 31, startDate: '2026-08-15', status: 'ACTIVE', notes: '備,註"' })
  await d.subscriptions.add({ customerId: c, productId: p, quantity: 1, debitDay: 1, startDate: '2026-08-01', status: 'PAUSED', notes: '' })
  return { c, p }
}

describe('seeding (IndexedDB)', () => {
  it('fresh install seeds 70 once; deleted seeds never return; same name never overwritten', async () => {
    await d.products.add({ name: '纖維嚼錠', unitPrice: 1, isFavorite: false })
    expect(await seedProducts(d, csv)).toBe(69)
    expect(await d.products.count()).toBe(70)
    expect((await d.products.where('name').equals('纖維嚼錠').first())!.unitPrice).toBe(1)
    const victim = (await d.products.where('name').equals('蘅怡飲').first())!
    await d.products.delete(victim.id!)
    expect(await seedProducts(d, csv)).toBe(0)
    expect(await d.products.where('name').equals('蘅怡飲').count()).toBe(0)
    expect((await d.meta.get(META_SEED_VERSION))!.value).toBe(2)
  })
  it('upgrade from seed v1 adds only v2 items', async () => {
    await d.meta.put({ key: META_SEED_VERSION, value: 1 })
    expect(await seedProducts(d, csv)).toBe(12)
  })
  it('concurrent startup (React StrictMode) does not double seed', async () => {
    await Promise.all([seedProducts(d, csv), seedProducts(d, csv)])
    expect(await d.products.count()).toBe(70)
  })
})

describe('snapshots (IndexedDB)', () => {
  it('generates completed months once and values stay frozen', async () => {
    const { p } = await sample(d)
    expect(await snapshotCompletedMonths(d, '2026-10-20')).toEqual(['2026-08', '2026-09'])
    await Promise.all([snapshotCompletedMonths(d, '2026-10-20'), snapshotCompletedMonths(d, '2026-10-20')])
    expect(await d.snapshotMonths.count()).toBe(2)
    const rows = await d.snapshots.where('yearMonth').equals('2026-09').toArray()
    expect(rows.map(r => [r.debitDate, r.amount])).toEqual([['2026-09-30', 2000]])
    await d.products.update(p, { unitPrice: 5000 })
    await snapshotCompletedMonths(d, '2026-10-21')
    expect((await d.snapshots.where('yearMonth').equals('2026-09').toArray())[0].amount).toBe(2000)
  })
})

describe('cascading delete', () => {
  it('deleting a customer removes subscriptions but keeps snapshots', async () => {
    const { c } = await sample(d)
    await snapshotCompletedMonths(d, '2026-10-20')
    await deleteCustomer(c, d)
    expect(await d.subscriptions.count()).toBe(0)
    expect(await d.snapshots.count()).toBeGreaterThan(0)
  })
  it('product in use cannot be deleted', async () => {
    const { p } = await sample(d)
    await expect(deleteProduct(p, d)).rejects.toBeInstanceOf(ProductInUseError)
    expect(await d.products.count()).toBe(1)
  })
})

describe('backup roundtrip', () => {
  it('export → JSON → parse → restore into an empty db reproduces all data', async () => {
    await seedProducts(d, csv)
    await sample(d)
    await snapshotCompletedMonths(d, '2026-10-20')
    const before = await exportData(d)
    const text = backupJson(before)
    const parsed = parseBackup(text)
    const d2 = new AppDb('restore-' + n++)
    await d2.products.add({ name: '會被取代', unitPrice: 1, isFavorite: false })
    await restoreData(parsed, d2)
    const after = await exportData(d2)
    const strip = (x: typeof before) => ({ ...x, snapshots: x.snapshots.map(({ id: _i, ...r }) => r) })
    expect(strip(after)).toEqual(strip(before))
    expect(await seedProducts(d2, csv)).toBe(0)
  })
  it('rejects invalid files with zh-TW errors', () => {
    expect(() => parseBackup('nope')).toThrow(BackupError)
    expect(() => parseBackup('{"format":"other"}')).toThrow('不是安麗長客統計的備份檔')
    const bad = { format: 'amway-tracker-backup', version: 1, customers: [], products: [], subscriptions: [{ id: 1, customerId: 9, productId: 9 }], snapshots: [], snapshotMonths: [] }
    expect(() => parseBackup(JSON.stringify(bad))).toThrow('訂閱關聯')
    expect(() => parseBackup(JSON.stringify({ ...bad, version: 99 }))).toThrow('版本較新')
  })
})
