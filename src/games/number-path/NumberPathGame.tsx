import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from 'react'
import { OverlayDialog } from '../../components/OverlayDialog'
import { PwaUpdateNotice } from '../../components/PwaUpdateNotice'
import { Timer } from '../../components/Timer'
import { useGamePauseShortcut } from '../../hooks/useGamePauseShortcut'
import { usePageVisibilityPause } from '../../hooks/usePageVisibilityPause'
import { recordNumberPathResult, type GlobalSettings } from '../../shared/storage/appStorage'
import { NumberPathAudio } from './audio'
import { numberPathReducer, createNumberPathState } from './gameReducer'
import { getNumberPathLevel, levelsForDifficulty, NUMBER_PATH_LEVELS } from './levels'
import { NumberPathBoard } from './NumberPathBoard'
import {
  findPositionForValue,
  getNeighborPositions,
  isCorrectNextPosition,
  isPathPositionUsed,
  positionKey,
  samePosition,
} from './rules'
import {
  readNumberPathProgress,
  recordNumberPathCompletion,
  setNumberPathDifficulty,
  setShowSolvedNumbers,
} from './storage'
import type { NumberPathDifficulty, NumberPathPosition } from './types'

type NumberPathGameProps = {
  globalSettings: GlobalSettings
  onProgressChange: () => void
  platformSettingsOpen: boolean
}

const MAX_HINTS_PER_LEVEL = 4

function formatTime(seconds: number): string {
  const minutes = Math.floor(seconds / 60)
  return `${String(minutes).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`
}

function difficultyLabel(difficulty: NumberPathDifficulty): string {
  return difficulty === 'easy' ? '簡單' : difficulty === 'normal' ? '普通' : '困難'
}

export default function NumberPathGame({ globalSettings, onProgressChange, platformSettingsOpen }: NumberPathGameProps) {
  const [game, dispatch] = useReducer(numberPathReducer, undefined, createNumberPathState)
  const [progress, setProgress] = useState(readNumberPathProgress)
  const [feedback, setFeedback] = useState('選一關，從公開的 1 開始推理整條路徑。')
  const [invalidPosition, setInvalidPosition] = useState<NumberPathPosition | null>(null)
  const [hintCandidates, setHintCandidates] = useState<readonly NumberPathPosition[]>([])
  const [eliminatedPositions, setEliminatedPositions] = useState<readonly NumberPathPosition[]>([])
  const [hintTarget, setHintTarget] = useState<NumberPathPosition | null>(null)
  const [revealedPosition, setRevealedPosition] = useState<NumberPathPosition | null>(null)
  const invalidTimer = useRef<number | null>(null)
  const hintTimer = useRef<number | null>(null)
  const lastInvalidAt = useRef(0)
  const recordedCompletion = useRef(false)
  const audio = useRef<NumberPathAudio | null>(null)

  const level = useMemo(() => getNumberPathLevel(game.levelId), [game.levelId])
  const playing = game.status === 'playing'
  const paused = game.status === 'paused'
  const effectsOff = globalSettings.effectIntensity === 'off'
  const solvedCount = Object.keys(progress.completedByLevel).length

  const getAudio = () => {
    audio.current ??= new NumberPathAudio()
    return audio.current
  }

  const clearHints = useCallback(() => {
    if (hintTimer.current !== null) window.clearTimeout(hintTimer.current)
    hintTimer.current = null
    setHintCandidates([])
    setEliminatedPositions([])
    setHintTarget(null)
    setRevealedPosition(null)
  }, [])

  const pauseGame = useCallback(() => dispatch({ type: 'pause', now: Date.now() }), [])
  const resumeGame = useCallback(() => dispatch({ type: 'resume', now: Date.now() }), [])
  useGamePauseShortcut({ isPlaying: playing, onPause: pauseGame })
  usePageVisibilityPause({ isPlaying: playing, onPause: pauseGame })

  useEffect(() => {
    const pauseForPlatformSettings = () => pauseGame()
    window.addEventListener('orchard-arcade:settings-open', pauseForPlatformSettings)
    return () => window.removeEventListener('orchard-arcade:settings-open', pauseForPlatformSettings)
  }, [pauseGame])

  useEffect(() => {
    if (!playing || game.nextTickAt === null) return undefined
    const timer = window.setTimeout(() => dispatch({ type: 'tick', now: Date.now() }), Math.max(0, game.nextTickAt - Date.now()))
    return () => window.clearTimeout(timer)
  }, [game.nextTickAt, playing])

  useEffect(() => {
    if (playing) return
    audio.current?.suspend()
  }, [playing])

  useEffect(() => () => {
    if (invalidTimer.current !== null) window.clearTimeout(invalidTimer.current)
    if (hintTimer.current !== null) window.clearTimeout(hintTimer.current)
    audio.current?.dispose()
  }, [])

  useEffect(() => {
    if (game.status !== 'finished' || !level || recordedCompletion.current) return
    recordedCompletion.current = true
    setProgress(recordNumberPathCompletion(level.id, game.elapsedSeconds, game.errors, game.hintsUsed))
    recordNumberPathResult(game.elapsedSeconds)
    onProgressChange()
    audio.current?.suspend()
  }, [game.elapsedSeconds, game.errors, game.hintsUsed, game.status, level, onProgressChange])

  const selectDifficulty = (difficulty: NumberPathDifficulty) => {
    setProgress(setNumberPathDifficulty(difficulty))
  }

  const chooseLevel = (levelId: string) => {
    if (!progress.unlockedLevelIds.includes(levelId)) return
    recordedCompletion.current = false
    clearHints()
    setInvalidPosition(null)
    setFeedback('從 1 開始；每一步只能走向相鄰的下一個數字。')
    dispatch({ type: 'choose-level', levelId, now: Date.now() })
  }

  const restartLevel = () => {
    recordedCompletion.current = false
    clearHints()
    setInvalidPosition(null)
    setFeedback('本關已重置，公開提示保持不變。')
    dispatch({ type: 'restart', now: Date.now() })
  }

  const returnToLevels = () => {
    clearHints()
    setInvalidPosition(null)
    setFeedback('選一關，從公開的 1 開始推理整條路徑。')
    dispatch({ type: 'return-to-levels' })
  }

  const showInvalidMove = (position: NumberPathPosition, message: string) => {
    const now = Date.now()
    if (now - lastInvalidAt.current < 180) return
    lastInvalidAt.current = now
    getAudio().playInvalid(globalSettings.soundEnabled)
    setInvalidPosition(position)
    setFeedback(message)
    if (invalidTimer.current !== null) window.clearTimeout(invalidTimer.current)
    invalidTimer.current = window.setTimeout(() => {
      invalidTimer.current = null
      setInvalidPosition(null)
    }, 280)
    dispatch({ type: 'invalid-move' })
  }

  const attemptPosition = (position: NumberPathPosition) => {
    if (!playing || !level) return
    const previous = game.path.at(-2)
    if (previous && samePosition(previous, position)) {
      clearHints()
      dispatch({ type: 'undo' })
      setFeedback('已沿原路退回一格。')
      return
    }
    if (isPathPositionUsed(game.path, position)) {
      showInvalidMove(position, '這一格已在路徑中，請沿原路退回才能撤銷。')
      return
    }
    if (!isCorrectNextPosition(level, game.path, position)) {
      const expected = game.path.length === 0 ? 1 : game.path.length + 1
      showInvalidMove(position, expected === 1 ? '必須從公開的 1 開始。' : '這不是相鄰的下一個數字；正確路徑會保留。')
      return
    }
    const value = game.path.length + 1
    const complete = value === level.maxNumber
    clearHints()
    setInvalidPosition(null)
    getAudio().playCorrect(globalSettings.soundEnabled, value)
    if (!effectsOff && 'vibrate' in navigator) {
      const vibration = navigator as Navigator & { vibrate?: (pattern: number) => boolean }
      vibration.vibrate?.(5)
    }
    setFeedback(complete ? '完整路徑成立。' : `路徑已推進至 ${value}／${level.maxNumber}。`)
    dispatch({ type: 'move', position, completed: complete })
  }

  const undo = () => {
    if (!playing || game.path.length === 0) return
    clearHints()
    dispatch({ type: 'undo' })
    setFeedback('已撤銷最近一步。')
  }

  const useHint = () => {
    if (!playing || !level || game.hintsUsed >= MAX_HINTS_PER_LEVEL) return
    clearHints()
    const nextValue = game.path.length + 1
    const target = findPositionForValue(level, nextValue)
    if (!target) return
    const current = game.path.at(-1)
    const candidates = current
      ? getNeighborPositions(level, current).filter((candidate) => !isPathPositionUsed(game.path, candidate))
      : [target]
    const hintStage = game.hintsUsed % MAX_HINTS_PER_LEVEL + 1
    if (hintStage === 1) {
      setHintCandidates(candidates)
      setFeedback('提示 1／4：亮起目前可以考慮的相鄰格。')
    } else if (hintStage === 2) {
      setEliminatedPositions(candidates.filter((candidate) => positionKey(candidate) !== positionKey(target)))
      setFeedback('提示 2／4：較淡的方向不會通往下一步。')
    } else if (hintStage === 3) {
      setHintTarget(target)
      setFeedback('提示 3／4：金色圓環指出下一格，但不顯示數字。')
    } else {
      setHintTarget(target)
      setRevealedPosition(target)
      setFeedback('提示 4／4：下一個隱藏數字短暫顯示。')
    }
    hintTimer.current = window.setTimeout(clearHints, hintStage === 4 ? 1_600 : 1_250)
    dispatch({ type: 'use-hint' })
  }

  const nextLevel = () => {
    if (!level) return
    const currentIndex = NUMBER_PATH_LEVELS.findIndex((candidate) => candidate.id === level.id)
    const next = currentIndex >= 0 ? NUMBER_PATH_LEVELS[currentIndex + 1] : undefined
    if (next) chooseLevel(next.id)
    else returnToLevels()
  }

  if (game.status === 'selecting') {
    const levels = levelsForDifficulty(progress.selectedDifficulty)
    return (
      <section className="number-path-card number-path-select">
        <div className="number-path-select-copy">
          <p className="eyebrow">PATH LOGIC · HIDDEN NUMBERS</p>
          <h1>讓每一個空白，<em>剛好</em>成為下一步。</h1>
          <p>數字早已固定在棋盤中。從 1 出發，依序走到最後一格，覆蓋整條不重複的路徑。</p>
          <ul className="number-rule-chips" aria-label="數字路徑玩法摘要">
            <li>只走上下左右</li>
            <li>從 1 開始</li>
            <li>依序到最後</li>
          </ul>
          <div className="number-progress-note"><strong>{solvedCount}</strong>／{NUMBER_PATH_LEVELS.length} 關已完成</div>
        </div>
        <section className="number-level-select" aria-label="數字路徑選關">
          <div className="number-difficulty-tabs" role="tablist" aria-label="選擇難度">
            {(['easy', 'normal', 'hard'] as const).map((difficulty) => (
              <button
                key={difficulty}
                type="button"
                role="tab"
                aria-selected={progress.selectedDifficulty === difficulty}
                className={progress.selectedDifficulty === difficulty ? 'is-selected' : ''}
                onClick={() => selectDifficulty(difficulty)}
              >{difficultyLabel(difficulty)}</button>
            ))}
          </div>
          <div className="number-level-grid">
            {levels.map((candidate, index) => {
              const unlocked = progress.unlockedLevelIds.includes(candidate.id)
              const completion = progress.completedByLevel[candidate.id]
              return (
                <button
                  key={candidate.id}
                  type="button"
                  className={`number-level-button${unlocked ? '' : ' is-locked'}`}
                  disabled={!unlocked}
                  onClick={() => chooseLevel(candidate.id)}
                >
                  <span>{String(index + 1).padStart(2, '0')}</span>
                  <strong>{candidate.name}</strong>
                  <small>{completion ? `最佳 ${formatTime(completion.bestTimeSeconds)}` : unlocked ? `${candidate.columns} × ${candidate.rows}` : '完成前一關解鎖'}</small>
                </button>
              )
            })}
          </div>
          <p className="number-select-footnote">每一關均由固定答案與公開提示構成；完成後會解鎖下一關。</p>
        </section>
        <PwaUpdateNotice isGameActive={false} />
      </section>
    )
  }

  if (!level) return null
  const currentValue = game.path.length
  const levelCompletion = progress.completedByLevel[level.id]

  return (
    <section className={`number-path-card number-path-play${effectsOff ? ' effects-off' : ''}`}>
      <header className="number-path-topbar">
        <div>
          <p className="eyebrow">{difficultyLabel(level.difficulty)} · {level.name}</p>
          <strong>Number Path Puzzle</strong>
        </div>
        <button type="button" className="text-button compact" disabled={paused} onClick={returnToLevels}>選關</button>
      </header>
      <section className="number-path-hud" aria-label="數字路徑遊戲資訊">
        <div><span>進度</span><strong>{currentValue}／{level.maxNumber}</strong></div>
        <div><span>錯誤</span><strong>{game.errors}</strong></div>
        <div><span>提示</span><strong>{game.hintsUsed}／{MAX_HINTS_PER_LEVEL}</strong></div>
        <div className="timer"><span>用時</span><Timer seconds={game.elapsedSeconds} label="用時" /></div>
        <button type="button" className="icon-button number-pause-button" aria-label="暫停遊戲" disabled={!playing} onClick={pauseGame}>Ⅱ</button>
      </section>
      <div className="number-path-actions" aria-label="數字路徑操作">
        <button type="button" className="quiet-button" disabled={!playing || game.path.length === 0} onClick={undo}>↩ 撤銷</button>
        <button type="button" className="quiet-button number-hint-button" disabled={!playing || game.hintsUsed >= MAX_HINTS_PER_LEVEL} onClick={useHint}>✦ 提示</button>
        <button type="button" className="quiet-button" disabled={paused} onClick={restartLevel}>↻ 重來</button>
        <details className="number-path-settings">
          <summary>棋盤設定</summary>
          <label><input type="checkbox" checked={progress.showSolvedNumbers} onChange={(event) => setProgress(setShowSolvedNumbers(event.target.checked))} /> 顯示已走過的隱藏數字</label>
        </details>
      </div>
      {paused ? (
        <div className="number-path-paused-board" aria-hidden="true"><span>∥</span><strong>路徑暫停中</strong></div>
      ) : (
        <NumberPathBoard
          level={level}
          path={game.path}
          disabled={!playing}
          showSolvedNumbers={progress.showSolvedNumbers}
          invalidPosition={invalidPosition}
          hintCandidates={hintCandidates}
          eliminatedPositions={eliminatedPositions}
          hintTarget={hintTarget}
          revealedPosition={revealedPosition}
          onAttempt={attemptPosition}
        />
      )}
      <div className="number-path-meta">
        <p role="status" aria-live="polite">{feedback}</p>
        <span>公開提示不會改變</span>
      </div>
      <p className="shortcut-tip">可點擊、按住拖曳，或以 Tab 聚焦後按 Enter；Esc 暫停。</p>

      {paused && !platformSettingsOpen ? (
        <OverlayDialog label="數字路徑已暫停" onClose={resumeGame}>
          <p className="eyebrow">PAUSED</p>
          <h2>路徑暫停中</h2>
          <p>計時器與音效已停止，棋盤不會接受操作。</p>
          <div className="dialog-actions">
            <button type="button" className="primary-button number-primary" onClick={resumeGame}>繼續推理</button>
            <button type="button" className="text-button" onClick={restartLevel}>重新開始</button>
          </div>
        </OverlayDialog>
      ) : null}

      {game.status === 'finished' ? (
        <OverlayDialog label="Number Path Puzzle 完成" onClose={returnToLevels}>
          <p className="eyebrow">PATH COMPLETE</p>
          <h2>每一步，都恰好相連。</h2>
          <strong className="result-score number-result-score">{formatTime(game.elapsedSeconds)}</strong>
          <dl className="result-stats">
            <div><dt>完成用時</dt><dd>{formatTime(game.elapsedSeconds)}</dd></div>
            <div><dt>錯誤次數</dt><dd>{game.errors}</dd></div>
            <div><dt>使用提示</dt><dd>{game.hintsUsed}</dd></div>
            <div><dt>最佳紀錄</dt><dd>{levelCompletion ? formatTime(levelCompletion.bestTimeSeconds) : '--:--'}</dd></div>
          </dl>
          <div className="dialog-actions">
            <button type="button" className="primary-button number-primary" onClick={nextLevel}>下一關</button>
            <button type="button" className="quiet-button" onClick={restartLevel}>再次挑戰</button>
            <button type="button" className="text-button" onClick={returnToLevels}>返回選關</button>
          </div>
        </OverlayDialog>
      ) : null}
      <PwaUpdateNotice isGameActive={playing || paused} />
    </section>
  )
}
