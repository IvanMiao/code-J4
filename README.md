# code-J4

A 2D RPG in the spirit of 仙剑奇侠传 98, set on a present-day Chinese university campus — with a few talking cats and a little magic.
Web first (Phaser 4 + TypeScript + Vite). Chinese first, English later.

> Everything in `content/` right now (林夏, 尼卡, 江城大学, every line) is **placeholder** content
> that exists only to exercise the systems.

## Run

```bash
npm install
npm run dev          # http://localhost:5173
npm run check        # typecheck + tests + lint:story + sim
```

URL parameters while writing:

| param | effect |
| --- | --- |
| `?start=nika_talk` | skip the intro and play that knot (replays automatically when the .ink file is saved) |
| `?set=read_notice:true,has_snack:true` | set ink variables first |
| `?map=library` | start on another map (`gate`, `avenue`, `library`) |
| `?style=hd` | old HD sample art (retro is the default) |
| `?load=1` | load save slot 1 |

Controls: arrows/WASD move, Space/Enter/Z talk and advance, ↑↓ choose, Esc menu (save / load). Walk off a map edge to go to the next map.

## Writing the story

The story is plain [ink](https://github.com/inkle/ink/blob/master/Documentation/WritingWithInk.md) in
`content/story/*.ink` (Inky works as an editor). Saving the file hot-reloads it in the running game. Two conventions sit on top of ink:

```ink
=== nika_talk ===
@emote nika ?                            // a command: the story waits until it finishes
尼卡: 喵——呜。 #annoyed #line:nika_4
//  speaker: text   #emotion (portrait + voice tone)   #vo (gets voice-over)   #line:id (stable id)
* [蹲下来，伸出手]
    ~ nika_trust += 1
- @battle ch1_alley_rats                 // sets battle_result to "win" / "lose"
```

- Speakers and emotions come from `content/cast/cast.yaml`; a line with an unknown speaker is narration.
- Cats (`cat: true`) never get a human voice: every cat line plays the emotion's meow from `meows:`, and the text box shows what the cat means.
- Maps are `content/maps/*.tmj` (Tiled JSON; layers `walkable`, `blocked`, `anchors`, `actors`, `triggers`). The player starts a knot by talking to a map actor or a trigger with a `knot` property; a trigger with `exit: <map>:<anchor>` changes map. `tools/maps/build-campus.py` wrote the current three. `intro` runs on a new game.
- Commands: `@bgm @ambience @sfx @fade @wait @walk @face @emote @shake @show @hide @give @take @battle`. The list, arguments and help text live in `src/story/commands.ts`.

Checks:

```bash
npm run lint:story                      # unknown commands, actors, anchors, items, audio, portraits, duplicate line ids, missing knots
npm run sim                             # plays every knot through every choice and battle outcome, headless
npm run sim -- --print nika_talk --pick 1,0
npm run story:ids                       # adds #line:<knot>_<n> to lines that lack one
```

## Assets (dev-time only — the game never calls an API)

Secrets: `GEMINI_API_KEY`, `ELEVENLABS_API_KEY` in the environment.

**Art** — `assets/manifest/{campus,retro,hd}.yaml` + style bibles in `assets/style/`. Each item has a prompt, model, optional
reference items and post-processing (chroma key, resize, palette quantise, sprite-sheet packing).
Raw generations go to `assets/raw/` (git-ignored), finished files to `public/art/<style>/`, provenance to `assets/provenance.json`.

```bash
npm run gen:art                                   # only new/changed items (cached by prompt+refs hash)
npm run gen:art -- --id retro/portrait_nika_smug --force
npm run gen:art -- --style retro --post-only       # re-run post-processing, no API calls
```

Campus signs are drawn by Gemini from the exact Chinese text in the prompt (`assets/style/bible-campus.md`).
UI font: [Fusion Pixel](https://github.com/TakWolf/fusion-pixel-font) 12px (OFL, `public/fonts/`), used at 12/24px only.
Walk sheets are 3 columns × 4 rows (down, left, right, up); the game mirrors the left row for right.

**Audio** — `content/audio.yaml` (music, ambience, sfx prompts) plus every story line tagged `#vo`, voiced with the
speaker's `voice.id` and the emotion's v3 audio tag from `cast.yaml`. Output in `public/audio/`, cached per request hash
(editing one line regenerates only that line).

```bash
npm run gen:audio -- --dry      # list jobs + voice-over character count
npm run gen:audio
npm run gen:audio -- --only vo --id nika_12 --force
```

## Layout

```
content/   story (.ink), cast, items, encounters, maps (.tmj), audio prompts — what a writer edits
src/story  ink runner, line/command parser, command registry
src/engine pure logic: walking, map parsing, save data, battle stub (unit-tested, no Phaser)
src/game   Phaser scenes and UI
tools/     lint:story, sim, story:ids, gen:art, gen:audio
assets/    art manifests, style bibles, provenance
```
