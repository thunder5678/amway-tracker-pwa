// Headless smoke test: iPhone viewport (Chromium emulation), real production build via `vite preview`.
// Usage: npm run build && node scripts/smoke.mjs [baseUrl]
import { chromium, devices } from 'playwright'
import { spawn } from 'node:child_process'
import { mkdirSync, readFileSync } from 'node:fs'

const shots = new URL('../screenshots/', import.meta.url).pathname
mkdirSync(shots, { recursive: true })
let server
let base = process.argv[2]
if (!base) {
  server = spawn('npx', ['vite', 'preview', '--port', '4173', '--strictPort'], { stdio: 'ignore' })
  base = 'http://localhost:4173/amway-tracker-pwa/'
  for (let i = 0; i < 50; i++) { try { if ((await fetch(base)).ok) break } catch {} await new Promise(r => setTimeout(r, 200)) }
}
const origin = new URL(base).origin
const fails = []
const check = (ok, msg) => { console.log((ok ? '  ✓ ' : '  ✗ ') + msg); if (!ok) fails.push(msg) }

const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH || undefined })
const ctx = await browser.newContext({ ...devices['iPhone 13'], locale: 'zh-TW', timezoneId: 'Asia/Taipei', colorScheme: 'light' })
const page = await ctx.newPage()
const foreign = []
page.on('request', r => { if (!r.url().startsWith(origin) && !r.url().startsWith('blob:') && !r.url().startsWith('data:')) foreign.push(r.url()) })
page.on('pageerror', e => fails.push('pageerror: ' + e.message))
await page.clock.setFixedTime(new Date('2026-10-27T10:00:00+08:00'))
const shot = n => page.screenshot({ path: shots + n, animations: 'disabled' })
const sheet = () => page.locator('.sheet').last()
const tab = n => page.locator('.tabbar').getByRole('button', { name: n }).click()

await page.goto(base)
await page.getByText('還沒有任何訂閱').waitFor()
check(await page.getByText('即時計算').count() === 1, 'stats empty state, live label')
await shot('01-empty-stats.png')

// products seeded once (70)
await tab('產品')
await page.getByText('70 項').waitFor()
check(true, '70 default products seeded')

// first customer via stats empty state → 新增第一筆 opens customer sheet
await tab('統計')
await page.getByRole('button', { name: '新增第一筆' }).click()
await sheet().locator('input').first().fill('王小明')
await sheet().getByRole('button', { name: '儲存' }).click()
await tab('客戶')
await page.getByRole('button', { name: '新增', exact: true }).click()
await sheet().locator('input').first().fill('林美華')
await sheet().getByRole('button', { name: '儲存' }).click()
check(await page.locator('.card .title', { hasText: '王小明' }).count() === 1, 'customers created')

async function addSub(customer, query, day, plus = 0) {
  await tab('訂閱')
  const empty = page.getByRole('button', { name: '新增第一筆' })
  if (await empty.count()) await empty.click(); else await page.getByRole('button', { name: '新增', exact: true }).click()
  await sheet().locator('select').selectOption({ label: customer })
  await sheet().locator('.picker').click()
  await page.locator('.picker-sheet input[type=search]').fill(query)
  await page.locator('.picker-sheet .pick-item').first().click()
  for (let i = 0; i < plus; i++) await sheet().getByRole('button', { name: '增加' }).click()
  await sheet().getByLabel('每月扣款日（1–31）*').fill(String(day))
  await sheet().getByLabel('開始日期').fill('2026-10-01')
  await sheet().getByRole('button', { name: '儲存' }).click()
}
await addSub('王小明', '蛋白素', 28, 1)     // 10/28 upcoming
await addSub('王小明', 'ＤＸ', 1)          // 11/1 cross-month upcoming (full-width search)
await addSub('林美華', '魚油', 15)          // 10/15 already debited
await addSub('林美華', '鈣', 31, 2)         // 10/31 upcoming
await page.locator('.sub-card').nth(3).waitFor()
check(await page.locator('.sub-card').count() === 4, '4 subscriptions created')
await shot('02-subscriptions.png')

await tab('統計')
const up = page.getByTestId('upcoming')
await up.waitFor()
const upText = await up.innerText()
check(upText.includes('11/1') && upText.includes('10/28') && upText.includes('10/31'), 'upcoming 7 days crosses month (10/28, 10/31, 11/1)')
check(!upText.includes('已扣款'), 'upcoming items are all 待扣款')
await shot('03-stats.png')

// favorites
await tab('產品')
await page.getByRole('button', { name: '加入最愛' }).nth(3).click()
await page.getByRole('button', { name: '取消最愛' }).waitFor()
await page.getByRole('button', { name: '最愛', exact: true }).click()
check(await page.locator('.prod-row').count() === 1, 'favorite filter')
await page.getByRole('button', { name: '全部', exact: true }).click()
await page.locator('.search input').fill('ｄｘ')
check(await page.locator('.prod-row').count() >= 1, 'full-width/case-insensitive search')
await shot('04-products.png')
await page.locator('.search input').fill('')
// product in use cannot be deleted
await page.locator('.prod-row', { hasText: '使用中訂閱' }).first().locator('.prod-main').click()
check(await sheet().getByText('仍有訂閱使用，無法刪除').count() === 1 && await sheet().getByRole('button', { name: '刪除產品' }).count() === 0, 'in-use product not deletable')
await sheet().getByRole('button', { name: '取消' }).click()

// cascading delete confirmation shows count
await tab('客戶')
await page.locator('.card', { hasText: '王小明' }).click()
await page.getByRole('button', { name: '編輯客戶' }).click()
await sheet().getByRole('button', { name: '刪除客戶（含其訂閱）' }).click()
const dlg = await page.locator('.dialog p').innerText()
check(dlg.includes('2 筆訂閱'), 'delete confirm lists 2 subscriptions')
await shot('05-delete-confirm.png')
await page.locator('.dialog').getByRole('button', { name: '取消' }).click()
await sheet().getByRole('button', { name: '取消' }).click()

// huge amounts: NT$99,999,999 must not be clipped (autosize)
await tab('產品')
await page.locator('.prod-row', { hasText: '使用中訂閱' }).first().locator('.prod-main').click()
await sheet().getByLabel('單價（NT$）*').fill('99999999')
await sheet().getByRole('button', { name: '儲存' }).click()
await tab('統計')
await page.setViewportSize({ width: 320, height: 700 })
await page.waitForTimeout(300)
const clipped = await page.evaluate(() => [...document.querySelectorAll('.fit')].filter(o => {
  const i = o.firstElementChild.getBoundingClientRect(), r = o.getBoundingClientRect()
  return i.right > r.right + 1 || i.left < r.left - 1
}).map(o => o.textContent))
check(clipped.length === 0, 'no clipped amounts at 320px width ' + JSON.stringify(clipped))
await shot('06-huge-amounts-320px.png')
await page.setViewportSize({ width: 430, height: 900 })
await page.waitForTimeout(300)
const grown = await page.evaluate(() => { const i = document.querySelector('.stat-card.wide .fit-inner'); return i.style.transform || 'none' })
check(true, 'autosize at 430px: ' + grown)
await page.setViewportSize(devices['iPhone 13'].viewport)

// dark mode
await page.emulateMedia({ colorScheme: 'dark' })
await shot('07-stats-dark.png')
await page.emulateMedia({ colorScheme: 'light' })

// service worker + offline
const sw = await page.evaluate(async () => { const r = await navigator.serviceWorker.ready; return !!r.active })
check(sw, 'service worker active')
await page.reload(); await page.getByText('本月總額').waitFor()
check(await page.evaluate(() => !!navigator.serviceWorker.controller), 'page controlled by service worker')
await ctx.setOffline(true)
await page.reload(); await page.getByText('本月總額').waitFor()
check(true, 'app loads offline')
await ctx.setOffline(false)

// month end → snapshot on open, past month read-only
await page.clock.setFixedTime(new Date('2026-11-03T09:00:00+08:00'))
await page.reload(); await page.getByText('本月總額').waitFor()
await page.getByLabel('選擇統計日期').fill('2026-10-31')
await page.getByText('月結快照（唯讀）').waitFor()
check(await page.getByTestId('upcoming').count() === 0, 'past month shows 月結快照 and no upcoming')
await shot('08-snapshot-october.png')

// backup sheet
await page.getByRole('button', { name: '資料與備份' }).click()
check(await sheet().getByText('匯出完整備份（JSON）').count() === 1, 'backup sheet')
await shot('09-backup.png')
const [dl] = await Promise.all([page.waitForEvent('download'), sheet().getByRole('button', { name: '匯出完整備份（JSON）' }).click()])
const backupPath = shots + '../test-results/backup.json'
mkdirSync(shots + '../test-results', { recursive: true })
await dl.saveAs(backupPath)
const [dl2] = await Promise.all([page.waitForEvent('download'), sheet().getByRole('button', { name: '匯出訂閱清單 CSV' }).click()])
const csvBytes = readFileSync(await dl2.path())
check(csvBytes[0] === 0xef && csvBytes[1] === 0xbb && csvBytes[2] === 0xbf && csvBytes.toString('utf8').includes('王小明'), 'subscriptions CSV download has UTF-8 BOM')
await sheet().getByRole('button', { name: '關閉' }).click()

// restore into a fresh install (separate storage)
const ctx2 = await browser.newContext({ ...devices['iPhone 13'], locale: 'zh-TW', timezoneId: 'Asia/Taipei' })
const p2 = await ctx2.newPage()
await p2.clock.setFixedTime(new Date('2026-11-03T09:00:00+08:00'))
await p2.goto(base); await p2.getByText('還沒有任何訂閱').waitFor()
await p2.getByRole('button', { name: '資料與備份' }).click()
await p2.locator('input[type=file]').setInputFiles(backupPath)
const msg = await p2.locator('.dialog p').innerText()
check(msg.includes('客戶 2 位') && msg.includes('訂閱 4 筆') && msg.includes('月結快照 1 個月'), 'restore confirm shows counts')
await p2.locator('.dialog').getByRole('button', { name: '還原' }).click()
await p2.getByText('本月總額').waitFor()
await p2.getByLabel('選擇統計日期').fill('2026-10-31')
await p2.getByText('月結快照（唯讀）').waitFor()
const t1 = await page.locator('.stat-card.wide').innerText(), t2 = await p2.locator('.stat-card.wide').innerText()
check(t1 === t2, 'restored snapshot total matches original: ' + t2.replace(/\s+/g, ' '))
await ctx2.close()

// subscription form screenshot
await tab('訂閱')
await page.locator('.sub-card').first().click()
await shot('10-subscription-form.png')
await sheet().getByRole('button', { name: '取消' }).click()

const man = await (await page.request.get(base + 'manifest.webmanifest')).json()
check(man.display === 'standalone' && man.name === '安麗長客統計', 'manifest standalone')
check(foreign.length === 0, 'no third-party network requests ' + JSON.stringify(foreign))

await browser.close(); server?.kill()
console.log(fails.length ? `\nFAILED: ${fails.length}` : '\nSMOKE OK')
process.exit(fails.length ? 1 : 0)
