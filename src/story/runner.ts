import { Story } from 'inkjs';
import { COMMANDS } from './commands.ts';
import { parseStoryLine, type CommandEvent, type LineEvent } from './parse.ts';

export interface StoryHost {
  line(e: LineEvent): Promise<void>;
  /** Resolves with the outcome value for commands that declare `outcomes`, otherwise anything. */
  command(e: CommandEvent): Promise<string | void>;
  choose(options: string[]): Promise<number>;
}

/** Drives an ink story and hands each line, command and choice to a host (Phaser scene or headless sim). */
export class StoryRunner {
  readonly story: Story;
  running = false;
  currentKnot: string | null = null;

  constructor(json: object | string, private speakerOf: (name: string) => string | null) {
    this.story = new Story(typeof json === 'string' ? json : JSON.stringify(json));
  }

  knots(): string[] {
    const named = (this.story as any).mainContentContainer.namedContent as Map<string, unknown>;
    return [...named.keys()].filter((k) => !k.startsWith('global '));
  }

  hasKnot(name: string): boolean {
    return this.knots().includes(name);
  }

  async play(knot: string, host: StoryHost): Promise<void> {
    if (this.running) return;
    this.running = true;
    this.currentKnot = knot;
    try {
      this.story.ChoosePathString(knot);
      await this.drain(host);
    } finally {
      this.running = false;
    }
  }

  private async drain(host: StoryHost): Promise<void> {
    const story = this.story;
    for (;;) {
      while (story.canContinue) {
        const text = story.Continue() ?? '';
        const event = parseStoryLine(text, story.currentTags ?? [], this.speakerOf);
        if (!event) continue;
        if (event.kind === 'line') {
          await host.line(event);
        } else {
          const result = await host.command(event);
          const outcome = COMMANDS[event.name]?.outcomes;
          if (outcome && typeof result === 'string') story.variablesState[outcome.variable] = result;
        }
      }
      if (story.currentChoices.length === 0) return;
      const pick = await host.choose(story.currentChoices.map((c) => c.text));
      story.ChooseChoiceIndex(pick);
    }
  }

  saveState(): string {
    return this.story.state.ToJson();
  }

  loadState(json: string): void {
    this.story.state.LoadJson(json);
  }

  variables(): Record<string, unknown> {
    const out: Record<string, unknown> = {};
    const vs = this.story.variablesState as any;
    for (const name of vs._globalVariables.keys()) out[name] = vs[name];
    return out;
  }

  /** Copies variable values into this story (used for ink hot-reload). Unknown names are skipped. */
  restoreVariables(values: Record<string, unknown>): void {
    const vs = this.story.variablesState as any;
    for (const [k, v] of Object.entries(values)) if (vs._globalVariables.has(k)) vs[k] = v;
  }
}
