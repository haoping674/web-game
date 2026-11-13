import { translate } from '../app/translate'
export function PausedBoardPlaceholder() {
  return (
    <div className="board-frame is-paused">
      <section className="paused-board" role="status" aria-label={translate("遊戲已暫停，棋盤已隱藏")}>
        <div className="paused-board-content">
          <span className="paused-board-icon" aria-hidden="true"><i /><i /></span>
          <p className="eyebrow">BOARD HIDDEN</p>
          <h2>{translate("棋盤休息中")}</h2>
          <p>{translate("暫停期間棋盤將隱藏，以維持遊戲公平性。")}</p>
        </div>
      </section>
    </div>
  )
}
