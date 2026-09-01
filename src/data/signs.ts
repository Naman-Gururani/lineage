// Signpost text, keyed by the blueprint prop id. Short lines (fit a small
// plaque), real directions for the island's layout, one hint or joke each.
//   harbor   — south plaza entrance, on the harbor road
//   plaza_e  — east edge of the plaza (roads to the Woods and the Fields)
//   plaza_w  — west edge of the plaza (roads to the Heights and the Engine)
//   woods    — edge of Whispering Woods, on the Workshop road
//   bridge_a — the upper bridge over the Stream, on the Tower road
//   bridge_b — the lower bridge over the Stream, on the Engine road
//   ridge    — foot of the Stone Ridge ramp, below the Vault
//   point    — start of the walkway to the Lighthouse

export const SIGNS: Record<string, string[]> = {
  harbor: [
    '↑ Village plaza · The Cottage',
    '↓ Harbor · the boat home',
    'Lost? Press M. The map has opinions.',
  ],
  plaza_e: [
    '↑ Whispering Woods · The Workshop',
    '→ Willow Fields · Safe Stride · The Point',
    'Fresh buns behind you. Rumours are free.',
  ],
  plaza_w: [
    '↑ Tower Heights · Barclays Tower',
    '↓ Engine Works · The Engine',
    'Both roads cross the Stream. Bridges provided.',
  ],
  woods: [
    '↑ The Workshop · the windmill',
    '↓ Village plaza',
    'Tall grass hides lost packets. Swing at it (E).',
  ],
  bridge_a: [
    '↑ Tower Heights · up the ramp',
    '→ Village plaza',
    'Bridge ahead. Trolls not included.',
  ],
  bridge_b: [
    '← Engine Works · across the bridge',
    '→ Village plaza',
    'The Stream flows to the Engine. So should you.',
  ],
  ridge: [
    '↑ Stone Ridge · The Vault (up the ramp)',
    '↓ The Cottage · Village plaza',
    "The Vault opens at twenty packets. It's counting.",
  ],
  point: [
    '→ The Point · The Lighthouse',
    '← Willow Fields · Safe Stride',
    'Long walkway. Gulls included. Mind them.',
  ],
}
