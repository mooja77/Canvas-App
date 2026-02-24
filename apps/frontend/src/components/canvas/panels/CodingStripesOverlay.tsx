import { useMemo } from 'react';
import type { CanvasTextCoding, CanvasQuestion } from '@canvas-app/shared';

interface CodingStripesOverlayProps {
  contentLength: number;
  codings: CanvasTextCoding[];
  questions: { id: string; color: string }[];
  containerHeight: number;
}

export default function CodingStripesOverlay({
  contentLength,
  codings,
  questions,
  containerHeight,
}: CodingStripesOverlayProps) {
  const colorMap = useMemo(() => {
    const map = new Map<string, string>();
    questions.forEach(q => map.set(q.id, q.color));
    return map;
  }, [questions]);

  // Group codings by question for stripe lanes
  const stripes = useMemo(() => {
    const qIds = [...new Set(codings.map(c => c.questionId))];
    return qIds.map((qId, laneIndex) => {
      const color = colorMap.get(qId) || '#6B7280';
      const qCodings = codings.filter(c => c.questionId === qId);
      const segments = qCodings.map(c => ({
        top: (c.startOffset / contentLength) * containerHeight,
        height: Math.max(2, ((c.endOffset - c.startOffset) / contentLength) * containerHeight),
      }));
      return { qId, color, laneIndex, segments };
    });
  }, [codings, colorMap, contentLength, containerHeight]);

  if (stripes.length === 0) return null;

  return (
    <div className="absolute left-0 top-0 h-full flex" style={{ width: stripes.length * 6 }}>
      {stripes.map(stripe => (
        <div key={stripe.qId} className="relative" style={{ width: 5, marginRight: 1 }}>
          {stripe.segments.map((seg, i) => (
            <div
              key={i}
              className="absolute rounded-sm"
              style={{
                top: seg.top,
                height: seg.height,
                width: '100%',
                backgroundColor: stripe.color,
                opacity: 0.6,
              }}
            />
          ))}
        </div>
      ))}
    </div>
  );
}
