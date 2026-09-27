import fs from 'node:fs';
import path from 'node:path';
import { STACK } from './env';

// The outbox is appended to by the backend's preload; start each run empty so
// assertions only see this run's mail and egress attempts. (The backend has
// already written its 'guard-installed' line by now, so keep that one.)
export default async function globalSetup() {
  fs.mkdirSync(path.dirname(STACK.outbox), { recursive: true });
  const lines = fs.existsSync(STACK.outbox) ? fs.readFileSync(STACK.outbox, 'utf8').split('\n') : [];
  const keep = lines.filter((l) => l.includes('"guard-installed"'));
  fs.writeFileSync(STACK.outbox, keep.length ? keep.slice(-1).join('\n') + '\n' : '');
}
