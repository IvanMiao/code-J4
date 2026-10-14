import { defineConfig, type Plugin } from 'vite';
import { parse } from 'yaml';
import { compileInk } from './tools/lib/ink.ts';

/** `import story from './main.ink'` compiles with inkjs; editing any included .ink hot-reloads the story. */
function ink(): Plugin {
  return {
    name: 'ink',
    enforce: 'pre',
    load(id) {
      if (!id.endsWith('.ink')) return;
      const build = compileInk(id);
      build.files.forEach((f) => this.addWatchFile(f));
      if (build.errors.length) this.error(`ink compile failed:\n${build.errors.join('\n')}`);
      return `export default ${build.json};`;
    },
  };
}

function yaml(): Plugin {
  return {
    name: 'yaml',
    transform(src, id) {
      if (id.endsWith('.yaml') || id.endsWith('.yml')) return { code: `export default ${JSON.stringify(parse(src))};`, map: null };
    },
  };
}

export default defineConfig({
  plugins: [ink(), yaml()],
  server: { host: true, port: 5173 },
  test: { include: ['tests/**/*.test.ts'] },
} as any);
