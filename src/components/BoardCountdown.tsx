import { translate } from '../app/translate'
import type { CountdownPhase } from './countdown'
import './board-countdown.css'

type BoardCountdownProps = {
  seconds: number
  phase: CountdownPhase
  animated: boolean
}

export function BoardCountdown({ seconds, phase, animated }: BoardCountdownProps) {
  // Only the phase changes the live message; ticking digits are purely visual.
  const announcement = phase === 'critical' ? translate('時間剩下 5 秒以內。')
    : phase === 'warning' ? translate('時間剩下 10 秒以內。') : ''

  return <>
    <span className="board-countdown-ring" data-animated={animated} aria-hidden="true" />
    <span className="board-countdown-badge" aria-hidden="true">{translate("剩 ")}{Math.ceil(seconds)}{translate(" 秒")}</span>
    <span className="board-countdown-announcement" role="status" aria-live="polite" aria-atomic="true">{translate(announcement)}</span>
  </>
}
