// Dialogue trees are registered at startup (data/npcs.ts) so scenes can look
// them up by id without importing the data module directly.
import type { Tree } from './Dialogue'

const trees = new Map<string, Tree>()
const info = new Map<string, { name: string; face: string }>()

export function registerTrees(t: Record<string, Tree>, i: Record<string, { name: string; face: string }> = {}): void {
  for (const [k, v] of Object.entries(t)) trees.set(k, v)
  for (const [k, v] of Object.entries(i)) info.set(k, v)
}

export function getTree(id: string): Tree | null {
  return trees.get(id) ?? null
}

export function npcInfo(id: string): { name: string; face: string } {
  return info.get(id) ?? { name: id.charAt(0).toUpperCase() + id.slice(1), face: `face_${id}` }
}

/** A one-off tree from plain lines (signs, objects without scripts). */
export function linesTree(id: string, who: string, lines: string[], face?: string): Tree {
  return { id, entry: [{ node: 'a' }], nodes: { a: { lines: lines.map((text) => ({ who, text, face })) } } }
}
