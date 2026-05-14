import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../stores/authStore';
import { billingApi } from '../services/api';
import { usePageMeta } from '../hooks/usePageMeta';
import PageShell from '../components/marketing/PageShell';
import Eyebrow from '../components/marketing/Eyebrow';
import DisplayHeading from '../components/marketing/DisplayHeading';
import HairlineRule from '../components/marketing/HairlineRule';
import TierCardV2 from '../components/marketing/TierCardV2';
import ComparisonTable from '../components/marketing/ComparisonTable';
import CompetitorRow from '../components/marketing/CompetitorRow';
import FAQ from '../components/marketing/FAQ';
import CTAStripe from '../components/marketing/CTAStripe';
import { trackEvent } from '../utils/analytics';
import toast from 'react-hot-toast';

const PRICE_IDS = {
  pro: {
    monthly: import.meta.env.VITE_STRIPE_PRO_MONTHLY_PRICE_ID || '',
    annual: import.meta.env.VITE_STRIPE_PRO_ANNUAL_PRICE_ID || '',
  },
  team: {
    monthly: import.meta.env.VITE_STRIPE_TEAM_MONTHLY_PRICE_ID || '',
    annual: import.meta.env.VITE_STRIPE_TEAM_ANNUAL_PRICE_ID || '',
  },
};

const RESEARCH_DESK_CALENDLY = 'mailto:research@qualcanvas.com?subject=Institution%20plan%20inquiry';

/**
 * Pricing page — refresh per docs/refresh/06-pages/02-pricing.md.
 *
 * Preserves the legacy Stripe wiring and downgrade-modal logic verbatim:
 *   - VITE_STRIPE_PRO_* / VITE_STRIPE_TEAM_* env vars
 *   - billingApi.createCheckout(priceId, tier) flow
 *   - Pro→Team / Team→Pro / Pro→Free downgrade warning modal
 *
 * Replaces the visual chrome (Tier 2), adds a 4th "Institutions" card,
 * adds an .edu discount strip, replaces the binary checkmark table with a
 * categorical ComparisonTable, and surfaces a sourced CompetitorRow strip
 * versus NVivo / ATLAS.ti / Dedoose. The "Most Popular" badge is gone —
 * confidence sells in 2026 (Linear's pricing page makes the same move).
 */
export default function PricingPage() {
  const [period, setPeriod] = useState<'monthly' | 'annual'>('annual');
  const [loading, setLoading] = useState(false);
  const [showDowngradeWarning, setShowDowngradeWarning] = useState(false);
  const [_pendingTier, setPendingTier] = useState<'pro' | 'team' | null>(null);
  const navigate = useNavigate();
  const { authenticated, plan, authType } = useAuthStore();
  usePageMeta(
    'Pricing — QualCanvas',
    'Free, Pro ($12/mo), Team ($29/seat/mo), and Institutions plans. 40% off .edu. Compare against NVivo, ATLAS.ti, Dedoose.',
  );

  useEffect(() => {
    trackEvent('pricing_viewed', { app_name: 'QualCanvas' });
    trackEvent('marketing_page_viewed', { page: '/pricing' });
  }, []);

  const handleUpgrade = async (tier: 'pro' | 'team') => {
    trackEvent('cta_clicked', {
      cta_label: `Start ${tier}`,
      location: 'pricing_card',
      target_route: 'stripe_checkout',
    });
    if (!authenticated) {
      trackEvent('signup_started', { source_page: '/pricing', plan: tier });
      navigate('/login');
      return;
    }
    if (authType === 'legacy') {
      toast.error('Please add an email to your account first (Settings > Link Account)');
      return;
    }

    const priceId = PRICE_IDS[tier][period];
    if (!priceId) {
      toast.error('Billing is not configured yet');
      return;
    }

    setLoading(true);
    try {
      const res = await billingApi.createCheckout(priceId, tier);
      const { url } = res.data.data;
      if (url) {
        window.location.href = url;
      }
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Failed to start checkout');
    } finally {
      setLoading(false);
    }
  };

  const handleFreeSelect = () => {
    if (plan === 'pro' || plan === 'team') {
      setPendingTier(null);
      setShowDowngradeWarning(true);
    } else {
      trackEvent('cta_clicked', {
        cta_label: 'Start free',
        location: 'pricing_card',
        target_route: authenticated ? '/canvas' : '/login',
      });
      trackEvent('signup_started', { source_page: '/pricing', plan: 'free' });
      navigate(authenticated ? '/canvas' : '/login');
    }
  };

  return (
    <PageShell>
      <div className="max-w-6xl mx-auto px-4 sm:px-6 pt-16 pb-12">
        {/* ─── Hero ─── */}
        <div className="max-w-3xl mb-12">
          <HairlineRule className="mb-6" />
          <Eyebrow className="mb-3">Pricing</Eyebrow>
          <DisplayHeading as="h1" size="lg" className="mb-5">
            Pricing.
          </DisplayHeading>
          <p className="text-lg text-gray-600 dark:text-gray-300 leading-relaxed">
            Start free. Upgrade when your dissertation does.
          </p>
        </div>

        {/* Billing toggle */}
        <div className="flex items-center gap-3 mb-10">
          <div className="inline-flex items-center bg-gray-100 dark:bg-gray-800 rounded-lg p-1">
            <button
              onClick={() => {
                setPeriod('monthly');
                trackEvent('pricing_toggle_changed', { new_value: 'monthly' });
              }}
              className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${
                period === 'monthly'
                  ? 'bg-white dark:bg-gray-700 shadow-sm text-gray-900 dark:text-white'
                  : 'text-gray-600 dark:text-gray-400'
              }`}
            >
              Monthly
            </button>
            <button
              onClick={() => {
                setPeriod('annual');
                trackEvent('pricing_toggle_changed', { new_value: 'annual' });
              }}
              className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${
                period === 'annual'
                  ? 'bg-white dark:bg-gray-700 shadow-sm text-gray-900 dark:text-white'
                  : 'text-gray-600 dark:text-gray-400'
              }`}
            >
              Annual
              <span className="ml-1.5 text-xs text-ochre-700 dark:text-ochre-400 font-semibold">Save 25%</span>
            </button>
          </div>
        </div>

        {/* ─── 4 tier cards ─── */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <TierCardV2
            name="Free"
            price="$0"
            audience="For trying it out"
            features={['1 canvas', '5 codes', 'CSV export', 'Stats + wordcloud']}
            isCurrent={plan === 'free'}
            cta={
              <button
                onClick={handleFreeSelect}
                className="w-full inline-flex items-center justify-center px-4 py-2.5 rounded-lg border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-200 text-sm font-medium hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ochre-400 focus-visible:ring-offset-2"
              >
                Start free
              </button>
            }
          />

          <TierCardV2
            name="Pro"
            price={period === 'annual' ? '$9' : '$12'}
            pricePeriod={period === 'annual' ? 'per month, billed annually ($108/yr)' : '$12 / month'}
            audience="For working researchers"
            features={[
              'Unlimited canvases',
              '50,000 words / transcript',
              'All 12 analysis tools',
              'Auto-code',
              'Ethics + cases',
              '5 share codes',
            ]}
            isCurrent={plan === 'pro'}
            cta={
              <button
                onClick={() => {
                  if (plan === 'team') {
                    setPendingTier('pro');
                    setShowDowngradeWarning(true);
                  } else {
                    handleUpgrade('pro');
                  }
                }}
                disabled={loading}
                className="w-full inline-flex items-center justify-center px-4 py-2.5 rounded-lg bg-ochre-500 hover:bg-ochre-600 text-ink-950 text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ochre-400 focus-visible:ring-offset-2 disabled:opacity-50"
              >
                {loading ? 'Loading…' : 'Start Pro'}
              </button>
            }
          />

          <TierCardV2
            name="Team"
            price={period === 'annual' ? '$22' : '$29'}
            pricePeriod={period === 'annual' ? 'per seat / month, billed annually' : '$29 / seat / month'}
            audience="For research groups"
            features={[
              'Everything in Pro',
              'Intercoder κ + α (live)',
              'Unlimited share codes',
              'Team admin',
              'Priority support',
            ]}
            isCurrent={plan === 'team'}
            cta={
              <button
                onClick={() => handleUpgrade('team')}
                disabled={loading}
                className="w-full inline-flex items-center justify-center px-4 py-2.5 rounded-lg border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-200 text-sm font-medium hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ochre-400 focus-visible:ring-offset-2 disabled:opacity-50"
              >
                {loading ? 'Loading…' : 'Start Team'}
              </button>
            }
          />

          <TierCardV2
            name="Institutions"
            price="Custom"
            pricePeriod="Volume + procurement-ready"
            audience="For departments and faculties"
            features={[
              'Everything in Team',
              'SSO + SCIM',
              'DPA + BAA',
              'Custom retention',
              'EU residency',
              'Research desk',
            ]}
            cta={
              <a
                href={RESEARCH_DESK_CALENDLY}
                onClick={() =>
                  trackEvent('cta_clicked', {
                    cta_label: 'Book a call',
                    location: 'pricing_card',
                    target_route: 'research_desk',
                  })
                }
                className="w-full inline-flex items-center justify-center px-4 py-2.5 rounded-lg border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-200 text-sm font-medium hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ochre-400 focus-visible:ring-offset-2"
              >
                Book a call
              </a>
            }
          />
        </div>

        {/* .edu discount strip */}
        <div className="mt-6 text-center text-sm text-gray-600 dark:text-gray-400">
          <span className="font-medium text-gray-900 dark:text-white">40% off Pro and Team with a .edu email.</span>{' '}
          Applied automatically at checkout.
        </div>
      </div>

      {/* ─── Comparison table ─── */}
      <div className="max-w-6xl mx-auto px-4 sm:px-6 pb-12">
        <div className="mb-10">
          <HairlineRule className="mb-4" />
          <Eyebrow className="mb-3">Full comparison</Eyebrow>
          <DisplayHeading as="h2" size="md">
            Side by side.
          </DisplayHeading>
        </div>
        <ComparisonTable
          columns={['Feature', 'Free', 'Pro', 'Team', 'Institutions']}
          groups={[
            {
              heading: 'Workspace',
              rows: [
                { feature: 'Canvases', values: ['1', 'Unlimited', 'Unlimited', 'Unlimited'] },
                { feature: 'Transcripts per canvas', values: ['2', 'Unlimited', 'Unlimited', 'Unlimited'] },
                { feature: 'Words per transcript', values: ['5,000', '50,000', '50,000', '50,000'] },
                { feature: 'Codes', values: ['5', 'Unlimited', 'Unlimited', 'Unlimited'] },
              ],
            },
            {
              heading: 'Coding & analysis',
              rows: [
                { feature: 'Auto-code (AI-assisted)', values: ['—', '✓', '✓', '✓'] },
                { feature: 'Analysis tools', values: ['2', 'All 12', 'All 12', 'All 12'] },
                { feature: 'Cases + cross-case', values: ['—', '✓', '✓', '✓'] },
                { feature: 'Intercoder reliability (κ + α)', values: ['—', '—', '✓', '✓'] },
              ],
            },
            {
              heading: 'Collaboration',
              rows: [
                { feature: 'Share codes', values: ['—', '5', 'Unlimited', 'Unlimited'] },
                { feature: 'Team management', values: ['—', '—', '✓', '✓'] },
                { feature: 'SSO + SCIM', values: ['—', '—', '—', '✓'] },
              ],
            },
            {
              heading: 'Ethics + compliance',
              rows: [
                { feature: 'Ethics + consent tracking', values: ['—', '✓', '✓', '✓'] },
                { feature: 'Audit log', values: ['90 days', '90 days', '90 days', 'Custom'] },
                { feature: 'DPA available', values: ['—', '✓', '✓', '✓'] },
                { feature: 'BAA available', values: ['—', '—', '—', '✓'] },
                { feature: 'EU residency option', values: ['—', '—', '—', '✓'] },
              ],
            },
            {
              heading: 'Export + import',
              rows: [
                { feature: 'CSV export', values: ['✓', '✓', '✓', '✓'] },
                { feature: 'PNG / HTML / Markdown', values: ['—', '✓', '✓', '✓'] },
                { feature: 'QDPX (NVivo / ATLAS.ti)', values: ['—', '✓', '✓', '✓'] },
              ],
            },
            {
              heading: 'Support',
              rows: [
                { feature: 'Email response', values: ['Best effort', '48h', '24h priority', 'Dedicated'] },
                { feature: '.edu discount', values: ['—', '40%', '40%', 'Custom'] },
              ],
            },
          ]}
        />
      </div>

      {/* ─── CompetitorRow strip ─── */}
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-12">
        <CompetitorRow
          eyebrow="How we compare"
          qualcanvas={{ pricing: '$12/mo · published', note: 'On this page. 40% off .edu.' }}
          competitors={[
            { name: 'NVivo', pricing: '~$1,200/yr · gated', href: 'https://shop.lumivero.com', vsSlug: 'nvivo' },
            {
              name: 'ATLAS.ti',
              pricing: '~$5/mo student · gated',
              href: 'https://atlasti.com/student-licenses',
              vsSlug: 'atlas-ti',
            },
            {
              name: 'Dedoose',
              pricing: '$17.95 active month',
              href: 'https://www.dedoose.com/home/pricing',
              vsSlug: 'dedoose',
            },
          ]}
          footnote="Competitor prices verified 2026-05-14 from each vendor's public page where available; third-party sourced otherwise. See each /vs/ page for the full comparison."
        />
      </div>

      {/* ─── Money-back guarantee + annual savings callout (preserved) ─── */}
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8 text-center">
        <div className="inline-flex items-center gap-2 bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-300 px-4 py-2 rounded-full text-sm font-medium">
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285Z"
            />
          </svg>
          30-day money-back guarantee. Email us and we'll refund the last charge — no form, no script.
        </div>
        {period === 'annual' && (
          <p className="text-sm text-emerald-700 dark:text-emerald-400 mt-3 font-medium">
            Save $36/year on Pro · $84/seat/year on Team with annual billing.
          </p>
        )}
      </div>

      {/* ─── FAQ ─── */}
      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-16">
        <div className="mb-10">
          <HairlineRule className="mb-4" />
          <Eyebrow className="mb-3">Frequently asked</Eyebrow>
        </div>
        <FAQ
          items={[
            {
              question: 'Can I try before I buy?',
              answer:
                'Yes. The Free plan is free forever and includes core coding features. Upgrade when you need more capacity or advanced analysis tools.',
            },
            {
              question: 'What payment methods do you accept?',
              answer:
                'All major credit cards via Stripe. Annual billing saves 25%. Wire transfer available on the Institutions plan.',
            },
            {
              question: 'Can I cancel anytime?',
              answer:
                'Yes. Cancel from your Account page. You keep Pro/Team access until the end of the billing period. No retention friction.',
            },
            {
              question: 'How does the academic discount work?',
              answer:
                'Sign up with a .edu email and 40% off Pro or Team is applied automatically at checkout via a Stripe coupon. No paperwork.',
            },
            {
              question: 'What happens to my data if I downgrade?',
              answer:
                "Your data is preserved. You can't create new resources beyond the Free-plan limits until you re-upgrade, but nothing is deleted.",
            },
            {
              question: 'Do you offer institutional licensing?',
              answer: (
                <>
                  Yes — see the Institutions card above or book a 20-minute call with our research desk. SSO + SCIM,
                  DPA, BAA, custom retention, EU residency. We'll send a draft DPA before the call if you want to review
                  it first.
                </>
              ),
            },
          ]}
        />
      </div>

      {/* ─── CTA stripe ─── */}
      <CTAStripe
        headline="Start coding. Free."
        sub="No credit card. .edu discount automatic. Cancel any time."
        primary={
          <button
            onClick={handleFreeSelect}
            className="
              inline-flex items-center justify-center
              bg-ochre-400 hover:bg-ochre-300 active:bg-ochre-500
              text-ink-950 font-semibold
              px-8 py-3.5 rounded-lg
              transition-colors duration-150
              focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ochre-300 focus-visible:ring-offset-2 focus-visible:ring-offset-ink-900
            "
          >
            Start free
          </button>
        }
        secondary={
          <a
            href={RESEARCH_DESK_CALENDLY}
            className="
              inline-flex items-center justify-center
              text-gray-300 hover:text-white
              underline-offset-4 hover:underline decoration-ochre-400
              font-medium px-4 py-3
            "
          >
            Talk to research desk →
          </a>
        }
      />

      {/* ─── Downgrade warning modal (preserved verbatim from legacy) ─── */}
      {showDowngradeWarning && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm"
          role="alertdialog"
          aria-modal="true"
        >
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl max-w-md w-full mx-4 p-6 modal-enter">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">Downgrade plan?</h3>
            <p className="text-sm text-gray-600 dark:text-gray-300 mb-4">
              Downgrading will limit your account to the Free plan limits:
            </p>
            <ul className="text-sm text-gray-600 dark:text-gray-400 space-y-1 mb-6 list-disc list-inside">
              <li>1 canvas, 2 transcripts, 5 codes</li>
              <li>Stats &amp; word cloud analysis only</li>
              <li>No sharing, auto-code, or ethics panel</li>
            </ul>
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">
              Your existing data is preserved, but you won't be able to create new resources beyond the limits. Manage
              your subscription from Account settings.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setShowDowngradeWarning(false)}
                className="flex-1 py-2.5 bg-ochre-500 hover:bg-ochre-600 text-ink-950 rounded-lg text-sm font-medium transition-colors"
              >
                Keep current plan
              </button>
              <button
                onClick={() => {
                  setShowDowngradeWarning(false);
                  if (authenticated) {
                    navigate('/account');
                  }
                }}
                className="flex-1 py-2.5 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 text-sm font-medium transition-colors"
              >
                Manage in Account
              </button>
            </div>
          </div>
        </div>
      )}
    </PageShell>
  );
}
