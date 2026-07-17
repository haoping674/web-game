import { useCallback, useEffect, useReducer, useState } from 'react'
import { AboutDialog } from './components/AboutDialog'
import { Footer } from './components/Footer'
import { GameScreen } from './components/GameScreen'
import { HowToPlayDialog } from './components/HowToPlayDialog'
import { IosInstallDialog } from './components/IosInstallDialog'
import { NetworkStatusToast } from './components/NetworkStatusToast'
import { PauseDialog } from './components/PauseDialog'
import { PwaUpdateDialog } from './components/PwaUpdateDialog'
import { ResultDialog } from './components/ResultDialog'
import { SettingsDialog } from './components/SettingsDialog'
import { StartScreen } from './components/StartScreen'
import { TutorialDialog } from './components/TutorialDialog'
import { ROUND_SECONDS } from './game/constants'
import { createGameState, gameReducer } from './game/gameReducer'
import { clearsPerMinute } from './game/scoring'
import { clearGameData, readGameData, recordFinishedRound, saveGameData } from './game/storage'
import { useInstallPrompt } from './hooks/useInstallPrompt'
import { useGamePauseShortcut } from './hooks/useGamePauseShortcut'
import { useNetworkStatus } from './hooks/useNetworkStatus'
import { usePwaUpdate } from './hooks/usePwaUpdate'
import { usePageVisibilityPause } from './hooks/usePageVisibilityPause'
import type { GameSettings, StoredGameData } from './game/types'
import './index.css'

type ActiveDialog = 'about' | 'how-to' | 'settings' | 'tutorial' | null
function App() {
  const [game, dispatch] = useReducer(gameReducer, undefined, () => createGameState())
  const [data, setData] = useState<StoredGameData>(readGameData)
  const [activeDialog, setActiveDialog] = useState<ActiveDialog>(null)
  const [resumeAfterTutorial, setResumeAfterTutorial] = useState(false)
  const [deferUpdate, setDeferUpdate] = useState(false)
  const install = useInstallPrompt()
  const networkNotice = useNetworkStatus()
  const pwaUpdate = usePwaUpdate()
  const updateData = (next: StoredGameData) => { setData(next); saveGameData(next) }
  const updateSettings = (settings: GameSettings) => updateData({ ...data, settings })
  useEffect(() => {
    if (game.status !== 'finished') return
    const clearedPerMinute = clearsPerMinute(game.clearedFruitCount, ROUND_SECONDS - game.secondsLeft)
    updateData(recordFinishedRound(data, game.score, game.clearedFruitCount, game.bestCombo, clearedPerMinute))
    // Only run on the state transition into "finished"; data is intentionally read once.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [game.status])
  const pauseGame = useCallback(() => dispatch({ type: 'pause', now: Date.now() }), [])
  const resumeGame = useCallback(() => dispatch({ type: 'resume', now: Date.now() }), [])
  const restartGame = useCallback(() => dispatch({ type: 'restart', now: Date.now() }), [])
  const homeGame = useCallback(() => dispatch({ type: 'home' }), [])
  useGamePauseShortcut({ isPlaying: game.status === 'playing', onPause: pauseGame })
  usePageVisibilityPause({ isPlaying: game.status === 'playing', onPause: pauseGame })
  const completeTutorial = () => {
    updateData({ ...data, tutorialSeen: true })
    setActiveDialog(null)
    if (resumeAfterTutorial) resumeGame()
    setResumeAfterTutorial(false)
  }
  const startGame = () => {
    const now = Date.now()
    dispatch({ type: 'start', now })
    if (!data.tutorialSeen) {
      dispatch({ type: 'pause', now })
      setResumeAfterTutorial(true)
      setActiveDialog('tutorial')
    }
  }
  const clearStatistics = () => { if (window.confirm('確定要清除所有本機遊戲紀錄與設定嗎？')) { const cleared = clearGameData(); updateData(cleared); setActiveDialog(null) } }
  const openGameSettings = () => { pauseGame(); setActiveDialog('settings') }
  const lowStimulusClass = data.settings.lowStimulus ? ' low-stimulation' : ''
  const animationClass = data.settings.animationsEnabled ? '' : ' animations-off'
  const isGameActive = game.status === 'playing' || game.status === 'paused'
  const installProps = { canInstall: install.canInstall, isInstalled: install.isInstalled, ios: install.ios, onInstall: install.install, onIosInstructions: install.openIosInstructions }
  const showUpdate = pwaUpdate.updateAvailable && !deferUpdate
  return <main className={`app-shell${lowStimulusClass}${animationClass}`}>
    <section className="game-card">
      {game.status === 'start' && <StartScreen onStart={startGame} settings={data.settings} statistics={data.statistics} onOpenSettings={() => setActiveDialog('settings')} onHowToPlay={() => setActiveDialog('how-to')} onAbout={() => setActiveDialog('about')} install={installProps} />}
      {game.status !== 'start' && <GameScreen game={game} dispatch={dispatch} settings={data.settings} tutorialOpen={activeDialog === 'tutorial'} onPause={pauseGame} onRestart={restartGame} onOpenSettings={openGameSettings} networkNotice={networkNotice} />}
      {game.status === 'paused' && activeDialog !== 'settings' && activeDialog !== 'tutorial' && <PauseDialog onResume={resumeGame} onRestart={restartGame} onHome={homeGame} />}
      {game.status === 'finished' && <ResultDialog game={game} statistics={data.statistics} onRestart={restartGame} onHome={homeGame} />}
    </section>
    {game.status !== 'playing' && <Footer onAbout={() => setActiveDialog('about')} onHowToPlay={() => setActiveDialog('how-to')} />}
    {activeDialog === 'about' && <AboutDialog onClose={() => setActiveDialog(null)} />}
    {activeDialog === 'how-to' && <HowToPlayDialog onClose={() => setActiveDialog(null)} />}
    {activeDialog === 'tutorial' && <TutorialDialog onComplete={completeTutorial} onSkip={completeTutorial} />}
    {activeDialog === 'settings' && <SettingsDialog settings={data.settings} onChange={updateSettings} onTutorial={() => setActiveDialog('tutorial')} onAbout={() => setActiveDialog('about')} onClearStatistics={clearStatistics} onClose={() => setActiveDialog(null)} />}
    {install.showIosInstructions && <IosInstallDialog onClose={install.closeIosInstructions} />}
    {game.status !== 'playing' && <NetworkStatusToast notice={networkNotice} />}
    <PwaUpdateDialog visible={showUpdate} isGameActive={isGameActive} onUpdate={pwaUpdate.applyUpdate} onLater={() => setDeferUpdate(true)} />
  </main>
}
export default App
