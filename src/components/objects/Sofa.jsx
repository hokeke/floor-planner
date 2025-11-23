import React from 'react';

const Sofa = ({ width, height }) => {
  // Custom Sofa Path based on user request
  // Native size approx: Width 96 (-48 to 48), Height 42 (-21 to 21)
  const nativeWidth = 96;
  const nativeHeight = 42;

  const scaleX = width / nativeWidth;
  const scaleY = height / nativeHeight;

  return (
    <g transform={`scale(${scaleX}, ${scaleY})`}>
      <g id="Layer0_0_FILL_fur03_01">
        <path fill="#D6CCAB" stroke="none" d="
M -40.95 -9.4
L -40.95 -20.55 -48 -20.55 -48 20.3 -38.35 20.3 -38.35 -9.4 -40.95 -9.4
M 0 21
L 0 -9.4 -38.35 -9.4 -38.35 20.3 -38.35 21 0 21
M 48 -20.55
L 40.95 -20.55 40.95 -9.4 38.35 -9.4 38.35 20.3 48 20.3 48 -20.55
M 0 -9.4
L 0 -21 -40.95 -21 -40.95 -20.55 -40.95 -9.4 -38.35 -9.4 0 -9.4
M 38.35 -9.4
L 0 -9.4 0 21 38.35 21 38.35 20.3 38.35 -9.4
M 0 -9.4
L 38.35 -9.4 40.95 -9.4 40.95 -20.55 40.95 -21 0 -21 0 -9.4 Z"></path>
      </g>
      <path id="Layer0_0_1_STROKES_fur03_01" stroke="#666666" strokeWidth="1" strokeLinejoin="round" strokeLinecap="round" fill="none" d="
M 0 -21
L 0 -9.4 38.35 -9.4 40.95 -9.4 40.95 -20.55 40.95 -21 0 -21 -40.95 -21 -40.95 -20.55 -40.95 -9.4 -38.35 -9.4 0 -9.4 0 21 38.35 21 38.35 20.3 38.35 -9.4
M 40.95 -20.55
L 48 -20.55 48 20.3 38.35 20.3
M 0 21
L -38.35 21 -38.35 20.3 -48 20.3 -48 -20.55 -40.95 -20.55
M -38.35 -9.4
L -38.35 20.3"></path>
    </g>
  );
};

export default Sofa;
