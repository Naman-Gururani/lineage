// The one palette every sprite and tile draws from. Named keys keep the island coherent.
//
// Two layers, both live:
//  1. Legacy named keys (`grass`, `woodDark`, `roofRed`…) — unchanged values, still
//     referenced by every existing sprite pack. Never rename or re-tint these.
//  2. HD ramps (`grass1`…`grass7`) — one numbered ramp per hue family, running
//     DARK → LIGHT: index 1 is the deepest shade, the highest index the brightest.
//     Every legacy value is also a member of its family's ramp, so the two layers
//     mix inside a single sprite without a hue clash.
//
// Ramp shape (HD-pixel idiom, spec §3): step 1 is hue-shifted toward the cool
// shadow tint #241f38 so every family's darks agree; saturation peaks in the
// midtones; the top step is a warm-shifted rim light. Shade with 2–3 adjacent
// steps, not with the whole ramp.
//
// Cheat sheet — where each legacy key sits in its family ramp:
//   ink=ink2                  inkSoft=ink5              outline=ink3
//   white=cream6              cream=cream5              creamDark=cream4
//   grey=grey4                sand=sand6                sandLight=sand7
//   sandDark=sand5            sandWet=sand4             grass=grass5
//   grassLight=grass6         grassDark=grass4          grassDeep=grass3
//   moss=grass2               leaf=leaf4                leafLight=leaf5
//   leafDark=leaf3            pine=pine3                pineDark=pine2
//   pineLight=pine5           path=path4                pathLight=path5
//   pathDark=path3            dirt=dirt4                dirtDark=dirt3
//   water=water4              waterLight=water5         waterDeep=water3
//   waterDeeper=water2        foam=water7               shallow=water6
//   stone=stone4              stoneLight=stone6         stoneDark=stone3
//   stoneDeep=stone2          cobble=stone5             wood=wood4
//   woodLight=wood6           woodDark=wood2            plank=wood5
//   plankDark=wood3           roofRed=roofRed4          roofRedDark=roofRed3
//   roofBlue=roofBlue4        roofBlueDark=roofBlue3    roofGreen=roofGreen4
//   roofGreenDark=roofGreen3  roofPurple=roofPurple3    wall=wall6
//   wallShade=wall5           wallDark=wall4            brick=brick4
//   glass=glass5              glassLight=glass6         windowNight=yellow6
//   skin=skin5                skinShade=skin4           skinDark=skin3
//   hairDark=hairBlack2       hairBrown=hairBrown3      hairBlond=hairBlond4
//   hairGrey=hairGrey5        hairRed=hairRed3          red=red4
//   redDark=red3              orange=orange4            orangeDark=orange3
//   yellow=yellow5            yellowDark=yellow3        teal=teal4
//   tealDark=teal3            tealLight=teal6           purple=purple4
//   purpleDark=purple3        pink=pink5                blue=blue5
//   blueDark=blue3            navy=blue2                metal=metal4
//   metalLight=metal5         metalDark=metal2          glow=teal7
//   glowWarm=yellow7
export const PAL = {
  // inks
  ink: '#1b1a2e',
  inkSoft: '#3d3b5c',
  outline: '#2a2340',
  // neutrals
  white: '#fdfbf4',
  cream: '#f6e7c9',
  creamDark: '#e4cfa6',
  grey: '#9aa0ad',
  // sand
  sand: '#e9d59c',
  sandLight: '#f4e6b6',
  sandDark: '#d2b978',
  sandWet: '#c7ad74',
  // grass & foliage
  grass: '#79c457',
  grassLight: '#95d66a',
  grassDark: '#5da745',
  grassDeep: '#3f8a3b',
  moss: '#2f6b35',
  leaf: '#4fae4f',
  leafLight: '#7fd06b',
  leafDark: '#2f7a3e',
  pine: '#2b6d4a',
  pineDark: '#1e5238',
  pineLight: '#3f8f5c',
  // earth
  path: '#c9a36a',
  pathLight: '#dbb87d',
  pathDark: '#a9834f',
  dirt: '#8f6a45',
  dirtDark: '#6b4c31',
  // water
  water: '#3e9fd8',
  waterLight: '#67c4ee',
  waterDeep: '#2b7fc0',
  waterDeeper: '#1f5f9c',
  foam: '#e8f8ff',
  shallow: '#8ad6ee',
  // stone
  stone: '#8d95a3',
  stoneLight: '#b4bcc8',
  stoneDark: '#5f6776',
  stoneDeep: '#3f4553',
  cobble: '#a7adb8',
  // wood
  wood: '#a86e42',
  woodLight: '#c98c5a',
  woodDark: '#7a4b2c',
  plank: '#b98a5a',
  plankDark: '#946b41',
  // buildings
  roofRed: '#d8574a',
  roofRedDark: '#a63d38',
  roofBlue: '#4d7fc4',
  roofBlueDark: '#33578f',
  roofGreen: '#4faa78',
  roofGreenDark: '#2f7a52',
  roofPurple: '#7b5fb5',
  wall: '#f1e2c4',
  wallShade: '#d8c39c',
  wallDark: '#bfa77f',
  brick: '#c9705a',
  glass: '#9fdcf5',
  glassLight: '#d8f3ff',
  windowNight: '#ffd77a',
  // people
  skin: '#f2c6a0',
  skinShade: '#d9a17b',
  skinDark: '#b98058',
  hairDark: '#3a2a24',
  hairBrown: '#7a4a2c',
  hairBlond: '#e5c15b',
  hairGrey: '#c9c9d6',
  hairRed: '#c2523a',
  // accents
  red: '#e2483f',
  redDark: '#a8322c',
  orange: '#f28c28',
  orangeDark: '#c06416',
  yellow: '#ffd23f',
  yellowDark: '#d9a51e',
  teal: '#31c7b3',
  tealDark: '#1f8f81',
  tealLight: '#8ff0e0',
  purple: '#9b6bf2',
  purpleDark: '#6a44b8',
  pink: '#ff8fb0',
  blue: '#3a6fe0',
  blueDark: '#27499a',
  navy: '#2c3a6b',
  // metal & glow
  metal: '#7f8797',
  metalLight: '#aab2c0',
  metalDark: '#4a515e',
  glow: '#bfffe9',
  glowWarm: '#fff1b8',
  shadow: 'rgba(20,30,40,0.28)',
  shadowSoft: 'rgba(20,30,40,0.16)',

  /* ---------- HD ramps (dark → light) ---------- */
  // ink — inks & outlines
  ink1: '#161320',
  ink2: '#1b1a2e',
  ink3: '#2a2340',
  ink4: '#332e4f',
  ink5: '#3d3b5c',
  ink6: '#555377',
  // grey — cool neutrals
  grey1: '#3e3d4e',
  grey2: '#545567',
  grey3: '#6b6e7e',
  grey4: '#9aa0ad',
  grey5: '#b7bbc3',
  grey6: '#d4d6d9',
  // cream — warm neutrals / paper
  cream1: '#663f36',
  cream2: '#a7876c',
  cream3: '#c8ab87',
  cream4: '#e4cfa6',
  cream5: '#f6e7c9',
  cream6: '#fdfbf4',
  // sand — beach
  sand1: '#553a34',
  sand2: '#907452',
  sand3: '#ae9160',
  sand4: '#c7ad74',
  sand5: '#d2b978',
  sand6: '#e9d59c',
  sand7: '#f4e6b6',
  // grass — ground cover
  grass1: '#1d2d2b',
  grass2: '#2f6b35',
  grass3: '#3f8a3b',
  grass4: '#5da745',
  grass5: '#79c457',
  grass6: '#95d66a',
  grass7: '#b9df94',
  // leaf — broadleaf canopy
  leaf1: '#1d322f',
  leaf2: '#245836',
  leaf3: '#2f7a3e',
  leaf4: '#4fae4f',
  leaf5: '#7fd06b',
  leaf6: '#a9da94',
  // pine — conifer canopy
  pine1: '#17252a',
  pine2: '#1e5238',
  pine3: '#2b6d4a',
  pine4: '#328152',
  pine5: '#3f8f5c',
  pine6: '#52af6b',
  // path — trodden earth
  path1: '#442e2f',
  path2: '#79583d',
  path3: '#a9834f',
  path4: '#c9a36a',
  path5: '#dbb87d',
  path6: '#e4d3a7',
  // dirt — bare soil
  dirt1: '#2f1e23',
  dirt2: '#4e3429',
  dirt3: '#6b4c31',
  dirt4: '#8f6a45',
  dirt5: '#ac8c5b',
  dirt6: '#bba97f',
  // water — sea & river (top step is foam)
  water1: '#191e44',
  water2: '#1f5f9c',
  water3: '#2b7fc0',
  water4: '#3e9fd8',
  water5: '#67c4ee',
  water6: '#8ad6ee',
  water7: '#e8f8ff',
  // stone — rock & cobble
  stone1: '#22202d',
  stone2: '#3f4553',
  stone3: '#5f6776',
  stone4: '#8d95a3',
  stone5: '#a7adb8',
  stone6: '#b4bcc8',
  stone7: '#d3d7dc',
  // wood — timber & planks
  wood1: '#341c22',
  wood2: '#7a4b2c',
  wood3: '#946b41',
  wood4: '#a86e42',
  wood5: '#b98a5a',
  wood6: '#c98c5a',
  wood7: '#d3af83',
  // brick — masonry
  brick1: '#542634',
  brick2: '#75353a',
  brick3: '#914844',
  brick4: '#c9705a',
  brick5: '#d39b83',
  brick6: '#dfbfaa',
  brick7: '#ecded0',
  // roofRed — tile roofs
  roofRed1: '#422031',
  roofRed2: '#772c32',
  roofRed3: '#a63d38',
  roofRed4: '#d8574a',
  roofRed5: '#de8b77',
  roofRed6: '#e6b6a2',
  // roofBlue — slate roofs
  roofBlue1: '#1f1f41',
  roofBlue2: '#263a6b',
  roofBlue3: '#33578f',
  roofBlue4: '#4d7fc4',
  roofBlue5: '#76a4ce',
  roofBlue6: '#9ec3d9',
  // roofGreen — copper roofs
  roofGreen1: '#1d3235',
  roofGreen2: '#245844',
  roofGreen3: '#2f7a52',
  roofGreen4: '#4faa78',
  roofGreen5: '#72ba8b',
  roofGreen6: '#96c9a3',
  // roofPurple — shingle roofs
  roofPurple1: '#352a50',
  roofPurple2: '#574285',
  roofPurple3: '#7b5fb5',
  roofPurple4: '#9f84c3',
  roofPurple5: '#bea8d2',
  roofPurple6: '#dacae3',
  // wall — plaster walls
  wall1: '#523a38',
  wall2: '#8a705a',
  wall3: '#a78c6a',
  wall4: '#bfa77f',
  wall5: '#d8c39c',
  wall6: '#f1e2c4',
  // glass — windows & panes
  glass1: '#213f7e',
  glass2: '#3b66a1',
  glass3: '#5c8ebd',
  glass4: '#7ab6dd',
  glass5: '#9fdcf5',
  glass6: '#d8f3ff',
  // skin — faces & hands
  skin1: '#4b2b30',
  skin2: '#845442',
  skin3: '#b98058',
  skin4: '#d9a17b',
  skin5: '#f2c6a0',
  skin6: '#f8e8d3',
  // hairBlack — hair: black
  hairBlack1: '#1f161e',
  hairBlack2: '#3a2a24',
  hairBlack3: '#56423b',
  hairBlack4: '#715b53',
  hairBlack5: '#7e675f',
  hairBlack6: '#89756e',
  // hairBrown — hair: brown
  hairBrown1: '#341c22',
  hairBrown2: '#593225',
  hairBrown3: '#7a4a2c',
  hairBrown4: '#9c6b3d',
  hairBrown5: '#b88e54',
  hairBrown6: '#c4ad7b',
  // hairBlond — hair: blond
  hairBlond1: '#643a26',
  hairBlond2: '#8a5c2e',
  hairBlond3: '#a97e3d',
  hairBlond4: '#e5c15b',
  hairBlond5: '#e9d68a',
  hairBlond6: '#efe4b7',
  // hairGrey — hair: grey
  hairGrey1: '#49435c',
  hairGrey2: '#68637c',
  hairGrey3: '#88859a',
  hairGrey4: '#a8a6b9',
  hairGrey5: '#c9c9d6',
  hairGrey6: '#e3e3e8',
  // hairRed — hair: red
  hairRed1: '#4b212f',
  hairRed2: '#8a3731',
  hairRed3: '#c2523a',
  hairRed4: '#cc8063',
  hairRed5: '#d6a88c',
  hairRed6: '#e2c9b3',
  // red — accent: red
  red1: '#431c2e',
  red2: '#79242a',
  red3: '#a8322c',
  red4: '#e2483f',
  red5: '#e5816f',
  red6: '#eab19d',
  // orange — accent: orange
  orange1: '#4a1c1d',
  orange2: '#893f15',
  orange3: '#c06416',
  orange4: '#f28c28',
  orange5: '#f0b55d',
  orange6: '#f1d38f',
  // yellow — accent: warm light (windowNight/glowWarm live here)
  yellow1: '#522e20',
  yellow2: '#9a6b1a',
  yellow3: '#d9a51e',
  yellow4: '#f4bf27',
  yellow5: '#ffd23f',
  yellow6: '#ffd77a',
  yellow7: '#fff1b8',
  // teal — accent: teal (glow lives here)
  teal1: '#183240',
  teal2: '#196363',
  teal3: '#1f8f81',
  teal4: '#31c7b3',
  teal5: '#5be0cd',
  teal6: '#8ff0e0',
  teal7: '#bfffe9',
  // purple — accent: purple
  purple1: '#30244e',
  purple2: '#4c3186',
  purple3: '#6a44b8',
  purple4: '#9b6bf2',
  purple5: '#c49df3',
  purple6: '#e4ccf7',
  // pink — accent: pink
  pink1: '#7f1560',
  pink2: '#a52d75',
  pink3: '#c34e88',
  pink4: '#e66a9b',
  pink5: '#ff8fb0',
  pink6: '#fdc4cf',
  // blue — accent: blue (navy lives here)
  blue1: '#1e1a35',
  blue2: '#2c3a6b',
  blue3: '#27499a',
  blue4: '#2b5ac3',
  blue5: '#3a6fe0',
  blue6: '#6a9de3',
  // metal — iron & steel
  metal1: '#252431',
  metal2: '#4a515e',
  metal3: '#646c7b',
  metal4: '#7f8797',
  metal5: '#aab2c0',
  metal6: '#cbcfd6',
} as const

export type PalKey = keyof typeof PAL
