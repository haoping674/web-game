import { useCallback, useEffect, useReducer, useState } from 'react'
import { AboutDialog } from '../../components/AboutDialog'
import { Footer } from '../../components/Footer'
import { GameScreen } from '../../components/GameScreen'
import { HowToPlayDialog } from '../../components/HowToPlayDialog'
import { IosInstallDialog } from '../../components/IosInstallDialog'
import { NetworkStatusToast } from '../../components/NetworkStatusToast'
import { PauseDialog } from '../../components/PauseDialog'
import { PwaUpdateDialog } from '../../components/PwaUpdateDialog'
import { ResultDialog } from '../../components/ResultDialog'
import { SettingsDialog } from '../../components/SettingsDialog'
import { StartScreen } from '../../components/StartScreen'
import { TutorialDialog } from '../../components/TutorialDialog'
import { createGameState, gameReducer } from '../../game/gameReducer'
import { getModeRoundSeconds } from '../../game/modes'
import { clearsPerMinute } from '../../game/scoring'
import { clearGameData, readGameData, recordFinishedRound, saveGameData } from '../../game/storage'
import type { GameSettings, StoredGameData } from '../../game/types'
import { useGamePauseShortcut } from '../../hooks/useGamePauseShortcut'
import { useInstallPrompt } from '../../hooks/useInstallPrompt'
import { useNetworkStatus } from '../../hooks/useNetworkStatus'
import { usePageVisibilityPause } from '../../hooks/usePageVisibilityPause'
import { usePwaUpdate } from '../../hooks/usePwaUpdate'
import {
  recordGameResult,
  resetGameProgress,
  updateGlobalSettings,
  type GlobalSettings,
} from '../../shared/storage/appStorage'

type ActiveDialog = 'about' | 'how-to' | 'settings' | 'tutorial' | null

type FruitSumGameProps = {
  globalSettings: GlobalSettings
  onProgressChange: () => void
  platformSettingsOpen: boolean
}

function settingsFromGlobal(current: GameSettings, global: GlobalSettings): GameSettings {
  return {
    ...current,
    soundEnabled: global.soundEnabled,
    animationIntensity: global.effectIntensity,
    animationsEnabled: global.effectIntensity !== 'off',
    lowStimulus: global.reducedMotion,
  }
}

export default function FruitSumGame({
  globalSettings,
  onProgressChange,
  platformSettingsOpen,
}: FruitSumGameProps) {
  const [game, dispatch] = useReducer(gameReducer, undefined, () => createGameState())
  const [data, setData] = useState<StoredGameData>(() => {
    const stored = readGameData()
    const next = { ...stored, settings: settingsFromGlobal(stored.settings, globalSettings) }
    saveGameData(next)
    return next
  })
  const [activeDialog, setActiveDialog] = useState<ActiveDialog>(null)
  const [resumeAfterTutorial, setResumeAfterTutorial] = useState(false)
  const [deferUpdate, setDeferUpdate] = useState(false)
  const install = useInstallPrompt()
  const networkNotice = useNetworkStatus()
  const pwaUpdate = usePwaUpdate()

  useEffect(() => {
    setData((current) => {
      const settings = settingsFromGlobal(current.settings, globalSettings)
      if (
        settings.soundEnabled === current.settings.soundEnabled
        && settings.animationIntensity === current.settings.animationIntensity
        && settings.lowStimulus === current.settings.lowStimulus
      ) return current
      const next = { ...current, settings }
      saveGameData(next)
      return next
    })
  }, [globalSettings])

  const updateData = (next: StoredGameData) => {
    setData(next)
    saveGameData(next)
  }

  const updateSettings = (settings: GameSettings) => {
    updateData({ ...data, settings })
    updateGlobalSettings({
      soundEnabled: settings.soundEnabled,
      reducedMotion: settings.lowStimulus || settings.animationIntensity !== 'full',
      effectIntensity: settings.animationIntensity,
    })
    onProgressChange()
  }

  useEffect(() => {
    if (game.status !== 'finished') return
    const clearedPerMinute = clearsPerMinute(
      game.clearedFruitCount,
      getModeRoundSeconds(game.mode) - game.secondsLeft,
    )
    setData((current) => {
      const next = recordFinishedRound(
        current,
        game.mode,
        game.score,
        game.clearedFruitCount,
        game.bestCombo,
        clearedPerMinute,
      )
      recordGameResult('fruitSum', game.score)
      saveGameData(next)
      onProgressChange()
      return next
    })
  }, [
    game.bestCombo,
    game.clearedFruitCount,
    game.mode,
    game.score,
    game.secondsLeft,
    game.status,
    onProgressChange,
  ])

  const pauseGame = useCallback(() => dispatch({ type: 'pause', now: Date.now() }), [])
  const resumeGame = useCallback(() => dispatch({ type: 'resume', now: Date.now() }), [])
  const restartGame = useCallback(() => dispatch({ type: 'restart', now: Date.now() }), [])
  const homeGame = useCallback(() => dispatch({ type: 'home' }), [])
  const markMobileGestureHintSeen = useCallback(() => {
    setData((current) => {
      if (current.mobileGestureHintSeen) return current
      const next = { ...current, mobileGestureHintSeen: true }
      saveGameData(next)
      return next
    })
  }, [])

  useGamePauseShortcut({ isPlaying: game.status === 'playing', onPause: pauseGame })
  usePageVisibilityPause({ isPlaying: game.status === 'playing', onPause: pauseGame })
  useEffect(() => {
    const pauseForPlatformSettings = () => pauseGame()
    window.addEventListener('orchard-arcade:settings-open', pauseForPlatformSettings)
    return () => window.removeEventListener('orchard-arcade:settings-open', pauseForPlatformSettings)
  }, [pauseGame])

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

  const clearStatistics = () => {
    if (!window.confirm('確定要清除 Orchard Ten 的本機紀錄與設定嗎？Color Links 紀錄會保留。')) return
    const cleared = clearGameData()
    updateData(cleared)
    resetGameProgress('fruitSum')
    updateGlobalSettings({
      soundEnabled: cleared.settings.soundEnabled,
      reducedMotion: cleared.settings.lowStimulus,
      effectIntensity: cleared.settings.animationIntensity,
    })
    onProgressChange()
    setActiveDialog(null)
  }

  const openGameSettings = () => {
    pauseGame()
    setActiveDialog('settings')
  }
  const lowStimulusClass = data.settings.lowStimulus ? ' low-stimulation' : ''
  const animationClass = data.settings.animationIntensity === 'off' || !data.settings.animationsEnabled
    ? ' animations-off'
    : data.settings.animationIntensity === 'reduced'
      ? ' animations-reduced'
      : ''
  const isGameActive = game.status === 'playing' || game.status === 'paused'
  const installProps = {
    canInstall: install.canInstall,
    isInstalled: install.isInstalled,
    ios: install.ios,
    onInstall: install.install,
    onIosInstructions: install.openIosInstructions,
  }
  const showUpdate = pwaUpdate.updateAvailable && !deferUpdate

  return (
    <div className={`app-shell fruit-route-shell${lowStimulusClass}${animationClass}${isGameActive ? ' is-game-active' : ''}`}>
      <section className="game-card">
        {game.status === 'start' ? (
          <StartScreen
            selectedMode={game.mode}
            onModeChange={(mode) => dispatch({ type: 'set-mode', mode })}
            onStart={startGame}
            settings={data.settings}
            statistics={data.statisticsByMode[game.mode]}
            onOpenSettings={() => setActiveDialog('settings')}
            onHowToPlay={() => setActiveDialog('how-to')}
            onAbout={() => setActiveDialog('about')}
            install={installProps}
          />
        ) : (
          <GameScreen
            game={game}
            dispatch={dispatch}
            settings={data.settings}
            tutorialOpen={activeDialog === 'tutorial'}
            onPause={pauseGame}
            onRestart={restartGame}
            onOpenSettings={openGameSettings}
            networkNotice={networkNotice}
            showMobileGestureHint={!data.mobileGestureHintSeen}
            onMobileGestureHintShown={markMobileGestureHintSeen}
          />
        )}
        {game.status === 'paused' && activeDialog !== 'settings' && activeDialog !== 'tutorial' && !platformSettingsOpen ? (
          <PauseDialog onResume={resumeGame} onRestart={restartGame} onHome={homeGame} />
        ) : null}
        {game.status === 'finished' ? (
          <ResultDialog
            game={game}
            statistics={data.statisticsByMode[game.mode]}
            onRestart={restartGame}
            onHome={homeGame}
          />
        ) : null}
      </section>
      {game.status === 'start' ? (
        <Footer onAbout={() => setActiveDialog('about')} onHowToPlay={() => setActiveDialog('how-to')} />
      ) : null}
      {activeDialog === 'about' ? <AboutDialog onClose={() => setActiveDialog(null)} /> : null}
      {activeDialog === 'how-to' ? <HowToPlayDialog onClose={() => setActiveDialog(null)} /> : null}
      {activeDialog === 'tutorial' ? <TutorialDialog onComplete={completeTutorial} onSkip={completeTutorial} /> : null}
      {activeDialog === 'settings' ? (
        <SettingsDialog
          settings={data.settings}
          onChange={updateSettings}
          onTutorial={() => setActiveDialog('tutorial')}
          onAbout={() => setActiveDialog('about')}
          onClearStatistics={clearStatistics}
          onClose={() => setActiveDialog(null)}
        />
      ) : null}
      {install.showIosInstructions ? <IosInstallDialog onClose={install.closeIosInstructions} /> : null}
      {game.status !== 'playing' ? <NetworkStatusToast notice={networkNotice} /> : null}
      <PwaUpdateDialog
        visible={showUpdate}
        isGameActive={isGameActive}
        onUpdate={pwaUpdate.applyUpdate}
        onLater={() => setDeferUpdate(true)}
      />
    </div>
  )
}
