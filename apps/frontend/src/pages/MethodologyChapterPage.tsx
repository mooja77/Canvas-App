import { useEffect } from 'react';
import { useParams, Navigate } from 'react-router-dom';
import { usePageMeta } from '../hooks/usePageMeta';
import { trackEvent } from '../utils/analytics';
import PageShell from '../components/marketing/PageShell';
import ChapterShell, { type ChapterNav } from '../components/marketing/ChapterShell';

import FoundationsChapter, {
  chapterMeta as foundationsMeta,
  sections as foundationsSections,
} from '../content/methodology/foundations';
import ThematicAnalysisChapter, {
  chapterMeta as taMeta,
  sections as taSections,
} from '../content/methodology/thematic-analysis';
import GroundedTheoryChapter, {
  chapterMeta as gtMeta,
  sections as gtSections,
} from '../content/methodology/grounded-theory';
import IpaChapter, { chapterMeta as ipaMeta, sections as ipaSections } from '../content/methodology/ipa';
import IntercoderReliabilityChapter, {
  chapterMeta as icrMeta,
  sections as icrSections,
} from '../content/methodology/intercoder-reliability';
import EthicsInPracticeChapter, {
  chapterMeta as ethicsMeta,
  sections as ethicsSections,
} from '../content/methodology/ethics-in-practice';

interface ChapterEntry {
  slug: string;
  meta: { number: string; title: string; subtitle?: string; readMin: number; updated: string };
  sections: { id: string; label: string }[];
  Component: () => JSX.Element;
}

/**
 * Ordered list of published chapters in canonical 1-through-6 order. With all
 * six chapters now drafted, prev/next nav follows the natural reading sequence.
 */
const CHAPTERS: ChapterEntry[] = [
  {
    slug: 'foundations',
    meta: foundationsMeta,
    sections: foundationsSections,
    Component: FoundationsChapter,
  },
  {
    slug: 'thematic-analysis',
    meta: taMeta,
    sections: taSections,
    Component: ThematicAnalysisChapter,
  },
  {
    slug: 'grounded-theory',
    meta: gtMeta,
    sections: gtSections,
    Component: GroundedTheoryChapter,
  },
  {
    slug: 'ipa',
    meta: ipaMeta,
    sections: ipaSections,
    Component: IpaChapter,
  },
  {
    slug: 'intercoder-reliability',
    meta: icrMeta,
    sections: icrSections,
    Component: IntercoderReliabilityChapter,
  },
  {
    slug: 'ethics-in-practice',
    meta: ethicsMeta,
    sections: ethicsSections,
    Component: EthicsInPracticeChapter,
  },
];

export default function MethodologyChapterPage() {
  const { slug } = useParams<{ slug: string }>();
  const idx = CHAPTERS.findIndex((c) => c.slug === slug);
  const chapter = idx === -1 ? null : CHAPTERS[idx];

  usePageMeta(
    chapter ? `${chapter.meta.title} — Doing qualitative research with QualCanvas` : 'Methodology — QualCanvas',
    chapter?.meta.subtitle ?? 'A short field guide to qualitative research with QualCanvas.',
  );

  useEffect(() => {
    if (chapter) {
      trackEvent('marketing_page_viewed', { page: `/methodology/${chapter.slug}` });
    }
  }, [chapter]);

  if (!chapter) return <Navigate to="/methodology" replace />;

  const prev: ChapterNav | null =
    idx > 0 ? { slug: CHAPTERS[idx - 1].slug, title: CHAPTERS[idx - 1].meta.title } : null;
  const next: ChapterNav | null =
    idx < CHAPTERS.length - 1 ? { slug: CHAPTERS[idx + 1].slug, title: CHAPTERS[idx + 1].meta.title } : null;

  const ChapterBody = chapter.Component;

  return (
    <PageShell>
      <ChapterShell
        number={chapter.meta.number}
        title={chapter.meta.title}
        subtitle={chapter.meta.subtitle}
        readMin={chapter.meta.readMin}
        updated={chapter.meta.updated}
        sections={chapter.sections}
        prev={prev}
        next={next}
      >
        <ChapterBody />
      </ChapterShell>
    </PageShell>
  );
}
