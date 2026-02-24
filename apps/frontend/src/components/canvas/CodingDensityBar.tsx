import { useMemo } from 'react';
import type { CanvasTextCoding } from '@canvas-app/shared';

interface CodingDensityBarProps {
  contentLength: number;
  codings: CanvasTextCoding[];
  questions: { id: string; color: string }[];
  height: number;
}

export default function CodingDensityBar({
  contentLength,
  codings,
  questions,
  height,
}: CodingDensityBarProps) {
  const colorMap = useMemo(() => {
    const map = new Map<string, string>();
    questions.forEach(q => map.set(q.id, q.color));
    return map;
  }, [questions]);

  const segments = useMemo(() => {
    if (contentLength === 0 || codings.length === 0) return [];

    return codings.map(c => {
      const top = (c.startOffset / contentLength) * height;
      const segHeight = Math.max(2, ((c.endOffset - c.startOffset) / contentLength) * height);
      const color = colorMap.get(c.questionId) || '#6B7280';
      return { top, height: segHeight, color, id: c.id };
    });
  }, [codings, contentLength, height, colorMap]);

  if (segments.length === 0) return null;

  // Uncoded region is transparent (gray bg shows through)
  return (
    <div
      className="absolute left-0 top-0 rounded-sm bg-gray-100 dark:bg-gray-700/30"
      style={{ width: 8, height }}
    >
      {segments.map(seg => (
        <div
          key={seg.id}
          className="absolute rounded-sm"
          style={{
            top: seg.top,
            height: seg.height,
            width: '100%',
            backgroundColor: seg.color,
            opacity: 0.7,
          }}
        />
      ))}
    </div>
  );
}
