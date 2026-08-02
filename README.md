# Orchard Arcade

Orchard Arcade 是一個包含兩款限時益智遊戲的小型 PWA：

- **Orchard Ten**：在水果棋盤中框選相鄰方格，讓總和恰好等於 10。
- **Color Links**：點擊空格，向上、下、左、右尋找最近色塊，連結至少兩個同色訊號。

兩款遊戲均為獨立原創實作。Orchard Ten 的核心玩法靈感來自 [Fruit Box](https://en.gamesaien.com/game/fruit_box/)；Color Links 的方向搜尋概念受到 [Color Tiles](https://en.gamesaien.com/game/color_tiles/) 啟發。專案不使用參考遊戲的名稱、品牌、版面、美術、字體、音效或素材。

## 資訊架構

```text
/
├─ 遊戲選擇首頁
├─ /games/fruit-sum
└─ /games/color-links
```

路由使用瀏覽器 History API 的輕量封裝，支援直接 URL、重新整理、返回／前進與 PWA navigation fallback。遊戲資料由集中式 `GAME_REGISTRY` 產生首頁卡片及路由，不在多處重複維護。

## 遊戲模式

- 經典模式：120 秒標準節奏，3 次提示。
- Orchard Ten 僅提供經典模式；既有 Classic 成績會持續保留。

## Color Links 規則

- 玩家只能操作空白格；色塊同時使用顏色與 `●`、`◆`、`≋`、`＋`、`✦` 符號識別。
- 點擊後向四個正交方向跨越空白，尋找該方向最近的一個色塊。
- 同色方向達兩個以上時，移除該色組的所有最近色塊。
- 同一次點擊若形成多個獨立色組，所有色組同時移除；每格 1 分，每多一個獨立色組再加 1 分。
- 計時從 00:00 正向累加，清空所有色塊即結算並保存最快完成時間；無效空格點擊加 2 秒。
- 棋盤固定為 17 欄 × 10 列；生成器會評估可行操作數、填充率與單色比例，開局至少保留 12 個有效操作。
- Dead board 會先重新排列剩餘色塊；若最後的殘餘色塊無法再構成操作，系統會自動收束它們並結算，不會重新生成棋盤。

核心規則由 `findNearestTiles`、`findMatchesAtCell`、`findAllValidMoves`、`generateBoard` 與 `evaluateBoardQuality` 等純函式實作。

## 模組劃分

```text
src/
├─ app/                         # registry、History router、首頁
├─ games/
│  ├─ fruit-sum/               # 原有水果遊戲的路由包裝
│  └─ color-links/             # 獨立規則、reducer、UI、音效
├─ shared/
│  ├─ components/              # 平台 header、共用設定
│  └─ storage/                 # 版本化平台資料與遷移
├─ components/                 # Orchard Ten 原有元件
└─ game/                       # Orchard Ten 原有規則與平衡模組
```

Color Links 不共用 Orchard Ten 的 reducer、棋盤狀態或音效主題。平台層只共用導覽、全域音效／動態偏好與各遊戲的摘要進度。

## 本機資料與遷移

- 平台資料使用版本化 key `orchard-arcade-v1`。
- 原有 `orchard-ten-v2` 的 Classic 成績與共用偏好會安全遷移。
- `fruitSum` 與 `colorLinks` 的最高分、場次及最後遊玩時間分開儲存。
- 損壞或未知 JSON 只會觸發欄位正規化／安全預設值，不會讓其中一款遊戲覆蓋另一款。

## PWA 功能

- 支援 Android Chrome 與桌面 Chrome 安裝為獨立 App。
- iPhone／iPad Safari 提供「分享 → 加入主畫面」的手動安裝說明。
- 首次成功載入並完成 Service Worker 安裝後，首頁與平台 shell 可離線使用。遊戲引擎在首次進入該遊戲後以 Cache First 保存，之後可離線重新整理該遊戲 URL。
- 網路中斷與恢復時顯示不遮擋棋盤的狀態提示。
- 新版本下載完成後只顯示更新入口；進行中的回合不會被重新整理。回到首頁或結算後，玩家可選擇立即更新或稍後。
- 遊戲設定與經典模式統計存放在 localStorage，並保有版本化資料遷移、正規化與損壞 JSON 防護；不會放進 Cache Storage。

## 安裝方式

### Android Chrome／桌面 Chrome

先正常開啟網站，然後從首頁的「安裝遊戲」按鈕確認安裝。瀏覽器也可能在網址列或選單提供安裝入口。若玩家關閉原生提示，七天內不會再次主動保存該提示；仍可從瀏覽器選單安裝。

### iPhone／iPad Safari

在 Safari 開啟網站後，點選分享按鈕，選「加入主畫面」，再按「加入」。站內的「安裝遊戲」會只顯示此說明，不會假裝能直接安裝。

## 離線與更新策略

本專案使用 `vite-plugin-pwa` 的 `generateSW` 模式，由 Workbox 依 production build 的輸出自動產生 precache manifest。這比手寫攔截器更容易隨每次 Vite 雜湊檔名更新，並能清除過期快取。

- HTML shell、共用 JS/CSS、本機圖片、SVG 與 App icons：由 precache 採 Cache First。
- `FruitSumGame`、`ColorLinksGame` 及遊戲共用計時 hook：不在首頁安裝時下載，首次進入對應遊戲後才由獨立 runtime cache 保存。
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

# 經典模式生成器；可調整 sample、players、seed
npm run balance:report -- --sample 1000 --players 300 --seed 20260716
```

輸出位於 `reports/balance/`，包含經典模式的品質、難度、解分布、數字頻率、中後期快照、玩家模型、Combo 規則比較及逐棋盤資料。玩家模型只用於版本間的固定參考，不等同真人行為。

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
