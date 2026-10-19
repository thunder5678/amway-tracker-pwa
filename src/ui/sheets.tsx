import { useLiveQuery } from 'dexie-react-hooks'
import { useEffect, useRef, useState } from 'react'
import { db, restoreData } from '../db'
import { backupJson, BackupError, parseBackup, restoreSummary, type BackupData } from '../domain/backup'
import { subscriptionsCsv } from '../domain/csv'
import { isValidIso, today } from '../domain/date'
import { deleteCustomerMessage, money } from '../domain/format'
import { filterProducts } from '../domain/order'
import { META_SEED_VERSION } from '../domain/seed'
import { STATUS_LABEL, SUB_STATUSES, subStatus, type Customer, type Product, type Subscription } from '../domain/types'
import { persisted, requestPersistence, shareOrDownload } from '../platform'
import { ConfirmDialog, FitText, Icon, SearchField, Sheet } from './common'

function Buttons({ saveEnabled, onSave, onCancel, onDelete, deleteLabel }: { saveEnabled: boolean; onSave: () => void; onCancel: () => void; onDelete?: () => void; deleteLabel?: string }) {
  return (
    <div className="row">
      {onDelete && <button className="btn text danger" onClick={onDelete}>{deleteLabel}</button>}
      <div className="grow" />
      <button className="btn text" onClick={onCancel}>取消</button>
      <button className="btn filled" disabled={!saveEnabled} onClick={onSave}>儲存</button>
    </div>
  )
}

function Field({ label, children, hint, error }: { label: string; children: React.ReactNode; hint?: string; error?: boolean }) {
  return (
    <label className={'field ' + (error ? 'error' : '')}>
      <span className="field-label">{label}</span>
      {children}
      {hint && <span className="field-hint">{hint}</span>}
    </label>
  )
}

export function CustomerSheet({ c, subCount, onClose, onSave, onDelete }: { c: Customer; subCount: number; onClose: () => void; onSave: (c: Customer) => void; onDelete?: () => void }) {
  const [name, setName] = useState(c.name)
  const [phone, setPhone] = useState(c.phone)
  const [notes, setNotes] = useState(c.notes)
  const [confirm, setConfirm] = useState(false)
  const ok = name.trim() !== ''
  return (
    <Sheet title={c.id ? '編輯客戶' : '新增客戶'} onClose={onClose}
      footer={<Buttons saveEnabled={ok} onCancel={onClose} onSave={() => onSave({ ...c, name: name.trim(), phone: phone.trim(), notes: notes.trim() })}
        onDelete={onDelete && (() => setConfirm(true))} deleteLabel="刪除客戶（含其訂閱）" />}>
      <Field label="姓名*" error={!ok}><input value={name} onChange={e => setName(e.target.value)} autoComplete="off" /></Field>
      <Field label="電話"><input type="tel" inputMode="tel" value={phone} onChange={e => setPhone(e.target.value)} autoComplete="off" /></Field>
      <Field label="備註"><textarea rows={3} value={notes} onChange={e => setNotes(e.target.value)} /></Field>
      {confirm && onDelete && <ConfirmDialog title="確定刪除？" message={deleteCustomerMessage(c.name, subCount)} onCancel={() => setConfirm(false)} onConfirm={() => { setConfirm(false); onDelete() }} />}
    </Sheet>
  )
}

export function ProductSheet({ p, inUse, onClose, onSave, onDelete }: { p: Product; inUse: number; onClose: () => void; onSave: (p: Product) => void; onDelete?: () => void }) {
  const [name, setName] = useState(p.name)
  const [price, setPrice] = useState(p.id ? String(p.unitPrice) : '')
  const [confirm, setConfirm] = useState(false)
  const priceN = /^\d{1,9}$/.test(price) ? Number(price) : null
  const ok = name.trim() !== '' && priceN !== null
  return (
    <Sheet title={p.id ? '編輯產品' : '新增產品'} onClose={onClose}
      footer={<Buttons saveEnabled={ok} onCancel={onClose} onSave={() => onSave({ ...p, name: name.trim(), unitPrice: priceN! })}
        onDelete={onDelete && (() => setConfirm(true))} deleteLabel="刪除產品" />}>
      <Field label="產品名稱*" error={!name.trim()}><input value={name} onChange={e => setName(e.target.value)} autoComplete="off" /></Field>
      <Field label="單價（NT$）*" error={priceN === null} hint={priceN !== null ? money(priceN) : '請輸入整數金額'}>
        <input inputMode="numeric" pattern="[0-9]*" value={price} onChange={e => setPrice(e.target.value.replace(/\D/g, '').slice(0, 9))} />
      </Field>
      {inUse > 0 && <p className="muted small">有 {inUse} 筆訂閱使用此產品；修改單價會影響本月及之後的計算（已月結的月份不變）。</p>}
      {!!p.id && !onDelete && <p className="muted small">仍有訂閱使用，無法刪除</p>}
      {confirm && onDelete && <ConfirmDialog title="確定刪除？" message={`將刪除產品「${p.name}」。此動作無法復原。`} onCancel={() => setConfirm(false)} onConfirm={() => { setConfirm(false); onDelete() }} />}
    </Sheet>
  )
}

function QuantityStepper({ qty, onChange }: { qty: number; onChange: (n: number) => void }) {
  const [text, setText] = useState(String(qty))
  useEffect(() => setText(String(qty)), [qty])
  const clamp = (n: number) => Math.min(999, Math.max(1, n))
  return (
    <div className="row stepper">
      <span className="grow">數量</span>
      <button className="icon-btn tonal" aria-label="減少" disabled={qty <= 1} onClick={() => onChange(clamp(qty - 1))}><Icon name="remove" /></button>
      <input className="qty" aria-label="數量" inputMode="numeric" pattern="[0-9]*" value={text}
        onChange={e => { const t = e.target.value.replace(/\D/g, '').slice(0, 3); setText(t); if (t) onChange(clamp(Number(t))) }}
        onBlur={() => setText(String(qty))} />
      <button className="icon-btn tonal" aria-label="增加" disabled={qty >= 999} onClick={() => onChange(clamp(qty + 1))}><Icon name="add" /></button>
    </div>
  )
}

export function SubSheet({ s, customers, products, allSubs, onClose, onSave, onDelete }: {
  s: Subscription; customers: Customer[]; products: Product[]; allSubs: Subscription[]; onClose: () => void; onSave: (s: Subscription) => void; onDelete?: () => void
}) {
  const [customerId, setCustomerId] = useState(s.customerId)
  const [productId, setProductId] = useState(s.productId)
  const [qty, setQty] = useState(s.quantity)
  const [day, setDay] = useState(String(s.debitDay))
  const [start, setStart] = useState(s.startDate)
  const [status, setStatus] = useState(subStatus(s))
  const [notes, setNotes] = useState(s.notes)
  const [picker, setPicker] = useState(false)
  const [confirm, setConfirm] = useState(false)
  const product = products.find(p => p.id === productId)
  const dayN = /^\d{1,2}$/.test(day) && Number(day) >= 1 && Number(day) <= 31 ? Number(day) : null
  const ok = !!product && dayN !== null && isValidIso(start) && customers.some(c => c.id === customerId)
  return (
    <Sheet title={s.id ? '編輯訂閱' : '新增訂閱'} onClose={onClose}
      footer={<Buttons saveEnabled={ok} onCancel={onClose} onDelete={onDelete && (() => setConfirm(true))} deleteLabel="刪除訂閱"
        onSave={() => onSave({ ...s, customerId, productId, quantity: qty, debitDay: dayN!, startDate: start, status, notes: notes.trim() })} />}>
      <Field label="客戶">
        <select value={customerId} onChange={e => setCustomerId(Number(e.target.value))}>
          {customers.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
      </Field>
      <div className="field">
        <span className="field-label">產品</span>
        <button className="picker" onClick={() => setPicker(true)}>
          <span className="grow left">{product ? `${product.name}・${money(product.unitPrice)}` : '選擇'}</span><Icon name="chevron" />
        </button>
        <span className="field-hint">單價一律取自產品</span>
      </div>
      <QuantityStepper qty={qty} onChange={setQty} />
      <Field label="每月扣款日（1–31）*" error={dayN === null} hint="超過當月天數則於月底扣款">
        <input inputMode="numeric" pattern="[0-9]*" value={day} onChange={e => setDay(e.target.value.replace(/\D/g, '').slice(0, 2))} />
      </Field>
      <Field label="開始日期" error={!isValidIso(start)}>
        <input type="date" value={start} onChange={e => setStart(e.target.value || today())} />
      </Field>
      <div className="field">
        <span className="field-label">狀態</span>
        <div className="chips">
          {SUB_STATUSES.map(st => <button key={st} className={'fchip ' + (status === st ? 'on' : '')} aria-pressed={status === st} onClick={() => setStatus(st)}>{STATUS_LABEL[st]}</button>)}
        </div>
      </div>
      <Field label="備註"><textarea rows={2} value={notes} onChange={e => setNotes(e.target.value)} /></Field>
      {product && <div className="row total-row"><span className="grow">每月金額</span><span className="amt right c-primary"><FitText text={money(product.unitPrice * qty)} className="money big" /></span></div>}
      {picker && <ProductPicker products={products} subs={allSubs} onClose={() => setPicker(false)} onPick={p => { setProductId(p.id!); setPicker(false) }} />}
      {confirm && onDelete && <ConfirmDialog title="確定刪除？" message="將刪除這筆訂閱（已月結的快照紀錄保留）。此動作無法復原。" onCancel={() => setConfirm(false)} onConfirm={() => { setConfirm(false); onDelete() }} />}
    </Sheet>
  )
}

function ProductPicker({ products, subs, onClose, onPick }: { products: Product[]; subs: Subscription[]; onClose: () => void; onPick: (p: Product) => void }) {
  const [q, setQ] = useState('')
  const shown = filterProducts(products, subs, q, false)
  return (
    <Sheet title="選擇產品" onClose={onClose} className="picker-sheet" footer={<div className="row"><div className="grow" /><button className="btn text" onClick={onClose}>取消</button></div>}>
      <SearchField q={q} onQ={setQ} />
      <div className="pick-list">
        {shown.map(p => (
          <button key={p.id} className="pick-item" onClick={() => onPick(p)}>
            <span className="star-slot">{p.isFavorite && <Icon name="star" size={18} className="c-star" />}</span>
            <span className="grow left">{p.name}</span>
            <span className="amt right"><FitText text={money(p.unitPrice)} className="money" /></span>
          </button>
        ))}
        {shown.length === 0 && <p className="muted">沒有符合的產品</p>}
      </div>
    </Sheet>
  )
}

/** Full backup / restore and data safety. Data is pre-loaded so share() runs synchronously inside the tap (iOS). */
export function BackupSheet({ customers, products, subs, onClose, toast }: {
  customers: Customer[]; products: Product[]; subs: Subscription[]; onClose: () => void; toast: (m: string) => void
}) {
  const extra = useLiveQuery(async () => ({
    snapshots: await db.snapshots.toArray(),
    snapshotMonths: await db.snapshotMonths.toArray(),
    seedVersion: (await db.meta.get(META_SEED_VERSION))?.value ?? 0,
  }), [])
  const [persist, setPersist] = useState<boolean | null | undefined>(undefined)
  const [pending, setPending] = useState<BackupData | null>(null)
  const file = useRef<HTMLInputElement>(null)
  useEffect(() => { persisted().then(setPersist) }, [])

  const exportBackup = async () => {
    if (!extra) return
    const data: BackupData = { customers, products, subscriptions: subs, ...extra }
    const r = await shareOrDownload(`amway-backup_${today()}.json`, backupJson(data), 'application/json')
    if (r !== 'cancelled') toast(r === 'shared' ? '已開啟分享，請存到「檔案」或傳給自己' : '已下載備份檔')
  }
  const exportSubsCsv = async () => {
    const r = await shareOrDownload(`subscriptions_${today()}.csv`,
      subscriptionsCsv(subs, new Map(customers.map(c => [c.id!, c])), new Map(products.map(p => [p.id!, p]))), 'text/csv')
    if (r === 'downloaded') toast('已下載 CSV')
  }
  const onFile = async (f: File | undefined) => {
    if (!f) return
    try { setPending(parseBackup(await f.text())) }
    catch (e) { toast(e instanceof BackupError ? e.message : '無法讀取檔案') }
    finally { if (file.current) file.current.value = '' }
  }
  const doRestore = async () => {
    const b = pending!; setPending(null)
    try { await restoreData(b); toast('已還原備份'); onClose() } catch { toast('還原失敗，資料未變更') }
  }

  return (
    <Sheet title="資料與備份" onClose={onClose} footer={<div className="row"><div className="grow" /><button className="btn text" onClick={onClose}>關閉</button></div>}>
      <p className="small">所有資料只存在這台裝置的瀏覽器（IndexedDB），不會上傳。清除 Safari 網站資料或刪除主畫面 App 可能會清掉資料，請定期匯出完整備份。</p>
      <div className="card info small">
        <div>目前資料：客戶 {customers.length}、產品 {products.length}、訂閱 {subs.length}、月結快照 {extra?.snapshotMonths.length ?? '…'} 個月</div>
        <div>持久儲存：{persist === undefined ? '…' : persist === null ? '此瀏覽器不支援' : persist ? '已啟用（瀏覽器不會自動清除）' : '未啟用'}
          {persist === false && <button className="btn text inline" onClick={async () => setPersist(await requestPersistence())}>要求啟用</button>}
        </div>
      </div>
      <button className="btn filled block" disabled={!extra} onClick={exportBackup}><Icon name="share" size={20} />匯出完整備份（JSON）</button>
      <button className="btn outlined block" onClick={() => file.current?.click()}>從備份檔還原…</button>
      <input ref={file} type="file" accept=".json,application/json" hidden onChange={e => onFile(e.target.files?.[0])} />
      <button className="btn outlined block" disabled={subs.length === 0} onClick={exportSubsCsv}><Icon name="share" size={20} />匯出訂閱清單 CSV</button>
      <p className="muted xsmall">版本 {__APP_VERSION__}・{__GIT_SHA__}</p>
      {pending && <ConfirmDialog title="還原備份？" confirm="還原" message={`將以備份檔取代這台裝置上的所有資料：${restoreSummary(pending)}。目前的資料會被覆蓋，此動作無法復原。`}
        onCancel={() => setPending(null)} onConfirm={doRestore} />}
    </Sheet>
  )
}
