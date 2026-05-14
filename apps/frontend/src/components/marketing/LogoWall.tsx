import { ReactNode } from 'react';

export interface LogoWallItem {
  /** Display name (also used for alt-text fallback). */
  name: string;
  /** Optional logo SVG / image src. If absent, renders the name as text. */
  src?: string;
  /** Optional click-through. */
  href?: string;
}

interface LogoWallProps {
  items: LogoWallItem[];
  eyebrow?: ReactNode;
  className?: string;
}

/**
 * Grid of small university / journal / institutional logos. Used on
 * `/customers`, `/for-institutions`, `/for-teams`.
 *
 * Gracefully renders fewer than the design's 8–12 target — placeholder
 * text-only items keep the surface honest while logo permissions are
 * being collected (see docs/refresh/10 R12).
 */
export default function LogoWall({ items, eyebrow, className = '' }: LogoWallProps) {
  if (items.length === 0) return null;
  return (
    <div className={className}>
      {eyebrow && (
        <div className="text-xs font-semibold uppercase tracking-[0.08em] text-gray-500 dark:text-gray-400 mb-6 text-center">
          {eyebrow}
        </div>
      )}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 items-center justify-items-center gap-y-8 gap-x-12">
        {items.map((item) => {
          const content = item.src ? (
            <img
              src={item.src}
              alt={item.name}
              className="max-h-8 w-auto opacity-70 hover:opacity-100 transition-opacity duration-150"
            />
          ) : (
            <span className="text-sm text-gray-400 dark:text-gray-500 font-medium">{item.name}</span>
          );
          return item.href ? (
            <a key={item.name} href={item.href} target="_blank" rel="noopener noreferrer" className="block">
              {content}
            </a>
          ) : (
            <div key={item.name}>{content}</div>
          );
        })}
      </div>
    </div>
  );
}
