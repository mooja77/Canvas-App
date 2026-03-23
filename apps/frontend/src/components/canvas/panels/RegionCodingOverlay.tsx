import { useState, useCallback, useRef } from 'react';
import type { CanvasQuestion, DocumentRegionCoding } from '@qualcanvas/shared';

interface RegionCodingOverlayProps {
  documentId: string;
  pageNumber: number;
  questions: CanvasQuestion[];
  regions: DocumentRegionCoding[];
  selectedQuestionId: string | null;
  onCreateRegion: (region: { questionId: string; pageNumber: number; x: number; y: number; width: number; height: number; note?: string }) => void;
  onDeleteRegion: (regionId: string) => void;
}

interface DrawingRect {
  startX: number;
  startY: number;
  currentX: number;
  currentY: number;
}

export default function RegionCodingOverlay({
  pageNumber,
  questions,
  regions,
  selectedQuestionId,
  onCreateRegion,
  onDeleteRegion,
}: RegionCodingOverlayProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [drawing, setDrawing] = useState<DrawingRect | null>(null);
  const [hoveredRegion, setHoveredRegion] = useState<string | null>(null);

  const getRelativePosition = useCallback((e: React.MouseEvent) => {
    if (!containerRef.current) return { x: 0, y: 0 };
    const rect = containerRef.current.getBoundingClientRect();
    return {
      x: ((e.clientX - rect.left) / rect.width) * 100,
      y: ((e.clientY - rect.top) / rect.height) * 100,
    };
  }, []);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (!selectedQuestionId) return;
    e.preventDefault();
    e.stopPropagation();
    const pos = getRelativePosition(e);
    setDrawing({ startX: pos.x, startY: pos.y, currentX: pos.x, currentY: pos.y });
  }, [selectedQuestionId, getRelativePosition]);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!drawing) return;
    e.preventDefault();
    const pos = getRelativePosition(e);
    setDrawing(prev => prev ? { ...prev, currentX: pos.x, currentY: pos.y } : null);
  }, [drawing, getRelativePosition]);

  const handleMouseUp = useCallback(() => {
    if (!drawing || !selectedQuestionId) {
      setDrawing(null);
      return;
    }

    const x = Math.min(drawing.startX, drawing.currentX);
    const y = Math.min(drawing.startY, drawing.currentY);
    const width = Math.abs(drawing.currentX - drawing.startX);
    const height = Math.abs(drawing.currentY - drawing.startY);

    // Minimum size threshold (2% of container)
    if (width > 2 && height > 2) {
      onCreateRegion({
        questionId: selectedQuestionId,
        pageNumber,
        x,
        y,
        width,
        height,
      });
    }

    setDrawing(null);
  }, [drawing, selectedQuestionId, pageNumber, onCreateRegion]);

  const getQuestionColor = (questionId: string) => {
    const q = questions.find(q => q.id === questionId);
    return q?.color || '#3B82F6';
  };

  const getQuestionLabel = (questionId: string) => {
    const q = questions.find(q => q.id === questionId);
    return q?.text || 'Unknown';
  };

  const drawingRect = drawing ? {
    x: Math.min(drawing.startX, drawing.currentX),
    y: Math.min(drawing.startY, drawing.currentY),
    width: Math.abs(drawing.currentX - drawing.startX),
    height: Math.abs(drawing.currentY - drawing.startY),
  } : null;

  const selectedColor = selectedQuestionId ? getQuestionColor(selectedQuestionId) : '#3B82F6';

  return (
    <div
      ref={containerRef}
      className={`absolute inset-0 ${selectedQuestionId ? 'cursor-crosshair' : ''}`}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={() => setDrawing(null)}
    >
      {/* Existing regions */}
      {regions.map(region => (
        <div
          key={region.id}
          className="absolute border-2 rounded-sm group"
          style={{
            left: `${region.x}%`,
            top: `${region.y}%`,
            width: `${region.width}%`,
            height: `${region.height}%`,
            borderColor: getQuestionColor(region.questionId),
            backgroundColor: `${getQuestionColor(region.questionId)}${hoveredRegion === region.id ? '40' : '20'}`,
          }}
          onMouseEnter={() => setHoveredRegion(region.id)}
          onMouseLeave={() => setHoveredRegion(null)}
        >
          {/* Tooltip on hover */}
          {hoveredRegion === region.id && (
            <div className="absolute -top-8 left-0 z-50 bg-gray-900 text-white text-xs px-2 py-1 rounded shadow-lg whitespace-nowrap">
              {getQuestionLabel(region.questionId)}
              {region.note && ` - ${region.note}`}
              <button
                className="ml-2 text-red-300 hover:text-red-100"
                onClick={(e) => {
                  e.stopPropagation();
                  onDeleteRegion(region.id);
                }}
              >
                Remove
              </button>
            </div>
          )}
        </div>
      ))}

      {/* Drawing preview */}
      {drawingRect && (
        <div
          className="absolute border-2 border-dashed rounded-sm pointer-events-none"
          style={{
            left: `${drawingRect.x}%`,
            top: `${drawingRect.y}%`,
            width: `${drawingRect.width}%`,
            height: `${drawingRect.height}%`,
            borderColor: selectedColor,
            backgroundColor: `${selectedColor}30`,
          }}
        />
      )}

      {/* Instructions */}
      {selectedQuestionId && !drawing && (
        <div className="absolute bottom-2 left-2 right-2 text-center">
          <span className="bg-black/60 text-white text-xs px-2 py-1 rounded">
            Draw a rectangle to code a region
          </span>
        </div>
      )}
    </div>
  );
}
