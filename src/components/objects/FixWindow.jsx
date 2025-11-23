import React from 'react';

const FixWindow = ({ width, height, scale }) => {
  // Based on the user provided SVG:
  // The main window is a rectangle with top and bottom frames.
  // There is a center line (glass).
  // There are two "pillars" (hashira) offset from the center.

  // The user's SVG uses a matrix transform for the pillars:
  // hashira_2: translate(30, 0) -> x=30
  // hashira_1: translate(-30, 0) -> x=-30
  // The pillars themselves are 10x10 squares (path M 5 -5 L -5 -5 ...).

  // We will adapt this to our coordinate system where (0,0) is the center of the object.

  // Frame thickness (visual approximation from SVG)
  const frameThickness = 1 / scale; // Thin lines

  return (
    <g>
      {/* Background (White fill) */}
      <rect
        x={-width / 2}
        y={-height / 2}
        width={width}
        height={height}
        fill="#FFFFFF"
        stroke="none"
      />

      {/* Top and Bottom Frames */}
      <line
        x1={-width / 2}
        y1={-height / 2}
        x2={width / 2}
        y2={-height / 2}
        stroke="#666666"
        strokeWidth={2} // Slightly thicker for visibility
        strokeLinecap="round"
      />
      <line
        x1={-width / 2}
        y1={height / 2}
        x2={width / 2}
        y2={height / 2}
        stroke="#666666"
        strokeWidth={2}
        strokeLinecap="round"
      />

      {/* Center Glass Line */}
      <line
        x1={-width / 2}
        y1={0}
        x2={width / 2}
        y2={0}
        stroke="#666666"
        strokeWidth={1}
        strokeLinecap="round"
      />
    </g>
  );
};

export default FixWindow;
