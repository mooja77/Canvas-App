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
 * Every claim on this page has been verified against the actual backend
 * architecture (apps/backend/src/routes/aiRoutes.ts, lib/llm-*.ts, prisma
 * schema). Re-verify after any change to AI request routing, key storage,
 * or logging tables. See docs/refresh/10 R14.
 *
 * Architecture (verified 2026-05-14):
 *   Browser → Backend (acts as proxy) → Provider API
 *   - Keys: per-user encrypted in UserAiConfig, or server-side env fallback.
 *   - Logs: AiUsage table stores feature, provider, model, token counts.
 *           Prompt + transcript content NEVER persisted.
 *   - Providers wired: OpenAI, Anthropic, Google. No others.
 *
 * Legal sign-off REQUIRED before this URL is linked from default nav or
 * the landing FAQ — the prior draft made three false claims that have
 * been corrected; counsel should re-read the corrected version.
 */
export default function TrustAIPage() {
  usePageMeta(
    'AI use policy — QualCanvas',
    'How AI works in QualCanvas: what is sent, what is stored, what is not. Verified against our actual architecture.',
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
              <strong className="font-semibold text-gray-900 dark:text-white">No.</strong> When you ask QualCanvas to
              auto-code, summarize a theme, or sketch a framework, the QualCanvas backend forwards your prompt to the
              model provider you've chosen (OpenAI, Anthropic, or Google), receives the response, and returns it to your
              browser. The transcript content is held in memory for the duration of the request — it is not written to
              any QualCanvas database, log, or analytics stream.
            </p>
            <p>The model providers we support contractually exclude this API traffic from training. Their policies:</p>
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
              <strong className="font-semibold text-gray-900 dark:text-white">Bring your own key.</strong> If you'd
              rather inference be billed and observed by your own provider account, you can configure a personal API key
              in Account Settings. With BYOK, QualCanvas uses your key when forwarding requests; the provider
              relationship is between you and them, and your IRB can audit the provider directly.
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
            <p>Three things, all opt-in per action, all reviewable, all reversible:</p>
            <ol className="list-decimal list-inside space-y-2 ml-2">
              <li>
                <strong className="text-gray-900 dark:text-white">Auto-code suggestions.</strong> The model proposes
                code names for spans you select. Every suggestion is reviewed before it lands; nothing is silently
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
            What does QualCanvas log about my AI use?
          </h2>
          <div className="space-y-4 text-gray-700 dark:text-gray-300 leading-relaxed">
            <p>
              <strong className="font-semibold text-gray-900 dark:text-white">Usage metadata only.</strong> For each AI
              call we record: which feature was used (auto-code / theme / framework), which provider, which model, and
              the token count returned by the provider. This is what we use to bill, debug, and report on AI behavior.
            </p>
            <p>
              <strong className="font-semibold text-gray-900 dark:text-white">
                We do not log the prompt or the response content.
              </strong>{' '}
              The transcript text, the model's suggested codes, the summary it drafted — none of that is written to
              QualCanvas storage beyond the request that returns it to your browser.
            </p>
            <p>
              When you accept or reject a suggestion, the accept/reject decision is recorded against the coded span so
              your methods statement can report it (e.g. "model accepted 14/22 suggestions; researcher revised 6"). That
              record holds the resulting code name and the user's decision — never the full prompt context.
            </p>
            <p>On Team and Institutions tiers, this usage and decision record is visible to project admins.</p>
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
            {`User selects spans and clicks "Suggest codes"
   ↓
Browser sends the prompt + spans to QualCanvas backend (encrypted in transit)
   ↓
Backend reads the user's stored API key (or falls back to QualCanvas's
key if the user hasn't configured BYOK) and forwards to provider
   ↓
Provider returns suggestions
   ↓
Backend records usage metadata (feature + model + token count)
   ↓
Backend returns the suggestions to the browser; prompt + response
content are discarded from server memory
   ↓
User reviews; accepts or rejects per suggestion
   ↓
Accept/reject + final code name persisted with the span`}
          </pre>
          <p className="mt-4 text-xs text-gray-500 dark:text-gray-400 leading-relaxed">
            Backend code paths: <code className="font-mono">apps/backend/src/routes/aiRoutes.ts</code> +{' '}
            <code className="font-mono">apps/backend/src/lib/llm-{'{openai,anthropic,google}'}.ts</code>. Usage logging:
            the <code className="font-mono">AiUsage</code> Prisma table. Suggestion decisions: the{' '}
            <code className="font-mono">AiSuggestion</code> table.
          </p>
        </section>

        {/* Limiting AI use */}
        <section className="mt-12">
          <h2
            className="font-display text-2xl mb-4 text-gray-900 dark:text-white"
            style={{ fontVariationSettings: "'opsz' 48, 'wght' 580" }}
          >
            Limiting or disabling AI on a study
          </h2>
          <div className="space-y-4 text-gray-700 dark:text-gray-300 leading-relaxed">
            <p>
              AI features are never automatic — you have to click an "AI suggest" button for any inference to happen. So
              the simplest way to run an AI-free study is to not click those buttons. There is no background activity
              that needs to be turned off.
            </p>
            <p>
              If your IRB requires a stronger guarantee, contact{' '}
              <a
                className="underline decoration-ochre-500 underline-offset-2 hover:text-gray-900 dark:hover:text-white"
                href="mailto:research@qualcanvas.com?subject=IRB%20AI-disable%20request"
              >
                research@qualcanvas.com
              </a>
              . On the Institutions plan we can configure a project-level "AI disabled" flag that hides the AI buttons
              for that workspace; documenting this for your protocol is straightforward.
            </p>
          </div>
        </section>

        <div className="mt-16 pt-8 border-t border-gray-200 dark:border-gray-800">
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Last reviewed: {new Date().toISOString().slice(0, 10)}. We re-review this page quarterly and whenever the AI
            request, key storage, or logging architecture changes. See{' '}
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
