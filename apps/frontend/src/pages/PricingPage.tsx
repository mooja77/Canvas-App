import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuthStore } from '../stores/authStore';
import { billingApi } from '../services/api';
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

interface TierCardProps {
  name: string;
  price: string;
  annualPrice?: string;
  period: 'monthly' | 'annual';
  features: string[];
  highlight?: boolean;
  cta: string;
  onSelect: () => void;
  current?: boolean;
}

function TierCard({ name, price, annualPrice, period, features, highlight, cta, onSelect, current }: TierCardProps) {
  return (
    <div className={`rounded-2xl p-6 ${highlight
      ? 'ring-2 ring-brand-500 bg-white dark:bg-gray-800 shadow-xl'
      : 'ring-1 ring-gray-200 dark:ring-gray-700 bg-white dark:bg-gray-800'
    }`}>
      {highlight && (
        <span className="inline-block text-xs font-semibold bg-brand-100 dark:bg-brand-900/30 text-brand-700 dark:text-brand-300 px-3 py-1 rounded-full mb-3">
          Most Popular
        </span>
      )}
      <h3 className="text-xl font-bold text-gray-900 dark:text-white">{name}</h3>
      <div className="mt-3 mb-1">
        <span className="text-4xl font-bold text-gray-900 dark:text-white">
          {period === 'annual' && annualPrice ? annualPrice : price}
        </span>
        {price !== 'Free' && <span className="text-gray-500 dark:text-gray-400">/mo</span>}
      </div>
      {period === 'annual' && annualPrice && price !== 'Free' && (
        <p className="text-xs text-green-600 dark:text-green-400 mb-4">
          Save 25% with annual billing
        </p>
      )}
      <ul className="mt-4 space-y-2.5 mb-6">
        {features.map(f => (
          <li key={f} className="flex items-start gap-2 text-sm text-gray-600 dark:text-gray-300">
            <svg className="w-4 h-4 text-green-500 mt-0.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
            </svg>
            {f}
          </li>
        ))}
      </ul>
      <button
        onClick={onSelect}
        disabled={current}
        className={`w-full py-3 rounded-lg font-medium text-sm transition-colors ${
          current
            ? 'bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400 cursor-default'
            : highlight
              ? 'bg-brand-600 hover:bg-brand-700 text-white'
              : 'bg-gray-900 dark:bg-white hover:bg-gray-800 dark:hover:bg-gray-100 text-white dark:text-gray-900'
        }`}
      >
        {current ? 'Current Plan' : cta}
      </button>
    </div>
  );
}

export default function PricingPage() {
  const [period, setPeriod] = useState<'monthly' | 'annual'>('monthly');
  const [loading, setLoading] = useState(false);
  const [showDowngradeWarning, setShowDowngradeWarning] = useState(false);
  const [_pendingTier, setPendingTier] = useState<'pro' | 'team' | null>(null);
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { authenticated, plan, authType } = useAuthStore();

  const handleUpgrade = async (tier: 'pro' | 'team') => {
    if (!authenticated) {
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

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <div className="max-w-5xl mx-auto px-4 py-16">
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold text-gray-900 dark:text-white mb-3">
            {t('pricing.pageTitle')}
          </h1>
          <p className="text-lg text-gray-600 dark:text-gray-400">
            {t('pricing.pageSubtitle')}
          </p>
          <div className="inline-flex items-center bg-gray-200 dark:bg-gray-700 rounded-lg p-1 mt-6">
            <button
              onClick={() => setPeriod('monthly')}
              className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${
                period === 'monthly' ? 'bg-white dark:bg-gray-600 shadow text-gray-900 dark:text-white' : 'text-gray-600 dark:text-gray-400'
              }`}
            >
              {t('pricing.monthly')}
            </button>
            <button
              onClick={() => setPeriod('annual')}
              className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${
                period === 'annual' ? 'bg-white dark:bg-gray-600 shadow text-gray-900 dark:text-white' : 'text-gray-600 dark:text-gray-400'
              }`}
            >
              {t('pricing.annual')}
              <span className="ml-1 text-xs text-green-600 dark:text-green-400">Save 25%</span>
            </button>
          </div>
        </div>

        <div className="grid md:grid-cols-3 gap-6">
          <TierCard
            name={t('pricing.free')}
            price={t('pricing.free')}
            period={period}
            current={plan === 'free'}
            features={[
              '1 canvas',
              '2 transcripts per canvas',
              '5,000 words per transcript',
              '5 codes',
              'Stats & Word Cloud analysis',
              'CSV export',
            ]}
            cta={t('pricing.getStarted')}
            onSelect={() => {
              if (plan === 'pro' || plan === 'team') {
                setPendingTier(null);
                setShowDowngradeWarning(true);
              } else {
                navigate(authenticated ? '/canvas' : '/login');
              }
            }}
          />
          <TierCard
            name={t('pricing.pro')}
            price="$12"
            annualPrice="$9"
            period={period}
            highlight
            current={plan === 'pro'}
            features={[
              t('pricing.unlimitedCanvases'),
              '50,000 words per transcript',
              'Unlimited codes',
              'Auto-code',
              t('pricing.allAnalysisTools'),
              'CSV, PNG, HTML, Markdown export',
              '5 share codes',
              'Ethics panel & cases',
              t('pricing.eduDiscount'),
            ]}
            cta={loading ? t('common.loading') : t('pricing.upgradeToPro')}
            onSelect={() => {
              if (plan === 'team') {
                setPendingTier('pro');
                setShowDowngradeWarning(true);
              } else {
                handleUpgrade('pro');
              }
            }}
          />
          <TierCard
            name={t('pricing.team')}
            price="$29"
            annualPrice="$22"
            period={period}
            current={plan === 'team'}
            features={[
              'Everything in Pro',
              t('pricing.perSeatPricing'),
              t('pricing.unlimitedShares'),
              t('pricing.intercoderReliability'),
              t('pricing.teamManagement'),
              t('pricing.prioritySupport'),
              t('pricing.eduDiscount'),
            ]}
            cta={loading ? t('common.loading') : t('pricing.upgradeToTeam')}
            onSelect={() => handleUpgrade('team')}
          />
        </div>

        {/* Feature Comparison Table */}
        <div className="mt-16">
          <h2 className="text-2xl font-bold text-center text-gray-900 dark:text-white mb-8">
            {t('pricing.featureComparison')}
          </h2>

          {/* Desktop table — hidden on mobile */}
          <div className="hidden md:block overflow-x-auto relative">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200 dark:border-gray-700">
                  <th scope="col" className="text-left py-3 px-4 text-gray-600 dark:text-gray-400 font-medium">Feature</th>
                  <th scope="col" className="text-center py-3 px-4 text-gray-900 dark:text-white font-semibold">Free</th>
                  <th scope="col" className="text-center py-3 px-4 text-brand-600 dark:text-brand-400 font-semibold">Pro</th>
                  <th scope="col" className="text-center py-3 px-4 text-gray-900 dark:text-white font-semibold">Team</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                {[
                  { feature: 'Canvases', free: '1', pro: 'Unlimited', team: 'Unlimited' },
                  { feature: 'Transcripts per canvas', free: '2', pro: 'Unlimited', team: 'Unlimited' },
                  { feature: 'Words per transcript', free: '5,000', pro: '50,000', team: '50,000' },
                  { feature: 'Codes', free: '5', pro: 'Unlimited', team: 'Unlimited' },
                  { feature: 'Auto-code', free: false, pro: true, team: true },
                  { feature: 'Analysis tools', free: '2 (Stats, Word Cloud)', pro: 'All 10', team: 'All 10' },
                  { feature: 'Export formats', free: 'CSV', pro: 'CSV, PNG, HTML, MD', team: 'CSV, PNG, HTML, MD' },
                  { feature: 'Share codes', free: '0', pro: '5', team: 'Unlimited' },
                  { feature: 'Ethics panel', free: false, pro: true, team: true },
                  { feature: 'Cases & cross-case', free: false, pro: true, team: true },
                  { feature: 'Intercoder reliability', free: false, pro: false, team: true },
                  { feature: 'Team management', free: false, pro: false, team: true },
                  { feature: '.edu discount', free: '-', pro: '40% off', team: '40% off' },
                ].map(row => (
                  <tr key={row.feature} className="hover:bg-gray-50 dark:hover:bg-gray-800/50">
                    <th scope="row" className="py-2.5 px-4 text-left font-normal text-gray-700 dark:text-gray-300">{row.feature}</th>
                    {['free', 'pro', 'team'].map(tier => {
                      const val = row[tier as keyof typeof row];
                      return (
                        <td key={tier} className="py-2.5 px-4 text-center">
                          {typeof val === 'boolean' ? (
                            val ? (
                              <svg className="w-5 h-5 text-green-500 mx-auto" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" /></svg>
                            ) : (
                              <svg className="w-5 h-5 text-gray-300 dark:text-gray-600 mx-auto" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
                            )
                          ) : (
                            <span className="text-gray-700 dark:text-gray-300">{val}</span>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile stacked cards — visible only on mobile */}
          <div className="md:hidden space-y-6">
            {([
              { name: 'Free', highlight: false, features: { 'Canvases': '1', 'Transcripts per canvas': '2', 'Words per transcript': '5,000', 'Codes': '5', 'Auto-code': false, 'Analysis tools': '2 (Stats, Word Cloud)', 'Export formats': 'CSV', 'Share codes': '0', 'Ethics panel': false, 'Cases & cross-case': false, 'Intercoder reliability': false, 'Team management': false, '.edu discount': '-' } },
              { name: 'Pro', highlight: true, features: { 'Canvases': 'Unlimited', 'Transcripts per canvas': 'Unlimited', 'Words per transcript': '50,000', 'Codes': 'Unlimited', 'Auto-code': true, 'Analysis tools': 'All 10', 'Export formats': 'CSV, PNG, HTML, MD', 'Share codes': '5', 'Ethics panel': true, 'Cases & cross-case': true, 'Intercoder reliability': false, 'Team management': false, '.edu discount': '40% off' } },
              { name: 'Team', highlight: false, features: { 'Canvases': 'Unlimited', 'Transcripts per canvas': 'Unlimited', 'Words per transcript': '50,000', 'Codes': 'Unlimited', 'Auto-code': true, 'Analysis tools': 'All 10', 'Export formats': 'CSV, PNG, HTML, MD', 'Share codes': 'Unlimited', 'Ethics panel': true, 'Cases & cross-case': true, 'Intercoder reliability': true, 'Team management': true, '.edu discount': '40% off' } },
            ] as const).map(plan => (
              <div key={plan.name} className={`rounded-xl p-4 ${plan.highlight ? 'ring-2 ring-brand-500 bg-white dark:bg-gray-800' : 'ring-1 ring-gray-200 dark:ring-gray-700 bg-white dark:bg-gray-800'}`}>
                <h3 className={`text-lg font-bold mb-3 ${plan.highlight ? 'text-brand-600 dark:text-brand-400' : 'text-gray-900 dark:text-white'}`}>{plan.name}</h3>
                <div className="space-y-2">
                  {Object.entries(plan.features).map(([feature, val]) => (
                    <div key={feature} className="flex items-center justify-between py-1 text-sm">
                      <span className="text-gray-600 dark:text-gray-400">{feature}</span>
                      {typeof val === 'boolean' ? (
                        val ? (
                          <svg className="w-5 h-5 text-green-500" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" /></svg>
                        ) : (
                          <svg className="w-5 h-5 text-gray-300 dark:text-gray-600" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
                        )
                      ) : (
                        <span className="text-gray-900 dark:text-gray-200 font-medium text-right">{val}</span>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Money-back guarantee */}
        <div className="mt-8 text-center">
          <div className="inline-flex items-center gap-2 bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-300 px-4 py-2 rounded-full text-sm font-medium">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285Z" />
            </svg>
            {t('pricing.moneyBack')}
          </div>
          {period === 'annual' && (
            <p className="text-sm text-green-600 dark:text-green-400 mt-2 font-medium">
              Save $36/year on Pro or $84/year on Team with annual billing
            </p>
          )}
        </div>

        {/* FAQ */}
        <div className="mt-16 max-w-3xl mx-auto">
          <h2 className="text-2xl font-bold text-center text-gray-900 dark:text-white mb-8">
            {t('pricing.faq')}
          </h2>
          <div className="space-y-4">
            {[
              {
                q: 'Can I try before I buy?',
                a: 'Yes! The Free plan is free forever and includes core coding features. Upgrade when you need more capacity or advanced analysis tools.',
              },
              {
                q: 'What payment methods do you accept?',
                a: 'We accept all major credit cards through Stripe. Annual plans are also available at a 25% discount.',
              },
              {
                q: 'Can I cancel anytime?',
                a: 'Absolutely. Cancel anytime from your Account page. You\'ll keep Pro/Team access until the end of your billing period.',
              },
              {
                q: 'Do you offer academic discounts?',
                a: 'Yes! Sign up with a .edu email address and get 40% off any paid plan automatically at checkout.',
              },
              {
                q: 'Is my data secure?',
                a: 'Your data is encrypted at rest and in transit. We support ethics compliance features including consent tracking, anonymization, and audit trails.',
              },
              {
                q: 'What happens to my data if I downgrade?',
                a: 'Your existing data is preserved — you just can\'t create new resources beyond the Free plan limits. You can always re-upgrade to access everything again.',
              },
            ].map(({ q, a }) => (
              <details key={q} className="group bg-white dark:bg-gray-800 rounded-xl ring-1 ring-gray-200 dark:ring-gray-700">
                <summary className="flex items-center justify-between cursor-pointer p-4 text-sm font-medium text-gray-900 dark:text-white list-none">
                  {q}
                  <svg className="w-5 h-5 text-gray-400 group-open:rotate-180 transition-transform" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
                  </svg>
                </summary>
                <p className="px-4 pb-4 text-sm text-gray-600 dark:text-gray-400 leading-relaxed">
                  {a}
                </p>
              </details>
            ))}
          </div>
        </div>

        <div className="text-center mt-8">
          <button
            onClick={() => navigate(authenticated ? '/canvas' : '/')}
            className="text-sm text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300"
          >
            Back to {authenticated ? 'canvas' : 'home'}
          </button>
        </div>

        {showDowngradeWarning && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm" role="alertdialog" aria-modal="true">
            <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl max-w-md w-full mx-4 p-6 modal-enter">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                Downgrade Plan?
              </h3>
              <p className="text-sm text-gray-600 dark:text-gray-300 mb-4">
                Downgrading will limit your account to the Free plan limits:
              </p>
              <ul className="text-sm text-gray-600 dark:text-gray-400 space-y-1 mb-6 list-disc list-inside">
                <li>1 canvas, 2 transcripts, 5 codes</li>
                <li>Stats & Word Cloud analysis only</li>
                <li>No sharing, auto-code, or ethics panel</li>
              </ul>
              <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">
                Your existing data is preserved, but you won't be able to create new resources beyond the limits. Manage your subscription from Account settings.
              </p>
              <div className="flex gap-3">
                <button
                  onClick={() => setShowDowngradeWarning(false)}
                  className="flex-1 py-2.5 bg-brand-600 hover:bg-brand-700 text-white rounded-lg text-sm font-medium transition-colors"
                >
                  Keep Current Plan
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
      </div>
    </div>
  );
}
