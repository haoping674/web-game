import { translate } from '../../app/translate'
import { ENGLISH_GUIDES } from '../../app/englishGuides'
import { readAppPathname } from '../../app/router'
import { localeFromPath, ENGLISH_GAMES } from '../../app/locale'
import { GAME_GUIDES } from '../../app/gameGuides'
import { GAME_REGISTRY } from '../../app/gameRegistry'

export function GameGuide({ pathname }: { pathname: string }) {
  const game = GAME_REGISTRY.find(entry => entry.route === pathname)
  if (!game) return null
  const english = localeFromPath(readAppPathname()) === 'en'
  const guide = english ? ENGLISH_GUIDES[game.id as keyof typeof ENGLISH_GUIDES] : GAME_GUIDES[game.id]
  const name = english ? ENGLISH_GAMES[game.id as keyof typeof ENGLISH_GAMES].name : game.name
  return <section className="game-guide" aria-labelledby="game-guide-title">
    <p className="eyebrow">PLAY GUIDE</p>
    <h2 id="game-guide-title">{name}{english ? ' play guide' : translate('遊玩指南')}</h2>
    <p className="game-guide-intro">{guide.goal}</p>
    <div className="game-guide-grid">{([[english ? 'Controls' : translate('操作方式'), guide.controls], [english ? 'Rules' : translate('遊戲規則'), guide.rules], [english ? 'Scoring and records' : translate('計分與紀錄'), guide.scoring], [english ? 'Try this' : translate('試試這個方法'), guide.tip]] as const).map(([title, text]) => <div key={title}><h3>{title}</h3><p>{text}</p></div>)}</div>
  </section>
}
