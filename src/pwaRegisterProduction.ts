import { registerSW } from 'virtual:pwa-register'

type RegisterOptions = Parameters<typeof registerSW>[0]

export function registerProductionServiceWorker(options: RegisterOptions): (reloadPage?: boolean) => Promise<void> {
  return registerSW(options)
}
