# Orchard Arcade

Orchard Arcade 是一個包含四款手機友善遊戲的 PWA：

- **Orchard Ten**：在水果棋盤中框選相鄰方格，讓總和恰好等於 10。
- **Color Links**：點擊空格，向上、下、左、右尋找最近色塊，連結至少兩個同色訊號。
- **芽芽小島**：點擊陽光、種植精靈、合成同級居民，透過遠航累積永久產量加成。沒有倒數與失敗條件。
- **灰燼墓誌（Ashbound）**：原創暗黑地城 Roguelite，三職業、分岔探索、技能冷卻、隨機遺物與死亡傳承，挑戰無盡地城與每五層的首領。

遊戲均為獨立原創實作。Orchard Ten 的核心玩法靈感來自 [Fruit Box](https://en.gamesaien.com/game/fruit_box/)；Color Links 的方向搜尋概念受到 [Color Tiles](https://en.gamesaien.com/game/color_tiles/) 啟發；灰燼墓誌的分岔探索與技能選擇式戰鬥受到 [Buriedbornes](https://nussygame.com/en/bb1/about/) 啟發。專案不使用參考遊戲的品牌、版面、美術、字體、音效或素材。

## 資訊架構

```text
/
├─ 遊戲選擇首頁
├─ /games/fruit-sum
├─ /games/color-links
├─ /games/sprout-island
└─ /games/ashbound
```

路由使用瀏覽器 History API 的輕量封裝，支援直接 URL、重新整理、返回／前進與 PWA navigation fallback。遊戲資料由集中式 `GAME_REGISTRY` 產生首頁卡片及路由，不在多處重複維護。

## 遊戲模式

### 灰燼墓誌

- 三個可直接選擇的職業：守墓人、燼火巫、渡魂者；每職業五個起始技能，八種技能可構成重擊、防禦、中毒、汲取與斬殺流派。
- 無盡地城，沒有回合或層數上限，每層三室。每步二選一，包含戰鬥、精英、營地、祭壇與寶箱；每五層最後一室必須挑戰首領，每十層迎戰無晝之王。擊敗後取得戰利品並繼續深入；敵人與遺物隨層數成長。
- 敵人的下次攻擊可見，每第三回合為重擊；有效技能行動後敵人反擊一次。技能冷卻按其他行動遞減、跨戰鬥保留，斬擊始終可用。沒有即時倒數。
- 中毒每層造成 3 傷害，持續整場戰鬥；獵犬的腐蝕增加承傷，餘燼癒合可清除。守夜當回合減傷 80%。
- 武器、護甲、遺物各一格。戰利品提供新舊數值比較，可替換或放棄；技能記憶可替換斬擊以外的技能。一般戰鬥提供 1 經驗，精英／首領 2，滿 3 升級並回復 30% 生命。
- 死亡或主動結束後失去本次裝備與等級，保留 `擊敗數 × 2 + 層數` 魂燼，每擊敗一次無晝之王，結算額外 +25。魂燼可購買五級永久傳承，每級 +5 生命、+1 攻擊。
- 第 11 層起，敵人的基礎生命額外增加 `(層數 − 10) × 2%`，攻擊額外增加 `round((層數 − 10) × 1.2)%`。每次新遭遇都帶有進門前可見的特性：破甲（重擊忽略 50% 護甲）、枯萎（戰鬥回血 −30%）或骨鎧（直接承傷 −20%，不影響毒素）。
- 深層交戰第 9 回合開始狂怒，當回合攻擊 +15%，之後每回合再 +15%，切換房間歸零。沒有強制死亡回合；戰鬥仍由生命、傷害與技能決定。
- 深層汲取以實際傷害計算回血，單次最多 15% 最大生命；裝備命中回血另計，枯萎套用於合計回血。毒素每層每回合傷害為 `max(3, floor(攻擊 × 6%))`。前十層維持原規則，營地、升級和首領戰後回血不受枯萎影響。舊存檔正在交戰的敵人保留原數值與規則，下次遭遇才套用新規則。
- 可執行 `npm run balance:ashbound -- balanced 100` 重現 1,200 次固定種子遠征；結果與方法見 [深層平衡報告](reports/ashbound/README.md)。
- 使用獨立的 `orchard-ashbound-v1` 版本化本機存檔，每次行動自動保存，可返回遊戲廳或重新整理續玩；相容舊版十層存檔，已通關的舊遠征保留結算；未知／損壞資料安全回退。清除網站資料會刪除進度。
- 無外部素材或網路服務依賴，SVG 角色為原創向量插畫。支援手機、鍵盤、玩法說明、結束確認與存檔失敗提示。
- `src/games/ashbound/model.test.ts` 驗證戰鬥、裝備取捨、傳承與存檔；另以三職業各 20 個固定種子模擬遠征至第 11 層或死亡，確認前十層可突破且每步可重載；另驗證深層進度與存檔。平台整合測試涵蓋進出遊戲與續玩。

### 芽芽小島

- 12 格小島；點選兩隻同級精靈即可合成，支援觸控與鍵盤按鈕操作。
- 精靈每秒自動生產陽光；升級種子可直接種出更高級居民。滿格時可合成或確認送行。
- 島上最高等級達 Lv. 8 可遠航；重置居民、陽光與種子，保留最高紀錄與星星。每顆星永久增加 1 倍產量，可反覆累積。
- `orchard-sprout-island-v1` 獨立本機存檔，背景與離線收益最多累積 8 小時；清除瀏覽器資料會移除進度。
- 資源及永久星星使用 BigInt，避免成長數值超出 Number 精度。尊重系統與平台減少動態效果設定。

### Orchard Ten

- 經典模式：120 秒標準節奏，3 次提示。
- Orchard Ten 僅提供經典模式；既有 Classic 成績會持續保留。

## Color Links 規則

- 玩家只能操作空白格；色塊同時使用顏色與 `●`、`◆`、`≋`、`＋`、`✦` 符號識別。
- 點擊後向四個正交方向跨越空白，尋找該方向最近的一個色塊。
- 同色方向達兩個以上時，移除該色組的所有最近色塊。
- 同一次點擊若形成多個獨立色組，所有色組同時移除；每格 1 分，每多一個獨立色組再加 1 分。
- 每局有 30 秒倒數。時限內清空所有色塊會保存最快完成時間；時間到仍未清空時，保存該局消除色塊數的最高紀錄。無效空格點擊扣 2 秒。
- 棋盤固定為 17 欄 × 10 列；生成器會評估可行操作數、填充率與單色比例，開局至少保留 12 個有效操作。
- Dead board 會先重新排列剩餘色塊；若最後的殘餘色塊無法再構成操作，系統會自動收束它們並結算，不會重新生成棋盤。

核心規則由 `findNearestTiles`、`findMatchesAtCell`、`findAllValidMoves`、`generateBoard` 與 `evaluateBoardQuality` 等純函式實作。

## 模組劃分

```text
src/
├─ app/                         # registry、History router、首頁
├─ games/
│  ├─ fruit-sum/               # 原有水果遊戲的路由包裝
│  ├─ color-links/             # 獨立規則、reducer、UI、音效
│  ├─ sprout-island/           # 放置成長、合成與遠航
│  └─ ashbound/                # 地城狀態機、回合戰、存檔與 UI
├─ shared/
│  ├─ components/              # 平台 header、共用設定
│  └─ storage/                 # 版本化平台資料與遷移
├─ components/                 # Orchard Ten 原有元件
└─ game/                       # Orchard Ten 原有規則與平衡模組
```

Color Links 不共用 Orchard Ten 的 reducer、棋盤狀態或音效主題。平台層只共用導覽、全域音效／動態偏好與各遊戲的摘要進度。

## Neon 線上排行榜

遊戲結束後自動檢查榜單，暫列前 10 名時可自選填寫 1–20 字的公開名字並登錄。首頁的「查看線上排行榜」可切換榜單；不需註冊或登入。

| 榜單 | 成績與排序 |
| --- | --- |
| Orchard Ten 經典 | 分數越高越前面 |
| Color Links 最快清空 | 僅清空回合，遊戲計算的秒數越低越前面（含失誤扣秒） |
| Color Links 逾時消除 | 僅未清空回合，消除格數越高越前面 |
| 灰燼墓誌單次魂燼 | 擊敗數 × 2 + 層數 + 弒王次數 × 25；含永久傳承的遠征 |

同分由較早登錄者優先。榜單未滿時，零分也可入榜；最快清空可為 0 秒。芽芽小島沒有結束條件，維持本機進度。每局成績可佔一名，同名不合併。榜單顯示目前前 10 名，資料庫保留曾經成功登錄的成績以處理重試。

### 本機設定與資料庫初始化

1. 在 Neon 建立 Postgres 資料庫，複製其連線字串。
2. 複製 `.env.example` 成 `.env.local`，填入 `DATABASE_URL`。**不得使用 `VITE_DATABASE_URL`**，避免密碼進入瀏覽器。
3. 執行 `npm run db:migrate`，建立 `database/001_leaderboards.sql` 中的資料表、索引與登錄函式。可重複執行；不會清空現有紀錄。
4. 執行 `npm run dev`；Vite 已提供 `/api/leaderboard` 的本機後端。`npm run preview` 也支援同一 API。

升級灰燼墓誌無盡遠征時，既有資料庫也需重新執行 `npm run db:migrate`，解除舊有 95 魂燼限制並保留排行榜紀錄。排行榜沿用 PostgreSQL integer，單次分數最高支援 2,147,483,647；遊戲進度不受此榜單範圍限制。

資料庫連線只存在後端，使用 [Neon serverless driver](https://github.com/neondatabase/serverless)。`DATABASE_URL` 未設定或連線失敗時，畫面顯示重試提示，原本遊戲與本機紀錄仍可使用。離線結算不會偷偷排隊上傳；需在結算畫面恢復連線後重試。

### 部署（預設 Vercel）

- Vercel 使用 Vite 專案設定，build 為 `npm run build`、輸出 `dist`；`api/leaderboard.ts` 是 [Node.js Web Handler](https://vercel.com/docs/functions/runtimes/node-js)。
- 根目錄 `tsconfig.json` 另外設定 NodeNext 與 `rewriteRelativeImportExtensions`，讓 Vercel 編譯後的相對匯入指向 `.js`。Vercel 不會自動套用 Vite 的 TypeScript project references；`npm run build` 會以獨立 Node 程序檢查編譯後的 API 能否啟動，亦可單獨執行 `npm run check:api-build`。
- 在 Vercel 的環境變數設定 `DATABASE_URL`，並先對相同資料庫執行 `npm run db:migrate`，再部署。Preview 建議使用獨立的 Neon branch。
- `vercel.json` 保留遊戲路由的 SPA fallback；`/api/` 不會進入 Service Worker navigation fallback，也不快取排行榜。
- 純 GitHub Pages／只上傳 `dist` 的靜態主機不能執行 API；其他平台需將 `server/leaderboard.ts` 的 Request/Response handler 接到同源 `/api/leaderboard`，並設定伺服器環境變數。

### 排名一致性與限制

`GET /api/leaderboard?board=fruit-classic&score=50` 查榜及暫定資格；`POST /api/leaderboard` 接收 `{ board, score, name, submissionId }`。伺服器驗證榜單、整數範圍、名字與 UUID；資料庫以每榜 advisory transaction lock 在同一交易內重新判定資格、插入並回傳最新榜單。若填寫時被擠出前 10 名，不會寫入或顯示成功。UUID 唯一鍵讓網路重試不會重複登錄，同一 UUID 不可改名或改分。

目前是匿名、信任客戶端分數的休閒排行榜；範圍驗證與入榜判斷不等於防作弊，也沒有帳號唯一性、完整遊戲重播驗證或流量限制。有競賽需求時需另加伺服器驗證與平台限流。測試使用 PGlite 執行同一份 Postgres schema；不代表已驗證真實 Neon 連線或跨連線鎖競爭。

## 本機資料與遷移

- 平台資料使用版本化 key `orchard-arcade-v1`。
- 原有 `orchard-ten-v2` 的 Classic 成績與共用偏好會安全遷移。
- `fruitSum` 與 `colorLinks` 的最高分、場次及最後遊玩時間分開儲存。
- 損壞或未知 JSON 只會觸發欄位正規化／安全預設值，不會讓其中一款遊戲覆蓋另一款。

## PWA 功能

- 支援 Android Chrome 與桌面 Chrome 安裝為獨立 App。
- iPhone／iPad Safari 提供「分享 → 加入主畫面」的手動安裝說明。
- 首次成功載入並完成 Service Worker 安裝後，首頁、平台 shell 與四款遊戲的 JS/CSS 已預先快取，可離線進入或重新整理各遊戲 URL。
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
- 四款遊戲模組與共用 hook：程式碼依路由延遲執行，Service Worker 安裝時會預先快取全部 build 輸出，以便首次離線進入遊戲。
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
