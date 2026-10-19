import Dexie, { type EntityTable } from 'dexie'
import type { BackupData } from './domain/backup'
import { today } from './domain/date'
import { CURRENT_SEED_VERSION, META_SEED_VERSION, doneVersion, parseCurated, pending, toInsert } from './domain/seed'
import { generateSnapshots } from './domain/stats'
import type { Customer, DebitSnapshot, Product, SnapshotMonth, Subscription } from './domain/types'
import seedCsv from './domain/products_seed.csv?raw'

interface Meta { key: string; value: number }

export class AppDb extends Dexie {
  customers!: EntityTable<Customer, 'id'>
  products!: EntityTable<Product, 'id'>
  subscriptions!: EntityTable<Subscription, 'id'>
  snapshots!: EntityTable<DebitSnapshot, 'id'>
  snapshotMonths!: EntityTable<SnapshotMonth, 'yearMonth'>
  meta!: EntityTable<Meta, 'key'>
  constructor(name = 'amway-tracker') {
    super(name)
    this.version(1).stores({
      customers: '++id, name',
      products: '++id, name',
      subscriptions: '++id, customerId, productId',
      snapshots: '++id, yearMonth',
      snapshotMonths: 'yearMonth',
      meta: 'key',
    })
  }
}

export const db = new AppDb()
const all = (d: AppDb) => [d.customers, d.products, d.subscriptions, d.snapshots, d.snapshotMonths, d.meta]

/** One-time, versioned default product seeding. Same (normalized) name is skipped; deleted seeds never come back. */
export async function seedProducts(d: AppDb = db, csv: string = seedCsv): Promise<number> {
  return d.transaction('rw', d.products, d.meta, async () => {
    const done = doneVersion((await d.meta.get(META_SEED_VERSION))?.value ?? 0)
    if (done >= CURRENT_SEED_VERSION) return 0
    const add = toInsert(pending(parseCurated(csv), done), await d.products.toArray())
    await d.products.bulkAdd(add)
    await d.meta.put({ key: META_SEED_VERSION, value: CURRENT_SEED_VERSION })
    return add.length
  })
}

/** Offline month-end: freeze any completed months not yet snapshotted. Idempotent (re-reads done months inside the transaction). */
export async function snapshotCompletedMonths(d: AppDb = db, todayIso: string = today()): Promise<string[]> {
  return d.transaction('rw', [d.subscriptions, d.products, d.customers, d.snapshots, d.snapshotMonths], async () => {
    const done = new Set((await d.snapshotMonths.toArray()).map(m => m.yearMonth))
    const res = generateSnapshots(await d.subscriptions.toArray(), await d.products.toArray(), await d.customers.toArray(), done, todayIso)
    if (res.months.length) { await d.snapshots.bulkAdd(res.rows); await d.snapshotMonths.bulkPut(res.months) }
    return res.months.map(m => m.yearMonth)
  })
}

export async function startup(d: AppDb = db) {
  await seedProducts(d)
  await snapshotCompletedMonths(d)
}

/** Cascades to the customer's subscriptions; snapshots are kept. */
export async function deleteCustomer(id: number, d: AppDb = db) {
  await d.transaction('rw', d.customers, d.subscriptions, async () => {
    await d.subscriptions.where('customerId').equals(id).delete()
    await d.customers.delete(id)
  })
}

export class ProductInUseError extends Error {}
export async function deleteProduct(id: number, d: AppDb = db) {
  await d.transaction('rw', d.products, d.subscriptions, async () => {
    const n = await d.subscriptions.where('productId').equals(id).count()
    if (n > 0) throw new ProductInUseError(`仍有 ${n} 筆訂閱使用此產品，無法刪除`)
    await d.products.delete(id)
  })
}

export async function exportData(d: AppDb = db): Promise<BackupData> {
  return d.transaction('r', all(d), async () => ({
    customers: await d.customers.toArray(),
    products: await d.products.toArray(),
    subscriptions: await d.subscriptions.toArray(),
    snapshots: await d.snapshots.toArray(),
    snapshotMonths: await d.snapshotMonths.toArray(),
    seedVersion: (await d.meta.get(META_SEED_VERSION))?.value ?? 0,
  }))
}

/** Replace ALL local data with the backup (ids preserved). */
export async function restoreData(b: BackupData, d: AppDb = db) {
  await d.transaction('rw', all(d), async () => {
    for (const t of all(d)) await t.clear()
    await d.customers.bulkAdd(b.customers)
    await d.products.bulkAdd(b.products)
    await d.subscriptions.bulkAdd(b.subscriptions)
    await d.snapshots.bulkAdd(b.snapshots.map(({ id: _id, ...r }) => r))
    await d.snapshotMonths.bulkPut(b.snapshotMonths)
    await d.meta.put({ key: META_SEED_VERSION, value: b.seedVersion })
  })
}
