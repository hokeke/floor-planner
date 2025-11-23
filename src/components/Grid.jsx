import React from 'react';
import { mmToPx, GRID_SIZE_MM, SUB_GRID_SIZE_MM } from '../utils/units';

const Grid = ({ width, height }) => {
  const gridSizePx = mmToPx(GRID_SIZE_MM);
  const subGridSizePx = mmToPx(SUB_GRID_SIZE_MM);

  const patterns = [];

  // Sub-grid pattern
  patterns.push(
    <pattern
      key="subgrid"
      id="subgrid"
      width={subGridSizePx}
      height={subGridSizePx}
      patternUnits="userSpaceOnUse"
    >
      <path
        d={`M ${subGridSizePx} 0 L 0 0 0 ${subGridSizePx}`}
        fill="none"
        stroke="#e0e0e0"
        strokeWidth="1"
      />
    </pattern>
  );

  // Main grid pattern
  patterns.push(
    <pattern
      key="grid"
      id="grid"
      width={gridSizePx}
      height={gridSizePx}
      patternUnits="userSpaceOnUse"
    >
      <rect width={gridSizePx} height={gridSizePx} fill="url(#subgrid)" />
      <path
        d={`M ${gridSizePx} 0 L 0 0 0 ${gridSizePx}`}
        fill="none"
        stroke="#bdbdbd"
        strokeWidth="2"
      />
    </pattern>
  );

  return (
    <g className="grid-layer">
      <defs>{patterns}</defs>
      <rect width="100%" height="100%" fill="url(#grid)" />
    </g>
  );
};

export default Grid;
