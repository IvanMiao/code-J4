import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { Compiler, CompilerOptions } from 'inkjs/full';

export interface InkBuild {
  json: string;
  errors: string[];
  warnings: string[];
  /** Absolute paths of every file pulled in through INCLUDE, entry first. */
  files: string[];
}

/** Compiles an ink entry file (following INCLUDEs relative to it). */
export function compileInk(entry: string): InkBuild {
  const errors: string[] = [];
  const warnings: string[] = [];
  const root = dirname(resolve(entry)) + '/';
  const files = [resolve(entry)];
  const handler = {
    ResolveInkFilename: (name: string) => resolve(root, name),
    LoadInkFileContents: (path: string) => {
      files.push(path);
      return readFileSync(path, 'utf8');
    },
  };
  const options = new CompilerOptions(
    resolve(entry),
    [],
    true,
    (message: string, type: number) => (type === 2 ? errors : warnings).push(message),
    handler as any,
  );
  let json = '';
  try {
    const story = new Compiler(readFileSync(entry, 'utf8'), options).Compile();
    json = story?.ToJson() ?? '';
  } catch (e) {
    if (!errors.length) errors.push((e as Error).message);
  }
  return { json, errors, warnings, files };
}
