import { normalize } from './seed'
import type { Product, Subscription } from './types'

const cmpStr = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0)

export function usageCounts(subs: Pick<Subscription, 'productId'>[]): Map<number, number> {
  const m = new Map<number, number>()
  for (const s of subs) m.set(s.productId, (m.get(s.productId) ?? 0) + 1)
  return m
}

/** Favorites first, then used (subscription count desc, >0), then others; ties by name. */
export function sortProducts(products: Product[], subs: Pick<Subscription, 'productId'>[]): Product[] {
  const use = usageCounts(subs)
  const n = (p: Product) => use.get(p.id!) ?? 0
  const group = (p: Product) => (p.isFavorite ? 0 : n(p) > 0 ? 1 : 2)
  return [...products].sort((a, b) => group(a) - group(b) || n(b) - n(a) || cmpStr(a.name, b.name))
}

export function searchKey(s: string): string { return normalize(s).toLowerCase() }

/** Substring match, case- and full/half-width-insensitive (NFKC). Blank query matches all. */
export function matches(p: Pick<Product, 'name'>, query: string): boolean {
  return query.trim() === '' || searchKey(p.name).includes(searchKey(query))
}

export function filterProducts(products: Product[], subs: Pick<Subscription, 'productId'>[], query: string, favoritesOnly: boolean): Product[] {
  return sortProducts(products, subs).filter(p => (!favoritesOnly || p.isFavorite) && matches(p, query))
}
