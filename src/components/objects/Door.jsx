import React from 'react';
import { mmToPx } from '../../utils/units';

const Door = ({ width, height, scale }) => {
  // Pillars removed as per user request
  const pillarWidth = 0;
  const openingWidth = width;

  // Ensure opening isn't negative
  const validOpeningWidth = Math.max(0, openingWidth);

  // Hinge at left inner edge (now left edge)
  const hingeX = -width / 2;

  // Wall Thickness (100mm)
  const wallThickness = mmToPx(100);

  // Arc Path (Elliptical if height != openingWidth)
  // From tip of leaf (hingeX, -height) to closed position (hingeX + validOpeningWidth, 0)
  // User requested correct aspect ratio (quarter circle), so we use validOpeningWidth for both radii
  const leafLength = validOpeningWidth;
  const arcPath = `M ${hingeX} ${-leafLength} A ${validOpeningWidth} ${leafLength} 0 0 1 ${hingeX + validOpeningWidth} 0`;

  return (
    <g>
      {/* Opening (White) */}
      <rect
        x={hingeX}
        y={-wallThickness / 2 + 1 / scale}
        width={validOpeningWidth}
        height={wallThickness - 2 / scale}
        fill="white"
        stroke="#666"
        strokeWidth={2 / scale}
      />

      {/* Door Leaf */}
      <line
        x1={hingeX}
        y1={0}
        x2={hingeX}
        y2={-leafLength}
        stroke="#666"
        strokeWidth={2 / scale}
      />

      {/* Swing Arc */}
      <path
        d={arcPath}
        fill="none"
        stroke="#666"
        strokeWidth={1 / scale}
      />
    </g>
  );
};

export default Door;
