import { useState } from 'react'
import { OverlayDialog } from '../../components/OverlayDialog'

const steps = [
  {
    title: '從 1 開始找路',
    description: '先點選數字 1，再依照遞增順序連上下一個數字。已公開的數字是你判斷路徑的重要線索。',
    illustration: 'start',
  },
  {
    title: '下一步必須相鄰',
    description: '下一個數字要在目前位置的八個相鄰格內；斜角相連也可以。點擊或按住拖曳，都能延伸路徑。',
    illustration: 'neighbor',
  },
  {
    title: '一路連到最後',
    description: '不能跳號、重複踩格，或穿過障礙。走錯時可復原上一步；卡住時使用提示找出下一段路。',
    illustration: 'finish',
  },
] as const

type IllustrationKind = (typeof steps)[number]['illustration']

type NumberPathTutorialDialogProps = {
  onComplete: () => void
  onSkip: () => void
}

function NumberPathTutorialIllustration({ kind }: { kind: IllustrationKind }) {
  if (kind === 'start') {
    return (
      <svg viewBox="0 0 300 156" role="img" aria-label="從數字 1 沿著路線前往數字 2 的示意圖">
        <path className="number-tutorial-route" d="M65 102 C102 93 106 54 145 54" />
        <path className="number-tutorial-arrow" d="M141 48 L154 53 L144 64" />
        <circle className="number-tutorial-cell is-active" cx="64" cy="103" r="25" /><text x="64" y="111">1</text>
        <circle className="number-tutorial-cell is-target" cx="154" cy="53" r="25" /><text x="154" y="61">2</text>
        <circle className="number-tutorial-cell" cx="238" cy="104" r="25" /><text x="238" y="112">?</text>
        <path className="number-tutorial-spark" d="M42 49 L47 57 L56 61 L47 65 L42 74 L37 65 L28 61 L37 57 Z" />
        <text className="number-tutorial-caption" x="150" y="142">由 1 開始，逐格找下一個數字</text>
      </svg>
    )
  }

  if (kind === 'neighbor') {
    return (
      <svg viewBox="0 0 300 156" role="img" aria-label="數字可往八個相鄰方向連接的示意圖">
        <g className="number-tutorial-neighbors">
          {[['74', '37'], ['150', '37'], ['226', '37'], ['74', '89'], ['226', '89'], ['74', '141'], ['150', '141'], ['226', '141']].map(([x, y]) => <circle key={`${x}-${y}`} cx={x} cy={y} r="18" />)}
        </g>
        <g className="number-tutorial-rays">
          <path d="M136 75 L88 45" /><path d="M150 70 L150 52" /><path d="M164 75 L212 45" />
          <path d="M132 89 L96 89" /><path d="M168 89 L204 89" />
          <path d="M136 103 L88 133" /><path d="M150 108 L150 126" /><path d="M164 103 L212 133" />
        </g>
        <circle className="number-tutorial-cell is-active" cx="150" cy="89" r="27" /><text x="150" y="97">2</text>
        <circle className="number-tutorial-cell is-target" cx="226" cy="37" r="18" /><text x="226" y="43">3</text>
        <text className="number-tutorial-caption" x="150" y="154">上下左右與斜角都算相鄰</text>
      </svg>
    )
  }

  return (
    <svg viewBox="0 0 300 156" role="img" aria-label="依序連接所有數字直到完成的示意圖">
      <path className="number-tutorial-route" d="M57 99 L106 55 L159 98 L214 52" />
      <circle className="number-tutorial-cell is-active" cx="57" cy="99" r="21" /><text x="57" y="106">1</text>
      <circle className="number-tutorial-cell is-active" cx="106" cy="55" r="21" /><text x="106" y="62">2</text>
      <circle className="number-tutorial-cell is-active" cx="159" cy="98" r="21" /><text x="159" y="105">3</text>
      <circle className="number-tutorial-cell is-target" cx="214" cy="52" r="21" /><text x="214" y="59">4</text>
      <path className="number-tutorial-finish" d="M247 90 L255 99 L272 78" />
      <text className="number-tutorial-caption" x="150" y="142">連完最後一個數字，即完成關卡</text>
    </svg>
  )
}

export function NumberPathTutorialDialog({ onComplete, onSkip }: NumberPathTutorialDialogProps) {
  const [step, setStep] = useState(0)
  const current = steps[step]!
  const isLastStep = step === steps.length - 1

  return (
    <OverlayDialog label="Number Path Puzzle 新手教學" onClose={onSkip}>
      <p className="eyebrow number-tutorial-kicker">新手引導 {step + 1} / {steps.length}</p>
      <div className="number-path-tutorial-illustration">
        <NumberPathTutorialIllustration kind={current.illustration} />
      </div>
      <h2>{current.title}</h2>
      <p>{current.description}</p>
      <div className="number-tutorial-progress" aria-label={`第 ${step + 1} 步，共 ${steps.length} 步`}>
        {steps.map((item, index) => <span key={item.title} className={index === step ? 'is-current' : index < step ? 'is-complete' : ''} />)}
      </div>
      <div className="dialog-actions number-tutorial-actions">
        <button type="button" className="primary-button number-primary" onClick={() => isLastStep ? onComplete() : setStep((value) => value + 1)}>
          {isLastStep ? '開始這一關' : '下一步'}
        </button>
        <button type="button" className="text-button" onClick={onSkip}>略過說明並開始</button>
      </div>
    </OverlayDialog>
  )
}
