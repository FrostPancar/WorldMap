# WorldMap

A procedurally generated, explorable pixel-art world: glyph-style biomes, roads, enterable caves and buildings, and a zoomed-out world map. It's rendered with lighting and CRT-style post effects. Right now it's for worldbuilding and exploring the biomes. There's no gameplay or UI text yet.

Open `index.html` in a browser. There's no build step, and it works straight from `file://` or any static server (`npx http-server .`).

## Controls

| Key | Action |
| --- | --- |
| WASD / arrows | Move (grid-based) |
| Shift | Run |
| M / Tab | Toggle the world map |
| Escape | Menu: the crystal box on top, plus three pages flipped with Q / E: character, collectibles (opens here) and settings (sound, restart or new world, co-op room) |
| Left click | Attack with the equipped weapon toward the cursor (one shot per click) |
| F | Attack the nearest enemy, or in the direction you're facing |
| Right mouse / Space (hold) | Channel the selected special and release to cast it |
| Q | Swap between weapons you've collected |
| E | Cycle the specials you know |
| Map: WASD / drag | Pan |
| Map: Q / E, mouse wheel | Zoom out / in |
| Map: Space | Re-centre on the player |

On phones and tablets, an on-screen d-pad (slide your thumb between directions), a RUN toggle and a MAP button appear, with zoom buttons while the map is open. A ✧ button cycles specials, and a ⚙ button in the top-left opens the menu (there's no Escape key on touch screens). Both portrait and landscape work.

Walk into a cave mouth, door, stairway or ladder to go in or out. Each time you arrive somewhere, a ring closes in on your character so you can spot yourself straight away.

Append `?seed=1234` to the URL to generate a different world (the default seed is 1337).

## What's in the world

- **Biomes:** plains, hatched grasslands, pine forest, blue taiga, autumn forest, lakes and rivers, orange dunes, grey mountains, snowfields, volcanic lava fields, a glowing crystal forest, a dark spooky forest, a giant-mushroom grove, a red marsh, pink heart fields, and ocean with outlying islands.
- **Points of interest:** about 190 of them: castles, villages, campsites, lighthouses, shipwrecks, mines, caves and ice caves, crypts, ruins, witch huts, hollow trees, a giant world tree, volcano fire shrines, marsh temples, towers, heart shrines, giant skeletons, standing-stone circles and oases, plus 7 boss arenas. Blue spirits drift over the crypt graveyards. They're all connected by an A* road network with bridges over water and causeways out to islands.
- **Interiors:** cellular-automata caves and mines (with rails to the treasure), room-and-corridor dungeons and crypts, and hand-shaped houses, throne rooms, lighthouses, ship holds, witch huts, fire temples, tree hollows, temples and wizard towers. Caves, mines, dungeons and crypts each go three levels deeper through a glowing stairway, getting darker as you go. Climbing back up any ladder or stairway takes you straight out to the overworld at the dungeon's entrance, however deep you are. Underground water glints so it reads in the dark. The deepest level has golden stairs into a **trophy room**: a gilded hall with four chests, two weapon pedestals, keys and a power orb. Both its plain ladder and its golden ladder lead straight back to the surface. About one in ten cave and dungeon levels also has a rare **cave exit**, a shaft of daylight. Leaving through it brings you up on a road in a different biome, far from where you went in.
- **Dream interiors:** every indoor space is re-dressed in one of 16 surreal themes, in the spirit of Yume Nikki. Homes (houses, hollow trees, witch huts and lighthouses) never have enemies inside. Each theme brings its own patterned floor, re-skinned walls, framed pixel paintings after public-domain works (Mona Lisa, The Starry Night, The Great Wave, Red Fuji, The Scream, Mondrian, Klimt's The Kiss), centrepieces (Moai, a torii gate, a pyramid, a maneki-neko, a sugar skull, a Greek bust, a giant blinking eye, a melting clock), props (Tokyo vending machines, a London phone box, Paris street lamps, chess pieces, marigolds, floating hats and apples), dream-dwellers, particles and a screen effect (warping, hue drift, sepia). The theme is fixed per entrance, so co-op players share the same dream. Exits stay shut for the first 2 seconds in a space.
- **Powers:** glowing orbs sit near shrines, stone circles, the world tree, volcano shrines and other landmarks, and in about half of the interiors. Walking into one absorbs it (particles arc into you) and changes your power: spark, ember, frost, void, bloom or prism. Holding the button charges a beam, drawn with arced particles spiralling in, then releasing fires it. Beams stop at walls, scatter sparks, shake the screen and knock creatures back. Co-op friends see each other's charge and beams. The `POWERS` table in `js/powers.js` is the place to add future power-up effects.
- **Boss arenas:** seven colosseum gates stand far apart across the continent. Each takes **two keys** to open and leads to a large open arena with one boss: the Stone Colossus, Cinder Wyrm, Frost Matriarch, Brood Queen, Gridlock Titan, The Watcher and the Hollow King. Bosses cycle through moves (bolt rings, spirals, aimed fans, lobbed volleys, dashes, telegraphed ground slams, summoned minions, blinking next to you) and get faster below half health. A health bar with the boss's name sits at the bottom of the screen. Beating one is remembered, fully heals you and drops two keys and a weapon. Stats and moves are in `BOSSES` in `js/bosses.js`.
- **World bosses and crystals:** five giants live in lairs out in the open world, each a 4x4-tile version of an enemy you already know, with the same colours and glowing red eyes: the **Mother Spider** (spooky or pine forest), **King Slime** (mushroom grove or marsh), **Ghost Lord** (snow, crystal forest or taiga), **Elder Dragon** (volcano or mountains) and **Garbage Titan** (plains). A lair is a themed building in a clearing ringed with stones or trees and lights, with a glowing sigil over its door. Inside are **two dreamlike floors** of that biome, followed by the boss's hall:
  - **Mother Spider:** web-choked hollows, then a violet dream of floating eyes.
  - **King Slime:** a glowing spore grove, then a shimmering mushroom dream.
  - **Ghost Lord:** a frozen crystal reverie, then a pale ice garden of graves.
  - **Elder Dragon:** basalt halls with lava and vents, then a burning dream.
  - **Garbage Titan:** a rain-soaked gridlock street, then a neon mall of traffic cones.

  Each floor has its own floor pattern, walls, props, particles and screen effect, and is full of that biome's enemies. Stairs lead down to the hall. Lairs and arenas are marked in red on the world map from the start (white once beaten), so you can head straight for them. They move slowly, but their attacks are hard to dodge, though always possible:
  - bolt rings with a drifting gap to slip through
  - walls of bolts sweeping toward you with one opening
  - slow twin spirals
  - ground marks that fill in and then erupt
  - root lines racing toward you
  - aimed volleys that lead your movement
  - lobbed barrages
  - leaps onto the spot you're standing on
  - summoned minions

  Below half health they enrage and attack more often. They only fight near their lair. If you run off, they walk home and heal. Each one drops a **crystal**, a pure trophy with no stat effect. Collected crystals glow in their own colour in the crystal box at the top of the Escape menu (7 slots), which stays in place while you flip pages. Stats and patterns are in `WORLD_BOSSES` in `js/worldbosses.js`.
- **Specials:** you start with the beam and learn the other five from traders. All of them are channelled: hold to charge, then release. While you charge, the landing spot is previewed. Specials other than the beam and drain need at least a third of a charge, or they fizzle.
  - **Beam:** a charged beam that ricochets off walls, bouncing once, or up to three times on a full charge. Each bounce does a little less damage.
  - **Drain:** works the whole time you hold it. It slowly pulls life from every enemy within 5 tiles (a red ring shows the reach) and heals you, at most about one heart a second however many enemies are near. Releasing does nothing.
  - **Fireworks:** releases a fan of rockets in a slight cone toward the cursor. Each rocket curls and weaves at random, then bursts in a colourful blast that damages everything nearby, at the end of its range or when it hits a wall or an enemy. A longer charge sends more rockets further.
  - **Wings:** you dash to the cursor, then fly for two seconds on beating wings over anything (walls, water, lava), steering with the arrow keys. Nothing can hurt you in the air. You only land on open ground: if your time runs out over something you can't stand on, you glide to the nearest spot you can. Enemies you touch on the way (not bosses) are carried up with you and slammed into the ground when you land, which also knocks back anything nearby.
  - **Shadow step:** you vanish and reappear inside the creature nearest the cursor (any enemy except a boss, or an animal) and possess it. While you wear its body, ordinary enemies ignore you (bosses see through it). Your attacks come from its body: shooters fire their own kind of shot, and everything else lunges and bites. Press the special again, run out of time or take a hit to burst out. Bursting out of an enemy tears it apart for heavy damage. With no creature in reach it's a plain blink.
  - **Starfall:** a shower of falling stars crashes down on the marked spot. A longer charge brings more stars over a wider area.
- **Special traders:** at most one house per village (about three villages in four) has a hooded trader with a lantern and a sword sign, and so do about half of the hollow trees, witch huts and lighthouses. Walk into them with at least 5 weapons and they take 5 at random in exchange for a special you don't know yet. With fewer, they show how many you have, like "3/5" next to a sword. Each trader deals only once, and their sign disappears afterwards.
- **Combat:** spiders, bats, ghosts, slimes, eyeballs, shadows, TV-heads, chess knights and dragons are enemies, and every enemy has glowing red eyes. They have HP (more on deeper levels), chase you, show a health bar when hurt and drop XP gems that home in on you. XP raises your level and damage. Walking into a friendly animal makes it show a heart and become a pet that follows you from place to place. Pets are companions and stay out of fights.
- **Urban enemies:** commuters who rush at you with briefcases, phone zombies, joggers, paparazzi whose camera flashes fly at you, e-scooter riders and runaway shopping carts that charge in straight lines, pigeon flocks, living traffic cones, robot vacuums, delivery drones that lob parcels, fire hydrants that spray, CCTV cameras that fire lasers, and trash bags that split in two. They gather around villages, roads and tourist landmarks outdoors, and in fitting dream rooms indoors (Night City, the vaporwave mall, the Louvre and so on). Stats are in `ENEMY_DEF` in `js/urban.js`.
- **Health:** you have hearts, shown when they change. You start with 4 hearts and gain half a heart per level. Contact and enemy shots hurt you, and every hit does 1.5 times its listed damage, with a moment of invulnerability after each one. Health slowly regenerates (half a heart every 6 seconds) after 9 calm seconds. Enemies occasionally (7%) drop a healing heart. At zero you're knocked out and wake up in the starting village with everything you'd collected.
- **Co-op combat:** on each map, one player (the lowest id there) runs the enemies and broadcasts their positions, HP, deaths and shots. The others send their hits to that player and check enemy shots against themselves. Kills give XP to everyone on the map. You see each other's attacks, beams, pets and health bars.
- **Weapons:** 22 items in `ITEMS` in `js/combat.js`: slings (lobbed, arcing pellets), swords and a Moai hammer (melee sweeps), bows, guns and blunderbusses, homing wands, and boomerang watches. Each has an element (ember burns, frost slows, void pierces, bloom splits into seeds, prism bounces between enemies). They sit on pedestals at ruins, stone circles, towers and other landmarks and in some dream rooms, and in every chest (bump a chest to open it). Each place favours items that suit it.
- **Keys and locked doors:** about a third of buildings, caves and dungeon stairways are locked (a padlock floats on the door), and arena gates always are. Keys lie around camps, villages, ruins and oases, inside caves and dungeons, and sometimes in chests. Walking into a locked door uses a key; unlocked doors and your key count are remembered.
- **On-screen info:** almost no text. Nothing stays on screen. Your hearts appear when you take damage or heal. Pick-ups, weapon and special switches, level-ups, keys and locks pop up as an icon, with at most a number beside it (your level, how many keys you have, "1/2" keys at an arena gate, "3/5" weapons at a trader). The boss health bar is just a bar. In the Escape menu, only the settings page has words besides button labels. Everything else is icons framed in their colour (a weapon's element, a special's glow, a crystal's hue).
- **Pets and hit reactions:** you keep one pet at a time; other animals just show a heart when you walk into them. Everything reacts to being hit: enemies flash and jolt, friendly animals flinch, hop aside and show a startled "!", and you flash and shake when hurt.
- **Sound:** all synthesised in the browser. A generative ambient score (pads, drone and bell melodies) changes with day and night, the biome you're in and each dream theme. Sound effects cover footsteps, doors, the map, absorbing, charging, beams and impacts. Toggle it in the Escape menu.
- **Life:** creatures that wander their home biome, plus fireflies, wisps, spores, embers, snow and water twinkles.
- **Lighting and post effects:** indoor walls have a pale rim where they meet the floor, and dark rooms get a floor of ambient light so you can always read the layout. In pale rooms, lamps, glow, bloom and haze all back off according to how bright the floor is, so light colours don't blow out to white. Also a day/night cycle, per-biome ambience, flickering point lights with Bayer-dithered falloff, an emissive glow layer, two-scale bloom, chromatic fringing, scanlines, vignette, slight curvature, grain and dithered transitions.

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
| `js/powers.js` | Orbs, absorb, channelling, the beam and the specials (vortex, shadow step, starfall) |
| `js/bosses.js` | Arena boss sprites, moves and arena interiors |
| `js/worldbosses.js` | World bosses (procedurally painted 32x32 sprites), their attack patterns and crystals |
| `js/dreams.js` | Dream themes for interiors |
| `js/coop.js` | Co-op over MQTT, and the pixel-styled Escape menu (character, collectibles, settings and co-op) |
| `js/touch.js` | Touch controls |
