// Layering and cycle guards for the runtime module graph.
//
// `src/core/*` modules run work at import time — `core/keys` installs the window
// key listeners the whole game reads from. A module caught in an import cycle is
// evaluated while one of its dependencies is still half-built, and a bundler is
// free to order that however it likes, so a cycle through `core/` can silently
// strand those listeners: movement and interact die game-wide with no error.
// These tests keep `core/` out of every cycle, and keep the DOM panel layer from
// reaching into the game's input module at all.
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { dirname, join, posix, relative, resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const SRC = resolve(__dirname, '../src')

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name)
    if (statSync(p).isDirectory()) walk(p, out)
    else if (name.endsWith('.ts')) out.push(p)
  }
  return out
}

/** `src`-relative posix id, e.g. `ui/panels.ts`. */
const idOf = (file: string) => relative(SRC, file).split('\\').join('/')

/**
 * Relative specifiers a module imports *at runtime*. `import type` / `export
 * type` lines are erased by the compiler and cannot form a runtime cycle, so
 * they are left out; bare specifiers (phaser, node built-ins) are not ours.
 *
 * The clause between the keyword and `from` is matched as either newline-free
 * text or a whole `{ … }` block, so a named import broken over several lines
 * (`ui/minigames/index.ts` is the live example) still enters the graph. Letting
 * the clause swallow newlines wholesale would instead let one stray `export` at
 * a line start run on until it found somebody else's `from '…'`.
 */
function importsOf(file: string): string[] {
  const src = readFileSync(file, 'utf8')
  const out: string[] = []
  const re = /(?:^|\n)\s*(?:import|export)\s+(?!type\s)(?:(?:[^'"\n{]|\{[^}]*\})*?\sfrom\s+)?['"]([^'"]+)['"]/g
  for (const m of src.matchAll(re)) {
    const spec = m[1]
    if (!spec.startsWith('.')) continue
    const abs = resolve(dirname(file), spec)
    const candidates = [`${abs}.ts`, join(abs, 'index.ts')]
    const hit = candidates.find((c) => {
      try {
        return statSync(c).isFile()
      } catch {
        return false
      }
    })
    if (hit) out.push(idOf(hit))
  }
  return out
}

const files = walk(SRC)
const graph = new Map<string, string[]>(files.map((f) => [idOf(f), importsOf(f)]))

/** Every import cycle in the graph, each as the list of modules on the loop. */
function cycles(): string[][] {
  const found: string[][] = []
  const seen = new Set<string>()
  const stack: string[] = []
  const onStack = new Set<string>()
  const visit = (node: string) => {
    if (onStack.has(node)) {
      const loop = stack.slice(stack.indexOf(node))
      const key = [...loop].sort().join(' > ')
      if (!seen.has(key)) {
        seen.add(key)
        found.push(loop)
      }
      return
    }
    if (stack.length > 200) return
    stack.push(node)
    onStack.add(node)
    for (const dep of graph.get(node) ?? []) visit(dep)
    stack.pop()
    onStack.delete(node)
  }
  for (const node of graph.keys()) visit(node)
  return found
}

describe('module graph', () => {
  it('keeps every core/ module out of every import cycle', () => {
    const offenders = cycles()
      .filter((loop) => loop.some((m) => m.startsWith('core/')))
      .map((loop) => loop.join(' > '))
    // A core module in a cycle is evaluated half-built: `core/keys` would install
    // its window listeners on a module instance nobody reads, and world input
    // would die silently.
    expect(offenders).toEqual([])
  })

  it('leaves core/keys a leaf, so its window listeners can never be stranded', () => {
    expect(graph.get('core/keys.ts')).toEqual([])
  })

  it('keeps the DOM panel layer out of the game input module', () => {
    // ui/* draws and reads the DOM; reading held keys is the scenes' business.
    // A panel that needs to know about a key press must learn it from its own
    // DOM events or from the `ui:panel` payload, never by importing core/keys.
    const offenders = [...graph].filter(([id, deps]) => id.startsWith('ui/') && deps.includes('core/keys.ts')).map(([id]) => id)
    expect(offenders).toEqual([])
  })

  it('parsed a real graph (guards the regexes above from silently matching nothing)', () => {
    expect(graph.size).toBeGreaterThan(60)
    expect(graph.get('ui/panels.ts')).toContain('ui/modal.ts')
    expect(graph.get('scenes/WorldScene.ts')).toContain('core/keys.ts')
    // A named import broken over several lines: the bite that the single-line
    // regex used to swallow whole, leaving the edge invisible to the guards above.
    expect(graph.get('ui/minigames/index.ts')).toContain('systems/Minigame.ts')
  })
})
