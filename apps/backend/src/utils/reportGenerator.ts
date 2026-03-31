import { prisma } from '../lib/prisma.js';

interface ReportData {
  canvasName: string;
  newCodingsCount: number;
  totalCodingsCount: number;
  questionsSummary: { text: string; codingCount: number }[];
  recentActivity: { action: string; timestamp: string }[];
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
    select: { name: true, email: true },
  });

  if (!user) {
    return { html: '<p>User not found</p>', subject: 'QualCanvas Report' };
  }

  const canvasWhere = canvasId
    ? { id: canvasId, userId }
    : { userId };

  const canvases = await prisma.codingCanvas.findMany({
    where: { ...canvasWhere, deletedAt: null },
    include: {
      codings: {
        orderBy: { createdAt: 'desc' },
      },
      questions: {
        include: {
          codings: true,
        },
      },
      collaborators: true,
    },
  });

  const reports: ReportData[] = canvases.map(canvas => {
    const newCodings = canvas.codings.filter(c => c.createdAt >= since);
    const questionsSummary = canvas.questions.map(q => ({
      text: q.text,
      codingCount: q.codings.length,
    })).sort((a: any, b: any) => b.codingCount - a.codingCount).slice(0, 10);

    return {
      canvasName: canvas.name,
      newCodingsCount: newCodings.length,
      totalCodingsCount: canvas.codings.length,
      questionsSummary,
      recentActivity: newCodings.slice(0, 5).map(c => ({
        action: `Coded: "${c.codedText.substring(0, 60)}${c.codedText.length > 60 ? '...' : ''}"`,
        timestamp: c.createdAt.toISOString(),
      })),
      collaboratorCount: canvas.collaborators.length,
    };
  });

  const periodLabel = periodDays === 1 ? 'Daily' : periodDays === 7 ? 'Weekly' : 'Monthly';
  const subject = `QualCanvas ${periodLabel} Report — ${new Date().toLocaleDateString()}`;

  const canvasSections = reports.map(r => `
    <div style="margin-bottom:24px;padding:16px;border:1px solid #e5e7eb;border-radius:8px;">
      <h3 style="margin:0 0 8px;color:#1f2937;font-size:16px;">${escapeHtml(r.canvasName)}</h3>
      <div style="display:flex;gap:24px;margin-bottom:12px;">
        <div style="text-align:center;">
          <div style="font-size:24px;font-weight:bold;color:#3b82f6;">${r.newCodingsCount}</div>
          <div style="font-size:12px;color:#6b7280;">New Codings</div>
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
      ${r.questionsSummary.length > 0 ? `
        <h4 style="margin:12px 0 8px;font-size:13px;color:#374151;">Top Codes</h4>
        <table style="width:100%;font-size:13px;border-collapse:collapse;">
          ${r.questionsSummary.map(q => `
            <tr>
              <td style="padding:4px 8px;border-bottom:1px solid #f3f4f6;">${escapeHtml(q.text)}</td>
              <td style="padding:4px 8px;text-align:right;border-bottom:1px solid #f3f4f6;color:#6b7280;">${q.codingCount} codings</td>
            </tr>
          `).join('')}
        </table>
      ` : ''}
      ${r.recentActivity.length > 0 ? `
        <h4 style="margin:12px 0 8px;font-size:13px;color:#374151;">Recent Activity</h4>
        <ul style="margin:0;padding-left:16px;font-size:12px;color:#6b7280;">
          ${r.recentActivity.map(a => `<li style="margin-bottom:4px;">${escapeHtml(a.action)}</li>`).join('')}
        </ul>
      ` : ''}
    </div>
  `).join('');

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
  <div style="text-align:center;margin-top:24px;padding-top:16px;border-top:1px solid #e5e7eb;">
    <p style="font-size:11px;color:#9ca3af;">
      This report was generated by QualCanvas. You can manage your report settings in your account.
    </p>
  </div>
</body>
</html>`;

  return { html, subject };
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
