import { translate } from '../app/translate'
type SettingsPanelProps = { soundEnabled: boolean; lowStimulus: boolean; onToggleSound: () => void; onToggleLowStimulus: () => void }
export function SettingsPanel({ soundEnabled, lowStimulus, onToggleSound, onToggleLowStimulus }: SettingsPanelProps) {
  return <div className="settings-panel" aria-label={translate("遊戲設定")}><button type="button" className="setting-button" aria-pressed={soundEnabled} onClick={onToggleSound}><span aria-hidden="true">{translate(soundEnabled ? '♩' : '♪̸')}</span>{translate(" 音效：")}{translate(soundEnabled ? translate('開') : translate('關'))}</button><button type="button" className="setting-button" aria-pressed={lowStimulus} onClick={onToggleLowStimulus}><span aria-hidden="true">◐</span>{translate(" 淡色模式")}</button></div>
}
