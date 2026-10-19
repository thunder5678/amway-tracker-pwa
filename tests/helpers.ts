import type { Customer, Product, SubStatus, Subscription } from '../src/domain/types'

export const P = (id: number, name: string, unitPrice: number, isFavorite = false): Product => ({ id, name, unitPrice, isFavorite })
export const C = (id: number, name: string): Customer => ({ id, name, phone: '', notes: '' })
export function sub(day: number, o: { qty?: number; start?: string; st?: SubStatus; pid?: number; id?: number; cid?: number } = {}): Subscription {
  return { id: o.id ?? 0, customerId: o.cid ?? 1, productId: o.pid ?? 1, quantity: o.qty ?? 1, debitDay: day,
    startDate: o.start ?? '2020-01-01', status: o.st ?? 'ACTIVE', notes: '' }
}
export const pmap = (...ps: Product[]) => new Map(ps.map(p => [p.id!, p]))
