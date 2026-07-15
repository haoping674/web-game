type SettingsPanelProps = { soundEnabled: boolean; lowStimulus: boolean; onToggleSound: () => void; onToggleLowStimulus: () => void }
export function SettingsPanel({ soundEnabled, lowStimulus, onToggleSound, onToggleLowStimulus }: SettingsPanelProps) {
  return <div className="settings-panel" aria-label="遊戲設定"><button type="button" className="setting-button" aria-pressed={soundEnabled} onClick={onToggleSound}><span aria-hidden="true">{soundEnabled ? '♩' : '♪̸'}</span> 音效：{soundEnabled ? '開' : '關'}</button><button type="button" className="setting-button" aria-pressed={lowStimulus} onClick={onToggleLowStimulus}><span aria-hidden="true">◐</span> 淡色模式</button></div>
}
