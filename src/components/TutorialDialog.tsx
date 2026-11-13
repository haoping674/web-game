import { translate } from '../app/translate'
import { useState } from 'react'
import { OverlayDialog } from './OverlayDialog'

const steps = [
  [translate('開始框選'), translate('按住滑鼠或手指，從一顆水果拖向另一顆。')],
  [translate('矩形範圍'), translate('只有框在同一個矩形內的數字會被計算。')],
  [translate('湊成 10'), translate('框內總和剛好為 10，就會消除水果並得分。')],
  [translate('掌握節奏'), translate('在倒數結束前盡量連續成功，累積 Combo。')],
] as const
type TutorialDialogProps = { onComplete: () => void; onSkip: () => void }
export function TutorialDialog({ onComplete, onSkip }: TutorialDialogProps) {
  const [step, setStep] = useState(0)
  const [title, description] = steps[step]!
  const done = step === steps.length - 1
  return <OverlayDialog label={translate("新手教學")} onClose={onSkip}><p className="eyebrow">{translate("新手引導 ")}{step + 1} / {steps.length}</p><div className="tutorial-demo" aria-hidden="true"><span>1</span><span>9</span><i>＝ 10</i></div><h2>{translate(title)}</h2><p>{translate(description)}</p><div className="dialog-actions"><button type="button" className="primary-button" onClick={() => done ? onComplete() : setStep((current) => current + 1)}>{translate(done ? translate('完成') : translate('下一步'))}</button><button type="button" className="text-button" onClick={onSkip}>{translate("跳過")}</button></div></OverlayDialog>
}
