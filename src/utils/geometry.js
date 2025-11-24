// Helper to calculate distance from point P to line segment AB
export const getDistanceToLineSegment = (P, A, B) => {
  const l2 = (A.x - B.x) ** 2 + (A.y - B.y) ** 2;
  if (l2 === 0) return Math.sqrt((P.x - A.x) ** 2 + (P.y - A.y) ** 2);
  let t = ((P.x - A.x) * (B.x - A.x) + (P.y - A.y) * (B.y - A.y)) / l2;
  t = Math.max(0, Math.min(1, t));
  const proj = { x: A.x + t * (B.x - A.x), y: A.y + t * (B.y - A.y) };
  return Math.sqrt((P.x - proj.x) ** 2 + (P.y - proj.y) ** 2);
};

// Helper to check if a point is near a line segment
export const isPointNearLine = (point, start, end, threshold = 10) => {
  const A = point.x - start.x;
  const B = point.y - start.y;
  const C = end.x - start.x;
  const D = end.y - start.y;

  const dot = A * C + B * D;
  const lenSq = C * C + D * D;
  let param = -1;
  if (lenSq !== 0) // in case of 0 length line
    param = dot / lenSq;

  let xx, yy;

  if (param < 0) {
    xx = start.x;
    yy = start.y;
  }
  else if (param > 1) {
    xx = end.x;
    yy = end.y;
  }
  else {
    xx = start.x + param * C;
    yy = start.y + param * D;
  }

  const dx = point.x - xx;
  const dy = point.y - yy;
  return Math.sqrt(dx * dx + dy * dy) < threshold;
};

// Simple hit testing for polygon (point in polygon)
export const isPointInPolygon = (point, vs) => {
  let x = point.x, y = point.y;
  let inside = false;
  for (let i = 0, j = vs.length - 1; i < vs.length; j = i++) {
    let xi = vs[i].x, yi = vs[i].y;
    let xj = vs[j].x, yj = vs[j].y;

    let intersect = ((yi > y) !== (yj > y))
      && (x < (xj - xi) * (y - yi) / (yj - yi) + xi);
    if (intersect) inside = !inside;
  }
  return inside;
};

// Helper to find closest room edge
export const getClosestRoomEdge = (point, rooms, scale, preferredRoomId = null) => {
  let closestEdge = null;
  let minDistance = 10 / scale; // Threshold in pixels (adjusted by scale)

  // Helper to check edges of a specific room
  const checkRoomEdges = (room) => {
    let found = null;
    room.points.forEach((p1, i) => {
      const p2 = room.points[(i + 1) % room.points.length];
      const dist = getDistanceToLineSegment(point, p1, p2);
      if (dist < minDistance) {
        minDistance = dist;
        found = { roomId: room.id, edgeIndex: i };
      }
    });
    return found;
  };

  // Check preferred room first
  if (preferredRoomId) {
    const preferredRoom = rooms.find(r => r.id === preferredRoomId);
    if (preferredRoom) {
      const found = checkRoomEdges(preferredRoom);
      if (found) return found;
    }
  }

  // Check all rooms
  rooms.forEach(room => {
    // Skip preferred room as it was already checked
    if (room.id === preferredRoomId) return;

    const found = checkRoomEdges(room);
    if (found) closestEdge = found;
  });

  return closestEdge;
};
