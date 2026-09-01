// Prop sprites: village fixtures, harbour props, quest items and speech
// bubbles. Same look as env.ts: chunky shapes, 1px 'outline', light from the
// top-left, feet on the row above the anchor line.
import type { Legend, SpriteDef } from '../pixel'
import { K, withOutline } from '../procedural'
import { setPx, type Raster } from '../raster'

const ascii = (name: string, rows: string[], legend: Legend, opts: Partial<SpriteDef> = {}): SpriteDef => ({
  name,
  rows,
  legend,
  outline: 'outline',
  ...opts,
})

/* ---------------- fountain (48×48 × 3 frames) ---------------- */
// Base basin: cobbled rim, stone wall, centre pillar with a small bowl.
const FOUNTAIN_BASE = [
  '................................................',
  '................................................',
  '................................................',
  '................................................',
  '.......................Ss.......................',
  '......................SSst......................',
  '.......................st.......................',
  '.......................st.......................',
  '................SSSSSSSSSSSSSSSS................',
  '................cAAAAAAAAAAAAAAc................',
  '................cccccccccccccccc................',
  '.................Ssssssssssssst.................',
  '...................sstttttttt...................',
  '.....................tttttt.....................',
  '.....................Ssssst.....................',
  '.....................Ssssst.....................',
  '.....................Ssssst.....................',
  '.....................tttttt.....................',
  '.....................Ssssst.....................',
  '.....................Ssssst.....................',
  '.....................Ssssst.....................',
  '.....................Ssssst.....................',
  '.....................tttttt.....................',
  '.....................Ssssst.....................',
  '................SSsSSSsssstSSSsS................',
  '...........SSSsSSSsSSSsssstSSSsSSSsSS...........',
  '........SSsSSSsSDDDDDSsssstDDDDDSSsSSSsS........',
  '.....SsSSSsDDaaaaaaaaSsssstaaaaaaaaDDSsSSSs.....',
  '....ScccDaaaaaaaaaaaaSsssstaaaaaaaaaaaaacccc....',
  '...SScDaaaaaaaaaaaaaaSsssstaaaaaaaaaaaaaaaccc...',
  '..SSSDaaaaaaaaaaaaaSSSSSSSSSSaaaaaaaaaaaaaaccc..',
  '..SSSDaaaaaaaaaaaaassssssssstaaaaaaaaaaaaaaccc..',
  '..SSSDaaaaaaaaaaaaattttttttttaaaaaaaaaaaaaaccc..',
  '..sSScaaaaaaaaaaaaaDDDDDDDDDDaaaaaaaaaaaaaccct..',
  '..ssccccaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaacccctt..',
  '..sssccccccaaaaaaaaaaaaaaaaaaaaaaaaaaccccccttt..',
  '..sssssscsccccscaaaaaaaaaaaaaaaaccsccccstttttt..',
  '..stssssstsccsccccsccccsccccsccccscccstttttttt..',
  '...ssstssssstssssssssssssssssssssssststtttttt...',
  '....ssssstssssstssssstssssstssssstsssstttttt....',
  '.....stssssstssssstssssstssssstssssststtttt.....',
  '........tttttttttttttttttttttttttttttttt........',
  '...........tttttttttttttttttttttttttt...........',
  '................TTTTTTTTTTTTTTTT................',
  '................................................',
  '................................................',
  '................................................',
  '................................................',
]

type Pt = [number, number, string]

const stamp = (rows: string[], pts: Pt[]): string[] => {
  const g = rows.map((r) => r.split(''))
  for (const [x, y, c] of pts) if (g[y] && x >= 0 && x < g[y].length) g[y][x] = c
  return g.map((r) => r.join(''))
}

/** Join equal-height frames side by side into one strip. */
const hstrip = (frames: string[][]): string[] => frames[0].map((_, y) => frames.map((fr) => fr[y]).join(''))

// One water arc (left side); mirrored on the right. Droplets travel along it.
const FOUNTAIN_ARC: [number, number][] = [
  [17, 3], [16, 4], [15, 5], [14, 6], [14, 7],
  [13, 8], [13, 9], [13, 10], [13, 11], [13, 12], [13, 13], [13, 14], [13, 15], [13, 16],
  [13, 17], [13, 18], [13, 19], [13, 20], [13, 21], [13, 22], [13, 23], [13, 24], [13, 25], [13, 26],
]
const FOUNTAIN_JET: Pt[][] = [
  [[23, 3, 'f'], [24, 3, 'f'], [23, 2, 'A'], [24, 2, 'A'], [23, 1, 'f'], [24, 1, 'f']],
  [[23, 3, 'A'], [24, 3, 'A'], [23, 2, 'f'], [24, 2, 'f'], [23, 1, 'A'], [24, 1, 'A'], [23, 0, 'f'], [24, 0, 'f']],
  [[23, 3, 'f'], [24, 3, 'A'], [23, 2, 'A'], [24, 2, 'f'], [22, 1, 'f'], [25, 1, 'f']],
]
const FOUNTAIN_SPLASH: Pt[][] = [
  [[12, 27, 'f'], [13, 27, 'f'], [14, 27, 'A'], [11, 26, 'A']],
  [[12, 27, 'A'], [13, 27, 'f'], [14, 27, 'f'], [13, 28, 'A']],
  [[11, 27, 'f'], [12, 27, 'A'], [13, 27, 'f'], [14, 26, 'f']],
]
const FOUNTAIN_RIPPLE: [number, number][][] = [
  [[8, 30], [9, 30], [10, 30], [33, 34], [34, 34], [35, 34], [16, 35], [17, 35]],
  [[9, 31], [10, 31], [11, 31], [34, 33], [35, 33], [36, 33], [19, 35], [20, 35]],
  [[7, 29], [8, 29], [36, 32], [37, 32], [38, 32], [14, 34], [15, 34]],
]
const FOUNTAIN_FOAM: Pt[][] = [
  [[17, 9, 'f'], [30, 9, 'f'], [18, 31, 'f'], [29, 31, 'f']],
  [[18, 9, 'f'], [29, 9, 'f'], [18, 30, 'f'], [29, 32, 'f']],
  [[19, 9, 'f'], [28, 9, 'f'], [17, 31, 'f'], [30, 31, 'f']],
]

const fountainFrame = (f: number): string[] => {
  const pts: Pt[] = [...FOUNTAIN_JET[f], ...FOUNTAIN_FOAM[f]]
  FOUNTAIN_ARC.forEach(([x, y], i) => {
    const c = (i + f) % 3 === 0 ? 'f' : 'A'
    for (const xx of [x, x + 1, 46 - x, 47 - x]) pts.push([xx, y, c])
  })
  for (const [x, y, c] of FOUNTAIN_SPLASH[f]) {
    pts.push([x, y, c])
    pts.push([47 - x, y, c])
  }
  for (const [x, y] of FOUNTAIN_RIPPLE[f]) pts.push([x, y, 'A'])
  return stamp(FOUNTAIN_BASE, pts)
}

const FOUNTAIN_LEGEND: Legend = {
  s: 'stone',
  S: 'stoneLight',
  t: 'stoneDark',
  T: 'stoneDeep',
  c: 'cobble',
  a: 'water',
  A: 'waterLight',
  D: 'waterDeep',
  f: 'foam',
}

/* ---------------- windmill body (48×80) ---------------- */
// Plastered tower on a stone base; the blade hub bolt sits at (24, 20).
const WINDMILL_ROWS = [
  '........................m.......................',
  '........................mRRR....................',
  '........................mRR.....................',
  '........................m.......................',
  '.......................Wp.......................',
  '......................WppP......................',
  '.....................WpppPP.....................',
  '....................PPPPPPPP....................',
  '...................WppppppPPP...................',
  '..................WpppppppPPPP..................',
  '.................PPPPPPPPPPPPPP.................',
  '................WppppppppppPPPPP................',
  '...............WpppppppppppPPPPPP...............',
  '..............PPPPPPPPPPPPPPPPPPPP..............',
  '.............WppppppppppppppPPPPPPP.............',
  '............WpppppppppppppppPPPPPPPP............',
  '...........dddddddddddddddddddddddddd...........',
  '............aaaaaaaaaaaaaaaaaAAAAAAB............',
  '............aaaaaaaaaaadddaaaAAAAAAB............',
  '............aaaaaaaaaadWwwdaaAAAAAAB............',
  '............aaaaaaaaaadwmwdaaAAAAAAB............',
  '............aaaaaaaaaadwwddaaAAAAAAB............',
  '............aaaaaaaaaaadddaaaAAAAAAB............',
  '............aaaaaaaaaaaAAAaaaAAAAAAB............',
  '............aaaaaaaaaaaaaaaaaAAAAAAB............',
  '............aaaaaaaaaaaddaaaaAAAAAAB............',
  '............aaaaaaaaaadGgdaaaAAAAAAB............',
  '............aaaaaaaaaadGgdaaaAAAAAAB............',
  '............aaaaaaaaaaaddaaaaAAAAAAB............',
  '...........AAAAAAAAAAAAAAAAAAAAAAAAAB...........',
  '...........aaaaaaaaaaaaaaaaaaAAAAAAAB...........',
  '...........aaaaaaaaaaaaaaaaaaAAAAAAAB...........',
  '...........aaaaaaaaaaaaaaaaaaAAAAAAAB...........',
  '...........aaaaaaaaaaddddddaaAAAAAAAB...........',
  '...........aaaaaaaaaadGGggdaaAAAAAAAB...........',
  '...........aaaaaaaaaadGgggdaaAAAAAAAB...........',
  '...........aaaaaaaaaaddddddaaAAAAAAAB...........',
  '...........aaaaaaaaaadggggdaaAAAAAAAB...........',
  '...........aaaaaaaaaddddddddaAAAAAAAB...........',
  '...........aaaaaaaaaaaaaaaaaaAAAAAAAB...........',
  '...........aaaaaaaaaaaaaaaaaaAAAAAAAB...........',
  '...........aaaaaaaaaaaaaaaaaaAAAAAAAB...........',
  '...........aaaaaaaaaaaaaaaaaaAAAAAAAB...........',
  '...........aaaaaaaaaaaaaaaaaaAAAAAAAB...........',
  '...........aaaaaaaaaaaaaaaaaaAAAAAAAB...........',
  '..........AAAAAAAAAAAAAAAAAAAAAAAAAAAB..........',
  '..........aaaaaaaaaaaaaaaaaaaaAAAAAAAB..........',
  '..........aaaaaaaaaaaaaaaaaaaaAAAAAAAB..........',
  '..........aaaaaaaaaaaaaaaaaaaaAAAAAAAB..........',
  '..........aaaaaaaaaaaaaaaaaaaaAAAAAAAB..........',
  '..........aaaaaaaaaaaaaaaaaaaaAAAAAAAB..........',
  '..........aaaaaaaaaaaaaaaaaaaaAAAAAAAB..........',
  '..........aaaaaaaaaaaaaaaaaaaaAAAAAAAB..........',
  '..........aaaaaaaaaaaaaaaaaaaaAAAAAAAB..........',
  '..........aaaaaaaaaaaaaaaaaaaaAAAAAAAB..........',
  '..........aaaaaaaaaaaaaaaaaaaaAAAAAAAB..........',
  '..........aaaaaaaaaaaaaaaaaaaaAAAAAAAB..........',
  '..........aaaaaaaaaaaaaaaaaaaaAAAAAAAB..........',
  '..........aaaaaaaaaaaaaaaaaaaaAAAAAAAB..........',
  '..........aaaaaaaaaaaaaaaaaaaaAAAAAAAB..........',
  '..........aaaaaaaaaaaaaaaaaaaaAAAAAAAB..........',
  '.........AAAAAAAAAAAAAAAAAAAAAAAAAAAAAB.........',
  '.........aaaaaaaaaaaaaaaaaaaaaAAAAAAAAB.........',
  '.........aaaaaaaaaaaaaaaaaaaaaAAAAAAAAB.........',
  '.........aaaaaaaaaaaaaaaaaaaaaAAAAAAAAB.........',
  '.........aaaaaaaaaaaaaddddaaaaAAAAAAAAB.........',
  '.........aaaaaaaaaaaadWwwwdaaaAAAAAAAAB.........',
  '.........aaaaaaaaaaaadWwwwdaaaAAAAAAAAB.........',
  '.........aaaaaaaaaaaadWwwwdaaaAAAAAAAAB.........',
  '.........aaaaaaaaaaaadWwwwdaaaAAAAAAAAB.........',
  '.........aaaaaaaaaaaadWwwwdaaaAAAAAAAAB.........',
  '.........aaaaaaaaaaaadWwwydaaaAAAAAAAAB.........',
  '.........SSSSSSSSSSSSdWwwwdSSSSSSSSSSSS.........',
  '.........sssstsssstssdWwwwdstsssstsssst.........',
  '.........sssstsssstssdWwwwdstsssstsssst.........',
  '.........ttttttttttttdWwwwdtttttttttttt.........',
  '.........sstsssstssssdWwwwdsssstsssstss.........',
  '.........sstsssstssssddddddsssstsssstss.........',
  '................................................',
  '................................................',
]

/* ---------------- windmill blades (48×48 × 4 frames, procedural) ---------------- */
// Four spars with cream sail cloth, rotating 22.5° per frame around the centre.
function paintWindmillBlades(r: Raster): void {
  const frames = 4
  const fw = r.w / frames
  withOutline(r, (s) => {
    for (let f = 0; f < frames; f++) {
      const cx = f * fw + fw / 2 - 0.5
      const cy = r.h / 2 - 0.5
      const base = (f * 22.5 * Math.PI) / 180
      for (let k = 0; k < 4; k++) {
        const ang = base + (k * Math.PI) / 2
        const dx = Math.cos(ang)
        const dy = Math.sin(ang)
        const px = -dy
        const py = dx
        // sail cloth (one side of the spar), with lattice bars
        for (let t = 7; t <= 20; t += 0.5) {
          for (let o = 1; o <= 5; o += 0.5) {
            const x = Math.round(cx + dx * t + px * o)
            const y = Math.round(cy + dy * t + py * o)
            const bar = Math.round(t) % 4 === 0 || o >= 4.5
            setPx(s, x, y, bar ? K('creamDark') : K('cream'))
          }
        }
        // wooden spar (2px)
        for (let t = 0; t <= 21; t += 0.5) {
          setPx(s, Math.round(cx + dx * t), Math.round(cy + dy * t), K('woodDark'))
          setPx(s, Math.round(cx + dx * t - px * 0.7), Math.round(cy + dy * t - py * 0.7), K('wood'))
        }
      }
      // hub
      for (let y = Math.floor(cy - 3); y <= Math.ceil(cy + 3); y++)
        for (let x = Math.floor(cx - 3); x <= Math.ceil(cx + 3); x++) {
          const d = Math.hypot(x - cx, y - cy)
          if (d <= 3) setPx(s, x, y, d <= 1.4 ? K('metalDark') : d <= 2.2 ? K('wood') : K('woodDark'))
        }
    }
  })
}

/* ---------------- boat (56×32) ---------------- */
// Double-ended fishing boat from above: thwart bench, rolled net astern,
// lantern on a pole at the bow, painted blue waterline stripe.
const BOAT_ROWS = [
  '........................................................',
  '........................................................',
  '........................................................',
  '........................................................',
  '.......ddddddd..........................................',
  '.......wd....m..........................................',
  '.......wd....mm.........................................',
  '.......wd...myym........................................',
  '.......wd...mYYm..WWWWWWWWWWWWWWWWWWWW..................',
  '.......wd..WmyymWWddddddddddddddddddddWWWWWWW...........',
  '.......wdWWddmmdddppppppWwwdppppppppppdddddddWWWW.......',
  '....WWWwdddpppppppppppppWwwdpppppppppppppppnccnddWWW....',
  '...WdddwdpppppppppppppppWwwdpppppppppppppcnccnccndddW...',
  '..WdPPPPPPPPPPPPPPPPPPPPWwwdPPPPPPPPPPPPcnccnccnccPPdW..',
  '..dpppppppppppppppppppppWwwdppppppppppppnccnccnccnpppd..',
  '.WwpppppppppppppppppppppWwwdppppppppppppccnccnccnccppwW.',
  '.dWwppppppppppppppppppppWwwdppppppppppppcnccnccnccppwWd.',
  '..dWwwwPPPPPPPPPPPPPPPPPWwwdPPPPPPPPPPPPnccnccnccnwwWd..',
  '...BWWWwwwwpppppppppppppWwwdppppppppppppplnccncclWWWB...',
  '...dBBBWWWWwwwwwwwppppppWwwdppppppppppwwwwwllllWWBBBd...',
  '....dddBBBBWWWWWWWwwwwwwWwwdwwwwwwwwwwWWWWWWWBBBBddd....',
  '.......ddddBBBBBBBWWWWWWWWWWWWWWWWWWWWBBBBBBBdddd.......',
  '.......ddddddddwwwBBBBBBBBBBBBBBBBBBBBwwwdddddddd.......',
  '...........dddddddwwwwwwwwwwwwwwwwwwwwddddddd...........',
  '...............dddddddddddddddddddddddddd...............',
  '..................dddddddddddddddddddd..................',
  '........................................................',
  '........................................................',
  '........................................................',
  '........................................................',
  '........................................................',
  '........................................................',
]

/* ---------------- well (28×32) ---------------- */
const WELL_ROWS = [
  '............WWWW............',
  '..........WppppPPP..........',
  '........WpppppppPPPP........',
  '......PPPPPPPPPPPPPPPP......',
  '....WppppppppppppPPPPPPP....',
  '..WpppppppppppppppPPPPPPPP..',
  '.dddddddddddddddddddddddddd.',
  '...wd..................wd...',
  '...wd..................wd...',
  '...wdwwwwwwwwwwwwwwwwwwwd...',
  '...wd........n........wd....',
  '...wd........m........wd....',
  '...wd.......m.m.......wd....',
  '...wd......mmmmmm.....wd....',
  '...wd......Wwwwwd.....wd....',
  '...wd......Wwwwwd.....wd....',
  '...wd......dddddd.....wd....',
  '...wd..................wd...',
  '...wd..................wd...',
  '...wd..SSSsSSSsSSSsSS..wd...',
  '...wdSsSSkkkkkkkkkkSSSswd...',
  '..cwdckkkkkkkkkkkkkkkkcwdc..',
  '.cccckkkaakkkkkkkkkkkkkcccc.',
  '.scccckkkkkkkkkkkakkkkccccs.',
  '.sscccccckkkkkkkkkkccccccts.',
  '.stssssccccccccccccccstssss.',
  '.sssstsssstsssstsssstssssts.',
  '..tsssstsssstsssstsssstsss..',
  '...tttttttttttttttttttttt...',
  '.......tttttttttttttt.......',
  '............................',
  '............................',
]

/* ---------------- market stall (56×44) ---------------- */
const STALL_STRIPE = 'RRRRRreeeeecRRRRRreeeeecRRRRRreeeeecRRRRRreeeeecRRRRRr'
const STALL_ROWS = [
  '.dddddddddddddddddddddddddddddddddddddddddddddddddddddd' + '.',
  '.' + STALL_STRIPE + '.',
  '.' + STALL_STRIPE + '.',
  '.' + STALL_STRIPE + '.',
  '.' + STALL_STRIPE + '.',
  '.' + STALL_STRIPE + '.',
  '.' + STALL_STRIPE + '.',
  '.' + STALL_STRIPE + '.',
  '.' + STALL_STRIPE + '.',
  '..RRRr..eeec..RRRr..eeec..RRRr..eeec..RRRr..eeec..RRRr..',
  '...Rr....ec....Rr....ec....Rr....ec....Rr....ec....Rr...',
  '..wd................................................wd..',
  '..wd................................................wd..',
  '..wd................................................wd..',
  '..wd................................................wd..',
  '..wd................................................wd..',
  '..wd................................................wd..',
  '..wd................................................wd..',
  '..wd................................................wd..',
  '..wd................................................wd..',
  '..wd....................................gg..............',
  '..wd.....LcLcLL......g...g...g........oooooo............',
  '..wd....LLLLLLLl....eAA.eAA.eAA......ooOooOoo...........',
  '..wd....llllllll....AAA.AAA.AAA.....ooOooOooOo..........',
  '..wdWWWWLLLLLLWWWWWWWWeAAWeAAWWWWWWWooOooOooOoWWWWWWwd..',
  '..wdpppLLLLLLLlpppppppAAApAAApppppppooOooOooOoppppppwd..',
  '..wdpppllllllllppppppppppppppppppppppOOOOOOOOpppppppwd..',
  '..wdppppppppppppppppppppppppppppppppppppppppppppppppwd..',
  '..wdPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPwd..',
  '..wdWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWwd..',
  '..wdwwwwwwwwwdwwwwwwwwwdwwwwwwwwwdwwwwwwwwwdwwwwwwwwwd..',
  '..wdwwwwwwwwwdwwwwwwwwwdwwwwwwwwwdwwwwwwwwwdwwwwwwwwwd..',
  '..wdwwwwwwwwwdwwwwwwwwwdwwwwwwwwwdwwwwwwwwwdwwwwwwwwwd..',
  '..wdwwwwwwwwwdwwwwwwwwwdwwwwwwwwwdwwwwwwwwwdwwwwwwwwwd..',
  '..wdwwwwwwwwwdwwwwwwwwwdwwwwwwwwwdwwwwwwwwwdwwwwwwwwwd..',
  '..wdwwwwwwwwwdwwwwwwwwwdwwwwwwwwwdwwwwwwwwwdwwwwwwwwwd..',
  '..wdwwwwwwwwwdwwwwwwwwwdwwwwwwwwwdwwwwwwwwwdwwwwwwwwwd..',
  '..wdwwwwwwwwwdwwwwwwwwwdwwwwwwwwwdwwwwwwwwwdwwwwwwwwwd..',
  '..wdwwwwwwwwwdwwwwwwwwwdwwwwwwwwwdwwwwwwwwwdwwwwwwwwwd..',
  '..wdwwwwwwwwwdwwwwwwwwwdwwwwwwwwwdwwwwwwwwwdwwwwwwwwwd..',
  '..wddddddddddddddddddddddddddddddddddddddddddddddddddd..',
  '..wd................................................wd..',
  '........................................................',
  '........................................................',
]

/* ---------------- small props ---------------- */

const CRATE_ROWS = [
  '................',
  '.WWWWWWWWWWWWWW.',
  '.Wmwwwwwwwwwwmd.',
  '.WwWwwwwwwwwWwd.',
  '.WwwWwwwwwwWwwd.',
  '.WwwwWwwwwWwwwd.',
  '.WwwwwWwwWwwwwd.',
  '.WwwwwwWWwwwwwd.',
  '.WwwwwwWWwwwwwd.',
  '.WwwwwWwwWwwwwd.',
  '.WwwwWwwwwWwwwd.',
  '.WwwWwwwwwwWwwd.',
  '.WwWwwwwwwwwWwd.',
  '.Wmwwwwwwwwwwmd.',
  '.dddddddddddddd.',
  '................',
]

const BARREL_ROWS = [
  '................',
  '................',
  '...PPPPPPPPPP...',
  '..PppppppppppP..',
  '..Wwwwwwwwwwdd..',
  '.WWwwwwwwwwwwdd.',
  '.MMmmmmmmmmmmmm.',
  '.MMmmmmmmmmmmmm.',
  '.WWwwwdwwwdwwdd.',
  '.WWwwwdwwwdwwdd.',
  '.WWwwwdwwwdwwdd.',
  '.WWwwwdwwwdwwdd.',
  '.WWwwwdwwwdwwdd.',
  '.MMmmmmmmmmmmmm.',
  '.MMmmmmmmmmmmmm.',
  '.WWwwwdwwwdwwdd.',
  '..Wwwdwwwdwwdd..',
  '..wwwdwwwdwwdd..',
  '..dddddddddddd..',
  '................',
]

const TELESCOPE_ROWS = [
  '........................',
  '........................',
  '..................Bmm...',
  '.................BBmg...',
  '................BBbmm...',
  '...............BBbOm....',
  '...............BbO......',
  '..............BbO.......',
  '.............BbO........',
  '............BbO.........',
  '...........BbO..........',
  '..........BbO...........',
  '.........BbO............',
  '........BbO.............',
  '.......mbO..............',
  '.......mO.mm............',
  '......mm.wddw...........',
  '.....mm..wddw...........',
  '.....m..w.dd.w..........',
  '........w.dd.w..........',
  '.......w..dd..w.........',
  '.......w..dd..w.........',
  '......w...dd...w........',
  '......w...dd...w........',
  '.....w....dd....w.......',
  '.....w....dd....w.......',
  '....w.....dd.....w......',
  '....w.....dd.....w......',
  '....w............w......',
  '...dd............dd.....',
  '........................',
  '........................',
]

const MAILBOX_ROWS = [
  'yy..........',
  'yy..........',
  'yy..RRRRRR..',
  '.d.RRRRRRRR.',
  '.ddRRRRRRRr.',
  '...RkkkkkRr.',
  '...RRRRRRRr.',
  '...RRWWWRRr.',
  '...RRWWWRRr.',
  '...RRRRRRRr.',
  '...rrrrrrrr.',
  '.....wd.....',
  '.....wd.....',
  '.....wd.....',
  '.....wd.....',
  '.....wd.....',
  '.....wd.....',
  '.....wd.....',
  '.....wd.....',
  '.....wd.....',
  '....dddd....',
  '............',
]

const BELL_ROWS = [
  '.WWWWWWWWWWWWWWWWWW.',
  '.wwwwwwwwwwwwwwwwww.',
  '.dddddddddddddddddd.',
  '..Wwd....mm....Wwd..',
  '..Wwd....bb....Wwd..',
  '..Wwd...Bbbo...Wwd..',
  '..Wwd..BBbboo..Wwd..',
  '..Wwd..BBbboo..Wwd..',
  '..Wwd.BBbbbboo.Wwd..',
  '..Wwd.BBbbbboo.Wwd..',
  '..Wwd.BBbbbboo.Wwd..',
  '..WwdBbbbbbbbooWwd..',
  '..WwdooooooooooWwd..',
  '..Wwd....mm....Wwd..',
  '..Wwd..........Wwd..',
  '..Wwd..........Wwd..',
  '..Wwd..........Wwd..',
  '..Wwd..........Wwd..',
  '..Wwd..........Wwd..',
  '..Wwd..........Wwd..',
  '..Wwd..........Wwd..',
  '..Wwd..........Wwd..',
  '..Wwd..........Wwd..',
  '..Wwd..........Wwd..',
  '..Wwd..........Wwd..',
  '..Wwd..........Wwd..',
  '..Wwd..........Wwd..',
  '....................',
]

/* ---------------- items (anchored at their centre) ---------------- */

const GEAR_ROWS = [
  '....MMmm....',
  '....MMmm....',
  '..mMMMMmmm..',
  '..MMMMMMmm..',
  'MMMMMMMMMmmm',
  'MMMMM..mmmmm',
  'MMMMM..mmmmm',
  'MMMMMMMMmmmm',
  '..MMMMMMmm..',
  '..mMMMMmmm..',
  '....MMmm....',
  '....MMmm....',
]

const FISH_ROWS = [
  '....oo........',
  '..bbbbbbb...o.',
  '.bWkbbbbbb.oo.',
  'bbbbbbbbbbooo.',
  '.bhhhhhhhb.oo.',
  '..hhhhhhh...o.',
  '....oo........',
  '..............',
]

const SHELL_ROWS = [
  '..........',
  '..........',
  '..pppppp..',
  '.pcpcpcpc.',
  '.pcpcpcpc.',
  '..pcpcpc..',
  '...pcpc...',
  '....pp....',
  '..........',
  '..........',
]

const BOBBER_ROWS = [
  '..mm..',
  '.rrrr.',
  'rrrrrr',
  'rrrrrr',
  'wwwwww',
  '.wwww.',
  '......',
  '......',
]

/* ---------------- speech bubbles (drawn above NPC heads) ---------------- */

const bubble12 = (glyph: Pt[]): string[] =>
  stamp(
    [
      '.wwwwwwwwww.',
      'wwwwwwwwwwww',
      'wwwwwwwwwwww',
      'wwwwwwwwwwww',
      'wwwwwwwwwwww',
      'wwwwwwwwwwww',
      'wwwwwwwwwwww',
      'wwwwwwwwwwww',
      'wwwwwwwwwwww',
      '.wwwwwwwwww.',
      '....www.....',
      '....ww......',
      '....w.......',
      '............',
    ],
    glyph,
  )

const EXCL_GLYPH: Pt[] = [
  [5, 2, 'y'], [6, 2, 'Y'],
  [5, 3, 'y'], [6, 3, 'Y'],
  [5, 4, 'y'], [6, 4, 'Y'],
  [5, 5, 'y'], [6, 5, 'Y'],
  [5, 7, 'y'], [6, 7, 'Y'],
]

const QUEST_GLYPH: Pt[] = [
  [5, 2, 't'], [6, 2, 't'],
  [4, 3, 't'], [7, 3, 't'],
  [7, 4, 't'],
  [6, 5, 't'],
  [5, 7, 't'], [6, 7, 't'],
]

const DOTS_ROWS = [
  '..............',
  '.wwwwwwwwwwww.',
  'wwwwwwwwwwwwww',
  'wwwwwwwwwwwwww',
  'wwiiwwiiwwiiww',
  'wwiiwwiiwwiiww',
  'wwwwwwwwwwwwww',
  'wwwwwwwwwwwwww',
  '.wwwwwwwwwwww.',
  '.....ww.......',
  '.....w........',
  '..............',
]

const HEART_ROWS = [
  '............',
  '............',
  '............',
  '..ppp..ppp..',
  '.pWpppppppp.',
  '.pppppppppp.',
  '.pppppppppp.',
  '..pppppppp..',
  '...pppppp...',
  '....pppp....',
  '.....pp.....',
  '............',
]

const ZZZ_ROWS = [
  '............',
  '.......bbbb.',
  '.........b..',
  '........b...',
  '.......bbbb.',
  '.BBBBBB.....',
  '....BB......',
  '...BB.......',
  '..BB........',
  '.BBBBBB.....',
  '............',
  '............',
]

/* ---------------- the pack ---------------- */

const WOODY: Legend = { W: 'woodLight', w: 'wood', d: 'woodDark' }

export const PROP_DEFS: SpriteDef[] = [
  {
    name: 'fountain',
    rows: hstrip([fountainFrame(0), fountainFrame(1), fountainFrame(2)]),
    legend: FOUNTAIN_LEGEND,
    outline: 'outline',
    frames: 3,
    anchor: [24, 44],
  },
  ascii(
    'windmill',
    WINDMILL_ROWS,
    {
      m: 'metalDark',
      R: 'red',
      W: 'woodLight',
      w: 'wood',
      d: 'woodDark',
      p: 'plank',
      P: 'plankDark',
      y: 'yellow',
      a: 'wall',
      A: 'wallShade',
      B: 'wallDark',
      G: 'glassLight',
      g: 'glass',
      S: 'stoneLight',
      s: 'stone',
      t: 'stoneDark',
    },
    { anchor: [24, 78] },
  ),
  {
    name: 'windmill_blades',
    w: 192,
    h: 48,
    frames: 4,
    legend: {},
    paint: paintWindmillBlades,
    anchor: [24, 24],
  },
  ascii(
    'boat',
    BOAT_ROWS,
    {
      ...WOODY,
      p: 'plank',
      P: 'plankDark',
      B: 'roofBlue',
      c: 'cream',
      n: 'sandDark',
      l: 'sandWet',
      m: 'metalDark',
      y: 'yellow',
      Y: 'windowNight',
    },
    { anchor: [28, 26] },
  ),
  ascii(
    'well',
    WELL_ROWS,
    {
      ...WOODY,
      p: 'plank',
      P: 'plankDark',
      m: 'metalDark',
      n: 'creamDark',
      c: 'cobble',
      S: 'stoneLight',
      s: 'stone',
      t: 'stoneDark',
      k: 'ink',
      a: 'waterLight',
    },
    { anchor: [14, 30] },
  ),
  ascii(
    'stall',
    STALL_ROWS,
    {
      ...WOODY,
      R: 'roofRed',
      r: 'roofRedDark',
      e: 'white',
      c: 'creamDark',
      p: 'plank',
      P: 'plankDark',
      L: 'sandLight',
      l: 'sandDark',
      A: 'red',
      g: 'moss',
      o: 'orange',
      O: 'orangeDark',
    },
    { anchor: [28, 42] },
  ),
  ascii('crate', CRATE_ROWS, { ...WOODY, m: 'metalDark' }),
  ascii('barrel', BARREL_ROWS, { ...WOODY, p: 'plank', P: 'plankDark', M: 'metalLight', m: 'metalDark' }),
  ascii(
    'telescope',
    TELESCOPE_ROWS,
    { B: 'yellow', b: 'yellowDark', O: 'orangeDark', m: 'metalDark', g: 'glassLight', w: 'wood', d: 'woodDark' },
    { anchor: [12, 30] },
  ),
  ascii(
    'mailbox',
    MAILBOX_ROWS,
    { y: 'yellow', d: 'woodDark', R: 'red', r: 'redDark', k: 'ink', W: 'white', w: 'wood' },
    { anchor: [6, 21] },
  ),
  ascii(
    'bell',
    BELL_ROWS,
    { ...WOODY, m: 'metalDark', b: 'yellowDark', B: 'yellow', o: 'orangeDark' },
    { anchor: [10, 27] },
  ),
  ascii('item_gear', GEAR_ROWS, { M: 'metalLight', m: 'metal' }, { anchor: [6, 6] }),
  ascii('item_fish', FISH_ROWS, { b: 'blue', h: 'shallow', o: 'orange', W: 'white', k: 'ink' }, { anchor: [7, 4] }),
  ascii('item_shell', SHELL_ROWS, { p: 'pink', c: 'cream' }, { anchor: [5, 5] }),
  ascii('bobber', BOBBER_ROWS, { m: 'metalDark', r: 'red', w: 'white' }, { anchor: [3, 4] }),
  ascii('rod_tip', ['..wd', '.wd.', 'wd..', 'd...'], { w: 'wood', d: 'woodDark' }, { outline: undefined, anchor: [2, 2] }),
  ascii('bubble_excl', bubble12(EXCL_GLYPH), { w: 'white', y: 'yellow', Y: 'yellowDark' }),
  ascii('bubble_quest', bubble12(QUEST_GLYPH), { w: 'white', t: 'teal' }),
  ascii('bubble_dots', DOTS_ROWS, { w: 'white', i: 'inkSoft' }),
  ascii('bubble_heart', HEART_ROWS, { p: 'pink', W: 'white' }),
  ascii('bubble_zzz', ZZZ_ROWS, { B: 'blue', b: 'waterLight' }),
  {
    name: 'firework',
    w: 6,
    h: 6,
    legend: {},
    paint: (r) => {
      const cx = (r.w - 1) / 2
      const cy = (r.h - 1) / 2
      for (let y = 0; y < r.h; y++)
        for (let x = 0; x < r.w; x++) {
          const d = Math.hypot(x - cx, y - cy) / (r.w / 2)
          if (d <= 1) setPx(r, x, y, d < 0.5 ? [255, 250, 224, 255] : [255, 236, 160, d > 0.85 ? 130 : 255])
        }
    },
    anchor: [3, 3],
  },
]
