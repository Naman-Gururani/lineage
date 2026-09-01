export type AchievementDef = { id: string; title: string; desc: string; icon: string; secret?: boolean }

export const ACHIEVEMENTS: AchievementDef[] = [
  { id: 'first_steps', title: 'First Steps', desc: 'Set foot on Lineage Isle.', icon: '👣' },
  { id: 'sprinter', title: 'Sprinter', desc: 'Run 200 tiles.', icon: '💨' },
  { id: 'grass_whisperer', title: 'Grass Whisperer', desc: 'Cut 50 tufts of tall grass.', icon: '🌿' },
  { id: 'bonk', title: 'Bonk', desc: 'Whack a signpost ten times. It felt nothing.', icon: '🪧' },
  { id: 'collector', title: 'Collector', desc: 'Recover 10 lost packets.', icon: '◈' },
  { id: 'archivist', title: 'Archivist', desc: 'Recover every lost packet.', icon: '📦' },
  { id: 'night_owl', title: 'Night Owl', desc: 'Watch the lamps come on.', icon: '🌙' },
  { id: 'rain_dancer', title: 'Rain Dancer', desc: 'Get caught in the rain.', icon: '🌧️' },
  { id: 'well_read', title: 'Well-Read', desc: 'Open Reader Mode.', icon: '📖' },
  { id: 'summit', title: 'Summit', desc: 'Find the telescope on Tower Heights.', icon: '🔭', secret: true },
  { id: 'fisher', title: 'Fisher', desc: 'Catch a fish.', icon: '🐟' },
  { id: 'cat_person', title: 'Cat Person', desc: 'Befriend Byte.', icon: '🐈' },
  { id: 'full_house', title: 'Full House', desc: 'Talk to every villager.', icon: '🗣️' },
  { id: 'keeper', title: 'Keeper', desc: 'Light the beacon.', icon: '🗼' },
  { id: 'complete', title: '100%', desc: 'Discover everything, finish every quest, earn every badge.', icon: '👑' },
]
