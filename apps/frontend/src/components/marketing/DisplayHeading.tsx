import { ElementType, ReactNode } from 'react';

type DisplaySize = 'xl' | 'lg' | 'md';

interface DisplayHeadingProps {
  as?: ElementType;
  size?: DisplaySize;
  children: ReactNode;
  className?: string;
}

/**
 * Fraunces display heading with optical-size axis tuning per
 * docs/refresh/04 §4.2.
 *
 *   xl  88 / 56  weight 540  opsz 144  -2% tracking  1.05 lh   — Hero
 *   lg  64 / 44  weight 560  opsz 96   -1.5%          1.10     — Section heads
 *   md  48 / 36  weight 580  opsz 72   -1%            1.15     — Page H1s
 *
 * Word-stagger reveal lives in future enhancement; reduced-motion guard
 * is via existing CSS `prefers-reduced-motion` block in index.css line 530.
 */
const SIZE_CLASSES: Record<DisplaySize, string> = {
  xl: 'text-[56px] sm:text-[72px] lg:text-[88px] leading-[1.05] tracking-[-0.02em]',
  lg: 'text-[44px] sm:text-[56px] lg:text-[64px] leading-[1.10] tracking-[-0.015em]',
  md: 'text-[36px] sm:text-[42px] lg:text-[48px] leading-[1.15] tracking-[-0.01em]',
};

const SIZE_VARIATION: Record<DisplaySize, string> = {
  xl: "'opsz' 144, 'wght' 540",
  lg: "'opsz' 96, 'wght' 560",
  md: "'opsz' 72, 'wght' 580",
};

export default function DisplayHeading({ as: Tag = 'h1', size = 'xl', children, className = '' }: DisplayHeadingProps) {
  return (
    <Tag
      className={`font-display text-gray-900 dark:text-white ${SIZE_CLASSES[size]} ${className}`}
      style={{
        fontFeatureSettings: '"ss01", "ss02"',
        fontVariationSettings: SIZE_VARIATION[size],
      }}
    >
      {children}
    </Tag>
  );
}
