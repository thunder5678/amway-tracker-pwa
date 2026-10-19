// Prints sha256 for every file in dist/ (sorted) plus an aggregate digest, for reproducible-build checks.
import { createHash } from 'node:crypto'
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'

const root = new URL('../dist/', import.meta.url).pathname
const walk = d => readdirSync(d).flatMap(f => { const p = join(d, f); return statSync(p).isDirectory() ? walk(p) : [p] })
const lines = walk(root).map(p => `${createHash('sha256').update(readFileSync(p)).digest('hex')}  ${relative(root, p)}`).sort((a, b) => a.slice(66) < b.slice(66) ? -1 : 1)
const agg = createHash('sha256').update(lines.join('\n') + '\n').digest('hex')
console.log(lines.join('\n'))
console.log(`\ndist aggregate sha256: ${agg}`)
