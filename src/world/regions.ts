export type Vec2 = { x: number; y: number }
export type Region = { id: string; name: string; poly: Vec2[] }

/** Ray-casting point-in-polygon. */
export function pointInPoly(poly: Vec2[], x: number, y: number): boolean {
  let inside = false
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const xi = poly[i].x
    const yi = poly[i].y
    const xj = poly[j].x
    const yj = poly[j].y
    const hit = yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi
    if (hit) inside = !inside
  }
  return inside
}

export function regionAt(regions: Region[], x: number, y: number): Region | null {
  for (const r of regions) if (pointInPoly(r.poly, x, y)) return r
  return null
}
