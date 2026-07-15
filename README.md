# Orchard Ten

一款限时数字水果益智游戏：拖曳一个矩形，框选总和恰好为 **10** 的水果以消除得分。它以轻量、适合手机操作的单页体验为目标。

![Orchard Ten start screen](public/hero.png)

## 玩法

1. 按住鼠标或手指并拖曳，框出一个矩形。
2. 矩形内所有未消除水果的数字总和为 10 时，水果会消除，每颗获得 1 分。
3. 在短时间内连续成功可累积 Combo；无效框选或 Combo 时间结束会中断连击。
4. 每局有 3 次提示。没有可行组合时，可重新排列剩余水果，不会重置分数或时间。

## 功能

- 鼠标、触摸与键盘棋盘操作
- 即时显示总和、所选水果数、差额与成功／超额状态
- 组合技、提示、无解重排、成功/无效音效与可关闭动画
- 一次性新手教学、玩法说明、About、Footer 与清楚的来源揭露
- 本机保存最高分、最近分数、游玩次数、累计消除、Combo、平均分数与设置
- 低刺激模式、`prefers-reduced-motion` 支持、对话框焦点管理、Escape 关闭与移动安全区布局

## 技术结构

- React 19 + TypeScript + Vite
- Reducer 管理游戏状态；`src/game/` 内将棋盘、选择、有效移动、计分、存储和声音逻辑分离
- Vitest 覆盖核心选择、Combo、提示、重排与本地存储容错
- 纯 CSS 构建响应式视觉与动画，避免使用参考网站的素材

```text
src/
  components/       # 画面、对话框、Footer 与交互组件
  game/
    constants.ts        # 可调整规则集中处
    gameReducer.ts      # 回合、计时、Combo、提示与重排 action
    validMoveFinder.ts  # 有效矩形与安全重排
    storage.ts          # 有版本的本地设置与统计服务
    scoring.ts          # 结算与表现评语
```

## 安装与开发

需要 Node.js 20.19+ 或 22.12+。

```bash
npm install
npm run dev
```

开发服务器默认运行在 `http://localhost:5173`。

## 验证

```bash
npm run test
npm run lint
npm run build
```

## 部署

执行 `npm run build` 后，部署 `dist/` 到任意静态托管服务，例如 Vercel、Netlify 或 GitHub Pages。若使用 GitHub Pages，请在 `vite.config.ts` 中配置仓库对应的 `base` 路径。

## 已知限制与后续方向

- 棋盘键盘操作使用方向键与 Enter 选择矩形端点；拖曳仍是最直接的操作方式。
- 数据仅保存于当前浏览器的 localStorage，不会跨设备同步。
- 后续可加入每日挑战、更多棋盘主题与可选的云端排行榜。

## Credits / 参考来源

Core gameplay inspired by [Fruit Box](https://en.gamesaien.com/game/fruit_box/).

This is an independent, unofficial implementation and is not affiliated with or endorsed by the original website or its developers.
