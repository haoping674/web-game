import { GAME_VERSION } from '../game/constants'
type FooterProps = { onAbout: () => void; onHowToPlay: () => void }
export function Footer({ onAbout, onHowToPlay }: FooterProps) {
  return <footer className="site-footer"><span>Orchard Ten · v{GAME_VERSION}</span><button type="button" onClick={onHowToPlay}>玩法</button><button type="button" onClick={onAbout}>About</button><a href="https://en.gamesaien.com/game/fruit_box/" target="_blank" rel="noopener noreferrer">Inspired by Fruit Box ↗</a></footer>
}
