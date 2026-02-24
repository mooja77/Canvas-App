import { useState, useEffect, useCallback, useMemo } from 'react';
import { useUIStore } from '../../../stores/uiStore';

interface TourStep {
  target: string; // data-tour attribute value or 'center'
  title: string;
  description: string;
  position: 'top' | 'bottom' | 'left' | 'right' | 'center';
  icon: 'wave' | 'transcript' | 'code' | 'highlight' | 'link' | 'chart' | 'sidebar' | 'status' | 'search' | 'rocket';
  tip?: string;
}

const TOUR_STEPS: TourStep[] = [
  {
    target: 'center',
    title: 'Welcome to Canvas!',
    description: 'Canvas helps you make sense of interview data. We\'ll walk you through the key areas in under a minute.',
    position: 'center',
    icon: 'wave',
  },
  {
    target: 'canvas-btn-transcript',
    title: 'Add Your Interviews',
    description: 'Click here to bring in your interview transcripts. You can paste text directly or import a CSV file with multiple interviews at once.',
    position: 'bottom',
    icon: 'transcript',
    tip: 'Start here! Everything begins with your data.',
  },
  {
    target: 'canvas-btn-question',
    title: 'Create Codes',
    description: 'Codes are labels you create to tag important themes in your interviews. For example: "Trust Issues" or "Positive Experience".',
    position: 'bottom',
    icon: 'code',
    tip: 'Think of codes as colored highlighters for your data.',
  },
  {
    target: 'canvas-flow-area',
    title: 'Code Your Data',
    description: 'Select any text in a transcript, and a menu appears to tag it with a code. That\'s it \u2014 just select and tag! Lines will connect transcripts to codes automatically.',
    position: 'center',
    icon: 'highlight',
    tip: 'Double-click anywhere on the canvas for a quick menu.',
  },
  {
    target: 'canvas-navigator',
    title: 'Your Code Navigator',
    description: 'This sidebar shows all your codes and sources at a glance. Click any code to see what you\'ve tagged. The bar shows how many times each code was used.',
    position: 'right',
    icon: 'sidebar',
  },
  {
    target: 'canvas-btn-query',
    title: 'Analyze Your Findings',
    description: 'When you\'re ready to find patterns, click Analyze. Create word clouds, charts, or look for themes that appear together.',
    position: 'bottom',
    icon: 'chart',
    tip: 'This is where the insights come from!',
  },
  {
    target: 'canvas-toolbar',
    title: 'More Powerful Tools',
    description: 'Auto-Code finds patterns instantly. Hierarchy lets you organize codes into groups. Stripes shows color-coded highlights right in your text.',
    position: 'bottom',
    icon: 'search',
  },
  {
    target: 'canvas-status-bar',
    title: 'Track Your Progress',
    description: 'The status bar shows how much of your data you\'ve coded, plus quick undo/redo. Watch the coverage bar fill up as you work!',
    position: 'top',
    icon: 'status',
  },
  {
    target: 'center',
    title: 'You\'re All Set!',
    description: 'Start by adding a transcript, create a couple of codes, and begin tagging. You\'ll get the hang of it in no time.',
    position: 'center',
    icon: 'rocket',
    tip: 'Press Ctrl+K anytime to quickly find any action.',
  },
];

// Icons for each step
function StepIcon({ type, className }: { type: TourStep['icon']; className?: string }) {
  const c = className || 'h-6 w-6';
  switch (type) {
    case 'wave':
      return <span className="text-2xl" role="img" aria-label="wave">&#128075;</span>;
    case 'transcript':
      return (
        <svg className={`${c} text-blue-500`} fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z" />
        </svg>
      );
    case 'code':
      return (
        <svg className={`${c} text-purple-500`} fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="M9.568 3H5.25A2.25 2.25 0 0 0 3 5.25v4.318c0 .597.237 1.17.659 1.591l9.581 9.581c.699.699 1.78.872 2.607.33a18.095 18.095 0 0 0 5.223-5.223c.542-.827.369-1.908-.33-2.607L11.16 3.66A2.25 2.25 0 0 0 9.568 3Z" />
          <path strokeLinecap="round" strokeLinejoin="round" d="M6 6h.008v.008H6V6Z" />
        </svg>
      );
    case 'highlight':
      return (
        <svg className={`${c} text-amber-500`} fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="M9.53 16.122a3 3 0 0 0-5.78 1.128 2.25 2.25 0 0 1-2.4 2.245 4.5 4.5 0 0 0 8.4-2.245c0-.399-.078-.78-.22-1.128Zm0 0a15.998 15.998 0 0 0 3.388-1.62m-5.043-.025a15.994 15.994 0 0 1 1.622-3.395m3.42 3.42a15.995 15.995 0 0 0 4.764-4.648l3.876-5.814a1.151 1.151 0 0 0-1.597-1.597L14.146 6.32a15.996 15.996 0 0 0-4.649 4.763m3.42 3.42a6.776 6.776 0 0 0-3.42-3.42" />
        </svg>
      );
    case 'link':
      return (
        <svg className={`${c} text-cyan-500`} fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="M13.19 8.688a4.5 4.5 0 0 1 1.242 7.244l-4.5 4.5a4.5 4.5 0 0 1-6.364-6.364l1.757-1.757m13.35-.622 1.757-1.757a4.5 4.5 0 0 0-6.364-6.364l-4.5 4.5a4.5 4.5 0 0 0 1.242 7.244" />
        </svg>
      );
    case 'chart':
      return (
        <svg className={`${c} text-emerald-500`} fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 0 1 3 19.875v-6.75ZM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 0 1-1.125-1.125V8.625ZM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 0 1-1.125-1.125V4.125Z" />
        </svg>
      );
    case 'sidebar':
      return (
        <svg className={`${c} text-indigo-500`} fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25H12" />
        </svg>
      );
    case 'status':
      return (
        <svg className={`${c} text-teal-500`} fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 6a7.5 7.5 0 1 0 7.5 7.5h-7.5V6Z" />
          <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 10.5H21A7.5 7.5 0 0 0 13.5 3v7.5Z" />
        </svg>
      );
    case 'search':
      return (
        <svg className={`${c} text-rose-500`} fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="m3.75 13.5 10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75Z" />
        </svg>
      );
    case 'rocket':
      return <span className="text-2xl" role="img" aria-label="rocket">&#128640;</span>;
    default:
      return null;
  }
}

export default function OnboardingTour() {
  const { onboardingComplete, completeOnboarding } = useUIStore();
  const [step, setStep] = useState(0);
  const [targetRect, setTargetRect] = useState<DOMRect | null>(null);
  const [animating, setAnimating] = useState(false);

  const currentStep = TOUR_STEPS[step];
  const isLastStep = step === TOUR_STEPS.length - 1;
  const isCenter = currentStep.target === 'center' || currentStep.position === 'center';

  // Find target element
  useEffect(() => {
    if (onboardingComplete) return;
    if (isCenter) {
      setTargetRect(null);
      return;
    }
    // Small delay to let DOM settle after step change
    const timer = setTimeout(() => {
      const el = document.querySelector(`[data-tour="${currentStep.target}"]`);
      if (el) {
        setTargetRect(el.getBoundingClientRect());
      } else {
        setTargetRect(null);
      }
    }, 50);
    return () => clearTimeout(timer);
  }, [step, currentStep.target, isCenter, onboardingComplete]);

  // Animate step transitions
  const goToStep = useCallback((next: number) => {
    setAnimating(true);
    setTimeout(() => {
      setStep(next);
      setAnimating(false);
    }, 150);
  }, []);

  const handleNext = useCallback(() => {
    if (isLastStep) {
      completeOnboarding();
    } else {
      goToStep(step + 1);
    }
  }, [isLastStep, completeOnboarding, step, goToStep]);

  const handleBack = useCallback(() => {
    if (step > 0) goToStep(step - 1);
  }, [step, goToStep]);

  const handleSkip = useCallback(() => {
    completeOnboarding();
  }, [completeOnboarding]);

  // Keyboard navigation
  useEffect(() => {
    if (onboardingComplete) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        completeOnboarding();
      } else if (e.key === 'ArrowRight' || e.key === 'Enter') {
        handleNext();
      } else if (e.key === 'ArrowLeft') {
        handleBack();
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [onboardingComplete, completeOnboarding, handleNext, handleBack]);

  // Position the tooltip
  const tooltipStyle = useMemo((): React.CSSProperties => {
    if (isCenter || !targetRect) {
      return {
        position: 'fixed',
        top: '50%',
        left: '50%',
        transform: 'translate(-50%, -50%)',
      };
    }

    const gap = 16;
    const padding = 24;

    switch (currentStep.position) {
      case 'bottom':
        return {
          position: 'fixed',
          top: Math.min(targetRect.bottom + gap, window.innerHeight - 300),
          left: Math.max(padding, Math.min(targetRect.left + targetRect.width / 2, window.innerWidth - padding - 180)),
          transform: 'translateX(-50%)',
        };
      case 'top':
        return {
          position: 'fixed',
          top: Math.max(padding, targetRect.top - gap),
          left: Math.max(padding, Math.min(targetRect.left + targetRect.width / 2, window.innerWidth - padding - 180)),
          transform: 'translate(-50%, -100%)',
        };
      case 'right':
        return {
          position: 'fixed',
          top: Math.max(padding, Math.min(targetRect.top + targetRect.height / 2, window.innerHeight - padding - 150)),
          left: Math.min(targetRect.right + gap, window.innerWidth - padding - 360),
          transform: 'translateY(-50%)',
        };
      case 'left':
        return {
          position: 'fixed',
          top: Math.max(padding, Math.min(targetRect.top + targetRect.height / 2, window.innerHeight - padding - 150)),
          left: Math.max(padding, targetRect.left - gap),
          transform: 'translate(-100%, -50%)',
        };
      default:
        return {
          position: 'fixed',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
        };
    }
  }, [isCenter, targetRect, currentStep.position]);

  // Don't render if already completed
  if (onboardingComplete) return null;

  return (
    <div className="fixed inset-0 z-[10000]">
      {/* Overlay */}
      <div className="absolute inset-0 bg-black/50 transition-opacity duration-300" />

      {/* Highlight target with spotlight effect */}
      {!isCenter && targetRect && (
        <div
          className="absolute rounded-xl bg-transparent z-10 transition-all duration-300 ease-out ring-2 ring-white/80"
          style={{
            top: targetRect.top - 6,
            left: targetRect.left - 6,
            width: targetRect.width + 12,
            height: targetRect.height + 12,
            boxShadow: '0 0 0 9999px rgba(0,0,0,0.55), 0 0 24px 4px rgba(99,102,241,0.3)',
          }}
        />
      )}

      {/* Tooltip card */}
      <div
        className={`z-20 transition-opacity duration-150 ${animating ? 'opacity-0' : 'opacity-100'}`}
        style={tooltipStyle}
      >
        <div className={`w-[360px] rounded-2xl bg-white dark:bg-gray-800 shadow-2xl ring-1 ring-black/10 dark:ring-white/10 overflow-hidden ${step === 0 ? 'tour-tooltip-enter' : ''}`}>
          {/* Progress bar at top */}
          <div className="h-1 bg-gray-100 dark:bg-gray-700">
            <div
              className="h-full bg-gradient-to-r from-brand-400 to-brand-600 transition-all duration-500 ease-out rounded-r-full"
              style={{ width: `${((step + 1) / TOUR_STEPS.length) * 100}%` }}
            />
          </div>

          <div className="p-5">
            {/* Icon + step number */}
            <div className="flex items-center gap-3 mb-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gray-50 dark:bg-gray-700/50">
                <StepIcon type={currentStep.icon} />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="text-[15px] font-semibold text-gray-900 dark:text-gray-100 leading-tight">
                  {currentStep.title}
                </h3>
                <p className="text-[10px] text-gray-400 dark:text-gray-500 mt-0.5">
                  Step {step + 1} of {TOUR_STEPS.length}
                </p>
              </div>
            </div>

            {/* Description */}
            <p className="text-[13px] text-gray-600 dark:text-gray-300 leading-relaxed mb-1">
              {currentStep.description}
            </p>

            {/* Tip callout */}
            {currentStep.tip && (
              <div className="mt-3 flex items-start gap-2 rounded-lg bg-brand-50 dark:bg-brand-900/20 px-3 py-2">
                <svg className="h-4 w-4 text-brand-500 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 18v-5.25m0 0a6.01 6.01 0 0 0 1.5-.189m-1.5.189a6.01 6.01 0 0 1-1.5-.189m3.75 7.478a12.06 12.06 0 0 1-4.5 0m3.75 2.383a14.406 14.406 0 0 1-3 0M14.25 18v-.192c0-.983.658-1.823 1.508-2.316a7.5 7.5 0 1 0-7.517 0c.85.493 1.509 1.333 1.509 2.316V18" />
                </svg>
                <p className="text-[12px] text-brand-700 dark:text-brand-300 leading-relaxed">
                  {currentStep.tip}
                </p>
              </div>
            )}

            {/* Step dots */}
            <div className="flex items-center justify-center gap-1 mt-4 mb-4">
              {TOUR_STEPS.map((_, i) => (
                <button
                  key={i}
                  onClick={() => goToStep(i)}
                  className={`rounded-full transition-all duration-300 ${
                    i === step
                      ? 'h-2 w-6 bg-brand-500'
                      : i < step
                      ? 'h-2 w-2 bg-brand-300 hover:bg-brand-400'
                      : 'h-2 w-2 bg-gray-200 dark:bg-gray-600 hover:bg-gray-300 dark:hover:bg-gray-500'
                  }`}
                  title={`Go to step ${i + 1}`}
                />
              ))}
            </div>

            {/* Actions */}
            <div className="flex items-center justify-between">
              <button
                onClick={handleSkip}
                className="text-[12px] text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors py-1"
              >
                Skip tour
              </button>
              <div className="flex items-center gap-2">
                {step > 0 && (
                  <button
                    onClick={handleBack}
                    className="flex items-center gap-1 rounded-lg border border-gray-200 dark:border-gray-600 px-3 py-1.5 text-[12px] font-medium text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                  >
                    <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5 8.25 12l7.5-7.5" />
                    </svg>
                    Back
                  </button>
                )}
                <button
                  onClick={handleNext}
                  className="flex items-center gap-1.5 btn-primary px-4 py-1.5 text-[12px]"
                >
                  {isLastStep ? (
                    <>
                      Let's Go!
                      <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M15.59 14.37a6 6 0 0 1-5.84 7.38v-4.8m5.84-2.58a14.98 14.98 0 0 0 6.16-12.12A14.98 14.98 0 0 0 9.631 8.41m5.96 5.96a14.926 14.926 0 0 1-5.841 2.58m-.119-8.54a6 6 0 0 0-7.381 5.84h4.8m2.581-5.84a14.927 14.927 0 0 0-2.58 5.84m2.699 2.7c-.103.021-.207.041-.311.06a15.09 15.09 0 0 1-2.448-2.448 14.9 14.9 0 0 1 .06-.312m-2.24 2.39a4.493 4.493 0 0 0-1.757 4.306 4.493 4.493 0 0 0 4.306-1.758M16.5 9a1.5 1.5 0 1 1-3 0 1.5 1.5 0 0 1 3 0Z" />
                      </svg>
                    </>
                  ) : (
                    <>
                      Next
                      <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" d="m8.25 4.5 7.5 7.5-7.5 7.5" />
                      </svg>
                    </>
                  )}
                </button>
              </div>
            </div>

            {/* Keyboard hint */}
            <div className="mt-3 pt-3 border-t border-gray-100 dark:border-gray-700/50 flex items-center justify-center gap-3 text-[10px] text-gray-400 dark:text-gray-500">
              <span className="flex items-center gap-1">
                <kbd className="inline-flex items-center justify-center min-w-[18px] rounded bg-gray-100 dark:bg-gray-700 px-1 py-0.5 font-mono text-[9px]">&larr;</kbd>
                <kbd className="inline-flex items-center justify-center min-w-[18px] rounded bg-gray-100 dark:bg-gray-700 px-1 py-0.5 font-mono text-[9px]">&rarr;</kbd>
                Navigate
              </span>
              <span className="flex items-center gap-1">
                <kbd className="inline-flex items-center justify-center rounded bg-gray-100 dark:bg-gray-700 px-1.5 py-0.5 font-mono text-[9px]">Esc</kbd>
                Skip
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
