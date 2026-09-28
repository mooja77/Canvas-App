import { lazy, Suspense, useEffect } from 'react';
import { useAiConfigStore } from '../../stores/aiConfigStore';

const ConnectAiWizard = lazy(() => import('./ConnectAiWizard'));

/**
 * One app-wide "Connect your AI account" wizard. Opened from Account → AI,
 * from the audio-transcription screen, from any AI feature used without a key
 * (requireAiConfig in the canvas), and whenever the API answers
 * AI_KEY_REQUIRED (services/api.ts dispatches 'ai-key-required').
 */
export default function ConnectAiWizardHost() {
  const wizard = useAiConfigStore((s) => s.wizard);
  const openWizard = useAiConfigStore((s) => s.openWizard);
  const closeWizard = useAiConfigStore((s) => s.closeWizard);

  useEffect(() => {
    const onKeyRequired = () => {
      if (!useAiConfigStore.getState().wizard.open) openWizard('This AI feature');
    };
    window.addEventListener('ai-key-required', onKeyRequired);
    return () => window.removeEventListener('ai-key-required', onKeyRequired);
  }, [openWizard]);

  if (!wizard.open) return null;
  return (
    <Suspense fallback={null}>
      <ConnectAiWizard onClose={closeWizard} reason={wizard.reason} initialProvider={wizard.provider} />
    </Suspense>
  );
}
