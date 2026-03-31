import { Router, Request, Response, NextFunction } from 'express';
import rateLimit from 'express-rate-limit';
import { prisma } from '../lib/prisma.js';

export const adminRoutes = Router();

// ─── Test user filtering (per TEST-USER-FILTER.md standard) ───
const TEST_EMAIL_PATTERNS = [
  '@example.com', '@test.com', '@mailinator.com', '@x.com',
  '@staffhubtest.com', '@spamshield.app', '@jewelvalue.app',
  '@smartcashapp.net', '@staffhubapp.com', '@mygrowthmap.net',
  '@shopify.com',
];

const TEST_EMAIL_CONTAINS = [
  'test', 'demo', 'e2e', 'smoke', 'qa', 'cors-', 'fake', 'seed',
];

const INTERNAL_EMAILS = [
  'mooja77@gmail.com', 'john@mooresjewellers.com', 'john@jmsdevlab.com',
];

function isTestEmail(email: string): boolean {
  if (!email) return true;
  const lower = email.toLowerCase();
  if (INTERNAL_EMAILS.includes(lower)) return true;
  if (lower.endsWith('.test')) return true;
  if (TEST_EMAIL_PATTERNS.some(p => lower.endsWith(p))) return true;
  if (TEST_EMAIL_CONTAINS.some(p => lower.includes(p))) return true;
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

// ─── Admin key auth middleware ───
function adminAuth(req: Request, res: Response, next: NextFunction) {
  const adminKey = process.env.ADMIN_API_KEY;
  if (!adminKey) {
    return res.status(503).json({ success: false, error: 'Admin API not configured' });
  }
  const provided = req.headers['x-admin-key'] as string | undefined;
  if (!provided || provided !== adminKey) {
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
          OR: [
            { action: { contains: 'error' } },
            { action: { contains: 'failed' } },
          ],
        },
      }),
      prisma.user.groupBy({ by: ['plan'], where: realUsersWhere, _count: { id: true } }),
      prisma.subscription.findMany({
        where: { status: 'active' },
        include: { user: { select: { plan: true, email: true } } },
      }),
      prisma.canvasComputedNode.groupBy({ by: ['nodeType'], _count: { id: true } }),
      prisma.aiUsage.groupBy({ by: ['feature'], _count: { id: true } }),
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
      ...computedNodeTypes.map((n: { nodeType: string; _count: { id: number } }) => ({ name: n.nodeType, source: 'computed_node', count: n._count.id })),
      ...aiFeatures.map((a: { feature: string; _count: { id: number } }) => ({ name: a.feature, source: 'ai_usage', count: a._count.id })),
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
        planDistribution,
        topFeatures,
      },
    });
  } catch (err) {
    console.error('Admin dashboard error:', err);
    res.status(500).json({ success: false, error: 'Failed to load dashboard metrics' });
  }
});

// ─── GET /users — Paginated user list ───
adminRoutes.get('/users', async (req: Request, res: Response) => {
  try {
    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit as string) || 20));
    const search = (req.query.search as string) || '';
    const skip = (page - 1) * limit;

    const where = search
      ? {
          OR: [
            { email: { contains: search } },
            { name: { contains: search } },
          ],
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

    // Get last login from AuditLog for each user
    const userIds = users.map((u: { id: string }) => u.id);
    const lastLogins = await prisma.auditLog.findMany({
      where: {
        actorId: { in: userIds },
        action: { contains: 'login' },
      },
      orderBy: { timestamp: 'desc' },
      distinct: ['actorId'],
      select: { actorId: true, timestamp: true },
    });
    const lastLoginMap = new Map(lastLogins.map((l: { actorId: string | null; timestamp: Date }) => [l.actorId, l.timestamp]));

    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

    const data = users.map((u: any) => {
      const lastLogin = lastLoginMap.get(u.id) || null;
      return {
        id: u.id,
        email: u.email,
        name: u.name,
        plan: u.plan,
        signupDate: u.createdAt,
        lastLogin,
        status: lastLogin && lastLogin >= thirtyDaysAgo ? 'active' : 'inactive',
        canvasCount: u._count.codingCanvases,
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
      })
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
      })
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
