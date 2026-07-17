# Orchard Ten

Orchard Ten 是一款兩分鐘數字益智遊戲：在水果棋盤中框選相鄰方格，讓總和恰好等於 10，並挑戰連擊與最高分。這是獨立原創實作；玩法靈感來自 Fruit Box，但不使用其品牌或素材。

## PWA 功能

- 支援 Android Chrome 與桌面 Chrome 安裝為獨立 App。
- iPhone／iPad Safari 提供「分享 → 加入主畫面」的手動安裝說明。
- 首次成功載入並完成 Service Worker 安裝後，首頁、遊戲、說明、設定、結算畫面、本機圖片與圖示可離線使用。
- 網路中斷與恢復時顯示不遮擋棋盤的狀態提示。
- 新版本下載完成後只顯示更新入口；進行中的回合不會被重新整理。回到首頁或結算後，玩家可選擇立即更新或稍後。
- 遊戲設定與統計仍存放在 localStorage，並保有版本化資料正規化與損壞 JSON 防護；不會放進 Cache Storage。

## 安裝方式

### Android Chrome／桌面 Chrome

先正常開啟網站，然後從首頁的「安裝遊戲」按鈕確認安裝。瀏覽器也可能在網址列或選單提供安裝入口。若玩家關閉原生提示，七天內不會再次主動保存該提示；仍可從瀏覽器選單安裝。

### iPhone／iPad Safari

在 Safari 開啟網站後，點選分享按鈕，選「加入主畫面」，再按「加入」。站內的「安裝遊戲」會只顯示此說明，不會假裝能直接安裝。

## 離線與更新策略

本專案使用 `vite-plugin-pwa` 的 `generateSW` 模式，由 Workbox 依 production build 的輸出自動產生 precache manifest。這比手寫攔截器更容易隨每次 Vite 雜湊檔名更新，並能清除過期快取。

- HTML shell、打包後 JS/CSS、本機圖片、SVG 與 App icons：由 precache 採 Cache First。
- 同站內導覽：使用 Workbox navigation fallback 回到同一份 App shell，網路失敗時仍可離線啟動。
- 本機音效（若日後加入）：納入 build 輸出後會隨 precache 一起下載。
- 外部連結、分析服務與參考網站：沒有 runtime caching 規則，因此不會被 Service Worker 快取或攔截。

Service Worker 採 prompt 更新模式，不使用 `skipWaiting` 或 `clientsClaim` 強制換版。玩家選「立即更新」後才會啟用等待中的版本並重新載入。

## 開發與測試

```bash
npm install
npm run dev
npm run test
npm run lint
npm run build
npm run preview
```

### 平衡分析工具

平衡工具只在本機／開發環境執行，不會上傳棋盤或玩家資料。所有報告使用可重現 seed，並可輸出逐棋盤 JSON 與 CSV：

```bash
# 凍結版舊生成器：1,000 棋盤基準與 3 種玩家模型
npm run balance:baseline

# 新生成器；可調整 sample、players、seed、mode
npm run balance:report -- --sample 1000 --players 300 --seed 20260716 --mode classic
```

`mode` 支援 `classic`、`quick`、`zen`、`hard`。輸出位於 `reports/balance/`，包含品質、難度、解分布、數字頻率、中後期快照、玩家模型、Combo 規則比較及逐棋盤資料。玩家模型只用於版本間的固定參考，不等同真人行為。

PWA 必須以 production build 驗證，因為開發伺服器預設不註冊 Service Worker：

```bash
npm run build
npm run preview -- --host 127.0.0.1
```

在 Chrome DevTools 的 Application 面板檢查 Manifest、Service Workers 與 Cache Storage；首次線上載入完成後，勾選 Network 的 Offline 並重新整理，接著開始並完成一局。確認外部 `Fruit Box` 連結仍正常開啟，且 Cache Storage 沒有第三方網域。

若需要重設 PWA 快取：在 DevTools Application → Storage 選「Clear site data」，或在瀏覽器的網站設定清除儲存空間。此操作也會清除 localStorage 的遊戲統計，請先提醒玩家。

## 部署 base path

預設 `base` 是 `/`，適用於 Vercel、Netlify 或 GitHub Pages 的自訂網域根目錄。若部署在 GitHub Pages 專案子路徑，請在 build 時設定結尾帶 `/` 的 `VITE_BASE_PATH`：

```bash
VITE_BASE_PATH=/repository-name/ npm run build
```

Vite、manifest 的 `start_url`／`scope`、Service Worker navigation fallback 與所有 icon 路徑都會使用同一個 base，因此不會註冊在錯誤 scope 或載入根目錄資源。
