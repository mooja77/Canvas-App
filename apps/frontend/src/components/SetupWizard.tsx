import { useState, useCallback, useMemo } from 'react';
import { useUIStore, type UserProfile } from '../stores/uiStore';
import { useAuthStore } from '../stores/authStore';
import { useCanvasStore } from '../stores/canvasStore';

// ─── User Profile Options ───
const USER_PROFILES: { id: UserProfile & string; label: string; description: string; icon: string }[] = [
  { id: 'academic', label: 'Academic Researcher', description: 'PhD, postdoc, or faculty research', icon: '🎓' },
  { id: 'student', label: 'Student', description: 'Undergraduate or masters coursework', icon: '📚' },
  { id: 'ux', label: 'UX / Market Researcher', description: 'Industry research, user interviews', icon: '🔬' },
  { id: 'team', label: 'Team Lead', description: 'Managing a research team', icon: '👥' },
];

// ─── Methodology Templates ───
const ACADEMIC_METHODOLOGIES = [
  {
    id: 'thematic',
    name: 'Thematic Analysis',
    description: 'Braun & Clarke framework — identify, analyze, and report patterns (themes) within data.',
    color: 'purple',
    codes: [
      'Initial impressions / interesting features',
      'Recurring patterns across data',
      'Contradictions / tensions',
      'Participant emotions / affect',
      'Contextual factors',
    ],
  },
  {
    id: 'grounded',
    name: 'Grounded Theory',
    description: 'Develop theory grounded in data through open, axial, and selective coding.',
    color: 'emerald',
    codes: [
      'Open codes — descriptive labels',
      'In-vivo codes — participant language',
      'Process codes — actions/interactions',
      'Axial categories',
      'Core category',
    ],
  },
  {
    id: 'ipa',
    name: 'IPA (Interpretative)',
    description: 'Interpretative Phenomenological Analysis — explore lived experience in depth.',
    color: 'blue',
    codes: [
      'Descriptive comments',
      'Linguistic comments',
      'Conceptual comments',
      'Emergent themes',
      'Superordinate themes',
    ],
  },
  {
    id: 'framework',
    name: 'Framework Analysis',
    description: 'Structured matrix-based approach for applied policy and health research.',
    color: 'orange',
    codes: [
      'Key concepts / definitions',
      'Attitudes / beliefs',
      'Experiences / practices',
      'Barriers / challenges',
      'Facilitators / enablers',
    ],
  },
  {
    id: 'content',
    name: 'Content Analysis',
    description: 'Systematic coding for frequency and pattern analysis across documents.',
    color: 'teal',
    codes: ['Category A', 'Category B', 'Category C', 'Uncategorized / Other'],
  },
  {
    id: 'blank',
    name: 'Blank Canvas',
    description: 'Start from scratch with an empty workspace — add your own codes as you go.',
    color: 'gray',
    codes: [],
  },
] as const;

const STUDENT_METHODOLOGIES = [
  {
    ...ACADEMIC_METHODOLOGIES[0],
    description: 'Most popular for coursework — tag themes and patterns in your interview data.',
  },
  {
    ...ACADEMIC_METHODOLOGIES[4],
    description: 'Simple category-based coding — great for your first qualitative project.',
  },
  { ...ACADEMIC_METHODOLOGIES[5], description: 'Start empty and create codes as you read through transcripts.' },
] as const;

const UX_METHODOLOGIES = [
  {
    id: 'ux-interview',
    name: 'User Interview Analysis',
    description: 'Tag insights from user interviews — pain points, delight moments, and opportunities.',
    color: 'blue',
    codes: ['Pain Point', 'Delight Moment', 'Feature Request', 'Confusion', 'Workaround'],
  },
  {
    id: 'ux-usability',
    name: 'Usability Study',
    description: 'Code usability test sessions — task outcomes, hesitations, and errors.',
    color: 'emerald',
    codes: ['Task Success', 'Task Failure', 'Hesitation', 'Error Recovery', 'Satisfaction'],
  },
  {
    id: 'ux-journey',
    name: 'Customer Journey',
    description: 'Map the customer experience across touchpoints.',
    color: 'purple',
    codes: ['Awareness', 'Consideration', 'Decision', 'Onboarding', 'Retention'],
  },
  {
    id: 'blank',
    name: 'Blank Canvas',
    description: 'Start from scratch — create your own tags as you go.',
    color: 'gray',
    codes: [],
  },
] as const;

type MethodologyDef = { id: string; name: string; description: string; color: string; codes: readonly string[] };

const COLOR_MAP: Record<string, string> = {
  purple: 'border-purple-300 dark:border-purple-700 bg-purple-50 dark:bg-purple-900/20',
  emerald: 'border-emerald-300 dark:border-emerald-700 bg-emerald-50 dark:bg-emerald-900/20',
  blue: 'border-blue-300 dark:border-blue-700 bg-blue-50 dark:bg-blue-900/20',
  orange: 'border-orange-300 dark:border-orange-700 bg-orange-50 dark:bg-orange-900/20',
  teal: 'border-teal-300 dark:border-teal-700 bg-teal-50 dark:bg-teal-900/20',
  gray: 'border-gray-300 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/20',
};

const SELECTED_COLOR_MAP: Record<string, string> = {
  purple: 'border-purple-500 dark:border-purple-400 bg-purple-100 dark:bg-purple-900/40 ring-2 ring-purple-500/30',
  emerald:
    'border-emerald-500 dark:border-emerald-400 bg-emerald-100 dark:bg-emerald-900/40 ring-2 ring-emerald-500/30',
  blue: 'border-blue-500 dark:border-blue-400 bg-blue-100 dark:bg-blue-900/40 ring-2 ring-blue-500/30',
  orange: 'border-orange-500 dark:border-orange-400 bg-orange-100 dark:bg-orange-900/40 ring-2 ring-orange-500/30',
  teal: 'border-teal-500 dark:border-teal-400 bg-teal-100 dark:bg-teal-900/40 ring-2 ring-teal-500/30',
  gray: 'border-gray-500 dark:border-gray-400 bg-gray-100 dark:bg-gray-800 ring-2 ring-gray-500/30',
};

const SHORTCUTS = [
  { keys: ['Ctrl', 'K'], description: 'Open command palette' },
  { keys: ['?'], description: 'View all keyboard shortcuts' },
  { keys: ['Ctrl', 'Z'], description: 'Undo last action' },
  { keys: ['Alt', 'Drag'], description: 'Duplicate a node' },
  { keys: ['Esc'], description: 'Close panels and menus' },
];

interface SetupWizardProps {
  onComplete: () => void;
}

export default function SetupWizard({ onComplete }: SetupWizardProps) {
  const [currentStep, setCurrentStep] = useState(0);
  const [selectedProfile, setSelectedProfile] = useState<UserProfile>(null);
  const [selectedMethodology, setSelectedMethodology] = useState<string>('thematic');
  const [canvasName, setCanvasName] = useState('');
  const [creating, setCreating] = useState(false);
  const completeSetupWizard = useUIStore((s) => s.completeSetupWizard);
  const setUserProfile = useUIStore((s) => s.setUserProfile);
  const plan = useAuthStore((s) => s.plan);
  const createCanvas = useCanvasStore((s) => s.createCanvas);
  const openCanvas = useCanvasStore((s) => s.openCanvas);
  const addQuestion = useCanvasStore((s) => s.addQuestion);

  const totalSteps = 5; // profile → methodology → name → tips → done

  // Get methodologies based on selected profile
  const methodologies: readonly MethodologyDef[] = useMemo(() => {
    switch (selectedProfile) {
      case 'student':
        return STUDENT_METHODOLOGIES;
      case 'ux':
        return UX_METHODOLOGIES;
      default:
        return ACADEMIC_METHODOLOGIES;
    }
  }, [selectedProfile]);

  const methodology = methodologies.find((m) => m.id === selectedMethodology) || methodologies[0];

  // When profile changes, reset methodology to first option
  const handleProfileSelect = useCallback((profile: UserProfile) => {
    setSelectedProfile(profile);
    if (profile === 'ux') setSelectedMethodology('ux-interview');
    else if (profile === 'student') setSelectedMethodology('thematic');
    else setSelectedMethodology('thematic');
  }, []);

  const handleSkip = useCallback(() => {
    if (selectedProfile) setUserProfile(selectedProfile);
    completeSetupWizard();
    onComplete();
  }, [selectedProfile, setUserProfile, completeSetupWizard, onComplete]);

  const handleNext = useCallback(() => {
    if (currentStep === 0 && selectedProfile) {
      setUserProfile(selectedProfile);
    }
    if (currentStep < totalSteps - 1) {
      setCurrentStep((s) => s + 1);
    }
  }, [currentStep, selectedProfile, setUserProfile, totalSteps]);

  const handleBack = useCallback(() => {
    if (currentStep > 0) setCurrentStep((s) => s - 1);
  }, [currentStep]);

  const handleCreateCanvas = useCallback(async () => {
    if (creating) return;
    setCreating(true);
    try {
      const name = canvasName.trim() || `My ${methodology.name} Project`;
      const canvas = await createCanvas(name, `Created with ${methodology.name} template`);
      await openCanvas(canvas.id);

      const codeColors = ['#ef4444', '#f59e0b', '#22c55e', '#3b82f6', '#8b5cf6', '#ec4899', '#14b8a6'];
      for (let i = 0; i < methodology.codes.length; i++) {
        try {
          await addQuestion(methodology.codes[i], codeColors[i % codeColors.length]);
        } catch {
          /* Ignore errors for individual codes */
        }
      }

      completeSetupWizard();
      onComplete();
    } catch {
      setCreating(false);
    }
  }, [creating, canvasName, methodology, createCanvas, openCanvas, addQuestion, completeSetupWizard, onComplete]);

  const handleFinish = useCallback(() => {
    completeSetupWizard();
    onComplete();
  }, [completeSetupWizard, onComplete]);

  // Plan-specific subtitle for tips step
  const planTips = useMemo(() => {
    if (plan === 'team') return 'Set up your team on the Team page to collaborate with colleagues.';
    if (plan === 'pro') return 'Add your AI API key in Account settings to unlock AI-powered coding.';
    return 'Upgrade anytime from the pricing page to unlock more features.';
  }, [plan]);

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="w-full max-w-lg mx-4 rounded-2xl bg-white dark:bg-gray-800 shadow-2xl ring-1 ring-black/10 dark:ring-white/10 overflow-hidden">
        {/* Progress bar */}
        <div className="h-1 bg-gray-100 dark:bg-gray-700">
          <div
            className="h-full bg-gradient-to-r from-brand-400 to-brand-600 transition-all duration-500 ease-out rounded-r-full"
            style={{ width: `${((currentStep + 1) / totalSteps) * 100}%` }}
          />
        </div>

        <div className="p-6">
          {/* Step indicator */}
          <div className="flex items-center justify-between mb-6">
            <p className="text-xs font-medium text-gray-400 dark:text-gray-500">
              Step {currentStep + 1} of {totalSteps}
            </p>
            <button
              onClick={handleSkip}
              className="text-xs text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
            >
              Skip setup
            </button>
          </div>

          {/* ─── Step 0: User Profile Picker ─── */}
          {currentStep === 0 && (
            <div>
              <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-2 text-center">
                What best describes you?
              </h2>
              <p className="text-sm text-gray-500 dark:text-gray-400 mb-5 text-center">
                We will tailor your experience based on your role.
              </p>
              <div className="space-y-2">
                {USER_PROFILES.map((p) => (
                  <button
                    key={p.id}
                    onClick={() => handleProfileSelect(p.id as UserProfile)}
                    className={`w-full text-left p-3.5 rounded-xl border-2 transition-all flex items-center gap-3 ${
                      selectedProfile === p.id
                        ? 'border-brand-500 bg-brand-50 dark:bg-brand-900/20 ring-2 ring-brand-500/30'
                        : 'border-gray-200 dark:border-gray-600 hover:border-gray-300 dark:hover:border-gray-500 hover:shadow-sm'
                    }`}
                  >
                    <span className="text-2xl">{p.icon}</span>
                    <div>
                      <div className="font-semibold text-sm text-gray-900 dark:text-white">{p.label}</div>
                      <div className="text-xs text-gray-500 dark:text-gray-400">{p.description}</div>
                    </div>
                    {selectedProfile === p.id && (
                      <svg
                        className="w-5 h-5 ml-auto text-brand-500 flex-shrink-0"
                        fill="none"
                        viewBox="0 0 24 24"
                        strokeWidth={2}
                        stroke="currentColor"
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                      </svg>
                    )}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* ─── Step 1: Welcome ─── */}
          {currentStep === 1 && (
            <div className="text-center">
              <div className="w-16 h-16 mx-auto mb-4 bg-gradient-to-br from-brand-500 to-brand-700 rounded-2xl flex items-center justify-center shadow-lg">
                <svg
                  className="w-8 h-8 text-white"
                  fill="none"
                  viewBox="0 0 24 24"
                  strokeWidth={1.5}
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z"
                  />
                </svg>
              </div>
              <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-2">Welcome to QualCanvas!</h2>
              <p className="text-sm text-gray-600 dark:text-gray-300 leading-relaxed max-w-sm mx-auto">
                {selectedProfile === 'student'
                  ? 'Your workspace for coding interview transcripts. Import your data, tag themes, and build your analysis — all visually.'
                  : selectedProfile === 'ux'
                    ? 'Your workspace for making sense of user research. Import interviews, tag insights, and discover patterns across your data.'
                    : 'Your visual workspace for qualitative research. Import transcripts, create codes, tag your data, and discover patterns — all on an interactive canvas.'}
              </p>
              <div className="mt-6 grid grid-cols-3 gap-3 text-center">
                <div className="p-3 rounded-xl bg-blue-50 dark:bg-blue-900/20">
                  <div className="text-lg font-bold text-blue-600 dark:text-blue-400">Import</div>
                  <div className="text-[11px] text-gray-500 dark:text-gray-400 mt-1">
                    {selectedProfile === 'ux' ? 'Interview notes, CSVs' : 'Transcripts, CSVs, text files'}
                  </div>
                </div>
                <div className="p-3 rounded-xl bg-purple-50 dark:bg-purple-900/20">
                  <div className="text-lg font-bold text-purple-600 dark:text-purple-400">
                    {selectedProfile === 'ux' ? 'Tag' : 'Code'}
                  </div>
                  <div className="text-[11px] text-gray-500 dark:text-gray-400 mt-1">
                    {selectedProfile === 'ux' ? 'Insights and patterns' : 'Tag themes and patterns'}
                  </div>
                </div>
                <div className="p-3 rounded-xl bg-emerald-50 dark:bg-emerald-900/20">
                  <div className="text-lg font-bold text-emerald-600 dark:text-emerald-400">Analyze</div>
                  <div className="text-[11px] text-gray-500 dark:text-gray-400 mt-1">
                    {plan === 'free' ? '2 analysis tools' : '10 analysis tools'}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ─── Step 2: Methodology Picker ─── */}
          {currentStep === 2 && (
            <div>
              <h2 className="text-lg font-bold text-gray-900 dark:text-white mb-1">
                {selectedProfile === 'ux' ? 'Choose a Template' : 'Choose Your Methodology'}
              </h2>
              <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
                {selectedProfile === 'student'
                  ? 'Pick a framework for your assignment. Thematic Analysis is the most common.'
                  : selectedProfile === 'ux'
                    ? 'Select a research template to pre-populate tags.'
                    : selectedProfile === 'team'
                      ? 'Select a framework. Your team members will see these codes when they join.'
                      : 'Select a research framework to pre-populate your first canvas with relevant codes.'}
              </p>
              <div className="space-y-2 max-h-[320px] overflow-y-auto pr-1">
                {methodologies.map((m) => (
                  <button
                    key={m.id}
                    onClick={() => setSelectedMethodology(m.id)}
                    className={`w-full text-left p-3 rounded-xl border-2 transition-all ${
                      selectedMethodology === m.id
                        ? SELECTED_COLOR_MAP[m.color]
                        : `${COLOR_MAP[m.color]} hover:shadow-sm`
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-sm text-gray-900 dark:text-white">{m.name}</span>
                      {selectedMethodology === m.id && (
                        <svg
                          className="w-5 h-5 text-brand-500"
                          fill="none"
                          viewBox="0 0 24 24"
                          strokeWidth={2}
                          stroke="currentColor"
                        >
                          <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                        </svg>
                      )}
                    </div>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">{m.description}</p>
                    {m.codes.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-2">
                        {m.codes.slice(0, 3).map((c, i) => (
                          <span
                            key={i}
                            className="inline-block px-2 py-0.5 text-[10px] font-medium rounded-full bg-white/60 dark:bg-gray-700/60 text-gray-600 dark:text-gray-300"
                          >
                            {c}
                          </span>
                        ))}
                        {m.codes.length > 3 && (
                          <span className="inline-block px-2 py-0.5 text-[10px] text-gray-400 dark:text-gray-500">
                            +{m.codes.length - 3} more
                          </span>
                        )}
                      </div>
                    )}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* ─── Step 3: Name Canvas ─── */}
          {currentStep === 3 && (
            <div>
              <h2 className="text-lg font-bold text-gray-900 dark:text-white mb-1">Create Your First Project</h2>
              <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
                Give your canvas a name. We will set it up with {methodology.name}{' '}
                {selectedProfile === 'ux' ? 'tags' : 'codes'}.
              </p>
              <div className="space-y-4">
                <div>
                  <label
                    htmlFor="canvas-name"
                    className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5"
                  >
                    Canvas Name
                  </label>
                  <input
                    id="canvas-name"
                    type="text"
                    value={canvasName}
                    onChange={(e) => setCanvasName(e.target.value)}
                    placeholder={`My ${methodology.name} Project`}
                    className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm placeholder:text-gray-400 dark:placeholder:text-gray-500 focus:ring-2 focus:ring-brand-500 focus:border-brand-500 outline-none transition-colors"
                    autoFocus
                  />
                </div>
                <div className="rounded-xl bg-gray-50 dark:bg-gray-700/50 p-4">
                  <h4 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2">
                    {methodology.name} Template
                  </h4>
                  {methodology.codes.length > 0 ? (
                    <div className="space-y-1.5">
                      {methodology.codes.map((code, i) => (
                        <div key={i} className="flex items-center gap-2">
                          <div
                            className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                            style={{
                              backgroundColor: [
                                '#ef4444',
                                '#f59e0b',
                                '#22c55e',
                                '#3b82f6',
                                '#8b5cf6',
                                '#ec4899',
                                '#14b8a6',
                              ][i % 7],
                            }}
                          />
                          <span className="text-sm text-gray-600 dark:text-gray-300">{code}</span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-gray-500 dark:text-gray-400 italic">
                      No pre-configured {selectedProfile === 'ux' ? 'tags' : 'codes'}. You will start with a blank
                      canvas.
                    </p>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* ─── Step 4: Tips + Plan Info ─── */}
          {currentStep === 4 && (
            <div>
              <h2 className="text-lg font-bold text-gray-900 dark:text-white mb-1">Quick Tips</h2>
              <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">A few shortcuts to help you work faster.</p>
              <div className="space-y-3">
                {SHORTCUTS.map((shortcut, i) => (
                  <div
                    key={i}
                    className="flex items-center justify-between p-3 rounded-xl bg-gray-50 dark:bg-gray-700/30"
                  >
                    <span className="text-sm text-gray-700 dark:text-gray-300">{shortcut.description}</span>
                    <div className="flex items-center gap-1">
                      {shortcut.keys.map((key, j) => (
                        <span key={j}>
                          <kbd className="inline-flex items-center justify-center min-w-[24px] px-1.5 py-0.5 rounded bg-white dark:bg-gray-600 border border-gray-200 dark:border-gray-500 text-xs font-mono text-gray-700 dark:text-gray-200 shadow-sm">
                            {key}
                          </kbd>
                          {j < shortcut.keys.length - 1 && <span className="mx-0.5 text-gray-400 text-xs">+</span>}
                        </span>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
              <div className="mt-4 p-3 rounded-xl bg-brand-50 dark:bg-brand-900/20 border border-brand-200 dark:border-brand-800">
                <p className="text-xs text-brand-700 dark:text-brand-300 leading-relaxed">{planTips}</p>
              </div>
            </div>
          )}

          {/* Step dots */}
          <div className="flex items-center justify-center gap-1.5 mt-6 mb-4">
            {Array.from({ length: totalSteps }).map((_, i) => (
              <div
                key={i}
                className={`rounded-full transition-all duration-300 ${
                  i === currentStep
                    ? 'h-2 w-6 bg-brand-500'
                    : i < currentStep
                      ? 'h-2 w-2 bg-brand-300'
                      : 'h-2 w-2 bg-gray-200 dark:bg-gray-600'
                }`}
              />
            ))}
          </div>

          {/* Navigation buttons */}
          <div className="flex items-center justify-between">
            <div>
              {currentStep > 0 && (
                <button
                  onClick={handleBack}
                  className="flex items-center gap-1 rounded-lg border border-gray-200 dark:border-gray-600 px-3 py-1.5 text-sm font-medium text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                >
                  <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
                  </svg>
                  Back
                </button>
              )}
            </div>
            <div>
              {currentStep === 3 ? (
                <button
                  onClick={handleCreateCanvas}
                  disabled={creating}
                  className="flex items-center gap-1.5 btn-primary px-5 py-1.5 text-sm disabled:opacity-60"
                >
                  {creating ? (
                    <>
                      <svg className="h-4 w-4 animate-spin" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path
                          className="opacity-75"
                          fill="currentColor"
                          d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                        />
                      </svg>
                      Creating...
                    </>
                  ) : (
                    <>
                      Create Canvas
                      <svg
                        className="h-3.5 w-3.5"
                        fill="none"
                        viewBox="0 0 24 24"
                        strokeWidth={2}
                        stroke="currentColor"
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                      </svg>
                    </>
                  )}
                </button>
              ) : currentStep === totalSteps - 1 ? (
                <button onClick={handleFinish} className="flex items-center gap-1.5 btn-primary px-5 py-1.5 text-sm">
                  Get Started
                  <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M15.59 14.37a6 6 0 01-5.84 7.38v-4.8m5.84-2.58a14.98 14.98 0 006.16-12.12A14.98 14.98 0 009.631 8.41m5.96 5.96a14.926 14.926 0 01-5.841 2.58m-.119-8.54a6 6 0 00-7.381 5.84h4.8m2.581-5.84a14.927 14.927 0 00-2.58 5.84m2.699 2.7c-.103.021-.207.041-.311.06a15.09 15.09 0 01-2.448-2.448 14.9 14.9 0 01.06-.312m-2.24 2.39a4.493 4.493 0 00-1.757 4.306 4.493 4.493 0 004.306-1.758M16.5 9a1.5 1.5 0 11-3 0 1.5 1.5 0 013 0z"
                    />
                  </svg>
                </button>
              ) : (
                <button
                  onClick={handleNext}
                  disabled={currentStep === 0 && !selectedProfile}
                  className="flex items-center gap-1.5 btn-primary px-5 py-1.5 text-sm disabled:opacity-40"
                >
                  Next
                  <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
                  </svg>
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
