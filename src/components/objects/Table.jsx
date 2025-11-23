import React from 'react';

const Table = ({ width, height }) => {
  // Custom Table Path based on user request
  // Native size approx: Width 90 (-45 to 45), Height 48 (-24 to 24)
  // The user provided SVG has a scale transform, but we'll normalize to the bounds.

  const nativeWidth = 90;
  const nativeHeight = 48;

  const scaleX = width / nativeWidth;
  const scaleY = height / nativeHeight;

  return (
    <g transform={`scale(${scaleX}, ${scaleY})`}>
      <g id="Layer0_0_FILL_fur19_01">
        <path fill="#D6CCAB" stroke="none" d="
M 45 -21
Q 44.95 -22.25 43.9 -23.1 42.9 -23.95 41.4 -24
L -41.4 -24
Q -42.9 -23.9 -43.9 -23.1 -44.9 -22.25 -45 -21
L -45 21
Q -44.9 22.3 -43.9 23.1 -42.9 23.95 -41.4 24
L 41.4 24
Q 42.95 23.95 43.9 23.1 44.95 22.3 45 21
L 45 -21 Z"></path>
      </g>
      <path id="Layer0_0_1_STROKES_fur19_01" stroke="#666666" strokeWidth="1" strokeLinejoin="round" strokeLinecap="round" fill="none" d="
M 45 -21
L 45 21
Q 44.95 22.3 43.9 23.1 42.95 23.95 41.4 24
L -41.4 24
Q -42.9 23.95 -43.9 23.1 -44.9 22.3 -45 21
L -45 -21
Q -44.9 -22.25 -43.9 -23.1 -42.9 -23.9 -41.4 -24
L 41.4 -24
Q 42.9 -23.95 43.9 -23.1 44.95 -22.25 45 -21 Z"></path>
    </g>
  );
};

export default Table;
