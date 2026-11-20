import * as T from 'three'
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js'
import { JET_ANGLE, JET_DURATION, NOZZLE_HEIGHT, SEAL_BREAK, jetVelocity, type ColaRound } from './colaPhysics'
import { adaptiveResolution } from '../../shared/immersive/adaptiveResolution'
import type { EffectIntensity } from '../../shared/storage/appStorage'

const TAU = Math.PI * 2
const MOUTH = 0.256
const bottleProfile = [
  [0, 0.003], [0.026, 0.001], [0.032, 0.004], [0.034, 0.012],
  [0.035, 0.024], [0.033, 0.035], [0.035, 0.047], [0.035, 0.06],
  [0.033, 0.074], [0.032, 0.096], [0.033, 0.115], [0.035, 0.129],
  [0.036, 0.154], [0.036, 0.173], [0.034, 0.184], [0.0295, 0.197],
  [0.022, 0.213], [0.015, 0.228], [0.014, 0.238], [0.015, 0.241],
  [0.014, MOUTH], [0.0115, MOUTH], [0.0115, 0.24],
]

function lathe(profile: number[][], segments = 96, sweep = TAU): T.LatheGeometry {
  return new T.LatheGeometry(profile.map(([radius, y]) => new T.Vector2(radius, y)), segments, 0, sweep)
}

function texture(width: number, height: number, paint: (ctx: CanvasRenderingContext2D) => void): T.CanvasTexture {
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Canvas not available')
  paint(ctx)
  const result = new T.CanvasTexture(canvas)
  result.colorSpace = T.SRGBColorSpace
  result.anisotropy = 4
  return result
}

function labelTexture(): T.CanvasTexture {
  return texture(1024, 320, ctx => {
    const red = ctx.createLinearGradient(0, 0, 1024, 0)
    red.addColorStop(0, '#7f1d17')
    red.addColorStop(0.3, '#ba3320')
    red.addColorStop(0.7, '#9e261c')
    red.addColorStop(1, '#7f1d17')
    ctx.fillStyle = red
    ctx.fillRect(0, 0, 1024, 320)
    ctx.strokeStyle = '#e3ad78'
    ctx.lineWidth = 2
    ctx.strokeRect(18, 15, 988, 290)
    ctx.strokeRect(24, 22, 976, 276)
    for (const x of [285, 797]) {
      ctx.save()
      ctx.translate(x, 0)
      ctx.fillStyle = '#ffe8b7'
      ctx.textAlign = 'center'
      ctx.font = 'italic bold 112px Georgia'
      ctx.fillText('Cola', 0, 179)
      ctx.font = '600 19px Arial'
      ctx.fillText('ORIGINAL  •  500 mL', 0, 230)
      ctx.restore()
    }
  })
}

function rulerTexture(): T.CanvasTexture {
  return texture(2048, 128, ctx => {
    ctx.fillStyle = '#d7a246'
    ctx.fillRect(0, 0, 2048, 128)
    ctx.fillStyle = '#38270f'
    for (let mark = 0; mark <= 58; mark++) {
      const x = (mark * .1 + .05) / 5.94 * 2048
      const major = mark % 10 === 0
      ctx.fillRect(x, 6, major ? 5 : 2, major ? 52 : mark % 5 === 0 ? 36 : 18)
      if (major) {
        ctx.font = 'bold 29px Arial'
        ctx.fillText(String(mark * 10), x, 94)
      }
    }
  })
}

function makeBottle(): {
  body: T.Group; cap: T.Group; foam: T.InstancedMesh; condensation: T.InstancedMesh; liquid: T.Mesh;
} {
  const body = new T.Group()
  body.position.y = -MOUTH
  const pet = new T.MeshPhysicalMaterial({
    color: 0xffead3, transmission: .96, thickness: .001, roughness: .19,
    ior: 1.42, clearcoat: 1,
  })
  const shell = new T.Mesh(lathe(bottleProfile), pet)
  shell.renderOrder = 4
  body.add(shell)
  const drink = new T.MeshPhysicalMaterial({ color: 0x210b04, roughness: .27, clearcoat: .85, envMapIntensity: .55 })
  const liquid = new T.Mesh(lathe([[0, .007], [.028,.007], [.032,.019], [.033,.045], [.031,.085], [.033,.12], [.034,.161], [0,.161]]), drink)
  body.add(liquid)
  const label = new T.Mesh(
    new T.CylinderGeometry(.0364, .0344, .071, 96, 1, true),
    new T.MeshPhysicalMaterial({ map: labelTexture(), roughness: .55, clearcoat: .23 }),
  )
  label.position.y = .132
  label.rotation.y = Math.PI / 2
  body.add(label)
  const neckMaterial = new T.MeshStandardMaterial({ color: 0xbba98f, roughness: .31, metalness: .22 })
  const lip = new T.Mesh(new T.TorusGeometry(.0135, .00135, 8, 64), neckMaterial)
  lip.rotation.x = Math.PI / 2
  lip.position.y = MOUTH - .0008
  body.add(lip)
  const threadPath: T.Vector3[] = []
  for (let step = 0; step <= 100; step++) {
    const fraction = step / 100
    threadPath.push(new T.Vector3(.0146 * Math.cos(fraction * TAU * 2.1), .24 + fraction * .014, .0146 * Math.sin(fraction * TAU * 2.1)))
  }
  body.add(new T.Mesh(new T.TubeGeometry(new T.CatmullRomCurve3(threadPath), 100, .00085, 5, false), neckMaterial))
  const cap = new T.Group()
  const plastic = new T.MeshPhysicalMaterial({ color: 0xaa2317, roughness: .34, clearcoat: .45 })
  const top = new T.Mesh(lathe([[0,-.004], [.015,-.004], [.016,-.003], [.016,.009], [.015,.011], [0,.011]], 64), plastic)
  cap.add(top)
  const knurls = new T.InstancedMesh(new T.BoxGeometry(.0009, .009, .0016), plastic, 48)
  const dummy = new T.Object3D()
  for (let index = 0; index < knurls.count; index++) {
    const azimuth = index / knurls.count * TAU
    dummy.position.set(.016 * Math.sin(azimuth), .0022, .016 * Math.cos(azimuth))
    dummy.rotation.set(0, azimuth, 0)
    dummy.updateMatrix()
    knurls.setMatrixAt(index, dummy.matrix)
  }
  cap.add(knurls)
  const ring = new T.Mesh(new T.CylinderGeometry(.0158, .0158, .0022, 64, 1, true), plastic)
  ring.position.y = .2377
  body.add(ring, cap)
  const foam = new T.InstancedMesh(new T.IcosahedronGeometry(1, 1), new T.MeshPhysicalMaterial({
    color: 0xe4b477, roughness: .37, clearcoat: .22,
  }), 150)
  foam.frustumCulled = false
  const condensation = new T.InstancedMesh(new T.IcosahedronGeometry(1, 1), new T.MeshPhysicalMaterial({
    color: 0xffd8a2, roughness: .16, metalness: .2, transparent: true, opacity: .48, depthWrite: false,
  }), 82)
  condensation.renderOrder = 5
  for (let index = 0; index < condensation.count; index++) {
    const theta = index * 2.39996
    const shoulder = index % 3 !== 0
    const height = shoulder ? .169 + hash(index, 4) * .052 : .025 + hash(index, 5) * .057
    const radius = height < .177 ? .0355 : T.MathUtils.lerp(.036, .017, (height - .177) / .048)
    const size = .0005 + .00115 * hash(index, 9) ** 2
    dummy.rotation.set(0, theta, 0)
    dummy.position.set(radius * Math.sin(theta), height, radius * Math.cos(theta))
    dummy.scale.set(size, size * (1.12 + hash(index, 6)), size * .42)
    dummy.updateMatrix()
    condensation.setMatrixAt(index, dummy.matrix)
  }
  body.add(foam, condensation)
  return { body, cap, foam, condensation, liquid }
}

function hash(index: number, seed: number): number {
  const n = Math.sin(index * 127.1 + seed * 311.7) * 43758.5453123
  return n - Math.floor(n)
}

type Splash = { x: number; z: number; born: number }
const SPRAY_CAPACITY = 850
const JET_LINKS = 10

export function makeColaScene(canvas: HTMLCanvasElement) {
  const renderer = new T.WebGLRenderer({ canvas, alpha: true, antialias: true })
  renderer.setClearColor(0x000000, 0)
  renderer.toneMapping = T.ACESFilmicToneMapping
  renderer.toneMappingExposure = 1.03
  renderer.transmissionResolutionScale = .62
  const scene = new T.Scene()
  const environment = new RoomEnvironment()
  const pmrem = new T.PMREMGenerator(renderer)
  const probe = pmrem.fromScene(environment, .035)
  scene.environment = probe.texture
  environment.dispose()
  pmrem.dispose()
  scene.add(new T.HemisphereLight(0xfff1d9, 0x755541, 1.45))
  const key = new T.DirectionalLight(0xffe9c3, 2.5)
  key.position.set(-2, 5, 3)
  const rim = new T.DirectionalLight(0xdcf3ff, 1.9)
  rim.position.set(1, 1, -3)
  scene.add(key, rim)
  const camera = new T.OrthographicCamera(-1, 1, 1, -1, .005, 30)
  const ground = new T.Mesh(new T.PlaneGeometry(16, 16), new T.MeshStandardMaterial({
    color: 0x76432d, roughness: .91, map: texture(256, 256, ctx => {
      ctx.fillStyle = '#b99480'
      ctx.fillRect(0, 0, 256, 256)
      for (let i = 0; i < 4000; i++) {
        ctx.fillStyle = i % 2 ? '#7e5f501d' : '#ffdfba30'
        ctx.fillRect(hash(i, 1) * 256, hash(i, 2) * 256, 1 + hash(i, 3) * 2, 1)
      }
    }),
  }))
  const floorLight = new T.PointLight(0xffcf9f, 2.4, 2.5, 1.9)
  floorLight.position.set(-.16, .54, -.17)
  scene.add(floorLight)
  const groundMap = ground.material.map!
  groundMap.wrapS = groundMap.wrapT = T.RepeatWrapping
  groundMap.repeat.set(34, 34)
  ground.rotation.x = -Math.PI / 2
  scene.add(ground)
  const shadow = new T.Mesh(new T.PlaneGeometry(.28, .23), new T.MeshBasicMaterial({
    map: texture(64, 64, ctx => {
      const fade = ctx.createRadialGradient(32, 32, 1, 32, 32, 32)
      fade.addColorStop(0, '#2c160ec9')
      fade.addColorStop(.55, '#2c160e60')
      fade.addColorStop(1, '#2c160e00')
      ctx.fillStyle = fade
      ctx.fillRect(0, 0, 64, 64)
    }), transparent: true, depthWrite: false,
  }))
  shadow.rotation.x = -Math.PI / 2
  shadow.position.y = .001
  scene.add(shadow)
  const ruler = new T.Mesh(new T.PlaneGeometry(5.94, .18), new T.MeshBasicMaterial({ map: rulerTexture() }))
  ruler.rotation.x = -Math.PI / 2
  ruler.position.set(2.92, .002, .22)
  scene.add(ruler)
  const pivot = new T.Group()
  const { body, cap, foam, condensation, liquid } = makeBottle()
  pivot.add(body)
  scene.add(pivot)

  const drops = new T.InstancedMesh(new T.IcosahedronGeometry(1, 1), new T.MeshPhysicalMaterial({
    color: 0xdda169, roughness: .22, clearcoat: 1,
  }), SPRAY_CAPACITY)
  const jet = new T.InstancedMesh(new T.SphereGeometry(1, 10, 6), new T.MeshPhysicalMaterial({
    color: 0x97502a, roughness: .24, clearcoat: 1,
  }), JET_LINKS)
  const wet = new T.InstancedMesh(new T.CircleGeometry(1, 15), new T.MeshPhysicalMaterial({
    color: 0x713710, roughness: .26, clearcoat: 1, transparent: true, opacity: .52, depthWrite: false,
  }), 60)
  const ripples = new T.InstancedMesh(new T.RingGeometry(.87, 1, 20), new T.MeshBasicMaterial({
    color: 0xebc09a, transparent: true, opacity: .42, depthWrite: false,
  }), 48)
  for (const field of [drops, jet, wet, ripples]) { field.frustumCulled = false; field.count = 0; scene.add(field) }
  const landmark = new T.Mesh(new T.CylinderGeometry(.006, .006, .19, 8), new T.MeshBasicMaterial({ color: 0xffe6b1 }))
  scene.add(landmark)
  const dummy = new T.Object3D()
  const color = new T.Color()
  const foamTint = new T.Color()
  const mouthFromCenter = new T.Vector3()
  const capProjection = new T.Vector3()
  const capCenter = { x: 0, y: 0 }
  const resolution = adaptiveResolution(Math.min(2, window.devicePixelRatio || 1))
  let width = 1
  let height = 1
  let framed = .35
  let launch = 0
  let lift = 0
  let observedImpacts = 0
  let splashes: Splash[] = []
  let needsRender = true
  let lastIdleRound: ColaRound | undefined
  let lastEffect: EffectIntensity | undefined
  let lastReducedMotion = false

  function resize(): void {
    const nextWidth = canvas.clientWidth
    const nextHeight = canvas.clientHeight
    if (!nextWidth || !nextHeight) return
    width = nextWidth
    height = nextHeight
    renderer.setPixelRatio(resolution.scale)
    renderer.setSize(width, height, false)
    needsRender = true
  }

  const observer = new ResizeObserver(resize)
  observer.observe(canvas)
  resize()

  function draw(round: ColaRound, dt: number, reduce: boolean, effect: EffectIntensity): void {
    const { pose } = round
    const moving = round.held || lift > .001 || Math.hypot(pose.x, pose.y, pose.vx, pose.vy, pose.kickX, pose.kickY) > .001
    const idle = (round.phase === 'shake' && round.pressure === 0 && round.foam < .001 && !moving)
      || (round.phase === 'result' && round.age > round.finishedAt + 1.4 && round.foam < .001)
    if (idle && !needsRender && lastIdleRound === round && lastEffect === effect && lastReducedMotion === reduce) return
    if (resolution.observe(dt)) resize()
    needsRender = false
    lastIdleRound = idle ? round : undefined
    lastEffect = effect
    lastReducedMotion = reduce
    const spraying = round.phase === 'spray' || round.phase === 'result'
    const settle = 1 - Math.exp(-dt * 9)
    const aim = T.MathUtils.smoothstep(round.opening, .84, 1)
    launch = spraying ? 1 : reduce ? 0 : aim
    lift = T.MathUtils.lerp(lift, round.held ? .026 : 0, 1 - Math.exp(-dt * 22))
    const looseness = (reduce ? .14 : 1) * (1 - launch)
    const tipX = T.MathUtils.clamp(pose.vy * -.19 + pose.kickY * -.41, -.57, .57) * looseness
    const tipZ = T.MathUtils.clamp(pose.vx * -.17 - pose.kickX * .32, -.62, .62) * looseness
    const grabHeight = (lift + pose.y * .4 + pose.kickY * .022) * looseness
    pivot.rotation.set(
      tipX,
      -.21 * (1 - launch) + tipX * .25 - tipZ * .34,
      tipZ - (Math.PI / 2 - JET_ANGLE) * launch,
    )
    pivot.position.set(
      (pose.x * .4 + pose.kickX * .025) * looseness,
      T.MathUtils.lerp(MOUTH, NOZZLE_HEIGHT, launch) + T.MathUtils.clamp(grabHeight, 0, .064),
      tipX * .042 - Math.min(0, grabHeight) * 2.7,
    )
    // The bottle rotates around the grip near its center and the nozzle aligns for the launch.
    mouthFromCenter.set(0, .117, 0).applyQuaternion(pivot.quaternion)
    pivot.position.x += mouthFromCenter.x * (1 - launch)
    pivot.position.y += (mouthFromCenter.y - .117) * (1 - launch)
    pivot.position.z += mouthFromCenter.z * (1 - launch)
    shadow.position.x = pivot.position.x - .13 * launch
    shadow.position.z = pivot.position.z
    shadow.material.opacity = 1 - T.MathUtils.clamp((lift + Math.max(0, pose.y) * .4) * 5, 0, .36) * looseness
    liquid.scale.y = spraying ? Math.max(.35, 1 - round.age * 1.8 * round.launchPressure) : 1
    liquid.rotation.x = -T.MathUtils.clamp(pose.sloshY, -1, 1) * .10 * looseness
    liquid.rotation.z = T.MathUtils.clamp(pose.sloshX, -1, 1) * .11 * looseness
    cap.rotation.set(0, round.opening * TAU * 1.65, 0)
    cap.position.set(0, MOUTH + .003 + round.opening * .009, 0)
    if (spraying) {
      cap.position.set(-round.age * .24, MOUTH + .012 + round.age * .58 - round.age ** 2 * 1.7, .2 * round.age)
      cap.rotation.x = reduce ? 0 : round.age * 14
    }
    cap.visible = !spraying || (!reduce && round.age < .5)
    const leak = round.phase === 'opening' ? Math.min(1, Math.max(0, (round.opening - SEAL_BREAK) * 11)) * round.pressure : 0
    const overflowing = Math.ceil((effect === 'full' ? 69 : 37) * leak)
    foam.count = Math.min(150, Math.floor((effect === 'full' ? 95 : 50) * round.foam + overflowing))
    for (let i = 0; i < foam.count; i++) {
      const azimuth = i * 2.39996
      const bead = hash(i, 9)
      const leaking = i < overflowing
      const life = (round.elapsed * (0.65 + bead) + hash(i, 4)) % 1
      const spill = leaking && i % 4 !== 0
      const y = leaking ? MOUTH - .006 + round.opening * .009 - life ** 1.65 * (spill ? .108 : .016) : .157 + life * .094 * Math.sqrt(round.foam)
      const radius = leaking ? .0145 + Math.sin(life * Math.PI) * .002 + Math.max(0, .235 - y) * .5
        : Math.min(.032, Math.max(.011, (.244 - y) * .48 + .009)) * Math.sqrt(bead)
      dummy.position.set(radius * Math.cos(azimuth), y, radius * Math.sin(azimuth))
      const size = (.0014 + .00225 * hash(i, 5)) * (leaking ? 1.41 : 1)
      dummy.scale.set(size, size * (leaking ? 1.45 : .8), size)
      dummy.rotation.set(0, 0, 0)
      dummy.updateMatrix()
      foam.setMatrixAt(i, dummy.matrix)
      foam.setColorAt(i, foamTint.setHSL(.075 + .023 * bead, .61, .4 + .43 * hash(i, 8)))
    }
    foam.instanceMatrix.needsUpdate = true
    if (foam.instanceColor) foam.instanceColor.needsUpdate = true
    condensation.visible = effect !== 'off'

    let head = 0
    let index = 0
    for (const packet of round.particles) {
      head = Math.max(head, packet.x)
      const copies = effect === 'full' ? 12 : effect === 'reduced' ? 6 : 3
      for (let i = 0; i < copies && index < SPRAY_CAPACITY; i++, index++) {
        const seed = Math.round((round.age - packet.age) * 60) * 17 + i
        const size = (.009 - .006 * Math.min(1, packet.age)) * (i === 0 ? 1.8 : .19 + hash(seed, 17) * .85)
        const spread = i === 0 ? 0 : .008 + packet.age * (.05 + hash(seed, 13) ** 2 * .41)
        const tail = i === 0 ? 0 : packet.age * hash(seed, 6) * .36
        dummy.position.set(packet.x - tail, packet.y + (hash(seed, 19) - .48) * spread, (hash(seed, 11) - .5) * spread)
        dummy.rotation.set(0, 0, Math.atan2(packet.vy, packet.vx))
        dummy.scale.set(size + (i === 0 ? Math.min(.07, packet.vx / 125) : size * 1.1), size, size)
        dummy.updateMatrix()
        drops.setMatrixAt(index, dummy.matrix)
        drops.setColorAt(index, color.setHSL(.052 + .065 * hash(seed, 5), .68, i === 0 ? .56 : .34 + hash(seed, 22) * .52))
      }
    }
    jet.count = 0
    if (round.phase === 'spray' && round.age < JET_DURATION) {
      let x = 0
      let y = NOZZLE_HEIGHT
      const force = jetVelocity(round.launchPressure, round.age)
      for (let i = round.particles.length - 1; i >= 0 && jet.count < JET_LINKS; i--) {
        const packet = round.particles[i]
        if (packet.age > .15) break
        const dx = packet.x - x
        const dy = packet.y - y
        const radius = (.006 + .007 * Math.min(1, force / 8)) * (1 + .26 * Math.sin(i * 2.6 + round.age * 43))
        dummy.position.set(x + dx / 2, y + dy / 2, 0)
        dummy.rotation.set(0, 0, Math.atan2(dy, dx))
        dummy.scale.set(Math.hypot(dx, dy) * .61 + .004, radius, radius)
        dummy.updateMatrix()
        jet.setMatrixAt(jet.count++, dummy.matrix)
        x = packet.x
        y = packet.y
      }
    }
    jet.instanceMatrix.needsUpdate = true
    drops.count = index
    drops.instanceMatrix.needsUpdate = true
    if (drops.instanceColor) drops.instanceColor.needsUpdate = true

    if (!spraying) { splashes = []; observedImpacts = 0 }
    if (round.impacts > observedImpacts) {
      splashes.push({ x: round.lastImpact, z: (hash(round.impacts, 12) - .5) * .10, born: round.age })
      observedImpacts = round.impacts
    }
    wet.count = splashes.length
    ripples.count = 0
    for (const [i, splash] of splashes.entries()) {
      const life = round.age - splash.born
      const size = .019 + .035 * hash(i, 4)
      dummy.rotation.set(-Math.PI / 2, 0, 0)
      dummy.position.set(splash.x, .004, splash.z)
      dummy.scale.set(size * 1.65, size, 1)
      dummy.updateMatrix()
      wet.setMatrixAt(i, dummy.matrix)
      if (life < .42 && !reduce && ripples.count < 48) {
        const spread = size * (.4 + life * 5)
        dummy.position.y += .001
        dummy.scale.set(spread * 1.45, spread, 1)
        dummy.updateMatrix()
        ripples.setMatrixAt(ripples.count++, dummy.matrix)
      }
    }
    wet.instanceMatrix.needsUpdate = true
    ripples.instanceMatrix.needsUpdate = true
    landmark.visible = round.distance > 0
    landmark.position.set(round.distance / 100, .088, .14)
    ruler.visible = spraying
    const distance = round.distance / 100
    const extent = spraying ? Math.max(.78, head + .55, distance + .57) : .35
    framed = reduce || extent > framed ? extent : T.MathUtils.lerp(framed, extent, settle)
    const aspect = width / height
    const cameraWidth = Math.max(framed, .39 * aspect)
    const targetX = spraying ? (framed - .64) * .47 : 0
    const targetY = spraying ? Math.min(.79, .26 + .11 * framed) : .141
    const vertical = Math.max(.4, cameraWidth / aspect, spraying ? .52 + .25 * framed : 0)
    const horizontal = Math.max(cameraWidth, vertical * aspect)
    camera.left = -horizontal / 2
    camera.right = horizontal / 2
    camera.top = vertical / 2
    camera.bottom = -vertical / 2
    camera.position.set(targetX + .17 * (1 - launch), targetY + 1.05 + launch * .37, 3.3 + launch)
    camera.lookAt(targetX, targetY, 0)
    camera.updateProjectionMatrix()
    if (round.phase === 'shake') {
      camera.updateMatrixWorld()
      cap.localToWorld(capProjection.set(0, .004, 0)).project(camera)
      capCenter.x = Math.round(T.MathUtils.clamp(capProjection.x * width / 2, 27 - width / 2, width / 2 - 27))
      capCenter.y = Math.round(T.MathUtils.clamp((.5 - capProjection.y * .5) * height, 27, height - 27) - height * .2)
    }
    renderer.render(scene, camera)
  }

  return {
    draw,
    capCenter,
    dispose() {
      observer.disconnect()
      const materials = new Set<T.Material>()
      const geometries = new Set<T.BufferGeometry>()
      scene.traverse(object => {
        if (!(object instanceof T.Mesh)) return
        geometries.add(object.geometry)
        for (const surface of Array.isArray(object.material) ? object.material : [object.material]) materials.add(surface)
      })
      for (const geometry of geometries) geometry.dispose()
      for (const surface of materials) {
        if ('map' in surface && surface.map instanceof T.Texture) surface.map.dispose()
        surface.dispose()
      }
      probe.dispose()
      renderer.dispose()
    },
  }
}
