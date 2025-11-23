
export const MM_PER_PX = 5; // 1 pixel = 5mm
export const GRID_SIZE_MM = 910;
export const SUB_GRID_SIZE_MM = 455;

export const mmToPx = (mm) => mm / MM_PER_PX;
export const pxToMm = (px) => px * MM_PER_PX;

export const snapToGrid = (val, gridSize = GRID_SIZE_MM) => {
  const gridPx = mmToPx(gridSize);
  return Math.round(val / gridPx) * gridPx;
};

export const calculateArea = (widthOrPoints, heightMm) => {
  let sqm = 0;

  if (Array.isArray(widthOrPoints)) {
    // Polygon area (Shoelace formula)
    const points = widthOrPoints;
    let areaPx = 0;
    const n = points.length;

    for (let i = 0; i < n; i++) {
      const j = (i + 1) % n;
      areaPx += points[i].x * points[j].y;
      areaPx -= points[j].x * points[i].y;
    }

    areaPx = Math.abs(areaPx) / 2;
    // Points are passed in mm, so areaPx is actually area in mm^2
    const areaMm2 = areaPx;
    sqm = areaMm2 / 1000000;
  } else {
    // Rectangle area (Legacy support)
    const widthMm = widthOrPoints;
    sqm = (widthMm * heightMm) / 1000000;
  }

  const tsubo = sqm / 3.30578;
  const tatami = sqm / 1.6562; // 1 Jou = 910mm x 1820mm (Standard for 910mm module)
  return { sqm, tsubo, tatami };
};
