type InstallAppButtonProps = { canInstall: boolean; isInstalled: boolean; ios: boolean; onInstall: () => Promise<void>; onIosInstructions: () => void }

export function InstallAppButton({ canInstall, isInstalled, ios, onInstall, onIosInstructions }: InstallAppButtonProps) {
  if (!canInstall || isInstalled) return null
  return <button type="button" className="text-button" onClick={() => { if (ios) onIosInstructions(); else void onInstall() }}>安裝遊戲</button>
}
