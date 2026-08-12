import crypto from 'crypto';
import { Prisma } from '@prisma/client';
import { prisma } from './prisma.js';
import { sendEmailWithResult } from './email.js';

// New lifecycle automations are intentionally capped per run so a bad selector
// cannot create a large accidental campaign.
export const LIFECYCLE_BATCH_LIMIT = Number.parseInt(process.env.LIFECYCLE_EMAIL_BATCH_LIMIT || '50', 10);
export const MAX_LIFECYCLE_ATTEMPTS = 3;
const RETRY_DELAY_MS = 15 * 60 * 1000;
const CLAIM_STALE_MS = 15 * 60 * 1000;

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
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const newsletterDelivery = (prisma as any).newsletterDelivery;

const DEFAULT_APP_URL = process.env.APP_URL || 'http://localhost:5174';
const DEFAULT_API_URL =
  process.env.PUBLIC_API_URL ||
  process.env.API_URL ||
  (process.env.NODE_ENV === 'production' ? 'https://api.qualcanvas.com/api' : 'http://localhost:3007/api');
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
  return `${DEFAULT_API_URL.replace(/\/$/, '')}/email/unsubscribe/${encodeURIComponent(token)}`;
}

function preferenceLink(): string {
  return appLink('/account');
}

function lifecycleRecipientAllowlist(): Set<string> {
  return new Set(
    (process.env.LIFECYCLE_EMAIL_RECIPIENT_ALLOWLIST || '')
      .split(',')
      .map((email) => email.trim().toLowerCase())
      .filter(Boolean),
  );
}

export function isLifecycleSendingEnabledFor(email: string): boolean {
  if (process.env.LIFECYCLE_EMAIL_SEND_ENABLED !== 'true') return false;
  // Resend is the preferred provider when configured. Do not release optional
  // email through it until signed delivery outcomes can be processed.
  if (process.env.RESEND_API_KEY && !process.env.RESEND_WEBHOOK_SECRET) return false;
  if (process.env.LIFECYCLE_EMAIL_ALLOW_ALL_RECIPIENTS === 'true') return true;
  return lifecycleRecipientAllowlist().has(email.trim().toLowerCase());
}

export function lifecycleReleaseGateError(): string | null {
  if (process.env.LIFECYCLE_EMAIL_SEND_ENABLED !== 'true') return 'Lifecycle email sending is disabled';
  if (process.env.RESEND_API_KEY && !process.env.RESEND_WEBHOOK_SECRET) {
    return 'Lifecycle email sending requires RESEND_WEBHOOK_SECRET when Resend is configured';
  }
  if (process.env.LIFECYCLE_EMAIL_ALLOW_ALL_RECIPIENTS !== 'true' && lifecycleRecipientAllowlist().size === 0) {
    return 'Lifecycle email sending requires an exact recipient allowlist';
  }
  return null;
}

export function isPermanentEmailFailure(error: string): boolean {
  const value = error.toLowerCase();
  if (/http\s+(400|401|403|404|405|406|409|410|413|422)/.test(value)) return true;
  return [
    'invalid recipient',
    'invalid email',
    'address rejected',
    'mailbox does not exist',
    'user unknown',
    'domain not found',
    'provider is not configured',
  ].some((marker) => value.includes(marker));
}

function randomToken(): string {
  return crypto.randomBytes(24).toString('hex');
}

export async function ensureEmailPreference(userId: string, initialOptIn = false) {
  const existing = await emailPreference.findUnique({ where: { userId } });
  if (existing) return existing;

  return emailPreference.create({
    data: {
      userId,
      unsubscribeToken: randomToken(),
      lifecycle: initialOptIn,
      productUpdates: initialOptIn,
      trainingTips: initialOptIn,
      inactivityNudges: initialOptIn,
      unsubscribedAt: initialOptIn ? null : new Date(),
    },
  });
}

export async function getEmailPreferencePayload(userId: string): Promise<EmailPreferencePayload> {
  const pref = await ensureEmailPreference(userId);
  if (pref.providerSuppressedAt) {
    return {
      lifecycle: false,
      productUpdates: false,
      trainingTips: false,
      inactivityNudges: false,
      unsubscribedAt: pref.unsubscribedAt || pref.providerSuppressedAt,
    };
  }
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
  if (pref.providerSuppressedAt) {
    return {
      lifecycle: false,
      productUpdates: false,
      trainingTips: false,
      inactivityNudges: false,
      unsubscribedAt: pref.unsubscribedAt || pref.providerSuppressedAt,
    };
  }
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
  footerHtml?: string;
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
                ${
                  options.footerHtml ||
                  `You are receiving this because you have a ${PRODUCT_NAME} account.
                <a href="${preferenceLink()}" style="color:#155e75;">Manage email preferences</a> or
                <a href="${unsubscribeLink(options.unsubscribeToken)}" style="color:#155e75;">unsubscribe from product emails</a>.`
                }
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
        <p style="margin:0;">If you are evaluating QualCanvas, start with a small real project rather than sample data so you can judge the workflow against your own research.</p>`,
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
        <p style="margin:0;">If you are working with a team, invite collaborators before finalising the coding scheme so everyone can review the same structure.</p>`,
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
      <p style="margin:0 0 18px;">You have not used ${PRODUCT_NAME} for a little while. If the project is still active, resume by reviewing your memos and coding one more excerpt.</p>
      <p style="margin:0;">If you are blocked, start by opening the canvas and writing one memo about what feels unclear.</p>`,
  };
}

export async function sendLifecycleEmail(
  user: EmailUser,
  template: ReturnType<typeof lifecycleTemplate>,
  campaignId?: string,
): Promise<'accepted' | 'skipped' | 'failed'> {
  if (!emailPreference || !emailDelivery) {
    return 'skipped';
  }

  if (!isLifecycleSendingEnabledFor(user.email)) return 'skipped';

  // Never trust a stale selector payload for identity or verification state.
  // This also prevents a caller from substituting an arbitrary recipient.
  const currentUser = await prisma.user.findUnique({
    where: { id: user.id },
    select: { id: true, email: true, emailVerified: true },
  });
  if (!currentUser?.emailVerified || currentUser.email.trim().toLowerCase() !== user.email.trim().toLowerCase()) {
    return 'skipped';
  }

  const pref = await ensureEmailPreference(user.id);
  if (pref.unsubscribedAt || pref.providerSuppressedAt || !pref[template.category]) {
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
  const delivery = await claimDeliveryOccurrence(existing, user, template, campaignId);
  if (!delivery) return 'skipped';

  const html = baseEmailHtml({
    preview: template.preview,
    title: template.title,
    bodyHtml: template.bodyHtml,
    ctaLabel: template.ctaLabel,
    ctaUrl: template.ctaUrl,
    unsubscribeToken: pref.unsubscribeToken,
  });
  const oneClickUrl = unsubscribeLink(pref.unsubscribeToken);
  const result = await sendEmailWithResult(user.email, template.subject, html, {
    headers: {
      'List-Unsubscribe': `<${oneClickUrl}>`,
      'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
    },
    tags: [
      { name: 'delivery_kind', value: 'account' },
      { name: 'delivery_id', value: delivery.id },
    ],
    idempotencyKey: `qualcanvas-lifecycle-${delivery.id}`,
  });

  if (result.accepted) {
    const acceptedAt = new Date();
    await emailDelivery.update({
      where: { id: delivery.id },
      data: {
        status: 'accepted',
        error: null,
        provider: result.provider,
        providerMessageId: result.messageId || null,
        acceptedAt,
        sentAt: acceptedAt,
        claimedAt: null,
        retryAt: null,
      },
    });
    return 'accepted';
  }

  const error = (result.error || 'Email provider returned failure').slice(0, 500);
  const permanent = isPermanentEmailFailure(error) || delivery.attemptCount >= MAX_LIFECYCLE_ATTEMPTS;
  await emailDelivery.update({
    where: { id: delivery.id },
    data: {
      status: permanent ? 'failed_permanent' : 'failed_retryable',
      error,
      provider: result.provider,
      claimedAt: null,
      retryAt: permanent ? null : new Date(Date.now() + RETRY_DELAY_MS),
    },
  });

  return 'failed';
}

async function claimDeliveryOccurrence(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  initialExisting: any,
  user: EmailUser,
  template: ReturnType<typeof lifecycleTemplate>,
  campaignId?: string,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
): Promise<any | null> {
  const now = new Date();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let existing: any = initialExisting;

  if (!existing) {
    try {
      return await emailDelivery.create({
        data: {
          userId: user.id,
          campaignId: campaignId || null,
          type: template.category,
          eventKey: template.eventKey,
          subject: template.subject,
          status: 'claimed',
          attemptCount: 1,
          claimedAt: now,
          metadata: JSON.stringify({ email: user.email.toLowerCase() }),
        },
      });
    } catch (error) {
      if (!(error instanceof Prisma.PrismaClientKnownRequestError) || error.code !== 'P2002') throw error;
      existing = await emailDelivery.findUnique({
        where: { userId_eventKey: { userId: user.id, eventKey: template.eventKey } },
      });
    }
  }

  if (!existing) return null;
  if (['sent', 'accepted', 'delivered', 'skipped', 'failed_permanent'].includes(existing.status)) return null;
  if ((existing.attemptCount || 0) >= MAX_LIFECYCLE_ATTEMPTS) return null;

  const staleBefore = new Date(now.getTime() - CLAIM_STALE_MS);
  const retryDue =
    ['failed', 'failed_retryable'].includes(existing.status) && (!existing.retryAt || existing.retryAt <= now);
  const staleClaim =
    ['pending', 'claimed'].includes(existing.status) && (!existing.claimedAt || existing.claimedAt <= staleBefore);
  if (!retryDue && !staleClaim) return null;

  const claimed = await emailDelivery.updateMany({
    where: {
      id: existing.id,
      status: existing.status,
      attemptCount: existing.attemptCount || 0,
      ...(retryDue ? { OR: [{ retryAt: null }, { retryAt: { lte: now } }] } : {}),
      ...(staleClaim ? { OR: [{ claimedAt: null }, { claimedAt: { lte: staleBefore } }] } : {}),
    },
    data: {
      status: 'claimed',
      attemptCount: { increment: 1 },
      claimedAt: now,
      retryAt: null,
      error: null,
    },
  });
  if (claimed.count !== 1) return null;
  return emailDelivery.findUnique({ where: { id: existing.id } });
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
  try {
    return await emailDelivery.create({
      data: {
        userId,
        campaignId: campaignId || null,
        type,
        eventKey,
        subject,
        status,
      },
    });
  } catch (error) {
    if (!(error instanceof Prisma.PrismaClientKnownRequestError) || error.code !== 'P2002') throw error;
    return emailDelivery.findUnique({ where: { userId_eventKey: { userId, eventKey } } });
  }
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
      _count: { select: { deliveries: true, newsletterDeliveries: true } },
    },
  });
}

export async function getEmailStats() {
  const [
    campaigns,
    accountAccepted,
    newsletterAccepted,
    accountDelivered,
    newsletterDelivered,
    accountFailed,
    newsletterFailed,
    skipped,
    accountUnsubscribed,
    newsletterUnsubscribed,
  ] = await Promise.all([
    emailCampaign.count(),
    emailDelivery.count({ where: { status: { in: ['sent', 'accepted'] } } }),
    newsletterDelivery.count({ where: { status: { in: ['sent', 'accepted'] } } }),
    emailDelivery.count({ where: { status: 'delivered' } }),
    newsletterDelivery.count({ where: { status: 'delivered' } }),
    emailDelivery.count({ where: { status: { in: ['failed', 'failed_retryable', 'failed_permanent'] } } }),
    newsletterDelivery.count({ where: { status: { in: ['failed', 'failed_retryable', 'failed_permanent'] } } }),
    emailDelivery.count({ where: { status: 'skipped' } }),
    emailPreference.count({ where: { unsubscribedAt: { not: null } } }),
    prisma.newsletterSubscriber.count({ where: { unsubscribedAt: { not: null } } }),
  ]);

  return {
    campaigns,
    accepted: accountAccepted + newsletterAccepted,
    delivered: accountDelivered + newsletterDelivered,
    failed: accountFailed + newsletterFailed,
    skipped,
    unsubscribed: accountUnsubscribed + newsletterUnsubscribed,
  };
}

export async function sendCampaign(
  campaignId: string,
): Promise<{ accepted: number; skipped: number; failed: number; remaining: number }> {
  const releaseGateError = lifecycleReleaseGateError();
  if (releaseGateError) throw new Error(releaseGateError);
  const campaign = await emailCampaign.findUnique({ where: { id: campaignId } });
  if (!campaign) throw new Error('Campaign not found');
  if (campaign.status === 'sent') throw new Error('Campaign has already been sent');

  const users = await selectCampaignAudience(campaign.id, campaign.audience, LIFECYCLE_BATCH_LIMIT);
  const result = { accepted: 0, skipped: 0, failed: 0, remaining: 0 };

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

  if (campaign.audience === 'all' || campaign.audience === 'newsletter') {
    const remainingSlots = Math.max(0, LIFECYCLE_BATCH_LIMIT - users.length);
    const registeredUsers = await prisma.user.findMany({ select: { email: true } });
    const userEmails = new Set(registeredUsers.map((user) => user.email.toLowerCase()));
    const subscribers = await prisma.newsletterSubscriber.findMany({
      where: {
        status: 'confirmed',
        unsubscribedAt: null,
        providerSuppressedAt: null,
        email: { notIn: [...userEmails] },
        ...(process.env.LIFECYCLE_EMAIL_ALLOW_ALL_RECIPIENTS === 'true'
          ? {}
          : { email: { in: Array.from(lifecycleRecipientAllowlist()), notIn: [...userEmails] } }),
        deliveries: {
          none: {
            campaignId: campaign.id,
            status: {
              in: ['sent', 'accepted', 'delivered', 'bounced', 'complained', 'suppressed', 'failed_permanent'],
            },
          },
        },
      },
      orderBy: { createdAt: 'asc' },
      take: remainingSlots,
    });
    for (const subscriber of subscribers) {
      const existing = await newsletterDelivery.findUnique({
        where: { subscriberId_campaignId: { subscriberId: subscriber.id, campaignId: campaign.id } },
      });
      const delivery =
        existing ||
        (await newsletterDelivery.create({
          data: { subscriberId: subscriber.id, campaignId: campaign.id, status: 'pending' },
        }));
      const html = baseEmailHtml({
        preview: campaign.previewText,
        title: campaign.title,
        bodyHtml: campaign.bodyHtml,
        ctaLabel: campaign.ctaLabel,
        ctaUrl: campaign.ctaUrl,
        unsubscribeToken: subscriber.unsubscribeToken,
        footerHtml: `You subscribed to the ${PRODUCT_NAME} methodology field guide.
          <a href="${DEFAULT_API_URL.replace(/\/$/, '')}/email/newsletter/unsubscribe/${encodeURIComponent(
            subscriber.unsubscribeToken,
          )}" style="color:#155e75;">Unsubscribe</a>.`,
      });
      const resultFromProvider = await sendEmailWithResult(subscriber.email, campaign.subject, html, {
        headers: {
          'List-Unsubscribe': `<${DEFAULT_API_URL.replace(/\/$/, '')}/email/newsletter/unsubscribe/${encodeURIComponent(
            subscriber.unsubscribeToken,
          )}>`,
          'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
        },
        tags: [
          { name: 'delivery_kind', value: 'newsletter' },
          { name: 'delivery_id', value: delivery.id },
        ],
        idempotencyKey: `qualcanvas-newsletter-${delivery.id}`,
      });
      await newsletterDelivery.update({
        where: { id: delivery.id },
        data: resultFromProvider.accepted
          ? {
              status: 'accepted',
              error: null,
              provider: resultFromProvider.provider,
              providerMessageId: resultFromProvider.messageId || null,
              acceptedAt: new Date(),
              sentAt: new Date(),
            }
          : {
              status: 'failed_permanent',
              provider: resultFromProvider.provider,
              error: resultFromProvider.error || 'Email provider returned failure',
            },
      });
      result[resultFromProvider.accepted ? 'accepted' : 'failed'] += 1;
    }
  }

  result.remaining = await countCampaignRemaining(campaign.id, campaign.audience);
  if (result.remaining === 0 && result.failed === 0) {
    await emailCampaign.update({
      where: { id: campaign.id },
      data: { status: 'sent', sentAt: new Date() },
    });
  }
  return result;
}

async function selectCampaignAudience(campaignId: string, audience: string, limit: number): Promise<EmailUser[]> {
  if (audience === 'newsletter') return [];
  const where: Record<string, unknown> = {
    emailVerified: true,
    ...(process.env.LIFECYCLE_EMAIL_ALLOW_ALL_RECIPIENTS === 'true'
      ? {}
      : { email: { in: Array.from(lifecycleRecipientAllowlist()) } }),
    emailDeliveries: {
      none: {
        eventKey: `campaign_${campaignId}`,
        status: { in: ['sent', 'accepted', 'delivered', 'skipped', 'failed_permanent'] },
      },
    },
  };
  if (['free', 'pro', 'team'].includes(audience)) {
    where.plan = audience;
  }

  const users: EmailUser[] = await prisma.user.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    take: audience.startsWith('inactive_') ? limit * 4 : limit,
    select: { id: true, email: true, name: true, plan: true, createdAt: true },
  });

  if (!audience.startsWith('inactive_')) return users;

  const days = Number.parseInt(audience.replace('inactive_', '').replace('d', ''), 10) || 14;
  const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
  const inactive: EmailUser[] = [];

  for (const user of users) {
    const lastActivity = await prisma.auditLog.findFirst({
      where: { actorId: user.id },
      orderBy: { timestamp: 'desc' },
      select: { timestamp: true },
    });
    if (lastActivity && lastActivity.timestamp < cutoff) inactive.push(user);
    if (inactive.length >= limit) break;
  }

  return inactive;
}

async function countCampaignRemaining(campaignId: string, audience: string): Promise<number> {
  let userCount = 0;
  if (audience !== 'newsletter') {
    const where: Record<string, unknown> = {
      emailVerified: true,
      ...(process.env.LIFECYCLE_EMAIL_ALLOW_ALL_RECIPIENTS === 'true'
        ? {}
        : { email: { in: Array.from(lifecycleRecipientAllowlist()) } }),
      emailDeliveries: {
        none: {
          eventKey: `campaign_${campaignId}`,
          status: { in: ['sent', 'accepted', 'delivered', 'skipped', 'failed_permanent'] },
        },
      },
    };
    if (['free', 'pro', 'team'].includes(audience)) where.plan = audience;
    if (audience.startsWith('inactive_')) {
      const days = Number.parseInt(audience.replace('inactive_', '').replace('d', ''), 10) || 14;
      const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
      const candidates = await prisma.user.findMany({ where, select: { id: true } });
      const activityRows =
        candidates.length > 0
          ? await prisma.auditLog.groupBy({
              by: ['actorId'],
              where: {
                actorId: { in: candidates.map((user) => user.id) },
              },
              _max: { timestamp: true },
              _count: { _all: true },
            })
          : [];
      const oldActivityIds = new Set(
        activityRows.filter((row) => row._max.timestamp && row._max.timestamp < cutoff).map((row) => row.actorId),
      );
      userCount = candidates.filter((user) => oldActivityIds.has(user.id)).length;
    } else {
      userCount = await prisma.user.count({ where });
    }
  }
  const newsletterCount =
    audience === 'all' || audience === 'newsletter'
      ? await prisma.newsletterSubscriber.count({
          where: {
            status: 'confirmed',
            unsubscribedAt: null,
            providerSuppressedAt: null,
            email: {
              ...(process.env.LIFECYCLE_EMAIL_ALLOW_ALL_RECIPIENTS === 'true'
                ? {}
                : { in: Array.from(lifecycleRecipientAllowlist()) }),
              notIn: (await prisma.user.findMany({ select: { email: true } })).map((user) => user.email.toLowerCase()),
            },
            deliveries: {
              none: {
                campaignId,
                status: {
                  in: ['sent', 'accepted', 'delivered', 'bounced', 'complained', 'suppressed', 'failed_permanent'],
                },
              },
            },
          },
        })
      : 0;
  return userCount + newsletterCount;
}
