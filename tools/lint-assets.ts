import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { APPROVALS_PATH, reviewAssets, seedApprovals, serializeApprovals } from './lib/approvals.ts';

const root = '.';
if (process.argv.includes('--seed')) {
  writeFileSync(join(root, APPROVALS_PATH), serializeApprovals(seedApprovals(root)));
  console.log(`wrote ${APPROVALS_PATH}`);
  process.exit(0);
}

const errors: string[] = [];
for (const asset of reviewAssets(root)) {
  const status = asset.decision?.status;
  if (!asset.decision || asset.stale || status !== 'approved') {
    const reason = !asset.decision ? 'missing' : asset.stale ? 'stale' : status;
    errors.push(`asset ${asset.key} not approved (${reason}) — run npm run review`);
  }
}
for (const error of errors) console.log(`ERROR ${error}`);
console.log(`lint:assets — ${errors.length} error(s)`);
process.exit(errors.length ? 1 : 0);
