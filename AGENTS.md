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

## Conventions added by the fixes

- Walk sheets are built from one 3-frame strip per direction (`assets/strips/`) and stacked by a `compose` item in the manifest. Rows: down, left, right, up. Mirror a side strip at build time, never at runtime.
- Gemini ignores "walking left" and draws side strips facing right most of the time. Name side strips `_side`, prompt for RIGHT, check the raw, and mirror it for the left row.
- Separately generated strips drift in proportions (a realistic side view next to a chibi front view looks much smaller). Pass the finished down strip as a second ref and ask for the same head size and height.
- Gemini copies the layout of a reference design sheet into its output (extra rows of sitting poses). Use `crop` to keep only the band you asked for, or drop the ref and describe the character in text.
- Every story trigger has `face` (the direction the player must face to use it). `lint:story` fails if a trigger has no `face` or no walkable spot in front of it.
- Canopies, roofs and other things actors walk behind go in the `foreground` layer: a polygon hugging the object plus `baseline` (its ground y). Do not use loose rectangles; they hide actors on open ground.

## Ambient and hidden spots
- Scene motion lives in each map's `ambient` object layer (`kind`: grass, flowers, leaves, motes, fountain, birds, butterflies, glint). Grass and flowers sample the background colour under them, so only place them over real lawns and beds.
- Hidden spots are normal triggers with `hidden: true` (no hint bubble). Mark them with a `glint` ambient whose `until` names the ink variable that turns true once found.
- Run `npm run maps:overlay` after changing `walkable`/`blocked` and look at the result: a box that overlaps a bed or hedge silently traps the player.

## Lessons from the Nika (cat) redesign
- Passing a multi-pose design sheet as a ref makes Gemini copy its grid layout (2x3, 2x2) instead of one row of three. Generate the down strip with no ref, then use finished strips (single-row) as refs for the others. Never blind-`crop` a strip: check the raw first.
- Equal box height is not equal size. A cat's front/back view includes the raised tail and foreshortened body, so use per-strip `fitHeight` (sheet post step) and compare head width across rows, not frame height.
- Animated effects on top of painted art: if the background already paints the effect (fountain ripples), cover it first (the fountain ambient flattens the water) or the result reads as static art plus a second layer.

