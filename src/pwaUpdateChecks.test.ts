// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { startPwaUpdateChecks } from './pwaUpdateChecks'

describe('PWA update checks', () => {
  let stop: (() => void) | undefined

  beforeEach(() => {
    vi.useFakeTimers()
    vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('visible')
    vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(true)
  })

  afterEach(() => {
    stop?.()
    stop = undefined
    vi.useRealTimers()
    vi.restoreAllMocks()
  })

  function start(update = vi.fn().mockResolvedValue(undefined)) {
    const registration = {
      active: {}, installing: null, waiting: null, update,
    } as unknown as ServiceWorkerRegistration
    stop = startPwaUpdateChecks(registration)
    return { registration, update }
  }

  it('checks on registration and every minute while visible', async () => {
    const { update } = start()
    expect(update).toHaveBeenCalledTimes(1)
    await vi.advanceTimersByTimeAsync(60_000)
    expect(update).toHaveBeenCalledTimes(2)
  })

  it.each(['focus', 'online', 'pageshow', 'visibilitychange'])(
    'checks promptly on %s and coalesces nearby events', async (event) => {
      const { update } = start()
      await vi.advanceTimersByTimeAsync(10_000)
      const target = event === 'visibilitychange' ? document : window
      target.dispatchEvent(new Event(event))
      window.dispatchEvent(new Event('focus'))
      document.dispatchEvent(new Event('visibilitychange'))
      expect(update).toHaveBeenCalledTimes(2)
    },
  )

  it('waits while hidden or offline, then checks when returning online', async () => {
    const visibility = vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('hidden')
    const online = vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false)
    const { update } = start()
    await vi.advanceTimersByTimeAsync(60_000)
    expect(update).not.toHaveBeenCalled()
    visibility.mockReturnValue('visible')
    document.dispatchEvent(new Event('visibilitychange'))
    expect(update).not.toHaveBeenCalled()
    online.mockReturnValue(true)
    window.dispatchEvent(new Event('online'))
    expect(update).toHaveBeenCalledTimes(1)
  })

  it('does not overlap checks or retry while an update is installing or waiting', async () => {
    let finish: (() => void) | undefined
    const update = vi.fn(() => new Promise<void>((resolve) => { finish = resolve }))
    const { registration } = start(update)
    await vi.advanceTimersByTimeAsync(60_000)
    expect(update).toHaveBeenCalledTimes(1)
    finish?.()
    await Promise.resolve()
    Object.assign(registration, { installing: {} })
    await vi.advanceTimersByTimeAsync(60_000)
    Object.assign(registration, { installing: null, waiting: {} })
    await vi.advanceTimersByTimeAsync(60_000)
    expect(update).toHaveBeenCalledTimes(1)
  })

  it('can retry after a failed check without an unhandled rejection', async () => {
    const warning = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const error = new Error('network unavailable')
    const update = vi.fn().mockRejectedValueOnce(error).mockResolvedValue(undefined)
    start(update)
    await vi.advanceTimersByTimeAsync(60_000)
    expect(warning).toHaveBeenCalledWith('PWA update check failed', error)
    expect(update).toHaveBeenCalledTimes(2)
  })

  it('does not check before a worker is active and removes timers and listeners on cleanup', async () => {
    const { registration, update } = start()
    await vi.advanceTimersByTimeAsync(10_000)
    Object.assign(registration, { active: null })
    window.dispatchEvent(new Event('focus'))
    expect(update).toHaveBeenCalledTimes(1)
    Object.assign(registration, { active: {} })
    stop?.()
    await vi.advanceTimersByTimeAsync(60_000)
    for (const event of ['focus', 'online', 'pageshow']) window.dispatchEvent(new Event(event))
    document.dispatchEvent(new Event('visibilitychange'))
    expect(update).toHaveBeenCalledTimes(1)
  })
})
