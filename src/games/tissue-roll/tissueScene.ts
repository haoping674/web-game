import {
  ACESFilmicToneMapping, AmbientLight, BufferAttribute, BufferGeometry, CanvasTexture, Color,
  DirectionalLight, DoubleSide, Float32BufferAttribute, HemisphereLight,
  Mesh, MeshPhysicalMaterial, MeshStandardMaterial, PCFShadowMap, PerspectiveCamera, Plane, PlaneGeometry,
  PMREMGenerator, Points, PointsMaterial, Raycaster, RepeatWrapping, Scene, Sphere, SRGBColorSpace, Vector2, Vector3, WebGLRenderer,
} from 'three'
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js'
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js'
import { adaptiveResolution } from '../../shared/immersive/adaptiveResolution'
import { COLUMNS, FLOOR, PaperPhysics, SHEET_ROWS, type PaperRow } from './paperPhysics'
import { createTissueBox } from './tissueBox'

const PAPER_COLOR = '#ece3d3'
const WALL = '#94998b'
const MAP_SIZE = 512

function tissueTexture(): CanvasTexture {
  const canvas = document.createElement('canvas')
  canvas.width = canvas.height = MAP_SIZE
  const context = canvas.getContext('2d')!
  const pixels = context.createImageData(MAP_SIZE, MAP_SIZE)
  let seed = 623
  function random() {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0
    return seed / 4294967296
  }
  for (let i = 0; i < pixels.data.length; i += 4) {
    const value = 153 + random() * 24
    pixels.data[i] = pixels.data[i + 1] = pixels.data[i + 2] = value
    pixels.data[i + 3] = 255
  }
  context.putImageData(pixels, 0, 0)
  for (let i = 0; i < 15000; i++) {
    const x = random() * MAP_SIZE
    const y = random() * MAP_SIZE
    context.strokeStyle = random() > 0.48 ? 'rgba(234,234,234,.20)' : 'rgba(49,49,49,.22)'
    context.lineWidth = 0.3 + random() * 0.8
    context.beginPath()
    context.moveTo(x, y)
    context.quadraticCurveTo(x + 3, y + random() * 5, x + random() * 8, y + random() * 3)
    context.stroke()
  }
  // Embossed lozenges have a raised rim and a shallow, recessed center.
  for (let y = 0; y <= 512; y += 128) {
    for (let x = -128; x <= 640; x += 128) {
      const center = x + (y % 256 === 0 ? 64 : 0)
      for (let i = 0; i < 36; i++) {
        const a = i / 36 * Math.PI * 2
        const r = 29 + 8 * Math.cos(a * 4)
        context.beginPath()
        context.arc(center + Math.cos(a) * r, y + Math.sin(a) * r, 2.85, 0, Math.PI * 2)
        context.fillStyle = '#474747'
        context.fill()
        context.beginPath()
        context.arc(center + Math.cos(a) * r - 0.9, y + Math.sin(a) * r - 0.9, 1.45, 0, Math.PI * 2)
        context.fillStyle = '#ededed'
        context.fill()
      }
    }
  }
  const texture = new CanvasTexture(canvas)
  texture.wrapS = texture.wrapT = RepeatWrapping
  texture.anisotropy = 8
  return texture
}

function paperMaterial(map: CanvasTexture): MeshPhysicalMaterial {
  const material = new MeshPhysicalMaterial({
    color: PAPER_COLOR, roughness: 0.89, bumpMap: map, bumpScale: 0.023,
    side: DoubleSide, sheen: 0.23, sheenColor: new Color('#d3c8ae'), sheenRoughness: 0.85,
  })
  material.onBeforeCompile = (shader) => {
    shader.fragmentShader = shader.fragmentShader.replace('#include <color_fragment>', `
      #include <color_fragment>
      vec2 tissueUV = vBumpMapUv;
      float grain = fract(sin(dot(floor(tissueUV * 620.0), vec2(13.13, 57.7))) * 43758.5);
      float pressed = texture2D(bumpMap, tissueUV).r;
      diffuseColor.rgb *= (0.49 + 0.74 * pressed + 0.028 * grain);
    `)
  }
  return material
}

function deskTexture(): CanvasTexture {
  const canvas = document.createElement('canvas')
  canvas.width = canvas.height = 256
  const context = canvas.getContext('2d')!
  const pixels = context.createImageData(256, 256)
  for (let y = 0; y < 256; y++) {
    for (let x = 0; x < 256; x++) {
      const i = (y * 256 + x) * 4
      const noise = Math.sin(x * 199.31 + y * 28.71) * 1.75
      const grainLine = y * 0.61 + 0.084 * y * Math.sin(y * 0.092) + 4.2 * Math.sin(x * 0.021 + y * 0.04)
      const grain = Math.sin(grainLine) ** 7
      const wide = Math.sin(y * 0.14 + 1.6 * Math.sin(x * 0.013 + y * 0.031)) * 3.6
      const value = 169 + wide + noise + grain * 3.4
      pixels.data[i] = value + 17
      pixels.data[i + 1] = value + 1
      pixels.data[i + 2] = value - 16
      pixels.data[i + 3] = 255
    }
  }
  context.putImageData(pixels, 0, 0)
  const texture = new CanvasTexture(canvas)
  texture.colorSpace = SRGBColorSpace
  texture.wrapS = texture.wrapT = RepeatWrapping
  texture.repeat.set(2, 5)
  texture.anisotropy = 8
  return texture
}

class PaperMesh {
  readonly mesh: Mesh<BufferGeometry, MeshPhysicalMaterial>
  private readonly positions = new Float32BufferAttribute(new Float32Array(80 * COLUMNS * 3), 3)
  private readonly uv = new Float32BufferAttribute(new Float32Array(80 * COLUMNS * 2), 2)
  private readonly indices = new BufferAttribute(new Uint16Array(79 * (COLUMNS - 1) * 6), 1)
  private topology = ''

  constructor(material: MeshPhysicalMaterial) {
    const geometry = new BufferGeometry()
    geometry.setAttribute('position', this.positions)
    geometry.setAttribute('uv', this.uv)
    geometry.setIndex(this.indices)
    geometry.boundingSphere = new Sphere(new Vector3(0, 0, 0.7), 12)
    this.mesh = new Mesh(geometry, material)
    this.mesh.frustumCulled = false
    this.mesh.castShadow = true
    this.mesh.receiveShadow = true
  }

  update(rows: PaperRow[]) {
    if (!rows.length) {
      this.mesh.visible = false
      return
    }
    this.mesh.visible = true
    const key = `${rows[0].id}:${rows.length}`
    const rebuild = key !== this.topology
    let index = 0
    for (let r = 0; r < rows.length; r++) {
      const row = rows[r]
      for (let column = 0; column < COLUMNS; column++) {
        const i = r * COLUMNS + column
        const p = row.points[column].position
        const cutEdge = r === rows.length - 1 || r === 0
        const fiber = cutEdge ? Math.sin(column * 7.1 + row.id * 1.2) * 0.009 : 0
        this.positions.setXYZ(i, p.x, p.y + fiber, p.z)
        if (!rebuild) continue
        this.uv.setXY(i, column / (COLUMNS - 1), row.id / SHEET_ROWS)
        if (r === rows.length - 1 || column === COLUMNS - 1) continue
        const below = i + COLUMNS
        this.indices.array.set([i, below, i + 1, i + 1, below, below + 1], index)
        index += 6
      }
    }
    if (rebuild) {
      this.topology = key
      this.indices.array.fill(0, index)
      this.uv.needsUpdate = this.indices.needsUpdate = true
      this.mesh.geometry.setDrawRange(0, index)
    }
    this.positions.needsUpdate = true
    this.mesh.geometry.computeVertexNormals()
  }
}

export function createTissueScene(host: HTMLElement, physics: PaperPhysics) {
  const scene = new Scene()
  scene.background = new Color(WALL)
  const renderer = new WebGLRenderer({ antialias: true, alpha: false, powerPreference: 'high-performance' })
  renderer.domElement.setAttribute('aria-hidden', 'true')
  renderer.toneMapping = ACESFilmicToneMapping
  renderer.toneMappingExposure = 1.05
  renderer.shadowMap.enabled = true
  renderer.shadowMap.type = PCFShadowMap
  host.replaceChildren(renderer.domElement)
  const camera = new PerspectiveCamera(35, 1, 0.1, 40)
  const environment = new RoomEnvironment()
  const pmrem = new PMREMGenerator(renderer)
  const lighting = pmrem.fromScene(environment, 0.07)
  environment.dispose()
  pmrem.dispose()
  scene.environment = lighting.texture
  scene.environmentIntensity = 0.36
  scene.add(new AmbientLight(0xf3decc, 0.14), new HemisphereLight(0xfff2de, 0x4c554d, 0.44))
  const key = new DirectionalLight(0xffedd6, 2.18)
  key.position.set(-4.8, 6.3, 3.6)
  key.castShadow = true
  key.shadow.camera.left = -4
  key.shadow.camera.right = 4
  key.shadow.camera.top = 4
  key.shadow.camera.bottom = -4
  key.shadow.bias = -0.0002
  key.shadow.normalBias = 0.013
  key.shadow.radius = 3.5
  key.shadow.mapSize.set(1024, 1024)
  scene.add(key)

  const wall = new Mesh(new PlaneGeometry(40, 40), new MeshStandardMaterial({ color: WALL, roughness: 0.94 }))
  wall.position.z = -2.46
  wall.receiveShadow = true
  scene.add(wall)

  const oak = deskTexture()
  const deskMaterial = new MeshStandardMaterial({ color: '#d5c3a6', map: oak, roughness: 0.69 })
  const shelf = new Mesh(new RoundedBoxGeometry(16, 0.19, 7.0, 3, 0.048), deskMaterial)
  shelf.position.set(0, FLOOR - 0.095, 0.86)
  shelf.receiveShadow = true
  scene.add(shelf)

  const packaging = createTissueBox()
  scene.add(packaging.root)
  const tissue = tissueTexture()
  const paper = paperMaterial(tissue)
  const sheet = new PaperMesh(paper)
  const following = new PaperMesh(paper)
  scene.add(sheet.mesh, following.mesh)
  const flakeGeometry = new BufferGeometry()
  const flakePositions = new Float32BufferAttribute(new Float32Array(48 * 3), 3)
  flakeGeometry.setAttribute('position', flakePositions)
  const flakeMaterial = new PointsMaterial({ color: '#e9dac2', size: 0.016, transparent: true, opacity: 0.7, depthWrite: false })
  const flakes = new Points(flakeGeometry, flakeMaterial)
  flakes.frustumCulled = false
  scene.add(flakes)
  const dust: { point: Vector3; velocity: Vector3; life: number }[] = []
  let lastDrawn: PaperRow[] | undefined
  const scraps = new Map<PaperRow[], PaperMesh>()
  const ray = new Raycaster()
  const plane = new Plane()
  const screen = new Vector2()
  const facing = new Vector3()
  const resolution = adaptiveResolution(Math.min(window.devicePixelRatio || 1, 1.65))

  function resize() {
    const w = host.clientWidth
    const h = host.clientHeight
    if (!w || !h) return
    camera.aspect = w / h
    const distance = Math.max(5.65, 4.16 / Math.max(camera.aspect, 0.4))
    camera.position.set(distance * 0.33, distance * 0.39, distance * 0.91)
    camera.lookAt(0.01, 0.40, 0.12)
    camera.updateProjectionMatrix()
    camera.updateMatrixWorld()
    renderer.setPixelRatio(resolution.scale)
    renderer.setSize(w, h, false)
  }

  const observer = new ResizeObserver(resize)
  observer.observe(host)
  resize()

  function setRay(x: number, y: number) {
    const rect = host.getBoundingClientRect()
    screen.set((x - rect.left) / rect.width * 2 - 1, -(y - rect.top) / rect.height * 2 + 1)
    ray.setFromCamera(screen, camera)
  }

  function grab(x: number, y: number) {
    setRay(x, y)
    const hit = ray.intersectObject(sheet.mesh)[0]
    if (!hit?.face) return false
    const index = [hit.face.a, hit.face.b, hit.face.c].reduce((a, b) => {
      const distance = (i: number) => physics.rows[Math.floor(i / COLUMNS)]?.points[i % COLUMNS].position.distanceToSquared(hit.point) ?? Infinity
      return distance(a) < distance(b) ? a : b
    })
    camera.getWorldDirection(facing).negate()
    plane.setFromNormalAndCoplanarPoint(facing, hit.point)
    return physics.grab(Math.floor(index / COLUMNS), index % COLUMNS, hit.point)
  }

  function move(x: number, y: number) {
    setRay(x, y)
    const target = ray.ray.intersectPlane(plane, new Vector3())
    if (target) physics.move(target)
  }

  function render(delta: number, showDust = true) {
    if (resolution.observe(delta)) {
      const shadowSize = resolution.scale > 0.93 ? 1024 : 512
      if (shadowSize !== key.shadow.mapSize.x) {
        key.shadow.radius = shadowSize === 1024 ? 3.5 : 1.5
        key.shadow.mapSize.setScalar(shadowSize)
        key.shadow.map?.dispose()
        key.shadow.map = null
      }
      resize()
    }
    sheet.update(physics.rows)
    following.update(physics.upcoming)
    const { box } = physics
    packaging.root.position.set(box.x, FLOOR + box.lift, box.z)
    packaging.root.rotation.y = box.yaw
    packaging.film.scale.z = 1 + Math.min(0.085, physics.tension * 0.009)
    for (const [rows, scrap] of scraps) {
      if (!physics.offcuts.some((entry) => entry.rows === rows)) {
        scene.remove(scrap.mesh)
        scrap.mesh.geometry.dispose()
        scraps.delete(rows)
      }
    }
    for (const { rows, age } of physics.offcuts) {
      let scrap = scraps.get(rows)
      if (!scrap) {
        scrap = new PaperMesh(paper)
        scraps.set(rows, scrap)
        scene.add(scrap.mesh)
      }
      if (age < 4 || !scrap.mesh.geometry.drawRange.count) scrap.update(rows)
    }
    const newest = physics.offcuts.at(-1)
    if (newest && newest.rows !== lastDrawn) {
      lastDrawn = newest.rows
      if (showDust && newest.age < 0.15) {
        for (const { position } of newest.rows[0].points) {
          if (Math.random() < 0.26) continue
          dust.push({
            point: position.clone(),
            velocity: new Vector3((Math.random() - 0.5) * 0.95, Math.random() * 0.71, Math.random() * 0.48),
            life: 0.38 + Math.random() * 0.38,
          })
        }
      }
    }
    let flakeCount = 0
    for (let i = dust.length - 1; i >= 0; i--) {
      const fragment = dust[i]
      fragment.life -= Math.max(0, delta)
      fragment.velocity.y -= delta * 3.4
      fragment.point.addScaledVector(fragment.velocity, delta)
      if (!showDust || fragment.life <= 0 || fragment.point.y < FLOOR || flakeCount >= 48) {
        dust.splice(i, 1)
        continue
      }
      flakePositions.setXYZ(flakeCount++, fragment.point.x, fragment.point.y, fragment.point.z)
    }
    flakeGeometry.setDrawRange(0, flakeCount)
    flakePositions.needsUpdate = true
    renderer.render(scene, camera)
  }

  function dispose() {
    observer.disconnect()
    scene.traverse((object) => {
      if (object instanceof Mesh) {
        object.geometry.dispose()
        if (!Array.isArray(object.material)) object.material.dispose()
      }
    })
    tissue.dispose()
    oak.dispose()
    packaging.maps.forEach((map) => map.dispose())
    flakeGeometry.dispose()
    flakeMaterial.dispose()
    lighting.dispose()
    key.shadow.dispose()
    renderer.dispose()
    renderer.domElement.remove()
  }
  return { canvas: renderer.domElement, render, dispose, grab, move }
}
