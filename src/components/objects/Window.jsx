import React from 'react';

const Window = ({ width, height, strokeWidth }) => {
  // Custom Sliding Window Path based on user request
  // Native size approx: Width 160 (-80 to 80), Height 10 (-5 to 5)
  // The provided SVG had a rotation, but the paths are horizontal.
  // We will use the horizontal orientation as default.

  const nativeWidth = 160;
  const nativeHeight = 10;

  const scaleX = width / nativeWidth;
  const scaleY = height / nativeHeight;

  return (
    <g transform={`scale(${scaleX}, ${scaleY})`}>
      {/* Wall part */}
      <g transform="matrix(0.6876678466796875, 0, 0, 1, 0, 0)">
        <g>
          <path fill="#FFFFFF" stroke="none" d="M 80 -5 L -80 -5 -80 5 80 5 80 -5 Z"></path>
        </g>
        <path stroke="#666666" strokeWidth="1" strokeLinejoin="round" strokeLinecap="round" fill="none" d="M -80 -4.5 L 80 -4.5 80 4.5 -80 4.5 -80 -4.5 Z"></path>

        <g>
          <path fill="#666666" stroke="none" d="M 80 5 L 80 1.6 0 1.6 0 5 80 5 Z"></path>
        </g>

        <path stroke="#666666" strokeWidth="1" strokeLinejoin="round" strokeLinecap="round" fill="none" d="M 0 -1.6 L -80 -1.6"></path>

        <g>
          <path fill="#666666" stroke="none" d="
M 73.9 -1.5 Q 73.94 -1.47 74 -1.5 L 80 -1.5 Q 80.06 -1.47 80.1 -1.5 80.13 -1.54 80.1 -1.6 80.13 -1.66 80.1 -1.7 80.06 -1.73 80 -1.75 L 74 -1.75 Q 73.94 -1.73 73.9 -1.7 73.87 -1.66 73.85 -1.6 73.87 -1.54 73.9 -1.5
M 61.85 -1.6 Q 61.87 -1.54 61.9 -1.5 61.94 -1.47 62 -1.5 L 68 -1.5 Q 68.06 -1.47 68.1 -1.5 68.13 -1.54 68.1 -1.6 68.13 -1.66 68.1 -1.7 68.06 -1.73 68 -1.75 L 62 -1.75 Q 61.94 -1.73 61.9 -1.7 61.87 -1.66 61.85 -1.6
M 50 -1.75 Q 49.94 -1.73 49.9 -1.7 49.87 -1.66 49.85 -1.6 49.87 -1.54 49.9 -1.5 49.94 -1.47 50 -1.5 L 56 -1.5 Q 56.06 -1.47 56.1 -1.5 56.13 -1.54 56.1 -1.6 56.13 -1.66 56.1 -1.7 56.06 -1.73 56 -1.75 L 50 -1.75
M 37.9 -1.5 Q 37.94 -1.47 38 -1.5 L 44 -1.5 Q 44.06 -1.47 44.1 -1.5 44.13 -1.54 44.1 -1.6 44.13 -1.66 44.1 -1.7 44.06 -1.73 44 -1.75 L 38 -1.75 Q 37.94 -1.73 37.9 -1.7 37.87 -1.66 37.85 -1.6 37.87 -1.54 37.9 -1.5
M 26 -1.75 Q 25.94 -1.73 25.9 -1.7 25.87 -1.66 25.85 -1.6 25.87 -1.54 25.9 -1.5 25.94 -1.47 26 -1.5 L 32 -1.5 Q 32.06 -1.47 32.1 -1.5 32.13 -1.54 32.1 -1.6 32.13 -1.66 32.1 -1.7 32.06 -1.73 32 -1.75 L 26 -1.75
M 13.85 -1.6 Q 13.87 -1.54 13.9 -1.5 13.94 -1.47 14 -1.5 L 20 -1.5 Q 20.06 -1.47 20.1 -1.5 20.13 -1.54 20.1 -1.6 20.13 -1.66 20.1 -1.7 20.06 -1.73 20 -1.75 L 14 -1.75 Q 13.94 -1.73 13.9 -1.7 13.87 -1.66 13.85 -1.6
M 1.9 -1.5 Q 1.94 -1.47 2 -1.5 L 8 -1.5 Q 8.06 -1.47 8.1 -1.5 8.13 -1.54 8.1 -1.6 8.13 -1.66 8.1 -1.7 8.06 -1.73 8 -1.75 L 2 -1.75 Q 1.94 -1.73 1.9 -1.7 1.87 -1.66 1.85 -1.6 1.87 -1.54 1.9 -1.5 Z"></path>
        </g>
      </g>

      {/* Pillar 2 (hashira_2) */}
      <g transform="matrix(1, 0, 0, 1, 60, 0)">
        <g>
          <path fill="#666666" stroke="none" d="M 5 -5 L -5 -5 -5 5 5 5 5 -5 Z"></path>
        </g>
      </g>

      {/* Pillar 1 (hashira_1) */}
      <g transform="matrix(1, 0, 0, 1, -60, 0)">
        <g>
          <path fill="#666666" stroke="none" d="M 5 -5 L -5 -5 -5 5 5 5 5 -5 Z"></path>
        </g>
      </g>
    </g>
  );
};

export default Window;
