import type { Request, Response, NextFunction } from 'express';
import { prisma } from '../lib/prisma.js';
import { sha256 } from '../utils/hashing.js';

export interface AuditEntry {
  action: string;
  resource: string;
  resourceId?: string | null;
  actorType: string;
  actorId?: string | null;
  ip?: string | null;
  method?: string | null;
  path?: string | null;
  statusCode?: number | null;
  meta?: string | null;
}

function determineActorType(req: Request): { actorType: string; actorId: string | null } {
  if (req.dashboardAccessId) {
    return { actorType: 'researcher', actorId: req.dashboardAccessId };
  }
  return { actorType: 'system', actorId: null };
}

function determineAction(method: string, path: string): string {
  if (path.includes('/export')) return 'export';
  switch (method) {
    case 'GET': return 'read';
    case 'POST': return 'write';
    case 'PUT': case 'PATCH': return 'update';
    case 'DELETE': return 'delete';
    default: return 'read';
  }
}

function determineResource(path: string): string {
  if (path.includes('/canvas')) return 'canvas';
  if (path.includes('/consent')) return 'consent';
  return 'unknown';
}

/**
 * Write an audit entry directly to the database.
 */
export async function logAudit(entry: AuditEntry): Promise<void> {
  try {
    await prisma.auditLog.create({
      data: {
        action: entry.action,
        resource: entry.resource,
        resourceId: entry.resourceId ?? null,
        actorType: entry.actorType,
        actorId: entry.actorId ?? null,
        ip: entry.ip ?? null,
        method: entry.method ?? null,
        path: entry.path ?? null,
        statusCode: entry.statusCode ?? null,
        meta: entry.meta ?? null,
      },
    });
  } catch (err) {
    console.error('Audit log write error:', (err as Error).message);
  }
}

/**
 * Express middleware that logs request/response to the AuditLog table.
 */
export function auditLog(req: Request, res: Response, next: NextFunction): void {
  const originalEnd = res.end;
  const startPath = req.originalUrl || req.path;

  res.end = function (...args: any[]) {
    const action = determineAction(req.method, startPath);
    const { actorType, actorId } = determineActorType(req);
    const rawIp = req.ip || req.socket.remoteAddress || 'unknown';
    const hashedIp = sha256(rawIp);

    logAudit({
      action,
      resource: determineResource(startPath),
      resourceId: req.params?.id || null,
      actorType,
      actorId,
      ip: hashedIp,
      method: req.method,
      path: startPath,
      statusCode: res.statusCode,
    });

    return (originalEnd as (...a: unknown[]) => unknown).apply(res, args);
  } as any;

  next();
}
