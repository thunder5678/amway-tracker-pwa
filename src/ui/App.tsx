import { useLiveQuery } from 'dexie-react-hooks'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { db, deleteCustomer, deleteProduct, ProductInUseError, startup, snapshotCompletedMonths } from '../db'
import { cmp, dayOfMonth, today } from '../domain/date'
import { statsCsv, subscriptionsCsv } from '../domain/csv'
import { sortProducts } from '../domain/order'
import type { Customer, Product, Subscription } from '../domain/types'
import { requestPersistence, shareOrDownload, trackVisualViewport } from '../platform'
import { Icon, Toast, EmptyState, type IconName } from './common'
import { CustomerDetail, CustomerList, ProductList, StatsScreen, SubList, useMonthStats } from './screens'
import { BackupSheet, CustomerSheet, ProductSheet, SubSheet } from './sheets'

type Tab = 'stats' | 'subs' | 'customers' | 'products'
const TABS: [Tab, string, IconName][] = [['stats', '統計', 'stats'], ['subs', '訂閱', 'subs'], ['customers', '客戶', 'people'], ['products', '產品', 'products']]

/** Local "today", refreshed when the app returns to the foreground (iOS keeps PWAs suspended for days). */
function useToday() {
  const [t, setT] = useState(today())
  useEffect(() => {
    const on = () => {
      if (document.visibilityState !== 'visible') return
      setT(today())
      snapshotCompletedMonths().catch(console.error) // month may have ended while suspended
    }
    document.addEventListener('visibilitychange', on)
    const iv = setInterval(() => setT(today()), 60_000)
    return () => { document.removeEventListener('visibilitychange', on); clearInterval(iv) }
  }, [])
  return t
}

export default function App() {
  const [ready, setReady] = useState(false)
  const [error, setError] = useState<string | null>(null)
  useEffect(() => {
    trackVisualViewport()
    startup().then(() => setReady(true)).catch(e => { console.error(e); setError(String(e?.message ?? e)) })
    requestPersistence()
  }, [])
  const customers = useLiveQuery(() => db.customers.toArray().then(cs => cs.sort((a, b) => cmp(a.name, b.name))), [])
  const products = useLiveQuery(() => db.products.toArray(), [])
  const subs = useLiveQuery(() => db.subscriptions.toArray().then(ss => ss.sort((a, b) => a.debitDay - b.debitDay)), [])
  if (error) return <div className="fatal">無法開啟本機資料庫：{error}<br />若使用私密瀏覽模式，請改用一般模式。</div>
  if (!ready || !customers || !products || !subs) return <div className="splash">安麗長客統計</div>
  return <Main customers={customers} products={products} subs={subs} />
}

function Main({ customers, products, subs }: { customers: Customer[]; products: Product[]; subs: Subscription[] }) {
  const todayIso = useToday()
  const [tab, setTab] = useState<Tab>('stats')
  const [statsDate, setStatsDate] = useState(todayIso)
  const [editCustomer, setEditCustomer] = useState<Customer | null>(null)
  const [editSub, setEditSub] = useState<Subscription | null>(null)
  const [editProduct, setEditProduct] = useState<Product | null>(null)
  const [openCustomerId, setOpenCustomerId] = useState<number | null>(null)
  const [backup, setBackup] = useState(false)
  const [toast, setToast] = useState<string | null>(null)
  const clearToast = useCallback(() => setToast(null), [])
  const pmap = useMemo(() => new Map(products.map(p => [p.id!, p])), [products])
  const cmap = useMemo(() => new Map(customers.map(c => [c.id!, c])), [customers])
  const openCustomer = openCustomerId != null ? cmap.get(openCustomerId) : undefined
  const { st } = useMonthStats(statsDate, todayIso, subs, pmap, cmap)

  const newCustomer = () => setEditCustomer({ name: '', phone: '', notes: '' })
  const newProduct = () => setEditProduct({ name: '', unitPrice: 0, isFavorite: false })
  const newSub = (customerId?: number) => {
    if (customers.length === 0) return newCustomer()
    if (products.length === 0) return newProduct()
    setEditSub({ customerId: customerId ?? customers[0].id!, productId: sortProducts(products, subs)[0].id!, quantity: 1,
      debitDay: dayOfMonth(todayIso), startDate: todayIso, status: 'ACTIVE', notes: '' })
  }
  const guard = (p: Promise<unknown>) => p.catch(e => setToast(e instanceof ProductInUseError ? e.message : '儲存失敗：' + (e?.message ?? e)))
  const share = (name: string, content: string) => shareOrDownload(name, content, 'text/csv').then(r => { if (r === 'downloaded') setToast('已下載 ' + name) })

  const title = tab === 'customers' && openCustomer ? openCustomer.name : tab === 'stats' ? '安麗長客統計' : TABS.find(t => t[0] === tab)![1]
  const fab: (() => void) | null =
    tab === 'subs' ? (subs.length ? () => newSub() : null)
      : tab === 'customers' ? (openCustomer ? () => newSub(openCustomer.id) : customers.length ? newCustomer : null)
        : tab === 'products' ? (products.length ? newProduct : null) : null

  return (
    <div className="app">
      <header className="topbar">
        {tab === 'customers' && openCustomer &&
          <button className="icon-btn" aria-label="返回" onClick={() => setOpenCustomerId(null)}><Icon name="back" /></button>}
        <h1 className="grow">{title}</h1>
        {tab === 'stats' && <button className="icon-btn" aria-label="匯出統計 CSV" onClick={() => share(`stats_${statsDate}.csv`, statsCsv(st))}><Icon name="share" /></button>}
        {tab === 'subs' && subs.length > 0 && <button className="icon-btn" aria-label="匯出 CSV" onClick={() => share(`subscriptions_${todayIso}.csv`, subscriptionsCsv(subs, cmap, pmap))}><Icon name="share" /></button>}
        {tab === 'customers' && openCustomer && <button className="icon-btn" aria-label="編輯客戶" onClick={() => setEditCustomer(openCustomer)}><Icon name="edit" /></button>}
        <button className="icon-btn" aria-label="資料與備份" onClick={() => setBackup(true)}><Icon name="more" /></button>
      </header>

      <main className="content">
        {tab === 'stats' && <StatsScreen date={statsDate} setDate={setStatsDate} todayIso={todayIso} subs={subs} pmap={pmap} cmap={cmap} onAddFirst={() => newSub()} />}
        {tab === 'subs' && <SubList subs={subs} cmap={cmap} pmap={pmap} onEdit={setEditSub}
          empty={<EmptyState icon="subs" title="還沒有訂閱" onClick={() => newSub()}
            text={customers.length === 0 ? '訂閱需要先有客戶。先新增一位客戶，再為他建立每月扣款的訂閱。' : '為客戶建立長期訂購，設定產品、數量與每月扣款日。'} />} />}
        {tab === 'customers' && (openCustomer
          ? <CustomerDetail c={openCustomer} subs={subs} cmap={cmap} pmap={pmap} todayIso={todayIso} onAdd={() => newSub(openCustomer.id)} onEdit={setEditSub} />
          : <CustomerList customers={customers} subs={subs} pmap={pmap} todayIso={todayIso} onAddFirst={newCustomer} onOpen={c => setOpenCustomerId(c.id!)} />)}
        {tab === 'products' && <ProductList products={products} subs={subs} onAddFirst={newProduct} onEdit={setEditProduct}
          onToggleFav={p => guard(db.products.update(p.id!, { isFavorite: !p.isFavorite }))} />}
      </main>

      {fab && <button className="fab" aria-label="新增" onClick={fab}><Icon name="add" size={28} /></button>}

      <nav className="tabbar">
        {TABS.map(([t, label, icon]) => (
          <button key={t} className={'tab ' + (tab === t ? 'on' : '')} aria-current={tab === t ? 'page' : undefined}
            onClick={() => { setTab(t); setOpenCustomerId(null); window.scrollTo(0, 0) }}>
            <span className="tab-icon"><Icon name={icon} /></span><span>{label}</span>
          </button>
        ))}
      </nav>

      {editCustomer && <CustomerSheet key={editCustomer.id ?? 'new'} c={editCustomer} subCount={subs.filter(s => s.customerId === editCustomer.id).length}
        onClose={() => setEditCustomer(null)}
        onSave={c => { guard(db.customers.put(c)); setEditCustomer(null) }}
        onDelete={editCustomer.id ? () => { guard(deleteCustomer(editCustomer.id!)); setEditCustomer(null); setOpenCustomerId(null) } : undefined} />}
      {editProduct && (() => {
        const inUse = subs.filter(s => s.productId === editProduct.id).length
        return <ProductSheet key={editProduct.id ?? 'new'} p={editProduct} inUse={inUse} onClose={() => setEditProduct(null)}
          onSave={p => { guard(db.products.put(p)); setEditProduct(null) }}
          onDelete={editProduct.id && inUse === 0 ? () => { guard(deleteProduct(editProduct.id!)); setEditProduct(null) } : undefined} />
      })()}
      {editSub && <SubSheet key={editSub.id ?? 'new'} s={editSub} customers={customers} products={products} allSubs={subs}
        onClose={() => setEditSub(null)}
        onSave={s => { guard(db.subscriptions.put(s)); setEditSub(null) }}
        onDelete={editSub.id ? () => { guard(db.subscriptions.delete(editSub.id!)); setEditSub(null) } : undefined} />}
      {backup && <BackupSheet customers={customers} products={products} subs={subs} onClose={() => setBackup(false)} toast={setToast} />}
      {toast && <Toast msg={toast} onDone={clearToast} />}
    </div>
  )
}
