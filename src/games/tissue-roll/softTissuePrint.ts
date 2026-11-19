import { CanvasTexture, SRGBColorSpace } from 'three'
import { BOX_DEPTH, BOX_LENGTH, LIP_HALF_DEPTH, LIP_HALF_LENGTH } from './tissueDimensions'

export type SoftTissueBrand = 'soft-kleenex' | 'soft-mayflower' | 'soft-kirkland'

const sans = '"Microsoft JhengHei", "Noto Sans TC", sans-serif'
type Print = (ctx: CanvasRenderingContext2D, w: number, h: number, top: boolean) => void

function ribbon(ctx: CanvasRenderingContext2D, w: number, h: number, colors: [string, string, string]) {
  const background = ctx.createLinearGradient(0, -h * 0.2, w * 0.88, h)
  background.addColorStop(0, colors[0])
  background.addColorStop(0.56, colors[1])
  background.addColorStop(1, colors[2])
  ctx.fillStyle = background
  ctx.fillRect(0, 0, w, h)
}

function dandelion(ctx: CanvasRenderingContext2D, x: number, y: number, radius: number, bloom: number) {
  ctx.strokeStyle = '#e4f3c8c9'
  ctx.lineWidth = 1.5
  ctx.beginPath()
  ctx.moveTo(x - radius * 0.4, y + radius * 3.7)
  ctx.quadraticCurveTo(x + radius * 0.12, y + radius * 1.6, x, y)
  ctx.stroke()
  for (let i = 0; i < 46; i++) {
    const angle = i * 2.399 + bloom
    const end = 0.29 + Math.sqrt(i / 46) * 0.71
    const u = Math.cos(angle)
    const v = Math.sin(angle)
    const ex = x + u * radius * end
    const ey = y + v * radius * end
    ctx.strokeStyle = i % 3 ? '#f9fff0c4' : '#f0f4c880'
    ctx.lineWidth = i % 4 ? 0.65 : 1.2
    ctx.beginPath()
    ctx.moveTo(x + u * radius * 0.18, y + v * radius * 0.18)
    ctx.lineTo(ex, ey)
    ctx.moveTo(ex - u * 1.5, ey - v * 1.5)
    ctx.lineTo(ex - v * 4, ey + u * 4)
    ctx.moveTo(ex - u * 1.5, ey - v * 1.5)
    ctx.lineTo(ex + v * 4, ey - u * 4)
    ctx.stroke()
  }
}

function puppy(ctx: CanvasRenderingContext2D, x: number, y: number) {
  ctx.save()
  ctx.translate(x, y)
  const coat = ctx.createLinearGradient(-22, -24, 21, 25)
  coat.addColorStop(0, '#f1d39a')
  coat.addColorStop(0.65, '#d5a465')
  coat.addColorStop(1, '#9e723f')
  ctx.fillStyle = coat
  ctx.beginPath()
  ctx.ellipse(0, 15, 19, 17, 0, 0, Math.PI * 2)
  ctx.fill()
  ctx.fillStyle = '#ad7945'
  for (const side of [-1, 1]) {
    ctx.beginPath()
    ctx.ellipse(side * 15, 0, 7.5, 14, side * -0.38, 0, Math.PI * 2)
    ctx.fill()
  }
  ctx.fillStyle = coat
  ctx.beginPath()
  ctx.ellipse(0, -3, 14, 14.3, 0, 0, Math.PI * 2)
  ctx.fill()
  ctx.fillStyle = '#f7ddb1'
  ctx.beginPath()
  ctx.ellipse(0, 4, 8, 6, 0, 0, Math.PI * 2)
  ctx.fill()
  ctx.fillStyle = '#46311e'
  for (const [ex, ey, size] of [[-6, -5, 1.7], [6, -5, 1.7], [0, 3, 2.6]]) {
    ctx.beginPath()
    ctx.ellipse(ex, ey, size, size * 0.8, 0, 0, Math.PI * 2)
    ctx.fill()
  }
  ctx.restore()
}

const kleenex: Print = (ctx, w, h, top) => {
  ribbon(ctx, w, h, ['#387b07', '#9bc73b', '#286718'])
  for (let i = 0; i < 34; i++) {
    const x = (Math.sin(i * 12.31) * 0.48 + 0.5) * w
    const y = (Math.cos(i * 18.27) * 0.49 + 0.50) * h
    const glow = ctx.createRadialGradient(x, y, 1, x, y, 5 + i % 9)
    glow.addColorStop(0, '#f8ffe6b5')
    glow.addColorStop(1, '#e6ffc100')
    ctx.fillStyle = glow
    ctx.fillRect(x - 15, y - 15, 30, 30)
  }
  dandelion(ctx, w * 0.13, h * 0.66, h * 0.21, 1)
  dandelion(ctx, w * 0.89, h * 0.72, h * 0.20, 0)
  dandelion(ctx, w * 0.78, h * 0.54, h * 0.095, 2)

  ctx.beginPath()
  ctx.moveTo(w * 0.18, h * 0.22)
  ctx.quadraticCurveTo(w * 0.36, h * 0.12, w * 0.50, h * 0.045)
  ctx.quadraticCurveTo(w * 0.69, h * 0.11, w * 0.79, h * 0.22)
  ctx.quadraticCurveTo(w * 0.69, h * 0.37, w * 0.72, h * 0.61)
  ctx.quadraticCurveTo(w * 0.69, h * 0.90, w * 0.49, h * 0.95)
  ctx.quadraticCurveTo(w * 0.27, h * 0.92, w * 0.26, h * 0.64)
  ctx.quadraticCurveTo(w * 0.31, h * 0.36, w * 0.18, h * 0.22)
  ctx.fillStyle = '#fffcec'
  ctx.fill()
  ctx.strokeStyle = '#547928'
  ctx.lineWidth = 5
  ctx.stroke()

  if (!top) puppy(ctx, w * 0.49, h * 0.13)
  ctx.fillStyle = '#133b70'
  ctx.textAlign = 'center'
  ctx.font = 'italic 700 49px Georgia, serif'
  ctx.fillText('Kleenex', w * 0.49, h * (top ? 0.68 : 0.36))
  ctx.font = `900 ${top ? 62 : 117}px ${sans}`
  ctx.fillText('舒潔', w * 0.49, h * (top ? 0.85 : 0.72))
  if (!top) {
    ctx.fillStyle = '#34811e'
    ctx.font = `700 26px ${sans}`
    ctx.fillText('抽取式衛生紙', w * 0.49, h * 0.85)
  }
  ctx.beginPath()
  ctx.ellipse(w * 0.88, h * 0.26, w * 0.073, h * 0.18, 0.12, 0, Math.PI * 2)
  ctx.fillStyle = '#123b82'
  ctx.fill()
  ctx.strokeStyle = '#f8d96b'
  ctx.lineWidth = 5
  ctx.stroke()
  ctx.fillStyle = '#f9e499'
  ctx.font = `700 28px ${sans}`
  ctx.fillText('柔韌', w * 0.88, h * 0.295)
  ctx.fillStyle = '#174c45'
  ctx.fillRect(w * 0.045, h * 0.16, w * 0.12, h * 0.40)
  ctx.strokeStyle = '#ecce86'
  ctx.lineWidth = 3
  ctx.strokeRect(w * 0.045, h * 0.16, w * 0.12, h * 0.40)
  ctx.fillStyle = '#fae3a3'
  ctx.font = `700 23px ${sans}`
  ctx.fillText('舒適', w * 0.105, h * 0.335)
  ctx.fillText('柔抽', w * 0.105, h * 0.475)
}

const mayflower: Print = (ctx, w, h, top) => {
  ribbon(ctx, w, h, ['#0b1638', '#153465', '#080f2c'])
  ctx.strokeStyle = '#6e84b03b'
  ctx.lineWidth = 2
  for (let i = 0; i < 13; i++) {
    ctx.beginPath()
    ctx.moveTo(0, h * 0.60 + i * 6)
    ctx.bezierCurveTo(w * 0.29, h * 0.37 + i * 5, w * 0.76, h * 1.20 + i * 6, w, h * 0.64 + i * 4)
    ctx.stroke()
  }
  const gold = ctx.createLinearGradient(0, h * 0.18, 0, h * 0.87)
  gold.addColorStop(0, '#ffecab')
  gold.addColorStop(0.48, '#b98b45')
  gold.addColorStop(0.70, '#feeab0')
  gold.addColorStop(1, '#c29764')
  ctx.fillStyle = gold
  ctx.textAlign = 'center'
  ctx.font = `900 ${top ? 118 : 194}px "PMingLiU", "Microsoft JhengHei", serif`
  ctx.fillText('厚', w * 0.54, h * (top ? 0.88 : 0.83))
  ctx.textAlign = 'left'
  ctx.fillStyle = '#f4e9c9'
  ctx.font = `800 35px ${sans}`
  ctx.fillText('五月花', w * 0.11, h * 0.32)
  ctx.font = '700 18px Georgia, serif'
  ctx.fillText('MAY FLOWER', w * 0.11, h * 0.44)
  ctx.font = `600 21px ${sans}`
  ctx.fillText('厚感抽取式', w * 0.11, h * 0.72)
}

const kirkland: Print = (ctx, w, h, top) => {
  ribbon(ctx, w, h, ['#54406f', '#a68ac8', '#705293'])
  ctx.strokeStyle = '#eddcff59'
  ctx.lineWidth = 1.4
  for (let x = 0; x <= w + 32; x += 32) for (let y = 0; y <= h + 28; y += 28) {
    ctx.beginPath()
    for (const angle of [0, Math.PI / 3, -Math.PI / 3]) {
      ctx.moveTo(x + 15 * Math.cos(angle), y + 15 * Math.sin(angle))
      ctx.ellipse(x, y, 15, 4.7, angle, 0, 2 * Math.PI)
    }
    ctx.stroke()
  }
  const labelY = h * (top ? 0.68 : 0.26)
  const labelBottom = h * (top ? 0.89 : 0.76)
  ctx.beginPath()
  for (const [x, y] of [[0.23, labelY], [0.71, labelY], [0.76, labelY + 20], [0.76, labelBottom - 20],
    [0.71, labelBottom], [0.23, labelBottom], [0.18, labelBottom - 20], [0.18, labelY + 20]]) {
    ctx.lineTo(w * x, y)
  }
  ctx.closePath()
  ctx.fillStyle = '#807092'
  ctx.fill()
  ctx.strokeStyle = '#251e29'
  ctx.lineWidth = 15
  ctx.stroke()
  ctx.strokeStyle = '#fff7fa'
  ctx.lineWidth = 9
  ctx.stroke()
  ctx.textAlign = 'center'
  ctx.fillStyle = '#fff8ff'
  ctx.font = `800 ${top ? 37 : 50}px ${sans}`
  ctx.fillText('抽取式衛生紙', w * 0.47, (labelY + labelBottom) / 2 + h * (top ? 0.045 : 0.11))
  if (top) return

  ctx.fillStyle = '#141217'
  ctx.fillRect(w * 0.33, h * 0.16, w * 0.29, h * 0.19)
  ctx.fillStyle = '#fff'
  ctx.font = '900 29px Arial, sans-serif'
  ctx.fillText('KIRKLAND', w * 0.475, h * 0.257)
  ctx.font = 'italic 700 24px Georgia, serif'
  ctx.fillStyle = '#e43144'
  ctx.fillText('Signature', w * 0.475, h * 0.327)
  ctx.fillStyle = '#251b32'
  ctx.font = '700 21px Arial, sans-serif'
  ctx.fillText('120 SHEETS · 19 cm × 20 cm', w * 0.47, h * 0.89)
  ctx.fillStyle = '#201c22'
  ctx.fillRect(w * 0.79, h * 0.71, w * 0.14, h * 0.175)
  ctx.fillStyle = '#fff'
  ctx.font = '800 26px Arial, sans-serif'
  ctx.fillText('3-PLY', w * 0.86, h * 0.835)
}

const artwork = { 'soft-kleenex': kleenex, 'soft-mayflower': mayflower, 'soft-kirkland': kirkland } satisfies Record<SoftTissueBrand, Print>

export function printSoftTissue(brand: SoftTissueBrand, top: boolean) {
  const canvas = document.createElement('canvas')
  canvas.width = 768
  canvas.height = top ? 384 : 288
  const ctx = canvas.getContext('2d')!
  const { width: w, height: h } = canvas
  artwork[brand](ctx, w, h, top)
  if (top) {
    const slotW = (LIP_HALF_LENGTH + 0.045) / BOX_LENGTH * w * 2
    const slotH = (LIP_HALF_DEPTH + 0.018) / BOX_DEPTH * h * 2
    ctx.beginPath()
    ctx.roundRect((w - slotW) / 2, (h - slotH) / 2, slotW, slotH, slotH * (brand === 'soft-kirkland' ? 0.20 : 0.45))
    ctx.strokeStyle = brand === 'soft-mayflower' ? '#b3c5e8' : '#eee7d9'
    ctx.lineWidth = 8
    ctx.stroke()
    ctx.globalCompositeOperation = 'destination-out'
    ctx.fill()
  }
  const texture = new CanvasTexture(canvas)
  texture.colorSpace = SRGBColorSpace
  return texture
}
