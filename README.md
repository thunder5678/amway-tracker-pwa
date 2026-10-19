# 安麗長客統計 PWA（amway-tracker-pwa）

iPhone 可用的離線網頁 App（PWA）：管理安麗長期訂購客戶、產品與每月扣款，統計當月已扣款／剩餘／總額，過去月份以月結快照保存，並可匯出 CSV 與完整備份。
功能對齊 Android 版 v0.2.1。

- **開啟網址**：<https://thunder5678.github.io/amway-tracker-pwa/>
- TypeScript · React · Vite · IndexedDB（Dexie）· Service Worker（vite-plugin-pwa / Workbox）
- 所有資料只存在你的裝置瀏覽器（IndexedDB），**不會上傳**；App 除了載入自身檔案外不連任何網路、沒有分析追蹤
- 規格：[docs/MVP_SPEC.md](docs/MVP_SPEC.md)・驗收清單（草案）：[docs/AC_CHECKLIST.md](docs/AC_CHECKLIST.md)・經驗教訓：[docs/LESSONS.md](docs/LESSONS.md)

## 安裝到 iPhone 主畫面
1. 用 **Safari** 開啟 <https://thunder5678.github.io/amway-tracker-pwa/>（必須是 Safari；iOS 16.4 起 Chrome/Edge 也可，但建議 Safari）。
2. 點下方工具列的 **分享** 按鈕（方框加向上箭頭）。
3. 往下捲，點 **加入主畫面**。
4. 名稱保留「長客統計」，點右上角 **新增**。
5. 從主畫面的「長客統計」圖示開啟：全螢幕顯示、可離線使用。

> 第一次開啟後，App 會自動快取；之後沒有網路也能開。
> 主畫面 App 與 Safari 分頁的資料是**分開**的，請固定從主畫面圖示使用。

## 資料備份（重要）
瀏覽器的資料可能因「清除 Safari 歷史記錄與網站資料」、刪除主畫面 App、或儲存空間不足而被清除。
- 右上角「⋮」→ **資料與備份** → **匯出完整備份（JSON）** → 存到「檔案」App 或傳給自己。建議每月月初匯出一次。
- 換手機或資料遺失時：同一處點 **從備份檔還原…** 選擇備份檔（會先顯示筆數並確認，會取代目前資料）。
- App 啟動時會向瀏覽器要求「持久儲存」（`navigator.storage.persist()`），狀態顯示在同一頁。

## 開發
```bash
nvm use            # Node 20.19（見 .nvmrc）
npm ci
npm test           # Vitest 單元測試（計算、快照、預設產品、排序搜尋、格式、CSV、備份）
npm run build      # 產出 dist/（base 為 /amway-tracker-pwa/）
npm run preview    # http://localhost:4173/amway-tracker-pwa/
npm run smoke      # 需先 build；Playwright 以 iPhone 視窗跑煙霧測試並存截圖到 screenshots/
npm run hash       # 列出 dist/ 各檔 sha256 與總和（可重現建置比對）
```
`npm run icons` 會由 `scripts/icon.svg.mjs` 重新產生 `public/icons/*.png`（產物已提交，一般建置不需要）。
Playwright 若沒有下載瀏覽器，可設定 `CHROME_PATH=/usr/bin/google-chrome`。

## 部署
目前：GitHub Pages 由 `gh-pages` 分支提供。每個版本從**乾淨 checkout**（`git clone` 指定 tag）執行 `npm ci → npm test → npm run build`，把 `dist/` 推到 `gh-pages`；版本 tag 的說明記錄 commit 與 `npm run hash` 的 dist sha256，可用同樣步驟重現比對。
```bash
git clone --branch v0.1.0 https://github.com/thunder5678/amway-tracker-pwa.git && cd amway-tracker-pwa
npm ci && npm test && npm run build && npm run hash   # 與 tag 說明中的 aggregate sha256 比對
```
GitHub Actions 工作流程已備妥於 `ci/github-pages.yml`（從乾淨 checkout 測試、建置、部署並在 Summary 列出 sha256）。
建立 repo 時使用的權杖沒有 `workflow` 權限，無法推送 `.github/workflows/`；要改用 Actions：把它移到 `.github/workflows/pages.yml` 推送，並在 Settings → Pages 將 Source 改為 **GitHub Actions**。

## 版本
- v0.1.0：首個 PWA 版本，功能對齊 Android v0.2.1；新增完整備份匯出／還原（JSON）、持久儲存要求、iPhone 安全區域與主畫面安裝支援。
