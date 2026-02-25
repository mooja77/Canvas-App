import { Hono } from 'hono';
import { cors } from 'hono/cors';
import * as jose from 'jose';
import bcrypt from 'bcryptjs';
import {
  searchTranscripts,
  computeCooccurrence,
  buildFrameworkMatrix,
  computeStats,
  computeComparison,
  computeWordFrequency,
  computeClusters,
  computeCodingQuery,
  computeSentiment,
  computeTreemap,
} from './textAnalysis';

// ─── Types ───

interface Env {
  DB: D1Database;
  JWT_SECRET: string;
  ALLOWED_ORIGINS: string;
}

type AppContext = { Bindings: Env; Variables: { dashboardAccessId: string } };

const app = new Hono<AppContext>();

// ─── Helpers ───

function uid(): string {
  return crypto.randomUUID().replace(/-/g, '');
}

async function sha256(text: string): Promise<string> {
  const data = new TextEncoder().encode(text);
  const hash = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(hash)).map(b => b.toString(16).padStart(2, '0')).join('');
}

async function signJwt(payload: Record<string, unknown>, secret: string): Promise<string> {
  const key = new TextEncoder().encode(secret);
  return new jose.SignJWT(payload)
    .setProtectedHeader({ alg: 'HS256' })
    .setExpirationTime('24h')
    .sign(key);
}

async function verifyJwt(token: string, secret: string): Promise<Record<string, unknown> | null> {
  try {
    const key = new TextEncoder().encode(secret);
    const { payload } = await jose.jwtVerify(token, key);
    return payload as Record<string, unknown>;
  } catch {
    return null;
  }
}

function nanoid(len = 8): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  const arr = new Uint8Array(len);
  crypto.getRandomValues(arr);
  return Array.from(arr, b => chars[b % chars.length]).join('');
}

// ─── CORS ───

app.use('/api/*', async (c, next) => {
  const origins = c.env.ALLOWED_ORIGINS.split(',').map(s => s.trim());
  return cors({
    origin: (origin) => origins.includes(origin) ? origin : origins[0],
    allowHeaders: ['Content-Type', 'X-Dashboard-Code'],
    allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    credentials: true,
  })(c, next);
});

// ─── Auth Middleware ───

async function authMiddleware(c: any, next: () => Promise<void>) {
  const header = c.req.header('X-Dashboard-Code') || '';
  if (!header) return c.json({ success: false, error: 'Authentication required' }, 401);

  // Try JWT first
  const payload = await verifyJwt(header, c.env.JWT_SECRET);
  if (payload?.accountId) {
    const access = await c.env.DB.prepare('SELECT * FROM DashboardAccess WHERE id = ?').bind(payload.accountId).first();
    if (access && new Date(access.expiresAt as string) > new Date()) {
      c.set('dashboardAccessId', access.id as string);
      return next();
    }
  }

  // Fallback: access code
  const hash = await sha256(header);
  const access = await c.env.DB.prepare('SELECT * FROM DashboardAccess WHERE accessCode = ?').bind(hash).first();
  if (!access) return c.json({ success: false, error: 'Invalid dashboard code' }, 401);
  if (!access.accessCodeHash) return c.json({ success: false, error: 'Account requires migration' }, 401);
  const valid = bcrypt.compareSync(header, access.accessCodeHash as string);
  if (!valid) return c.json({ success: false, error: 'Invalid dashboard code' }, 401);
  if (new Date(access.expiresAt as string) < new Date()) return c.json({ success: false, error: 'Code expired' }, 401);

  c.set('dashboardAccessId', access.id as string);
  return next();
}

// ─── Auth Routes ───

app.post('/api/auth', async (c) => {
  const { dashboardCode } = await c.req.json();
  if (!dashboardCode) return c.json({ success: false, error: 'Dashboard code is required' }, 400);

  const hash = await sha256(dashboardCode);
  const access = await c.env.DB.prepare('SELECT * FROM DashboardAccess WHERE accessCode = ?').bind(hash).first();
  if (!access) return c.json({ success: false, error: 'Invalid dashboard code' }, 401);
  if (!access.accessCodeHash) return c.json({ success: false, error: 'Account requires migration' }, 401);

  const valid = bcrypt.compareSync(dashboardCode, access.accessCodeHash as string);
  if (!valid) return c.json({ success: false, error: 'Invalid dashboard code' }, 401);
  if (new Date(access.expiresAt as string) < new Date()) return c.json({ success: false, error: 'Code expired' }, 401);

  const jwt = await signJwt({ accountId: access.id, role: access.role }, c.env.JWT_SECRET);
  return c.json({ success: true, data: { jwt, name: access.name, role: access.role, dashboardAccessId: access.id } });
});

app.post('/api/auth/register', async (c) => {
  const { name, role } = await c.req.json();
  if (!name) return c.json({ success: false, error: 'Name is required' }, 400);

  const code = `CANVAS-${nanoid(8)}`;
  const shaIndex = await sha256(code);
  const bcryptHash = bcrypt.hashSync(code, 12);
  const id = uid();
  const expiresAt = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString();

  await c.env.DB.prepare(
    'INSERT INTO DashboardAccess (id, accessCode, accessCodeHash, name, role, expiresAt) VALUES (?, ?, ?, ?, ?, ?)'
  ).bind(id, shaIndex, bcryptHash, name, role || 'researcher', expiresAt).run();

  const jwt = await signJwt({ accountId: id, role: role || 'researcher' }, c.env.JWT_SECRET);
  return c.json({ success: true, data: { accessCode: code, jwt, name, role: role || 'researcher', dashboardAccessId: id } }, 201);
});

// ─── Protected Routes ───

app.use('/api/canvas/*', authMiddleware);
app.use('/api/canvas', authMiddleware);

// Helper: verify canvas ownership
async function getOwnedCanvas(db: D1Database, canvasId: string, dashboardAccessId: string) {
  const canvas = await db.prepare('SELECT * FROM CodingCanvas WHERE id = ?').bind(canvasId).first();
  if (!canvas) return null;
  if (canvas.dashboardAccessId !== dashboardAccessId) return undefined; // 403
  return canvas;
}

// ─── Canvas CRUD ───

app.get('/api/canvas', async (c) => {
  const dashId = c.get('dashboardAccessId');
  const canvases = await c.env.DB.prepare(
    `SELECT c.*,
      (SELECT COUNT(*) FROM CanvasTranscript WHERE canvasId = c.id) as transcriptCount,
      (SELECT COUNT(*) FROM CanvasQuestion WHERE canvasId = c.id) as questionCount,
      (SELECT COUNT(*) FROM CanvasTextCoding WHERE canvasId = c.id) as codingCount
    FROM CodingCanvas c WHERE c.dashboardAccessId = ? ORDER BY c.updatedAt DESC`
  ).bind(dashId).all();

  const data = canvases.results.map((c: any) => ({
    ...c,
    _count: { transcripts: c.transcriptCount, questions: c.questionCount, codings: c.codingCount },
  }));
  return c.json({ success: true, data });
});

app.post('/api/canvas', async (c) => {
  const dashId = c.get('dashboardAccessId');
  const { name, description } = await c.req.json();
  if (!name) return c.json({ success: false, error: 'Name is required' }, 400);

  const id = uid();
  const now = new Date().toISOString();
  try {
    await c.env.DB.prepare(
      'INSERT INTO CodingCanvas (id, dashboardAccessId, name, description, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?)'
    ).bind(id, dashId, name, description || null, now, now).run();
    const canvas = await c.env.DB.prepare('SELECT * FROM CodingCanvas WHERE id = ?').bind(id).first();
    return c.json({ success: true, data: canvas }, 201);
  } catch (e: any) {
    if (e.message?.includes('UNIQUE')) return c.json({ success: false, error: 'A canvas with this name already exists' }, 409);
    throw e;
  }
});

app.get('/api/canvas/:canvasId', async (c) => {
  const dashId = c.get('dashboardAccessId');
  const canvasId = c.req.param('canvasId');
  const canvas = await c.env.DB.prepare('SELECT * FROM CodingCanvas WHERE id = ?').bind(canvasId).first();
  if (!canvas) return c.json({ success: false, error: 'Canvas not found' }, 404);
  if (canvas.dashboardAccessId !== dashId) return c.json({ success: false, error: 'Access denied' }, 403);

  const [transcripts, questions, memos, codings, nodePositions, cases, relations, computedNodes] = await Promise.all([
    c.env.DB.prepare('SELECT * FROM CanvasTranscript WHERE canvasId = ? ORDER BY sortOrder ASC').bind(canvasId).all(),
    c.env.DB.prepare('SELECT * FROM CanvasQuestion WHERE canvasId = ? ORDER BY sortOrder ASC').bind(canvasId).all(),
    c.env.DB.prepare('SELECT * FROM CanvasMemo WHERE canvasId = ? ORDER BY createdAt ASC').bind(canvasId).all(),
    c.env.DB.prepare('SELECT * FROM CanvasTextCoding WHERE canvasId = ?').bind(canvasId).all(),
    c.env.DB.prepare('SELECT * FROM CanvasNodePosition WHERE canvasId = ?').bind(canvasId).all(),
    c.env.DB.prepare('SELECT * FROM CanvasCase WHERE canvasId = ? ORDER BY createdAt ASC').bind(canvasId).all(),
    c.env.DB.prepare('SELECT * FROM CanvasRelation WHERE canvasId = ? ORDER BY createdAt ASC').bind(canvasId).all(),
    c.env.DB.prepare('SELECT * FROM CanvasComputedNode WHERE canvasId = ? ORDER BY createdAt ASC').bind(canvasId).all(),
  ]);

  return c.json({
    success: true,
    data: {
      ...canvas,
      transcripts: transcripts.results,
      questions: questions.results,
      memos: memos.results,
      codings: codings.results,
      nodePositions: nodePositions.results.map((p: any) => ({ ...p, collapsed: !!p.collapsed })),
      cases: cases.results.map((cs: any) => ({ ...cs, attributes: JSON.parse(cs.attributes) })),
      relations: relations.results,
      computedNodes: computedNodes.results.map((n: any) => ({ ...n, config: JSON.parse(n.config), result: JSON.parse(n.result) })),
    },
  });
});

app.put('/api/canvas/:canvasId', async (c) => {
  const dashId = c.get('dashboardAccessId');
  const canvasId = c.req.param('canvasId');
  const owned = await getOwnedCanvas(c.env.DB, canvasId, dashId);
  if (owned === null) return c.json({ success: false, error: 'Canvas not found' }, 404);
  if (owned === undefined) return c.json({ success: false, error: 'Access denied' }, 403);

  const body = await c.req.json();
  const sets: string[] = ['updatedAt = ?'];
  const vals: any[] = [new Date().toISOString()];
  if (body.name !== undefined) { sets.push('name = ?'); vals.push(body.name); }
  if (body.description !== undefined) { sets.push('description = ?'); vals.push(body.description); }
  vals.push(canvasId);

  try {
    await c.env.DB.prepare(`UPDATE CodingCanvas SET ${sets.join(', ')} WHERE id = ?`).bind(...vals).run();
    const canvas = await c.env.DB.prepare('SELECT * FROM CodingCanvas WHERE id = ?').bind(canvasId).first();
    return c.json({ success: true, data: canvas });
  } catch (e: any) {
    if (e.message?.includes('UNIQUE')) return c.json({ success: false, error: 'A canvas with this name already exists' }, 409);
    throw e;
  }
});

app.delete('/api/canvas/:canvasId', async (c) => {
  const dashId = c.get('dashboardAccessId');
  const canvasId = c.req.param('canvasId');
  const owned = await getOwnedCanvas(c.env.DB, canvasId, dashId);
  if (owned === null) return c.json({ success: false, error: 'Canvas not found' }, 404);
  if (owned === undefined) return c.json({ success: false, error: 'Access denied' }, 403);

  // Delete cascade manually for D1
  const tables = ['CanvasTextCoding', 'CanvasTranscript', 'CanvasQuestion', 'CanvasMemo', 'CanvasNodePosition', 'CanvasCase', 'CanvasRelation', 'CanvasComputedNode', 'CanvasShare'];
  for (const t of tables) {
    await c.env.DB.prepare(`DELETE FROM ${t} WHERE canvasId = ?`).bind(canvasId).run();
  }
  await c.env.DB.prepare('DELETE FROM CodingCanvas WHERE id = ?').bind(canvasId).run();
  return c.json({ success: true });
});

// ─── Transcripts ───

app.post('/api/canvas/:id/transcripts', async (c) => {
  const dashId = c.get('dashboardAccessId');
  const canvasId = c.req.param('id');
  const owned = await getOwnedCanvas(c.env.DB, canvasId, dashId);
  if (!owned) return c.json({ success: false, error: 'Canvas not found or denied' }, 404);

  const body = await c.req.json();
  const count = await c.env.DB.prepare('SELECT COUNT(*) as cnt FROM CanvasTranscript WHERE canvasId = ?').bind(canvasId).first();
  const id = uid();
  const now = new Date().toISOString();
  await c.env.DB.prepare(
    'INSERT INTO CanvasTranscript (id, canvasId, title, content, sortOrder, caseId, sourceType, sourceId, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
  ).bind(id, canvasId, body.title, body.content, (count as any)?.cnt || 0, body.caseId || null, body.sourceType || null, body.sourceId || null, now, now).run();

  await c.env.DB.prepare('UPDATE CodingCanvas SET updatedAt = ? WHERE id = ?').bind(now, canvasId).run();
  const transcript = await c.env.DB.prepare('SELECT * FROM CanvasTranscript WHERE id = ?').bind(id).first();
  return c.json({ success: true, data: transcript }, 201);
});

app.put('/api/canvas/:id/transcripts/:tid', async (c) => {
  const dashId = c.get('dashboardAccessId');
  const canvasId = c.req.param('id');
  const owned = await getOwnedCanvas(c.env.DB, canvasId, dashId);
  if (!owned) return c.json({ success: false, error: 'Canvas not found or denied' }, 404);

  const body = await c.req.json();
  const tid = c.req.param('tid');
  const sets: string[] = ['updatedAt = ?'];
  const vals: any[] = [new Date().toISOString()];
  if (body.title !== undefined) { sets.push('title = ?'); vals.push(body.title); }
  if (body.content !== undefined) { sets.push('content = ?'); vals.push(body.content); }
  vals.push(tid);

  await c.env.DB.prepare(`UPDATE CanvasTranscript SET ${sets.join(', ')} WHERE id = ?`).bind(...vals).run();
  await c.env.DB.prepare('UPDATE CodingCanvas SET updatedAt = ? WHERE id = ?').bind(new Date().toISOString(), canvasId).run();
  const transcript = await c.env.DB.prepare('SELECT * FROM CanvasTranscript WHERE id = ?').bind(tid).first();
  return c.json({ success: true, data: transcript });
});

app.delete('/api/canvas/:id/transcripts/:tid', async (c) => {
  const dashId = c.get('dashboardAccessId');
  const canvasId = c.req.param('id');
  const owned = await getOwnedCanvas(c.env.DB, canvasId, dashId);
  if (!owned) return c.json({ success: false, error: 'Canvas not found or denied' }, 404);

  const tid = c.req.param('tid');
  await c.env.DB.prepare('DELETE FROM CanvasTextCoding WHERE transcriptId = ?').bind(tid).run();
  await c.env.DB.prepare('DELETE FROM CanvasTranscript WHERE id = ?').bind(tid).run();
  await c.env.DB.prepare('UPDATE CodingCanvas SET updatedAt = ? WHERE id = ?').bind(new Date().toISOString(), canvasId).run();
  return c.json({ success: true });
});

// ─── Questions ───

app.post('/api/canvas/:id/questions', async (c) => {
  const dashId = c.get('dashboardAccessId');
  const canvasId = c.req.param('id');
  const owned = await getOwnedCanvas(c.env.DB, canvasId, dashId);
  if (!owned) return c.json({ success: false, error: 'Canvas not found or denied' }, 404);

  const body = await c.req.json();
  const count = await c.env.DB.prepare('SELECT COUNT(*) as cnt FROM CanvasQuestion WHERE canvasId = ?').bind(canvasId).first();
  const id = uid();
  const now = new Date().toISOString();
  await c.env.DB.prepare(
    'INSERT INTO CanvasQuestion (id, canvasId, text, color, sortOrder, parentQuestionId, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
  ).bind(id, canvasId, body.text, body.color || '#3B82F6', (count as any)?.cnt || 0, body.parentQuestionId || null, now, now).run();

  await c.env.DB.prepare('UPDATE CodingCanvas SET updatedAt = ? WHERE id = ?').bind(now, canvasId).run();
  const question = await c.env.DB.prepare('SELECT * FROM CanvasQuestion WHERE id = ?').bind(id).first();
  return c.json({ success: true, data: question }, 201);
});

app.put('/api/canvas/:id/questions/:qid', async (c) => {
  const dashId = c.get('dashboardAccessId');
  const canvasId = c.req.param('id');
  const owned = await getOwnedCanvas(c.env.DB, canvasId, dashId);
  if (!owned) return c.json({ success: false, error: 'Canvas not found or denied' }, 404);

  const body = await c.req.json();
  const qid = c.req.param('qid');
  const sets: string[] = ['updatedAt = ?'];
  const vals: any[] = [new Date().toISOString()];
  if (body.text !== undefined) { sets.push('text = ?'); vals.push(body.text); }
  if (body.color !== undefined) { sets.push('color = ?'); vals.push(body.color); }
  if (body.parentQuestionId !== undefined) { sets.push('parentQuestionId = ?'); vals.push(body.parentQuestionId); }
  vals.push(qid);

  await c.env.DB.prepare(`UPDATE CanvasQuestion SET ${sets.join(', ')} WHERE id = ?`).bind(...vals).run();
  await c.env.DB.prepare('UPDATE CodingCanvas SET updatedAt = ? WHERE id = ?').bind(new Date().toISOString(), canvasId).run();
  const question = await c.env.DB.prepare('SELECT * FROM CanvasQuestion WHERE id = ?').bind(qid).first();
  return c.json({ success: true, data: question });
});

app.delete('/api/canvas/:id/questions/:qid', async (c) => {
  const dashId = c.get('dashboardAccessId');
  const canvasId = c.req.param('id');
  const owned = await getOwnedCanvas(c.env.DB, canvasId, dashId);
  if (!owned) return c.json({ success: false, error: 'Canvas not found or denied' }, 404);

  const qid = c.req.param('qid');
  await c.env.DB.prepare('DELETE FROM CanvasTextCoding WHERE questionId = ?').bind(qid).run();
  await c.env.DB.prepare('DELETE FROM CanvasQuestion WHERE id = ?').bind(qid).run();
  await c.env.DB.prepare('UPDATE CodingCanvas SET updatedAt = ? WHERE id = ?').bind(new Date().toISOString(), canvasId).run();
  return c.json({ success: true });
});

// ─── Memos ───

app.post('/api/canvas/:id/memos', async (c) => {
  const dashId = c.get('dashboardAccessId');
  const canvasId = c.req.param('id');
  const owned = await getOwnedCanvas(c.env.DB, canvasId, dashId);
  if (!owned) return c.json({ success: false, error: 'Canvas not found or denied' }, 404);

  const body = await c.req.json();
  const id = uid();
  const now = new Date().toISOString();
  await c.env.DB.prepare(
    'INSERT INTO CanvasMemo (id, canvasId, title, content, color, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?, ?)'
  ).bind(id, canvasId, body.title || null, body.content || '', body.color || '#FEF08A', now, now).run();

  await c.env.DB.prepare('UPDATE CodingCanvas SET updatedAt = ? WHERE id = ?').bind(now, canvasId).run();
  const memo = await c.env.DB.prepare('SELECT * FROM CanvasMemo WHERE id = ?').bind(id).first();
  return c.json({ success: true, data: memo }, 201);
});

app.put('/api/canvas/:id/memos/:mid', async (c) => {
  const dashId = c.get('dashboardAccessId');
  const canvasId = c.req.param('id');
  const owned = await getOwnedCanvas(c.env.DB, canvasId, dashId);
  if (!owned) return c.json({ success: false, error: 'Canvas not found or denied' }, 404);

  const body = await c.req.json();
  const mid = c.req.param('mid');
  const sets: string[] = ['updatedAt = ?'];
  const vals: any[] = [new Date().toISOString()];
  if (body.title !== undefined) { sets.push('title = ?'); vals.push(body.title); }
  if (body.content !== undefined) { sets.push('content = ?'); vals.push(body.content); }
  if (body.color !== undefined) { sets.push('color = ?'); vals.push(body.color); }
  vals.push(mid);

  await c.env.DB.prepare(`UPDATE CanvasMemo SET ${sets.join(', ')} WHERE id = ?`).bind(...vals).run();
  await c.env.DB.prepare('UPDATE CodingCanvas SET updatedAt = ? WHERE id = ?').bind(new Date().toISOString(), canvasId).run();
  const memo = await c.env.DB.prepare('SELECT * FROM CanvasMemo WHERE id = ?').bind(mid).first();
  return c.json({ success: true, data: memo });
});

app.delete('/api/canvas/:id/memos/:mid', async (c) => {
  const dashId = c.get('dashboardAccessId');
  const canvasId = c.req.param('id');
  const owned = await getOwnedCanvas(c.env.DB, canvasId, dashId);
  if (!owned) return c.json({ success: false, error: 'Canvas not found or denied' }, 404);

  await c.env.DB.prepare('DELETE FROM CanvasMemo WHERE id = ?').bind(c.req.param('mid')).run();
  await c.env.DB.prepare('UPDATE CodingCanvas SET updatedAt = ? WHERE id = ?').bind(new Date().toISOString(), canvasId).run();
  return c.json({ success: true });
});

// ─── Codings ───

app.post('/api/canvas/:id/codings', async (c) => {
  const dashId = c.get('dashboardAccessId');
  const canvasId = c.req.param('id');
  const owned = await getOwnedCanvas(c.env.DB, canvasId, dashId);
  if (!owned) return c.json({ success: false, error: 'Canvas not found or denied' }, 404);

  const { transcriptId, questionId, startOffset, endOffset, codedText, note } = await c.req.json();

  const transcript = await c.env.DB.prepare('SELECT * FROM CanvasTranscript WHERE id = ? AND canvasId = ?').bind(transcriptId, canvasId).first();
  if (!transcript) return c.json({ success: false, error: 'Transcript not found in this canvas' }, 400);
  const question = await c.env.DB.prepare('SELECT * FROM CanvasQuestion WHERE id = ? AND canvasId = ?').bind(questionId, canvasId).first();
  if (!question) return c.json({ success: false, error: 'Question not found in this canvas' }, 400);

  const id = uid();
  const now = new Date().toISOString();
  await c.env.DB.prepare(
    'INSERT INTO CanvasTextCoding (id, canvasId, transcriptId, questionId, startOffset, endOffset, codedText, note, createdAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)'
  ).bind(id, canvasId, transcriptId, questionId, startOffset, endOffset, codedText, note || null, now).run();

  await c.env.DB.prepare('UPDATE CodingCanvas SET updatedAt = ? WHERE id = ?').bind(now, canvasId).run();
  const coding = await c.env.DB.prepare('SELECT * FROM CanvasTextCoding WHERE id = ?').bind(id).first();
  return c.json({ success: true, data: coding }, 201);
});

app.put('/api/canvas/:id/codings/:cid', async (c) => {
  const dashId = c.get('dashboardAccessId');
  const canvasId = c.req.param('id');
  const owned = await getOwnedCanvas(c.env.DB, canvasId, dashId);
  if (!owned) return c.json({ success: false, error: 'Canvas not found or denied' }, 404);

  const body = await c.req.json();
  const cid = c.req.param('cid');
  const sets: string[] = [];
  const vals: any[] = [];
  if (body.note !== undefined) { sets.push('note = ?'); vals.push(body.note); }
  if (body.annotation !== undefined) { sets.push('annotation = ?'); vals.push(body.annotation); }
  if (sets.length === 0) return c.json({ success: true, data: await c.env.DB.prepare('SELECT * FROM CanvasTextCoding WHERE id = ?').bind(cid).first() });
  vals.push(cid);

  await c.env.DB.prepare(`UPDATE CanvasTextCoding SET ${sets.join(', ')} WHERE id = ?`).bind(...vals).run();
  await c.env.DB.prepare('UPDATE CodingCanvas SET updatedAt = ? WHERE id = ?').bind(new Date().toISOString(), canvasId).run();
  const coding = await c.env.DB.prepare('SELECT * FROM CanvasTextCoding WHERE id = ?').bind(cid).first();
  return c.json({ success: true, data: coding });
});

app.delete('/api/canvas/:id/codings/:cid', async (c) => {
  const dashId = c.get('dashboardAccessId');
  const canvasId = c.req.param('id');
  const owned = await getOwnedCanvas(c.env.DB, canvasId, dashId);
  if (!owned) return c.json({ success: false, error: 'Canvas not found or denied' }, 404);

  await c.env.DB.prepare('DELETE FROM CanvasTextCoding WHERE id = ?').bind(c.req.param('cid')).run();
  await c.env.DB.prepare('UPDATE CodingCanvas SET updatedAt = ? WHERE id = ?').bind(new Date().toISOString(), canvasId).run();
  return c.json({ success: true });
});

app.put('/api/canvas/:id/codings/:cid/reassign', async (c) => {
  const dashId = c.get('dashboardAccessId');
  const canvasId = c.req.param('id');
  const owned = await getOwnedCanvas(c.env.DB, canvasId, dashId);
  if (!owned) return c.json({ success: false, error: 'Canvas not found or denied' }, 404);

  const { newQuestionId } = await c.req.json();
  const question = await c.env.DB.prepare('SELECT * FROM CanvasQuestion WHERE id = ? AND canvasId = ?').bind(newQuestionId, canvasId).first();
  if (!question) return c.json({ success: false, error: 'Target question not found' }, 400);

  const cid = c.req.param('cid');
  await c.env.DB.prepare('UPDATE CanvasTextCoding SET questionId = ? WHERE id = ?').bind(newQuestionId, cid).run();
  await c.env.DB.prepare('UPDATE CodingCanvas SET updatedAt = ? WHERE id = ?').bind(new Date().toISOString(), canvasId).run();
  const coding = await c.env.DB.prepare('SELECT * FROM CanvasTextCoding WHERE id = ?').bind(cid).first();
  return c.json({ success: true, data: coding });
});

// ─── Layout ───

app.put('/api/canvas/:id/layout', async (c) => {
  const dashId = c.get('dashboardAccessId');
  const canvasId = c.req.param('id');
  const owned = await getOwnedCanvas(c.env.DB, canvasId, dashId);
  if (!owned) return c.json({ success: false, error: 'Canvas not found or denied' }, 404);

  const { positions } = await c.req.json();
  for (const pos of positions) {
    const existing = await c.env.DB.prepare('SELECT id FROM CanvasNodePosition WHERE canvasId = ? AND nodeId = ?').bind(canvasId, pos.nodeId).first();
    if (existing) {
      await c.env.DB.prepare(
        'UPDATE CanvasNodePosition SET x = ?, y = ?, width = ?, height = ?, collapsed = ?, nodeType = ? WHERE id = ?'
      ).bind(pos.x, pos.y, pos.width ?? null, pos.height ?? null, pos.collapsed ? 1 : 0, pos.nodeType, existing.id).run();
    } else {
      await c.env.DB.prepare(
        'INSERT INTO CanvasNodePosition (id, canvasId, nodeId, nodeType, x, y, width, height, collapsed) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)'
      ).bind(uid(), canvasId, pos.nodeId, pos.nodeType, pos.x, pos.y, pos.width ?? null, pos.height ?? null, pos.collapsed ? 1 : 0).run();
    }
  }
  await c.env.DB.prepare('UPDATE CodingCanvas SET updatedAt = ? WHERE id = ?').bind(new Date().toISOString(), canvasId).run();
  return c.json({ success: true });
});

// ─── Cases ───

app.post('/api/canvas/:id/cases', async (c) => {
  const dashId = c.get('dashboardAccessId');
  const canvasId = c.req.param('id');
  const owned = await getOwnedCanvas(c.env.DB, canvasId, dashId);
  if (!owned) return c.json({ success: false, error: 'Canvas not found or denied' }, 404);

  const { name, attributes } = await c.req.json();
  const id = uid();
  const now = new Date().toISOString();
  try {
    await c.env.DB.prepare(
      'INSERT INTO CanvasCase (id, canvasId, name, attributes, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?)'
    ).bind(id, canvasId, name, JSON.stringify(attributes || {}), now, now).run();
    const cs = await c.env.DB.prepare('SELECT * FROM CanvasCase WHERE id = ?').bind(id).first();
    return c.json({ success: true, data: { ...cs, attributes: JSON.parse((cs as any).attributes) } }, 201);
  } catch (e: any) {
    if (e.message?.includes('UNIQUE')) return c.json({ success: false, error: 'Case name already exists' }, 409);
    throw e;
  }
});

app.put('/api/canvas/:id/cases/:caseId', async (c) => {
  const dashId = c.get('dashboardAccessId');
  const canvasId = c.req.param('id');
  const owned = await getOwnedCanvas(c.env.DB, canvasId, dashId);
  if (!owned) return c.json({ success: false, error: 'Canvas not found or denied' }, 404);

  const body = await c.req.json();
  const caseId = c.req.param('caseId');
  const sets: string[] = ['updatedAt = ?'];
  const vals: any[] = [new Date().toISOString()];
  if (body.name !== undefined) { sets.push('name = ?'); vals.push(body.name); }
  if (body.attributes !== undefined) { sets.push('attributes = ?'); vals.push(JSON.stringify(body.attributes)); }
  vals.push(caseId);

  await c.env.DB.prepare(`UPDATE CanvasCase SET ${sets.join(', ')} WHERE id = ?`).bind(...vals).run();
  const cs = await c.env.DB.prepare('SELECT * FROM CanvasCase WHERE id = ?').bind(caseId).first();
  return c.json({ success: true, data: { ...cs, attributes: JSON.parse((cs as any).attributes) } });
});

app.delete('/api/canvas/:id/cases/:caseId', async (c) => {
  const dashId = c.get('dashboardAccessId');
  const canvasId = c.req.param('id');
  const owned = await getOwnedCanvas(c.env.DB, canvasId, dashId);
  if (!owned) return c.json({ success: false, error: 'Canvas not found or denied' }, 404);

  await c.env.DB.prepare('DELETE FROM CanvasCase WHERE id = ?').bind(c.req.param('caseId')).run();
  return c.json({ success: true });
});

// ─── Questions Merge ───

app.post('/api/canvas/:id/questions/merge', async (c) => {
  const dashId = c.get('dashboardAccessId');
  const canvasId = c.req.param('id');
  const owned = await getOwnedCanvas(c.env.DB, canvasId, dashId);
  if (!owned) return c.json({ success: false, error: 'Canvas not found or denied' }, 404);

  const { sourceId, targetId } = await c.req.json();
  await c.env.DB.prepare('UPDATE CanvasTextCoding SET questionId = ? WHERE questionId = ? AND canvasId = ?').bind(targetId, sourceId, canvasId).run();
  await c.env.DB.prepare('UPDATE CanvasQuestion SET parentQuestionId = ? WHERE parentQuestionId = ? AND canvasId = ?').bind(targetId, sourceId, canvasId).run();
  await c.env.DB.prepare('DELETE FROM CanvasQuestion WHERE id = ?').bind(sourceId).run();
  const countResult = await c.env.DB.prepare('SELECT COUNT(*) as cnt FROM CanvasTextCoding WHERE questionId = ? AND canvasId = ?').bind(targetId, canvasId).first();
  return c.json({ success: true, data: { targetId, codingCount: (countResult as any)?.cnt || 0 } });
});

// ─── Relations ───

app.post('/api/canvas/:id/relations', async (c) => {
  const dashId = c.get('dashboardAccessId');
  const canvasId = c.req.param('id');
  const owned = await getOwnedCanvas(c.env.DB, canvasId, dashId);
  if (!owned) return c.json({ success: false, error: 'Canvas not found or denied' }, 404);

  const body = await c.req.json();
  const id = uid();
  await c.env.DB.prepare(
    'INSERT INTO CanvasRelation (id, canvasId, fromType, fromId, toType, toId, label, createdAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
  ).bind(id, canvasId, body.fromType, body.fromId, body.toType, body.toId, body.label || '', new Date().toISOString()).run();
  const relation = await c.env.DB.prepare('SELECT * FROM CanvasRelation WHERE id = ?').bind(id).first();
  return c.json({ success: true, data: relation }, 201);
});

app.put('/api/canvas/:id/relations/:relId', async (c) => {
  const dashId = c.get('dashboardAccessId');
  const canvasId = c.req.param('id');
  const owned = await getOwnedCanvas(c.env.DB, canvasId, dashId);
  if (!owned) return c.json({ success: false, error: 'Canvas not found or denied' }, 404);

  const { label } = await c.req.json();
  const relId = c.req.param('relId');
  await c.env.DB.prepare('UPDATE CanvasRelation SET label = ? WHERE id = ?').bind(label, relId).run();
  const relation = await c.env.DB.prepare('SELECT * FROM CanvasRelation WHERE id = ?').bind(relId).first();
  return c.json({ success: true, data: relation });
});

app.delete('/api/canvas/:id/relations/:relId', async (c) => {
  const dashId = c.get('dashboardAccessId');
  const canvasId = c.req.param('id');
  const owned = await getOwnedCanvas(c.env.DB, canvasId, dashId);
  if (!owned) return c.json({ success: false, error: 'Canvas not found or denied' }, 404);

  await c.env.DB.prepare('DELETE FROM CanvasRelation WHERE id = ?').bind(c.req.param('relId')).run();
  return c.json({ success: true });
});

// ─── Computed Nodes ───

app.post('/api/canvas/:id/computed', async (c) => {
  const dashId = c.get('dashboardAccessId');
  const canvasId = c.req.param('id');
  const owned = await getOwnedCanvas(c.env.DB, canvasId, dashId);
  if (!owned) return c.json({ success: false, error: 'Canvas not found or denied' }, 404);

  const { nodeType, label, config } = await c.req.json();
  const id = uid();
  const now = new Date().toISOString();
  await c.env.DB.prepare(
    'INSERT INTO CanvasComputedNode (id, canvasId, nodeType, label, config, result, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
  ).bind(id, canvasId, nodeType, label, JSON.stringify(config || {}), '{}', now, now).run();

  const node = await c.env.DB.prepare('SELECT * FROM CanvasComputedNode WHERE id = ?').bind(id).first();
  return c.json({ success: true, data: { ...node, config: JSON.parse((node as any).config), result: {} } }, 201);
});

app.put('/api/canvas/:id/computed/:nodeId', async (c) => {
  const dashId = c.get('dashboardAccessId');
  const canvasId = c.req.param('id');
  const owned = await getOwnedCanvas(c.env.DB, canvasId, dashId);
  if (!owned) return c.json({ success: false, error: 'Canvas not found or denied' }, 404);

  const body = await c.req.json();
  const nodeId = c.req.param('nodeId');
  const sets: string[] = ['updatedAt = ?'];
  const vals: any[] = [new Date().toISOString()];
  if (body.label !== undefined) { sets.push('label = ?'); vals.push(body.label); }
  if (body.config !== undefined) { sets.push('config = ?'); vals.push(JSON.stringify(body.config)); }
  vals.push(nodeId);

  await c.env.DB.prepare(`UPDATE CanvasComputedNode SET ${sets.join(', ')} WHERE id = ?`).bind(...vals).run();
  const node = await c.env.DB.prepare('SELECT * FROM CanvasComputedNode WHERE id = ?').bind(nodeId).first();
  return c.json({ success: true, data: { ...node, config: JSON.parse((node as any).config), result: JSON.parse((node as any).result) } });
});

app.delete('/api/canvas/:id/computed/:nodeId', async (c) => {
  const dashId = c.get('dashboardAccessId');
  const canvasId = c.req.param('id');
  const owned = await getOwnedCanvas(c.env.DB, canvasId, dashId);
  if (!owned) return c.json({ success: false, error: 'Canvas not found or denied' }, 404);

  await c.env.DB.prepare('DELETE FROM CanvasComputedNode WHERE id = ?').bind(c.req.param('nodeId')).run();
  return c.json({ success: true });
});

// POST /canvas/:id/computed/:nodeId/run
app.post('/api/canvas/:id/computed/:nodeId/run', async (c) => {
  const dashId = c.get('dashboardAccessId');
  const canvasId = c.req.param('id');
  const owned = await getOwnedCanvas(c.env.DB, canvasId, dashId);
  if (!owned) return c.json({ success: false, error: 'Canvas not found or denied' }, 404);

  const nodeId = c.req.param('nodeId');
  const node = await c.env.DB.prepare('SELECT * FROM CanvasComputedNode WHERE id = ? AND canvasId = ?').bind(nodeId, canvasId).first();
  if (!node) return c.json({ success: false, error: 'Computed node not found' }, 404);

  const config = JSON.parse(node.config as string);

  const [transcriptsR, questionsR, codingsR, casesR] = await Promise.all([
    c.env.DB.prepare('SELECT * FROM CanvasTranscript WHERE canvasId = ?').bind(canvasId).all(),
    c.env.DB.prepare('SELECT * FROM CanvasQuestion WHERE canvasId = ?').bind(canvasId).all(),
    c.env.DB.prepare('SELECT * FROM CanvasTextCoding WHERE canvasId = ?').bind(canvasId).all(),
    c.env.DB.prepare('SELECT * FROM CanvasCase WHERE canvasId = ?').bind(canvasId).all(),
  ]);

  const transcripts = transcriptsR.results as any[];
  const questions = questionsR.results as any[];
  const codings = codingsR.results as any[];
  const cases = casesR.results.map((cs: any) => ({ ...cs, attributes: JSON.parse(cs.attributes) }));

  let result: any = {};
  switch (node.nodeType) {
    case 'search': result = searchTranscripts(transcripts, config.pattern || '', config.mode || 'keyword', config.transcriptIds); break;
    case 'cooccurrence': result = computeCooccurrence(codings, config.questionIds || [], config.minOverlap); break;
    case 'matrix': result = buildFrameworkMatrix(transcripts, questions, codings, cases, config.questionIds, config.caseIds); break;
    case 'stats': result = computeStats(codings, questions, transcripts, config.groupBy || 'question', config.questionIds); break;
    case 'comparison': result = computeComparison(codings, transcripts, questions, config.transcriptIds || [], config.questionIds); break;
    case 'wordcloud': result = computeWordFrequency(codings, config.questionId, config.maxWords, config.stopWords); break;
    case 'cluster': result = computeClusters(codings, config.k || 3, config.questionIds); break;
    case 'codingquery': result = computeCodingQuery(codings, transcripts, config.conditions || []); break;
    case 'sentiment': result = computeSentiment(codings, transcripts, questions, config.scope || 'all', config.scopeId); break;
    case 'treemap': result = computeTreemap(codings, questions, config.metric || 'count', config.questionIds); break;
    default: return c.json({ success: false, error: `Unknown node type: ${node.nodeType}` }, 400);
  }

  await c.env.DB.prepare('UPDATE CanvasComputedNode SET result = ?, updatedAt = ? WHERE id = ?')
    .bind(JSON.stringify(result), new Date().toISOString(), nodeId).run();

  return c.json({ success: true, data: { ...node, config, result } });
});

// ─── Auto-Code ───

app.post('/api/canvas/:id/auto-code', async (c) => {
  const dashId = c.get('dashboardAccessId');
  const canvasId = c.req.param('id');
  const owned = await getOwnedCanvas(c.env.DB, canvasId, dashId);
  if (!owned) return c.json({ success: false, error: 'Canvas not found or denied' }, 404);

  const { questionId, pattern, mode, transcriptIds } = await c.req.json();
  const question = await c.env.DB.prepare('SELECT * FROM CanvasQuestion WHERE id = ? AND canvasId = ?').bind(questionId, canvasId).first();
  if (!question) return c.json({ success: false, error: 'Question not found' }, 400);

  let query = 'SELECT * FROM CanvasTranscript WHERE canvasId = ?';
  const transcripts = (await c.env.DB.prepare(query).bind(canvasId).all()).results as any[];
  const filtered = transcriptIds?.length ? transcripts.filter((t: any) => transcriptIds.includes(t.id)) : transcripts;

  const searchResult = searchTranscripts(filtered, pattern, mode);
  if (searchResult.matches.length === 0) return c.json({ success: true, data: { created: 0, matches: [] } });

  const now = new Date().toISOString();
  const created: any[] = [];
  for (const m of searchResult.matches) {
    const id = uid();
    await c.env.DB.prepare(
      'INSERT INTO CanvasTextCoding (id, canvasId, transcriptId, questionId, startOffset, endOffset, codedText, createdAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
    ).bind(id, canvasId, m.transcriptId, questionId, m.offset, m.offset + m.matchText.length, m.matchText, now).run();
    created.push({ id, canvasId, transcriptId: m.transcriptId, questionId, startOffset: m.offset, endOffset: m.offset + m.matchText.length, codedText: m.matchText, createdAt: now });
  }

  await c.env.DB.prepare('UPDATE CodingCanvas SET updatedAt = ? WHERE id = ?').bind(now, canvasId).run();
  return c.json({ success: true, data: { created: created.length, codings: created } }, 201);
});

// ─── Import Narratives ───

app.post('/api/canvas/:id/import-narratives', async (c) => {
  const dashId = c.get('dashboardAccessId');
  const canvasId = c.req.param('id');
  const owned = await getOwnedCanvas(c.env.DB, canvasId, dashId);
  if (!owned) return c.json({ success: false, error: 'Canvas not found or denied' }, 404);

  const { narratives } = await c.req.json();
  const countResult = await c.env.DB.prepare('SELECT COUNT(*) as cnt FROM CanvasTranscript WHERE canvasId = ?').bind(canvasId).first();
  const baseOrder = (countResult as any)?.cnt || 0;
  const now = new Date().toISOString();
  const results: any[] = [];

  for (let i = 0; i < narratives.length; i++) {
    const n = narratives[i];
    const id = uid();
    await c.env.DB.prepare(
      'INSERT INTO CanvasTranscript (id, canvasId, title, content, sortOrder, sourceType, sourceId, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)'
    ).bind(id, canvasId, n.title, n.content, baseOrder + i, n.sourceType || 'import', n.sourceId || null, now, now).run();
    results.push({ id, canvasId, title: n.title, content: n.content, sortOrder: baseOrder + i, createdAt: now, updatedAt: now });
  }

  await c.env.DB.prepare('UPDATE CodingCanvas SET updatedAt = ? WHERE id = ?').bind(now, canvasId).run();
  return c.json({ success: true, data: results }, 201);
});

// ─── Import from Canvas ───

app.post('/api/canvas/:id/import-from-canvas', async (c) => {
  const dashId = c.get('dashboardAccessId');
  const canvasId = c.req.param('id');
  const owned = await getOwnedCanvas(c.env.DB, canvasId, dashId);
  if (!owned) return c.json({ success: false, error: 'Canvas not found or denied' }, 404);

  const { sourceCanvasId, transcriptIds } = await c.req.json();
  const sourceCanvas = await c.env.DB.prepare('SELECT * FROM CodingCanvas WHERE id = ? AND dashboardAccessId = ?').bind(sourceCanvasId, dashId).first();
  if (!sourceCanvas) return c.json({ success: false, error: 'Source canvas not found or not yours' }, 404);

  const srcTranscripts = (await c.env.DB.prepare('SELECT * FROM CanvasTranscript WHERE canvasId = ?').bind(sourceCanvasId).all()).results as any[];
  const filtered = srcTranscripts.filter((t: any) => transcriptIds.includes(t.id));
  if (filtered.length === 0) return c.json({ success: true, data: [] });

  const countResult = await c.env.DB.prepare('SELECT COUNT(*) as cnt FROM CanvasTranscript WHERE canvasId = ?').bind(canvasId).first();
  const baseOrder = (countResult as any)?.cnt || 0;
  const now = new Date().toISOString();
  const results: any[] = [];

  for (let i = 0; i < filtered.length; i++) {
    const src = filtered[i];
    const id = uid();
    await c.env.DB.prepare(
      'INSERT INTO CanvasTranscript (id, canvasId, title, content, sortOrder, sourceType, sourceId, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)'
    ).bind(id, canvasId, src.title, src.content, baseOrder + i, 'cross-canvas', src.id, now, now).run();
    results.push({ id, canvasId, title: src.title, content: src.content, sortOrder: baseOrder + i, createdAt: now, updatedAt: now });
  }

  return c.json({ success: true, data: results }, 201);
});

// ─── Canvas Sharing ───

app.post('/api/canvas/:id/share', async (c) => {
  const dashId = c.get('dashboardAccessId');
  const canvasId = c.req.param('id');
  const owned = await getOwnedCanvas(c.env.DB, canvasId, dashId);
  if (!owned) return c.json({ success: false, error: 'Canvas not found or denied' }, 404);

  const shareCode = `SHARE-${nanoid(8)}`;
  const id = uid();
  await c.env.DB.prepare(
    'INSERT INTO CanvasShare (id, canvasId, shareCode, createdBy, createdAt) VALUES (?, ?, ?, ?, ?)'
  ).bind(id, canvasId, shareCode, dashId, new Date().toISOString()).run();
  const share = await c.env.DB.prepare('SELECT * FROM CanvasShare WHERE id = ?').bind(id).first();
  return c.json({ success: true, data: share }, 201);
});

app.get('/api/canvas/:id/shares', async (c) => {
  const dashId = c.get('dashboardAccessId');
  const canvasId = c.req.param('id');
  const owned = await getOwnedCanvas(c.env.DB, canvasId, dashId);
  if (!owned) return c.json({ success: false, error: 'Canvas not found or denied' }, 404);

  const shares = await c.env.DB.prepare('SELECT * FROM CanvasShare WHERE canvasId = ? ORDER BY createdAt DESC').bind(canvasId).all();
  return c.json({ success: true, data: shares.results });
});

app.delete('/api/canvas/:id/share/:shareId', async (c) => {
  const dashId = c.get('dashboardAccessId');
  const canvasId = c.req.param('id');
  const owned = await getOwnedCanvas(c.env.DB, canvasId, dashId);
  if (!owned) return c.json({ success: false, error: 'Canvas not found or denied' }, 404);

  await c.env.DB.prepare('DELETE FROM CanvasShare WHERE id = ? AND canvasId = ?').bind(c.req.param('shareId'), canvasId).run();
  return c.json({ success: true });
});

// ─── Public Share ───

app.get('/api/canvas/shared/:code', async (c) => {
  const share = await c.env.DB.prepare('SELECT * FROM CanvasShare WHERE shareCode = ?').bind(c.req.param('code')).first();
  if (!share) return c.json({ success: false, error: 'Share code not found' }, 404);
  if (share.expiresAt && new Date(share.expiresAt as string) < new Date()) {
    return c.json({ success: false, error: 'Share code expired' }, 410);
  }

  const canvasId = share.canvasId as string;
  const canvas = await c.env.DB.prepare('SELECT * FROM CodingCanvas WHERE id = ?').bind(canvasId).first();
  if (!canvas) return c.json({ success: false, error: 'Canvas not found' }, 404);

  const [transcripts, questions, memos, codings, cases, relations, computedNodes] = await Promise.all([
    c.env.DB.prepare('SELECT * FROM CanvasTranscript WHERE canvasId = ? ORDER BY sortOrder ASC').bind(canvasId).all(),
    c.env.DB.prepare('SELECT * FROM CanvasQuestion WHERE canvasId = ? ORDER BY sortOrder ASC').bind(canvasId).all(),
    c.env.DB.prepare('SELECT * FROM CanvasMemo WHERE canvasId = ? ORDER BY createdAt ASC').bind(canvasId).all(),
    c.env.DB.prepare('SELECT * FROM CanvasTextCoding WHERE canvasId = ?').bind(canvasId).all(),
    c.env.DB.prepare('SELECT * FROM CanvasCase WHERE canvasId = ? ORDER BY createdAt ASC').bind(canvasId).all(),
    c.env.DB.prepare('SELECT * FROM CanvasRelation WHERE canvasId = ? ORDER BY createdAt ASC').bind(canvasId).all(),
    c.env.DB.prepare('SELECT * FROM CanvasComputedNode WHERE canvasId = ? ORDER BY createdAt ASC').bind(canvasId).all(),
  ]);

  return c.json({
    success: true,
    data: {
      ...canvas,
      transcripts: transcripts.results,
      questions: questions.results,
      memos: memos.results,
      codings: codings.results,
      cases: cases.results.map((cs: any) => ({ ...cs, attributes: JSON.parse(cs.attributes) })),
      relations: relations.results,
      computedNodes: computedNodes.results.map((n: any) => ({ ...n, config: JSON.parse(n.config), result: JSON.parse(n.result) })),
    },
  });
});

// ─── Clone from Share ───

app.post('/api/canvas/clone/:code', authMiddleware, async (c) => {
  const dashId = c.get('dashboardAccessId');
  const share = await c.env.DB.prepare('SELECT * FROM CanvasShare WHERE shareCode = ?').bind(c.req.param('code')).first();
  if (!share) return c.json({ success: false, error: 'Share code not found' }, 404);
  if (share.expiresAt && new Date(share.expiresAt as string) < new Date()) {
    return c.json({ success: false, error: 'Share code expired' }, 410);
  }

  const sourceId = share.canvasId as string;
  const source = await c.env.DB.prepare('SELECT * FROM CodingCanvas WHERE id = ?').bind(sourceId).first();
  if (!source) return c.json({ success: false, error: 'Source canvas not found' }, 404);

  // Find unique clone name
  let cloneName = `${source.name} (Clone)`;
  let attempt = 0;
  while (true) {
    const existing = await c.env.DB.prepare('SELECT id FROM CodingCanvas WHERE dashboardAccessId = ? AND name = ?').bind(dashId, cloneName).first();
    if (!existing) break;
    attempt++;
    cloneName = `${source.name} (Clone) ${attempt}`;
  }

  const newCanvasId = uid();
  const now = new Date().toISOString();
  await c.env.DB.prepare(
    'INSERT INTO CodingCanvas (id, dashboardAccessId, name, description, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?)'
  ).bind(newCanvasId, dashId, cloneName, source.description, now, now).run();

  // Clone all data
  const [srcTranscripts, srcQuestions, srcMemos, srcCodings, srcCases, srcRelations, srcComputed] = await Promise.all([
    c.env.DB.prepare('SELECT * FROM CanvasTranscript WHERE canvasId = ?').bind(sourceId).all(),
    c.env.DB.prepare('SELECT * FROM CanvasQuestion WHERE canvasId = ?').bind(sourceId).all(),
    c.env.DB.prepare('SELECT * FROM CanvasMemo WHERE canvasId = ?').bind(sourceId).all(),
    c.env.DB.prepare('SELECT * FROM CanvasTextCoding WHERE canvasId = ?').bind(sourceId).all(),
    c.env.DB.prepare('SELECT * FROM CanvasCase WHERE canvasId = ?').bind(sourceId).all(),
    c.env.DB.prepare('SELECT * FROM CanvasRelation WHERE canvasId = ?').bind(sourceId).all(),
    c.env.DB.prepare('SELECT * FROM CanvasComputedNode WHERE canvasId = ?').bind(sourceId).all(),
  ]);

  const tMap = new Map<string, string>();
  const qMap = new Map<string, string>();
  const csMap = new Map<string, string>();

  for (const cs of srcCases.results as any[]) {
    const nid = uid();
    csMap.set(cs.id, nid);
    await c.env.DB.prepare('INSERT INTO CanvasCase (id, canvasId, name, attributes, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?)')
      .bind(nid, newCanvasId, cs.name, cs.attributes, now, now).run();
  }

  for (const t of srcTranscripts.results as any[]) {
    const nid = uid();
    tMap.set(t.id, nid);
    await c.env.DB.prepare('INSERT INTO CanvasTranscript (id, canvasId, title, content, sortOrder, caseId, sourceType, sourceId, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)')
      .bind(nid, newCanvasId, t.title, t.content, t.sortOrder, t.caseId ? csMap.get(t.caseId) || null : null, 'cross-canvas', t.id, now, now).run();
  }

  for (const q of srcQuestions.results as any[]) {
    const nid = uid();
    qMap.set(q.id, nid);
    await c.env.DB.prepare('INSERT INTO CanvasQuestion (id, canvasId, text, color, sortOrder, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?, ?)')
      .bind(nid, newCanvasId, q.text, q.color, q.sortOrder, now, now).run();
  }

  // Set parent question IDs
  for (const q of srcQuestions.results as any[]) {
    if (q.parentQuestionId && qMap.has(q.parentQuestionId)) {
      await c.env.DB.prepare('UPDATE CanvasQuestion SET parentQuestionId = ? WHERE id = ?')
        .bind(qMap.get(q.parentQuestionId)!, qMap.get(q.id)!).run();
    }
  }

  for (const m of srcMemos.results as any[]) {
    await c.env.DB.prepare('INSERT INTO CanvasMemo (id, canvasId, title, content, color, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?, ?)')
      .bind(uid(), newCanvasId, m.title, m.content, m.color, now, now).run();
  }

  for (const cd of srcCodings.results as any[]) {
    const nt = tMap.get(cd.transcriptId);
    const nq = qMap.get(cd.questionId);
    if (nt && nq) {
      await c.env.DB.prepare('INSERT INTO CanvasTextCoding (id, canvasId, transcriptId, questionId, startOffset, endOffset, codedText, note, annotation, createdAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)')
        .bind(uid(), newCanvasId, nt, nq, cd.startOffset, cd.endOffset, cd.codedText, cd.note, cd.annotation, now).run();
    }
  }

  for (const r of srcRelations.results as any[]) {
    const fromId = r.fromType === 'case' ? csMap.get(r.fromId) : qMap.get(r.fromId);
    const toId = r.toType === 'case' ? csMap.get(r.toId) : qMap.get(r.toId);
    if (fromId && toId) {
      await c.env.DB.prepare('INSERT INTO CanvasRelation (id, canvasId, fromType, fromId, toType, toId, label, createdAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?)')
        .bind(uid(), newCanvasId, r.fromType, fromId, r.toType, toId, r.label, now).run();
    }
  }

  for (const n of srcComputed.results as any[]) {
    await c.env.DB.prepare('INSERT INTO CanvasComputedNode (id, canvasId, nodeType, label, config, result, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?)')
      .bind(uid(), newCanvasId, n.nodeType, n.label, n.config, '{}', now, now).run();
  }

  // Increment clone count
  await c.env.DB.prepare('UPDATE CanvasShare SET cloneCount = cloneCount + 1 WHERE id = ?').bind(share.id).run();

  const newCanvas = await c.env.DB.prepare('SELECT * FROM CodingCanvas WHERE id = ?').bind(newCanvasId).first();
  return c.json({ success: true, data: newCanvas }, 201);
});

// ─── Audit Log Helper ───

async function logAudit(db: D1Database, entry: {
  action: string; resource: string; resourceId: string;
  actorType: string; actorId: string; ip: string;
  method: string; path: string; meta?: string;
}) {
  const id = uid();
  const now = new Date().toISOString();
  await db.prepare(
    'INSERT INTO AuditLog (id, action, resource, resourceId, actorType, actorId, ip, method, path, meta, timestamp) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
  ).bind(id, entry.action, entry.resource, entry.resourceId, entry.actorType, entry.actorId, entry.ip, entry.method, entry.path, entry.meta || null, now).run();
}

// ─── Ethics Settings ───

// GET /api/canvas/:canvasId/ethics
app.get('/api/canvas/:canvasId/ethics', authMiddleware, async (c) => {
  const dashboardAccessId = c.get('dashboardAccessId');
  const canvasId = c.req.param('canvasId');
  const canvas = await c.env.DB.prepare('SELECT * FROM CodingCanvas WHERE id = ? AND dashboardAccessId = ?')
    .bind(canvasId, dashboardAccessId).first();
  if (!canvas) return c.json({ success: false, error: 'Canvas not found' }, 404);

  const consents = await c.env.DB.prepare('SELECT * FROM ConsentRecord WHERE canvasId = ? ORDER BY createdAt DESC')
    .bind(canvasId).all();

  return c.json({
    success: true,
    data: {
      ethicsApprovalId: canvas.ethicsApprovalId,
      ethicsStatus: canvas.ethicsStatus,
      dataRetentionDate: canvas.dataRetentionDate,
      consentRecords: consents.results,
    },
  });
});

// PUT /api/canvas/:canvasId/ethics
app.put('/api/canvas/:canvasId/ethics', authMiddleware, async (c) => {
  const dashboardAccessId = c.get('dashboardAccessId');
  const canvasId = c.req.param('canvasId');
  const canvas = await c.env.DB.prepare('SELECT * FROM CodingCanvas WHERE id = ? AND dashboardAccessId = ?')
    .bind(canvasId, dashboardAccessId).first();
  if (!canvas) return c.json({ success: false, error: 'Canvas not found' }, 404);

  const body = await c.req.json();
  const sets: string[] = [];
  const vals: unknown[] = [];

  if (body.ethicsApprovalId !== undefined) { sets.push('ethicsApprovalId = ?'); vals.push(body.ethicsApprovalId); }
  if (body.ethicsStatus !== undefined) { sets.push('ethicsStatus = ?'); vals.push(body.ethicsStatus); }
  if (body.dataRetentionDate !== undefined) { sets.push('dataRetentionDate = ?'); vals.push(body.dataRetentionDate || null); }

  if (sets.length === 0) return c.json({ success: false, error: 'No fields to update' }, 400);
  sets.push('updatedAt = ?'); vals.push(new Date().toISOString());
  vals.push(canvasId);

  await c.env.DB.prepare(`UPDATE CodingCanvas SET ${sets.join(', ')} WHERE id = ?`).bind(...vals).run();

  const ipHash = await sha256(c.req.header('cf-connecting-ip') || 'unknown');
  await logAudit(c.env.DB, {
    action: 'ethics.update', resource: 'canvas', resourceId: canvasId,
    actorType: 'researcher', actorId: dashboardAccessId, ip: ipHash,
    method: 'PUT', path: c.req.path,
    meta: JSON.stringify({ ethicsApprovalId: body.ethicsApprovalId, ethicsStatus: body.ethicsStatus }),
  });

  const updated = await c.env.DB.prepare('SELECT ethicsApprovalId, ethicsStatus, dataRetentionDate FROM CodingCanvas WHERE id = ?').bind(canvasId).first();
  return c.json({ success: true, data: updated });
});

// ─── Consent Records ───

// POST /api/canvas/:canvasId/consent
app.post('/api/canvas/:canvasId/consent', authMiddleware, async (c) => {
  const dashboardAccessId = c.get('dashboardAccessId');
  const canvasId = c.req.param('canvasId');
  const canvas = await c.env.DB.prepare('SELECT id FROM CodingCanvas WHERE id = ? AND dashboardAccessId = ?')
    .bind(canvasId, dashboardAccessId).first();
  if (!canvas) return c.json({ success: false, error: 'Canvas not found' }, 404);

  const body = await c.req.json();
  if (!body.participantId || typeof body.participantId !== 'string') {
    return c.json({ success: false, error: 'participantId is required' }, 400);
  }

  // Check for duplicate
  const existing = await c.env.DB.prepare('SELECT id FROM ConsentRecord WHERE canvasId = ? AND participantId = ?')
    .bind(canvasId, body.participantId).first();
  if (existing) return c.json({ success: false, error: 'Consent record already exists for this participant' }, 409);

  const id = uid();
  const now = new Date().toISOString();
  await c.env.DB.prepare(
    'INSERT INTO ConsentRecord (id, canvasId, participantId, consentType, consentStatus, consentDate, ethicsProtocol, notes, createdAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)'
  ).bind(id, canvasId, body.participantId, body.consentType || 'informed', 'active', now, body.ethicsProtocol || null, body.notes || null, now).run();

  const ipHash = await sha256(c.req.header('cf-connecting-ip') || 'unknown');
  await logAudit(c.env.DB, {
    action: 'consent.create', resource: 'consent', resourceId: id,
    actorType: 'researcher', actorId: dashboardAccessId, ip: ipHash,
    method: 'POST', path: c.req.path,
    meta: JSON.stringify({ canvasId, participantId: body.participantId }),
  });

  const record = await c.env.DB.prepare('SELECT * FROM ConsentRecord WHERE id = ?').bind(id).first();
  return c.json({ success: true, data: record }, 201);
});

// GET /api/canvas/:canvasId/consent
app.get('/api/canvas/:canvasId/consent', authMiddleware, async (c) => {
  const dashboardAccessId = c.get('dashboardAccessId');
  const canvasId = c.req.param('canvasId');
  const canvas = await c.env.DB.prepare('SELECT id FROM CodingCanvas WHERE id = ? AND dashboardAccessId = ?')
    .bind(canvasId, dashboardAccessId).first();
  if (!canvas) return c.json({ success: false, error: 'Canvas not found' }, 404);

  const records = await c.env.DB.prepare('SELECT * FROM ConsentRecord WHERE canvasId = ? ORDER BY createdAt DESC')
    .bind(canvasId).all();
  return c.json({ success: true, data: records.results });
});

// PUT /api/canvas/:canvasId/consent/:consentId/withdraw
app.put('/api/canvas/:canvasId/consent/:consentId/withdraw', authMiddleware, async (c) => {
  const dashboardAccessId = c.get('dashboardAccessId');
  const canvasId = c.req.param('canvasId');
  const consentId = c.req.param('consentId');
  const canvas = await c.env.DB.prepare('SELECT id FROM CodingCanvas WHERE id = ? AND dashboardAccessId = ?')
    .bind(canvasId, dashboardAccessId).first();
  if (!canvas) return c.json({ success: false, error: 'Canvas not found' }, 404);

  const existing = await c.env.DB.prepare('SELECT * FROM ConsentRecord WHERE id = ? AND canvasId = ?')
    .bind(consentId, canvasId).first();
  if (!existing) return c.json({ success: false, error: 'Consent record not found' }, 404);
  if (existing.consentStatus === 'withdrawn') return c.json({ success: false, error: 'Already withdrawn' }, 400);

  const now = new Date().toISOString();
  const body = await c.req.json().catch(() => ({}));
  await c.env.DB.prepare('UPDATE ConsentRecord SET consentStatus = ?, withdrawalDate = ?, notes = ? WHERE id = ?')
    .bind('withdrawn', now, (body as any).notes || existing.notes, consentId).run();

  const ipHash = await sha256(c.req.header('cf-connecting-ip') || 'unknown');
  await logAudit(c.env.DB, {
    action: 'consent.withdraw', resource: 'consent', resourceId: consentId,
    actorType: 'researcher', actorId: dashboardAccessId, ip: ipHash,
    method: 'PUT', path: c.req.path,
    meta: JSON.stringify({ canvasId, participantId: existing.participantId }),
  });

  const updated = await c.env.DB.prepare('SELECT * FROM ConsentRecord WHERE id = ?').bind(consentId).first();
  return c.json({ success: true, data: updated });
});

// ─── Audit Log Export ───

app.get('/api/audit-log', authMiddleware, async (c) => {
  const dashboardAccessId = c.get('dashboardAccessId');
  const { from, to, action, limit: lim, offset: off } = c.req.query();

  const conditions = ['actorId = ?'];
  const params: unknown[] = [dashboardAccessId];

  if (from) { conditions.push('timestamp >= ?'); params.push(from); }
  if (to) { conditions.push('timestamp <= ?'); params.push(to); }
  if (action) { conditions.push('action = ?'); params.push(action); }

  const take = Math.min(parseInt(lim) || 100, 1000);
  const skip = parseInt(off) || 0;

  const where = conditions.join(' AND ');
  const entries = await c.env.DB.prepare(`SELECT * FROM AuditLog WHERE ${where} ORDER BY timestamp DESC LIMIT ? OFFSET ?`)
    .bind(...params, take, skip).all();
  const countResult = await c.env.DB.prepare(`SELECT COUNT(*) as total FROM AuditLog WHERE ${where}`)
    .bind(...params).first();

  return c.json({
    success: true,
    data: { entries: entries.results, total: (countResult as any)?.total || 0, limit: take, offset: skip },
  });
});

// ─── Transcript Anonymization ───

app.post('/api/canvas/:canvasId/transcripts/:transcriptId/anonymize', authMiddleware, async (c) => {
  const dashboardAccessId = c.get('dashboardAccessId');
  const canvasId = c.req.param('canvasId');
  const transcriptId = c.req.param('transcriptId');

  const canvas = await c.env.DB.prepare('SELECT id FROM CodingCanvas WHERE id = ? AND dashboardAccessId = ?')
    .bind(canvasId, dashboardAccessId).first();
  if (!canvas) return c.json({ success: false, error: 'Canvas not found' }, 404);

  const body = await c.req.json();
  const replacements = body.replacements;
  if (!Array.isArray(replacements) || replacements.length === 0) {
    return c.json({ success: false, error: 'replacements array required' }, 400);
  }

  const transcript = await c.env.DB.prepare('SELECT * FROM CanvasTranscript WHERE id = ? AND canvasId = ?')
    .bind(transcriptId, canvasId).first();
  if (!transcript) return c.json({ success: false, error: 'Transcript not found' }, 404);

  // Apply replacements to content
  let newContent = transcript.content as string;
  for (const { find, replace } of replacements) {
    newContent = newContent.split(find).join(replace);
  }

  // Update transcript
  const now = new Date().toISOString();
  await c.env.DB.prepare('UPDATE CanvasTranscript SET content = ?, isAnonymized = 1, updatedAt = ? WHERE id = ?')
    .bind(newContent, now, transcriptId).run();

  // Update coded segments
  const codings = await c.env.DB.prepare('SELECT id, codedText FROM CanvasTextCoding WHERE transcriptId = ?')
    .bind(transcriptId).all();
  let codingsUpdated = 0;
  for (const coding of codings.results) {
    let newText = coding.codedText as string;
    for (const { find, replace } of replacements) {
      newText = newText.split(find).join(replace);
    }
    if (newText !== coding.codedText) {
      await c.env.DB.prepare('UPDATE CanvasTextCoding SET codedText = ? WHERE id = ?').bind(newText, coding.id).run();
      codingsUpdated++;
    }
  }

  const ipHash = await sha256(c.req.header('cf-connecting-ip') || 'unknown');
  await logAudit(c.env.DB, {
    action: 'transcript.anonymize', resource: 'transcript', resourceId: transcriptId,
    actorType: 'researcher', actorId: dashboardAccessId, ip: ipHash,
    method: 'POST', path: c.req.path,
    meta: JSON.stringify({ canvasId, replacementCount: replacements.length, codingsUpdated }),
  });

  const updated = await c.env.DB.prepare('SELECT * FROM CanvasTranscript WHERE id = ?').bind(transcriptId).first();
  return c.json({ success: true, data: updated });
});

// ─── Health ───

app.get('/api/health', (c) => c.json({ status: 'ok', timestamp: new Date().toISOString() }));

// ─── 404 for unmatched API routes ───

app.all('/api/*', (c) => c.json({ success: false, error: 'Not found' }, 404));

export default app;
