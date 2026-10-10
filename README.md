# code-J4

A 2D RPG in the spirit of 仙剑奇侠传 98, set in a present-day city — with a few talking cats and a little magic.
Web first (Phaser 4 + TypeScript + Vite). Chinese first, English later.

> Everything in `content/` right now (林夏, 橘子, the convenience-store scene, every line) is **placeholder** content
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
| `?start=juzi_talk` | skip the intro and play that knot (replays automatically when the .ink file is saved) |
| `?set=has_bought:true,juzi_trust:2` | set ink variables first |
| `?style=retro` / `?style=hd` | art direction (also in the Esc menu) |
| `?load=1` | load save slot 1 |

Controls: arrows/WASD move, Space/Enter/Z talk and advance, ↑↓ choose, Esc menu (save / load / switch style).

## Writing the story

The story is plain [ink](https://github.com/inkle/ink/blob/master/Documentation/WritingWithInk.md) in
`content/story/*.ink` (Inky works as an editor). Saving the file hot-reloads it in the running game. Two conventions sit on top of ink:

```ink
=== juzi_talk ===
@face linxia juzi                        // a command: the story waits until it finishes
橘子: ……谁是小胖子？ #annoyed #vo #line:juzi_3
//  speaker: text   #emotion (portrait + voice tone)   #vo (gets voice-over)   #line:id (stable id)
* [蹲下来，伸出手]
    ~ juzi_trust += 1
- @battle ch1_alley_rats                 // sets battle_result to "win" / "lose"
{ battle_result == "lose": 橘子: 下次跑快点。 #annoyed }
```

- Speakers and emotions come from `content/cast/cast.yaml`; a line with an unknown speaker is narration.
- The player starts a knot by talking to a map actor or stepping into a trigger (`knot` property in `content/maps/*.tmj`, editable in Tiled). `intro` runs on a new game.
- Commands: `@bgm @ambience @sfx @fade @wait @walk @face @emote @shake @show @hide @give @take @battle`. The list, arguments and help text live in `src/story/commands.ts`.

Checks:

```bash
npm run lint:story                      # unknown commands, actors, anchors, items, audio, portraits, duplicate line ids, missing knots
npm run sim                             # plays every knot through every choice and battle outcome, headless
npm run sim -- --print juzi_talk --pick 1,0
npm run story:ids                       # adds #line:<knot>_<n> to lines that lack one
```

## Assets (dev-time only — the game never calls an API)

Secrets: `GEMINI_API_KEY`, `ELEVENLABS_API_KEY` in the environment.

**Art** — `assets/manifest/{retro,hd}.yaml` + style bibles in `assets/style/`. Each item has a prompt, model, optional
reference items and post-processing (chroma key, resize, palette quantise, sprite-sheet packing).
Raw generations go to `assets/raw/` (git-ignored), finished files to `public/art/<style>/`, provenance to `assets/provenance.json`.

```bash
npm run gen:art                                   # only new/changed items (cached by prompt+refs hash)
npm run gen:art -- --id hd/portrait_juzi_smug --force
npm run gen:art -- --style retro --post-only       # re-run post-processing, no API calls
```

The retro background is repainted from the HD one so both share one collision map.
Walk sheets are 3 columns × 4 rows (down, left, right, up); the game mirrors the left row for right.

**Audio** — `content/audio.yaml` (music, ambience, sfx prompts) plus every story line tagged `#vo`, voiced with the
speaker's `voice.id` and the emotion's v3 audio tag from `cast.yaml`. Output in `public/audio/`, cached per request hash
(editing one line regenerates only that line).

```bash
npm run gen:audio -- --dry      # list jobs + voice-over character count
npm run gen:audio
npm run gen:audio -- --only vo --id juzi_5 --force
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
