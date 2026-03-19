import React from 'react';

interface CursorData {
  x: number;
  y: number;
  name: string;
  color: string;
}

interface CollabCursorsProps {
  cursors: Map<string, CursorData>;
}

export default function CollabCursors({ cursors }: CollabCursorsProps) {
  if (cursors.size === 0) return null;

  return (
    <>
      {Array.from(cursors.entries()).map(([userId, cursor]) => (
        <div
          key={userId}
          className="fixed pointer-events-none z-[9999] transition-all duration-75"
          style={{
            left: cursor.x,
            top: cursor.y,
            transform: 'translate(-2px, -2px)',
          }}
        >
          {/* Cursor arrow SVG */}
          <svg
            width="16"
            height="20"
            viewBox="0 0 16 20"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path
              d="M0 0L16 12L8 12L5 20L0 0Z"
              fill={cursor.color}
              stroke="white"
              strokeWidth="1"
            />
          </svg>
          {/* Name label */}
          <div
            className="absolute left-4 top-4 px-1.5 py-0.5 rounded text-[10px] font-medium text-white whitespace-nowrap shadow-sm"
            style={{ backgroundColor: cursor.color }}
          >
            {cursor.name}
          </div>
        </div>
      ))}
    </>
  );
}
