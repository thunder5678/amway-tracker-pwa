import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { money } from '../domain/format'
import { STATUS_LABEL, type SubStatus } from '../domain/types'

const PATHS = {
  stats: 'M5 9.2h3V19H5zM10.6 5h2.8v14h-2.8zm5.6 8H19v6h-2.8z',
  subs: 'M12 6v3l4-4-4-4v3c-4.42 0-8 3.58-8 8 0 1.57.46 3.03 1.24 4.26L6.7 14.8c-.45-.83-.7-1.79-.7-2.8 0-3.31 2.69-6 6-6zm6.76 1.74L17.3 9.2c.44.84.7 1.79.7 2.8 0 3.31-2.69 6-6 6v-3l-4 4 4 4v-3c4.42 0 8-3.58 8-8 0-1.57-.46-3.03-1.24-4.26z',
  people: 'M16 11c1.66 0 2.99-1.34 2.99-3S17.66 5 16 5c-1.66 0-3 1.34-3 3s1.34 3 3 3zm-8 0c1.66 0 2.99-1.34 2.99-3S9.66 5 8 5C6.34 5 5 6.34 5 8s1.34 3 3 3zm0 2c-2.33 0-7 1.17-7 3.5V19h14v-2.5c0-2.33-4.67-3.5-7-3.5zm8 0c-.29 0-.62.02-.97.05 1.16.84 1.97 1.97 1.97 3.45V19h6v-2.5c0-2.33-4.67-3.5-7-3.5z',
  products: 'M20 2H4c-1 0-2 .9-2 2v3.01c0 .72.43 1.34 1 1.69V20c0 1.1 1.1 2 2 2h14c.9 0 2-.9 2-2V8.7c.57-.35 1-.97 1-1.69V4c0-1.1-1-2-2-2zm-5 12H9v-2h6v2zm5-7H4V4h16v3z',
  add: 'M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z',
  remove: 'M19 13H5v-2h14v2z',
  back: 'M20 11H7.83l5.59-5.59L12 4l-8 8 8 8 1.41-1.41L7.83 13H20v-2z',
  star: 'M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z',
  starOutline: 'M22 9.24l-7.19-.62L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21 12 17.27 18.18 21l-1.63-7.03L22 9.24zM12 15.4l-3.76 2.27 1-4.28-3.32-2.88 4.38-.38L12 6.1l1.71 4.04 4.38.38-3.32 2.88 1 4.28L12 15.4z',
  search: 'M15.5 14h-.79l-.28-.27C15.41 12.59 16 11.11 16 9.5 16 5.91 13.09 3 9.5 3S3 5.91 3 9.5 5.91 16 9.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z',
  edit: 'M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04c.39-.39.39-1.02 0-1.41l-2.34-2.34c-.39-.39-1.02-.39-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z',
  share: 'M16 5l-1.42 1.42-1.59-1.59V16h-1.98V4.83L9.42 6.42 8 5l4-4 4 4zm4 5v11c0 1.1-.9 2-2 2H6c-1.11 0-2-.9-2-2V10c0-1.11.89-2 2-2h3v2H6v11h12V10h-3V8h3c1.1 0 2 .89 2 2z',
  calendar: 'M19 4h-1V2h-2v2H8V2H6v2H5c-1.11 0-1.99.9-1.99 2L3 20a2 2 0 0 0 2 2h14c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 16H5V10h14v10zM9 14H7v-2h2v2zm4 0h-2v-2h2v2zm4 0h-2v-2h2v2z',
  clear: 'M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z',
  more: 'M12 8c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2zm0 2c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm0 6c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2z',
  chevron: 'M7 10l5 5 5-5z',
} as const
export type IconName = keyof typeof PATHS

export function Icon({ name, size = 24, className }: { name: IconName; size?: number; className?: string }) {
  return (
    <svg className={className} width={size} height={size} viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path d={PATHS[name]} fill="currentColor" />
    </svg>
  )
}

/**
 * Single-line text that shrinks until it fits the available width (never clipped / ellipsized).
 * Uses a transform so the element's layout width stays the unscaled text width (clamped by its container):
 * the available width never depends on the current scale, so it grows back when space grows (LESSONS).
 */
export function FitText({ text, className, minScale = 0.4 }: { text: string; className?: string; minScale?: number }) {
  const outer = useRef<HTMLSpanElement>(null)
  const inner = useRef<HTMLSpanElement>(null)
  const [scale, setScale] = useState(1)
  useLayoutEffect(() => {
    const o = outer.current, i = inner.current
    if (!o || !i) return
    const fit = () => {
      const avail = o.clientWidth
      const natural = i.offsetWidth
      if (!avail || !natural) return
      setScale(Math.max(minScale, Math.min(1, Math.floor((avail / natural) * 1000) / 1000)))
    }
    fit()
    const ro = new ResizeObserver(fit)
    ro.observe(o); ro.observe(i)
    return () => ro.disconnect()
  }, [text, minScale])
  return (
    <span ref={outer} className={'fit ' + (className ?? '')} title={text}>
      <span ref={inner} className="fit-inner" style={scale < 1 ? { transform: `scale(${scale})` } : undefined}>{text}</span>
    </span>
  )
}

export const Money = ({ v, className }: { v: number; className?: string }) => <FitText text={money(v)} className={'money ' + (className ?? '')} />

export function StatusChip({ s }: { s: SubStatus }) {
  return <span className={`chip status-${s}`}>{STATUS_LABEL[s]}</span>
}

export function EmptyState({ icon, title, text, button = '新增第一筆', onClick }: { icon: IconName; title: string; text: string; button?: string; onClick: () => void }) {
  return (
    <div className="empty">
      <Icon name={icon} size={56} className="empty-icon" />
      <h2>{title}</h2>
      <p>{text}</p>
      <button className="btn filled" onClick={onClick}><Icon name="add" size={20} />{button}</button>
    </div>
  )
}

export function SectionTitle({ children }: { children: ReactNode }) { return <h3 className="section">{children}</h3> }

function useBodyLock() {
  useEffect(() => {
    const b = document.body
    const n = Number(b.dataset.locks ?? 0) + 1
    b.dataset.locks = String(n); b.classList.add('locked')
    return () => {
      const m = Number(b.dataset.locks ?? 1) - 1
      b.dataset.locks = String(m); if (m <= 0) b.classList.remove('locked')
    }
  }, [])
}

/** Modal bottom sheet (iOS-style), keyboard and safe-area aware. */
export function Sheet({ title, onClose, children, footer, className }: { title: string; onClose: () => void; children: ReactNode; footer?: ReactNode; className?: string }) {
  useBodyLock()
  useEffect(() => {
    const k = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', k); return () => window.removeEventListener('keydown', k)
  }, [onClose])
  return createPortal(
    <div className="scrim" onClick={onClose}>
      <div className={'sheet ' + (className ?? '')} role="dialog" aria-modal="true" aria-label={title} onClick={e => e.stopPropagation()}>
        <div className="grabber" />
        <div className="sheet-head"><h2>{title}</h2></div>
        <div className="sheet-body">{children}</div>
        {footer && <div className="sheet-foot">{footer}</div>}
      </div>
    </div>, document.body)
}

export function ConfirmDialog({ title, message, confirm = '刪除', danger = true, onConfirm, onCancel }: { title: string; message: string; confirm?: string; danger?: boolean; onConfirm: () => void; onCancel: () => void }) {
  useBodyLock()
  return createPortal(
    <div className="scrim center" onClick={onCancel}>
      <div className="dialog" role="alertdialog" aria-modal="true" aria-label={title} onClick={e => e.stopPropagation()}>
        <h2>{title}</h2>
        <p>{message}</p>
        <div className="dialog-actions">
          <button className="btn text" onClick={onCancel}>取消</button>
          <button className={'btn text ' + (danger ? 'danger' : '')} onClick={onConfirm}>{confirm}</button>
        </div>
      </div>
    </div>, document.body)
}

export function SearchField({ q, onQ, placeholder = '搜尋產品' }: { q: string; onQ: (s: string) => void; placeholder?: string }) {
  return (
    <label className="search">
      <Icon name="search" size={20} />
      <input type="search" value={q} placeholder={placeholder} onChange={e => onQ(e.target.value)} enterKeyHint="search" autoComplete="off" />
      {q && <button type="button" className="icon-btn small" aria-label="清除" onClick={() => onQ('')}><Icon name="clear" size={18} /></button>}
    </label>
  )
}

export function Toast({ msg, onDone }: { msg: string; onDone: () => void }) {
  useEffect(() => { const t = setTimeout(onDone, 3200); return () => clearTimeout(t) }, [msg, onDone])
  return <div className="toast" role="status">{msg}</div>
}
