import {
  BoxGeometry, BufferAttribute, CanvasTexture, DoubleSide, Group, Mesh, MeshPhysicalMaterial,
  MeshStandardMaterial, Path, PlaneGeometry, Shape, ShapeGeometry, SRGBColorSpace, Vector3,
} from 'three'
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js'
import { printSoftTissue, type SoftTissueBrand } from './softTissuePrint'
import { BOX_DEPTH, BOX_HEIGHT, BOX_LENGTH, LIP_HALF_DEPTH, LIP_HALF_LENGTH, SLOT_HALF_DEPTH, SLOT_HALF_LENGTH } from './tissueDimensions'

export const SOFT_PACKS = {
  'soft-kleenex': '舒潔綠色軟包',
  'soft-mayflower': '五月花厚款軟包',
  'soft-kirkland': 'Kirkland 紫色軟包',
} as const
export const HARD_BOXES = { mayflower: '五月花硬盒', kleenex: '舒潔硬盒' } as const
export const TISSUE_BRANDS = { ...SOFT_PACKS, ...HARD_BOXES }
export type TissueBrand = keyof typeof TISSUE_BRANDS
type HardBrand = keyof typeof HARD_BOXES
export const DEFAULT_TISSUE: TissueBrand = 'soft-kleenex'
export const isSoftPack = (brand: TissueBrand): brand is SoftTissueBrand => Object.hasOwn(SOFT_PACKS, brand)
type TissuePackage = {
  root: Group
  maps: CanvasTexture[]
  flexFilm: (deflection: number, tension: number, grip: Vector3 | null, landing: number) => void
}

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

function printKleenex(ctx: CanvasRenderingContext2D, w: number, h: number, top: boolean) {
  const blue = ctx.createLinearGradient(0, 0, w, h)
  blue.addColorStop(0, '#395e99')
  blue.addColorStop(0.57, '#16417b')
  blue.addColorStop(1, '#081f50')
  ctx.fillStyle = blue
  ctx.fillRect(0, 0, w, h)
  for (const [index, color] of ['#faf7ec', '#94c7df', '#4f96c3', '#ffffff'].entries()) {
    const offset = index * h / 13
    ctx.beginPath()
    ctx.moveTo(0, h * 0.71 + offset)
    ctx.bezierCurveTo(w * 0.33, h * 0.52 + offset, w * 0.61, h * 1.04 + offset, w, h * 0.63 + offset)
    ctx.lineTo(w, h)
    ctx.lineTo(0, h)
    ctx.fillStyle = color
    ctx.fill()
  }
  ctx.save()
  if (top) {
    ctx.translate(w, h)
    ctx.rotate(Math.PI)
  }
  ctx.textAlign = 'center'
  ctx.fillStyle = '#fffdf5'
  ctx.font = 'italic 700 95px Georgia, serif'
  ctx.fillText('Kleenex', w / 2, h * (top ? 0.72 : 0.40))
  ctx.font = '800 51px "Microsoft JhengHei", sans-serif'
  ctx.fillText('舒潔', w / 2, h * (top ? 0.84 : 0.59))
  if (!top) {
    ctx.fillStyle = '#123e73'
    ctx.font = '700 31px "Microsoft JhengHei", sans-serif'
    ctx.fillText('柔感盒裝面紙', w / 2, h * 0.89)
  }
  ctx.restore()
}

function drawMayflower(ctx: CanvasRenderingContext2D, w: number, h: number, face: Face) {
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

}

function print(face: Face, brand: HardBrand): CanvasTexture {
  const canvas = document.createElement('canvas')
  canvas.width = 1024
  canvas.height = face === 'top' ? 515 : face === 'side' ? 630 : 328
  const ctx = canvas.getContext('2d')!
  const { width: w, height: h } = canvas
  if (brand === 'kleenex') printKleenex(ctx, w, h, face === 'top')
  else drawMayflower(ctx, w, h, face)

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

const softShape = {
  'soft-kleenex': { width: 2.23, depth: 1.18, radius: 0.113, taper: 0.16, folds: 0.010, roughness: 0.39,
    side: '#497823', seal: '#53832d', seamWidth: 0.086, seamHeight: 0.32, pinch: 0.081 },
  'soft-mayflower': { width: 2.18, depth: 1.15, radius: 0.13, taper: 0.24, folds: 0.014, roughness: 0.43,
    side: '#e5e3e5', seal: '#dfe4ee', seamWidth: 0.109, seamHeight: 0.43, pinch: 0.066 },
  'soft-kirkland': { width: 2.25, depth: 1.17, radius: 0.083, taper: 0.12, folds: 0.008, roughness: 0.49,
    side: '#8368a7', seal: '#9b82be', seamWidth: 0.102, seamHeight: 0.48, pinch: 0.073 },
}

function createSoftPack(brand: SoftTissueBrand): TissuePackage {
  const root = new Group()
  const profile = softShape[brand]
  const front = printSoftTissue(brand, false)
  const top = printSoftTissue(brand, true)
  const film = new MeshPhysicalMaterial({ map: front, roughness: profile.roughness, clearcoat: 0.55, clearcoatRoughness: 0.31 })
  const side = new MeshPhysicalMaterial({ color: profile.side, roughness: profile.roughness + 0.05, clearcoat: 0.50 })
  const opening = new MeshPhysicalMaterial({ map: top, alphaTest: 0.45, roughness: profile.roughness, clearcoat: 0.55, side: DoubleSide })
  const skin = new BoxGeometry(profile.width, BOX_HEIGHT, profile.depth, 20, 6, 10)
  const position = skin.getAttribute('position')
  const normals = skin.getAttribute('normal')
  const half = new Vector3(profile.width / 2, BOX_HEIGHT / 2, profile.depth / 2)
  const radius = profile.radius
  const core = half.clone().addScalar(-radius)
  const low = core.clone().negate()
  const vertex = new Vector3()
  const flat = new Vector3()
  const normal = new Vector3()
  for (let i = 0; i < position.count; i++) {
    vertex.fromBufferAttribute(position, i)
    flat.copy(vertex).clamp(low, core)
    normal.subVectors(vertex, flat).normalize()
    vertex.copy(flat).addScaledVector(normal, radius)
    const flank = Math.abs(vertex.x / half.x)
    const endGather = Math.max(0, (flank - 0.60) / 0.40)
    const across = vertex.z / half.z
    const fold = Math.sin(vertex.z * 29 + vertex.x * 12) * profile.folds * endGather
    vertex.y *= 1 - profile.taper * endGather ** 2
    vertex.addScaledVector(normal, fold * Math.abs(across) + 0.006 * Math.cos(vertex.x * 18) * Math.abs(normal.z))
    vertex.y += half.y
    position.setXYZ(i, vertex.x, vertex.y, vertex.z)
    normals.setXYZ(i, normal.x, normal.y, normal.z)
  }
  const rest = Float32Array.from(position.array)
  const body = new Mesh(skin, [side, side, opening, side, film, film])
  body.castShadow = body.receiveShadow = true
  root.add(body)

  // The short ends flatten into the thin welded strips of a flexible wrapper.
  const seal = new MeshPhysicalMaterial({ color: profile.seal, roughness: profile.roughness, clearcoat: 0.62, side: DoubleSide })
  for (const sign of [-1, 1]) {
    const edge = new PlaneGeometry(profile.seamWidth, profile.depth * 0.85, 3, 20).rotateX(-Math.PI / 2)
    const vertices = edge.getAttribute('position')
    for (let i = 0; i < vertices.count; i++) {
      const z = vertices.getZ(i)
      vertices.setY(i, profile.folds * Math.sin(z * 22 + sign) + 0.004 * Math.sin(z * 86))
    }
    edge.computeVertexNormals()
    const flap = new Mesh(edge, seal)
    flap.position.set(sign * (half.x - profile.seamWidth * 0.05), BOX_HEIGHT * profile.seamHeight, 0)
    flap.castShadow = flap.receiveShadow = true
    root.add(flap)
  }

  const stack = new Mesh(new RoundedBoxGeometry(1.86, 0.10, 0.78, 2, 0.029),
    new MeshStandardMaterial({ color: '#d7ccbf', roughness: 0.98 }))
  stack.position.y = BOX_HEIGHT - 0.115
  stack.receiveShadow = true
  root.add(stack)

  const grasp = new Vector3()
  let pressure = 0
  let lastPressure = -1
  let lastLanding = -1
  let lastTension = -1
  let lastDeflection = -1
  function flexFilm(deflection: number, tension: number, grip: Vector3 | null, landing: number) {
    const movedGrip = grip && grasp.distanceToSquared(grip) > 0.00001
    if (grip) grasp.copy(grip)
    pressure += ((grip ? 1 : 0) - pressure) * 0.29
    if (pressure < 0.004) pressure = 0
    if (Math.abs(lastPressure - pressure) < 0.004 && Math.abs(lastLanding - landing) < 0.004
      && Math.abs(lastTension - tension) < 0.04 && Math.abs(lastDeflection - deflection) < 0.001 && !movedGrip) return
    lastPressure = pressure
    lastLanding = landing
    lastTension = tension
    lastDeflection = deflection
    const draw = Math.min(0.016, tension * 0.0025 + Math.abs(deflection) * 0.33)
    for (let i = 0; i < position.count; i++) {
      const x = rest[i * 3]
      const y = rest[i * 3 + 1]
      const z = rest[i * 3 + 2]
      const distance = (x - grasp.x) ** 2 + (y - grasp.y) ** 2 + (z - grasp.z) ** 2
      const pinch = Math.max(0, 1 - distance / 0.19) ** 2 * pressure * profile.pinch
      const lip = Math.max(0, 1 - Math.abs(z) / 0.27) * Math.max(0, 1 - Math.abs(x) / 0.87)
        * Math.max(0, (y - 0.52) / 0.21)
      const compression = Math.max(0, 1 - y / BOX_HEIGHT) * landing * 0.065
      position.setXYZ(i, x - normals.getX(i) * pinch + x * compression,
        y * (1 - landing * 0.072) - normals.getY(i) * pinch - draw * lip,
        z - normals.getZ(i) * pinch + z * compression)
    }
    position.needsUpdate = true
  }
  return { root, maps: [front, top], flexFilm }
}

export function createTissueBox(brand: TissueBrand): TissuePackage {
  if (isSoftPack(brand)) return createSoftPack(brand)
  const root = new Group()
  const maps = (['front', 'top', 'side', 'back'] as const).map((face) => print(face, brand))
  const cardboard = new MeshStandardMaterial({ color: brand === 'kleenex' ? '#1f4076' : '#7c8557', roughness: 0.79 })
  const innerBoard = new MeshStandardMaterial({ color: '#a49a78', roughness: 0.96, side: DoubleSide })
  const printed = maps.map((map) => new MeshPhysicalMaterial({ map, roughness: 0.65, clearcoat: 0.21, clearcoatRoughness: 0.49, side: DoubleSide }))
  const base = new Mesh(new RoundedBoxGeometry(BOX_LENGTH, 0.025, BOX_DEPTH, 2, 0.011), cardboard)
  base.position.y = 0.0125
  base.castShadow = true
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

  const filmMaterial = new MeshPhysicalMaterial({ color: '#d4d0bc', transparent: true, opacity: 0.62,
    clearcoat: 1, clearcoatRoughness: 0.19, roughness: 0.36, side: DoubleSide, depthWrite: false,
  })
  const film = new Mesh(panelWithHole(1.72, 0.402, LIP_HALF_LENGTH, LIP_HALF_DEPTH, 0.18), filmMaterial)
  film.position.y = BOX_HEIGHT - 0.016
  root.add(film)
  const filmPositions = film.geometry.getAttribute('position')
  const restFilm = Float32Array.from(filmPositions.array)
  let lastDeflection = Number.NaN
  let lastTension = Number.NaN
  function flexFilm(deflection: number, tension: number) {
    if (Math.abs(deflection - lastDeflection) < 0.00045 && Math.abs(tension - lastTension) < 0.06) return
    lastDeflection = deflection
    lastTension = tension
    for (let i = 0; i < filmPositions.count; i++) {
      const x = restFilm[i * 3]
      const z = restFilm[i * 3 + 2]
      const grip = Math.max(0, 1 - Math.abs(z) / 0.19) * Math.max(0, 1 - Math.pow(Math.abs(x) / 0.83, 5))
      const bias = Math.sign(z) * deflection
      filmPositions.setXYZ(i, x, Math.min(0.026, (Math.max(0, bias) * 0.52 + tension * 0.0019) * grip), z + deflection * grip * 0.39)
    }
    filmPositions.needsUpdate = true
    film.geometry.computeVertexNormals()
  }
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
  return { root, flexFilm, maps }
}
