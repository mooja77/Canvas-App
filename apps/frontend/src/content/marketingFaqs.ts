import { PUBLISHED_PRICES_USD, annualPricePerMonth } from '@qualcanvas/shared';

/**
 * FAQ copy for the landing and pricing pages.
 *
 * One source for two outputs: the visible <FAQ> on each page and the
 * FAQPage JSON-LD that scripts/prerender-marketing.mjs writes into the
 * prerendered HTML. Keeping them in one place stops the structured data from
 * drifting away from what a visitor can read (Google's rule for FAQ markup).
 *
 * Answers are plain strings. `[label](/path)` marks a link: the page renders it
 * as a link, and the JSON-LD keeps only the label text.
 *
 * Every price comes from PUBLISHED_PRICES_USD (shared/types/pricing.ts), which
 * matches the live Stripe prices checkout charges. The 14-day trial matches
 * TRIAL_LENGTH_DAYS in apps/backend/src/routes/userAuthRoutes.ts, and the trial
 * only applies once the email address is verified (middleware/auth.ts).
 */
export interface MarketingFaq {
  question: string;
  answer: string;
}

const P = PUBLISHED_PRICES_USD;

export const PRICES_SENTENCE =
  `The Free plan costs $0 and has no time limit. ` +
  `Student is $${P.student.monthly} a month or $${P.student.annual} a year, with a verified academic email. ` +
  `Pro is $${P.pro.monthly} a month or $${P.pro.annual} a year. ` +
  `Team is $${P.team.monthly} per seat a month or $${P.team.annual} per seat a year. ` +
  `Prices are in US dollars.`;

export const TRIAL_FAQ: MarketingFaq = {
  question: 'Is there a free trial?',
  answer:
    'Yes. New accounts get Pro features for 14 days once the email address is verified. No card is needed. ' +
    'When the trial ends, the account moves to the Free plan unless you choose a paid plan. Nothing you made is deleted.',
};

export const LANDING_FAQS: MarketingFaq[] = [
  {
    question: 'What is QualCanvas?',
    answer:
      'QualCanvas is qualitative coding software that runs in your web browser. You import interview transcripts, ' +
      'highlight passages, tag them with codes and arrange the codes into themes on a visual canvas. ' +
      'It is an alternative to desktop tools such as NVivo and ATLAS.ti.',
  },
  {
    question: 'Who is QualCanvas for?',
    answer:
      'Graduate students working on a thesis or paper, academics, research labs running multi-coder studies, ' +
      'and UX teams running interview research.',
  },
  {
    question: 'How much does QualCanvas cost?',
    answer:
      `${PRICES_SENTENCE} Faculty and staff get 40% off Pro and Team with a verified academic email. ` +
      `Every plan is listed on the [pricing page](/pricing).`,
  },
  TRIAL_FAQ,
  {
    question: 'What is qualitative coding?',
    answer:
      'A research method where you label segments of qualitative data, such as interview transcripts, field notes ' +
      'or open-ended survey responses, to identify themes and build theory. It is the foundation of methods like ' +
      'thematic analysis, grounded theory and IPA.',
  },
  {
    question: 'How is this different from NVivo or ATLAS.ti?',
    answer:
      'Our prices are published on this site. Your codes, transcripts and themes sit on one visual canvas instead of ' +
      'behind menus. You can export to QDPX, the exchange format NVivo and ATLAS.ti read, whenever you want. ' +
      'See the sourced, side-by-side breakdown on [our comparisons page](/vs).',
  },
  {
    question: 'Is my research data secure? Are you training a model on my transcripts?',
    answer:
      'QualCanvas uses HTTPS in transit and provider-managed encryption at rest. The production database is ' +
      'currently hosted in the US; an EU-resident database is not available. AI actions are opt-in and provider ' +
      'terms apply. The full posture is on [/trust](/trust) and the AI-specific policy is on [/trust/ai](/trust/ai).',
  },
  {
    question: 'How do I cite QualCanvas in a paper?',
    answer: 'BibTeX, APA and Chicago entries are on [/cite](/cite).',
  },
];

export const PRICING_FAQS: MarketingFaq[] = [
  {
    question: 'How much does each plan cost?',
    answer:
      `${PRICES_SENTENCE} Paying yearly works out at $${annualPricePerMonth('student')}, ` +
      `$${annualPricePerMonth('pro')} and $${annualPricePerMonth('team')} a month for Student, Pro and Team.`,
  },
  TRIAL_FAQ,
  {
    question: 'What payment methods do you accept?',
    answer:
      'Online subscriptions use major credit cards through Stripe. Contact the research desk to discuss ' +
      'institutional procurement requirements before relying on another payment method.',
  },
  {
    question: 'Can I cancel anytime?',
    answer:
      'Yes. Cancel from your Account page. You keep Pro/Team access until the end of the billing period. No retention friction.',
  },
  {
    question: 'How does the academic discount work?',
    answer:
      `Students get the dedicated Student plan at $${P.student.monthly} a month with a verified institution email. ` +
      'Faculty and staff on Pro or Team get 40% off automatically at checkout with a recognized academic email. ' +
      'Eligibility is based on the verified institution address; contact support if your institution uses an ' +
      'unrecognized domain.',
  },
  {
    question: 'How do seats work?',
    answer:
      'Pro is for one person: you code, and you can invite as many read-only viewers as you like for free. ' +
      `Team is priced per seat ($${P.team.monthly} per seat a month, or $${P.team.annual} per seat a year): you hold ` +
      'one seat, and each person who codes with you, on your canvases or in your teams, holds one more; a person ' +
      'counts once. Viewers are free on Team too. If you are on Pro and invite a coder, QualCanvas offers the upgrade ' +
      'to Team and shows what it costs today and at renewal; nothing is charged until you confirm, or you can add ' +
      'them as a viewer instead. On Team, inviting a coder shows the prorated charge for the rest of the billing ' +
      'period and asks you to confirm it first. Removing a coder, or making them a viewer, frees the seat straight ' +
      'away and credits the unused time to your next bill.',
  },
  {
    question: 'What happens to my data if I downgrade?',
    answer:
      "Your data is preserved. You can't create new resources beyond the Free-plan limits until you re-upgrade, but nothing is deleted.",
  },
  {
    question: 'Do you offer institutional licensing?',
    answer:
      'We discuss volume access, onboarding and procurement with institutions. QualCanvas does not currently ' +
      'provide SAML/OIDC SSO, SCIM, a HIPAA BAA, custom automatic retention or EU data residency. Review the ' +
      '[institutions page](/for-institutions) before treating any of those requirements as available.',
  },
];

const LINK_RE = /\[([^\]]+)\]\(([^)\s]+)\)/g;

/** The answer as plain text: `[label](href)` becomes `label`. */
export function faqPlainText(answer: string): string {
  return answer.replace(LINK_RE, '$1');
}

/** Split an answer into text and link parts for rendering. */
export function faqParts(answer: string): Array<{ text: string; href?: string }> {
  const parts: Array<{ text: string; href?: string }> = [];
  let last = 0;
  for (const m of answer.matchAll(LINK_RE)) {
    if (m.index! > last) parts.push({ text: answer.slice(last, m.index) });
    parts.push({ text: m[1], href: m[2] });
    last = m.index! + m[0].length;
  }
  if (last < answer.length) parts.push({ text: answer.slice(last) });
  return parts;
}

/** schema.org FAQPage for a list of FAQs, matching the visible text. */
export function faqPageJsonLd(faqs: MarketingFaq[], url: string) {
  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    '@id': `${url}#faq`,
    mainEntity: faqs.map((f) => ({
      '@type': 'Question',
      name: f.question,
      acceptedAnswer: { '@type': 'Answer', text: faqPlainText(f.answer) },
    })),
  };
}
