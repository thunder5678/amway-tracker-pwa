import { useLiveQuery } from 'dexie-react-hooks'
import { useMemo, useState } from 'react'
import { db } from '../db'
import { cmp, dayOfMonth, monthOf, parts, yearMonth } from '../domain/date'
import { money } from '../domain/format'
import { filterProducts, usageCounts } from '../domain/order'
import { compute, customerMonthTotal, fromSnapshots, upcoming, type DebitLine, type MonthStats } from '../domain/stats'
import { subStatus, type Customer, type DebitSnapshot, type Product, type Subscription } from '../domain/types'
import { EmptyState, Icon, Money, SearchField, SectionTitle, StatusChip } from './common'

type M<T> = Map<number, T>

// ---------- stats ----------

export function useMonthStats(date: string, todayIso: string, subs: Subscription[], pmap: M<Product>, cmap: M<Customer>) {
  const ym = yearMonth(date)
  const isPast = ym < yearMonth(todayIso)
  const hasSnap = useLiveQuery(() => (isPast ? db.snapshotMonths.get(ym).then(Boolean) : Promise.resolve(false)), [ym, isPast])
  const snaps = useLiveQuery(() => (isPast ? db.snapshots.where('yearMonth').equals(ym).toArray() : Promise.resolve([] as DebitSnapshot[])), [ym, isPast])
  const st: MonthStats = isPast ? fromSnapshots(hasSnap ? snaps ?? [] : [], date) : compute(subs, pmap, cmap, date)
  return { st, isPast, hasSnap: !!hasSnap }
}

export function StatsScreen({ date, setDate, todayIso, subs, pmap, cmap, onAddFirst }: {
  date: string; setDate: (d: string) => void; todayIso: string; subs: Subscription[]; pmap: M<Product>; cmap: M<Customer>; onAddFirst: () => void
}) {
  const [byCustomer, setByCustomer] = useState(true)
  const { st, isPast, hasSnap } = useMonthStats(date, todayIso, subs, pmap, cmap)
  const up = isPast ? [] : upcoming(subs, pmap, cmap, date, 7)
  const [y, m, d] = parts(date)

  const groups = useMemo(() => {
    const g = new Map<string, DebitLine[]>()
    for (const l of st.lines) {
      const k = byCustomer ? (l.customerName || '?') : `每月 ${dayOfMonth(l.debitDate)} 號`
      g.set(k, [...(g.get(k) ?? []), l])
    }
    const entries = [...g.entries()]
    return byCustomer ? entries.sort((a, b) => cmp(a[0], b[0])) : entries
  }, [st.lines, byCustomer])

  return (
    <div className="screen">
      <div className="date-row">
        <label className="btn outlined date-btn">
          <Icon name="calendar" size={20} /><span>{date}</span>
          <input type="date" aria-label="選擇統計日期" value={date} onChange={e => e.target.value && setDate(e.target.value)} />
        </label>
        <button className="btn text" onClick={() => setDate(todayIso)}>今天</button>
      </div>
      <p className="muted small" data-testid="source-label">{y} 年 {m} 月・{isPast ? (hasSnap ? '月結快照（唯讀）' : '無快照資料') : '即時計算'}</p>

      {subs.length === 0 && !isPast ? (
        <EmptyState icon="stats" title="還沒有任何訂閱" text="這裡會顯示本月已扣款、剩餘與總額，以及接下來幾天的扣款。先新增一筆客戶訂閱開始使用。" onClick={onAddFirst} />
      ) : (<>
        <div className="stat-cards">
          <div className="stat-card primary wide"><div className="stat-title">本月總額</div><Money v={st.total} className="huge" /></div>
          <div className="stat-card secondary"><div className="stat-title">已扣款（1–{d} 日）</div><Money v={st.debited} className="big" /></div>
          <div className="stat-card tertiary"><div className="stat-title">剩餘</div><Money v={st.remaining} className="big" /></div>
        </div>

        {!isPast && <>
          <SectionTitle>即將扣款（未來 7 天）</SectionTitle>
          {up.length === 0 ? <p className="muted">未來 7 天沒有扣款</p> : (
            <div className="card list" data-testid="upcoming">{up.map((l, i) => <DebitRow key={i} l={l} showCustomer showDate />)}</div>
          )}
        </>}

        <SectionTitle>本月明細</SectionTitle>
        <div className="chips">
          <button className={'fchip ' + (byCustomer ? 'on' : '')} aria-pressed={byCustomer} onClick={() => setByCustomer(true)}>依客戶</button>
          <button className={'fchip ' + (!byCustomer ? 'on' : '')} aria-pressed={!byCustomer} onClick={() => setByCustomer(false)}>依扣款日</button>
        </div>
        {groups.map(([k, ls]) => (
          <div className="card group" key={k}>
            <div className="row">
              <div className="grow title">{k}</div>
              <div className="amt"><Money v={ls.reduce((a, l) => a + l.amount, 0)} /></div>
            </div>
            <div className="muted small">已扣 {money(ls.filter(l => l.debited).reduce((a, l) => a + l.amount, 0))}</div>
            <hr />
            {ls.map((l, i) => <DebitRow key={i} l={l} showCustomer={!byCustomer} showDate={byCustomer} />)}
          </div>
        ))}
        {st.lines.length === 0 && <p className="muted">{isPast && !hasSnap ? '此月份沒有月結快照資料' : '本月沒有符合條件的進行中訂閱'}</p>}
      </>)}
    </div>
  )
}

function DebitRow({ l, showCustomer, showDate }: { l: DebitLine; showCustomer: boolean; showDate: boolean }) {
  return (
    <div className="row debit">
      {showDate && <div className="ddate">{monthOf(l.debitDate)}/{dayOfMonth(l.debitDate)}</div>}
      <div className="grow">
        {showCustomer && <div className="strong">{l.customerName}</div>}
        <div className="clamp2">{l.productName} × {l.quantity}</div>
      </div>
      <div className="amt right">
        <Money v={l.amount} />
        <div className={'small ' + (l.debited ? 'c-secondary' : 'c-tertiary')}>{l.debited ? '已扣款' : '待扣款'}</div>
      </div>
    </div>
  )
}

// ---------- lists ----------

export function SubCard({ s, cmap, pmap, onClick }: { s: Subscription; cmap: M<Customer>; pmap: M<Product>; onClick: () => void }) {
  const p = pmap.get(s.productId)
  const st = subStatus(s)
  return (
    <button className={'card tap sub-card ' + (st === 'ENDED' ? 'dim' : '')} onClick={onClick}>
      <div className="row"><div className="grow title">{cmap.get(s.customerId)?.name ?? '?'}</div><StatusChip s={st} /></div>
      <div className="mt4">{p?.name ?? '?'} × {s.quantity}</div>
      <div className="row"><div className="grow muted small">每月 {s.debitDay} 號</div><div className="amt"><Money v={(p?.unitPrice ?? 0) * s.quantity} /></div></div>
    </button>
  )
}

const ORD = { ACTIVE: 0, PAUSED: 1, ENDED: 2 }
export function SubList({ subs, cmap, pmap, empty, onEdit }: { subs: Subscription[]; cmap: M<Customer>; pmap: M<Product>; empty: React.ReactNode; onEdit: (s: Subscription) => void }) {
  if (subs.length === 0) return <>{empty}</>
  const sorted = [...subs].sort((a, b) => ORD[subStatus(a)] - ORD[subStatus(b)] || a.debitDay - b.debitDay ||
    cmp(cmap.get(a.customerId)?.name ?? '', cmap.get(b.customerId)?.name ?? ''))
  return <div className="screen stack">{sorted.map(s => <SubCard key={s.id} s={s} cmap={cmap} pmap={pmap} onClick={() => onEdit(s)} />)}</div>
}

export function CustomerList({ customers, subs, pmap, todayIso, onAddFirst, onOpen }: {
  customers: Customer[]; subs: Subscription[]; pmap: M<Product>; todayIso: string; onAddFirst: () => void; onOpen: (c: Customer) => void
}) {
  if (customers.length === 0)
    return <EmptyState icon="people" title="還沒有客戶" text="新增長期訂購的客戶（姓名必填，電話與備註可選），之後就能為他建立訂閱。" onClick={onAddFirst} />
  return (
    <div className="screen stack">
      {customers.map(c => {
        const mine = subs.filter(s => s.customerId === c.id)
        const active = mine.filter(s => subStatus(s) === 'ACTIVE')
        return (
          <button key={c.id} className="card tap" onClick={() => onOpen(c)}>
            <div className="row">
              <div className="grow">
                <div className="title">{c.name}</div>
                <div className="muted small">訂閱 {mine.length} 筆（進行中 {active.length}）{c.phone ? `・${c.phone}` : ''}</div>
              </div>
              <div className="amt right">
                <div className="muted xsmall">本月</div>
                <Money v={customerMonthTotal(subs, pmap, c.id!, todayIso)} />
              </div>
            </div>
          </button>
        )
      })}
    </div>
  )
}

export function CustomerDetail({ c, subs, cmap, pmap, todayIso, onAdd, onEdit }: {
  c: Customer; subs: Subscription[]; cmap: M<Customer>; pmap: M<Product>; todayIso: string; onAdd: () => void; onEdit: (s: Subscription) => void
}) {
  const mine = subs.filter(s => s.customerId === c.id).sort((a, b) => a.debitDay - b.debitDay)
  return (
    <div className="screen stack">
      <div className="card info">
        <div className="small strong">本月合計（同統計規則）</div>
        <Money v={customerMonthTotal(subs, pmap, c.id!, todayIso)} className="big" />
        {c.phone && <div>電話：<a href={`tel:${c.phone}`}>{c.phone}</a></div>}
        {c.notes && <div className="prewrap">備註：{c.notes}</div>}
      </div>
      {mine.length === 0
        ? <EmptyState icon="subs" title={`${c.name} 還沒有訂閱`} text="為這位客戶建立每月扣款的長期訂購。" onClick={onAdd} />
        : mine.map(s => <SubCard key={s.id} s={s} cmap={cmap} pmap={pmap} onClick={() => onEdit(s)} />)}
    </div>
  )
}

export function ProductList({ products, subs, onToggleFav, onAddFirst, onEdit }: {
  products: Product[]; subs: Subscription[]; onToggleFav: (p: Product) => void; onAddFirst: () => void; onEdit: (p: Product) => void
}) {
  const [q, setQ] = useState('')
  const [favOnly, setFavOnly] = useState(false)
  if (products.length === 0)
    return <EmptyState icon="products" title="還沒有產品" text="建立產品與單價，訂閱會直接使用產品的單價計算金額。" onClick={onAddFirst} />
  const shown = filterProducts(products, subs, q, favOnly)
  const use = usageCounts(subs)
  return (
    <div className="screen">
      <SearchField q={q} onQ={setQ} />
      <div className="chips">
        <button className={'fchip ' + (!favOnly ? 'on' : '')} aria-pressed={!favOnly} onClick={() => setFavOnly(false)}>全部</button>
        <button className={'fchip ' + (favOnly ? 'on' : '')} aria-pressed={favOnly} onClick={() => setFavOnly(true)}><Icon name="star" size={16} />最愛</button>
        <span className="muted small push">{shown.length} 項</span>
      </div>
      {shown.length === 0 && <p className="muted">{favOnly && !q.trim() ? '還沒有最愛產品，點產品左側的星號加入。' : '沒有符合的產品'}</p>}
      <div className="stack tight">
        {shown.map(p => {
          const n = use.get(p.id!) ?? 0
          return (
            <div key={p.id} className="card prod-row">
              <button className={'icon-btn star ' + (p.isFavorite ? 'on' : '')} aria-label={p.isFavorite ? '取消最愛' : '加入最愛'} aria-pressed={p.isFavorite}
                onClick={() => onToggleFav(p)}><Icon name={p.isFavorite ? 'star' : 'starOutline'} /></button>
              <button className="prod-main" onClick={() => onEdit(p)}>
                <div className="grow">
                  <div className="strong">{p.name}</div>
                  {n > 0 && <div className="muted small">使用中訂閱 {n} 筆</div>}
                </div>
                <div className="amt right"><Money v={p.unitPrice} /></div>
              </button>
            </div>
          )
        })}
      </div>
    </div>
  )
}

