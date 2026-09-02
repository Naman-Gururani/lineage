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
  // The five games. Ids are prefixed because a game already owns its bare name
  // elsewhere — as a quest id, as a panel — and nothing good comes of a badge
  // and an errand sharing one. `story` below is the one deliberate exception.
  { id: 'ach_wordle', title: 'Five Letters', desc: 'Solve Bo’s word puzzle on the pier.', icon: '🔤' },
  { id: 'ach_claw', title: 'Prize Winner', desc: 'Work the claw at Sol’s Prize Tent.', icon: '🧸' },
  { id: 'ach_flappy', title: 'Frequent Flyer', desc: 'Fly the chalkboard course at the campus.', icon: '🪶' },
  { id: 'ach_forge', title: 'Full Stack', desc: 'Spell out the toolkit at the Workshop bench.', icon: '🔧' },
  { id: 'ach_crew', title: 'Last Bean Standing', desc: 'Out-last the crew on the dropping floor.', icon: '🫘' },
  { id: 'arcade', title: 'Arcade Legend', desc: 'Beat all five of the island’s games.', icon: '🕹️' },
  { id: 'story', title: 'The Whole Story', desc: 'Hear Naman’s story from the pier to the lighthouse.', icon: '🗺️' },
  { id: 'goldfish', title: 'One in a Million', desc: 'Land the goldfish.', icon: '🐠', secret: true },
  { id: 'complete', title: '100%', desc: 'Discover everything, finish every quest, earn every badge.', icon: '👑' },
]
