type TimerProps = { seconds: number; urgent?: boolean }

export function Timer({ seconds, urgent = false }: TimerProps) {
  const minutes = Math.floor(seconds / 60)
  const remainder = seconds % 60
  return <strong className={urgent ? 'is-urgent' : ''} aria-label={`剩餘 ${minutes} 分 ${remainder} 秒`}>{String(minutes).padStart(2, '0')}:{String(remainder).padStart(2, '0')}</strong>
}
