/**
 * "Need help?" link shown on research screens (canvas, repository, team).
 *
 * The support chat widget is deliberately not loaded on those screens, because
 * they can show interview and coding content. This plain anchor (not a router
 * Link, so it is a full page load into the support shell) takes the user to the
 * /support screen, where the widget lives. Help stays one click away without
 * the widget sitting beside the data.
 */
export default function NeedHelpLink({ className }: { className?: string }) {
  return (
    <a
      href="/support"
      className={
        className ??
        'text-sm text-brand-600 dark:text-brand-400 hover:underline focus-visible:outline focus-visible:outline-2'
      }
    >
      Need help?
    </a>
  );
}
