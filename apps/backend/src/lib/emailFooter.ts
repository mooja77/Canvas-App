export type EmailFooterKind = 'service' | 'optional';

export interface EmailFooterOptions {
  kind: EmailFooterKind;
  campaign: string;
}

const OTHER_JMS_APPS = [
  'JewelryStudioManager',
  'StaffHub',
  'SpamShield',
  'ThemeSweep',
  'Lustriel',
  'Jewel Value',
  'SmartCash',
  'Rian Books',
  'GemReach',
  'TaxMatch',
  'Pitch Side',
  'RepairDesk',
  'ProfitShield',
  'GrowthMap',
] as const;

function catalogueUrl(_campaign: string): string {
  const params = new URLSearchParams({
    utm_source: 'qualcanvas',
    utm_medium: 'email',
    utm_campaign: 'cross-app-footer',
    utm_content: 'all-apps',
  });
  return `https://jmsdevlab.com/apps?${params.toString()}`;
}

function footerHtml(options: EmailFooterOptions): string {
  const url = catalogueUrl(options.campaign);
  const discovery =
    options.kind === 'optional'
      ? `<section aria-labelledby="jms-recommendations" style="margin-top:10px;"><p id="jms-recommendations" style="margin:0 0 4px;"><strong>More useful tools from JMS Dev Lab</strong></p><ul><li><strong>JMS Dev Lab custom software:</strong> tailor a research workflow when an off-the-shelf app does not fit.</li></ul></section><nav aria-label="Other JMS Dev Lab apps" style="margin-top:10px;">
          <p style="margin:0 0 4px;color:#64748b;font-size:12px;">Other current JMS apps</p>
          <ul style="margin:0;padding:0;list-style:none;color:#64748b;font-size:12px;line-height:1.5;">
            ${OTHER_JMS_APPS.map((name) => `<li style="display:inline;">${name}</li>`).join('<li aria-hidden="true" style="display:inline;"> · </li>')}
          </ul>
        </nav>`
      : '';

  return `<footer data-jms-email-footer="${options.kind}" style="margin-top:28px;padding-top:18px;border-top:1px solid #e2e8f0;color:#475569;font-family:Arial,sans-serif;font-size:16px;line-height:1.5;">
    <p style="margin:0;">QualCanvas is built by <strong>JMS Dev Lab</strong>. <a href="${url}" style="color:#475569;">View the current JMS app catalogue</a>.</p>
    ${discovery}
  </footer>`;
}

function footerText(options: EmailFooterOptions): string {
  const lines = ['QualCanvas is built by JMS Dev Lab.', `Current JMS app catalogue: ${catalogueUrl(options.campaign)}`];
  if (options.kind === 'optional')
    lines.push(
      'More useful tools from JMS Dev Lab:',
      '- JMS Dev Lab custom software: tailor a research workflow when an off-the-shelf app does not fit.',
      `Other current JMS apps: ${OTHER_JMS_APPS.join(', ')}`,
    );
  return lines.join('\n');
}

function htmlToText(html: string): string {
  return html
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<a\b[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi, '$2 ($1)')
    .replace(/<\/?(?:p|div|h[1-6]|tr|table|ul|ol|footer|nav)\b[^>]*>/gi, '\n')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<li\b[^>]*>/gi, '\n- ')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;/g, "'")
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

export function renderEmailWithJmsFooter(
  html: string,
  options: EmailFooterOptions = { kind: 'service', campaign: 'service' },
): { html: string; text: string } {
  const renderedFooter = footerHtml(options);
  const renderedHtml = /<\/body>/i.test(html)
    ? html.replace(/<\/body>/i, `${renderedFooter}</body>`)
    : `${html}${renderedFooter}`;
  return { html: renderedHtml, text: `${htmlToText(html)}\n\n${footerText(options)}`.trim() };
}

export { OTHER_JMS_APPS };
