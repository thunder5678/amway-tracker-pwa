import type { Product } from './types'

export interface SeedRow { rawName: string; orderCode: string; price: number }
export interface SeedProduct { name: string; orderCode: string; price: number; version: number }

/** Bump when products_seed.csv gains rows with a new seed_version. */
export const CURRENT_SEED_VERSION = 2
export const META_SEED_VERSION = 'seed_products_version'

const stripBom = (t: string) => (t.charCodeAt(0) === 0xfeff ? t.slice(1) : t)
const lines = (t: string) => stripBom(t).split(/\r?\n/).slice(1).filter(l => l.trim() !== '')

export function normalize(s: string): string { return s.normalize('NFKC').trim().replace(/\s+/g, ' ') }

export function splitCsv(line: string): string[] {
  const out: string[] = []; let sb = ''; let q = false
  for (let i = 0; i < line.length; i++) {
    const c = line[i]
    if (q && c === '"' && line[i + 1] === '"') { sb += '"'; i++ }
    else if (c === '"') q = !q
    else if (!q && c === ',') { out.push(sb); sb = '' }
    else sb += c
  }
  out.push(sb); return out
}

/** Curated asset: name,order_code,price_twd,seed_version,source_name */
export function parseCurated(text: string): SeedProduct[] {
  return lines(text).map(l => {
    const f = splitCsv(l)
    return { name: normalize(f[0]), orderCode: f[1].trim(), price: Number(f[2].trim()), version: Number(f[3].trim()) }
  })
}

/** Seed version already applied on this install. */
export function doneVersion(stored: number, legacyFlag = false): number { return Math.max(stored, legacyFlag ? 1 : 0) }

/** Only seeds introduced after the applied version; earlier (possibly deleted) seeds never return. */
export function pending(all: SeedProduct[], done: number): SeedProduct[] { return all.filter(s => s.version > done) }

const DOUBLE = /([-－]?\s*雙(罐|盒|組|包|瓶|支)組?|\s*[xX×]\s*2)\s*$/
const SINGLE = /[-－]?\s*單(罐|盒|組|包|瓶|支)組?\s*$/

export function isDouble(raw: string): boolean { return DOUBLE.test(normalize(raw)) }

const removePrefix = (s: string, p: string) => (s.startsWith(p) ? s.slice(p.length) : s)
const before = (s: string, d: string) => { const i = s.indexOf(d); return i < 0 ? s : s.slice(0, i) }

/** Strip leading 紐崔萊/長客 and trailing single/double pack suffix; NFKC (４５０ｇ→450g). */
export function cleanName(raw: string): string {
  let s = normalize(raw)
  s = before(before(s, '｜'), '|').trim()
  s = removePrefix(removePrefix(removePrefix(s, '紐崔萊').trim(), '長客').trim(), '單罐')
  s = removePrefix(s, '單盒').trim()
  s = s.replace(SINGLE, '').replace(DOUBLE, '').trim().replace(/[-－]+$/, '').trim()
  return s
}

export function parseRaw(text: string): SeedRow[] {
  return lines(text).flatMap(l => {
    const f = splitCsv(l)
    const p = f[2]?.trim()
    if (!p || !/^-?\d+$/.test(p)) return []
    return [{ rawName: f[0], orderCode: (f[1] ?? '').trim(), price: Number(p) }]
  })
}

/** Non-double rows, cleaned, deduped by name (first wins). */
export function singles(rows: SeedRow[]): SeedProduct[] {
  const seen = new Map<string, SeedProduct>()
  for (const r of rows.filter(r => !isDouble(r.rawName))) {
    const n = cleanName(r.rawName)
    if (n && !seen.has(n)) seen.set(n, { name: n, orderCode: r.orderCode, price: r.price, version: 1 })
  }
  return [...seen.values()]
}

/** Seeds to insert: skip any whose normalized name matches an existing product (or an earlier seed). Never touches existing rows. */
export function toInsert(seeds: SeedProduct[], existing: Pick<Product, 'name'>[]): Product[] {
  const have = new Set(existing.map(p => normalize(p.name)))
  const out: Product[] = []
  for (const s of seeds) {
    const k = normalize(s.name)
    if (have.has(k)) continue
    have.add(k); out.push({ name: s.name, unitPrice: s.price, isFavorite: false })
  }
  return out
}
