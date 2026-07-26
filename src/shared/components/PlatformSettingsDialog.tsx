import { OverlayDialog } from '../../components/OverlayDialog'
import type { GlobalSettings } from '../storage/appStorage'

type PlatformSettingsDialogProps = {
  settings: GlobalSettings
  onChange: (settings: GlobalSettings) => void
  onClose: () => void
}

export function PlatformSettingsDialog({ settings, onChange, onClose }: PlatformSettingsDialogProps) {
  const setIntensity = (effectIntensity: GlobalSettings['effectIntensity']) => {
    onChange({ ...settings, effectIntensity, reducedMotion: effectIntensity !== 'full' })
  }
  return (
    <OverlayDialog label="共用遊戲設定" onClose={onClose}>
      <p className="eyebrow">SHARED SETTINGS</p>
      <h2>共用設定</h2>
      <p>音效與動態強度會套用到兩款遊戲；分數與遊戲進度仍各自保存。</p>
      <div className="settings-list">
        <label>
          <span>音效</span>
          <input
            type="checkbox"
            checked={settings.soundEnabled}
            onChange={(event) => onChange({ ...settings, soundEnabled: event.target.checked })}
          />
        </label>
        <label>
          <span>動態強度</span>
          <select
            aria-label="動態強度"
            value={settings.effectIntensity}
            onChange={(event) => setIntensity(event.target.value as GlobalSettings['effectIntensity'])}
          >
            <option value="full">完整</option>
            <option value="reduced">減少</option>
            <option value="off">關閉</option>
          </select>
        </label>
      </div>
      <button type="button" className="primary-button" onClick={onClose}>完成</button>
    </OverlayDialog>
  )
}
