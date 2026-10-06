# WorldMap

A procedurally generated, explorable pixel-art world: glyph-style biomes, roads, enterable caves and buildings, and a zoomed-out world map. It's rendered with lighting and CRT-style post effects. Right now it's for worldbuilding and exploring the biomes. There's no gameplay or UI text yet.

Open `index.html` in a browser. There's no build step, and it works straight from `file://` or any static server (`npx http-server .`).

## Controls

| Key | Action |
| --- | --- |
| WASD / arrows | Move (grid-based) |
| Shift | Run |
| M / Tab | Toggle the world map |
| Map: WASD / drag | Pan |
| Map: Q / E, mouse wheel | Zoom out / in |
| Map: Space | Re-centre on the player |

Walk into a cave mouth, door, stairway or ladder to go in or out.

Append `?seed=1234` to the URL to generate a different world (the default seed is 1337).

## What's in the world

- **Biomes:** plains, hatched grasslands, pine forest, blue taiga, lakes and rivers, orange dunes, grey mountains, snowfields, a dark spooky forest, a giant-mushroom grove, a red marsh, pink heart fields, and ocean.
- **Points of interest:** villages, campsites, caves and ice caves, crypts, ruins, hollow trees, marsh temples, towers, heart shrines, standing-stone circles and oases. They're all connected by an A* road network with bridges over water.
- **Interiors:** cellular-automata caves with crystals and pools, room-and-corridor dungeons and crypts, and hand-shaped houses, tree hollows, temples and wizard towers.
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
