import crypto from 'crypto';
import { prisma } from './prisma.js';
import { sendEmail } from './email.js';

// New lifecycle automations are intentionally capped per run so a bad selector
// cannot create a large accidental campaign.
export const LIFECYCLE_BATCH_LIMIT = Number.parseInt(process.env.LIFECYCLE_EMAIL_BATCH_LIMIT || '50', 10);

type EmailCategory = 'lifecycle' | 'productUpdates' | 'trainingTips' | 'inactivityNudges';

interface EmailUser {
  id: string;
  email: string;
  name: string;
  plan?: string;
  createdAt?: Date;
}

export interface EmailPreferencePayload {
  lifecycle: boolean;
  productUpdates: boolean;
  trainingTips: boolean;
  inactivityNudges: boolean;
  unsubscribedAt: Date | null;
}

export interface CampaignInput {
  title: string;
  subject: string;
  previewText?: string | null;
  bodyHtml: string;
  ctaLabel?: string | null;
  ctaUrl?: string | null;
  audience?: string;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const emailPreference = (prisma as any).emailPreference;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const emailDelivery = (prisma as any).emailDelivery;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const emailCampaign = (prisma as any).emailCampaign;

const DEFAULT_APP_URL = process.env.APP_URL || 'http://localhost:5174';
const PRODUCT_NAME = 'QualCanvas';

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function firstName(name: string): string {
  return name.trim().split(/\s+/)[0] || 'there';
}

function appLink(path: string): string {
  return `${DEFAULT_APP_URL.replace(/\/$/, '')}${path.startsWith('/') ? path : `/${path}`}`;
}

function unsubscribeLink(token: string): string {
  return appLink(`/api/email/unsubscribe/${encodeURIComponent(token)}`);
}

function randomToken(): string {
  return crypto.randomBytes(24).toString('hex');
}

export async function ensureEmailPreference(userId: string) {
  const existing = await emailPreference.findUnique({ where: { userId } });
  if (existing) return existing;

  return emailPreference.create({
    data: {
      userId,
      unsubscribeToken: randomToken(),
    },
  });
}

export async function getEmailPreferencePayload(userId: string): Promise<EmailPreferencePayload> {
  const pref = await ensureEmailPreference(userId);
  return {
    lifecycle: pref.lifecycle,
    productUpdates: pref.productUpdates,
    trainingTips: pref.trainingTips,
    inactivityNudges: pref.inactivityNudges,
    unsubscribedAt: pref.unsubscribedAt,
  };
}

export async function updateEmailPreferences(
  userId: string,
  updates: Partial<Omit<EmailPreferencePayload, 'unsubscribedAt'>>,
): Promise<EmailPreferencePayload> {
  const pref = await ensureEmailPreference(userId);
  const next = {
    lifecycle: updates.lifecycle ?? pref.lifecycle,
    productUpdates: updates.productUpdates ?? pref.productUpdates,
    trainingTips: updates.trainingTips ?? pref.trainingTips,
    inactivityNudges: updates.inactivityNudges ?? pref.inactivityNudges,
  };
  const allEnabled = next.lifecycle || next.productUpdates || next.trainingTips || next.inactivityNudges;

  const saved = await emailPreference.update({
    where: { userId },
    data: {
      ...next,
      unsubscribedAt: allEnabled ? null : new Date(),
    },
  });

  return {
    lifecycle: saved.lifecycle,
    productUpdates: saved.productUpdates,
    trainingTips: saved.trainingTips,
    inactivityNudges: saved.inactivityNudges,
    unsubscribedAt: saved.unsubscribedAt,
  };
}

export async function unsubscribeByToken(token: string): Promise<boolean> {
  const pref = await emailPreference.findUnique({ where: { unsubscribeToken: token } });
  if (!pref) return false;

  await emailPreference.update({
    where: { id: pref.id },
    data: {
      lifecycle: false,
      productUpdates: false,
      trainingTips: false,
      inactivityNudges: false,
      unsubscribedAt: new Date(),
    },
  });
  return true;
}

function baseEmailHtml(options: {
  preview?: string | null;
  title: string;
  bodyHtml: string;
  ctaLabel?: string | null;
  ctaUrl?: string | null;
  unsubscribeToken: string;
}): string {
  const preview = options.preview
    ? `<div style="display:none;max-height:0;overflow:hidden;opacity:0;">${escapeHtml(options.preview)}</div>`
    : '';
  const cta =
    options.ctaLabel && options.ctaUrl
      ? `
        <table role="presentation" cellpadding="0" cellspacing="0" style="margin: 28px 0;">
          <tr>
            <td style="border-radius: 8px; background-color: #155e75;">
              <a href="${escapeHtml(options.ctaUrl)}" target="_blank" style="display: inline-block; padding: 14px 28px; color: #ffffff; text-decoration: none; font-size: 15px; font-weight: 700;">${escapeHtml(options.ctaLabel)}</a>
            </td>
          </tr>
        </table>`
      : '';

  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
</head>
<body style="margin:0;padding:0;background:#f3f0e8;font-family:Georgia,'Times New Roman',serif;">
  ${preview}
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f3f0e8;padding:36px 0;">
    <tr>
      <td align="center">
        <table role="presentation" width="620" cellpadding="0" cellspacing="0" style="width:620px;max-width:94%;background:#fffaf0;border:1px solid #ded2bd;border-radius:18px;overflow:hidden;">
          <tr>
            <td style="padding:28px 34px;background:#102a2d;color:#f8ecd0;">
              <p style="margin:0 0 8px;font-size:12px;letter-spacing:0.18em;text-transform:uppercase;color:#dfc48f;">${PRODUCT_NAME}</p>
              <h1 style="margin:0;font-size:28px;line-height:1.15;font-weight:700;">${escapeHtml(options.title)}</h1>
            </td>
          </tr>
          <tr>
            <td style="padding:34px;color:#223033;font-size:16px;line-height:1.65;">
              ${options.bodyHtml}
              ${cta}
              <hr style="border:none;border-top:1px solid #e3d6bf;margin:32px 0 20px;" />
              <p style="margin:0;color:#746b5d;font-size:12px;line-height:1.5;">
                You are receiving this because you have a ${PRODUCT_NAME} account.
                <a href="${unsubscribeLink(options.unsubscribeToken)}" style="color:#155e75;">Unsubscribe from product emails</a>.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`.trim();
}

export function lifecycleTemplate(
  type: 'welcome' | 'onboarding_7d' | 'training_tip_3d' | 'inactivity_14d',
  user: EmailUser,
) {
  const name = escapeHtml(firstName(user.name));

  if (type === 'welcome') {
    return {
      category: 'lifecycle' as EmailCategory,
      eventKey: 'welcome_v1',
      subject: 'Welcome to QualCanvas',
      title: 'Your qualitative workspace is ready',
      preview: 'A short path to your first coded insight.',
      ctaLabel: 'Open your canvas',
      ctaUrl: appLink('/canvas'),
      bodyHtml: `
        <p style="margin:0 0 18px;">Hi ${name},</p>
        <p style="margin:0 0 18px;">Welcome to ${PRODUCT_NAME}. A good first session is simple: create one canvas, upload one transcript, add 3-5 research questions, then code a few strong excerpts.</p>
        <p style="margin:0;">If you are evaluating the trial, start with a small real project rather than sample data. You will see the value faster.</p>`,
    };
  }

  if (type === 'onboarding_7d') {
    return {
      category: 'lifecycle' as EmailCategory,
      eventKey: 'onboarding_7d_v1',
      subject: 'A useful next step in QualCanvas',
      title: 'Turn early codes into a useful structure',
      preview: 'A one-week check-in with a practical coding workflow.',
      ctaLabel: 'Continue coding',
      ctaUrl: appLink('/canvas'),
      bodyHtml: `
        <p style="margin:0 0 18px;">Hi ${name},</p>
        <p style="margin:0 0 18px;">After your first few codes, the next win is structure. Group related questions, add memos for emerging interpretations, and use the canvas view to spot weak or over-broad themes.</p>
        <p style="margin:0;">If you are working with a team, invite collaborators before the coding scheme gets too fixed. It reduces rework later.</p>`,
    };
  }

  if (type === 'training_tip_3d') {
    return {
      category: 'trainingTips' as EmailCategory,
      eventKey: 'training_tip_3d_v1',
      subject: 'Try the QualCanvas training workflow',
      title: 'Make coding quality easier to review',
      preview: 'Use training documents to align coders before the main analysis.',
      ctaLabel: 'Read the guide',
      ctaUrl: appLink('/guide'),
      bodyHtml: `
        <p style="margin:0 0 18px;">Hi ${name},</p>
        <p style="margin:0 0 18px;">For student projects, team coding, or QA-heavy research, create a short training document first. A gold-standard example gives coders a clear target before they start the main dataset.</p>
        <p style="margin:0;">It is also useful for onboarding new researchers into an existing codebook.</p>`,
    };
  }

  return {
    category: 'inactivityNudges' as EmailCategory,
    eventKey: 'inactivity_14d_v1',
    subject: 'Pick up your QualCanvas project again',
    title: 'Your analysis is easiest to resume while context is fresh',
    preview: 'A quick reminder to continue your coding work.',
    ctaLabel: 'Return to QualCanvas',
    ctaUrl: appLink('/canvas'),
    bodyHtml: `
      <p style="margin:0 0 18px;">Hi ${name},</p>
      <p style="margin:0 0 18px;">You have not used ${PRODUCT_NAME} for a little while. If the project is still active, a short 15-minute session is usually enough to review memos, code one more excerpt, and keep momentum.</p>
      <p style="margin:0;">If you are blocked, start by opening the canvas and writing one memo about what feels unclear.</p>`,
  };
}

export async function sendLifecycleEmail(
  user: EmailUser,
  template: ReturnType<typeof lifecycleTemplate>,
  campaignId?: string,
): Promise<'sent' | 'skipped' | 'failed'> {
  if (!emailPreference || !emailDelivery) {
    return 'skipped';
  }

  const pref = await ensureEmailPreference(user.id);
  if (pref.unsubscribedAt || !pref[template.category]) {
    await createDeliveryIfMissing(
      user.id,
      template.eventKey,
      template.subject,
      template.category,
      campaignId,
      'skipped',
    );
    return 'skipped';
  }

  const existing = await emailDelivery.findUnique({
    where: { userId_eventKey: { userId: user.id, eventKey: template.eventKey } },
  });
  if (existing) return 'skipped';

  const delivery = await emailDelivery.create({
    data: {
      userId: user.id,
      campaignId: campaignId || null,
      type: template.category,
      eventKey: template.eventKey,
      subject: template.subject,
      status: 'pending',
      metadata: JSON.stringify({ email: user.email }),
    },
  });

  const html = baseEmailHtml({
    preview: template.preview,
    title: template.title,
    bodyHtml: template.bodyHtml,
    ctaLabel: template.ctaLabel,
    ctaUrl: template.ctaUrl,
    unsubscribeToken: pref.unsubscribeToken,
  });
  const sent = await sendEmail(user.email, template.subject, html);

  await emailDelivery.update({
    where: { id: delivery.id },
    data: sent
      ? { status: 'sent', sentAt: new Date() }
      : { status: 'failed', error: 'Email provider returned failure' },
  });

  return sent ? 'sent' : 'failed';
}

async function createDeliveryIfMissing(
  userId: string,
  eventKey: string,
  subject: string,
  type: string,
  campaignId: string | undefined,
  status: string,
) {
  const existing = await emailDelivery.findUnique({ where: { userId_eventKey: { userId, eventKey } } });
  if (existing) return existing;
  return emailDelivery.create({
    data: {
      userId,
      campaignId: campaignId || null,
      type,
      eventKey,
      subject,
      status,
    },
  });
}

export async function createEmailCampaign(input: CampaignInput) {
  const slugBase = input.title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
    .slice(0, 48);

  return emailCampaign.create({
    data: {
      slug: `${slugBase || 'campaign'}-${Date.now().toString(36)}`,
      title: input.title.trim(),
      subject: input.subject.trim(),
      previewText: input.previewText?.trim() || null,
      bodyHtml: input.bodyHtml.trim(),
      ctaLabel: input.ctaLabel?.trim() || null,
      ctaUrl: input.ctaUrl?.trim() || null,
      audience: input.audience || 'all',
    },
  });
}

export async function listEmailCampaigns() {
  return emailCampaign.findMany({
    orderBy: { createdAt: 'desc' },
    include: {
      _count: { select: { deliveries: true } },
    },
  });
}

export async function getEmailStats() {
  const [campaigns, sent, failed, skipped, unsubscribed] = await Promise.all([
    emailCampaign.count(),
    emailDelivery.count({ where: { status: 'sent' } }),
    emailDelivery.count({ where: { status: 'failed' } }),
    emailDelivery.count({ where: { status: 'skipped' } }),
    emailPreference.count({ where: { unsubscribedAt: { not: null } } }),
  ]);

  return { campaigns, sent, failed, skipped, unsubscribed };
}

export async function sendCampaign(campaignId: string): Promise<{ sent: number; skipped: number; failed: number }> {
  const campaign = await emailCampaign.findUnique({ where: { id: campaignId } });
  if (!campaign) throw new Error('Campaign not found');
  if (campaign.status === 'sent') throw new Error('Campaign has already been sent');

  const users = await selectCampaignAudience(campaign.audience);
  const result = { sent: 0, skipped: 0, failed: 0 };

  for (const user of users) {
    const template = {
      category: 'productUpdates' as EmailCategory,
      eventKey: `campaign_${campaign.id}`,
      subject: campaign.subject,
      title: campaign.title,
      preview: campaign.previewText,
      ctaLabel: campaign.ctaLabel,
      ctaUrl: campaign.ctaUrl,
      bodyHtml: campaign.bodyHtml,
    };
    const status = await sendLifecycleEmail(user, template, campaign.id);
    result[status] += 1;
  }

  await emailCampaign.update({
    where: { id: campaign.id },
    data: { status: 'sent', sentAt: new Date() },
  });

  return result;
}

async function selectCampaignAudience(audience: string): Promise<EmailUser[]> {
  const where: Record<string, unknown> = { emailVerified: true };
  if (['free', 'pro', 'team'].includes(audience)) {
    where.plan = audience;
  }

  const users: EmailUser[] = await prisma.user.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    take: LIFECYCLE_BATCH_LIMIT * 4,
    select: { id: true, email: true, name: true, plan: true, createdAt: true },
  });

  if (!audience.startsWith('inactive_')) return users.slice(0, LIFECYCLE_BATCH_LIMIT);

  const days = Number.parseInt(audience.replace('inactive_', '').replace('d', ''), 10) || 14;
  const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
  const inactive: EmailUser[] = [];

  for (const user of users) {
    const lastActivity = await prisma.auditLog.findFirst({
      where: { actorId: user.id },
      orderBy: { timestamp: 'desc' },
      select: { timestamp: true },
    });
    if (!lastActivity || lastActivity.timestamp < cutoff) inactive.push(user);
    if (inactive.length >= LIFECYCLE_BATCH_LIMIT) break;
  }

  return inactive;
}
