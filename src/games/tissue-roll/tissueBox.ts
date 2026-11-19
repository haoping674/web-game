import {
  BoxGeometry, BufferAttribute, CanvasTexture, DoubleSide, Group, Mesh, MeshPhysicalMaterial,
  MeshStandardMaterial, Path, PlaneGeometry, Shape, ShapeGeometry, SRGBColorSpace,
} from 'three'
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js'
import { BOX_DEPTH, BOX_HEIGHT, BOX_LENGTH, SLOT_HALF_DEPTH, SLOT_HALF_LENGTH } from './paperPhysics'

type Face = 'front' | 'top' | 'side' | 'back'

function blossom(ctx: CanvasRenderingContext2D, x: number, y: number, size: number, petals: string, turn: number) {
  ctx.save()
  ctx.translate(x, y)
  ctx.rotate(turn)
  for (let i = 0; i < 10; i++) {
    ctx.rotate(Math.PI / 5)
    ctx.beginPath()
    ctx.ellipse(0, -size * 0.52, size * 0.23, size * 0.54, i % 2 ? 0.06 : -0.15, 0, Math.PI * 2)
    ctx.fillStyle = petals
    ctx.fill()
    ctx.strokeStyle = '#fff7db78'
    ctx.lineWidth = 0.9
    ctx.stroke()
  }
  ctx.beginPath()
  ctx.arc(0, 0, size * 0.24, 0, Math.PI * 2)
  ctx.fillStyle = '#eab252'
  ctx.fill()
  for (let i = 0; i < 57; i++) {
    const rad = Math.sqrt(i / 57) * size * 0.22
    const a = i * 2.399
    ctx.fillStyle = i % 3 ? '#aa6128' : '#f8d47a'
    ctx.fillRect(Math.cos(a) * rad, Math.sin(a) * rad, 1.5, 1.5)
  }
  ctx.restore()
}

function print(face: Face): CanvasTexture {
  const canvas = document.createElement('canvas')
  canvas.width = 1024
  canvas.height = face === 'top' ? 515 : face === 'side' ? 630 : 328
  const ctx = canvas.getContext('2d')!
  const { width: w, height: h } = canvas
  const base = ctx.createLinearGradient(0, 0, w, h)
  base.addColorStop(0, '#d6e9be')
  base.addColorStop(0.56, '#b7d9b5')
  base.addColorStop(1, '#94c3aa')
  ctx.fillStyle = base
  ctx.fillRect(0, 0, w, h)

  ctx.save()
  ctx.globalAlpha = 0.36
  for (let i = 0; i < 34; i++) {
    const x = Math.sin(i * 14.1) * 575 + w / 2
    const y = Math.cos(i * 6.34) * h * 0.58 + h / 2
    ctx.fillStyle = i % 2 ? '#f9f8df' : '#7fa477'
    ctx.beginPath()
    ctx.ellipse(x, y, 20 + (i * 7 % 45), 7 + (i * 3 % 18), i * 2.01, 0, Math.PI * 2)
    ctx.fill()
  }
  ctx.restore()
  const top = face === 'top'
  const side = face === 'side'
  blossom(ctx, top ? 128 : 84, h * 0.76, top ? 156 : side ? 180 : 107, '#fff5e5', -0.35)
  blossom(ctx, w * 0.93, h * (top ? 0.79 : 0.76), top ? 208 : side ? 242 : 135, '#ed863c', 0.22)
  blossom(ctx, w * 0.79, h * 1.08, top ? 108 : 92, '#f3d983', -0.1)
  if (top) blossom(ctx, w * 0.74, -10, 95, '#fff2da', 0.4)
  const gold = ctx.createLinearGradient(0, h, w, h)
  gold.addColorStop(0, '#e2a648')
  gold.addColorStop(0.42, '#fcdfa0')
  gold.addColorStop(1, '#c48027')
  if (!top) {
    ctx.fillStyle = gold
    ctx.fillRect(0, h - 13, w, 13)
    ctx.fillStyle = '#e4eacfba'
    ctx.fillRect(w * 0.275, h * 0.065, w * 0.45, h * 0.84)
    ctx.strokeStyle = gold
    ctx.lineWidth = 4
    ctx.strokeRect(w * 0.275, h * 0.065, w * 0.45, h * 0.84)
    ctx.lineWidth = 1.4
    ctx.strokeRect(w * 0.283, h * 0.09, w * 0.434, h * 0.79)
  }

  ctx.textAlign = 'center'
  const labelY = h * (top ? 0.29 : 0.42)
  ctx.fillStyle = '#604879'
  ctx.font = '800 111px "Noto Sans TC", "Microsoft JhengHei", sans-serif'
  ctx.fillText('五月花', w / 2, labelY)
  ctx.font = '700 28px Georgia, serif'
  ctx.fillText('M A Y   F L O W E R', w / 2, labelY + 43)
  if (!top) {
    ctx.fillStyle = '#4d5d44'
    ctx.font = '700 39px "Noto Sans TC", "Microsoft JhengHei", sans-serif'
    ctx.fillText('親肌感盒裝面紙', w / 2, labelY + 103)
    ctx.font = 'italic 400 26px Georgia, serif'
    ctx.fillText('Premium Soft', w / 2, labelY + 140)
  }
  if (side || face === 'back') {
    ctx.textAlign = 'left'
    ctx.fillStyle = '#614d42'
    ctx.font = '600 38px "Microsoft JhengHei", sans-serif'
    ctx.fillText('180 抽', w * 0.07, h * 0.23)
  }

  const pixels = ctx.getImageData(0, 0, w, h)
  let seed = 18263
  for (let i = 0; i < pixels.data.length; i += 4) {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0
    const noise = ((seed >>> 26) % 9 - 4) * 0.58
    pixels.data[i] += noise
    pixels.data[i + 1] += noise
    pixels.data[i + 2] += noise
  }
  ctx.putImageData(pixels, 0, 0)
  const texture = new CanvasTexture(canvas)
  texture.colorSpace = SRGBColorSpace
  texture.anisotropy = 8
  return texture
}

function rectShape(shape: Shape | Path, hx: number, hy: number, radius: number) {
  const r = Math.min(hx, hy, radius)
  shape.moveTo(-hx + r, -hy)
  shape.lineTo(hx - r, -hy)
  shape.quadraticCurveTo(hx, -hy, hx, -hy + r)
  shape.lineTo(hx, hy - r)
  shape.quadraticCurveTo(hx, hy, hx - r, hy)
  shape.lineTo(-hx + r, hy)
  shape.quadraticCurveTo(-hx, hy, -hx, hy - r)
  shape.lineTo(-hx, -hy + r)
  shape.quadraticCurveTo(-hx, -hy, -hx + r, -hy)
}

function panelWithHole(w: number, d: number, holeX: number, holeZ: number, rounded: number) {
  const outline = new Shape()
  rectShape(outline, w / 2, d / 2, rounded)
  const hole = new Path()
  rectShape(hole, holeX, holeZ, holeZ * 0.95)
  outline.holes.push(hole)
  const geometry = new ShapeGeometry(outline, 28)
  const xy = geometry.getAttribute('position')
  const uv = new Float32Array(xy.count * 2)
  for (let i = 0; i < xy.count; i++) {
    uv[i * 2] = xy.getX(i) / w + 0.5
    uv[i * 2 + 1] = xy.getY(i) / d + 0.5
  }
  geometry.setAttribute('uv', new BufferAttribute(uv, 2))
  geometry.rotateX(-Math.PI / 2)
  return geometry
}

export function createTissueBox() {
  const root = new Group()
  const maps = (['front', 'top', 'side', 'back'] as const).map(print)
  const cardboard = new MeshStandardMaterial({ color: '#7c8557', roughness: 0.79 })
  const innerBoard = new MeshStandardMaterial({ color: '#a49a78', roughness: 0.96, side: DoubleSide })
  const printed = maps.map((map) => new MeshPhysicalMaterial({ map, roughness: 0.65, clearcoat: 0.21, clearcoatRoughness: 0.49, side: DoubleSide }))
  const base = new Mesh(new RoundedBoxGeometry(BOX_LENGTH, 0.025, BOX_DEPTH, 2, 0.011), cardboard)
  base.position.y = 0.015
  root.add(base)

  function wall(w: number, x: number, z: number, angle: number, mat: MeshPhysicalMaterial) {
    const liner = new Mesh(new BoxGeometry(w, BOX_HEIGHT - 0.032, 0.016), innerBoard)
    liner.position.set(x, BOX_HEIGHT / 2, z)
    liner.rotation.y = angle
    liner.castShadow = liner.receiveShadow = true
    root.add(liner)
    const face = new Mesh(new PlaneGeometry(w - 0.013, BOX_HEIGHT - 0.021), mat)
    face.position.set(x + Math.sin(angle) * 0.009, BOX_HEIGHT / 2 + 0.001, z + Math.cos(angle) * 0.009)
    face.rotation.y = angle
    face.receiveShadow = true
    root.add(face)
  }
  wall(BOX_LENGTH, 0, BOX_DEPTH / 2 - 0.008, 0, printed[0])
  wall(BOX_LENGTH, 0, -BOX_DEPTH / 2 + 0.008, Math.PI, printed[3])
  wall(BOX_DEPTH, BOX_LENGTH / 2 - 0.008, 0, Math.PI / 2, printed[2])
  wall(BOX_DEPTH, -BOX_LENGTH / 2 + 0.008, 0, -Math.PI / 2, printed[2])

  const cut = panelWithHole(BOX_LENGTH, BOX_DEPTH, SLOT_HALF_LENGTH + 0.034, SLOT_HALF_DEPTH + 0.035, 0.021)
  const under = new Mesh(cut, innerBoard)
  under.position.y = BOX_HEIGHT - 0.012
  const lid = new Mesh(cut, printed[1])
  lid.position.y = BOX_HEIGHT
  lid.castShadow = lid.receiveShadow = true
  root.add(under, lid)

  const filmMaterial = new MeshPhysicalMaterial({ color: '#cbcbad', transparent: true, opacity: 0.71,
    clearcoat: 1, clearcoatRoughness: 0.23, roughness: 0.42, side: DoubleSide,
  })
  const film = new Mesh(panelWithHole(1.72, 0.402, SLOT_HALF_LENGTH - 0.058, SLOT_HALF_DEPTH * 0.44, 0.18), filmMaterial)
  film.position.y = BOX_HEIGHT - 0.016
  root.add(film)
  const stack = new Mesh(new RoundedBoxGeometry(1.98, 0.12, 0.90, 2, 0.025),
    new MeshStandardMaterial({ color: '#c9bd9f', roughness: 0.98 }))
  stack.position.y = BOX_HEIGHT - 0.25
  stack.receiveShadow = true
  root.add(stack)

  // Faint folded seams from the die-cut tabs on the ends.
  const tabShade = new MeshStandardMaterial({ color: '#666b48', roughness: 0.78, transparent: true, opacity: 0.22 })
  for (const end of [-1, 1]) {
    for (const y of [0.058, BOX_HEIGHT - 0.046]) {
      const seam = new Mesh(new PlaneGeometry(BOX_DEPTH - 0.059, 0.007), tabShade)
      seam.rotation.y = end * Math.PI / 2
      seam.position.set(end * (BOX_LENGTH / 2 + 0.002), y, 0)
      root.add(seam)
    }
  }
  return { root, film, maps }
}
