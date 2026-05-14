import { useEffect, useState } from 'react';
import { usePageMeta } from '../hooks/usePageMeta';
import { trackEvent } from '../utils/analytics';
import PageShell from '../components/marketing/PageShell';
import Eyebrow from '../components/marketing/Eyebrow';
import DisplayHeading from '../components/marketing/DisplayHeading';
import HairlineRule from '../components/marketing/HairlineRule';

type Format = 'bibtex' | 'apa' | 'chicago' | 'ris';

const FORMATS: Array<{ id: Format; label: string }> = [
  { id: 'bibtex', label: 'BibTeX' },
  { id: 'apa', label: 'APA' },
  { id: 'chicago', label: 'Chicago' },
  { id: 'ris', label: 'RIS' },
];

const CITATIONS: Record<Format, string> = {
  bibtex: `@software{qualcanvas2026,
  title = {QualCanvas: A Visual Workspace for Qualitative Coding},
  author = {{JMS Dev Lab}},
  year = {2026},
  version = {1.0},
  url = {https://qualcanvas.com},
  organization = {JMS Dev Lab},
  note = {Computer software}
}`,
  apa: `JMS Dev Lab. (2026). QualCanvas: A visual workspace for qualitative coding (Version 1.0) [Computer software]. https://qualcanvas.com`,
  chicago: `JMS Dev Lab. 2026. QualCanvas: A Visual Workspace for Qualitative Coding (version 1.0). Computer software. https://qualcanvas.com.`,
  ris: `TY  - COMP
TI  - QualCanvas: A Visual Workspace for Qualitative Coding
AU  - JMS Dev Lab
PY  - 2026
PB  - JMS Dev Lab
UR  - https://qualcanvas.com
ER  -`,
};

/**
 * /cite — citation reference page per docs/refresh/06-pages/13-cite.md.
 *
 * Maya can send this URL to her advisor. No competitor (NVivo, ATLAS.ti,
 * MAXQDA, Dedoose, Delve) has an equivalent — see docs/refresh/01 §1.3
 * moat #5.
 *
 * Static content, no backend. Copy-to-clipboard via the Clipboard API.
 * The "Copied." confirmation lives 1.5s then reverts.
 */
export default function CitePage() {
  const [active, setActive] = useState<Format>('bibtex');
  const [copiedFormat, setCopiedFormat] = useState<Format | null>(null);

  usePageMeta(
    'How to cite QualCanvas — Citation reference',
    'BibTeX, APA, Chicago, and RIS citation entries for QualCanvas. Send to your advisor before they ask.',
  );

  useEffect(() => {
    trackEvent('marketing_page_viewed', { page: '/cite' });
  }, []);

  const handleCopy = async () => {
    const text = CITATIONS[active];
    try {
      await navigator.clipboard.writeText(text);
      setCopiedFormat(active);
      trackEvent('citation_copied', { format: active });
      window.setTimeout(() => setCopiedFormat((f) => (f === active ? null : f)), 1500);
    } catch {
      // Clipboard API can fail on insecure contexts or older browsers; fall
      // back to a manual selection prompt would be excessive at this scale.
      // Users can still triple-click to select all and ctrl-c.
    }
  };

  return (
    <PageShell>
      <div className="max-w-3xl mx-auto px-4 sm:px-6 pt-16 pb-24">
        <HairlineRule className="mb-6" />
        <Eyebrow className="mb-3">Citation</Eyebrow>
        <DisplayHeading as="h1" size="md" className="mb-5">
          How to cite QualCanvas.
        </DisplayHeading>
        <p className="text-lg text-gray-600 dark:text-gray-300 leading-relaxed mb-10 max-w-2xl">
          Pick a format. Copy. Paste into your manuscript. If QualCanvas is part of your method, please cite us — it
          helps grad students and methodologists find each other through the literature.
        </p>

        {/* Tabs */}
        <div
          role="tablist"
          aria-label="Citation format"
          className="flex flex-wrap gap-1 border-b border-gray-200 dark:border-gray-700"
        >
          {FORMATS.map((f) => (
            <button
              key={f.id}
              role="tab"
              aria-selected={active === f.id}
              aria-controls={`citation-${f.id}`}
              id={`tab-${f.id}`}
              onClick={() => setActive(f.id)}
              className={`
                px-4 py-2.5 text-sm font-medium
                border-b-2 -mb-px
                transition-colors duration-150
                focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ochre-400 focus-visible:ring-offset-2
                ${
                  active === f.id
                    ? 'border-ochre-500 text-gray-900 dark:text-white'
                    : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:border-gray-300 dark:hover:border-gray-600'
                }
              `}
            >
              {f.label}
            </button>
          ))}
        </div>

        {/* Content */}
        <div
          role="tabpanel"
          id={`citation-${active}`}
          aria-labelledby={`tab-${active}`}
          className="mt-6 rounded-xl bg-gray-50 dark:bg-gray-800/60 ring-1 ring-gray-200 dark:ring-gray-700 overflow-hidden"
        >
          <div className="flex items-center justify-between px-4 py-2 bg-gray-100 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
            <span className="text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400">
              {FORMATS.find((f) => f.id === active)?.label}
            </span>
            <button
              onClick={handleCopy}
              className="
                text-xs font-medium
                text-ochre-700 dark:text-ochre-400
                hover:underline underline-offset-4 decoration-ochre-500
                focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ochre-400 focus-visible:ring-offset-2
                rounded px-2 py-1
              "
            >
              {copiedFormat === active ? 'Copied.' : 'Copy'}
            </button>
          </div>
          <pre className="px-4 py-4 text-sm font-mono text-gray-800 dark:text-gray-200 whitespace-pre-wrap break-words overflow-x-auto">
            {CITATIONS[active]}
          </pre>
        </div>

        <p className="mt-8 text-sm text-gray-500 dark:text-gray-400 leading-relaxed">
          Citing a specific feature (e.g. the intercoder reliability calculator)? Reference the methodology chapter that
          covers it at{' '}
          <a
            className="underline decoration-ochre-500 underline-offset-2 hover:text-gray-900 dark:hover:text-white"
            href="/methodology"
          >
            qualcanvas.com/methodology
          </a>
          . Need to cite a version we shipped two months ago? Email{' '}
          <a
            className="underline decoration-ochre-500 underline-offset-2 hover:text-gray-900 dark:hover:text-white"
            href="mailto:cite@qualcanvas.com"
          >
            cite@qualcanvas.com
          </a>{' '}
          and we'll send the right version string.
        </p>
      </div>
    </PageShell>
  );
}
