import { AppHeader } from '../shared/components/AppHeader'
import type { AppStorage } from '../shared/storage/appStorage'
import { GAME_REGISTRY } from './gameRegistry'
import { ENGLISH_GAMES, ENGLISH_GAME_IDS, SITE_NAMES } from './locale'
import { toAppUrl } from './router'
import './home.css'

const CATEGORIES = { lengthSense: 'Trust your senses', secondSense: 'Trust your senses', fruitSum: 'Brain teasers', colorLinks: 'Brain teasers', slideTen: 'Brain teasers' } as const
const FILTERS = ['All games', 'Trust your senses', 'Brain teasers'] as const

export function EnglishHomePage({ data, onNavigate, onSettings }: {
  data: AppStorage
  onNavigate: (route: string) => void
  onSettings: () => void
}) {
  const [filter, setFilter] = useState<(typeof FILTERS)[number]>('All games')
  const games = ENGLISH_GAME_IDS.filter(id => filter === 'All games' || CATEGORIES[id] === filter)
  return <main className="platform-shell home-shell arcade-home">
    <a className="home-skip-link" href="#game-library-title">Skip to games</a>
    <AppHeader onSettings={onSettings} />
    <section className="home-hero">
      <div className="home-hero-copy">
        <h1>Take a little break.<br /><em>Play something good.</em></h1>
        <p className="home-intro">Test your senses or enjoy a brain teaser. Five free browser games for your phone or desktop, with no download or account required.</p>
        <div className="home-hero-actions"><button className="home-play-button" onClick={() => onNavigate('/games/fruit-sum')}>Play Orchard Ten <span aria-hidden="true">↗</span></button><a href="#game-library">Browse games ↓</a></div>
        <p className="home-hero-note">Your progress is saved on this device.</p>
      </div>
      <div className="arcade-preview" aria-hidden="true"><div className="arcade-window-bar">ORCHARD TEN</div><div className="arcade-window-body"><div className="arcade-score"><strong>Find a little joy.<br />Make 10.</strong></div><div className="arcade-fruit-board">{[4, 6, 3, 7, 2, 8, 1, 9, 5, 5, 3, 2, 4, 6, 1, 9, 7, 3, 5, 2, 8, 4, 6, 1, 9].map((value, i) => <span key={i} className={`arcade-fruit fruit-tone-${i % 4}`}>{value}</span>)}</div></div></div>
    </section>
    <section id="game-library" className="home-library-heading">
      <h2 id="game-library-title" tabIndex={-1}>Pick your next game</h2>
      <div className="home-filters" role="group" aria-label="Game categories">{FILTERS.map(category => <button type="button" key={category} aria-pressed={filter === category} onClick={() => setFilter(category)}>{category}</button>)}</div>
    </section>
    <section className="game-choice-grid" aria-label="Games available in English">
      {games.map(id => {
        const game = GAME_REGISTRY.find(entry => entry.id === id)!
        const copy = ENGLISH_GAMES[id]
        return <article className={`game-choice-card game-${id}`} key={id} style={{ '--card-accent': game.accent } as React.CSSProperties}>
          <a className="game-card-hitbox" href={toAppUrl(`/en${game.route}`)} aria-label={`Play ${copy.name}`} />
          <div className="game-card-copy"><p className="eyebrow">{CATEGORIES[id]}</p><h2>{copy.name}</h2><p>{copy.description}</p><span className="local-record">{id === 'secondSense' || id === 'lengthSense' ? 'Best accuracy score' : id === 'colorLinks' ? 'Most tiles cleared at timeout' : 'Local high score'} <strong>{data.games[id].highScore}</strong></span></div>
          <span className="game-start-button" aria-hidden="true">Play now ↗</span>
        </article>
      })}
    </section>
    <footer className="platform-footer"><span>{SITE_NAMES.en}</span><span>Progress saved on this device</span></footer>
  </main>
}
import { useState } from 'react'
