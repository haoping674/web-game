import { GAME_GUIDES } from '../../app/gameGuides'
import { GAME_REGISTRY } from '../../app/gameRegistry'

export function GameGuide({ pathname }: { pathname: string }) {
  const game = GAME_REGISTRY.find(entry => entry.route === pathname)
  if (!game) return null
  const guide = GAME_GUIDES[game.id]
  return <section className="game-guide" aria-labelledby="game-guide-title">
    <p className="eyebrow">PLAY GUIDE</p>
    <h2 id="game-guide-title">{game.name}遊玩指南</h2>
    <p className="game-guide-intro">{guide.goal}</p>
    <div className="game-guide-grid">{([['操作方式', guide.controls], ['遊戲規則', guide.rules], ['計分與紀錄', guide.scoring], ['試試這個方法', guide.tip]] as const).map(([title, text]) => <div key={title}><h3>{title}</h3><p>{text}</p></div>)}</div>
  </section>
}
