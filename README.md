# 果粒十格 Orchard Ten

一款原創的數字果園益智遊戲。拖曳滑鼠或手指框出連續矩形，當框內水果數字總和剛好是 **10**，它們就會被收成並計分。每局 120 秒，目標是在倒數結束前收成最多水果。

本專案僅受「矩形框選湊數」玩法啟發；名稱、圖示、視覺設計、CSS 水果、動畫與合成音效皆為原創，未使用任何第三方遊戲素材。

## 功能

- 10 × 17 隨機棋盤、170 顆 1–9 的水果；初始總和為 10 的倍數，且保證至少一個有效解。
- 滑鼠、觸控與 Pointer Events 矩形框選；即時高亮與 `n / 10` 總和提示。
- 合法選取消除水果並依顆數加分；空格不下落、不補新水果。
- 開始、暫停、重新開始、結算與 120 秒倒數；最後 10 秒溫和提醒。
- localStorage 儲存最高分、音效開關、淡色低刺激模式。
- CSS 收成／失敗動畫、Web Audio 合成收成音；`prefers-reduced-motion` 自動降低動畫。
- 響應式版面，手機不產生水平捲軸；棋盤可使用方向鍵 + Enter／空白鍵選取，Esc 取消。

## 技術與結構

```text
src/
  components/       # 畫面元件：棋盤、對話框、HUD、設定
  game/
    boardGenerator.ts       # 產生可解且可被 10 整除的盤面
    selectionCalculator.ts  # 矩形正規化、格子取得與加總
    gameReducer.ts          # 可預測的遊戲狀態轉換
    storage.ts              # 最高分 localStorage 邊界
    soundManager.ts         # Web Audio 合成音效
    gameLogic.test.ts       # 核心邏輯單元測試
```

採用 React 19、TypeScript、Vite、一般 CSS（含全域 Design Tokens）與 Vitest。不需要後端、付費 API 或遊戲引擎。

## 安裝與啟動

需要 Node.js 20.19+ 或 22.12+。

```bash
npm install
npm run dev
```

開啟終端輸出的本機網址（預設為 `http://localhost:5173`）。

## 驗證命令

```bash
npm run test
npm run lint
npm run build
```

目前單元測試覆蓋：矩形格子擷取、加總、合法／不合法消除、計分、防重複計分、時間結束鎖定、重開重置、可解盤面、最高分保存，共 10 項。

## 核心演算法

`generateBoard()` 先放入隨機數字，再以兩個 1–9 數字調整總和至 10 的倍數，最後固定放入相鄰的 `1 + 9`，因此不需要昂貴的重試生成也能保證開局可解。

拖曳時先將起訖格做 min/max 正規化，逐行逐列產出矩形格子並加總。放開時 reducer 只有在狀態為 `playing` 且加總等於 10 時才建立新的棋盤陣列、將選取值改為 `null`，並以實際非空格數量增加分數。

## 部署

`npm run build` 會輸出靜態網站至 `dist/`，可直接部署：

- Vercel / Netlify：匯入儲存庫，建置指令填 `npm run build`，輸出資料夾填 `dist`。
- GitHub Pages：將 `dist/` 發布為靜態網站；若部署於子路徑，請在 `vite.config.ts` 加入相應 `base`。

## 已知限制

- 音效由瀏覽器 Web Audio 即時合成；部分行動瀏覽器會在首次使用者互動後才允許播放，這符合其自動播放政策。
- 現階段不儲存進行中的棋盤，只保存最高分。
- 單鍵盤操作以棋盤焦點為入口：方向鍵移動游標，Enter／空白鍵先後設定矩形兩端；並未讓 170 個格子各自成為 Tab 停駐點，避免過長的 Tab 序列。
