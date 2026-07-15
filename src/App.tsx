import { useEffect, useReducer, useState } from 'react'
import { GameScreen } from './components/GameScreen'
import { PauseDialog } from './components/PauseDialog'
import { ResultDialog } from './components/ResultDialog'
import { StartScreen } from './components/StartScreen'
import { createGameState, gameReducer } from './game/gameReducer'
import { readHighScore, saveHighScore } from './game/storage'
import './index.css'
function App() {
  const [game, dispatch] = useReducer(gameReducer, undefined, () => createGameState())
  const [soundEnabled, setSoundEnabled] = useState(true)
  const [lowStimulus, setLowStimulus] = useState(false)
  const [highScore, setHighScore] = useState(readHighScore)
  useEffect(() => { if (game.status === 'finished') setHighScore(saveHighScore(game.score)) }, [game.score, game.status])
  const remaining = game.board.flat().filter((value) => value !== null).length
  const settings = { soundEnabled, lowStimulus, onToggleSound: () => setSoundEnabled((value) => !value), onToggleLowStimulus: () => setLowStimulus((value) => !value) }
  return <main className={`app-shell${lowStimulus ? ' low-stimulation' : ''}`}><section className="game-card">{game.status === 'start' && <StartScreen onStart={() => dispatch({ type: 'start' })} highScore={highScore} {...settings} />}{game.status !== 'start' && <GameScreen game={game} dispatch={dispatch} {...settings} />}{game.status === 'paused' && <PauseDialog onResume={() => dispatch({ type: 'resume' })} onRestart={() => dispatch({ type: 'restart' })} onHome={() => dispatch({ type: 'home' })} />}{game.status === 'finished' && <ResultDialog score={game.score} highScore={highScore} remaining={remaining} onRestart={() => dispatch({ type: 'restart' })} onHome={() => dispatch({ type: 'home' })} />}</section></main>
}
export default App
