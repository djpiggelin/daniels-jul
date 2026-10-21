// The backdrop gag from "Musse Pigg på camping": the village, exactly as you see it right now, turns out
// to be a painted backdrop that folds up like a hand fan – into the camper. We photograph the village into
// a texture (with the camper and its crew left out), lay it over the screen as a flat picture cut into
// pleats all the way round a pivot hidden behind the camper, paint it, fold the pleats up into one stick
// standing on the camper's roof, and pull the stick down into the van.
import * as THREE from 'three'

const N = 24
/** How far in front of the camera the picture hangs (only matters for the 3D pleat tilt). */
const D = 60

type Wedge = { pivot: THREE.Group; pleat: THREE.Group; mat: THREE.ShaderMaterial; c: number; sign: number }

const vertexShader = `
  varying vec2 vUv;
  varying vec2 vLocal;
  varying vec3 vWorld;
  void main() {
    vUv = uv;
    vLocal = position.xy;
    vec4 w = modelMatrix * vec4(position, 1.0);
    vWorld = w.xyz;
    gl_Position = projectionMatrix * viewMatrix * w;
  }`

const fragmentShader = `
  uniform sampler2D uTex;
  uniform vec2 uTexel;
  uniform float uPaint;
  uniform float uRibs;
  uniform float uRibW;
  uniform float uShade;
  uniform float uA0;
  uniform float uA1;
  uniform float uClip;
  uniform vec4 uPlane;
  varying vec2 vUv;
  varying vec2 vLocal;
  varying vec3 vWorld;
  const vec3 W = vec3(0.299, 0.587, 0.114);
  vec3 toS(vec3 c) { return pow(max(c, 0.0), vec3(1.0 / 2.2)); }
  vec3 toL(vec3 c) { return pow(max(c, 0.0), vec3(2.2)); }
  float lum(vec2 uv) { return dot(toS(texture2D(uTex, uv).rgb), W); }
  float hash(vec2 p) { return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
  void main() {
    // sliding down into the camper: nothing below the pivot shows
    if (uClip > 0.5 && dot(uPlane.xyz, vWorld) < uPlane.w) discard;
    vec3 c = texture2D(uTex, vUv).rgb;
    if (uPaint > 0.0) {
      // painted: fewer colours, inked edges, warm paper with a little grain
      vec3 s = toS(c);
      vec3 q = floor(s * 7.0 + 0.5) / 7.0;
      vec2 o = uTexel * 1.5;
      float gx = lum(vUv + vec2(o.x, 0.0)) - lum(vUv - vec2(o.x, 0.0));
      float gy = lum(vUv + vec2(0.0, o.y)) - lum(vUv - vec2(0.0, o.y));
      float edge = smoothstep(0.06, 0.25, length(vec2(gx, gy)));
      vec3 p = mix(s, q, 0.75) * (1.0 - edge * 0.6);
      p = p * vec3(1.05, 1.0, 0.9) + vec3(0.03, 0.02, 0.0);
      p += (hash(floor(vUv / uTexel / 2.0)) - 0.5) * 0.07;
      c = toL(mix(s, p, uPaint));
    }
    // the fan's ribs along each pleat's edges, and a little shade on every other pleat as it folds
    float r = length(vLocal);
    float a = atan(vLocal.y, vLocal.x);
    float e = min(abs(a - uA0), abs(a - uA1)) * r;
    c *= 1.0 - uRibs * 0.85 * (1.0 - smoothstep(0.0, uRibW, e));
    c *= 1.0 - uShade;
    gl_FragColor = vec4(c, 1.0);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }`

/** Cut a convex polygon by the half-plane where cross(dir, p) * keep >= 0. */
function clip(poly: THREE.Vector2[], dir: THREE.Vector2, keep: number) {
  const out: THREE.Vector2[] = []
  const side = (p: THREE.Vector2) => (dir.x * p.y - dir.y * p.x) * keep
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i]
    const b = poly[(i + 1) % poly.length]
    const sa = side(a)
    const sb = side(b)
    if (sa >= 0) out.push(a)
    if ((sa >= 0) !== (sb >= 0)) out.push(a.clone().lerp(b, sa / (sa - sb)))
  }
  return out
}

export class Fan {
  /** Sits where the camera is; the picture hangs in front of it. */
  readonly group = new THREE.Group()
  private root = new THREE.Group()
  private rt: THREE.WebGLRenderTarget | null = null
  private wedges: Wedge[] = []
  /** Pivot to the frame's farthest corner: how far the folded stick has to slide to be gone. */
  private reach = 1
  private shared = {
    uTex: { value: null as THREE.Texture | null },
    uTexel: { value: new THREE.Vector2() },
    uPaint: { value: 0 },
    uRibs: { value: 0 },
    uRibW: { value: 0.1 },
    uClip: { value: 0 },
    uPlane: { value: new THREE.Vector4() },
  }

  constructor() {
    this.group.add(this.root)
    this.group.visible = false
  }

  /** Photograph the scene from the camera, leaving out `hide`. The picture will fold round `pivot` (world). */
  snapshot(renderer: THREE.WebGLRenderer, scene: THREE.Scene, camera: THREE.PerspectiveCamera, hide: THREE.Object3D[], pivot: THREE.Vector3) {
    const size = renderer.getDrawingBufferSize(new THREE.Vector2())
    this.rt?.dispose()
    this.rt = new THREE.WebGLRenderTarget(size.x, size.y, { type: THREE.HalfFloatType, samples: 4 })
    const was = hide.map((o) => o.visible)
    hide.forEach((o) => (o.visible = false))
    renderer.setRenderTarget(this.rt)
    renderer.clear()
    renderer.render(scene, camera)
    renderer.setRenderTarget(null)
    hide.forEach((o, i) => (o.visible = was[i]))
    this.shared.uTex.value = this.rt.texture
    this.shared.uTexel.value.set(1 / size.x, 1 / size.y)
    camera.updateMatrixWorld()
    this.build(camera, pivot.clone().applyMatrix4(camera.matrixWorldInverse))
  }

  /** The picture, exactly filling the view, cut into pleats all the way round the pivot (camera space). */
  private build(camera: THREE.PerspectiveCamera, pivotCam: THREE.Vector3) {
    for (const w of this.wedges) {
      this.root.remove(w.pivot)
      ;(w.pleat.children[0] as THREE.Mesh).geometry.dispose()
      w.mat.dispose()
    }
    this.wedges = []
    const h = 2 * D * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2))
    const w = h * camera.aspect
    this.shared.uRibW.value = h * 0.004
    this.shared.uClip.value = 0
    // where the pivot lands on the picture plane
    const k = D / Math.max(0.1, -pivotCam.z)
    const px = THREE.MathUtils.clamp(pivotCam.x * k, -w / 2, w / 2)
    const py = THREE.MathUtils.clamp(pivotCam.y * k, -h / 2, h / 2)
    this.root.position.set(px, py, -D)
    // the frame, relative to the pivot
    const rect = [new THREE.Vector2(-w / 2 - px, -h / 2 - py), new THREE.Vector2(w / 2 - px, -h / 2 - py), new THREE.Vector2(w / 2 - px, h / 2 - py), new THREE.Vector2(-w / 2 - px, h / 2 - py)]
    this.reach = Math.max(...rect.map((p) => p.length())) * 1.02
    for (let i = 0; i < N; i++) {
      const a0 = -Math.PI + (Math.PI * 2 * i) / N
      const a1 = -Math.PI + (Math.PI * 2 * (i + 1)) / N
      let poly = clip(rect, new THREE.Vector2(Math.cos(a0), Math.sin(a0)), 1)
      poly = clip(poly, new THREE.Vector2(Math.cos(a1), Math.sin(a1)), -1)
      if (poly.length < 3) continue
      const pos: number[] = []
      const uv: number[] = []
      for (let j = 1; j < poly.length - 1; j++)
        for (const p of [poly[0], poly[j], poly[j + 1]]) {
          pos.push(p.x, p.y, 0)
          uv.push((p.x + px + w / 2) / w, (p.y + py + h / 2) / h)
        }
      const geo = new THREE.BufferGeometry()
      geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3))
      geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2))
      const mat = new THREE.ShaderMaterial({
        vertexShader,
        fragmentShader,
        uniforms: { ...this.shared, uShade: { value: 0 }, uA0: { value: a0 }, uA1: { value: a1 } },
        depthTest: false,
        depthWrite: false,
        side: THREE.DoubleSide,
      })
      const mesh = new THREE.Mesh(geo, mat)
      mesh.frustumCulled = false
      const c = (a0 + a1) / 2
      // drawn over the whole world but under the camper; the pleats furthest round from "up" end on top
      mesh.renderOrder = 1 + Math.abs(Math.atan2(Math.sin(c - Math.PI / 2), Math.cos(c - Math.PI / 2))) * 0.01
      const pleat = new THREE.Group()
      pleat.add(mesh)
      const pivot = new THREE.Group()
      pivot.add(pleat)
      this.root.add(pivot)
      this.wedges.push({ pivot, pleat, mat, c, sign: i % 2 ? 1 : -1 })
    }
    this.setFold(0)
    this.setRetract(0)
    this.group.visible = true
  }

  /** 0 = the photo as it was … 1 = a painting. */
  setPaint(k: number) {
    this.shared.uPaint.value = k
  }

  /** 0 = open (the whole picture) … 1 = folded into one stick standing straight up out of the camper. */
  setFold(k: number) {
    this.shared.uRibs.value = Math.min(1, k * 6)
    const axis = new THREE.Vector3()
    for (const w of this.wedges) {
      w.pivot.rotation.z = Math.atan2(Math.sin(Math.PI / 2 - w.c), Math.cos(Math.PI / 2 - w.c)) * k
      axis.set(Math.cos(w.c), Math.sin(w.c), 0)
      // the pleats tilt alternately as they bunch up, so it reads as paper folding
      w.pleat.quaternion.setFromAxisAngle(axis, w.sign * Math.sin(k * Math.PI * 0.5) * 1.1)
      w.mat.uniforms.uShade.value = (w.sign > 0 ? 0.28 : 0.06) * Math.min(1, k * 3)
    }
  }

  /** 0 = the folded stick standing on the camper … 1 = pulled all the way down into it. */
  setRetract(k: number) {
    this.shared.uClip.value = k > 0 ? 1 : 0
    for (const w of this.wedges) w.pivot.position.y = -k * this.reach
    // the cut-off: the pivot's height, across the picture
    this.group.updateMatrixWorld(true)
    const n = new THREE.Vector3(0, 1, 0).applyQuaternion(this.group.quaternion)
    const p = this.root.getWorldPosition(new THREE.Vector3())
    this.shared.uPlane.value.set(n.x, n.y, n.z, n.dot(p))
  }

  hide() {
    this.group.visible = false
    this.rt?.dispose()
    this.rt = null
    this.shared.uTex.value = null
  }
}
