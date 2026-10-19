/** NT$1,234 (negative: -NT$1,234). Locale-independent grouping. */
export function money(v: number): string {
  const n = Math.abs(Math.trunc(v))
  const g = String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ',')
  return (v < 0 ? '-' : '') + 'NT$' + g
}

export function deleteCustomerMessage(name: string, subCount: number): string {
  return subCount > 0
    ? `將刪除客戶「${name}」以及其 ${subCount} 筆訂閱（已月結的快照紀錄保留）。此動作無法復原。`
    : `將刪除客戶「${name}」（沒有訂閱）。此動作無法復原。`
}
