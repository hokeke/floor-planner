import React from 'react';
import { pxToMm, mmToPx } from '../utils/units';

const DimensionAnnotations = ({ walls, scale, pan }) => {
  if (!walls || walls.length === 0) return null;

  const DIMENSION_OFFSET = 910; // mm
  const annotations = [];

  // Calculate bounding box of all walls
  let minX = Infinity, maxX = -Infinity;
  let minY = Infinity, maxY = -Infinity;

  walls.forEach(wall => {
    const startMm = { x: pxToMm(wall.start.x), y: pxToMm(wall.start.y) };
    const endMm = { x: pxToMm(wall.end.x), y: pxToMm(wall.end.y) };

    minX = Math.min(minX, startMm.x, endMm.x);
    maxX = Math.max(maxX, startMm.x, endMm.x);
    minY = Math.min(minY, startMm.y, endMm.y);
    maxY = Math.max(maxY, startMm.y, endMm.y);
  });

  const centerX = (minX + maxX) / 2;
  const centerY = (minY + maxY) / 2;

  // Collect all wall endpoints to divide the perimeter into segments
  const topPoints = new Set();
  const bottomPoints = new Set();
  const leftPoints = new Set();
  const rightPoints = new Set();

  walls.forEach(wall => {
    const startMm = { x: pxToMm(wall.start.x), y: pxToMm(wall.start.y) };
    const endMm = { x: pxToMm(wall.end.x), y: pxToMm(wall.end.y) };

    const dx = Math.abs(endMm.x - startMm.x);
    const dy = Math.abs(endMm.y - startMm.y);

    if (dx > dy) {
      // Horizontal wall
      const avgY = (startMm.y + endMm.y) / 2;
      const x1 = Math.min(startMm.x, endMm.x);
      const x2 = Math.max(startMm.x, endMm.x);

      if (avgY < centerY) {
        // Top edge
        topPoints.add(x1);
        topPoints.add(x2);
      } else {
        // Bottom edge
        bottomPoints.add(x1);
        bottomPoints.add(x2);
      }
    } else {
      // Vertical wall
      const avgX = (startMm.x + endMm.x) / 2;
      const y1 = Math.min(startMm.y, endMm.y);
      const y2 = Math.max(startMm.y, endMm.y);

      if (avgX < centerX) {
        // Left edge
        leftPoints.add(y1);
        leftPoints.add(y2);
      } else {
        // Right edge
        rightPoints.add(y1);
        rightPoints.add(y2);
      }
    }
  });

  // Create annotations for top edge
  const topArray = Array.from(topPoints).sort((a, b) => a - b);
  for (let i = 0; i < topArray.length - 1; i++) {
    const length = topArray[i + 1] - topArray[i];
    annotations.push({
      type: 'horizontal',
      x1: topArray[i],
      x2: topArray[i + 1],
      y: minY - DIMENSION_OFFSET,
      wallY: minY,
      length: length
    });
  }

  // Create annotations for bottom edge
  const bottomArray = Array.from(bottomPoints).sort((a, b) => a - b);
  for (let i = 0; i < bottomArray.length - 1; i++) {
    const length = bottomArray[i + 1] - bottomArray[i];
    annotations.push({
      type: 'horizontal',
      x1: bottomArray[i],
      x2: bottomArray[i + 1],
      y: maxY + DIMENSION_OFFSET,
      wallY: maxY,
      length: length
    });
  }

  // Create annotations for left edge
  const leftArray = Array.from(leftPoints).sort((a, b) => a - b);
  for (let i = 0; i < leftArray.length - 1; i++) {
    const length = leftArray[i + 1] - leftArray[i];
    annotations.push({
      type: 'vertical',
      y1: leftArray[i],
      y2: leftArray[i + 1],
      x: minX - DIMENSION_OFFSET,
      wallX: minX,
      length: length
    });
  }

  // Create annotations for right edge
  const rightArray = Array.from(rightPoints).sort((a, b) => a - b);
  for (let i = 0; i < rightArray.length - 1; i++) {
    const length = rightArray[i + 1] - rightArray[i];
    annotations.push({
      type: 'vertical',
      y1: rightArray[i],
      y2: rightArray[i + 1],
      x: maxX + DIMENSION_OFFSET,
      wallX: maxX,
      length: length
    });
  }

  // Add overall building dimensions (outside the segment dimensions)
  const OVERALL_OFFSET = DIMENSION_OFFSET * 1.5; // Place overall dimensions 0.5 grid further out

  // Overall width at top
  annotations.push({
    type: 'horizontal',
    x1: minX,
    x2: maxX,
    y: minY - OVERALL_OFFSET,
    wallY: minY,
    length: maxX - minX,
    isOverall: true
  });

  // Overall width at bottom
  annotations.push({
    type: 'horizontal',
    x1: minX,
    x2: maxX,
    y: maxY + OVERALL_OFFSET,
    wallY: maxY,
    length: maxX - minX,
    isOverall: true
  });

  // Overall height at left
  annotations.push({
    type: 'vertical',
    y1: minY,
    y2: maxY,
    x: minX - OVERALL_OFFSET,
    wallX: minX,
    length: maxY - minY,
    isOverall: true
  });

  // Overall height at right
  annotations.push({
    type: 'vertical',
    y1: minY,
    y2: maxY,
    x: maxX + OVERALL_OFFSET,
    wallX: maxX,
    length: maxY - minY,
    isOverall: true
  });

  return (
    <g className="dimension-annotations">
      {annotations.map((ann, idx) => {
        if (ann.type === 'horizontal') {
          const x1Px = mmToPx(ann.x1);
          const x2Px = mmToPx(ann.x2);
          const yPx = mmToPx(ann.y);
          const midX = (x1Px + x2Px) / 2;
          const wallCenterY = ann.wallY || ann.y;

          return (
            <g key={`dim-h-${idx}`}>
              {/* Extension lines - from wall to dimension line */}
              <line
                x1={x1Px}
                y1={mmToPx(wallCenterY)}
                x2={x1Px}
                y2={yPx}
                stroke="#666"
                strokeWidth={1 / scale}
              />
              <line
                x1={x2Px}
                y1={mmToPx(wallCenterY)}
                x2={x2Px}
                y2={yPx}
                stroke="#666"
                strokeWidth={1 / scale}
              />
              {/* Tick marks at dimension line */}
              <line
                x1={x1Px}
                y1={yPx - 30 / scale}
                x2={x1Px}
                y2={yPx + 30 / scale}
                stroke="#000"
                strokeWidth={1 / scale}
              />
              <line
                x1={x2Px}
                y1={yPx - 30 / scale}
                x2={x2Px}
                y2={yPx + 30 / scale}
                stroke="#000"
                strokeWidth={1 / scale}
              />
              {/* Dimension line */}
              <line
                x1={x1Px}
                y1={yPx}
                x2={x2Px}
                y2={yPx}
                stroke="#000"
                strokeWidth={1 / scale}
              />
              {/* Label */}
              <text
                x={midX}
                y={ann.y < centerY ? (yPx - 20 / scale) : (yPx + 30 / scale)}
                fontSize={10 / scale}
                fill="#000"
                textAnchor="middle"
                style={{ pointerEvents: 'none', userSelect: 'none' }}
              >
                {Math.round(ann.length)}
              </text>
            </g>
          );
        } else {
          // Vertical dimension
          const y1Px = mmToPx(ann.y1);
          const y2Px = mmToPx(ann.y2);
          const xPx = mmToPx(ann.x);
          const midY = (y1Px + y2Px) / 2;
          const wallCenterX = ann.wallX || ann.x;

          return (
            <g key={`dim-v-${idx}`}>
              {/* Extension lines - from wall to dimension line */}
              <line
                x1={mmToPx(wallCenterX)}
                y1={y1Px}
                x2={xPx}
                y2={y1Px}
                stroke="#666"
                strokeWidth={1 / scale}
              />
              <line
                x1={mmToPx(wallCenterX)}
                y1={y2Px}
                x2={xPx}
                y2={y2Px}
                stroke="#666"
                strokeWidth={1 / scale}
              />
              {/* Tick marks at dimension line */}
              <line
                x1={xPx - 30 / scale}
                y1={y1Px}
                x2={xPx + 30 / scale}
                y2={y1Px}
                stroke="#000"
                strokeWidth={1 / scale}
              />
              <line
                x1={xPx - 30 / scale}
                y1={y2Px}
                x2={xPx + 30 / scale}
                y2={y2Px}
                stroke="#000"
                strokeWidth={1 / scale}
              />
              {/* Dimension line */}
              <line
                x1={xPx}
                y1={y1Px}
                x2={xPx}
                y2={y2Px}
                stroke="#000"
                strokeWidth={1 / scale}
              />
              {/* Label */}
              <text
                x={ann.x < centerX ? (xPx - 20 / scale) : (xPx + 20 / scale)}
                y={midY}
                fontSize={10 / scale}
                fill="#000"
                textAnchor="middle"
                transform={`rotate(-90, ${ann.x < centerX ? (xPx - 20 / scale) : (xPx + 20 / scale)}, ${midY})`}
                style={{ pointerEvents: 'none', userSelect: 'none' }}
              >
                {Math.round(ann.length)}
              </text>
            </g>
          );
        }
      })}
    </g>
  );
};

export default DimensionAnnotations;
