# AGENTS.md

Notes for agents working on code-J4. See README.md for commands and the story format.

Run `npm run check` and `npm run build` before pushing. Story names, lines and plot are placeholders; the owner writes the script.

## Known failure classes

AI art and hand-written map data drift apart easily. Most bugs so far come from one of these three classes.

### 1. Sprite sheet cells don't mean what the prompt asked for

- Symptom: walking right flickers between a side pose and a front pose.
- Cause: Gemini drew the middle column of the left/right rows as a front-facing "standing" pose.
  - The walk animation plays columns `[0, 1, 2, 1]` (`Boot.ts`), and idle uses column 1, so every other frame faces the camera.
  - Mirroring the left row for right (`DIR_ROW.right = 1`) copies the same bad cell.
  - The up row has the same problem: it is mostly front-facing.
- Rules:
  - Never trust a generated sheet's grid semantics. Inspect every cell (facing and pose) before wiring it into animations.
  - Prefer one walk cycle per direction where every cell is checked. If a row is bad, regenerate that row or build it from verified cells. Don't reuse a cell just because its index looks right.
  - Idle frames must come from the same facing as the walk frames.

### 2. Map data is authored blind to the painted art

- Symptom: the kiosk (校园超市) can be used from behind.
- Cause: the trigger rect was placed on the walkable road above the shop, which is its back/roof side. The storefront faces down, outside the walkable area.
  - `FieldScene.target()` only tests "probe point inside rect". It doesn't know which side is the front.
- Rules:
  - Place interaction triggers on the approach side of the thing they belong to: doors, counters, windows, sign faces. If the front is not walkable, extend the walkable area to reach it, or move the object.
  - Interactions should require the player to face the object from its front. Store the expected facing on the trigger (e.g. a `face` property) rather than accepting any direction.
  - When fitting `walkable`/`blocked` polygons, mark every painted object that sits on the walkable area. AI backgrounds put trees, benches and props on roads.

### 3. Exits are not readable from the picture

- Symptom: the path to the library looks blocked. A large tree is painted over the road at the right edge of 梧桐苑, so the player thinks there is no way through.
- Cause: the background prompt didn't reserve an exit corridor. The exit rect and walkable polygon were added afterwards over whatever was painted there. There is no foreground/occlusion layer, so the player also walks "under" painted canopies.
- Rules:
  - Decide the exits before generating a background, and put them in the prompt (e.g. "the road continues off the right edge, unobstructed, nothing covering the last 15% of the road").
  - Every exit needs a visible cue: an open road or doorway, a gap in hedges, or a Chinese signpost (e.g. "图书馆 →"). If the art fails, regenerate or edit it. Don't paper over it with a trigger.
  - Large props that overlap walkable ground need a cut-out foreground layer drawn above actors, or they must not be on walkable ground.

## Verification checklist for map or art changes

- Walk every exit in both directions and screenshot both sides of the transition.
- Use every trigger from its intended side, and try it from the wrong sides too: it must not fire.
- Hold each direction for at least a second, for every actor sheet, and watch for pose flicker.
- Look at the full background at 1x with the walkable/blocked polygons overlaid before tuning numbers. A debug overlay is worth adding.
