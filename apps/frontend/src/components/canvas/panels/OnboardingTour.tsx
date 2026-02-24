import { useState, useEffect, useCallback, useMemo } from 'react';
import { useUIStore } from '../../../stores/uiStore';

interface TourStep {
  target: string; // data-tour attribute value or 'center'
  title: string;
  description: string;
  position: 'top' | 'bottom' | 'left' | 'right' | 'center';
}

const TOUR_STEPS: TourStep[] = [
  {
    target: 'center',
    title: 'Welcome to Canvas',
    description: 'A professional qualitative research coding workspace. Let\'s take a quick tour to get you started.',
    position: 'center',
  },
  {
    target: 'canvas-toolbar',
    title: 'Your Toolbar',
    description: 'Add transcripts, codes, and memos here. Use "Analyze" to add powerful analysis views like word clouds and statistics.',
    position: 'bottom',
  },
  {
    target: 'canvas-flow-area',
    title: 'Your Canvas',
    description: 'Double-click anywhere to quickly add nodes. Drag between transcript and code nodes to create codings. Right-click for more options.',
    position: 'center',
  },
  {
    target: 'center',
    title: 'Pro Tips',
    description: 'Press Ctrl+K for the command palette, ? for keyboard shortcuts, and F to fit view. Select text in a transcript to code it.',
    position: 'center',
  },
];

export default function OnboardingTour() {
  const { onboardingComplete, completeOnboarding } = useUIStore();
  const [step, setStep] = useState(0);
  const [targetRect, setTargetRect] = useState<DOMRect | null>(null);

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
    const el = document.querySelector(`[data-tour="${currentStep.target}"]`);
    if (el) {
      setTargetRect(el.getBoundingClientRect());
    }
  }, [step, currentStep.target, isCenter, onboardingComplete]);

  const handleNext = useCallback(() => {
    if (isLastStep) {
      completeOnboarding();
    } else {
      setStep(s => s + 1);
    }
  }, [isLastStep, completeOnboarding]);

  const handleSkip = useCallback(() => {
    completeOnboarding();
  }, [completeOnboarding]);

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

    const gap = 12;
    switch (currentStep.position) {
      case 'bottom':
        return {
          position: 'fixed',
          top: targetRect.bottom + gap,
          left: targetRect.left + targetRect.width / 2,
          transform: 'translateX(-50%)',
        };
      case 'top':
        return {
          position: 'fixed',
          top: targetRect.top - gap,
          left: targetRect.left + targetRect.width / 2,
          transform: 'translate(-50%, -100%)',
        };
      case 'right':
        return {
          position: 'fixed',
          top: targetRect.top + targetRect.height / 2,
          left: targetRect.right + gap,
          transform: 'translateY(-50%)',
        };
      case 'left':
        return {
          position: 'fixed',
          top: targetRect.top + targetRect.height / 2,
          left: targetRect.left - gap,
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
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" />

      {/* Highlight target */}
      {!isCenter && targetRect && (
        <div
          className="absolute rounded-xl ring-4 ring-brand-400/60 bg-transparent z-10"
          style={{
            top: targetRect.top - 4,
            left: targetRect.left - 4,
            width: targetRect.width + 8,
            height: targetRect.height + 8,
            boxShadow: '0 0 0 9999px rgba(0,0,0,0.5)',
          }}
        />
      )}

      {/* Tooltip */}
      <div
        className="z-20 tour-tooltip-enter"
        style={tooltipStyle}
      >
        <div className="w-80 rounded-2xl bg-white dark:bg-gray-800 p-5 shadow-2xl ring-1 ring-black/10 dark:ring-white/10">
          {/* Step indicator */}
          <div className="flex items-center gap-1.5 mb-3">
            {TOUR_STEPS.map((_, i) => (
              <div
                key={i}
                className={`h-1 rounded-full transition-all duration-300 ${
                  i === step ? 'w-6 bg-brand-500' : i < step ? 'w-3 bg-brand-300' : 'w-3 bg-gray-200 dark:bg-gray-700'
                }`}
              />
            ))}
          </div>

          <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-1.5">
            {currentStep.title}
          </h3>
          <p className="text-xs text-gray-600 dark:text-gray-400 leading-relaxed mb-4">
            {currentStep.description}
          </p>

          <div className="flex items-center justify-between">
            <button
              onClick={handleSkip}
              className="text-xs text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
            >
              Skip tour
            </button>
            <div className="flex items-center gap-2">
              {step > 0 && (
                <button
                  onClick={() => setStep(s => s - 1)}
                  className="rounded-lg border border-gray-200 dark:border-gray-700 px-3 py-1.5 text-xs font-medium text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-750 transition-colors"
                >
                  Back
                </button>
              )}
              <button
                onClick={handleNext}
                className="btn-primary px-4 py-1.5 text-xs"
              >
                {isLastStep ? 'Get Started' : 'Next'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
