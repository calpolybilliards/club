/***************************************************
 * pd2.js - pool table with physical cushion jaws and recessed liners
 *
 * The cushion nose is modeled as a collection of finite line segments.
 * Straight segments stop at each pocket, and angled jaw segments continue
 * into the pocket mouth. Ball-to-segment collision normals make the jaws
 * redirect balls instead of treating the table as one solid rectangle.
 ***************************************************/

'use strict';

const canvas = document.getElementById('poolCanvas');
const ctx = canvas.getContext('2d');
const width = canvas.width;
const height = canvas.height;

/* -------------------------------
   Table dimensions
--------------------------------*/
const railThickness = 32;
const ballRadius = 9.375;
const ballDiameter = 2 * ballRadius;

const table = {
  left: railThickness,
  right: width - railThickness,
  top: railThickness,
  bottom: height - railThickness
};

// The supplied angles are obtuse entrance angles. The cushion face turns by
// the supplementary acute angle as it leaves a straight rail for a pocket.
const cornerEntranceAngle = 142;
const sideEntranceAngle = 103;
const cornerJawAngle = degreesToRadians(180 - cornerEntranceAngle); // 38 deg
const sideJawAngle = degreesToRadians(180 - sideEntranceAngle);     // 77 deg

// Mouth widths are scaled from the supplied diagram relative to a ball.
const cornerMouthWidth = 2.05 * ballDiameter;
const cornerMouthOffset = cornerMouthWidth / Math.SQRT2;
const sideMouthWidth = 2.28 * ballDiameter;
const sideMouthHalf = sideMouthWidth / 2;

// Pocket liners are deliberately smaller and farther behind the cushion nose
// than in the first draft. This keeps the black wells inside the frame instead
// of clipping against the canvas or bulging into the playing surface.
const cornerPocketBack = 1.50 * ballRadius;
const cornerVisualBack = 0.65 * ballRadius;
const cornerVisualRx = 1.72 * ballRadius;
const cornerVisualRy = 1.52 * ballRadius;
const sidePocketBack = 1.92 * ballRadius;
const sideVisualRx = Math.min(sideMouthHalf * 0.86, 1.82 * ballRadius);
const sideVisualRy = 1.48 * ballRadius;
const sideFrontReveal = 0.03 * ballRadius;

// The jaw faces run from the cushion nose outward toward the wooden frame.
const cushionDepth = 20;
const cornerJawLength = cushionDepth / Math.sin(cornerJawAngle);
const sideJawLength = cushionDepth / Math.sin(sideJawAngle);
const cushionRestitution = 0.92;
const cushionTangentRetention = 0.995;
const ballRestitution = 0.98;

const friction = 0.985;
const maxShotSpeed = 26;
const cueSpawn = { x: 150, y: height / 2 };

/* -------------------------------
   Ball setup
--------------------------------*/
const headSpotX = (6 * width) / 8;
const headSpotY = height / 2;
const ballDiffX = 3 * ballRadius / Math.sqrt(3);
const ballDiffY = ballRadius;

let balls = [
  { x: 300, y: headSpotY, vx: 0, vy: 0, color: 'white', radius: ballRadius, isCue: true },

  { x: headSpotX, y: headSpotY, vx: 0, vy: 0, color: 'red', radius: ballRadius, isCue: false },

  { x: headSpotX + ballDiffX, y: headSpotY + ballDiffY, vx: 0, vy: 0, color: 'yellow', radius: ballRadius, isCue: false },
  { x: headSpotX + ballDiffX, y: headSpotY - ballDiffY, vx: 0, vy: 0, color: 'red', radius: ballRadius, isCue: false },

  { x: headSpotX + 2 * ballDiffX, y: headSpotY + 2 * ballDiffY, vx: 0, vy: 0, color: 'red', radius: ballRadius, isCue: false },
  { x: headSpotX + 2 * ballDiffX, y: headSpotY, vx: 0, vy: 0, color: 'blue', radius: ballRadius, isCue: false },
  { x: headSpotX + 2 * ballDiffX, y: headSpotY - 2 * ballDiffY, vx: 0, vy: 0, color: 'yellow', radius: ballRadius, isCue: false },

  { x: headSpotX + 3 * ballDiffX, y: headSpotY + 3 * ballDiffY, vx: 0, vy: 0, color: 'yellow', radius: ballRadius, isCue: false },
  { x: headSpotX + 3 * ballDiffX, y: headSpotY + ballDiffY, vx: 0, vy: 0, color: 'red', radius: ballRadius, isCue: false },
  { x: headSpotX + 3 * ballDiffX, y: headSpotY - ballDiffY, vx: 0, vy: 0, color: 'yellow', radius: ballRadius, isCue: false },
  { x: headSpotX + 3 * ballDiffX, y: headSpotY - 3 * ballDiffY, vx: 0, vy: 0, color: 'red', radius: ballRadius, isCue: false },

  { x: headSpotX + 4 * ballDiffX, y: headSpotY + 4 * ballDiffY, vx: 0, vy: 0, color: 'red', radius: ballRadius, isCue: false },
  { x: headSpotX + 4 * ballDiffX, y: headSpotY + 2 * ballDiffY, vx: 0, vy: 0, color: 'yellow', radius: ballRadius, isCue: false },
  { x: headSpotX + 4 * ballDiffX, y: headSpotY, vx: 0, vy: 0, color: 'yellow', radius: ballRadius, isCue: false },
  { x: headSpotX + 4 * ballDiffX, y: headSpotY - 2 * ballDiffY, vx: 0, vy: 0, color: 'red', radius: ballRadius, isCue: false },
  { x: headSpotX + 4 * ballDiffX, y: headSpotY - 4 * ballDiffY, vx: 0, vy: 0, color: 'yellow', radius: ballRadius, isCue: false }
];

let isAiming = false;
let currentPointer = null;
let activePointerId = null;
let lastTimestamp = 0;

/* -------------------------------
   Cushion and pocket geometry
--------------------------------*/
const cushionSegments = [];
const pockets = [];

function degreesToRadians(degrees) {
  return degrees * Math.PI / 180;
}

function point(x, y) {
  return { x, y };
}

function addCushionSegment(a, b, nx, ny, kind, name) {
  const normalLength = Math.hypot(nx, ny) || 1;
  cushionSegments.push({
    ax: a.x,
    ay: a.y,
    bx: b.x,
    by: b.y,
    nx: nx / normalLength,
    ny: ny / normalLength,
    kind,
    name
  });
}

function addCornerPocket(cx, cy, sx, sy, name) {
  const cosAngle = Math.cos(cornerJawAngle);
  const sinAngle = Math.sin(cornerJawAngle);

  const horizontalNose = point(cx + sx * cornerMouthOffset, cy);
  const verticalNose = point(cx, cy + sy * cornerMouthOffset);

  const horizontalOuter = point(
    horizontalNose.x - sx * cosAngle * cornerJawLength,
    horizontalNose.y - sy * sinAngle * cornerJawLength
  );
  const verticalOuter = point(
    verticalNose.x - sx * sinAngle * cornerJawLength,
    verticalNose.y - sy * cosAngle * cornerJawLength
  );

  // These normals point toward the playable side close to each finite jaw.
  addCushionSegment(
    horizontalNose,
    horizontalOuter,
    -sx * sinAngle,
    sy * cosAngle,
    'jaw',
    name + '-horizontal-jaw'
  );
  addCushionSegment(
    verticalNose,
    verticalOuter,
    sx * cosAngle,
    -sy * sinAngle,
    'jaw',
    name + '-vertical-jaw'
  );

  pockets.push({
    name,
    type: 'corner',
    cx,
    cy,
    sx,
    sy,
    dropX: cx - sx * cornerPocketBack,
    dropY: cy - sy * cornerPocketBack,
    dropRadius: 1.48 * ballRadius,
    visualX: cx - sx * cornerVisualBack,
    visualY: cy - sy * cornerVisualBack,
    visualRx: cornerVisualRx,
    visualRy: cornerVisualRy,
    visualAngle: Math.atan2(sy, sx),
    opening: [horizontalNose, horizontalOuter, verticalOuter, verticalNose]
  });
}

function addSidePocket(cy, sy, name) {
  const centerX = width / 2;
  const cosAngle = Math.cos(sideJawAngle);
  const sinAngle = Math.sin(sideJawAngle);

  const leftNose = point(centerX - sideMouthHalf, cy);
  const rightNose = point(centerX + sideMouthHalf, cy);

  const leftOuter = point(
    leftNose.x + cosAngle * sideJawLength,
    leftNose.y - sy * sinAngle * sideJawLength
  );
  const rightOuter = point(
    rightNose.x - cosAngle * sideJawLength,
    rightNose.y - sy * sinAngle * sideJawLength
  );

  addCushionSegment(
    leftNose,
    leftOuter,
    sinAngle,
    sy * cosAngle,
    'jaw',
    name + '-left-jaw'
  );
  addCushionSegment(
    rightNose,
    rightOuter,
    -sinAngle,
    sy * cosAngle,
    'jaw',
    name + '-right-jaw'
  );

  pockets.push({
    name,
    type: 'side',
    cx: centerX,
    cy,
    sy,
    dropX: centerX,
    dropY: cy - sy * sidePocketBack,
    dropRadius: 1.45 * ballRadius,
    visualX: centerX,
    visualY: cy - sy * (sideVisualRy - sideFrontReveal),
    visualRx: sideVisualRx,
    visualRy: sideVisualRy,
    visualAngle: 0,
    opening: [leftNose, leftOuter, rightOuter, rightNose]
  });
}

function buildTableGeometry() {
  const middleX = width / 2;

  // Straight cushion noses. Each one stops at a pocket mouth.
  addCushionSegment(
    point(table.left + cornerMouthOffset, table.top),
    point(middleX - sideMouthHalf, table.top),
    0,
    1,
    'rail',
    'top-left-rail'
  );
  addCushionSegment(
    point(middleX + sideMouthHalf, table.top),
    point(table.right - cornerMouthOffset, table.top),
    0,
    1,
    'rail',
    'top-right-rail'
  );
  addCushionSegment(
    point(table.left + cornerMouthOffset, table.bottom),
    point(middleX - sideMouthHalf, table.bottom),
    0,
    -1,
    'rail',
    'bottom-left-rail'
  );
  addCushionSegment(
    point(middleX + sideMouthHalf, table.bottom),
    point(table.right - cornerMouthOffset, table.bottom),
    0,
    -1,
    'rail',
    'bottom-right-rail'
  );
  addCushionSegment(
    point(table.left, table.top + cornerMouthOffset),
    point(table.left, table.bottom - cornerMouthOffset),
    1,
    0,
    'rail',
    'left-rail'
  );
  addCushionSegment(
    point(table.right, table.top + cornerMouthOffset),
    point(table.right, table.bottom - cornerMouthOffset),
    -1,
    0,
    'rail',
    'right-rail'
  );

  // sx and sy point from a corner toward the playable interior.
  addCornerPocket(table.left, table.top, 1, 1, 'top-left');
  addCornerPocket(table.right, table.top, -1, 1, 'top-right');
  addCornerPocket(table.left, table.bottom, 1, -1, 'bottom-left');
  addCornerPocket(table.right, table.bottom, -1, -1, 'bottom-right');

  // sy points from the rail toward the playable interior.
  addSidePocket(table.top, 1, 'top-side');
  addSidePocket(table.bottom, -1, 'bottom-side');
}

buildTableGeometry();

/* -------------------------------
   Drawing the table
--------------------------------*/
function drawTableBase() {
  ctx.clearRect(0, 0, width, height);

  // Wooden frame.
  const wood = ctx.createLinearGradient(0, 0, width, height);
  wood.addColorStop(0, '#6f3818');
  wood.addColorStop(0.5, '#9a5727');
  wood.addColorStop(1, '#5a2b13');
  ctx.fillStyle = wood;
  ctx.fillRect(0, 0, width, height);

  // Felt reaches the physical cushion nose.
  ctx.fillStyle = '#086b3a';
  ctx.fillRect(
    table.left,
    table.top,
    table.right - table.left,
    table.bottom - table.top
  );

  drawPocketSurrounds();
  drawPocketThroats();
  drawPocketLiners();
}

function drawTableTop() {
  drawCushions();
  drawDiamonds();

  // A subtle outer edge keeps the wood visually separate from the page.
  ctx.strokeStyle = '#2f170b';
  ctx.lineWidth = 4;
  ctx.strokeRect(2, 2, width - 4, height - 4);
}

function drawPocketSurrounds() {
  for (const pocket of pockets) {
    if (pocket.type === 'corner') {
      drawCornerPocketSurround(pocket);
    } else {
      drawSidePocketSurround(pocket);
    }
  }
}

function drawCornerPocketSurround(pocket) {
  ctx.save();
  ctx.translate(pocket.cx, pocket.cy);
  ctx.scale(pocket.sx, pocket.sy);

  const outer = -railThickness;
  const run = cornerMouthOffset + 8;

  ctx.beginPath();
  ctx.moveTo(outer + 10, outer);
  ctx.quadraticCurveTo(outer, outer, outer, outer + 10);
  ctx.lineTo(outer, run);
  ctx.lineTo(0, run);
  ctx.lineTo(0, cornerMouthOffset);
  ctx.quadraticCurveTo(-0.42 * ballDiameter, -0.42 * ballDiameter, cornerMouthOffset, 0);
  ctx.lineTo(run, 0);
  ctx.lineTo(run, outer);
  ctx.closePath();

  const ivory = ctx.createLinearGradient(outer, outer, run, run);
  ivory.addColorStop(0, '#b9af91');
  ivory.addColorStop(0.42, '#e1d8bc');
  ivory.addColorStop(1, '#c7bea1');
  ctx.fillStyle = ivory;
  ctx.fill();

  ctx.strokeStyle = 'rgba(67,55,37,0.35)';
  ctx.lineWidth = 1.2;
  ctx.stroke();
  ctx.restore();
}

function drawSidePocketSurround(pocket) {
  ctx.save();
  ctx.translate(pocket.cx, pocket.cy);
  ctx.scale(1, pocket.sy);

  const halfWidth = sideMouthHalf + 10;
  const outerY = -railThickness;
  const innerY = 1.5;
  const radius = 8;

  roundedRectPath(-halfWidth, outerY, halfWidth * 2, innerY - outerY, radius);
  const ivory = ctx.createLinearGradient(0, outerY, 0, innerY);
  ivory.addColorStop(0, '#bbb193');
  ivory.addColorStop(0.55, '#e0d7bb');
  ivory.addColorStop(1, '#c8bea0');
  ctx.fillStyle = ivory;
  ctx.fill();
  ctx.strokeStyle = 'rgba(67,55,37,0.32)';
  ctx.lineWidth = 1.1;
  ctx.stroke();
  ctx.restore();
}

function roundedRectPath(x, y, w, h, radius) {
  const r = Math.min(radius, Math.abs(w) / 2, Math.abs(h) / 2);
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

function drawPocketThroats() {
  for (const pocket of pockets) {
    const points = pocket.opening;
    const gradient = ctx.createLinearGradient(
      pocket.cx,
      pocket.cy,
      pocket.visualX,
      pocket.visualY
    );
    gradient.addColorStop(0, '#18372d');
    gradient.addColorStop(0.48, '#101815');
    gradient.addColorStop(1, '#050606');

    ctx.beginPath();
    ctx.moveTo(points[0].x, points[0].y);
    ctx.lineTo(points[1].x, points[1].y);

    if (pocket.type === 'corner') {
      ctx.quadraticCurveTo(
        pocket.visualX,
        pocket.visualY,
        points[2].x,
        points[2].y
      );
      ctx.lineTo(points[3].x, points[3].y);
      ctx.quadraticCurveTo(
        pocket.cx - pocket.sx * ballRadius * 0.36,
        pocket.cy - pocket.sy * ballRadius * 0.36,
        points[0].x,
        points[0].y
      );
    } else {
      ctx.quadraticCurveTo(
        pocket.visualX,
        pocket.visualY,
        points[2].x,
        points[2].y
      );
      ctx.lineTo(points[3].x, points[3].y);
      ctx.quadraticCurveTo(
        pocket.cx,
        pocket.cy - pocket.sy * 1.5,
        points[0].x,
        points[0].y
      );
    }

    ctx.closePath();
    ctx.fillStyle = gradient;
    ctx.fill();
  }
}

function drawPocketLiners() {
  for (const pocket of pockets) {
    ctx.save();
    ctx.translate(pocket.visualX, pocket.visualY);
    ctx.rotate(pocket.visualAngle);

    //ctx.shadowColor = 'transparent';
    ctx.shadowColor = 'rgba(0,0,0,0.58)';
    ctx.shadowBlur = 8;
    ctx.shadowOffsetX = 0;
    ctx.shadowOffsetY = 2;

    tracePocketShape(pocket, 1.07);
    const lip = pocket.type === 'corner'
      ? ctx.createLinearGradient(
          pocket.visualRx,
          0,
          -pocket.visualRx,
          0
        )
      : ctx.createLinearGradient(
          0,
          pocket.sy * pocket.visualRy,
          0,
          -pocket.sy * pocket.visualRy
        );
    lip.addColorStop(0, '#333531');
    lip.addColorStop(0.38, '#1c1e1c');
    lip.addColorStop(0.76, '#101211');
    lip.addColorStop(1, '#060707');
    ctx.fillStyle = lip;
    ctx.fill();

    ctx.shadowColor = 'transparent';
    tracePocketShape(pocket, 0.82);
    const well = pocket.type === 'corner'
      ? ctx.createLinearGradient(
          pocket.visualRx * 0.75,
          0,
          -pocket.visualRx * 0.75,
          0
        )
      : ctx.createLinearGradient(
          0,
          pocket.sy * pocket.visualRy * 0.75,
          0,
          -pocket.sy * pocket.visualRy * 0.75
        );
    well.addColorStop(0, '#111312');
    well.addColorStop(0.42, '#070808');
    well.addColorStop(1, '#000000');
    ctx.fillStyle = well;
    ctx.fill();

    tracePocketShape(pocket, 1.01);
    ctx.strokeStyle = 'rgba(246,239,218,0.13)';
    ctx.lineWidth = 1.1;
    ctx.stroke();

    ctx.restore();
  }
}

function tracePocketShape(pocket, scale) {
  ctx.beginPath();

  if (pocket.type === 'corner') {
    traceSuperellipse(
      pocket.visualRx * scale,
      pocket.visualRy * scale,
      2.55,
      56
    );
  } else {
    ctx.ellipse(
      0,
      0,
      pocket.visualRx * scale,
      pocket.visualRy * scale,
      0,
      0,
      Math.PI * 2
    );
  }

  ctx.closePath();
}

function traceSuperellipse(rx, ry, exponent, steps) {
  const power = 2 / exponent;
  for (let i = 0; i <= steps; i += 1) {
    const angle = i * Math.PI * 2 / steps;
    const cosine = Math.cos(angle);
    const sine = Math.sin(angle);
    const x = Math.sign(cosine) * Math.pow(Math.abs(cosine), power) * rx;
    const y = Math.sign(sine) * Math.pow(Math.abs(sine), power) * ry;

    if (i === 0) {
      ctx.moveTo(x, y);
    } else {
      ctx.lineTo(x, y);
    }
  }
}

function drawCushions() {
  drawCushionLayer(18, '#173522');
  drawCushionLayer(14, '#2d7b45');

  // The highlighted inner edge is exactly the collision line.
  ctx.lineCap = 'butt';
  ctx.lineJoin = 'round';
  ctx.strokeStyle = '#5ca86c';
  ctx.lineWidth = 1.4;
  for (const segment of cushionSegments) {
    ctx.beginPath();
    ctx.moveTo(segment.ax, segment.ay);
    ctx.lineTo(segment.bx, segment.by);
    ctx.stroke();
  }
}

function drawCushionLayer(depth, color) {
  const endpointGroups = buildEndpointGroups();

  ctx.fillStyle = color;
  for (const segment of cushionSegments) {
    const outerA = offsetPoint(segment.ax, segment.ay, segment, depth);
    const outerB = offsetPoint(segment.bx, segment.by, segment, depth);

    ctx.beginPath();
    ctx.moveTo(segment.ax, segment.ay);
    ctx.lineTo(segment.bx, segment.by);
    ctx.lineTo(outerB.x, outerB.y);
    ctx.lineTo(outerA.x, outerA.y);
    ctx.closePath();
    ctx.fill();
  }

  for (const group of endpointGroups.values()) {
    if (group.length === 2) {
      drawCushionJoin(group[0], group[1], depth, color);
    } else if (group.length === 1) {
      drawCushionCap(group[0], depth, color);
    }
  }
}

function buildEndpointGroups() {
  const groups = new Map();

  function add(segment, x, y) {
    const key = `${x.toFixed(4)},${y.toFixed(4)}`;
    if (!groups.has(key)) {
      groups.set(key, []);
    }
    groups.get(key).push({ segment, x, y });
  }

  for (const segment of cushionSegments) {
    add(segment, segment.ax, segment.ay);
    add(segment, segment.bx, segment.by);
  }

  return groups;
}

function offsetPoint(x, y, segment, depth) {
  return {
    x: x - segment.nx * depth,
    y: y - segment.ny * depth
  };
}

function drawCushionJoin(firstEndpoint, secondEndpoint, depth, color) {
  const first = firstEndpoint.segment;
  const second = secondEndpoint.segment;
  const x = firstEndpoint.x;
  const y = firstEndpoint.y;
  const outerFirst = offsetPoint(x, y, first, depth);
  const outerSecond = offsetPoint(x, y, second, depth);

  const firstDirection = segmentDirection(first);
  const secondDirection = segmentDirection(second);
  const miter = lineIntersection(
    outerFirst,
    firstDirection,
    outerSecond,
    secondDirection
  );

  let joinPoint = miter;
  if (!joinPoint || Math.hypot(joinPoint.x - x, joinPoint.y - y) > depth * 3.2) {
    joinPoint = {
      x: (outerFirst.x + outerSecond.x) / 2,
      y: (outerFirst.y + outerSecond.y) / 2
    };
  }

  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.lineTo(outerFirst.x, outerFirst.y);
  ctx.lineTo(joinPoint.x, joinPoint.y);
  ctx.lineTo(outerSecond.x, outerSecond.y);
  ctx.closePath();
  ctx.fillStyle = color;
  ctx.fill();
}

function drawCushionCap(endpoint, depth, color) {
  const segment = endpoint.segment;
  const centerX = endpoint.x - segment.nx * depth / 2;
  const centerY = endpoint.y - segment.ny * depth / 2;

  ctx.beginPath();
  ctx.arc(centerX, centerY, depth / 2, 0, Math.PI * 2);
  ctx.fillStyle = color;
  ctx.fill();
}

function segmentDirection(segment) {
  const dx = segment.bx - segment.ax;
  const dy = segment.by - segment.ay;
  const length = Math.hypot(dx, dy) || 1;
  return { x: dx / length, y: dy / length };
}

function lineIntersection(pointA, directionA, pointB, directionB) {
  const cross = directionA.x * directionB.y - directionA.y * directionB.x;
  if (Math.abs(cross) < 0.00001) {
    return null;
  }

  const dx = pointB.x - pointA.x;
  const dy = pointB.y - pointA.y;
  const t = (dx * directionB.y - dy * directionB.x) / cross;
  return {
    x: pointA.x + directionA.x * t,
    y: pointA.y + directionA.y * t
  };
}

function drawDiamonds() {
  ctx.fillStyle = '#f2ead7';
  const diamondRadius = 3;

  for (let i = 1; i <= 7; i += 1) {
    if (i === 4) {
      continue;
    }

    ctx.beginPath();
    ctx.arc((i * width) / 8, railThickness / 2, diamondRadius, 0, Math.PI * 2);
    ctx.fill();

    ctx.beginPath();
    ctx.arc((i * width) / 8, height - railThickness / 2, diamondRadius, 0, Math.PI * 2);
    ctx.fill();
  }

  for (let i = 1; i <= 3; i += 1) {
    ctx.beginPath();
    ctx.arc(railThickness / 2, (i * height) / 4, diamondRadius, 0, Math.PI * 2);
    ctx.fill();

    ctx.beginPath();
    ctx.arc(width - railThickness / 2, (i * height) / 4, diamondRadius, 0, Math.PI * 2);
    ctx.fill();
  }
}

/* -------------------------------
   Drawing balls and aiming
--------------------------------*/
function drawBalls(sinkingOnly) {
  for (const ball of balls) {
    if (Boolean(ball.sinking) !== sinkingOnly) {
      continue;
    }
    drawBall(ball);
  }
}

function drawBall(ball) {
  let drawRadius = ball.radius;
  let alpha = 1;

  if (ball.sinking) {
    drawRadius *= 1 - 0.72 * ball.sinking.progress;
    alpha = 1 - 0.82 * ball.sinking.progress;
  }

  ctx.save();
  ctx.globalAlpha = Math.max(0, alpha);

  ctx.beginPath();
  ctx.arc(ball.x, ball.y, drawRadius, 0, Math.PI * 2);
  ctx.fillStyle = ball.color;
  ctx.fill();

  ctx.beginPath();
  ctx.arc(
    ball.x - drawRadius * 0.28,
    ball.y - drawRadius * 0.28,
    drawRadius * 0.22,
    0,
    Math.PI * 2
  );
  ctx.fillStyle = 'rgba(255,255,255,0.35)';
  ctx.fill();

  ctx.restore();
}

function drawAimingLine() {
  if (!isAiming || !currentPointer) {
    return;
  }

  const cue = balls.find(ball => ball.isCue && !ball.sinking);
  if (!cue) {
    return;
  }

  ctx.beginPath();
  ctx.moveTo(cue.x, cue.y);
  ctx.lineTo(currentPointer.x, currentPointer.y);
  ctx.strokeStyle = 'rgba(255,255,255,0.75)';
  ctx.lineWidth = 2;
  ctx.setLineDash([5, 5]);
  ctx.stroke();
  ctx.setLineDash([]);
}

/* -------------------------------
   Physics
--------------------------------*/
function updateBalls(deltaFrames) {
  updateSinkingBalls(deltaFrames);

  const activeBalls = balls.filter(ball => !ball.sinking);
  let maxSpeed = 0;
  for (const ball of activeBalls) {
    maxSpeed = Math.max(maxSpeed, Math.hypot(ball.vx, ball.vy));
  }

  // Substeps prevent a fast ball from tunneling through a narrow jaw.
  const travel = maxSpeed * deltaFrames;
  const substeps = Math.max(
    1,
    Math.min(12, Math.ceil(travel / (ballRadius * 0.45)))
  );
  const step = deltaFrames / substeps;

  for (let substep = 0; substep < substeps; substep += 1) {
    for (const ball of balls) {
      if (ball.sinking) {
        continue;
      }
      ball.x += ball.vx * step;
      ball.y += ball.vy * step;
      resolveCushionCollisions(ball);
    }

    // Two passes make tightly grouped ball contacts more stable.
    handleBallCollisions();
    handleBallCollisions();

    for (const ball of balls) {
      if (!ball.sinking) {
        resolveCushionCollisions(ball);
      }
    }

    handlePockets();
  }

  const damping = Math.pow(friction, deltaFrames);
  for (const ball of balls) {
    if (ball.sinking) {
      continue;
    }

    ball.vx *= damping;
    ball.vy *= damping;

    if (Math.hypot(ball.vx, ball.vy) < 0.1) {
      ball.vx = 0;
      ball.vy = 0;
    }
  }
}

function resolveCushionCollisions(ball) {
  // Repeating the deepest correction handles a ball touching a jaw and a
  // rounded rail tip during the same substep.
  for (let iteration = 0; iteration < 3; iteration += 1) {
    let best = null;

    for (const segment of cushionSegments) {
      const collision = getBallSegmentCollision(ball, segment);
      if (collision && (!best || collision.penetration > best.penetration)) {
        best = collision;
      }
    }

    if (!best) {
      break;
    }

    ball.x += best.nx * (best.penetration + 0.01);
    ball.y += best.ny * (best.penetration + 0.01);

    const normalSpeed = ball.vx * best.nx + ball.vy * best.ny;
    if (normalSpeed < 0) {
      const tangentX = -best.ny;
      const tangentY = best.nx;
      const tangentSpeed = ball.vx * tangentX + ball.vy * tangentY;
      const newNormalSpeed = -normalSpeed * cushionRestitution;
      const newTangentSpeed = tangentSpeed * cushionTangentRetention;

      ball.vx = best.nx * newNormalSpeed + tangentX * newTangentSpeed;
      ball.vy = best.ny * newNormalSpeed + tangentY * newTangentSpeed;
    }
  }
}

function getBallSegmentCollision(ball, segment) {
  const segmentX = segment.bx - segment.ax;
  const segmentY = segment.by - segment.ay;
  const segmentLengthSquared = segmentX * segmentX + segmentY * segmentY;

  let t = 0;
  if (segmentLengthSquared > 0) {
    t = (
      (ball.x - segment.ax) * segmentX +
      (ball.y - segment.ay) * segmentY
    ) / segmentLengthSquared;
    t = Math.max(0, Math.min(1, t));
  }

  const closestX = segment.ax + t * segmentX;
  const closestY = segment.ay + t * segmentY;
  const dx = ball.x - closestX;
  const dy = ball.y - closestY;

  // One-sided collision: once a ball is behind a jaw, it is in the pocket
  // throat and must not be bounced back out by the rear of the cushion.
  const inwardSide = dx * segment.nx + dy * segment.ny;
  if (inwardSide < -0.001) {
    return null;
  }

  const distanceSquared = dx * dx + dy * dy;
  const radiusSquared = ball.radius * ball.radius;
  if (distanceSquared >= radiusSquared) {
    return null;
  }

  const distance = Math.sqrt(distanceSquared);
  let nx = segment.nx;
  let ny = segment.ny;

  if (distance > 0.000001) {
    nx = dx / distance;
    ny = dy / distance;

    // The rounded endpoint normal must still point toward the playable side.
    if (nx * segment.nx + ny * segment.ny < 0) {
      nx = -nx;
      ny = -ny;
    }
  }

  return {
    nx,
    ny,
    penetration: ball.radius - distance,
    segment
  };
}

function handleBallCollisions() {
  for (let i = 0; i < balls.length; i += 1) {
    const first = balls[i];
    if (first.sinking) {
      continue;
    }

    for (let j = i + 1; j < balls.length; j += 1) {
      const second = balls[j];
      if (second.sinking) {
        continue;
      }

      let dx = second.x - first.x;
      let dy = second.y - first.y;
      let distance = Math.hypot(dx, dy);
      const minimumDistance = first.radius + second.radius;

      if (distance >= minimumDistance) {
        continue;
      }

      if (distance < 0.000001) {
        dx = 1;
        dy = 0;
        distance = 1;
      }

      const nx = dx / distance;
      const ny = dy / distance;
      const overlap = minimumDistance - distance;

      first.x -= nx * overlap / 2;
      first.y -= ny * overlap / 2;
      second.x += nx * overlap / 2;
      second.y += ny * overlap / 2;

      const relativeNormalSpeed =
        (second.vx - first.vx) * nx +
        (second.vy - first.vy) * ny;

      if (relativeNormalSpeed >= 0) {
        continue;
      }

      const impulse = -(1 + ballRestitution) * relativeNormalSpeed / 2;
      first.vx -= impulse * nx;
      first.vy -= impulse * ny;
      second.vx += impulse * nx;
      second.vy += impulse * ny;
    }
  }
}

function handlePockets() {
  for (const ball of balls) {
    if (ball.sinking) {
      continue;
    }

    for (const pocket of pockets) {
      if (ballHasEnteredPocket(ball, pocket)) {
        beginSink(ball, pocket);
        break;
      }
    }
  }
}

function ballHasEnteredPocket(ball, pocket) {
  const dx = ball.x - pocket.dropX;
  const dy = ball.y - pocket.dropY;
  const distance = Math.hypot(dx, dy);

  if (distance < pocket.dropRadius) {
    return true;
  }

  // A second test catches a ball that crosses the mouth at speed. It still
  // requires the center to be behind the cushion nose, so a rail-hugging ball
  // is allowed to contact the jaw before it is captured.
  if (pocket.type === 'corner') {
    // Corner balls must reach the recessed drop circle. This delay is what
    // lets a rail-hugging ball visibly rebound from the opposite jaw first.
    return false;
  }

  const inwardY = (ball.y - pocket.cy) * pocket.sy;
  const crossedCushionNose = inwardY < ball.radius * 0.22;
  const insideMouth =
    Math.abs(ball.x - pocket.cx) < sideMouthHalf - ball.radius * 0.52;

  // Do not remove a side-pocket ball while it is still visibly on the cloth.
  // It starts sinking only after its center reaches the open mouth between the
  // jaws; the animation then pulls it behind the cushion toward the liner.
  return crossedCushionNose && insideMouth;
}

function beginSink(ball, pocket) {
  ball.vx = 0;
  ball.vy = 0;
  ball.sinking = {
    progress: 0,
    startX: ball.x,
    startY: ball.y,
    targetX: pocket.dropX,
    targetY: pocket.dropY
  };
}

function updateSinkingBalls(deltaFrames) {
  const survivors = [];

  for (const ball of balls) {
    if (!ball.sinking) {
      survivors.push(ball);
      continue;
    }

    ball.sinking.progress = Math.min(
      1,
      ball.sinking.progress + 0.060 * deltaFrames
    );

    const progress = ball.sinking.progress;
    const eased = 1 - Math.pow(1 - progress, 3);
    ball.x = ball.sinking.startX + (ball.sinking.targetX - ball.sinking.startX) * eased;
    ball.y = ball.sinking.startY + (ball.sinking.targetY - ball.sinking.startY) * eased;

    if (progress < 1) {
      survivors.push(ball);
      continue;
    }

    if (ball.isCue) {
      ball.x = cueSpawn.x;
      ball.y = cueSpawn.y;
      ball.vx = 0;
      ball.vy = 0;
      ball.sinking = null;
      survivors.push(ball);
    }
  }

  balls = survivors;
}

/* -------------------------------
   Animation loop
--------------------------------*/
function gameLoop(timestamp) {
  if (!lastTimestamp) {
    lastTimestamp = timestamp;
  }

  const elapsedMilliseconds = Math.min(34, timestamp - lastTimestamp);
  const deltaFrames = elapsedMilliseconds / (1000 / 60) || 1;
  lastTimestamp = timestamp;

  updateBalls(deltaFrames);
  drawTableBase();

  // Sinking balls are drawn behind the cushions so the jaw lips occlude them
  // as they drop. Active balls remain above the felt and cushions as normal.
  drawBalls(true);
  drawTableTop();
  drawBalls(false);
  drawAimingLine();
  requestAnimationFrame(gameLoop);
}

/* -------------------------------
   Pointer controls
--------------------------------*/
function getCanvasPointer(event) {
  const rect = canvas.getBoundingClientRect();
  return {
    x: (event.clientX - rect.left) * canvas.width / rect.width,
    y: (event.clientY - rect.top) * canvas.height / rect.height
  };
}

canvas.addEventListener('pointerdown', event => {
  const cue = balls.find(ball => ball.isCue && !ball.sinking);
  if (!cue) {
    return;
  }

  const pointer = getCanvasPointer(event);
  if (Math.hypot(pointer.x - cue.x, pointer.y - cue.y) > cue.radius + 5) {
    return;
  }

  isAiming = true;
  currentPointer = pointer;
  activePointerId = event.pointerId;
  canvas.setPointerCapture(event.pointerId);
});

canvas.addEventListener('pointermove', event => {
  if (!isAiming || event.pointerId !== activePointerId) {
    return;
  }
  currentPointer = getCanvasPointer(event);
});

canvas.addEventListener('pointerup', event => {
  if (!isAiming || event.pointerId !== activePointerId) {
    return;
  }

  const cue = balls.find(ball => ball.isCue && !ball.sinking);
  const pointer = getCanvasPointer(event);

  if (cue) {
    let shotX = (cue.x - pointer.x) / 10;
    let shotY = (cue.y - pointer.y) / 10;
    const speed = Math.hypot(shotX, shotY);

    if (speed > maxShotSpeed) {
      const scale = maxShotSpeed / speed;
      shotX *= scale;
      shotY *= scale;
    }

    cue.vx = shotX;
    cue.vy = shotY;
  }

  endAim(event.pointerId);
});

canvas.addEventListener('pointercancel', event => {
  if (event.pointerId === activePointerId) {
    endAim(event.pointerId);
  }
});

function endAim(pointerId) {
  if (canvas.hasPointerCapture(pointerId)) {
    canvas.releasePointerCapture(pointerId);
  }
  isAiming = false;
  currentPointer = null;
  activePointerId = null;
}

// Read-only handles are useful while tuning jaw geometry in the browser console.
window.poolDebug = {
  get balls() {
    return balls;
  },
  get cushionSegments() {
    return cushionSegments;
  },
  get pockets() {
    return pockets;
  }
};

requestAnimationFrame(gameLoop);
