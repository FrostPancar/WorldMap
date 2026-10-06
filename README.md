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
| Map: WASD / drag | Pan |
| Map: Q / E, mouse wheel | Zoom out / in |
| Map: Space | Re-centre on the player |

Walk into a cave mouth, door, stairway or ladder to go in or out.

Append `?seed=1234` to the URL to generate a different world (the default seed is 1337).

## What's in the world

- **Biomes:** plains, hatched grasslands, pine forest, blue taiga, autumn forest, lakes and rivers, orange dunes, grey mountains, snowfields, volcanic lava fields, a glowing crystal forest, a dark spooky forest, a giant-mushroom grove, a red marsh, pink heart fields, and ocean with outlying islands.
- **Points of interest:** about 190 of them: castles, villages, campsites, lighthouses, shipwrecks, mines, caves and ice caves, crypts, ruins, witch huts, hollow trees, a giant world tree, volcano fire shrines, marsh temples, towers, heart shrines, giant skeletons, standing-stone circles and oases. They're all connected by an A* road network with bridges over water and causeways out to islands.
- **Interiors:** cellular-automata caves and mines (with rails to the treasure), room-and-corridor dungeons and crypts, and hand-shaped houses, throne rooms, lighthouses, ship holds, witch huts, fire temples, tree hollows, temples and wizard towers. Caves, mines, dungeons and crypts each go three levels deeper through a glowing stairway, getting darker as you go.
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
