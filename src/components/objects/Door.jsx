import React from 'react';
import { mmToPx } from '../../utils/units';

const Door = ({ width, height, scale }) => {
  // Custom Door Path based on user request
  // Native size approx: Width 70 (Pillars +/-35), Depth 50 (Swing ~49)
  const nativeWidth = 70;
  const scaleX = width / nativeWidth;

  // User Request:
  // 1. Wall should not stretch vertically -> Use fixed Y scale
  // 2. Door swing ratio should be correct -> Use scale(scaleX, scaleX) for swing (uniform)
  // 3. Wall thickness should match app wall thickness (100mm)
  const wallThicknessPx = mmToPx(100);
  const svgWallHeight = 10; // From SVG path (-4.5 to 4.5) + stroke width (1)
  const wallScaleY = wallThicknessPx / svgWallHeight;

  return (
    <g>
      {/* Swing (resizeObj) - Scale uniformly to maintain aspect ratio */}
      <g transform={`scale(${scaleX}, ${scaleX})`}>
        <g transform="matrix(2.5, 0, 0, 2.5, 0, -5)">
          <g>
            <path fill="#FFFFFF" fillOpacity="0" stroke="none" d="M 10 -0.05 Q 9.85 -8.05 4.15 -13.75 -1.7 -19.6 -10 -19.6 L -10 0 10 0 10 -0.05 Z" strokeWidth="0.4"></path>
          </g>
          <path stroke="#666666" strokeWidth="0.4" strokeLinejoin="round" strokeLinecap="round" fill="none" d="M -9.5 0 L -9.5 -19.5 A 19.5 19.5 0 0 1 9.5 0"></path>
        </g>
      </g>

      {/* Wall & Pillars - Scale X by width, Scale Y to match 100mm thickness */}
      <g transform={`scale(${scaleX}, ${wallScaleY})`}>
        {/* Wall (wall) */}
        <g transform="matrix(0.3123931884765625, 0, 0, 1, 0, 0)">
          <g>
            <path fill="#FFFFFF" stroke="none" d="M 80.5 4.5 L 80.5 -4.5 -80.5 -4.5 -80.5 4.5 80.5 4.5 Z"></path>
          </g>
          <path stroke="#666666" strokeWidth="1" strokeLinejoin="round" strokeLinecap="round" fill="none" d="M 80.5 -4.5 L 80.5 4.5 -80.5 4.5 -80.5 -4.5 80.5 -4.5 Z"></path>
        </g>

        {/* Pillar 2 (hashira_2) */}
        <g transform="matrix(1, 0, 0, 1, 30, 0)">
          <g>
            <path fill="#666666" stroke="none" d="M 5 -5 L -5 -5 -5 5 5 5 5 -5 Z"></path>
          </g>
        </g>

        {/* Pillar 1 (hashira_1) */}
        <g transform="matrix(1, 0, 0, 1, -30, 0)">
          <g>
            <path fill="#666666" stroke="none" d="M 5 -5 L -5 -5 -5 5 5 5 5 -5 Z"></path>
          </g>
        </g>
      </g>
    </g>
  );
};

export default Door;
