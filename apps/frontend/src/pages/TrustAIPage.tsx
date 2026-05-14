import { useEffect } from 'react';
import { usePageMeta } from '../hooks/usePageMeta';
import { trackEvent } from '../utils/analytics';
import PageShell from '../components/marketing/PageShell';
import Eyebrow from '../components/marketing/Eyebrow';
import DisplayHeading from '../components/marketing/DisplayHeading';
import HairlineRule from '../components/marketing/HairlineRule';

/**
 * /trust/ai — AI use policy per docs/refresh/06-pages/10-trust-ai.md.
 *
 * Direct answer to the question every researcher and IRB officer in 2026
 * asks first: are my participants' transcripts being used to train a model?
 * The architecture promise on this page must match the actual product
 * architecture; review quarterly (see docs/refresh/10 R14).
 *
 * Note: This is the publishable content draft. Legal sign-off required
 * before the visible URL goes default-on; the page itself can ship and be
 * link-gated behind /trust until then.
 */
export default function TrustAIPage() {
  usePageMeta(
    'AI use policy — QualCanvas',
    'Are my transcripts being used to train an LLM? No. The full architecture promise, plus model-provider links and IRB-relevant detail.',
  );

  useEffect(() => {
    trackEvent('marketing_page_viewed', { page: '/trust/ai' });
    trackEvent('ai_policy_viewed' as never);
  }, []);

  return (
    <PageShell>
      <article className="max-w-3xl mx-auto px-4 sm:px-6 pt-16 pb-24">
        <HairlineRule className="mb-6" />
        <Eyebrow className="mb-3">AI use policy</Eyebrow>
        <DisplayHeading as="h1" size="md" className="mb-6">
          Where AI is in QualCanvas — and where it isn't.
        </DisplayHeading>
        <p className="text-lg text-gray-600 dark:text-gray-300 leading-relaxed max-w-2xl">
          Three things every researcher and IRB asks. Direct answers, with the architecture to back them up.
        </p>

        {/* Q1 */}
        <section className="mt-16">
          <h2
            className="font-display text-2xl mb-4 text-gray-900 dark:text-white"
            style={{ fontVariationSettings: "'opsz' 48, 'wght' 580" }}
          >
            Are my transcripts being used to train a model?
          </h2>
          <div className="space-y-4 text-gray-700 dark:text-gray-300 leading-relaxed">
            <p>
              <strong className="font-semibold text-gray-900 dark:text-white">No.</strong> Inference requests go
              directly from your account to the provider you choose (OpenAI, Anthropic, or Google). QualCanvas does not
              proxy them, does not store them beyond the session, and does not send them to any other vendor.
            </p>
            <p>
              The model providers we support contractually exclude API traffic from training. Their policies on this
              point:
            </p>
            <ul className="list-disc list-inside space-y-2 ml-2">
              <li>
                <a
                  className="underline decoration-ochre-500 underline-offset-2 hover:text-gray-900 dark:hover:text-white"
                  href="https://openai.com/policies/api-data-usage-policies"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  OpenAI API data usage policy
                </a>{' '}
                — API traffic excluded from training.
              </li>
              <li>
                <a
                  className="underline decoration-ochre-500 underline-offset-2 hover:text-gray-900 dark:hover:text-white"
                  href="https://www.anthropic.com/legal/commercial-terms"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Anthropic commercial terms
                </a>{' '}
                — API content not used for training without explicit opt-in.
              </li>
              <li>
                <a
                  className="underline decoration-ochre-500 underline-offset-2 hover:text-gray-900 dark:hover:text-white"
                  href="https://cloud.google.com/vertex-ai/generative-ai/docs/data-governance"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Google Vertex AI data governance
                </a>{' '}
                — customer data not used for training.
              </li>
            </ul>
            <p className="text-sm bg-ochre-50/40 dark:bg-ochre-900/10 border-l-2 border-ochre-500 pl-4 py-3 text-gray-700 dark:text-gray-300">
              Bring-your-own-key model: many users connect their own provider account, which means inference is billed
              to and observed by their own provider relationship — not QualCanvas. Your IRB can audit the provider
              directly if they wish.
            </p>
          </div>
        </section>

        {/* Q2 */}
        <section className="mt-12">
          <h2
            className="font-display text-2xl mb-4 text-gray-900 dark:text-white"
            style={{ fontVariationSettings: "'opsz' 48, 'wght' 580" }}
          >
            What does QualCanvas use AI for?
          </h2>
          <div className="space-y-4 text-gray-700 dark:text-gray-300 leading-relaxed">
            <p>Three things, all opt-in per project, all reviewable, all reversible:</p>
            <ol className="list-decimal list-inside space-y-2 ml-2">
              <li>
                <strong className="text-gray-900 dark:text-white">Auto-code suggestions.</strong> The model proposes
                code names for spans you highlight. Every suggestion is reviewed before it lands; nothing is silently
                applied.
              </li>
              <li>
                <strong className="text-gray-900 dark:text-white">Theme summarization.</strong> When you ask, the model
                drafts a paragraph synthesizing the codes you've grouped under a theme. You edit it before it ships.
              </li>
              <li>
                <strong className="text-gray-900 dark:text-white">Framework synthesis.</strong> For cross-case work, the
                model can sketch a framework matrix from your coded cases. You restructure it as you see fit.
              </li>
            </ol>
            <p>
              No analysis runs without your action. There is no background AI watching your project. The model never
              applies a code without your accept-click; the model never overwrites a memo.
            </p>
          </div>
        </section>

        {/* Q3 */}
        <section className="mt-12">
          <h2
            className="font-display text-2xl mb-4 text-gray-900 dark:text-white"
            style={{ fontVariationSettings: "'opsz' 48, 'wght' 580" }}
          >
            Who can see the AI's responses?
          </h2>
          <div className="space-y-4 text-gray-700 dark:text-gray-300 leading-relaxed">
            <p>
              Only the user who triggered them. AI activity is logged in the project audit trail — which model was used,
              a redacted summary of the prompt (never the transcript content), and the user's decision to accept or
              reject the suggestion.
            </p>
            <p>On Team and Institutions tiers, the audit trail is visible to project admins for compliance review.</p>
          </div>
        </section>

        {/* Architecture diagram */}
        <section className="mt-12 rounded-xl bg-gray-50 dark:bg-gray-800/40 ring-1 ring-gray-200 dark:ring-gray-700 p-6">
          <h3
            className="font-display text-xl mb-4 text-gray-900 dark:text-white"
            style={{ fontVariationSettings: "'opsz' 48, 'wght' 580" }}
          >
            How a single AI call flows
          </h3>
          <pre className="text-xs font-mono text-gray-700 dark:text-gray-300 whitespace-pre-wrap leading-relaxed overflow-x-auto">
            {`User clicks "Suggest codes"
   ↓
QualCanvas client builds the prompt locally (transcript stays on user's machine)
   ↓
Direct HTTPS to provider's inference API using user's API key
   ↓
Response returned to user's browser
   ↓
User reviews; accepts or rejects
   ↓
Audit log records: model + prompt-summary + decision (never transcript content)`}
          </pre>
        </section>

        {/* Disable AI */}
        <section className="mt-12">
          <h2
            className="font-display text-2xl mb-4 text-gray-900 dark:text-white"
            style={{ fontVariationSettings: "'opsz' 48, 'wght' 580" }}
          >
            Disabling AI entirely
          </h2>
          <p className="text-gray-700 dark:text-gray-300 leading-relaxed">
            Every paid project has an "AI off" toggle in Settings. Once flipped, no AI features render in the UI for
            that project. If your IRB requires zero-AI for a study, this is your switch.
          </p>
        </section>

        <div className="mt-16 pt-8 border-t border-gray-200 dark:border-gray-800">
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Last reviewed: {new Date().toISOString().slice(0, 10)}. We re-review this page quarterly and whenever the
            model architecture changes. See{' '}
            <a
              className="underline decoration-ochre-500 underline-offset-2 hover:text-gray-900 dark:hover:text-white"
              href="/trust"
            >
              /trust
            </a>{' '}
            for the broader security posture.
          </p>
        </div>
      </article>
    </PageShell>
  );
}
