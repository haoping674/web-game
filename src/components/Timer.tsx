type TimerProps = { seconds: number; urgent?: boolean; label?: string }

export function Timer({ seconds, urgent = false, label = '剩餘' }: TimerProps) {
  const minutes = Math.floor(seconds / 60)
  const remainder = seconds % 60
  return <strong className={urgent ? 'is-urgent' : ''} aria-label={`${label} ${minutes} 分 ${remainder} 秒`}>{String(minutes).padStart(2, '0')}:{String(remainder).padStart(2, '0')}</strong>
}
