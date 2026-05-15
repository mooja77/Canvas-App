import { ReactNode } from 'react';

interface EditorialAsideProps {
  children: ReactNode;
}

/**
 * Inset editorial paragraph — Fraunces italic, ochre hairlines above and below.
 * Used in /methodology chapters for anticipated objections, real-world caveats,
 * methodological side-quests that would otherwise interrupt the main argument.
 * Spec: docs/refresh/06-pages/03-methodology.md.
 */
export default function EditorialAside({ children }: EditorialAsideProps) {
  return (
    <aside className="my-12">
      <div className="border-y border-ochre-500/40 py-6">
        <p
          className="font-display italic text-base sm:text-lg leading-[1.65] text-gray-700 dark:text-gray-300"
          style={{ fontVariationSettings: "'wght' 400", letterSpacing: '-0.003em' }}
        >
          {children}
        </p>
      </div>
    </aside>
  );
}
