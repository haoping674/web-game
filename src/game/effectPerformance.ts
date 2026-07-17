export const MAX_PARTICLES = 36

type DeviceCapabilities = { hardwareConcurrency?: number; deviceMemory?: number }

export function getDeviceEffectScale(device?: DeviceCapabilities): number {
  const capabilities = device ?? (typeof navigator === 'undefined' ? undefined : navigator as Navigator & DeviceCapabilities)
  if (!capabilities) return 1
  const fewCores = typeof capabilities.hardwareConcurrency === 'number' && capabilities.hardwareConcurrency > 0 && capabilities.hardwareConcurrency <= 4
  const lowMemory = typeof capabilities.deviceMemory === 'number' && capabilities.deviceMemory > 0 && capabilities.deviceMemory <= 4
  return fewCores || lowMemory ? 0.55 : 1
}
