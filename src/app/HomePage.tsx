import { GAME_REGISTRY, type GameDefinition } from './gameRegistry'
import type { AppStorage } from '../shared/storage/appStorage'
import { AppHeader } from '../shared/components/AppHeader'

type HomePageProps = {
  data: AppStorage
  onNavigate: (route: string) => void
  onSettings: () => void
}

function FruitPreview() {
  return (
    <div className="home-preview fruit-preview" aria-hidden="true">
      <span className="preview-fruit fruit-a">4</span>
      <span className="preview-fruit fruit-b">6</span>
      <span className="preview-fruit fruit-c">2</span>
      <i className="preview-selection" />
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

function GameCard({ game, highScore, onOpen }: {
  game: GameDefinition
  highScore: number
  onOpen: () => void
}) {
  const isFruit = game.id === 'fruitSum'
  return (
    <article className={`game-choice-card game-${game.id}`} style={{ '--card-accent': game.accent } as React.CSSProperties}>
      <button type="button" className="game-card-hitbox" onClick={onOpen} aria-label={`開始 ${game.name}`} />
      <div className="game-card-copy">
        <p className="eyebrow">{game.eyebrow}</p>
        <h2>{game.name}</h2>
        <p>{game.description}</p>
        <span className="local-record">本機最高分 <strong>{highScore}</strong></span>
      </div>
      {isFruit ? <FruitPreview /> : <ColorPreview />}
      <button type="button" className="game-start-button" onClick={onOpen}>
        開始遊戲 <span aria-hidden="true">↗</span>
      </button>
    </article>
  )
}

export function HomePage({ data, onNavigate, onSettings }: HomePageProps) {
  return (
    <main className="platform-shell home-shell">
      <AppHeader onSettings={onSettings} />
      <section className="home-hero">
        <div>
          <p className="eyebrow">TWO SMALL PUZZLES · ONE QUIET ARCADE</p>
          <h1>今天想動動<br /><em>數字</em>，還是<em>色彩</em>？</h1>
        </div>
        <p className="home-intro">兩款短局益智遊戲，各自保存進度。選一張遊戲卡，馬上開始。</p>
      </section>
      <section className="game-choice-grid" aria-label="選擇遊戲">
        {GAME_REGISTRY.map((game) => (
          <GameCard
            key={game.id}
            game={game}
            highScore={data.games[game.id].highScore}
            onOpen={() => onNavigate(game.route)}
          />
        ))}
      </section>
      <footer className="platform-footer">
        <span>ORCHARD ARCADE · LOCAL-FIRST PLAY</span>
        <span>進度只儲存在這台裝置</span>
      </footer>
    </main>
  )
}
