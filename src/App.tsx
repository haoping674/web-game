import { useEffect, useReducer, useState } from 'react'
import { AboutDialog } from './components/AboutDialog'
import { Footer } from './components/Footer'
import { GameScreen } from './components/GameScreen'
import { HowToPlayDialog } from './components/HowToPlayDialog'
import { PauseDialog } from './components/PauseDialog'
import { ResultDialog } from './components/ResultDialog'
import { SettingsDialog } from './components/SettingsDialog'
import { StartScreen } from './components/StartScreen'
import { TutorialDialog } from './components/TutorialDialog'
import { ROUND_SECONDS } from './game/constants'
import { createGameState, gameReducer } from './game/gameReducer'
import { clearsPerMinute } from './game/scoring'
import { clearGameData, readGameData, recordFinishedRound, saveGameData } from './game/storage'
import type { GameSettings, StoredGameData } from './game/types'
import './index.css'

type ActiveDialog = 'about' | 'how-to' | 'settings' | 'tutorial' | null
function App() {
  const [game, dispatch] = useReducer(gameReducer, undefined, () => createGameState())
  const [data, setData] = useState<StoredGameData>(readGameData)
  const [activeDialog, setActiveDialog] = useState<ActiveDialog>(null)
  const updateData = (next: StoredGameData) => { setData(next); saveGameData(next) }
  const updateSettings = (settings: GameSettings) => updateData({ ...data, settings })
  useEffect(() => {
    if (game.status !== 'finished') return
    const clearedPerMinute = clearsPerMinute(game.score, ROUND_SECONDS - game.secondsLeft)
    updateData(recordFinishedRound(data, game.score, game.score, game.bestCombo, clearedPerMinute))
    // Only run on the state transition into "finished"; data is intentionally read once.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [game.status])
  const completeTutorial = () => { updateData({ ...data, tutorialSeen: true }); setActiveDialog(null) }
  const startGame = () => { dispatch({ type: 'start' }); if (!data.tutorialSeen) setActiveDialog('tutorial') }
  const clearStatistics = () => { if (window.confirm('確定要清除所有本機遊戲紀錄與設定嗎？')) { const cleared = clearGameData(); updateData(cleared); setActiveDialog(null) } }
  const openGameSettings = () => { dispatch({ type: 'pause', now: Date.now() }); setActiveDialog('settings') }
  const lowStimulusClass = data.settings.lowStimulus ? ' low-stimulation' : ''
  const animationClass = data.settings.animationsEnabled ? '' : ' animations-off'
  return <main className={`app-shell${lowStimulusClass}${animationClass}`}><section className="game-card">{game.status === 'start' && <StartScreen onStart={startGame} settings={data.settings} statistics={data.statistics} onOpenSettings={() => setActiveDialog('settings')} onHowToPlay={() => setActiveDialog('how-to')} onAbout={() => setActiveDialog('about')} />}{game.status !== 'start' && <GameScreen game={game} dispatch={dispatch} settings={data.settings} tutorialOpen={activeDialog === 'tutorial'} onOpenSettings={openGameSettings} />}{game.status === 'paused' && activeDialog !== 'settings' && <PauseDialog onResume={() => dispatch({ type: 'resume', now: Date.now() })} onRestart={() => dispatch({ type: 'restart' })} onHome={() => dispatch({ type: 'home' })} />}{game.status === 'finished' && <ResultDialog game={game} statistics={data.statistics} onRestart={() => dispatch({ type: 'restart' })} onHome={() => dispatch({ type: 'home' })} />}</section>{game.status !== 'playing' && <Footer onAbout={() => setActiveDialog('about')} onHowToPlay={() => setActiveDialog('how-to')} />}{activeDialog === 'about' && <AboutDialog onClose={() => setActiveDialog(null)} />}{activeDialog === 'how-to' && <HowToPlayDialog onClose={() => setActiveDialog(null)} />}{activeDialog === 'tutorial' && <TutorialDialog onComplete={completeTutorial} onSkip={completeTutorial} />}{activeDialog === 'settings' && <SettingsDialog settings={data.settings} onChange={updateSettings} onTutorial={() => setActiveDialog('tutorial')} onAbout={() => setActiveDialog('about')} onClearStatistics={clearStatistics} onClose={() => setActiveDialog(null)} />}</main>
}
export default App
