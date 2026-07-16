import { GAME_NAME, SHARE_INVITATION, formatShareDate, shareModeLabel } from './shareText'
import type { ShareResult } from './types'

export const SHARE_CARD_SIZE = { width: 1080, height: 1350 } as const

type CanvasFactory = () => HTMLCanvasElement

function drawRoundedRect(context: CanvasRenderingContext2D, x: number, y: number, width: number, height: number, radius: number): void {
  context.beginPath()
  if (typeof context.roundRect === 'function') context.roundRect(x, y, width, height, radius)
  else {
    context.moveTo(x + radius, y)
    context.lineTo(x + width - radius, y)
    context.quadraticCurveTo(x + width, y, x + width, y + radius)
    context.lineTo(x + width, y + height - radius)
    context.quadraticCurveTo(x + width, y + height, x + width - radius, y + height)
    context.lineTo(x + radius, y + height)
    context.quadraticCurveTo(x, y + height, x, y + height - radius)
    context.lineTo(x, y + radius)
    context.quadraticCurveTo(x, y, x + radius, y)
    context.closePath()
  }
  context.fill()
}

function drawFruit(context: CanvasRenderingContext2D, x: number, y: number, radius: number, color: string): void {
  context.fillStyle = color
  context.beginPath()
  context.ellipse(x, y, radius, radius * 0.92, -0.18, 0, Math.PI * 2)
  context.fill()
  context.fillStyle = '#4b925b'
  context.beginPath()
  context.ellipse(x + radius * 0.35, y - radius * 0.9, radius * 0.38, radius * 0.16, -0.55, 0, Math.PI * 2)
  context.fill()
  context.fillStyle = 'rgb(255 255 255 / 0.38)'
  context.beginPath()
  context.ellipse(x - radius * 0.3, y - radius * 0.28, radius * 0.17, radius * 0.31, -0.4, 0, Math.PI * 2)
  context.fill()
}

function canvasToBlob(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => canvas.toBlob((blob) => {
    if (blob) resolve(blob)
    else reject(new Error('無法建立成績卡圖片。'))
  }, 'image/png'))
}

async function waitForCardFonts(): Promise<void> {
  if (!('fonts' in document)) return
  await Promise.race([
    document.fonts.ready.catch(() => undefined),
    new Promise<void>((resolve) => window.setTimeout(resolve, 700)),
  ])
}

export async function renderShareCard(result: ShareResult, createCanvas: CanvasFactory = () => document.createElement('canvas')): Promise<Blob> {
  await waitForCardFonts()
  const canvas = createCanvas()
  canvas.width = SHARE_CARD_SIZE.width
  canvas.height = SHARE_CARD_SIZE.height
  const context = canvas.getContext('2d')
  if (!context) throw new Error('此瀏覽器無法產生成績卡。')

  const { width, height } = SHARE_CARD_SIZE
  const background = context.createLinearGradient(0, 0, width, height)
  background.addColorStop(0, '#e8f0dc')
  background.addColorStop(1, '#cde5c6')
  context.fillStyle = background
  context.fillRect(0, 0, width, height)
  context.fillStyle = 'rgb(39 50 47 / 0.08)'
  for (let y = 58; y < height; y += 48) for (let x = 48; x < width; x += 48) context.fillRect(x, y, 3, 3)

  drawFruit(context, 915, 135, 125, '#f5866e')
  drawFruit(context, 970, 310, 72, '#f4c958')
  drawFruit(context, 835, 360, 55, '#9fcd73')
  context.fillStyle = '#fffdf6'
  drawRoundedRect(context, 70, 80, 810, 1040, 42)
  context.strokeStyle = '#27322f'
  context.lineWidth = 5
  context.strokeRect(72.5, 82.5, 805, 1035)

  context.fillStyle = '#df604b'
  context.font = "700 44px 'DM Mono', monospace"
  context.fillText('✦  ORCHARD TEN', 130, 190)
  context.fillStyle = '#68746c'
  context.font = "700 30px 'Noto Sans TC', sans-serif"
  context.fillText(shareModeLabel(result.mode), 130, 250)

  context.fillStyle = '#27322f'
  context.font = "700 42px 'Noto Sans TC', sans-serif"
  context.fillText('本次分數', 130, 365)
  context.fillStyle = '#df604b'
  context.font = "700 250px Fraunces, serif"
  context.fillText(String(result.score), 120, 585)
  context.fillStyle = '#a54034'
  context.font = "700 34px 'DM Mono', monospace"
  context.fillText('POINTS', 130, 640)

  context.fillStyle = '#d1e8c7'
  drawRoundedRect(context, 120, 710, 680, 170, 26)
  context.fillStyle = '#27322f'
  context.font = "700 30px 'Noto Sans TC', sans-serif"
  context.fillText(`最高 Combo  ${result.maxCombo}`, 160, 775)
  context.fillText(`消除水果  ${result.clearedFruitCount}`, 160, 835)

  context.fillStyle = '#68746c'
  context.font = "700 27px 'Noto Sans TC', sans-serif"
  const challenge = result.mode === 'daily' ? `每日挑戰 #${result.dailyChallengeId ?? formatShareDate(result.playedAt).replaceAll('-', '')}` : formatShareDate(result.playedAt)
  context.fillText(challenge, 130, 970)
  context.fillStyle = '#27322f'
  context.font = "700 35px 'Noto Sans TC', sans-serif"
  context.fillText(SHARE_INVITATION, 130, 1045)
  context.fillStyle = '#27322f'
  context.font = "500 25px 'DM Mono', monospace"
  context.fillText(new URL(result.pageUrl).host, 70, 1230)
  context.fillText(GAME_NAME.toUpperCase(), 70, 1280)
  return canvasToBlob(canvas)
}
