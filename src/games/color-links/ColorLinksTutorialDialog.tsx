import { useState } from 'react'
import { OverlayDialog } from '../../components/OverlayDialog'

const steps = [
  {
    title: '先找空格',
    description: '只能點擊空格。它會向上、右、下、左四個方向，尋找每個方向最近的一顆色塊。',
    illustration: 'origin',
  },
  {
    title: '連結兩個同色訊號',
    description: '如果至少兩個方向的最近色塊顏色相同，空格便能把它們連起來並消除。',
    illustration: 'match',
  },
  {
    title: '清空整張棋盤',
    description: '每次成功連結都會留下新空格，創造下一次機會。清除所有色塊即可完成。',
    illustration: 'clear',
  },
] as const

type IllustrationKind = (typeof steps)[number]['illustration']

type ColorLinksTutorialDialogProps = {
  onComplete: () => void
  onSkip: () => void
}

function ColorLinksTutorialIllustration({ kind }: { kind: IllustrationKind }) {
  if (kind === 'origin') {
    return (
      <svg viewBox="0 0 300 156" role="img" aria-label="空格向四個方向尋找最近色塊的示意圖">
        <g className="color-tutorial-grid">
          <path d="M63 30 H237 M63 78 H237 M63 126 H237 M63 30 V126 M121 30 V126 M179 30 V126 M237 30 V126" />
        </g>
        <rect className="color-tutorial-empty" x="128" y="55" width="44" height="44" rx="10" />
        <path className="color-tutorial-reticle" d="M150 42 V49 M150 105 V114 M115 77 H123 M177 77 H185" />
        <rect className="color-tutorial-tile is-coral" x="72" y="58" width="38" height="38" rx="9" /><text x="91" y="84">●</text>
        <rect className="color-tutorial-tile is-teal" x="190" y="58" width="38" height="38" rx="9" /><text x="209" y="84">≋</text>
        <rect className="color-tutorial-tile is-amber" x="131" y="108" width="38" height="38" rx="9" /><text x="150" y="134">◆</text>
        <text className="color-tutorial-caption" x="150" y="20">從空格向四方向讀取訊號</text>
      </svg>
    )
  }

  if (kind === 'match') {
    return (
      <svg viewBox="0 0 300 156" role="img" aria-label="空格將兩個同色訊號連結起來的示意圖">
        <path className="color-tutorial-signal" d="M65 78 H129 M171 78 H235" />
        <path className="color-tutorial-signal is-muted" d="M150 100 V128" />
        <rect className="color-tutorial-tile is-teal" x="43" y="56" width="44" height="44" rx="11" /><text x="65" y="84">≋</text>
        <rect className="color-tutorial-empty" x="128" y="56" width="44" height="44" rx="11" />
        <rect className="color-tutorial-tile is-teal" x="213" y="56" width="44" height="44" rx="11" /><text x="235" y="84">≋</text>
        <rect className="color-tutorial-tile is-coral is-dim" x="128" y="112" width="44" height="30" rx="9" /><text x="150" y="134">●</text>
        <path className="color-tutorial-check" d="M118 123 L129 134 L153 108" />
        <text className="color-tutorial-caption" x="150" y="20">兩個最近同色訊號，即可連線</text>
      </svg>
    )
  }

  return (
    <svg viewBox="0 0 300 156" role="img" aria-label="連結成功後色塊消除並留下新空格的示意圖">
      <g className="color-tutorial-grid is-soft">
        <path d="M78 38 H222 M78 78 H222 M78 118 H222 M78 38 V118 M126 38 V118 M174 38 V118 M222 38 V118" />
      </g>
      <rect className="color-tutorial-empty" x="129" y="57" width="42" height="42" rx="10" />
      <circle className="color-tutorial-burst" cx="150" cy="78" r="31" />
      <path className="color-tutorial-spark" d="M150 37 V48 M150 108 V119 M109 78 H120 M180 78 H191 M121 49 L129 57 M171 99 L179 107 M179 49 L171 57 M129 99 L121 107" />
      <text className="color-tutorial-score" x="150" y="86">＋3</text>
      <text className="color-tutorial-caption" x="150" y="142">持續連結，直到所有色塊都消失</text>
    </svg>
  )
}

export function ColorLinksTutorialDialog({ onComplete, onSkip }: ColorLinksTutorialDialogProps) {
  const [step, setStep] = useState(0)
  const current = steps[step]!
  const isLastStep = step === steps.length - 1

  return (
    <OverlayDialog label="Color Links 新手教學" onClose={onSkip}>
      <p className="eyebrow color-tutorial-kicker">新手引導 {step + 1} / {steps.length}</p>
      <div className="color-links-tutorial-illustration">
        <ColorLinksTutorialIllustration kind={current.illustration} />
      </div>
      <h2>{current.title}</h2>
      <p>{current.description}</p>
      <div className="color-tutorial-progress" aria-label={`第 ${step + 1} 步，共 ${steps.length} 步`}>
        {steps.map((item, index) => <span key={item.title} className={index === step ? 'is-current' : index < step ? 'is-complete' : ''} />)}
      </div>
      <div className="dialog-actions color-tutorial-actions">
        <button type="button" className="primary-button color-primary" onClick={() => isLastStep ? onComplete() : setStep((value) => value + 1)}>
          {isLastStep ? '開始串聯' : '下一步'}
        </button>
        <button type="button" className="text-button" onClick={onSkip}>略過說明並開始</button>
      </div>
    </OverlayDialog>
  )
}
