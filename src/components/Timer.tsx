import { translate } from '../app/translate'
import type { CountdownPhase } from './countdown'

type TimerProps = { seconds: number; phase?: CountdownPhase; label?: string }

export function Timer({ seconds, phase = 'idle', label = translate('剩餘') }: TimerProps) {
  const minutes = Math.floor(seconds / 60)
  const remainder = seconds % 60
  return <strong className="timer-countdown" data-countdown-phase={phase} aria-label={translate(`${label}`) + ` ${minutes} ${translate('分鐘')} ${remainder} ${translate('秒')}`}>{String(minutes).padStart(2, '0')}:{String(remainder).padStart(2, '0')}</strong>
}
