import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { APPROVALS_PATH, seedApprovals, serializeApprovals } from './lib/approvals.ts';

writeFileSync(join('.', APPROVALS_PATH), serializeApprovals(seedApprovals()));
console.log(`wrote ${APPROVALS_PATH}`);
