import { Router, Request, Response, NextFunction } from 'express';
import { timingSafeEqual } from 'crypto';
import rateLimit from 'express-rate-limit';
import { prisma } from '../lib/prisma.js';

export const adminRoutes = Router();

// ─── Test user filtering (per TEST-USER-FILTER.md standard) ───
const TEST_EMAIL_PATTERNS = [
  '@example.com',
  '@test.com',
  '@mailinator.com',
  '@x.com',
  '@staffhubtest.com',
  '@spamshield.app',
  '@jewelvalue.app',
  '@smartcashapp.net',
  '@staffhubapp.com',
  '@mygrowthmap.net',
  '@shopify.com',
];

const TEST_EMAIL_CONTAINS = ['test', 'demo', 'e2e', 'smoke', 'qa', 'cors-', 'fake', 'seed'];

const INTERNAL_EMAILS = ['mooja77@gmail.com', 'john@mooresjewellers.com', 'john@jmsdevlab.com'];

function isTestEmail(email: string): boolean {
  if (!email) return true;
  const lower = email.toLowerCase();
  if (INTERNAL_EMAILS.includes(lower)) return true;
  if (lower.endsWith('.test')) return true;
  if (TEST_EMAIL_PATTERNS.some((p) => lower.endsWith(p))) return true;
  if (TEST_EMAIL_CONTAINS.some((p) => lower.includes(p))) return true;
  if (lower.match(/mooja77\+.*@gmail\.com/)) return true;
  return false;
}

// Prisma WHERE clause to exclude test users
const realUsersWhere = {
  AND: [
    { email: { notIn: INTERNAL_EMAILS } },
    { email: { not: { contains: 'test' } } },
    { email: { not: { contains: 'demo' } } },
    { email: { not: { contains: 'e2e' } } },
    { email: { not: { contains: 'smoke' } } },
    { email: { not: { contains: 'qa' } } },
    { email: { not: { contains: 'cors-' } } },
    { email: { not: { contains: 'fake' } } },
    { email: { not: { contains: 'seed' } } },
    { email: { not: { endsWith: '.test' } } },
    { email: { not: { endsWith: '@example.com' } } },
    { email: { not: { endsWith: '@test.com' } } },
    { email: { not: { endsWith: '@mailinator.com' } } },
    { email: { not: { endsWith: '@x.com' } } },
    { email: { not: { endsWith: '@shopify.com' } } },
    { email: { not: { endsWith: '@staffhubtest.com' } } },
    { email: { not: { endsWith: '@spamshield.app' } } },
    { email: { not: { endsWith: '@jewelvalue.app' } } },
    { email: { not: { endsWith: '@smartcashapp.net' } } },
    { email: { not: { endsWith: '@staffhubapp.com' } } },
    { email: { not: { endsWith: '@mygrowthmap.net' } } },
  ],
};

// ─── Rate limit: 30 req/min ───
const isTestEnv = process.env.NODE_ENV === 'test' || process.env.E2E_TEST === 'true';
const adminLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, error: 'Too many admin requests, please try again later' },
  skip: () => isTestEnv,
});
adminRoutes.use(adminLimiter);

// ─── Admin key auth middleware (timing-safe comparison) ───
function adminAuth(req: Request, res: Response, next: NextFunction) {
  const adminKey = process.env.ADMIN_API_KEY;
  if (!adminKey) {
    return res.status(503).json({ success: false, error: 'Admin API not configured' });
  }
  const provided = req.headers['x-admin-key'] as string | undefined;
  if (!provided) {
    return res.status(403).json({ success: false, error: 'Forbidden' });
  }
  // Timing-safe comparison to prevent brute-force via response time analysis
  let keysMatch = false;
  try {
    const a = Buffer.from(provided);
    const b = Buffer.from(adminKey);
    keysMatch = a.length === b.length && timingSafeEqual(a, b);
  } catch {
    keysMatch = false;
  }
  if (!keysMatch) {
    return res.status(403).json({ success: false, error: 'Forbidden' });
  }
  next();
}
adminRoutes.use(adminAuth);

// ─── GET /dashboard — Aggregate metrics ───
adminRoutes.get('/dashboard', async (_req: Request, res: Response) => {
  try {
    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const twentyFourHoursAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);

    const [
      totalUsers,
      totalAllUsers,
      newSignups7d,
      newSignups30d,
      activeUsersByCanvas,
      errorCount24h,
      planGroups,
      subscriptions,
      computedNodeTypes,
      aiFeatures,
      webhookCount24h,
      lastWebhookEvent,
    ] = await Promise.all([
      prisma.user.count({ where: realUsersWhere }),
      prisma.user.count(),
      prisma.user.count({ where: { ...realUsersWhere, createdAt: { gte: sevenDaysAgo } } }),
      prisma.user.count({ where: { ...realUsersWhere, createdAt: { gte: thirtyDaysAgo } } }),
      prisma.codingCanvas.findMany({
        where: { updatedAt: { gte: thirtyDaysAgo }, userId: { not: null } },
        select: { userId: true },
        distinct: ['userId'],
      }),
      prisma.auditLog.count({
        where: {
          timestamp: { gte: twentyFourHoursAgo },
          OR: [{ action: { contains: 'error' } }, { action: { contains: 'failed' } }],
        },
      }),
      prisma.user.groupBy({ by: ['plan'], where: realUsersWhere, _count: { id: true } }),
      prisma.subscription.findMany({
        where: { status: 'active' },
        include: { user: { select: { plan: true, email: true } } },
      }),
      prisma.canvasComputedNode.groupBy({ by: ['nodeType'], _count: { id: true } }),
      prisma.aiUsage.groupBy({ by: ['feature'], _count: { id: true } }),
      prisma.webhookEvent.count({ where: { createdAt: { gte: twentyFourHoursAgo } } }).catch(() => 0),
      prisma.webhookEvent.findFirst({ orderBy: { createdAt: 'desc' } }).catch(() => null),
    ]);

    // Get emails of active canvas users to filter out test accounts
    const activeUserIds = activeUsersByCanvas.map((c: { userId: string | null }) => c.userId!).filter(Boolean);
    const activeUserEmails = activeUserIds.length
      ? await prisma.user.findMany({
          where: { id: { in: activeUserIds } },
          select: { email: true },
        })
      : [];
    const activeUsers = activeUserEmails.filter((u: { email: string }) => !isTestEmail(u.email)).length;
    const testUsers = totalAllUsers - totalUsers;

    // Calculate MRR: Pro=$12, Team=$29 — only real subscriptions
    const PLAN_PRICES: Record<string, number> = { pro: 12, team: 29 };
    let mrr = 0;
    for (const sub of subscriptions) {
      if (!isTestEmail(sub.user.email)) {
        mrr += PLAN_PRICES[sub.user.plan] || 0;
      }
    }

    const planDistribution: Record<string, number> = {};
    for (const g of planGroups) {
      planDistribution[g.plan] = g._count.id;
    }

    const topFeatures = [
      ...computedNodeTypes.map((n: { nodeType: string; _count: { id: number } }) => ({
        name: n.nodeType,
        source: 'computed_node',
        count: n._count.id,
      })),
      ...aiFeatures.map((a: { feature: string; _count: { id: number } }) => ({
        name: a.feature,
        source: 'ai_usage',
        count: a._count.id,
      })),
    ].sort((a: { count: number }, b: { count: number }) => b.count - a.count);

    res.json({
      success: true,
      data: {
        totalUsers,
        testUsers,
        activeUsers,
        newSignups7d,
        newSignups30d,
        mrr,
        errorCount24h,
        activeSessions: 0,
        webhookEvents24h: webhookCount24h,
        lastWebhookAt: (lastWebhookEvent as { createdAt: Date } | null)?.createdAt || null,
        planDistribution,
        topFeatures,
      },
    });
  } catch (err) {
    console.error('Admin dashboard error:', err);
    res.status(500).json({ success: false, error: 'Failed to load dashboard metrics' });
  }
});

// ─── GET /users — Paginated user list with per-user usage data ───
adminRoutes.get('/users', async (req: Request, res: Response) => {
  try {
    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit as string) || 20));
    const search = (req.query.search as string) || '';
    const skip = (page - 1) * limit;

    const where = search
      ? {
          OR: [{ email: { contains: search } }, { name: { contains: search } }],
        }
      : {};

    const [users, total] = await Promise.all([
      prisma.user.findMany({
        where,
        select: {
          id: true,
          email: true,
          name: true,
          plan: true,
          createdAt: true,
          _count: { select: { codingCanvases: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      prisma.user.count({ where }),
    ]);

    const userIds = users.map((u: { id: string }) => u.id);

    // Parallel queries for per-user enrichment
    const [lastLogins, lastActions, actionCounts, sessionCounts, userFeatures, userCanvasData] = await Promise.all([
      // Last login per user
      prisma.auditLog.findMany({
        where: { actorId: { in: userIds }, action: { contains: 'login' } },
        orderBy: { timestamp: 'desc' },
        distinct: ['actorId'],
        select: { actorId: true, timestamp: true },
      }),
      // Last activity (any action) per user
      prisma.auditLog.findMany({
        where: { actorId: { in: userIds } },
        orderBy: { timestamp: 'desc' },
        distinct: ['actorId'],
        select: { actorId: true, timestamp: true },
      }),
      // Total actions per user
      prisma.auditLog.groupBy({
        by: ['actorId'],
        where: { actorId: { in: userIds } },
        _count: { id: true },
      }),
      // Session count (logins) per user
      prisma.auditLog.groupBy({
        by: ['actorId'],
        where: { actorId: { in: userIds }, action: { contains: 'login' } },
        _count: { id: true },
      }),
      // Top features per user: computed nodes used
      prisma.canvasComputedNode.findMany({
        where: { canvas: { userId: { in: userIds } } },
        select: { nodeType: true, canvas: { select: { userId: true } } },
      }),
      // Per-user canvas stats: transcripts, codings, questions
      prisma.codingCanvas.findMany({
        where: { userId: { in: userIds } },
        select: {
          userId: true,
          _count: { select: { transcripts: true, codings: true, questions: true } },
        },
      }),
    ]);

    const lastLoginMap = new Map(lastLogins.map((l: any) => [l.actorId, l.timestamp]));
    const lastActiveMap = new Map(lastActions.map((l: any) => [l.actorId, l.timestamp]));
    const actionCountMap = new Map(actionCounts.map((a: any) => [a.actorId, a._count.id]));
    const sessionCountMap = new Map(sessionCounts.map((s: any) => [s.actorId, s._count.id]));

    // Build top features per user (top 3 most-used computed node types)
    const featuresByUser = new Map<string, Map<string, number>>();
    for (const node of userFeatures) {
      const uid = (node as any).canvas?.userId;
      if (!uid) continue;
      if (!featuresByUser.has(uid)) featuresByUser.set(uid, new Map());
      const fm = featuresByUser.get(uid)!;
      fm.set(node.nodeType, (fm.get(node.nodeType) || 0) + 1);
    }

    // Build per-user usage object (aggregate across canvases)
    const usageByUser = new Map<string, { transcripts: number; codings: number; codes: number }>();
    for (const c of userCanvasData) {
      const uid = (c as any).userId;
      if (!uid) continue;
      if (!usageByUser.has(uid)) usageByUser.set(uid, { transcripts: 0, codings: 0, codes: 0 });
      const u = usageByUser.get(uid)!;
      u.transcripts += (c as any)._count.transcripts;
      u.codings += (c as any)._count.codings;
      u.codes += (c as any)._count.questions;
    }

    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

    const data = users.map((u: any) => {
      const lastLogin = lastLoginMap.get(u.id) || null;
      const lastActive = lastActiveMap.get(u.id) || lastLogin || null;

      // Top 3 features for this user
      const fm = featuresByUser.get(u.id);
      const topFeatures = fm
        ? [...fm.entries()]
            .sort((a, b) => b[1] - a[1])
            .slice(0, 3)
            .map(([name, count]) => ({ name, count }))
        : [];

      const usage = usageByUser.get(u.id) || { transcripts: 0, codings: 0, codes: 0 };

      return {
        id: u.id,
        email: u.email,
        name: u.name,
        plan: u.plan,
        signupDate: u.createdAt,
        lastLogin,
        lastActive,
        sessionCount: sessionCountMap.get(u.id) || 0,
        totalActions: actionCountMap.get(u.id) || 0,
        topFeatures,
        status: lastActive && lastActive >= thirtyDaysAgo ? 'active' : 'inactive',
        canvasCount: u._count.codingCanvases,
        usage: {
          canvases: u._count.codingCanvases,
          transcripts: usage.transcripts,
          codings: usage.codings,
          codes: usage.codes,
        },
        isTest: isTestEmail(u.email),
      };
    });

    const realUsersCount = data.filter((u: any) => !u.isTest).length;
    const testUsersCount = data.filter((u: any) => u.isTest).length;

    res.json({
      success: true,
      data,
      realUsers: realUsersCount,
      testUsers: testUsersCount,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    });
  } catch (err) {
    console.error('Admin users list error:', err);
    res.status(500).json({ success: false, error: 'Failed to load users' });
  }
});

// ─── GET /users/:id — Full user detail ───
adminRoutes.get('/users/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const user = await prisma.user.findUnique({
      where: { id },
      include: {
        subscription: true,
        codingCanvases: {
          select: {
            id: true,
            name: true,
            createdAt: true,
            updatedAt: true,
            _count: {
              select: {
                transcripts: true,
                codings: true,
                computedNodes: true,
              },
            },
          },
          orderBy: { updatedAt: 'desc' },
        },
      },
    });

    if (!user) {
      return res.status(404).json({ success: false, error: 'User not found' });
    }

    const [recentActivity, aiUsageStats] = await Promise.all([
      prisma.auditLog.findMany({
        where: { actorId: id },
        orderBy: { timestamp: 'desc' },
        take: 20,
      }),
      prisma.aiUsage.groupBy({
        by: ['feature'],
        where: { userId: id },
        _count: { id: true },
        _sum: { inputTokens: true, outputTokens: true, costCents: true },
      }),
    ]);

    // Remove sensitive fields
    const { passwordHash: _pw, resetTokenHash: _rt, resetTokenExpiry: _re, ...safeUser } = user;

    res.json({
      success: true,
      data: {
        ...safeUser,
        recentActivity,
        aiUsageStats: aiUsageStats.map((a: any) => ({
          feature: a.feature,
          count: a._count.id,
          totalInputTokens: a._sum.inputTokens || 0,
          totalOutputTokens: a._sum.outputTokens || 0,
          totalCostCents: a._sum.costCents || 0,
        })),
      },
    });
  } catch (err) {
    console.error('Admin user detail error:', err);
    res.status(500).json({ success: false, error: 'Failed to load user details' });
  }
});

// ─── GET /billing — Billing metrics ───
adminRoutes.get('/billing', async (_req: Request, res: Response) => {
  try {
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const PLAN_PRICES: Record<string, number> = { pro: 12, team: 29 };

    const [allSubs, canceledRecent, totalFree, recentTransactions] = await Promise.all([
      prisma.subscription.findMany({
        include: { user: { select: { plan: true, email: true } } },
      }),
      prisma.subscription.count({
        where: {
          status: 'canceled',
          updatedAt: { gte: thirtyDaysAgo },
        },
      }),
      prisma.user.count({ where: { ...realUsersWhere, plan: 'free' } }),
      prisma.subscription.findMany({
        orderBy: { updatedAt: 'desc' },
        take: 10,
        include: { user: { select: { email: true, plan: true } } },
      }),
    ]);

    // Filter to real (non-test) active subscriptions only
    const realActiveSubs = allSubs.filter((s: any) => s.status === 'active' && !isTestEmail(s.user.email));
    let mrr = 0;
    const planCounts: Record<string, { count: number; revenue: number }> = {};

    for (const sub of realActiveSubs) {
      const price = PLAN_PRICES[sub.user.plan] || 0;
      mrr += price;
      if (!planCounts[sub.user.plan]) {
        planCounts[sub.user.plan] = { count: 0, revenue: 0 };
      }
      planCounts[sub.user.plan].count++;
      planCounts[sub.user.plan].revenue += price;
    }

    const totalPaying = realActiveSubs.length;
    const realSubs = allSubs.filter((s: any) => !isTestEmail(s.user.email));
    const totalSubsForChurn = realSubs.length || 1;
    const churnRate30d = parseFloat((canceledRecent / totalSubsForChurn).toFixed(4));

    const planBreakdown = Object.entries(planCounts).map(([plan, data]) => ({
      plan,
      count: data.count,
      revenue: data.revenue,
    }));

    res.json({
      success: true,
      data: {
        mrr,
        arr: mrr * 12,
        totalPaying,
        totalFree,
        churnRate30d,
        planBreakdown,
        recentTransactions: recentTransactions.map((t: any) => ({
          id: t.id,
          userId: t.userId,
          userEmail: t.user.email,
          plan: t.user.plan,
          status: t.status,
          stripeSubscriptionId: t.stripeSubscriptionId,
          currentPeriodStart: t.currentPeriodStart,
          currentPeriodEnd: t.currentPeriodEnd,
          cancelAtPeriodEnd: t.cancelAtPeriodEnd,
          updatedAt: t.updatedAt,
        })),
      },
    });
  } catch (err) {
    console.error('Admin billing error:', err);
    res.status(500).json({ success: false, error: 'Failed to load billing metrics' });
  }
});

// ─── GET /health — System health ───
adminRoutes.get('/health', async (_req: Request, res: Response) => {
  let dbConnected = false;
  let dbResponseMs = 0;
  let status: 'healthy' | 'degraded' | 'unhealthy' = 'unhealthy';

  try {
    const start = Date.now();
    await prisma.$queryRawUnsafe('SELECT 1');
    dbResponseMs = Date.now() - start;
    dbConnected = true;
    status = dbResponseMs < 1000 ? 'healthy' : 'degraded';
  } catch {
    status = 'unhealthy';
  }

  let version = '1.0.0';
  try {
    // Dynamic import of package.json
    const { createRequire } = await import('module');
    const require = createRequire(import.meta.url);
    const pkg = require('../../package.json');
    version = pkg.version || version;
  } catch {
    // keep default
  }

  res.json({
    success: true,
    data: {
      status,
      uptime: process.uptime(),
      dbConnected,
      dbResponseMs,
      memoryUsageMb: parseFloat((process.memoryUsage().heapUsed / 1024 / 1024).toFixed(2)),
      version,
      nodeVersion: process.version,
    },
  });
});

// ─── GET /activity — Activity log ───
adminRoutes.get('/activity', async (req: Request, res: Response) => {
  try {
    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit as string) || 20));
    const type = (req.query.type as string) || '';
    const skip = (page - 1) * limit;

    const where = type ? { action: type } : {};

    const [entries, total] = await Promise.all([
      prisma.auditLog.findMany({
        where,
        orderBy: { timestamp: 'desc' },
        skip,
        take: limit,
      }),
      prisma.auditLog.count({ where }),
    ]);

    // Look up user emails for entries with actorId
    const actorIds = [...new Set(entries.map((e: any) => e.actorId).filter(Boolean))] as string[];
    const users = actorIds.length
      ? await prisma.user.findMany({
          where: { id: { in: actorIds } },
          select: { id: true, email: true },
        })
      : [];
    const emailMap = new Map(users.map((u: { id: string; email: string }) => [u.id, u.email]));

    const data = entries.map((e: any) => ({
      ...e,
      userEmail: e.actorId ? emailMap.get(e.actorId) || null : null,
    }));

    res.json({ success: true, data, pagination: { page, limit, total, totalPages: Math.ceil(total / limit) } });
  } catch (err) {
    console.error('Admin activity error:', err);
    res.status(500).json({ success: false, error: 'Failed to load activity log' });
  }
});

// ─── GET /usage — Aggregate usage analytics ───
adminRoutes.get('/usage', async (req: Request, res: Response) => {
  try {
    const periodParam = (req.query.period as string) || '30d';
    const daysMatch = periodParam.match(/^(\d+)d$/);
    const days = daysMatch ? Math.min(365, Math.max(1, parseInt(daysMatch[1]))) : 30;
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

    const [
      newUsers,
      activeCanvasUsers,
      totalCanvasesCreated,
      totalTranscriptsCreated,
      totalCodingsCreated,
      totalComputedRuns,
      computedByType,
      aiByFeature,
      actionsByDay,
      signupsByDay,
      aiCostTotal,
      topUsers,
    ] = await Promise.all([
      // New signups in period
      prisma.user.count({ where: { ...realUsersWhere, createdAt: { gte: since } } }),
      // Active users (canvas updated in period)
      prisma.codingCanvas.findMany({
        where: { updatedAt: { gte: since }, userId: { not: null } },
        select: { userId: true },
        distinct: ['userId'],
      }),
      // Canvases created in period
      prisma.codingCanvas.count({ where: { createdAt: { gte: since } } }),
      // Transcripts created in period
      prisma.canvasTranscript.count({ where: { createdAt: { gte: since } } }),
      // Codings created in period
      prisma.canvasTextCoding.count({ where: { createdAt: { gte: since } } }),
      // Computed node runs in period
      prisma.canvasComputedNode.count({ where: { updatedAt: { gte: since } } }),
      // Computed nodes by type in period
      prisma.canvasComputedNode.groupBy({
        by: ['nodeType'],
        where: { createdAt: { gte: since } },
        _count: { id: true },
      }),
      // AI usage by feature in period
      prisma.aiUsage.groupBy({
        by: ['feature'],
        where: { createdAt: { gte: since } },
        _count: { id: true },
        _sum: { inputTokens: true, outputTokens: true, costCents: true },
      }),
      // Daily actions (audit log volume by day)
      prisma.auditLog.groupBy({
        by: ['action'],
        where: { timestamp: { gte: since } },
        _count: { id: true },
      }),
      // Daily signups — get raw data, aggregate in JS
      prisma.user.findMany({
        where: { ...realUsersWhere, createdAt: { gte: since } },
        select: { createdAt: true },
        orderBy: { createdAt: 'asc' },
      }),
      // Total AI cost in period
      prisma.aiUsage.aggregate({
        where: { createdAt: { gte: since } },
        _sum: { costCents: true, inputTokens: true, outputTokens: true },
      }),
      // Top 10 most active users by action count in period
      prisma.auditLog.groupBy({
        by: ['actorId'],
        where: { timestamp: { gte: since }, actorId: { not: null } },
        _count: { id: true },
        orderBy: { _count: { id: 'desc' } },
        take: 10,
      }),
    ]);

    // Filter active users to exclude test accounts
    const activeIds = activeCanvasUsers.map((c: any) => c.userId!).filter(Boolean);
    const activeEmails = activeIds.length
      ? await prisma.user.findMany({ where: { id: { in: activeIds } }, select: { email: true } })
      : [];
    const activeUsers = activeEmails.filter((u: any) => !isTestEmail(u.email)).length;

    // Build daily signup trend
    const signupTrend: Record<string, number> = {};
    for (const u of signupsByDay) {
      const day = (u as any).createdAt.toISOString().slice(0, 10);
      signupTrend[day] = (signupTrend[day] || 0) + 1;
    }

    // Resolve top user emails
    const topUserIds = topUsers.map((t: any) => t.actorId).filter(Boolean) as string[];
    const topUserEmails = topUserIds.length
      ? await prisma.user.findMany({ where: { id: { in: topUserIds } }, select: { id: true, email: true, name: true } })
      : [];
    const topUserMap = new Map(topUserEmails.map((u: any) => [u.id, { email: u.email, name: u.name }]));

    // Action breakdown
    const actionBreakdown = actionsByDay
      .map((a: any) => ({ action: a.action, count: a._count.id }))
      .sort((a: any, b: any) => b.count - a.count);

    res.json({
      success: true,
      data: {
        period: `${days}d`,
        since: since.toISOString(),
        users: {
          newSignups: newUsers,
          activeUsers,
          signupTrend,
        },
        content: {
          canvasesCreated: totalCanvasesCreated,
          transcriptsCreated: totalTranscriptsCreated,
          codingsCreated: totalCodingsCreated,
          computedNodeRuns: totalComputedRuns,
        },
        features: {
          computedNodes: computedByType
            .map((n: any) => ({ type: n.nodeType, count: n._count.id }))
            .sort((a: any, b: any) => b.count - a.count),
          aiUsage: aiByFeature
            .map((a: any) => ({
              feature: a.feature,
              count: a._count.id,
              inputTokens: a._sum.inputTokens || 0,
              outputTokens: a._sum.outputTokens || 0,
              costCents: a._sum.costCents || 0,
            }))
            .sort((a: any, b: any) => b.count - a.count),
        },
        ai: {
          totalCostCents: aiCostTotal._sum.costCents || 0,
          totalInputTokens: aiCostTotal._sum.inputTokens || 0,
          totalOutputTokens: aiCostTotal._sum.outputTokens || 0,
        },
        actionBreakdown,
        topUsers: topUsers.map((t: any) => {
          const info: { email: string; name: string } = (topUserMap.get(t.actorId) as
            | { email: string; name: string }
            | undefined) || { email: 'unknown', name: 'unknown' };
          return {
            userId: t.actorId,
            email: info.email,
            name: info.name,
            actionCount: t._count.id,
            isTest: isTestEmail(info.email),
          };
        }),
      },
    });
  } catch (err) {
    console.error('Admin usage error:', err);
    res.status(500).json({ success: false, error: 'Failed to load usage analytics' });
  }
});

// ─── GET /features — Feature usage ───
adminRoutes.get('/features', async (_req: Request, res: Response) => {
  try {
    const [computedNodes, aiUsage] = await Promise.all([
      prisma.canvasComputedNode.groupBy({
        by: ['nodeType'],
        _count: { id: true },
      }),
      prisma.aiUsage.groupBy({
        by: ['feature'],
        _count: { id: true },
      }),
    ]);

    // For computed nodes, also count unique canvases
    const computedCanvasCounts = await Promise.all(
      computedNodes.map(async (n: any) => {
        const uniqueCanvases = await prisma.canvasComputedNode.findMany({
          where: { nodeType: n.nodeType },
          select: { canvasId: true },
          distinct: ['canvasId'],
        });
        return { nodeType: n.nodeType, uniqueCanvases: uniqueCanvases.length };
      }),
    );
    const canvasCountMap = new Map(computedCanvasCounts.map((c: any) => [c.nodeType, c.uniqueCanvases]));

    // For AI usage, also count unique users
    const aiUserCounts = await Promise.all(
      aiUsage.map(async (a: any) => {
        const uniqueUsers = await prisma.aiUsage.findMany({
          where: { feature: a.feature, userId: { not: null } },
          select: { userId: true },
          distinct: ['userId'],
        });
        return { feature: a.feature, uniqueUsers: uniqueUsers.length };
      }),
    );
    const userCountMap = new Map(aiUserCounts.map((c: any) => [c.feature, c.uniqueUsers]));

    const features = [
      ...computedNodes.map((n: any) => ({
        name: n.nodeType,
        source: 'computed_node' as const,
        totalUsage: n._count.id,
        uniqueCanvases: canvasCountMap.get(n.nodeType) || 0,
        uniqueUsers: 0,
      })),
      ...aiUsage.map((a: any) => ({
        name: a.feature,
        source: 'ai_usage' as const,
        totalUsage: a._count.id,
        uniqueCanvases: 0,
        uniqueUsers: userCountMap.get(a.feature) || 0,
      })),
    ].sort((a: any, b: any) => b.totalUsage - a.totalUsage);

    res.json({ success: true, data: features });
  } catch (err) {
    console.error('Admin features error:', err);
    res.status(500).json({ success: false, error: 'Failed to load feature usage' });
  }
});
