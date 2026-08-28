import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import Screen1_Personalization from './Screen1_Personalization';
import Screen2_TemplateGallery from './Screen2_TemplateGallery';
import { templateApi, type CanvasTemplate } from '../../services/api';
import { trackEvent } from '../../utils/analytics';
import { markOnboardingComplete, patchOnboardingState } from './utils/onboardingState';
import { useCanvasStore } from '../../stores/canvasStore';
import { useEscapeToClose } from '../../hooks/useEscapeToClose';
import { useFocusTrap } from '../../hooks/useFocusTrap';

interface Props {
  onClose: () => void;
  initialState?: {
    currentStep?: number;
    personalization?: { method?: string };
  };
}

/**
 * Sprint F onboarding flow. Two pre-canvas screens collect personalization +
 * template choice, then the user lands on a real canvas seeded with sample
 * data. The remaining "screens" from the spec (transcript ingest, AI codes,
 * first manual code) are achieved by:
 *   - the template seeding a sample transcript and starter codes already
 *   - the existing text-selection → quick-code flow on the canvas
 *   - the canvasStore firing `first_excerpt_coded` once the user codes anything
 * That keeps the user in the real product as fast as possible rather than
 * forcing them through more synthetic "screens".
 */
export default function OnboardingFlow({ onClose, initialState }: Props) {
  const navigate = useNavigate();
  const [step, setStep] = useState(initialState?.currentStep === 2 ? 2 : 1);
  const [busy, setBusy] = useState(false);
  const [preferredMethod, setPreferredMethod] = useState<string>(initialState?.personalization?.method || 'interviews');
  const startedAtRef = useRef<number>(Date.now());
  const dialogRef = useRef<HTMLDivElement>(null);
  const openCanvas = useCanvasStore((s) => s.openCanvas);
  const fetchCanvases = useCanvasStore((s) => s.fetchCanvases);
  const createCanvas = useCanvasStore((s) => s.createCanvas);

  useEffect(() => {
    trackEvent('onboarding_started', { step });
    void patchOnboardingState({ currentStep: step, startedAt: new Date().toISOString() });
    // The initial step is intentionally captured once: mounting this component
    // now means the surface is actually visible, not merely eligible between effects.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const finish = useCallback(
    async (mode: 'completed' | 'skipped') => {
      const totalSeconds = Math.round((Date.now() - startedAtRef.current) / 1000);
      await patchOnboardingState({
        completionMode: mode,
        completedAtClient: new Date().toISOString(),
      });
      if (mode === 'completed') {
        trackEvent('onboarding_completed_seconds', { total_seconds: totalSeconds });
      }
      // A deliberate skip is also a completed onboarding decision. Persist it
      // so another browser does not force the flow back over the workspace.
      await markOnboardingComplete();
      onClose();
    },
    [onClose],
  );

  const handleEscape = useCallback(() => {
    // Do not abandon a canvas while its creation request is in flight.
    if (!busy) void finish('skipped');
  }, [busy, finish]);
  useEscapeToClose(handleEscape);
  useFocusTrap(dialogRef, true);

  const handlePersonalization = useCallback((answers: { researchTopic: string; method: string; solo: boolean }) => {
    trackEvent('onboarding_step_completed', {
      step: 1,
      seconds_elapsed: Math.round((Date.now() - startedAtRef.current) / 1000),
    });
    void patchOnboardingState({
      currentStep: 2,
      personalization: answers,
    });
    setPreferredMethod(answers.method);
    setStep(2);
  }, []);

  const handleTemplatePick = useCallback(
    async (tmpl: CanvasTemplate | null, includeSample: boolean) => {
      if (busy) return;
      setBusy(true);
      try {
        if (!tmpl) {
          // "Blank canvas" should create the blank canvas it promises. The old
          // path closed onboarding onto an empty list and left activation for a
          // separate, easy-to-miss action.
          trackEvent('onboarding_step_completed', { step: 2, template: 'blank' });
          const blankCanvas = await createCanvas('Untitled research project');
          await openCanvas(blankCanvas.id);
          await finish('completed');
          toast.success('Blank canvas ready — add a transcript when you are ready.', { duration: 5000 });
          navigate(`/canvas/${blankCanvas.id}`);
          return;
        }

        const res = await templateApi.instantiate(tmpl.id, {
          canvasName: tmpl.name,
          includeSampleData: includeSample,
        });
        const newCanvas = res.data.data;
        trackEvent('onboarding_step_completed', { step: 2, template_id: tmpl.id });
        void patchOnboardingState({ templateChoice: { id: tmpl.id, name: tmpl.name } });

        await fetchCanvases();
        await openCanvas(newCanvas.id);

        // Mark completion now (the user can still fall out of the canvas
        // coachmarks, but the flow as a whole counts as completed once
        // they've made it onto a seeded canvas).
        await finish('completed');
        toast.success('Canvas ready — try highlighting any sentence to add a code.', { duration: 5000 });
        navigate(`/canvas/${newCanvas.id}`);
      } catch (err: unknown) {
        const message =
          err && typeof err === 'object' && 'response' in err
            ? // eslint-disable-next-line @typescript-eslint/no-explicit-any
              ((err as any).response?.data?.error ?? 'Could not create canvas')
            : 'Could not create canvas';
        toast.error(message);
        setBusy(false);
      }
    },
    [busy, createCanvas, finish, fetchCanvases, navigate, openCanvas],
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="onboarding-dialog-title"
        className="w-full max-w-3xl rounded-2xl bg-white p-6 shadow-2xl dark:bg-gray-900 sm:p-8"
      >
        <h1 id="onboarding-dialog-title" className="sr-only">
          Set up your QualCanvas workspace
        </h1>
        {/* Progress dots */}
        <div className="mb-6 flex items-center justify-center gap-2" aria-hidden="true">
          {[1, 2].map((n) => (
            <div
              key={n}
              className={`h-1.5 rounded-full transition-all ${
                n === step ? 'w-8 bg-brand-500' : n < step ? 'w-4 bg-brand-300' : 'w-4 bg-gray-200 dark:bg-gray-700'
              }`}
            />
          ))}
        </div>

        {step === 1 && <Screen1_Personalization onContinue={handlePersonalization} onSkip={() => finish('skipped')} />}
        {step === 2 && (
          <Screen2_TemplateGallery
            preferredMethod={preferredMethod}
            onSelect={handleTemplatePick}
            onSkip={() => finish('skipped')}
          />
        )}
      </div>
    </div>
  );
}
