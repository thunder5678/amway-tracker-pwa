import { isValidIso } from './date'
import type { Customer, DebitSnapshot, Product, SnapshotMonth, Subscription } from './types'
import { SUB_STATUSES } from './types'

export const BACKUP_FORMAT = 'amway-tracker-backup'
export const BACKUP_VERSION = 1

export interface BackupData {
  customers: Customer[]
  products: Product[]
  subscriptions: Subscription[]
  snapshots: DebitSnapshot[]
  snapshotMonths: SnapshotMonth[]
  seedVersion: number
}
export interface Backup extends BackupData { format: typeof BACKUP_FORMAT; version: number; exportedAt: string; app: string }

export function buildBackup(d: BackupData, now = new Date()): Backup {
  return { format: BACKUP_FORMAT, version: BACKUP_VERSION, app: '安麗長客統計 PWA', exportedAt: now.toISOString(), ...d }
}
export function backupJson(d: BackupData, now = new Date()): string { return JSON.stringify(buildBackup(d, now), null, 1) }

export class BackupError extends Error {}

const isInt = (v: unknown): v is number => typeof v === 'number' && Number.isInteger(v)
const isStr = (v: unknown): v is string => typeof v === 'string'
function arr(o: Record<string, unknown>, k: string): Record<string, unknown>[] {
  const v = o[k]
  if (!Array.isArray(v)) throw new BackupError(`備份檔缺少「${k}」`)
  return v as Record<string, unknown>[]
}
function need(ok: boolean, what: string) { if (!ok) throw new BackupError(`備份檔資料格式錯誤：${what}`) }

/** Parse and strictly validate a backup file. Throws BackupError (zh-TW message) on any problem. */
export function parseBackup(text: string): BackupData {
  let o: Record<string, unknown>
  try { o = JSON.parse(text.replace(/^\uFEFF/, '')) } catch { throw new BackupError('不是有效的備份檔（JSON 解析失敗）') }
  if (!o || typeof o !== 'object' || o.format !== BACKUP_FORMAT) throw new BackupError('不是安麗長客統計的備份檔')
  if (!isInt(o.version) || o.version > BACKUP_VERSION) throw new BackupError('備份檔版本較新，請先更新 App')
  const customers = arr(o, 'customers').map(c => {
    need(isInt(c.id) && isStr(c.name) && c.name.trim() !== '', '客戶')
    return { id: c.id as number, name: c.name as string, phone: isStr(c.phone) ? c.phone : '', notes: isStr(c.notes) ? c.notes : '' }
  })
  const products = arr(o, 'products').map(p => {
    need(isInt(p.id) && isStr(p.name) && isInt(p.unitPrice) && (p.unitPrice as number) >= 0, '產品')
    return { id: p.id as number, name: p.name as string, unitPrice: p.unitPrice as number, isFavorite: p.isFavorite === true }
  })
  const cids = new Set(customers.map(c => c.id)); const pids = new Set(products.map(p => p.id))
  const subscriptions = arr(o, 'subscriptions').map(s => {
    need(isInt(s.id) && isInt(s.customerId) && cids.has(s.customerId as number) && isInt(s.productId) && pids.has(s.productId as number), '訂閱關聯')
    need(isInt(s.quantity) && (s.quantity as number) >= 1 && (s.quantity as number) <= 999, '訂閱數量')
    need(isInt(s.debitDay) && (s.debitDay as number) >= 1 && (s.debitDay as number) <= 31, '扣款日')
    need(isValidIso(s.startDate), '開始日期')
    need((SUB_STATUSES as unknown[]).includes(s.status), '訂閱狀態')
    return { id: s.id as number, customerId: s.customerId as number, productId: s.productId as number, quantity: s.quantity as number,
      debitDay: s.debitDay as number, startDate: s.startDate as string, status: s.status as Subscription['status'], notes: isStr(s.notes) ? s.notes : '' }
  })
  const snapshots = arr(o, 'snapshots').map(r => {
    need(isStr(r.yearMonth) && /^\d{4}-\d{2}$/.test(r.yearMonth) && isValidIso(r.debitDate) && isInt(r.amount) && isInt(r.unitPrice) && isInt(r.quantity), '月結快照')
    return { id: isInt(r.id) ? r.id : undefined, yearMonth: r.yearMonth as string, subscriptionId: isInt(r.subscriptionId) ? r.subscriptionId : 0,
      customerId: isInt(r.customerId) ? r.customerId : 0, customerName: isStr(r.customerName) ? r.customerName : '',
      productName: isStr(r.productName) ? r.productName : '', unitPrice: r.unitPrice as number, quantity: r.quantity as number,
      amount: r.amount as number, debitDate: r.debitDate as string } as DebitSnapshot
  })
  const snapshotMonths = arr(o, 'snapshotMonths').map(m => {
    need(isStr(m.yearMonth) && /^\d{4}-\d{2}$/.test(m.yearMonth), '快照月份')
    return { yearMonth: m.yearMonth as string, createdAt: isInt(m.createdAt) ? m.createdAt : 0 }
  })
  const seedVersion = isInt(o.seedVersion) ? o.seedVersion : 0
  return { customers, products, subscriptions, snapshots, snapshotMonths, seedVersion }
}

export function restoreSummary(d: BackupData): string {
  return `客戶 ${d.customers.length} 位、產品 ${d.products.length} 項、訂閱 ${d.subscriptions.length} 筆、月結快照 ${d.snapshotMonths.length} 個月`
}
