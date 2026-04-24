/**
 * Generates a tiny SVG abstraction of a canvas from its counts.
 *
 * Not a true preview — we don't render actual nodes or positions
 * (that would require a headless render step we don't have). Instead
 * we lay out proxy shapes: blue rectangles for transcripts, orange
 * circles for questions/codes, and thin connector lines hinting at
 * codings. The result differentiates cards at a glance and scales
 * sensibly for canvases with very few or many nodes.
 */

interface Props {
  transcriptCount: number;
  questionCount: number;
  codingCount: number;
  className?: string;
}

const W = 240;
const H = 84;
const MAX_TRANSCRIPTS = 6;
const MAX_QUESTIONS = 8;

export default function CanvasThumbnail({ transcriptCount, questionCount, codingCount, className = '' }: Props) {
  // Deterministic "seed" per canvas shape so thumbnails are stable
  // across renders. Cheap hash from the counts.
  const seed = transcriptCount * 97 + questionCount * 31 + codingCount;
  const jitter = (i: number, range: number) => {
    const x = Math.sin(seed + i * 7.919) * 10000;
    return (x - Math.floor(x) - 0.5) * range;
  };

  const transcripts = Math.min(transcriptCount, MAX_TRANSCRIPTS);
  const questions = Math.min(questionCount, MAX_QUESTIONS);

  // Left column: transcript rectangles stacked.
  const txPositions = Array.from({ length: transcripts }, (_, i) => ({
    x: 12 + jitter(i, 2),
    y: 10 + i * ((H - 24) / Math.max(transcripts, 1)) + jitter(i + 50, 2),
    w: 44,
    h: Math.max(6, (H - 24) / Math.max(transcripts, 1) - 4),
  }));

  // Right column: question/code circles arranged.
  const qPositions = Array.from({ length: questions }, (_, i) => {
    const col = i % 2;
    const row = Math.floor(i / 2);
    const rows = Math.max(1, Math.ceil(questions / 2));
    return {
      cx: W - 44 + col * 22 + jitter(i + 100, 2),
      cy: 14 + row * ((H - 28) / rows) + jitter(i + 150, 2),
      r: 5,
    };
  });

  // A few connector lines to hint at codings (capped so busy canvases
  // don't become spaghetti).
  const links = Array.from({ length: Math.min(codingCount, 8, transcripts * questions) }, (_, i) => {
    const t = txPositions[i % Math.max(txPositions.length, 1)];
    const q = qPositions[i % Math.max(qPositions.length, 1)];
    if (!t || !q) return null;
    return {
      x1: t.x + t.w,
      y1: t.y + t.h / 2,
      x2: q.cx - q.r,
      y2: q.cy,
    };
  }).filter(Boolean);

  const isEmpty = transcriptCount + questionCount === 0;

  return (
    <svg
      role="img"
      aria-label={
        isEmpty
          ? 'Empty canvas'
          : `Canvas with ${transcriptCount} transcript${transcriptCount === 1 ? '' : 's'}, ${questionCount} code${questionCount === 1 ? '' : 's'}, ${codingCount} coding${codingCount === 1 ? '' : 's'}`
      }
      viewBox={`0 0 ${W} ${H}`}
      className={`w-full h-16 rounded-md bg-gradient-to-br from-blue-50/40 to-purple-50/40 dark:from-gray-700/40 dark:to-gray-600/20 ring-1 ring-gray-100 dark:ring-gray-700 ${className}`}
    >
      {/* Background dots — match the canvas workspace grid */}
      <defs>
        <pattern id="dots" x="0" y="0" width="12" height="12" patternUnits="userSpaceOnUse">
          <circle cx="2" cy="2" r="0.7" className="fill-gray-300/60 dark:fill-gray-500/40" />
        </pattern>
      </defs>
      <rect width={W} height={H} fill="url(#dots)" />

      {isEmpty ? (
        <text
          x={W / 2}
          y={H / 2 + 4}
          textAnchor="middle"
          className="fill-gray-400 dark:fill-gray-500 text-[11px] font-medium"
        >
          Empty canvas
        </text>
      ) : (
        <>
          {/* Connectors under nodes */}
          {links.map((l, i) => (
            <line
              key={`l-${i}`}
              x1={l!.x1}
              y1={l!.y1}
              x2={l!.x2}
              y2={l!.y2}
              strokeWidth={1}
              className="stroke-gray-300 dark:stroke-gray-500/70"
            />
          ))}
          {/* Transcript rectangles */}
          {txPositions.map((t, i) => (
            <rect
              key={`t-${i}`}
              x={t.x}
              y={t.y}
              width={t.w}
              height={t.h}
              rx={2}
              className="fill-blue-400 dark:fill-blue-500"
              opacity={0.85}
            />
          ))}
          {/* Question circles */}
          {qPositions.map((q, i) => (
            <circle
              key={`q-${i}`}
              cx={q.cx}
              cy={q.cy}
              r={q.r}
              className="fill-purple-500 dark:fill-purple-400"
              opacity={0.9}
            />
          ))}
        </>
      )}
    </svg>
  );
}
