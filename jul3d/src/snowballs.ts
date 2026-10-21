// Snowballs: flight with gravity, a splash of powder and a snowy splat left on whatever they hit.
import * as THREE from 'three'
import { puff } from './sfx'
import { makeCanvas, toTexture } from './tex'
import { groundHeight } from './world'

const GRAVITY = 13
const R = 0.08

/** Put this on a group's userData to hear about hits (characters use it and get no splat). */
export type SnowballHit = (from: THREE.Vector3, point: THREE.Vector3) => void

type Ball = { mesh: THREE.Mesh; vel: THREE.Vector3; owner: THREE.Object3D | null; age: number }
type Decal = { mesh: THREE.Mesh; age: number }
type Puff = { sprite: THREE.Sprite; age: number }

function splatTexture() {
  const [c, ctx] = makeCanvas(128, 128)
  ctx.fillStyle = '#fff'
  ctx.beginPath()
  ctx.arc(64, 64, 30, 0, Math.PI * 2)
  ctx.fill()
  // lumpy edge + flung bits
  for (let i = 0; i < 26; i++) {
    const a = Math.random() * Math.PI * 2
    const d = 22 + Math.random() * 24
    const r = 4 + Math.random() * 11 * (1 - d / 60)
    ctx.beginPath()
    ctx.arc(64 + Math.cos(a) * d, 64 + Math.sin(a) * d, r, 0, Math.PI * 2)
    ctx.fill()
  }
  for (let i = 0; i < 16; i++) {
    const a = Math.random() * Math.PI * 2
    const d = 46 + Math.random() * 14
    ctx.beginPath()
    ctx.arc(64 + Math.cos(a) * d, 64 + Math.sin(a) * d, 1.5 + Math.random() * 2.5, 0, Math.PI * 2)
    ctx.fill()
  }
  // a little shading so it reads as packed snow
  const g = ctx.createRadialGradient(56, 56, 4, 64, 64, 40)
  g.addColorStop(0, 'rgba(255,255,255,0)')
  g.addColorStop(1, 'rgba(170,190,220,0.35)')
  ctx.globalCompositeOperation = 'source-atop'
  ctx.fillStyle = g
  ctx.fillRect(0, 0, 128, 128)
  return toTexture(c)
}

function puffTexture() {
  const [c, ctx] = makeCanvas(64, 64)
  const g = ctx.createRadialGradient(32, 32, 0, 32, 32, 32)
  g.addColorStop(0, 'rgba(255,255,255,0.9)')
  g.addColorStop(0.5, 'rgba(240,246,255,0.5)')
  g.addColorStop(1, 'rgba(255,255,255,0)')
  ctx.fillStyle = g
  ctx.fillRect(0, 0, 64, 64)
  return toTexture(c)
}

export class Snowballs {
  private balls: Ball[] = []
  private decals: Decal[] = []
  private puffs: Puff[] = []
  private ray = new THREE.Raycaster()
  private ballGeo = new THREE.SphereGeometry(R, 14, 10)
  private ballMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.9, emissive: 0x222631 })
  private splatTex = [splatTexture(), splatTexture(), splatTexture()]
  private puffTex = puffTexture()
  // spray particles
  private N = 700
  private pPos = new Float32Array(this.N * 3)
  private pVel = new Float32Array(this.N * 3)
  private pLife = new Float32Array(this.N)
  private pSize = new Float32Array(this.N)
  private pNext = 0
  private points: THREE.Points
  /** Called when an elf's snowball reaches you. */
  onPlayerHit: () => void = () => {}

  constructor(
    private scene: THREE.Scene,
    camera: THREE.Camera,
    /** What a ball can hit; read every frame so new things (elves, cabinets) count too. */
    private solids: () => THREE.Object3D[],
  ) {
    this.ray.camera = camera
    const geo = new THREE.BufferGeometry()
    geo.setAttribute('position', new THREE.BufferAttribute(this.pPos, 3))
    geo.setAttribute('aLife', new THREE.BufferAttribute(this.pLife, 1))
    geo.setAttribute('aSize', new THREE.BufferAttribute(this.pSize, 1))
    this.points = new THREE.Points(
      geo,
      new THREE.ShaderMaterial({
        transparent: true,
        depthWrite: false,
        uniforms: { uScale: { value: 600 } },
        vertexShader: /* glsl */ `
          attribute float aLife;
          attribute float aSize;
          varying float vLife;
          uniform float uScale;
          void main() {
            vLife = aLife;
            vec4 mv = modelViewMatrix * vec4(position, 1.0);
            gl_PointSize = aLife > 0.0 ? aSize * uScale * (0.4 + 0.6 * aLife) / -mv.z : 0.0;
            gl_Position = projectionMatrix * mv;
          }`,
        fragmentShader: /* glsl */ `
          varying float vLife;
          void main() {
            float d = length(gl_PointCoord - 0.5);
            if (d > 0.5) discard;
            gl_FragColor = vec4(vec3(0.97, 0.98, 1.0), smoothstep(0.5, 0.2, d) * min(1.0, vLife * 2.0));
          }`,
      }),
    )
    this.points.frustumCulled = false
    scene.add(this.points)
  }

  /** Pixels per world unit at distance 1, so spray particles are sized like real things. */
  setScale(px: number) {
    ;(this.points.material as THREE.ShaderMaterial).uniforms.uScale.value = px
  }

  get flying() {
    return this.balls.length
  }

  throw(from: THREE.Vector3, vel: THREE.Vector3, owner: THREE.Object3D | null = null) {
    const mesh = new THREE.Mesh(this.ballGeo, this.ballMat)
    mesh.position.copy(from)
    mesh.castShadow = true
    this.scene.add(mesh)
    this.balls.push({ mesh, vel: vel.clone(), owner, age: 0 })
  }

  update(dt: number, head: THREE.Vector3) {
    const solids = this.solids()
    for (let i = this.balls.length - 1; i >= 0; i--) {
      const b = this.balls[i]
      b.age += dt
      const p0 = b.mesh.position.clone()
      b.vel.y -= GRAVITY * dt
      const step = b.vel.clone().multiplyScalar(dt)
      const p1 = p0.clone().add(step)
      const len = step.length()
      let hit: { point: THREE.Vector3; normal: THREE.Vector3; object: THREE.Object3D | null } | null = null

      // an elf's ball reaching your head
      if (b.owner) {
        const closest = new THREE.Line3(p0, p1).closestPointToPoint(head, true, new THREE.Vector3())
        if (closest.distanceTo(head) < 0.42) {
          this.remove(i)
          this.splash(closest, step.clone().negate().normalize(), 10)
          puff(0.5)
          this.onPlayerHit()
          continue
        }
      }

      this.ray.set(p0, step.clone().divideScalar(len || 1))
      this.ray.far = len + R
      for (const h of this.ray.intersectObjects(solids, true)) {
        if ((h.object as THREE.Sprite).isSprite || (h.object as THREE.Points).isPoints) continue
        if (b.owner && isInside(h.object, b.owner)) continue
        const normal = h.face ? h.face.normal.clone().transformDirection(h.object.matrixWorld) : step.clone().negate().normalize()
        if (normal.dot(step) > 0) normal.negate()
        hit = { point: h.point, normal, object: h.object }
        break
      }
      const gy = groundHeight(p1.x, p1.z)
      if (!hit && p1.y - R < gy) {
        const k = (p0.y - R - gy) / Math.max(1e-4, p0.y - p1.y)
        hit = { point: p0.clone().lerp(p1, THREE.MathUtils.clamp(k, 0, 1)).setY(gy), normal: new THREE.Vector3(0, 1, 0), object: null }
      }
      if (hit) {
        this.remove(i)
        this.impact(hit.point, hit.normal, hit.object, b, head)
        continue
      }
      b.mesh.position.copy(p1)
      if (b.age > 6) this.remove(i)
    }

    // spray
    for (let i = 0; i < this.N; i++) {
      if (this.pLife[i] <= 0) continue
      this.pLife[i] -= dt * 1.6
      const j = i * 3
      this.pVel[j + 1] -= GRAVITY * 0.7 * dt
      this.pPos[j] += this.pVel[j] * dt
      this.pPos[j + 1] += this.pVel[j + 1] * dt
      this.pPos[j + 2] += this.pVel[j + 2] * dt
      if (this.pPos[j + 1] < 0.01) {
        this.pPos[j + 1] = 0.01
        this.pVel[j] *= 0.5
        this.pVel[j + 2] *= 0.5
        this.pVel[j + 1] = 0
      }
    }
    const geo = this.points.geometry
    geo.attributes.position.needsUpdate = true
    geo.attributes.aLife.needsUpdate = true
    geo.attributes.aSize.needsUpdate = true

    // puffs swell and fade
    for (let i = this.puffs.length - 1; i >= 0; i--) {
      const p = this.puffs[i]
      p.age += dt
      const k = p.age / 0.55
      p.sprite.scale.setScalar(0.3 + Math.sqrt(k) * 1.4)
      ;(p.sprite.material as THREE.SpriteMaterial).opacity = 0.85 * (1 - k)
      if (k >= 1) {
        this.scene.remove(p.sprite)
        this.puffs.splice(i, 1)
      }
    }
    // splats pop in, stay a while, then melt away
    for (let i = this.decals.length - 1; i >= 0; i--) {
      const d = this.decals[i]
      d.age += dt
      const s = d.mesh.userData.size as number
      d.mesh.scale.setScalar(s * Math.min(1, 0.3 + d.age / 0.08))
      const fade = THREE.MathUtils.clamp((d.age - 12) / 3, 0, 1)
      ;(d.mesh.material as THREE.MeshStandardMaterial).opacity = 0.95 * (1 - fade)
      if (fade >= 1) {
        this.scene.remove(d.mesh)
        ;(d.mesh.material as THREE.Material).dispose()
        this.decals.splice(i, 1)
      }
    }
  }

  private remove(i: number) {
    this.scene.remove(this.balls[i].mesh)
    this.balls.splice(i, 1)
  }

  private impact(point: THREE.Vector3, normal: THREE.Vector3, object: THREE.Object3D | null, b: Ball, head: THREE.Vector3) {
    this.splash(point, normal, 44)
    const p = new THREE.Sprite(new THREE.SpriteMaterial({ map: this.puffTex, transparent: true, depthWrite: false }))
    p.position.copy(point).addScaledVector(normal, 0.1)
    this.scene.add(p)
    this.puffs.push({ sprite: p, age: 0 })
    puff(THREE.MathUtils.clamp(0.5 - point.distanceTo(head) * 0.02, 0.05, 0.4))

    // characters react instead of getting a splat
    for (let o: THREE.Object3D | null = object; o; o = o.parent) {
      const cb = o.userData.onSnowball as SnowballHit | undefined
      if (cb) {
        cb(point.clone().sub(b.vel.clone().setY(0).normalize()), point)
        return
      }
    }
    this.decal(point, normal)
  }

  private splash(point: THREE.Vector3, normal: THREE.Vector3, n: number) {
    const tangent = new THREE.Vector3()
    for (let k = 0; k < n; k++) {
      const i = this.pNext
      this.pNext = (this.pNext + 1) % this.N
      const j = i * 3
      tangent.set(Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5).normalize()
      const v = normal.clone().multiplyScalar(1.2 + Math.random() * 3).addScaledVector(tangent, 1.4 + Math.random() * 2)
      this.pPos[j] = point.x + normal.x * 0.04
      this.pPos[j + 1] = point.y + normal.y * 0.04
      this.pPos[j + 2] = point.z + normal.z * 0.04
      this.pVel[j] = v.x
      this.pVel[j + 1] = v.y + 0.8
      this.pVel[j + 2] = v.z
      this.pLife[i] = 0.6 + Math.random() * 0.5
      // mostly powder, a few bigger clumps
      this.pSize[i] = Math.random() < 0.2 ? 0.09 + Math.random() * 0.06 : 0.035 + Math.random() * 0.05
    }
  }

  private decal(point: THREE.Vector3, normal: THREE.Vector3) {
    if (this.decals.length > 40) {
      const old = this.decals.shift()!
      this.scene.remove(old.mesh)
      ;(old.mesh.material as THREE.Material).dispose()
    }
    const mat = new THREE.MeshStandardMaterial({
      map: this.splatTex[Math.floor(Math.random() * 3)],
      transparent: true,
      depthWrite: false,
      roughness: 0.95,
      polygonOffset: true,
      polygonOffsetFactor: -4,
      emissive: 0x30343f,
    })
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), mat)
    mesh.position.copy(point).addScaledVector(normal, 0.012)
    mesh.lookAt(point.clone().add(normal))
    mesh.rotateZ(Math.random() * Math.PI * 2)
    mesh.userData.size = 0.45 + Math.random() * 0.25
    mesh.receiveShadow = true
    this.scene.add(mesh)
    this.decals.push({ mesh, age: 0 })
  }
}

function isInside(o: THREE.Object3D, root: THREE.Object3D) {
  for (let p: THREE.Object3D | null = o; p; p = p.parent) if (p === root) return true
  return false
}
