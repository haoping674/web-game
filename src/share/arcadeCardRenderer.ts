import QRCode from 'qrcode'
import { drawFruit, drawRoundedRect, SHARE_CARD_SIZE } from './shareCardRenderer'
import { formatShareDate } from './shareText'
import { RESULT_THEMES } from './resultThemes'
import type { ArcadeShareResult } from './types'

const INK = '#293d30'
const MUTED = '#687366'
const SANS = "'Noto Sans TC', 'Outfit', sans-serif"

function fitText(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, size: number, width: number, family = SANS) {
  ctx.font = `700 ${size}px ${family}`
  while (ctx.measureText(text).width > width && size > 14) {
    size -= 1
    ctx.font = `700 ${size}px ${family}`
  }
  ctx.fillText(text, x, y)
}

function line(ctx: CanvasRenderingContext2D, x1: number, y1: number, x2: number, y2: number) {
  ctx.beginPath()
  ctx.moveTo(x1, y1)
  ctx.lineTo(x2, y2)
  ctx.stroke()
}

function drawTheme(ctx: CanvasRenderingContext2D, result: ArcadeShareResult) {
  const theme = RESULT_THEMES[result.gameId]
  ctx.fillStyle = theme.tint
  drawRoundedRect(ctx, 74, 555, 932, 225, 26)
  ctx.strokeStyle = theme.accent
  ctx.lineWidth = 5
  if (result.gameId === 'lengthSense') {
    const target = result.comparison?.target ?? 1
    const actual = result.comparison?.actual ?? 1
    const scale = 690 / Math.max(target, actual, 0.01)
    ctx.lineCap = 'round'
    line(ctx, 170, 635, 170 + target * scale, 635)
    ctx.lineWidth = 13
    line(ctx, 170, 703, 170 + actual * scale, 703)
    ctx.lineWidth = 2
    line(ctx, 170, 606, 170, 730)
    return
  }
  if (result.gameId === 'secondSense') {
    ctx.save()
    ctx.translate(540, 668)
    for (let i = 0; i < 40; i++) {
      const angle = i * Math.PI / 20
      const radius = i % 5 === 0 ? 70 : 80
      line(ctx, Math.sin(angle) * radius, Math.cos(angle) * radius, Math.sin(angle) * 91, Math.cos(angle) * 91)
    }
    const ratio = (result.comparison?.actual ?? 1) / Math.max(result.comparison?.target ?? 1, 0.01)
    const angle = (ratio - 1) * Math.PI * 2
    ctx.strokeStyle = '#9da78a'
    line(ctx, 0, 0, 0, -66)
    ctx.strokeStyle = theme.accent
    ctx.lineWidth = 8
    ctx.lineCap = 'round'
    line(ctx, 0, 0, Math.sin(angle) * 65, -Math.cos(angle) * 65)
    ctx.restore()
    return
  }
  if (result.gameId === 'colorLinks') {
    ctx.strokeStyle = theme.accent
    line(ctx, 290, 668, 790, 668)
    const colors = ['#327b77', '#fffdf5', '#327b77']
    colors.forEach((color, i) => {
      ctx.fillStyle = color
      drawRoundedRect(ctx, 235 + i * 250, 611, 112, 112, 24)
      ctx.fillStyle = i === 1 ? theme.accent : '#fffdf5'
      ctx.font = `700 50px ${SANS}`
      ctx.textAlign = 'center'
      ctx.fillText(i === 1 ? '＋' : '≋', 291 + i * 250, 686)
    })
    ctx.textAlign = 'left'
    return
  }
  ctx.textAlign = 'center'
  const fruitPositions = [240, 540, 840]
  fruitPositions.forEach((x, i) => {
    drawFruit(ctx, x, 670, 59, ['#efb87b', '#acc88d', '#f0d17b'][i])
    ctx.fillStyle = INK
    ctx.font = "700 58px 'Fraunces', serif"
    ctx.fillText(['4', '6', '10'][i], x, 690)
  })
  ctx.fillStyle = theme.accent
  ctx.font = `700 48px ${SANS}`
  ctx.fillText(result.gameId === 'slideTen' ? '→' : '+', 390, 687)
  ctx.fillText('=', 690, 687)
  ctx.textAlign = 'left'
}

export async function renderArcadeCard(result: ArcadeShareResult, createCanvas = () => document.createElement('canvas')): Promise<Blob> {
  const canvas = createCanvas()
  canvas.width = SHARE_CARD_SIZE.width
  canvas.height = SHARE_CARD_SIZE.height
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Card canvas unavailable')
  const english = result.locale === 'en'
  const theme = RESULT_THEMES[result.gameId]
  ctx.fillStyle = '#f7f7ee'
  ctx.fillRect(0, 0, canvas.width, canvas.height)
  ctx.fillStyle = '#d5ddc9'
  for (let y = 18; y < 1350; y += 28) for (let x = 18; x < 1080; x += 28) ctx.fillRect(x, y, 2, 2)
  ctx.fillStyle = '#d7deca'
  drawRoundedRect(ctx, 45, 45, 1000, 1270, 38)
  ctx.fillStyle = '#fffdf5'
  drawRoundedRect(ctx, 32, 32, 1000, 1270, 38)

  ctx.fillStyle = INK
  ctx.font = `700 27px ${SANS}`
  ctx.fillText('✦  ORCHARD ARCADE', 76, 105)
  ctx.fillStyle = MUTED
  ctx.font = `500 22px ${SANS}`
  ctx.fillText(formatShareDate(result.playedAt), 76, 143)
  ctx.fillStyle = theme.accent
  fitText(ctx, result.gameName, 74, 238, 57, 750)
  ctx.fillStyle = MUTED
  fitText(ctx, result.metricLabel, 79, 300, 30, 800)
  ctx.fillStyle = theme.accent
  fitText(ctx, result.value, 69, 487, 208, 730, "'Fraunces', serif")
  const actualWidth = ctx.measureText(result.value).width
  ctx.fillStyle = INK
  ctx.font = `700 35px ${SANS}`
  ctx.fillText(result.unit, Math.min(79 + actualWidth + 22, 870), 480)

  ctx.save()
  ctx.translate(900, 130)
  ctx.rotate(0.10)
  ctx.fillStyle = result.newBest ? theme.accent : theme.tint
  drawRoundedRect(ctx, -83, -48, 166, 96, 16)
  ctx.fillStyle = result.newBest ? '#fffdf5' : theme.accent
  ctx.textAlign = 'center'
  ctx.font = `700 21px ${SANS}`
  ctx.fillText(result.newBest ? (english ? 'PERSONAL' : '個人最佳') : 'ROUND', 0, -8)
  ctx.fillText(result.newBest ? (english ? 'BEST ↗' : '新紀錄 ↗') : (english ? 'COMPLETE' : '挑戰完成'), 0, 23)
  ctx.restore()

  ctx.fillStyle = INK
  fitText(ctx, result.headline, 79, 533, 30, 910)
  drawTheme(ctx, result)
  result.stats.slice(0, 4).forEach((stat, i) => {
    const x = 80 + i % 2 * 475
    const y = 839 + Math.floor(i / 2) * 110
    ctx.fillStyle = MUTED
    fitText(ctx, stat.label, x, y, 22, 425)
    ctx.fillStyle = INK
    fitText(ctx, stat.value, x, y + 49, 38, 425)
  })
  ctx.strokeStyle = '#d6dccd'
  ctx.lineWidth = 2
  line(ctx, 78, 1045, 987, 1045)
  ctx.fillStyle = theme.accent
  fitText(ctx, english ? 'YOUR TURN.' : '下一局，換你挑戰。', 80, 1112, 35, 620)
  ctx.fillStyle = MUTED
  const note = result.gameId === 'lengthSense'
    ? (english ? 'CSS centimeters. Screen size varies.' : '以網頁公分計算，實體長度因裝置而異。')
    : (english ? 'Play free. No download needed.' : '免費遊玩，打開就能挑戰。')
  fitText(ctx, note, 80, 1157, 24, 620)
  fitText(ctx, new URL(result.pageUrl).host, 80, 1210, 23, 620)
  fitText(ctx, new URL(result.pageUrl).pathname, 80, 1249, 21, 620)
  const qr = document.createElement('canvas')
  await QRCode.toCanvas(qr, result.pageUrl, { width: 190, margin: 4, errorCorrectionLevel: 'M', color: { dark: INK, light: '#fffdf5' } })
  ctx.drawImage(qr, 798, 1075, 190, 190)
  return new Promise((resolve, reject) => canvas.toBlob(blob => blob ? resolve(blob) : reject(new Error('PNG encoding failed')), 'image/png'))
}
