import { useThemePreferenceStore, ThemePreference } from '../../stores/themePreferenceStore';
import { trackEvent } from '../../utils/analytics';

const ORDER: ThemePreference[] = ['system', 'light', 'dark'];

const ICONS: Record<ThemePreference, React.ReactNode> = {
  system: (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M9 17.25v1.007a3 3 0 0 1-.879 2.122L7.5 21h9l-.621-.621A3 3 0 0 1 15 18.257V17.25m6-12V15a2.25 2.25 0 0 1-2.25 2.25H5.25A2.25 2.25 0 0 1 3 15V5.25m18 0A2.25 2.25 0 0 0 18.75 3H5.25A2.25 2.25 0 0 0 3 5.25m18 0V12a2.25 2.25 0 0 1-2.25 2.25H5.25A2.25 2.25 0 0 1 3 12V5.25"
      />
    </svg>
  ),
  light: (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M12 3v2.25m6.364.386-1.591 1.591M21 12h-2.25m-.386 6.364-1.591-1.591M12 18.75V21m-4.773-4.227-1.591 1.591M5.25 12H3m4.227-4.773L5.636 5.636M15.75 12a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0Z"
      />
    </svg>
  ),
  dark: (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M21.752 15.002A9.72 9.72 0 0 1 18 15.75c-5.385 0-9.75-4.365-9.75-9.75 0-1.33.266-2.597.748-3.752A9.753 9.753 0 0 0 3 11.25C3 16.635 7.365 21 12.75 21a9.753 9.753 0 0 0 9.002-5.998Z"
      />
    </svg>
  ),
};

const LABELS: Record<ThemePreference, string> = {
  system: 'System theme',
  light: 'Light theme',
  dark: 'Dark theme',
};

/**
 * Three-state theme toggle for the marketing footer. Cycles
 * system → light → dark → system on click. State persisted via
 * themePreferenceStore; system mode follows prefers-color-scheme.
 *
 * Spec: docs/refresh/06-pages/14-site-footer.md
 */
export default function ThemeToggle() {
  const preference = useThemePreferenceStore((s) => s.preference);
  const setPreference = useThemePreferenceStore((s) => s.setPreference);

  const handleClick = () => {
    const currentIndex = ORDER.indexOf(preference);
    const next = ORDER[(currentIndex + 1) % ORDER.length];
    setPreference(next);
    trackEvent('theme_preference_changed', { new_value: next });
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      aria-label={`Theme: ${LABELS[preference]}. Click to cycle.`}
      title={LABELS[preference]}
      className="
        inline-flex items-center gap-1.5
        text-xs font-medium
        text-gray-500 dark:text-gray-400
        hover:text-gray-900 dark:hover:text-white
        focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2
        focus-visible:ring-brand-500
        rounded
        px-2 py-1
        transition-colors duration-150
      "
    >
      {ICONS[preference]}
      <span className="hidden sm:inline">{LABELS[preference].replace(' theme', '')}</span>
    </button>
  );
}
