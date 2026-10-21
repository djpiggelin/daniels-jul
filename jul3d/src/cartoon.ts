// The 1938 cartoon look for the camper trip: flat toon shading in three steps, black ink outlines, and an
// old-film frame over the screen (4:3 with black bars, grain, flicker and a vignette).
import * as THREE from 'three'

let gradient: THREE.DataTexture | null = null
/** Three flat bands of light: shadow, mid, lit. */
function steps() {
  if (gradient) return gradient
  gradient = new THREE.DataTexture(new Uint8Array([90, 175, 255]), 3, 1, THREE.RedFormat)
  gradient.minFilter = gradient.magFilter = THREE.NearestFilter
  gradient.needsUpdate = true
  return gradient
}

export function toon(color: number, opts: THREE.MeshToonMaterialParameters = {}) {
  return new THREE.MeshToonMaterial({ color, gradientMap: steps(), ...opts })
}

/** Hard edges between faces (toon materials have no flat shading switch). */
export function faceted(geo: THREE.BufferGeometry) {
  const g = geo.index ? geo.toNonIndexed() : geo
  g.computeVertexNormals()
  return g
}

const ink = new THREE.MeshBasicMaterial({ color: 0x15110d, side: THREE.BackSide })
const inks = new Map<number, THREE.MeshBasicMaterial>()
/** The ink material for a given line width: a back-face hull pushed out along the normals. */
function inkFor(width: number) {
  width = Math.round(width * 1000) / 1000
  let m = inks.get(width)
  if (m) return m
  m = ink.clone()
  // one shader for every width: only the uniform differs
  m.onBeforeCompile = (s) => {
    s.uniforms.uInk = { value: width }
    s.vertexShader = 'uniform float uInk;\n' + s.vertexShader.replace('#include <begin_vertex>', 'vec3 transformed = position + normalize(normal) * uInk;')
  }
  m.customProgramCacheKey = () => 'ink'
  inks.set(width, m)
  return m
}

/**
 * Give every mesh under `root` a black outline. Small bits (spokes, buttons) are skipped, they'd only be
 * blobs of ink. Returns the outline meshes so they can be shown and hidden together.
 */
export function outline(root: THREE.Object3D, width = 0.03, minSize = 0.12) {
  const hulls: THREE.Mesh[] = []
  const meshes: THREE.Mesh[] = []
  root.traverse((o) => {
    const m = o as THREE.Mesh
    if (m.isMesh && !(m as THREE.InstancedMesh).isInstancedMesh && !m.userData.ink) meshes.push(m)
  })
  const scale = new THREE.Vector3()
  for (const m of meshes) {
    if (!m.geometry.boundingSphere) m.geometry.computeBoundingSphere()
    m.getWorldScale(scale)
    const s = Math.max(Math.abs(scale.x), Math.abs(scale.y), Math.abs(scale.z))
    if (m.geometry.boundingSphere!.radius * s < minSize || !m.geometry.attributes.normal) continue
    const hull = new THREE.Mesh(m.geometry, inkFor(width / s))
    hull.userData.ink = true
    hull.castShadow = false
    m.add(hull)
    hulls.push(hull)
  }
  return hulls
}

/** The old-film frame over the screen while you're in the cartoon. */
export class FilmFrame {
  private el = document.getElementById('cartoon')!
  private grain = this.el.querySelector('canvas')!
  private ctx = this.grain.getContext('2d')!
  private img = this.ctx.createImageData(this.grain.width, this.grain.height)
  private t = 0

  show(on: boolean) {
    this.el.hidden = false
    // a frame later, so the bars slide in instead of popping
    requestAnimationFrame(() => this.el.classList.toggle('on', on))
    if (!on) setTimeout(() => !this.el.classList.contains('on') && (this.el.hidden = true), 700)
  }

  update(dt: number) {
    if (this.el.hidden) return
    // new grain about 20 times a second, plus a little flicker
    if ((this.t -= dt) > 0) return
    this.t = 0.05
    const d = this.img.data
    for (let i = 0; i < d.length; i += 4) {
      const v = Math.random() * 255
      d[i] = d[i + 1] = d[i + 2] = v
      d[i + 3] = Math.random() < 0.0015 ? 255 : 40
    }
    this.ctx.putImageData(this.img, 0, 0)
    this.el.style.setProperty('--flicker', (0.94 + Math.random() * 0.06).toFixed(3))
  }
}
