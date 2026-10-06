# WorldMap

A procedurally generated, explorable pixel-art world: glyph-style biomes, roads, enterable caves and buildings, and a zoomed-out world map. It's rendered with lighting and CRT-style post effects. Right now it's for worldbuilding and exploring the biomes. There's no gameplay or UI text yet.

Open `index.html` in a browser. There's no build step, and it works straight from `file://` or any static server (`npx http-server .`).

## Controls

| Key | Action |
| --- | --- |
| WASD / arrows | Move (grid-based) |
| Shift | Run |
| M / Tab | Toggle the world map |
| Escape | Co-op and character menu |
| Left click | Attack with the equipped weapon toward the cursor (one shot per click) |
| F | Attack the nearest enemy, or in the direction you're facing |
| Right mouse / Space (hold) | Charge the special ability (the beam) and release to fire |
| Q | Swap between weapons you've collected |
| E | Cycle special abilities (only the beam so far) |
| Map: WASD / drag | Pan |
| Map: Q / E, mouse wheel | Zoom out / in |
| Map: Space | Re-centre on the player |

On phones and tablets, an on-screen d-pad (slide your thumb between directions), a RUN toggle and a MAP button appear, with zoom buttons while the map is open. The ⚙ menu moves to the top-left. Both portrait and landscape work.

Walk into a cave mouth, door, stairway or ladder to go in or out.

Append `?seed=1234` to the URL to generate a different world (the default seed is 1337).

## What's in the world

- **Biomes:** plains, hatched grasslands, pine forest, blue taiga, autumn forest, lakes and rivers, orange dunes, grey mountains, snowfields, volcanic lava fields, a glowing crystal forest, a dark spooky forest, a giant-mushroom grove, a red marsh, pink heart fields, and ocean with outlying islands.
- **Points of interest:** about 190 of them: castles, villages, campsites, lighthouses, shipwrecks, mines, caves and ice caves, crypts, ruins, witch huts, hollow trees, a giant world tree, volcano fire shrines, marsh temples, towers, heart shrines, giant skeletons, standing-stone circles and oases. They're all connected by an A* road network with bridges over water and causeways out to islands.
- **Interiors:** cellular-automata caves and mines (with rails to the treasure), room-and-corridor dungeons and crypts, and hand-shaped houses, throne rooms, lighthouses, ship holds, witch huts, fire temples, tree hollows, temples and wizard towers. Caves, mines, dungeons and crypts each go three levels deeper through a glowing stairway, getting darker as you go.
- **Dream interiors:** every indoor space is re-dressed in one of 16 surreal themes, in the spirit of Yume Nikki. Each theme brings its own patterned floor, re-skinned walls, framed pixel paintings after public-domain works (Mona Lisa, The Starry Night, The Great Wave, Red Fuji, The Scream, Mondrian, Klimt's The Kiss), centrepieces (Moai, a torii gate, a pyramid, a maneki-neko, a sugar skull, a Greek bust, a giant blinking eye, a melting clock), props (Tokyo vending machines, a London phone box, Paris street lamps, chess pieces, marigolds, floating hats and apples), dream-dwellers, particles and a screen effect (warping, hue drift, sepia). The theme is fixed per entrance, so co-op players share the same dream. Exits stay shut for the first 2 seconds in a space.
- **Powers:** glowing orbs sit near shrines, stone circles, the world tree, volcano shrines and other landmarks, and in about half of the interiors. Walking into one absorbs it (particles arc into you) and changes your power: spark, ember, frost, void, bloom or prism. Holding the button charges a beam, drawn with arced particles spiralling in, then releasing fires it. Beams stop at walls, scatter sparks, shake the screen and knock creatures back. Co-op friends see each other's charge and beams. The `POWERS` table in `js/powers.js` is the place to add future power-up effects.
- **Combat:** spiders, bats, ghosts, slimes, eyeballs, shadows, TV-heads, chess knights and dragons are enemies. They have HP (more on deeper levels), chase you, show a health bar when hurt and drop XP gems that home in on you. XP raises your level and damage. Walking into a friendly animal makes it show a heart and become a pet that follows you from place to place and shoots heart projectiles at enemies, using your weapon's element.
- **Weapons:** 22 items in `ITEMS` in `js/combat.js`: slings (lobbed, arcing pellets), swords and a Moai hammer (melee sweeps), bows, guns and blunderbusses, homing wands, and boomerang watches. Each has an element (ember burns, frost slows, void pierces, bloom splits into seeds, prism bounces between enemies). They sit on pedestals at ruins, stone circles, towers and other landmarks and in some dream rooms, and in every chest (bump a chest to open it). Each place favours items that suit it.
- **Sound:** all synthesised in the browser. A generative ambient score (pads, drone and bell melodies) changes with day and night, the biome you're in and each dream theme. Sound effects cover footsteps, doors, the map, absorbing, charging, beams and impacts. Toggle it in the ⚙ menu.
- **Life:** creatures that wander their home biome, plus fireflies, wisps, spores, embers, snow and water twinkles.
- **Lighting and post effects:** a day/night cycle, per-biome ambience, flickering point lights with Bayer-dithered falloff, an emissive glow layer, two-scale bloom, chromatic fringing, scanlines, vignette, slight curvature, grain and dithered transitions.

## Code layout

| File | Purpose |
| --- | --- |
| `js/util.js` | RNG, hashing, value noise, heap |
| `js/glyphs.js` | Every bitmap (tiles, structures, creatures, player) and its palette |
| `js/tilemap.js` | Shared map structure, chunk baking, per-chunk light/anim/emit indices |
| `js/overworld.js` | Continent, biomes, rivers, decoration, POIs and roads |
| `js/interiors.js` | Interior generators |
| `js/entities.js` | Player, creatures and particles |
| `js/post.js` | WebGL post-processing |
| `js/mapview.js` | World map view and fog of war |
| `js/main.js` | Loop, input, rendering, transitions |
| `js/audio.js` | Generative music and synthesised sound effects |
| `js/powers.js` | Orbs, absorb, charge and beam |
| `js/dreams.js` | Dream themes for interiors |
| `js/coop.js` | Co-op over MQTT, character picker, menu |
| `js/touch.js` | Touch controls |
