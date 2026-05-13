import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import Screen1_Personalization from './Screen1_Personalization';
import Screen2_TemplateGallery from './Screen2_TemplateGallery';
import { templateApi, type CanvasTemplate } from '../../services/api';
import { trackEvent } from '../../utils/analytics';
import { markOnboardingComplete, patchOnboardingState } from './utils/onboardingState';
import { useCanvasStore } from '../../stores/canvasStore';

interface Props {
  onClose: () => void;
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
export default function OnboardingFlow({ onClose }: Props) {
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const [busy, setBusy] = useState(false);
  const [preferredMethod, setPreferredMethod] = useState<string>('interviews');
  const startedAtRef = useRef<number>(Date.now());
  const openCanvas = useCanvasStore((s) => s.openCanvas);
  const fetchCanvases = useCanvasStore((s) => s.fetchCanvases);

  useEffect(() => {
    trackEvent('onboarding_started', { step: 1 });
    void patchOnboardingState({ currentStep: 1, startedAt: new Date().toISOString() });
  }, []);

  const finish = useCallback(
    async (mode: 'completed' | 'skipped') => {
      const totalSeconds = Math.round((Date.now() - startedAtRef.current) / 1000);
      if (mode === 'completed') {
        trackEvent('onboarding_completed_seconds', { total_seconds: totalSeconds });
        await markOnboardingComplete();
      }
      onClose();
    },
    [onClose],
  );

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
          // Blank canvas — defer to the existing /canvas list view so the user
          // creates one via the normal "+ New canvas" path. This avoids us
          // duplicating the canvas-create endpoint here.
          trackEvent('onboarding_step_completed', { step: 2, template: 'blank' });
          await finish('completed');
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
        navigate('/canvas');
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
    [busy, finish, fetchCanvases, navigate, openCanvas],
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="w-full max-w-3xl rounded-2xl bg-white dark:bg-gray-900 shadow-2xl p-6 sm:p-8">
        {/* Progress dots */}
        <div className="flex items-center justify-center gap-2 mb-6">
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
