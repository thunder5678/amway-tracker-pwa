/** Browser helpers: sharing/downloading files, storage persistence, keyboard-aware viewport. No network access. */

export type ShareResult = 'shared' | 'downloaded' | 'cancelled'

/**
 * Must be called synchronously from a user gesture (content prepared beforehand) so iOS keeps the
 * transient activation required by navigator.share.
 */
export async function shareOrDownload(name: string, content: string, mime: string): Promise<ShareResult> {
  const blob = new Blob([content], { type: mime })
  const file = new File([blob], name, { type: mime })
  const nav = navigator as Navigator & { canShare?: (d: ShareData) => boolean }
  if (typeof nav.share === 'function' && nav.canShare?.({ files: [file] })) {
    try { await nav.share({ files: [file], title: name }); return 'shared' }
    catch (e) { if ((e as DOMException).name === 'AbortError') return 'cancelled' /* else fall back to download */ }
  }
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url; a.download = name; a.rel = 'noopener'
  document.body.appendChild(a); a.click(); a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 30_000)
  return 'downloaded'
}

export async function requestPersistence(): Promise<boolean | null> {
  try {
    if (!navigator.storage?.persist) return null
    if (await navigator.storage.persisted()) return true
    return await navigator.storage.persist()
  } catch { return null }
}

export async function persisted(): Promise<boolean | null> {
  try { return navigator.storage?.persisted ? await navigator.storage.persisted() : null } catch { return null }
}

/** Keeps --kb (keyboard overlap) and --vvh (visible viewport height) CSS vars updated for bottom sheets on iOS. */
export function trackVisualViewport() {
  const vv = window.visualViewport
  const root = document.documentElement
  const update = () => {
    const h = vv ? vv.height : window.innerHeight
    const kb = vv ? Math.max(0, window.innerHeight - vv.height - vv.offsetTop) : 0
    root.style.setProperty('--vvh', `${h}px`)
    root.style.setProperty('--kb', `${kb}px`)
  }
  update()
  vv?.addEventListener('resize', update); vv?.addEventListener('scroll', update)
  window.addEventListener('resize', update)
}

export function isStandalone(): boolean {
  return window.matchMedia?.('(display-mode: standalone)').matches || (navigator as Navigator & { standalone?: boolean }).standalone === true
}
