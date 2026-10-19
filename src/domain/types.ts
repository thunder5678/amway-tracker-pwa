export type SubStatus = 'ACTIVE' | 'PAUSED' | 'ENDED'
export const SUB_STATUSES: SubStatus[] = ['ACTIVE', 'PAUSED', 'ENDED']
export const STATUS_LABEL: Record<SubStatus, string> = { ACTIVE: '進行中', PAUSED: '暫停', ENDED: '結束' }

export interface Customer { id?: number; name: string; phone: string; notes: string }
export interface Product { id?: number; name: string; unitPrice: number; isFavorite: boolean }
export interface Subscription {
  id?: number
  customerId: number
  productId: number
  quantity: number
  /** 1..31; clamped to month end */
  debitDay: number
  /** ISO date YYYY-MM-DD */
  startDate: string
  status: SubStatus
  notes: string
}
/** Fixed record of one debit in a completed month. Never recalculated. */
export interface DebitSnapshot {
  id?: number
  /** YYYY-MM */
  yearMonth: string
  subscriptionId: number
  customerId: number
  customerName: string
  productName: string
  unitPrice: number
  quantity: number
  amount: number
  /** ISO date */
  debitDate: string
}
/** Marks a month as snapshotted (even with zero debits). */
export interface SnapshotMonth { yearMonth: string; createdAt: number }

export function subStatus(s: { status: string }): SubStatus {
  return (SUB_STATUSES as string[]).includes(s.status) ? (s.status as SubStatus) : 'ACTIVE'
}
