import type { MonthStats } from './stats'
import type { Customer, Product, Subscription } from './types'
import { STATUS_LABEL, subStatus } from './types'

export const BOM = '\uFEFF'

export function esc(v: unknown): string {
  const s = v === null || v === undefined ? '' : String(v)
  return /[,"\r\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s
}
const row = (...v: unknown[]) => v.map(esc).join(',') + '\r\n'

export function subscriptionsCsv(subs: Subscription[], customers: Map<number, Customer>, products: Map<number, Product>): string {
  let out = BOM + row('客戶', '電話', '產品', '單價', '數量', '金額', '扣款日', '開始日期', '狀態', '備註')
  for (const s of subs) {
    const c = customers.get(s.customerId); const p = products.get(s.productId)
    out += row(c?.name, c?.phone, p?.name, p?.unitPrice, s.quantity, (p?.unitPrice ?? 0) * s.quantity, s.debitDay,
      s.startDate, STATUS_LABEL[subStatus(s)], s.notes)
  }
  return out
}

export function statsCsv(st: MonthStats): string {
  let out = BOM
  out += row('統計日期', st.date)
  out += row('資料來源', st.fromSnapshot ? '月結快照' : '即時計算')
  out += row('已扣款', st.debited)
  out += row('待扣款', st.remaining)
  out += row('本月合計', st.total)
  out += '\r\n'
  out += row('扣款日期', '客戶', '產品', '單價', '數量', '金額', '狀態')
  for (const l of st.lines) out += row(l.debitDate, l.customerName, l.productName, l.unitPrice, l.quantity, l.amount, l.debited ? '已扣款' : '待扣款')
  return out
}
