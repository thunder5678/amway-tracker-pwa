// Regenerates public/icons/*.png from scripts/icon.svg.mjs using a headless Chromium (Playwright).
// Output PNGs are committed, so normal builds do not depend on this script.
import { chromium } from 'playwright'
import { writeFileSync } from 'node:fs'
import { iconSvg } from './icon.svg.mjs'

const out = new URL('../public/icons/', import.meta.url)
writeFileSync(new URL('favicon.svg', out), iconSvg())
const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH || undefined })
const page = await browser.newPage()
async function png(name, size, opts) {
  await page.setViewportSize({ width: size, height: size })
  await page.setContent(`<html><body style="margin:0;background:transparent">${iconSvg(opts).replace('width="512" height="512"', `width="${size}" height="${size}"`)}</body></html>`)
  writeFileSync(new URL(name, out), await page.locator('svg').screenshot({ omitBackground: true }))
}
await png('icon-192.png', 192, {})
await png('icon-512.png', 512, {})
await png('icon-maskable-512.png', 512, { maskable: true })
await png('apple-touch-icon.png', 180, { rounded: false }) // iOS applies its own corner mask
await browser.close()
console.log('icons written')
