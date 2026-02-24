import { useRef, useEffect } from 'react';

const PRESET_COLORS = [
  '#EF4444', '#F97316', '#F59E0B', '#84CC16',
  '#22C55E', '#14B8A6', '#06B6D4', '#3B82F6',
  '#6366F1', '#8B5CF6', '#A855F7', '#D946EF',
  '#EC4899', '#F43F5E', '#78716C', '#6B7280',
];

interface ColorPickerProps {
  color: string;
  onChange: (color: string) => void;
  onClose: () => void;
}

export default function ColorPicker({ color, onChange, onClose }: ColorPickerProps) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as HTMLElement)) onClose();
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [onClose]);

  return (
    <div ref={ref} className="popover-enter rounded-xl bg-white dark:bg-gray-800 p-2.5 shadow-lg border border-gray-200 dark:border-gray-700 w-[180px]">
      <p className="text-[9px] font-semibold uppercase tracking-wider text-gray-400 dark:text-gray-500 mb-2 px-0.5">Code color</p>
      <div className="grid grid-cols-4 gap-1.5">
        {PRESET_COLORS.map(c => (
          <button
            key={c}
            onClick={() => { onChange(c); onClose(); }}
            className={`h-8 w-8 rounded-lg transition-all duration-100 hover:scale-110 focus:outline-none ${
              c === color
                ? 'ring-2 ring-offset-2 ring-gray-400 dark:ring-gray-500 dark:ring-offset-gray-800 scale-110'
                : 'hover:ring-1 hover:ring-gray-300 dark:hover:ring-gray-600'
            }`}
            style={{ backgroundColor: c }}
            title={c}
          />
        ))}
      </div>
    </div>
  );
}
