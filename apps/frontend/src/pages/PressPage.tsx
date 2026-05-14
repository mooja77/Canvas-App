import { useEffect } from 'react';
import { usePageMeta } from '../hooks/usePageMeta';
import { trackEvent } from '../utils/analytics';
import PageShell from '../components/marketing/PageShell';
import Eyebrow from '../components/marketing/Eyebrow';
import DisplayHeading from '../components/marketing/DisplayHeading';
import HairlineRule from '../components/marketing/HairlineRule';

/**
 * /press — press / media kit page per docs/refresh/06-pages/18-press-kit.md.
 *
 * Used by journalists, library guides, and conference programs. Single page,
 * no chrome, no FAQ. Asset cards in a 3-up grid with download buttons.
 *
 * Brand asset zip lives at /public/press/qualcanvas-brand-kit.zip (will be
 * built and placed there as part of the press-kit content task; for now,
 * the link is graceful with a 404 placeholder).
 */
export default function PressPage() {
  usePageMeta(
    'Press & media — QualCanvas',
    'Press kit, fact sheet, brand assets, and contact for journalists and library guides covering QualCanvas.',
  );

  useEffect(() => {
    trackEvent('marketing_page_viewed', { page: '/press' });
  }, []);

  return (
    <PageShell>
      <div className="max-w-4xl mx-auto px-4 sm:px-6 pt-16 pb-24">
        <HairlineRule className="mb-6" />
        <Eyebrow className="mb-3">Press</Eyebrow>
        <DisplayHeading as="h1" size="md" className="mb-6">
          Press &amp; media.
        </DisplayHeading>
        <p className="text-lg text-gray-600 dark:text-gray-300 leading-relaxed max-w-2xl">
          QualCanvas is a visual workspace for qualitative coding — a serious tool for researchers who want to think on
          a canvas instead of a spreadsheet, and who care that their method is defensible.
        </p>

        {/* About */}
        <section className="mt-16">
          <h2
            className="font-display text-2xl mb-4 text-gray-900 dark:text-white"
            style={{ fontVariationSettings: "'opsz' 48, 'wght' 580" }}
          >
            About
          </h2>
          <div className="space-y-4 text-gray-700 dark:text-gray-300 leading-relaxed">
            <p>
              QualCanvas is qualitative-data-analysis software for researchers coding interview transcripts, field
              notes, and other text data. Where established tools like NVivo and ATLAS.ti hide your codebook behind
              menus, QualCanvas puts transcripts, codes, memos, and analyses on a visual canvas you can see all at once.
            </p>
            <p>
              QualCanvas was built by{' '}
              <a
                className="underline decoration-ochre-500 underline-offset-2 hover:text-gray-900 dark:hover:text-white"
                href="https://www.jmsdevlab.com/apps.html#qualcanvas"
                target="_blank"
                rel="noopener noreferrer"
              >
                JMS Dev Lab
              </a>
              , a small Ireland-based software studio. The product launched in 2024 and ships continuous updates with a
              public changelog at <span className="font-mono text-sm">/changelog</span>.
            </p>
          </div>
        </section>

        {/* Fact sheet */}
        <section className="mt-16">
          <h2
            className="font-display text-2xl mb-4 text-gray-900 dark:text-white"
            style={{ fontVariationSettings: "'opsz' 48, 'wght' 580" }}
          >
            Fact sheet
          </h2>
          <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-4 text-sm">
            <FactRow term="Launched" value="2024" />
            <FactRow term="Headquarters" value="Ireland (EU)" />
            <FactRow term="Free tier" value="Yes (1 canvas, 5 codes)" />
            <FactRow term="Paid tiers" value="Pro $12/mo · Team $29/seat/mo · Institutions custom" />
            <FactRow term="Academic discount" value="40% off Pro and Team with a .edu email" />
            <FactRow term="Integrations" value="QDPX import/export (NVivo, ATLAS.ti); CSV; PNG; HTML; Markdown" />
            <FactRow term="UI languages" value="English, Spanish, French, German" />
            <FactRow term="Data hosting" value="US East (Railway) + Cloudflare R2; EU residency in roadmap" />
          </dl>
        </section>

        {/* Brand assets */}
        <section className="mt-16">
          <h2
            className="font-display text-2xl mb-4 text-gray-900 dark:text-white"
            style={{ fontVariationSettings: "'opsz' 48, 'wght' 580" }}
          >
            Brand assets
          </h2>
          <p className="text-gray-700 dark:text-gray-300 leading-relaxed mb-6">
            Logos, wordmark, color values, screenshots. Use them with our blessing for editorial coverage of QualCanvas.
            Please don't modify the marks or place them on backgrounds that compromise contrast.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <AssetCard
              title="Brand kit (.zip)"
              description="Logo SVG light + dark, wordmark, color values, screenshot set"
              href="/press/qualcanvas-brand-kit.zip"
            />
            <AssetCard
              title="Hero screenshot"
              description="1200×630 PNG, ready for OG and social-card use"
              href="/og-image.png"
            />
            <AssetCard
              title="Brand do / don't"
              description="One-page reference on using the marks correctly"
              href="/press/brand-do-dont.pdf"
            />
          </div>
        </section>

        {/* Quotes for citation */}
        <section className="mt-16">
          <h2
            className="font-display text-2xl mb-4 text-gray-900 dark:text-white"
            style={{ fontVariationSettings: "'opsz' 48, 'wght' 580" }}
          >
            Quotes for citation
          </h2>
          <div className="space-y-6">
            <figure>
              <blockquote
                className="text-base italic font-display border-l-2 border-ochre-500 pl-4 text-gray-900 dark:text-white"
                style={{ fontVariationSettings: "'wght' 500" }}
              >
                "QualCanvas is built on a simple idea: qualitative coding is interpretive work, and the software should
                help you see your interpretation, not hide it behind menus."
              </blockquote>
              <figcaption className="mt-2 text-sm text-gray-600 dark:text-gray-400">
                — JMS Dev Lab founder, on the product's design philosophy
              </figcaption>
            </figure>
          </div>
        </section>

        {/* Contact */}
        <section className="mt-16 pt-8 border-t border-gray-200 dark:border-gray-800">
          <h2
            className="font-display text-2xl mb-4 text-gray-900 dark:text-white"
            style={{ fontVariationSettings: "'opsz' 48, 'wght' 580" }}
          >
            Contact
          </h2>
          <p className="text-gray-700 dark:text-gray-300">
            Press inquiries:{' '}
            <a
              className="underline decoration-ochre-500 underline-offset-2 hover:text-gray-900 dark:hover:text-white"
              href="mailto:press@qualcanvas.com"
            >
              press@qualcanvas.com
            </a>
          </p>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-2">
            We answer within two business days. Faster for time-sensitive publication windows.
          </p>
        </section>
      </div>
    </PageShell>
  );
}

function FactRow({ term, value }: { term: string; value: string }) {
  return (
    <div>
      <dt className="text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-1">{term}</dt>
      <dd className="text-gray-900 dark:text-white">{value}</dd>
    </div>
  );
}

function AssetCard({ title, description, href }: { title: string; description: string; href: string }) {
  return (
    <a
      href={href}
      className="
        block rounded-xl p-5
        bg-white dark:bg-gray-800/60
        ring-1 ring-gray-200 dark:ring-gray-700
        hover:-translate-y-0.5 hover:shadow-lg hover:ring-gray-300 dark:hover:ring-gray-600
        transition-all duration-150
        focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ochre-400 focus-visible:ring-offset-2
      "
    >
      <div className="text-sm font-semibold text-gray-900 dark:text-white mb-1">{title}</div>
      <div className="text-xs text-gray-600 dark:text-gray-400 mb-3">{description}</div>
      <div className="text-xs font-medium text-ochre-700 dark:text-ochre-400">Download →</div>
    </a>
  );
}
