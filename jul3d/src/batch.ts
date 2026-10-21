// Fewer draw calls: the village is built from ~1500 little meshes (every plank, candle and button
// its own), and drawing each one costs CPU time no graphics card can win back. Once everything is
// built, meshes that never move are merged – one mesh per material – so a shop draws in a handful
// of calls instead of a hundred and fifty.
import * as THREE from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'

/** Never merge this object (or what's inside it): it moves, changes or is clicked on its own. */
export const keepApart = <T extends THREE.Object3D>(o: T): T => {
  o.userData.dynamic = true
  return o
}

/** Same look → same key, so a hundred identical brown boxes become one material. */
function materialKey(m: THREE.Material) {
  const s = m as THREE.MeshStandardMaterial & THREE.MeshBasicMaterial
  if (s.map || s.emissiveMap || s.alphaMap || s.normalMap || s.transparent) return m.uuid
  const c = (x?: THREE.Color) => (x ? x.getHexString() : '-')
  return [m.type, c(s.color), s.roughness, s.metalness, c(s.emissive), s.emissiveIntensity, m.side, s.toneMapped, s.flatShading, m.depthWrite].join('|')
}

/** A copy of the geometry in a shape every other one can be merged with. */
function normalized(geo: THREE.BufferGeometry, m: THREE.Matrix4) {
  const g = geo.index ? geo.toNonIndexed() : geo.clone()
  for (const name of Object.keys(g.attributes)) if (!['position', 'normal', 'uv'].includes(name)) g.deleteAttribute(name)
  if (!g.attributes.normal) g.computeVertexNormals()
  if (!g.attributes.uv) g.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(g.attributes.position.count * 2), 2))
  g.morphAttributes = {}
  g.clearGroups()
  g.applyMatrix4(m)
  return g
}

const kept = (o: THREE.Object3D, root: THREE.Object3D, keep?: Set<THREE.Object3D>) => {
  for (let p: THREE.Object3D | null = o; p && p !== root.parent; p = p.parent) if (p.userData.dynamic || keep?.has(p)) return true
  return false
}

type Bucket = { material: THREE.Material; cast: boolean; receive: boolean; parts: THREE.Mesh[] }

function mergeInto(target: THREE.Object3D, buckets: Map<string, Bucket>, toLocal: (m: THREE.Mesh) => THREE.Matrix4) {
  let saved = 0
  for (const b of buckets.values()) {
    if (b.parts.length < 2) continue
    const geo = mergeGeometries(b.parts.map((p) => normalized(p.geometry, toLocal(p))), false)
    if (!geo) continue
    const mesh = new THREE.Mesh(geo, b.material)
    mesh.castShadow = b.cast
    mesh.receiveShadow = b.receive
    target.add(mesh)
    for (const p of b.parts) p.parent?.remove(p)
    saved += b.parts.length - 1
  }
  return saved
}

const mergeable = (o: THREE.Object3D): o is THREE.Mesh => {
  const m = o as THREE.Mesh
  return !!m.isMesh && !(m as THREE.InstancedMesh).isInstancedMesh && !(m as THREE.SkinnedMesh).isSkinnedMesh && m.visible && !Array.isArray(m.material) && m.children.length === 0
}

/**
 * Something that stands still as a whole (a shop): every mesh that doesn't move is merged into
 * `root`, one per material. `keep` (and anything marked with keepApart) is left as it is.
 */
export function bakeStatic(root: THREE.Object3D, keep?: Set<THREE.Object3D>) {
  root.updateMatrixWorld(true)
  const inv = root.matrixWorld.clone().invert()
  const buckets = new Map<string, Bucket>()
  root.traverse((o) => {
    if (o === root || !mergeable(o) || kept(o, root, keep)) return
    const mat = o.material as THREE.Material
    const key = `${materialKey(mat)}|${o.castShadow}|${o.receiveShadow}`
    const b = buckets.get(key) ?? { material: mat, cast: o.castShadow, receive: o.receiveShadow, parts: [] }
    b.parts.push(o)
    buckets.set(key, b)
  })
  return mergeInto(root, buckets, (m) => inv.clone().multiply(m.matrixWorld))
}

/**
 * Something with moving parts (a nisse: head, arms, legs): inside each part, the meshes that move
 * together are merged – so it still waves and walks, in a few calls instead of twenty.
 */
export function mergeRigid(root: THREE.Object3D) {
  let saved = 0
  const groups: THREE.Object3D[] = []
  root.traverse((o) => {
    if (o.children.length > 1 && !(o as THREE.Mesh).isMesh) groups.push(o)
  })
  for (const g of groups) {
    if (kept(g, root)) continue
    const buckets = new Map<string, Bucket>()
    for (const o of g.children) {
      if (!mergeable(o) || o.userData.dynamic) continue
      const mat = o.material as THREE.Material
      const key = `${materialKey(mat)}|${o.castShadow}|${o.receiveShadow}`
      const b = buckets.get(key) ?? { material: mat, cast: o.castShadow, receive: o.receiveShadow, parts: [] }
      b.parts.push(o)
      buckets.set(key, b)
    }
    saved += mergeInto(g, buckets, (m) => {
      m.updateMatrix()
      return m.matrix.clone()
    })
  }
  return saved
}
