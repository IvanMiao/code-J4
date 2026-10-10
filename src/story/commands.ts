/** Every `@command` the story may use. Shared by the game, `lint:story` and the headless sim. */
export interface CommandSpec {
  /** Positional args in order. `actor` = cast id, `anchor` = map anchor, `actorOrAnchor` = either. */
  args: ArgKind[];
  /** Allowed `key=value` options and their kinds. */
  options?: Record<string, ArgKind>;
  /** Outcomes the sim branches on; the game writes the chosen one into the named ink VAR. */
  outcomes?: { variable: string; values: string[] };
  help: string;
}

export type ArgKind = 'actor' | 'anchor' | 'actorOrAnchor' | 'dir' | 'emote' | 'number' | 'audio' | 'item' | 'id' | 'inOut';

export const COMMANDS: Record<string, CommandSpec> = {
  bgm: { args: ['audio'], options: { fade: 'number' }, help: 'Play looping music: @bgm night_street fade=2  (@bgm stop to stop)' },
  ambience: { args: ['audio'], options: { fade: 'number' }, help: 'Play a looping ambience bed: @ambience street_night' },
  sfx: { args: ['audio'], help: 'Play a one-shot sound: @sfx door_chime' },
  fade: { args: ['inOut'], options: { time: 'number' }, help: 'Fade the screen: @fade out time=1 / @fade in' },
  wait: { args: ['number'], help: 'Pause in seconds: @wait 0.5' },
  walk: { args: ['actor'], options: { to: 'anchor', speed: 'number' }, help: 'Walk an actor to a map anchor: @walk linxia to=counter' },
  face: { args: ['actor', 'actorOrAnchor'], help: 'Turn to face someone, an anchor or a direction: @face linxia juzi / @face juzi down' },
  emote: { args: ['actor', 'emote'], help: 'Speech-bubble emote: @emote juzi ?   (! ? … ♪ ♥ 💢)' },
  shake: { args: [], options: { time: 'number', strength: 'number' }, help: 'Shake the camera: @shake time=0.3' },
  show: { args: ['actor'], options: { at: 'anchor', face: 'dir' }, help: 'Place an actor on the map: @show juzi at=bench face=left' },
  hide: { args: ['actor'], help: 'Remove an actor from the map: @hide juzi' },
  give: { args: ['item'], options: { n: 'number' }, help: 'Add an item to the bag: @give oden n=1' },
  take: { args: ['item'], options: { n: 'number' }, help: 'Remove an item from the bag: @take cat_treat' },
  battle: {
    args: ['id'],
    outcomes: { variable: 'battle_result', values: ['win', 'lose'] },
    help: 'Start an encounter and wait for it; sets battle_result to "win" or "lose": @battle ch1_alley_rats',
  },
};

export const DIRS = ['up', 'down', 'left', 'right'] as const;
export type Dir = (typeof DIRS)[number];
export const EMOTES = ['!', '?', '…', '♪', '♥', '💢'] as const;
