import { prisma } from '../lib/prisma.js';

interface ReportData {
  canvasName: string;
  newCodingsCount: number;
  totalCodingsCount: number;
  questionsSummary: { text: string; codingCount: number }[];
  canvasId: string;
  collaboratorCount: number;
}

/**
 * Generate an HTML report for a user's canvas activity.
 * If canvasId is provided, report is scoped to that canvas.
 * Otherwise, aggregates across all user canvases.
 */
export async function generateReport(
  userId: string,
  canvasId?: string | null,
  periodDays: number = 7,
): Promise<{ html: string; subject: string }> {
  const since = new Date(Date.now() - periodDays * 24 * 60 * 60 * 1000);

  const user = await prisma.user.findUnique({
    where: { id: userId },
    // The legacy DashboardAccess row (if this account was linked from an
    // access code) is part of how the user's canvases are scoped — see below.
    select: { name: true, email: true, dashboardAccess: { select: { id: true } } },
  });

  if (!user) {
    return { html: '<p>User not found</p>', subject: 'QualCanvas Report' };
  }

  // Scope canvases exactly as GET /canvas does: owned via userId, owned via the
  // legacy DashboardAccess row (those canvases carry a NULL userId), or shared
  // with the user as a collaborator. Scoping by userId alone silently dropped
  // the latter two, so users whose canvases are plainly listed in the UI got a
  // 200 with "No canvas activity this period" — a missing-data bug reported as
  // a success.
  const visibleToUser = {
    OR: [
      { userId },
      { collaborators: { some: { userId } } },
      ...(user.dashboardAccess ? [{ dashboardAccessId: user.dashboardAccess.id }] : []),
    ],
  };
  const canvasWhere = canvasId ? { id: canvasId, ...visibleToUser } : visibleToUser;

  const canvases = await prisma.codingCanvas.findMany({
    where: { ...canvasWhere, deletedAt: null },
    include: {
      // Totals via _count (was materializing every coding twice, unbounded).
      _count: { select: { codings: true, collaborators: true } },
      // Deliberately NOT selecting any coding rows: the report carries counts
      // only, never participant (interview) text. The recent-period count is
      // queried separately below.
      // Per-question coding counts via _count instead of the full nested rows.
      questions: {
        include: { _count: { select: { codings: true } } },
      },
    },
  });

  const recentCountRows =
    canvases.length > 0
      ? await prisma.canvasTextCoding.groupBy({
          by: ['canvasId'],
          where: {
            canvasId: { in: canvases.map((canvas) => canvas.id) },
            createdAt: { gte: since },
          },
          _count: { _all: true },
        })
      : [];
  const recentCountByCanvas = new Map(recentCountRows.map((row) => [row.canvasId, row._count._all]));

  const reports: ReportData[] = canvases.map((canvas) => {
    const questionsSummary = canvas.questions
      .map((q) => ({
        text: q.text,
        codingCount: q._count.codings,
      }))
      .sort((a, b) => b.codingCount - a.codingCount)
      .slice(0, 10);

    return {
      canvasName: canvas.name,
      newCodingsCount: recentCountByCanvas.get(canvas.id) ?? 0,
      totalCodingsCount: canvas._count.codings,
      questionsSummary,
      canvasId: canvas.id,
      collaboratorCount: canvas._count.collaborators,
    };
  });

  const periodLabel = periodDays === 1 ? 'Daily' : periodDays === 7 ? 'Weekly' : 'Monthly';
  const subject = `QualCanvas ${periodLabel} Report — ${new Date().toLocaleDateString()}`;

  const canvasSections = reports
    .map(
      (r) => `
    <div style="margin-bottom:24px;padding:16px;border:1px solid #e5e7eb;border-radius:8px;">
      <h3 style="margin:0 0 8px;color:#1f2937;font-size:16px;">${escapeHtml(r.canvasName)}</h3>
      <div style="display:flex;gap:24px;margin-bottom:12px;">
        <div style="text-align:center;">
          <div style="font-size:24px;font-weight:bold;color:#3b82f6;">${r.newCodingsCount}</div>
          <div style="font-size:12px;color:#4b5563;">New Codings</div>
        </div>
        <div style="text-align:center;">
          <div style="font-size:24px;font-weight:bold;color:#10b981;">${r.totalCodingsCount}</div>
          <div style="font-size:12px;color:#6b7280;">Total Codings</div>
        </div>
        <div style="text-align:center;">
          <div style="font-size:24px;font-weight:bold;color:#8b5cf6;">${r.collaboratorCount}</div>
          <div style="font-size:12px;color:#6b7280;">Collaborators</div>
        </div>
      </div>
      ${
        r.questionsSummary.length > 0
          ? `
        <h4 style="margin:12px 0 8px;font-size:13px;color:#374151;">Top Codes</h4>
        <table style="width:100%;font-size:13px;border-collapse:collapse;">
          ${r.questionsSummary
            .map(
              (q) => `
            <tr>
              <td style="padding:4px 8px;border-bottom:1px solid #f3f4f6;">${escapeHtml(q.text)}</td>
              <td style="padding:4px 8px;text-align:right;border-bottom:1px solid #f3f4f6;color:#6b7280;">${q.codingCount} codings</td>
            </tr>
          `,
            )
            .join('')}
        </table>
      `
          : ''
      }
      <p style="margin:12px 0 0;font-size:13px;"><a href="${escapeHtml(appLink(`/canvas/${r.canvasId}`))}" style="color:#1d4ed8;text-decoration:underline;">Open this canvas in QualCanvas</a></p>
    </div>
  `,
    )
    .join('');

  const html = `<!DOCTYPE html>
<html>
<head><meta charset="utf-8" /></head>
<body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;max-width:600px;margin:0 auto;padding:24px;background:#f9fafb;">
  <div style="text-align:center;margin-bottom:24px;">
    <h1 style="margin:0;font-size:22px;color:#1f2937;">QualCanvas ${periodLabel} Report</h1>
    <p style="margin:4px 0 0;font-size:13px;color:#6b7280;">
      Hi ${escapeHtml(user.name)}, here's your activity summary for the past ${periodDays} day${periodDays > 1 ? 's' : ''}.
    </p>
  </div>
  ${reports.length > 0 ? canvasSections : '<p style="text-align:center;color:#6b7280;">No canvas activity this period.</p>'}
  <p style="text-align:center;font-size:13px;color:#374151;">Your interview text stays in the app. <a href="${escapeHtml(appLink('/'))}" style="color:#1d4ed8;text-decoration:underline;">Open QualCanvas</a> to read it.</p>
  <div style="text-align:center;margin-top:24px;padding-top:16px;border-top:1px solid #e5e7eb;">
    <p style="font-size:11px;color:#6b7280;">
      This report was generated by QualCanvas. You can manage your report settings in your account.
    </p>
  </div>
</body>
</html>`;

  return { html, subject };
}

function appLink(path: string): string {
  const base = (process.env.APP_URL || 'http://localhost:5174').replace(/\/$/, '');
  return `${base}${path}`;
}

function escapeHtml(str: string): string {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
