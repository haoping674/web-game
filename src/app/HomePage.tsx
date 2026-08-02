import { useRef } from 'react'
import { useGSAP } from '@gsap/react'
import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { GAME_REGISTRY, type GameDefinition } from './gameRegistry'
import type { AppStorage } from '../shared/storage/appStorage'
import { AppHeader } from '../shared/components/AppHeader'

if (typeof window !== 'undefined' && typeof window.matchMedia === 'function') {
  gsap.registerPlugin(useGSAP, ScrollTrigger)
}

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
  const isFruit = game.id === 'fruitSum'
  const recordLabel = isFruit ? '本機最高分' : '最快完成'
  const recordValue = isFruit ? highScore : formatBestTime(bestTimeSeconds)
  return (
    <article className={`game-choice-card game-${game.id}`} style={{ '--card-accent': game.accent } as React.CSSProperties}>
      <button type="button" className="game-card-hitbox" onClick={onOpen} aria-label={`開始 ${game.name}`} />
      <div className="game-card-copy">
        <p className="eyebrow">{game.eyebrow}</p>
        <h2>{game.name}</h2>
        <p>{game.description}</p>
        <span className="local-record">{recordLabel} <strong>{recordValue}</strong></span>
      </div>
      {isFruit ? <FruitPreview /> : <ColorPreview />}
      <button type="button" className="game-start-button" onClick={onOpen}>
        開始遊戲 <span aria-hidden="true">↗</span>
      </button>
    </article>
  )
}

export function HomePage({ data, onNavigate, onSettings }: HomePageProps) {
  const shellRef = useRef<HTMLElement>(null)
  const motionEnabled = !data.globalSettings.reducedMotion && data.globalSettings.effectIntensity === 'full'
  const canRunScrollMotion = motionEnabled
    && typeof window.matchMedia === 'function'
    && document.documentElement.clientHeight > 0

  useGSAP(() => {
    if (!canRunScrollMotion) return undefined

    const cards = gsap.utils.toArray<HTMLElement>('.game-choice-card')
    gsap.from('.home-hero > *', {
      y: 28,
      autoAlpha: 0,
      duration: 0.78,
      stagger: 0.12,
      ease: 'power3.out',
    })
    gsap.from(cards, {
      y: 72,
      scale: 0.94,
      autoAlpha: 0,
      duration: 0.9,
      stagger: 0.14,
      ease: 'power3.out',
      scrollTrigger: {
        trigger: '.game-choice-grid',
        start: 'top 82%',
        toggleActions: 'play none none reverse',
      },
    })
    cards.forEach((card, index) => {
      gsap.to(card, {
        y: index % 2 === 0 ? -12 : 12,
        scrollTrigger: {
          trigger: card,
          start: 'top bottom',
          end: 'bottom top',
          scrub: 0.8,
        },
      })
    })
    const marquee = shellRef.current?.querySelector<HTMLElement>('.home-marquee-track')
    if (marquee) gsap.to(marquee, { xPercent: -50, duration: 24, ease: 'none', repeat: -1 })
    return undefined
  }, { scope: shellRef, dependencies: [canRunScrollMotion] })

  return (
    <main ref={shellRef} className="platform-shell home-shell">
      <AppHeader onSettings={onSettings} />
      <section className="home-hero">
        <div>
          <p className="eyebrow">TWO SMALL PUZZLES · ONE QUIET ARCADE</p>
          <h1>今天想動動<br /><em>數字</em>，還是<span className="home-inline-signal" aria-hidden="true" /> <em>色彩</em>？</h1>
        </div>
        <p className="home-intro">兩款短局益智遊戲，各自保存進度。選一張遊戲卡，馬上開始。</p>
      </section>
      <section className="game-choice-grid" aria-label="選擇遊戲">
        {GAME_REGISTRY.map((game) => (
          <GameCard
            key={game.id}
            game={game}
            highScore={data.games[game.id].highScore}
            bestTimeSeconds={data.games[game.id].bestTimeSeconds}
            onOpen={() => onNavigate(game.route)}
          />
        ))}
      </section>
      <section className="home-play-accordions" aria-label="兩款遊戲的操作方式">
        <article className="home-play-accordion fruit-rhythm">
          <p>Orchard Ten</p>
          <strong>框選。湊十。清空。</strong>
          <span>拖曳任何矩形，尋找剛好為 10 的組合。</span>
        </article>
        <article className="home-play-accordion color-rhythm">
          <p>Color Links</p>
          <strong>選空格。連同色。得分。</strong>
          <span>一格串起兩個以上的同色訊號。</span>
        </article>
      </section>
      <div className="home-marquee" aria-hidden="true">
        <div className="home-marquee-track">
          <span>THINK IN TEN</span><i>•</i><span>LINK IN COLOR</span><i>•</i><span>THINK IN TEN</span><i>•</i><span>LINK IN COLOR</span><i>•</i>
          <span>THINK IN TEN</span><i>•</i><span>LINK IN COLOR</span><i>•</i><span>THINK IN TEN</span><i>•</i><span>LINK IN COLOR</span><i>•</i>
        </div>
      </div>
      <footer className="platform-footer">
        <span>ORCHARD ARCADE · LOCAL-FIRST PLAY</span>
        <span>進度只儲存在這台裝置</span>
      </footer>
    </main>
  )
}
