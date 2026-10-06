import { useState } from 'react'
import { LeaderboardDialog } from '../shared/leaderboard/LeaderboardDialog'
import { GAME_REGISTRY, type GameDefinition } from './gameRegistry'
import type { AppStorage } from '../shared/storage/appStorage'
import { AppHeader } from '../shared/components/AppHeader'
import './home.css'

const GAME_CATEGORIES = { fruitSum: '動動腦', colorLinks: '動動腦', slideTen: '動動腦', sproutIsland: '慢慢養', ashbound: '去冒險' } as const
const FILTERS = ['全部遊戲', '動動腦', '慢慢養', '去冒險'] as const
const HERO_FRUIT = [2, 4, 6, 3, 1, 5, 1, 3, 2, 7, 4, 8, 6, 2, 9, 3, 5, 1, 4, 6, 7, 2, 8, 3, 1]

function ArcadePreview() {
  return (
    <div className="arcade-preview" aria-hidden="true">
      <div className="arcade-window-bar"><span><i /><i /><i /></span><span>ORCHARD TEN</span><span>01 / {String(GAME_REGISTRY.length).padStart(2, '0')}</span></div>
      <div className="arcade-window-body">
        <div className="arcade-score"><span>一點小挑戰</span><strong>剛剛好，湊成 10。</strong><span className="arcade-score-note">4 + 6 = <b>10</b> ✓</span></div>
        <div className="arcade-fruit-board">{HERO_FRUIT.map((value, index) => <span key={index} className={`arcade-fruit fruit-tone-${index % 4}${index === 1 || index === 2 ? ' is-picked' : ''}`}>{value}</span>)}</div>
        <div className="arcade-window-bottom"><span>框選數字 · 收穫好心情</span><span>✦ +10</span></div>
      </div>
      <span className="arcade-sticker">快樂，就這麼簡單。<span>JUST ONE MORE ROUND ↗</span></span>
    </div>
  )
}

type HomePageProps = {
  data: AppStorage
  onNavigate: (route: string) => void
  onSettings: () => void
}

function FruitPreview({ slide = false }: { slide?: boolean }) {
  return (
    <div className={`home-preview fruit-preview${slide ? ' slide-preview' : ''}`} aria-hidden="true">
      <span className="preview-fruit fruit-a">4</span>
      <span className="preview-fruit fruit-b">6</span>
      {slide ? <span className="preview-slide-arrow">→</span> : <><span className="preview-fruit fruit-c">2</span><i className="preview-selection" /></>}
      <em>10!</em>
    </div>
  )
}

const COLOR_PREVIEW_CELLS = [
  'c1', 'empty', 'c2', 'empty', 'c3',
  'empty', 'empty', 'c2', 'empty', 'empty',
  'c4', 'c4', 'empty', 'c4', 'c4',
  'empty', 'empty', 'c2', 'empty', 'empty',
  'c3', 'empty', 'c2', 'empty', 'c1',
] as const

function ColorPreview() {
  return (
    <div className="home-preview color-preview" aria-hidden="true">
      <div className="preview-color-grid">
        {COLOR_PREVIEW_CELLS.map((cell, index) => (
          <span key={`${cell}-${index}`} className={`preview-color-cell ${cell}`}>
            {cell === 'c1' ? '●' : cell === 'c2' ? '◆' : cell === 'c3' ? '＋' : cell === 'c4' ? '≋' : ''}
          </span>
        ))}
      </div>
      <i className="preview-link horizontal" />
      <i className="preview-link vertical" />
    </div>
  )
}

function formatBestTime(seconds: number | undefined): string {
  if (seconds === undefined) return '--:--'
  const minutes = Math.floor(seconds / 60)
  const remainder = seconds % 60
  return `${String(minutes).padStart(2, '0')}:${String(remainder).padStart(2, '0')}`
}

function GameCard({ game, highScore, bestTimeSeconds, onOpen }: {
  game: GameDefinition
  highScore: number
  bestTimeSeconds?: number
  onOpen: () => void
}) {
  const isFruit = game.id === 'fruitSum' || game.id === 'slideTen'
  const isSprout = game.id === 'sproutIsland'
  const isAshbound = game.id === 'ashbound'
  const recordLabel = isAshbound ? '最深探索紀錄' : isSprout ? '最高精靈等級' : isFruit
    ? '本機最高分'
    : '最快清空 · 時限最高'
  const recordValue = isAshbound ? `地下 ${highScore} 層` : isSprout ? `Lv. ${highScore || 1}` : isFruit
    ? highScore
    : `${formatBestTime(bestTimeSeconds)} · ${highScore} 格`
  return (
    <article className={`game-choice-card game-${game.id}`} style={{ '--card-accent': game.accent } as React.CSSProperties}>
      <button type="button" className="game-card-hitbox" onClick={onOpen} aria-label={`開始 ${game.name}`} />
      <div className="game-card-copy">
        <p className="eyebrow"><span>{GAME_CATEGORIES[game.id]}</span> / {game.id === 'slideTen' ? '滑動配對 · 試玩版' : isAshbound ? '回合策略' : isSprout ? '合成養成' : isFruit ? '數字益智' : '色彩消除'}</p>
        <h2>{game.name}</h2>
        <p>{game.description}</p>
        <span className="local-record">{recordLabel} <strong>{recordValue}</strong></span>
      </div>
      {isAshbound ? <div className="home-preview ash-preview" aria-hidden="true"><span>†</span></div> : isSprout ? <div className="home-preview sprout-preview" aria-hidden="true"><span>✦</span><strong>🌱</strong><i>Lv. ∞</i></div> : isFruit ? <FruitPreview slide={game.id === 'slideTen'} /> : <ColorPreview />}
      <span className="game-start-button" aria-hidden="true">開始遊戲 <span>↗</span></span>
    </article>
  )
}

export function HomePage({ data, onNavigate, onSettings }: HomePageProps) {
  const [leaderboardOpen, setLeaderboardOpen] = useState(false)
  const [filter, setFilter] = useState<(typeof FILTERS)[number]>('全部遊戲')
  const games = GAME_REGISTRY.filter((game) => filter === '全部遊戲' || GAME_CATEGORIES[game.id] === filter)

  return (
    <main className={`platform-shell home-shell arcade-home${data.globalSettings.reducedMotion || data.globalSettings.effectIntensity !== 'full' ? ' home-reduced-motion' : ''}`}>
      <a className="home-skip-link" href="#game-library">跳到遊戲列表</a>
      <AppHeader onSettings={onSettings} />
      <section className="home-hero">
        <div className="home-hero-copy">
          <p className="eyebrow"><span className="home-status-dot" /> YOUR LITTLE PLAY BREAK</p>
          <h1>把日常暫停，<br /><em>快樂玩一下。</em></h1>
          <p className="home-intro">收一籃水果、養一座小島，或來一場地城冒險。<br className="home-desktop-break" />留一點時間，給單純的快樂。</p>
          <div className="home-hero-actions"><button type="button" className="home-play-button" onClick={() => onNavigate('/games/fruit-sum')}>來玩 Orchard Ten <span aria-hidden="true">↗</span></button><a href="#game-library">逛逛遊戲廳 <span aria-hidden="true">↓</span></a></div>
          <p className="home-hero-note"><span>✦</span> 打開就能玩 <i /> 進度自動存於本機</p>
        </div>
        <ArcadePreview />
      </section>
      <section id="game-library" className="home-library-heading" aria-labelledby="game-library-title">
        <div><p className="eyebrow">PICK YOUR NEXT LITTLE JOY</p><h2 id="game-library-title">今天，想玩哪一種？<span>{String(GAME_REGISTRY.length).padStart(2, '0')} 款小遊戲</span></h2></div>
        <button type="button" className="home-leaderboard-button" onClick={() => setLeaderboardOpen(true)}>線上排行榜 <span aria-hidden="true">↗</span></button>
        <div className="home-filters" role="group" aria-label="遊戲分類">{FILTERS.map((item) => <button key={item} type="button" aria-pressed={filter === item} onClick={() => setFilter(item)}>{item}{item === '全部遊戲' ? <span>{String(GAME_REGISTRY.length).padStart(2, '0')}</span> : null}</button>)}</div>
      </section>
      <section className="game-choice-grid" aria-label="選擇遊戲">
        {games.map((game) => (
          <GameCard
            key={game.id}
            game={game}
            highScore={data.games[game.id].highScore}
            bestTimeSeconds={data.games[game.id].bestTimeSeconds}
            onOpen={() => onNavigate(game.route)}
          />
        ))}
      </section>
      <aside className="home-closing-note"><span aria-hidden="true">✳</span><p>不用很厲害，也能玩得很開心。<small>每一局，都是留給自己的小休息。</small></p><a href="#game-library">再選一款 <span aria-hidden="true">↑</span></a></aside>
      <footer className="platform-footer">
        <span>ORCHARD ARCADE · LOCAL-FIRST PLAY</span>
        <span>遊戲進度儲存在本機 · 自選登錄線上前 10 名</span>
      </footer>
      {leaderboardOpen ? <LeaderboardDialog onClose={() => setLeaderboardOpen(false)} /> : null}
    </main>
  )
}
