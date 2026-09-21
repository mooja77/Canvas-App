import { describe, expect, it } from 'vitest';
import { OTHER_JMS_APPS, renderEmailWithJmsFooter } from './emailFooter.js';

describe('JMS Dev Lab email footer contract', () => {
  it('renders neutral attribution with tracked catalogue links in HTML and text', () => {
    const result = renderEmailWithJmsFooter('<p>Reset your password.</p>', {
      kind: 'service',
      campaign: 'password-reset',
    });

    expect(result.html).toContain('data-jms-email-footer="service"');
    expect(result.html).toContain('JMS Dev Lab');
    expect(result.html).not.toContain('Other current JMS apps');
    expect(result.text).toContain('JMS Dev Lab');
    expect(result.text).not.toContain('Other current JMS apps');
    for (const value of [
      'utm_source=qualcanvas',
      'utm_medium=email',
      'utm_campaign=cross-app-footer',
      'utm_content=all-apps',
    ]) {
      expect(result.html).toContain(value);
      expect(result.text).toContain(value);
    }
  });

  it('adds the accessible other-app discovery list only to optional mail', () => {
    const result = renderEmailWithJmsFooter('<p>Here is your next research tip.</p>', {
      kind: 'optional',
      campaign: 'training-tip',
    });

    expect(result.html).toContain('data-jms-email-footer="optional"');
    expect(result.html).toContain('aria-label="Other JMS Dev Lab apps"');
    expect(result.html.match(/<li><strong>[^<]+:<\/strong>/g)).toHaveLength(1);
    expect(result.html).toContain('<strong>JMS Dev Lab custom software:</strong>');
    expect(result.html).not.toContain('<strong>GrowthMap:</strong>');
    expect(result.text).toContain('Other current JMS apps:');
    expect(OTHER_JMS_APPS).not.toContain('QualCanvas');
    for (const app of OTHER_JMS_APPS) {
      expect(result.html).toContain(app);
      expect(result.text).toContain(app);
    }
    expect(result.html).not.toMatch(/<img\b/i);
  });

  it('keeps existing unsubscribe controls intact', () => {
    const html = '<p>News</p><a href="https://api.qualcanvas.com/unsubscribe/token">Unsubscribe</a>';
    const result = renderEmailWithJmsFooter(html, { kind: 'optional', campaign: 'newsletter' });
    expect(result.html).toContain('https://api.qualcanvas.com/unsubscribe/token');
    expect(result.text).toContain('https://api.qualcanvas.com/unsubscribe/token');
  });
});
