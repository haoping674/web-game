import { Vector3 } from 'three'

type Bounds = { x: number; lift: number }
type Pose = { x: number; z: number; yaw: number; lift: number }
type Hold = { offset: Vector3; sample: Vector3; time: number }

const clamp = (value: number, low: number, high: number) => Math.min(high, Math.max(low, value))

/** A light carton constrained to the fixed camera's tabletop play area. */
export class BoxMotion {
  readonly pose: Pose = { x: 0, z: 0, yaw: 0, lift: 0 }
  private readonly velocity = new Vector3()
  private readonly gestureVelocity = new Vector3()
  private readonly delta = new Vector3()
  private readonly target = new Vector3()
  private bounds: Bounds = { x: 1.45, lift: 1.8 }
  private hold: Hold | null = null
  private rolling = false
  private restX = 0
  private restZ = 0
  private restYaw = 0
  private spin = 0

  get grabbed() { return this.hold !== null }
  get moving() { return this.rolling }

  setBounds(bounds: Bounds) {
    this.bounds = bounds
  }

  grab(hit: Vector3, now: number) {
    const { x, lift, z } = this.pose
    this.hold = { offset: new Vector3(x, lift, z).sub(hit), sample: hit.clone(), time: now }
    this.target.set(x, lift, z)
    this.gestureVelocity.set(0, 0, 0)
    this.velocity.set(0, 0, 0)
    this.rolling = false
  }

  move(hit: Vector3, now: number) {
    const hold = this.hold
    if (!hold) return
    const delta = this.delta.subVectors(hit, hold.sample)
    if (delta.lengthSq() > 0.000001) {
      const dt = clamp((now - hold.time) / 1000, 0.009, 0.075)
      if (now - hold.time > 95) this.gestureVelocity.set(0, 0, 0)
      this.gestureVelocity.lerp(delta.multiplyScalar(1 / dt).clampLength(0, 12), 0.65)
      hold.sample.copy(hit)
      hold.time = now
    }
    this.target.copy(hit).add(hold.offset)
  }

  release(throwBox: boolean, now: number) {
    const hold = this.hold
    if (!hold) return
    if (throwBox && now - hold.time < 105) this.velocity.copy(this.gestureVelocity).multiplyScalar(0.83)
    else this.velocity.set(0, 0, 0)
    this.spin = this.velocity.x * 0.51 - this.velocity.z * 0.72
    this.hold = null
    this.rolling = true
  }

  toss() {
    if (this.hold) return
    this.velocity.set((this.pose.x > 0.05 ? -1 : 1) * 6.4, 4.3, -0.84)
    this.spin = this.velocity.x * 0.6
    this.rolling = true
  }

  reset() {
    this.hold = null
    this.rolling = false
    this.velocity.set(0, 0, 0)
    this.spin = 0
    this.restX = this.restZ = this.restYaw = 0
    Object.assign(this.pose, { x: 0, z: 0, yaw: 0, lift: 0 })
  }

  update(dt: number, load: Vector3, lever: number): number {
    const box = this.pose
    const vel = this.velocity
    const { x: side, lift: ceiling } = this.bounds
    if (this.hold) {
      const amount = 1 - Math.exp(-dt * 32)
      box.x += (clamp(this.target.x, -side, side) - box.x) * amount
      box.lift += (clamp(this.target.y, 0, ceiling) - box.lift) * amount
      box.z += (clamp(this.target.z, -0.72, 0.56) - box.z) * amount
      return 0
    }
    if (!this.rolling) {
      const horizontal = Math.hypot(load.x, load.z)
      const stick = box.lift > 0.001 ? 0.26 : 0.77
      const slip = Math.max(0, horizontal - stick) / Math.max(horizontal, 0.01)
      vel.x += (load.x * slip * 8.5 - vel.x * 8.2 - (box.x - this.restX) * 2.1) * dt
      vel.z += (load.z * slip * 7.5 - vel.z * 8.2 - (box.z - this.restZ) * 2.1) * dt
      box.x = clamp(box.x + vel.x * dt, -side, side)
      box.z = clamp(box.z + vel.z * dt, -0.72, 0.56)
      this.spin += ((load.z * lever - load.x * 0.25) * slip * 6 - this.spin * 8 - (box.yaw - this.restYaw) * 2.5) * dt
      box.yaw = clamp(box.yaw + this.spin * dt, this.restYaw - 0.32, this.restYaw + 0.32)
      vel.y += (Math.max(0, load.y - 3.4) * 9.1 - 18 - vel.y * 10) * dt
      box.lift = clamp(box.lift + vel.y * dt, 0, 0.096)
      if (box.lift === 0 && vel.y < 0) vel.y = 0
      return 0
    }

    let impact = 0
    const resting = box.lift <= 0.001 && vel.y <= 0
    const drag = Math.exp(-dt * (resting ? 5.9 : 0.58))
    vel.x *= drag
    vel.z *= drag
    vel.y -= dt * 15.2
    box.x += dt * vel.x
    box.z += dt * vel.z
    box.lift += dt * vel.y
    box.yaw += this.spin * dt
    this.spin *= Math.exp(-dt * (resting ? 5.2 : 0.47))
    if (Math.abs(box.x) > side) {
      this.spin += vel.x * 0.31
      impact = Math.max(impact, Math.abs(vel.x))
      box.x = Math.sign(box.x) * side
      vel.x = -Math.sign(box.x) * Math.abs(vel.x) * 0.68
    }
    if (box.z < -0.72 || box.z > 0.56) {
      const back = box.z < 0
      box.z = back ? -0.72 : 0.56
      impact = Math.max(impact, Math.abs(vel.z))
      vel.z = (back ? 1 : -1) * Math.abs(vel.z) * 0.56
    }
    if (box.lift > ceiling) {
      box.lift = ceiling
      vel.y = -Math.abs(vel.y) * 0.55
    } else if (box.lift < 0) {
      box.lift = 0
      impact = Math.max(impact, -vel.y)
      vel.y = vel.y < -0.75 ? -vel.y * 0.34 : 0
      vel.x *= 0.84
      vel.z *= 0.84
    }
    if (box.lift === 0 && vel.lengthSq() < 0.007 && Math.abs(this.spin) < 0.11) {
      vel.set(0, 0, 0)
      this.spin = 0
      this.rolling = false
      this.restX = box.x
      this.restZ = box.z
      this.restYaw = box.yaw
    }
    return impact
  }
}
