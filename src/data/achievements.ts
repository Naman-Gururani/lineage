export type AchievementDef = { id: string; title: string; desc: string; icon: string; secret?: boolean }

export const ACHIEVEMENTS: AchievementDef[] = [
  { id: 'first_steps', title: 'Through the Gate', desc: 'Set foot on the fairground.', icon: '👣' },
  { id: 'sprinter', title: 'Sprinter', desc: 'Run 200 tiles.', icon: '💨' },
  { id: 'grass_whisperer', title: 'Grass Whisperer', desc: 'Cut 50 tufts of tall grass.', icon: '🌿' },
  { id: 'bonk', title: 'Bonk', desc: 'Whack a signpost ten times. It felt nothing.', icon: '🪧' },
  { id: 'collector', title: 'Ticket Stub', desc: 'Recover 10 lost tickets.', icon: '🎟️' },
  { id: 'archivist', title: 'Full Book', desc: 'Recover every lost ticket.', icon: '📒' },
  { id: 'night_owl', title: 'Night Owl', desc: 'Watch the lamps come on.', icon: '🌙' },
  { id: 'rain_dancer', title: 'Rain Dancer', desc: 'Get caught in the rain.', icon: '🌧️' },
  { id: 'well_read', title: 'Well-Read', desc: 'Open Reader Mode.', icon: '📖' },
  { id: 'ride', title: 'Front Seat', desc: 'Ride the Career Coaster.', icon: '🎢' },
  { id: 'fisher', title: 'Hook, Line', desc: 'Hook a duck.', icon: '🎣' },
  { id: 'cat_person', title: 'Cat Person', desc: 'Befriend Byte.', icon: '🐈' },
  { id: 'full_house', title: 'Full House', desc: 'Talk to everyone working the fair.', icon: '🗣️' },
  { id: 'keeper', title: 'Lights On', desc: 'Switch on the fair lights.', icon: '💡' },
  // The five games. Ids are prefixed because a game already owns its bare name
  // elsewhere — as a quest id, as a panel — and nothing good comes of a badge
  // and an errand sharing one. `story` below is the one deliberate exception.
  { id: 'ach_wordle', title: 'Five Letters', desc: 'Solve Bo’s word puzzle at the gate.', icon: '🔤' },
  { id: 'ach_claw', title: 'Prize Winner', desc: 'Work the claw at the Prize Tent.', icon: '🧸' },
  { id: 'ach_flappy', title: 'Frequent Flyer', desc: 'Fly the course at the Chalk Flight booth.', icon: '🪶' },
  { id: 'ach_forge', title: 'Full Stack', desc: 'Spell out the toolkit at the Word Forge.', icon: '🔧' },
  { id: 'ach_crew', title: 'Last Bean Standing', desc: 'Out-last the crew on the dropping floor.', icon: '🫘' },
  { id: 'arcade', title: 'Arcade Legend', desc: 'Beat all five of the fair’s games.', icon: '🕹️' },
  { id: 'story', title: 'The Whole Fair', desc: 'Hear Naman’s story from the gate to the guestbook.', icon: '🎪' },
  { id: 'goldfish', title: 'Golden Duck', desc: 'Hook the golden duck.', icon: '🦆', secret: true },
  { id: 'complete', title: '100%', desc: 'Discover everything, finish every quest, earn every badge.', icon: '👑' },
]
