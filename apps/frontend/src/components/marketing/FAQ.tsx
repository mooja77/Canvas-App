import { ReactNode } from 'react';

export interface FAQItem {
  question: ReactNode;
  answer: ReactNode;
}

interface FAQProps {
  items: FAQItem[];
  className?: string;
}

/**
 * Editorial FAQ accordion. Semantic <details>/<summary> for keyboard +
 * screen-reader friendliness with zero JS. Component states matrix per
 * docs/refresh/04 §4.9.
 */
export default function FAQ({ items, className = '' }: FAQProps) {
  return (
    <div className={`divide-y divide-gray-200 dark:divide-gray-800 ${className}`}>
      {items.map((item, idx) => (
        <details key={idx} className="group py-2">
          <summary
            className="
              flex items-start justify-between gap-4
              cursor-pointer list-none
              py-4 px-2
              text-left
              text-base sm:text-lg font-medium text-gray-900 dark:text-white
              rounded
              hover:bg-gray-50 dark:hover:bg-gray-800/60
              focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ochre-400 focus-visible:ring-offset-2
            "
          >
            <span className="flex-1">{item.question}</span>
            <svg
              className="w-5 h-5 flex-shrink-0 text-gray-400 group-open:rotate-180 transition-transform duration-150 mt-0.5"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={1.5}
              stroke="currentColor"
              aria-hidden="true"
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
            </svg>
          </summary>
          <div className="px-2 pb-4 text-base text-gray-600 dark:text-gray-300 leading-relaxed max-w-3xl">
            {item.answer}
          </div>
        </details>
      ))}
    </div>
  );
}
