// Where in each of the choir's recordings somebody is actually singing, as [from, to] seconds – so the
// mouths keep still through the band's intros and interludes. Found once with Demucs (separating the
// voices from the instruments) and kept here; a recording not listed counts as sung all through.
export const SUNG: Record<string, [number, number][]> = {
  'carols-of-the-season': [[12, 21.1], [22, 31.5], [32.4, 41.2], [42.5, 52], [53.2, 67.7], [86.2, 110.7], [114.8, 163.3], [175.3, 220.5], [234.2, 245.5]],
  'deck-the-halls': [[0.2, 19.8]],
  'hark-the-herald-angels-sing': [[57.7, 112.2]],
  'o-come-all-ye-faithful': [[30.2, 38.4], [42.9, 51.6], [53.6, 60.9], [73.9, 82.6], [84, 96.8], [102.6, 119.8], [120.7, 147.3], [151.6, 158.8], [159.9, 167.4], [168.7, 183.8]],
  'o-little-town-of-bethlehem': [[0.3, 12.8], [13.7, 27.6], [28.8, 53], [54.2, 65.8]],
  'o-tannenbaum': [[0.4, 36.5], [37.5, 46.9]],
  'sankta-lucia': [[15.1, 88.9], [95.6, 96.7], [100.1, 101.9], [104.1, 197.5]],
  'stilla-natt': [[7, 15.5], [16.4, 69.4], [70.2, 121.2], [123.6, 185.2]],
  // (the miners' song in Kolgruvan)
  'pramdragarna': [[2.5, 157.7], [158.8, 177.5], [178.8, 182.3], [185.5, 186.4], [187.8, 189.5]],
}
