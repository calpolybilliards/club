/***************************************************
 * pd4.js - object-oriented balls, animated realistic shooting cue, power meter
 * The cue is a DOM overlay so it can extend outside the table canvas.
 *
 * The cushion nose is modeled as a collection of finite line segments.
 * Straight segments stop at each pocket, and angled jaw segments continue
 * into the pocket mouth. Ball-to-segment collision normals make the jaws
 * redirect balls instead of treating the table as one solid rectangle.
 ***************************************************/

'use strict';

const canvas = document.getElementById('poolCanvas');
const ctx = canvas.getContext('2d');
const powerMeter = document.getElementById('shotPower');
const powerHandle = document.getElementById('powerHandle');
const powerOutput = document.getElementById('shotPowerValue');
let shotPower = 50;
const shootButton = document.getElementById('shootButton');
const width = canvas.width;
const height = canvas.height;

// Cue dimensions are measured in the original 900 x 450 table's pixels.
// The SVG is proportionally scaled if the table is smaller on screen.
const cueLength = 450;
const cueTipWidth = 5;
const cueButtWidth = 12;
const cueArtworkHeight = 20; // Extra transparent space around the taper.
const cueGrabTolerance = 12;
const cueCenter = cueArtworkHeight / 2;
const cueBodyPath = `M 0 ${cueCenter - cueTipWidth / 2} ` +
  `L ${cueLength} ${cueCenter - cueButtWidth / 2} ` +
  `L ${cueLength} ${cueCenter + cueButtWidth / 2} ` +
  `L 0 ${cueCenter + cueTipWidth / 2} Z`;

// Place the cue in a separate layer. Canvas drawings cannot extend beyond the
// canvas boundary, but this HTML layer can -- and it receives pointer events
// even when the user grabs the section of the cue outside the table.
let tableWrapper = canvas.parentElement;
if (!tableWrapper.classList.contains('pool-table-wrapper')) {
  tableWrapper = document.createElement('div');
  tableWrapper.className = 'pool-table-wrapper';
  canvas.parentNode.insertBefore(tableWrapper, canvas);
  tableWrapper.appendChild(canvas);
}

const cueStickElement = document.createElement('div');
cueStickElement.className = 'pool-cue-hit-area';
cueStickElement.setAttribute('aria-label', 'Drag the pool cue to aim');
tableWrapper.appendChild(cueStickElement);

// The artwork is drawn at a native 450 x 20 coordinate system. The tapered
// silhouette is precisely 5 px tall at the blue leather tip and 12 px at
// the rubber-capped butt. The artwork remains a DOM overlay (not a canvas
// drawing), so the entire cue stays visible and draggable past table edges.
// The transparent SVG margins are not part of the cue's visible width.
cueStickElement.innerHTML = `
  <svg class="pool-cue-art" xmlns="http://www.w3.org/2000/svg"
       viewBox="0 0 ${cueLength} ${cueArtworkHeight}" preserveAspectRatio="none" aria-hidden="true">
    <defs>
      <clipPath id="pool-cue-taper">
        <path d="${cueBodyPath}"/>
      </clipPath>
      <linearGradient id="cue-maple" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stop-color="#a9793b"/>
        <stop offset="0.15" stop-color="#f3dfa7"/>
        <stop offset="0.38" stop-color="#fff1c5"/>
        <stop offset="0.64" stop-color="#dfb576"/>
        <stop offset="0.88" stop-color="#a87c43"/>
        <stop offset="1" stop-color="#654023"/>
      </linearGradient>
      <linearGradient id="cue-rosewood" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stop-color="#321514"/>
        <stop offset="0.23" stop-color="#703327"/>
        <stop offset="0.48" stop-color="#aa6542"/>
        <stop offset="0.69" stop-color="#723323"/>
        <stop offset="1" stop-color="#260f10"/>
      </linearGradient>
      <linearGradient id="cue-wrap-shade" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stop-color="#101112"/>
        <stop offset="0.3" stop-color="#464346"/>
        <stop offset="0.55" stop-color="#28272b"/>
        <stop offset="1" stop-color="#08090a"/>
      </linearGradient>
      <linearGradient id="cue-ivory" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stop-color="#bcb8aa"/>
        <stop offset="0.34" stop-color="#fffefa"/>
        <stop offset="0.7" stop-color="#ede9df"/>
        <stop offset="1" stop-color="#8f8a7c"/>
      </linearGradient>
      <linearGradient id="cue-leather" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stop-color="#213d5e"/>
        <stop offset="0.4" stop-color="#6599be"/>
        <stop offset="1" stop-color="#172c45"/>
      </linearGradient>
      <pattern id="cue-linen-threads" width="3" height="6"
               patternUnits="userSpaceOnUse">
        <path d="M 0 0 L 1 6" stroke="#a9a3a0" stroke-opacity=".23"
              stroke-width=".55" fill="none"/>
      </pattern>
    </defs>
    <g clip-path="url(#pool-cue-taper)">
      <!-- One continuous tapered body, with a polished maple shaft. -->
      <path d="${cueBodyPath}" fill="url(#cue-maple)"/>
      <!-- Fine, irregular straight-grain details on the maple. -->
      <path d="M 20 9.4 C 65 9.1 100 9.2 146 8.8 S 226 8.2 267 8.0"
            stroke="#93622f" stroke-opacity=".22" stroke-width=".52" fill="none"/>
      <path d="M 27 11.5 C 96 11.5 150 11.1 226 10.8 L 269 10.5"
            stroke="#fff4d3" stroke-opacity=".55" stroke-width=".52" fill="none"/>
      <path d="M 38 10.5 Q 115 10.2 194 9.9 T 267 9.6"
            stroke="#b98b4a" stroke-opacity=".22" stroke-width=".44" fill="none"/>
      <!-- Deep reddish hardwood forearm and butt sleeve. -->
      <rect x="272" y="0" width="62" height="20" fill="url(#cue-rosewood)"/>
      <rect x="412" y="0" width="33" height="20" fill="url(#cue-rosewood)"/>
      <path d="M 278 7.4 L 324 6.8 M 280 12.7 L 327 13.1
               M 418 7 L 439 6.5 M 416 13 L 441 13.8"
            stroke="#deac70" stroke-opacity=".36" stroke-width=".65" fill="none"/>
      <!-- Decorative four-point maple-and-ivory inlays on the forearm. -->
      <path d="M 281 10 L 312 7.8 L 324 10 L 312 12.2 Z"
            fill="#e8ce94" opacity=".78"/>
      <path d="M 289 10 L 312 8.7 L 317 10 L 312 11.3 Z"
            fill="#784428"/>
      <path d="M 306 10 L 315 9.1 L 321 10 L 315 10.9 Z"
            fill="#fff0bb" opacity=".8"/>
      <!-- Textured dark Irish-linen style wrap for the grip. -->
      <rect x="334" y="0" width="78" height="20" fill="url(#cue-wrap-shade)"/>
      <rect x="334" y="0" width="78" height="20" fill="url(#cue-linen-threads)"/>
      <path d="M 340 7.6 L 406 7.2" stroke="#ded7d0"
            stroke-opacity=".2" stroke-width=".7"/>
      <!-- Ivory, brass and black trim bands. -->
      <rect x="269" y="0" width="2" height="20" fill="#3b2415"/>
      <rect x="271" y="0" width="1.7" height="20" fill="#e8cf95"/>
      <rect x="329" y="0" width="2" height="20" fill="#e9cf89"/>
      <rect x="331" y="0" width="3" height="20" fill="#1b1719"/>
      <rect x="334" y="0" width="1" height="20" fill="#dfc18b"/>
      <rect x="411" y="0" width="1.5" height="20" fill="#dfc18b"/>
      <rect x="413" y="0" width="2" height="20" fill="#171418"/>
      <rect x="438" y="0" width="1.2" height="20" fill="#e4be7d"/>
      <rect x="440" y="0" width="2" height="20" fill="#181316"/>
      <!-- Mother-of-pearl diamond in the butt sleeve. -->
      <path d="M 420 10 L 425 6.9 L 430 10 L 425 13.1 Z"
            fill="#f6ead1" opacity=".94"/>
      <path d="M 422 10 L 425 8.4 L 428 10 L 425 11.6 Z"
            fill="#d8ba8c" opacity=".9"/>
      <!-- Slightly textured, black rubber bumper. -->
      <rect x="444" y="0" width="6" height="20" fill="#171617"/>
      <rect x="445" y="0" width="1" height="20" fill="#565051" opacity=".8"/>
      <rect x="449" y="0" width="1" height="20" fill="#080808"/>
      <!-- White ferrule and blue leather cue tip nearest the cue ball. -->
      <rect x="4.5" y="0" width="11.5" height="20" fill="url(#cue-ivory)"/>
      <rect x="15.5" y="0" width="1" height="20" fill="#907656" opacity=".7"/>
      <rect x="0" y="0" width="4.5" height="20" fill="url(#cue-leather)"/>
      <path d="M 0.5 8.3 L 3.2 8.25" stroke="#c4e6fa"
            stroke-opacity=".55" stroke-width=".6"/>
      <!-- A restrained varnish highlight travels the upper edge. -->
      <path d="M 17 8.55 L 266 6.63 M 274 6.65 L 327 5.82
               M 415 5.48 L 438 5.15"
            fill="none" stroke="#fff6cf" stroke-width=".58"
            stroke-opacity=".52"/>
    </g>
  </svg>
`;

// Render and rotate the cue in a separate layer outside the table canvas.
const cueStyles = document.createElement('style');
cueStyles.textContent = `
  .pool-table-wrapper {
    position: relative;
    flex: 1 1 auto;
    min-width: 0;
    max-width: 900px;
    overflow: visible;
  }
  .pool-table-wrapper #poolCanvas {
    display: block;
    width: 100%;
    max-width: none;
    min-width: 0;
    margin: 0;
  }
  .pool-cue-hit-area {
    position: absolute;
    z-index: 2;
    transform-origin: 0 50%;
    background: transparent;
    cursor: grab;
    touch-action: none;
    user-select: none;
    -webkit-user-select: none;
  }
  .pool-cue-art {
    position: absolute;
    left: var(--cue-bar-inset);
    top: 50%;
    transform: translateY(-50%);
    width: var(--cue-bar-length);
    height: var(--cue-art-height);
    display: block;
    overflow: visible;
    pointer-events: none;
  }
  .pool-cue-hit-area.is-dragging { cursor: grabbing; }
  /* Leave space beside the actual controls available for cue dragging. */
  .shot-power-controls, .shoot-controls {
    position: relative;
    z-index: 3;
    pointer-events: none;
  }
  .shot-power-controls > *, .shoot-controls > * { pointer-events: auto; }
`;
document.head.appendChild(cueStyles);

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
const maxShotSpeed = 60;
const cueSpawn = { x: 150, y: height / 2 };

/* -------------------------------
   Ball setup
--------------------------------*/
const headSpotX = (6 * width) / 8;
const headSpotY = height / 2;
const ballDiffX = 3 * ballRadius / Math.sqrt(3);
const ballDiffY = ballRadius;

// Each ball owns its position, velocity, appearance, and lifecycle.
// The table and game loop still determine the order of physics updates.
class Ball {
  constructor({ x, y, vx = 0, vy = 0, color, radius = ballRadius, isCue = false }) {
    this.x = x;
    this.y = y;
    this.vx = vx;
    this.vy = vy;
    this.color = color;
    this.radius = radius;
    this.isCue = isCue;
  }

  move(step) {
    this.x += this.vx * step;
    this.y += this.vy * step;
  }

  dampen(damping) {
    this.vx *= damping;
    this.vy *= damping;

    if (Math.hypot(this.vx, this.vy) < 0.1) {
      this.vx = 0;
      this.vy = 0;
    }
  }

  resolveCushionCollisions(segments) {
    // Repeating the deepest correction handles a ball touching a jaw and a
    // rounded rail tip during the same substep.
    for (let iteration = 0; iteration < 3; iteration += 1) {
      let best = null;

      for (const segment of segments) {
        const collision = this.getSegmentCollision(segment);
        if (collision && (!best || collision.penetration > best.penetration)) {
          best = collision;
        }
      }

      if (!best) {
        break;
      }

      this.x += best.nx * (best.penetration + 0.01);
      this.y += best.ny * (best.penetration + 0.01);

      const normalSpeed = this.vx * best.nx + this.vy * best.ny;
      if (normalSpeed < 0) {
        const tangentX = -best.ny;
        const tangentY = best.nx;
        const tangentSpeed = this.vx * tangentX + this.vy * tangentY;
        const newNormalSpeed = -normalSpeed * cushionRestitution;
        const newTangentSpeed = tangentSpeed * cushionTangentRetention;

        this.vx = best.nx * newNormalSpeed + tangentX * newTangentSpeed;
        this.vy = best.ny * newNormalSpeed + tangentY * newTangentSpeed;
      }
    }
  }

  getSegmentCollision(segment) {
    const segmentX = segment.bx - segment.ax;
    const segmentY = segment.by - segment.ay;
    const segmentLengthSquared = segmentX * segmentX + segmentY * segmentY;

    let t = 0;
    if (segmentLengthSquared > 0) {
      t = (
        (this.x - segment.ax) * segmentX +
        (this.y - segment.ay) * segmentY
      ) / segmentLengthSquared;
      t = Math.max(0, Math.min(1, t));
    }

    const closestX = segment.ax + t * segmentX;
    const closestY = segment.ay + t * segmentY;
    const dx = this.x - closestX;
    const dy = this.y - closestY;

    // One-sided collision: a ball behind a jaw has reached the pocket throat.
    const inwardSide = dx * segment.nx + dy * segment.ny;
    if (inwardSide < -0.001) {
      return null;
    }

    const distanceSquared = dx * dx + dy * dy;
    const radiusSquared = this.radius * this.radius;
    if (distanceSquared >= radiusSquared) {
      return null;
    }

    const distance = Math.sqrt(distanceSquared);
    let nx = segment.nx;
    let ny = segment.ny;

    if (distance > 0.000001) {
      nx = dx / distance;
      ny = dy / distance;

      // Rounded endpoint normals must still point toward the playable side.
      if (nx * segment.nx + ny * segment.ny < 0) {
        nx = -nx;
        ny = -ny;
      }
    }

    return {
      nx,
      ny,
      penetration: this.radius - distance,
      segment
    };
  }

  collideWith(other) {
    let dx = other.x - this.x;
    let dy = other.y - this.y;
    let distance = Math.hypot(dx, dy);
    const minimumDistance = this.radius + other.radius;

    if (distance >= minimumDistance) {
      return;
    }

    if (distance < 0.000001) {
      dx = 1;
      dy = 0;
      distance = 1;
    }

    const nx = dx / distance;
    const ny = dy / distance;
    const overlap = minimumDistance - distance;

    this.x -= nx * overlap / 2;
    this.y -= ny * overlap / 2;
    other.x += nx * overlap / 2;
    other.y += ny * overlap / 2;

    const relativeNormalSpeed =
      (other.vx - this.vx) * nx +
      (other.vy - this.vy) * ny;

    if (relativeNormalSpeed >= 0) {
      return;
    }

    const impulse = -(1 + ballRestitution) * relativeNormalSpeed / 2;
    this.vx -= impulse * nx;
    this.vy -= impulse * ny;
    other.vx += impulse * nx;
    other.vy += impulse * ny;
  }

  checkPockets(pocketList) {
    if (this.sinking) {
      return;
    }

    for (const pocket of pocketList) {
      if (this.hasEnteredPocket(pocket)) {
        this.beginSink(pocket);
        break;
      }
    }
  }

  hasEnteredPocket(pocket) {
    const dx = this.x - pocket.dropX;
    const dy = this.y - pocket.dropY;
    const distance = Math.hypot(dx, dy);

    if (distance < pocket.dropRadius) {
      return true;
    }

    // A second test catches a ball crossing the mouth at speed, but only
    // after its center is behind the cushion nose.
    if (pocket.type === 'corner') {
      // Corner balls must reach the recessed drop circle so a rail-hugging
      // ball can visibly rebound from the opposing jaw first.
      return false;
    }

    const inwardY = (this.y - pocket.cy) * pocket.sy;
    const crossedCushionNose = inwardY < this.radius * 0.22;
    const insideMouth =
      Math.abs(this.x - pocket.cx) < sideMouthHalf - this.radius * 0.52;

    return crossedCushionNose && insideMouth;
  }

  beginSink(pocket) {
    this.vx = 0;
    this.vy = 0;
    this.sinking = {
      progress: 0,
      startX: this.x,
      startY: this.y,
      targetX: pocket.dropX,
      targetY: pocket.dropY
    };
  }

  // Returns whether the ball should remain in the active ball collection.
  updateSink(deltaFrames) {
    if (!this.sinking) {
      return true;
    }

    this.sinking.progress = Math.min(
      1,
      this.sinking.progress + 0.060 * deltaFrames
    );

    const progress = this.sinking.progress;
    const eased = 1 - Math.pow(1 - progress, 3);
    this.x = this.sinking.startX + (this.sinking.targetX - this.sinking.startX) * eased;
    this.y = this.sinking.startY + (this.sinking.targetY - this.sinking.startY) * eased;

    if (progress < 1) {
      return true;
    }

    return this.finishSink();
  }

  finishSink() {
    // Object balls disappear once they have finished sinking.
    return false;
  }

  draw(context) {
    let drawRadius = this.radius;
    let alpha = 1;

    if (this.sinking) {
      drawRadius *= 1 - 0.72 * this.sinking.progress;
      alpha = 1 - 0.82 * this.sinking.progress;
    }

    context.save();
    context.globalAlpha = Math.max(0, alpha);

    context.beginPath();
    context.arc(this.x, this.y, drawRadius, 0, Math.PI * 2);
    context.fillStyle = this.color;
    context.fill();

    context.beginPath();
    context.arc(
      this.x - drawRadius * 0.28,
      this.y - drawRadius * 0.28,
      drawRadius * 0.22,
      0,
      Math.PI * 2
    );
    context.fillStyle = 'rgba(255,255,255,0.35)';
    context.fill();

    context.restore();
  }
}

// The cue ball is a Ball with the same physics and drawing, but it can be
// shot by the player and returns to its original spawn position when sunk.
class CueBall extends Ball {
  constructor(x, y) {
    super({ x, y, color: 'white', isCue: true });
  }

  // The stick is on the aimAngle side of the ball. A shot travels away
  // from the stick, with speed set independently by the power slider.
  shoot(aimAngle, powerFraction) {
    const speed = maxShotSpeed * Math.max(0, Math.min(1, powerFraction));
    this.vx = -Math.cos(aimAngle) * speed;
    this.vy = -Math.sin(aimAngle) * speed;
  }

  finishSink() {
    this.x = cueSpawn.x;
    this.y = cueSpawn.y;
    this.vx = 0;
    this.vy = 0;
    this.sinking = null;
    return true;
  }
}

// Rack positions and colors exactly match the original demo (including blue).
let balls = [
  new CueBall(300, headSpotY),

  new Ball({ x: headSpotX, y: headSpotY, color: 'red' }),

  new Ball({ x: headSpotX + ballDiffX, y: headSpotY + ballDiffY, color: 'yellow' }),
  new Ball({ x: headSpotX + ballDiffX, y: headSpotY - ballDiffY, color: 'red' }),

  new Ball({ x: headSpotX + 2 * ballDiffX, y: headSpotY + 2 * ballDiffY, color: 'red' }),
  new Ball({ x: headSpotX + 2 * ballDiffX, y: headSpotY, color: 'blue' }),
  new Ball({ x: headSpotX + 2 * ballDiffX, y: headSpotY - 2 * ballDiffY, color: 'yellow' }),

  new Ball({ x: headSpotX + 3 * ballDiffX, y: headSpotY + 3 * ballDiffY, color: 'yellow' }),
  new Ball({ x: headSpotX + 3 * ballDiffX, y: headSpotY + ballDiffY, color: 'red' }),
  new Ball({ x: headSpotX + 3 * ballDiffX, y: headSpotY - ballDiffY, color: 'yellow' }),
  new Ball({ x: headSpotX + 3 * ballDiffX, y: headSpotY - 3 * ballDiffY, color: 'red' }),

  new Ball({ x: headSpotX + 4 * ballDiffX, y: headSpotY + 4 * ballDiffY, color: 'red' }),
  new Ball({ x: headSpotX + 4 * ballDiffX, y: headSpotY + 2 * ballDiffY, color: 'yellow' }),
  new Ball({ x: headSpotX + 4 * ballDiffX, y: headSpotY, color: 'yellow' }),
  new Ball({ x: headSpotX + 4 * ballDiffX, y: headSpotY - 2 * ballDiffY, color: 'red' }),
  new Ball({ x: headSpotX + 4 * ballDiffX, y: headSpotY - 4 * ballDiffY, color: 'yellow' })
];

// By default the stick starts left of the cue ball, pointed right.
let aimAngle = Math.PI;
let lastTimestamp = 0;

// A shot is animated in three stages: pull back, accelerate to contact, and
// briefly follow through. The cue ball receives its velocity only on impact.
// The animation keeps a fixed copy of the ball position and aim angle, so the
// cue does not follow the ball once it starts rolling.
let cueAnimation = null;
// The backswing travels at a fixed speed for every power setting. At 50%,
// 110 px/s is roughly half the previous 51px-in-230ms average backswing speed.
const cueBackSpeed = 110; // canvas pixels per second
// The forward stroke accelerates more aggressively as shot power increases.
const cueForwardMinSpeed = 120; // canvas pixels per second at 0% power
const cueForwardPowerGain = 950; // additional pixels per second at 100%
const cueFollowDuration = 95;
const cueFollowDistance = 8; // canvas pixels
const cueContactTravel = 3; // close the small resting gap to the ball

function easeOutCubic(value) {
  return 1 - Math.pow(1 - value, 3);
}

function easeInCubic(value) {
  return value * value * value;
}

function updateCueAnimation(timestamp) {
  if (!cueAnimation) return;
  const shot = cueAnimation;
  const elapsed = Math.max(0, timestamp - shot.startTime);
  const forwardEnd = shot.backDuration + shot.forwardDuration;

  if (elapsed < shot.backDuration) {
    // Constant backward velocity, independent of shot power. Stronger shots
    // travel farther backward, so their backswing takes proportionally longer.
    shot.displacement = cueBackSpeed * (elapsed / 1000);
  } else if (elapsed < forwardEnd) {
    // The forward stroke is faster at higher powers and eases into impact.
    const progress = easeInCubic((elapsed - shot.backDuration) / shot.forwardDuration);
    shot.displacement = shot.backDistance * (1 - progress) -
      cueContactTravel * progress;
  } else {
    if (!shot.fired) {
      shot.fired = true;
      shot.cueBall.shoot(shot.angle, shot.power);
    }
    const followProgress = Math.min(1, (elapsed - forwardEnd) / cueFollowDuration);
    shot.displacement = -cueContactTravel - cueFollowDistance *
      easeOutCubic(followProgress);
    shot.opacity = 1 - followProgress;
    if (followProgress >= 1) cueAnimation = null;
  }
}


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
  const innerY = -2;
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
    //ctx.fillStyle = gradient;
    ctx.fillStyle = '#086b3a';
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
    ball.draw(ctx);
  }
}

function ballsAreStationary() {
  // Don't show the aiming cue or allow another shot while balls are moving
  // or dropping into a pocket.
  return balls.every(ball =>
    !ball.sinking && Math.hypot(ball.vx, ball.vy) < 0.1
  );
}

// Update the on-screen cue independently of the table canvas. Both the cue
// rectangle and its grab area can extend over the table border or page space.
function updateCueStick() {
  const shot = cueAnimation;
  const cue = shot ? shot.cueBall : getPlayableCueBall();
  if (!cue || (!shot && !ballsAreStationary())) {
    cueStickElement.style.display = 'none';
    return;
  }

  const canvasRect = canvas.getBoundingClientRect();
  const wrapperRect = tableWrapper.getBoundingClientRect();
  const sx = canvas.clientWidth / canvas.width;
  const sy = canvas.clientHeight / canvas.height;
  if (!sx || !sy) {
    cueStickElement.style.display = 'none';
    return;
  }

  // Account for the canvas border and responsive scaling. Use the scaled
  // direction so the overlay continues to line up even if resized.
  const angle = shot ? shot.angle : aimAngle;
  const dirX = Math.cos(angle) * sx;
  const dirY = Math.sin(angle) * sy;
  const scaleAlongCue = Math.hypot(dirX, dirY);
  const screenAngle = Math.atan2(dirY, dirX);
  const displacement = shot ? shot.displacement : 0;
  const offset = (cue.radius + 3 + displacement - cueGrabTolerance) * scaleAlongCue;
  const artHeight = cueArtworkHeight * Math.min(sx, sy);
  const hitHeight = Math.max(26, (cueButtWidth + 2 * cueGrabTolerance) * Math.min(sx, sy));

  const ballScreenX = canvasRect.left - wrapperRect.left + canvas.clientLeft +
    (shot ? shot.x : cue.x) * sx;
  const ballScreenY = canvasRect.top - wrapperRect.top + canvas.clientTop +
    (shot ? shot.y : cue.y) * sy;
  const x = ballScreenX + offset * Math.cos(screenAngle);
  const y = ballScreenY + offset * Math.sin(screenAngle);

  cueStickElement.style.display = 'block';
  cueStickElement.style.opacity = shot ? String(shot.opacity) : '1';
  cueStickElement.style.pointerEvents = shot ? 'none' : 'auto';
  cueStickElement.style.left = `${x}px`;
  cueStickElement.style.top = `${y - hitHeight / 2}px`;
  cueStickElement.style.width = `${(cueLength + 2 * cueGrabTolerance) * scaleAlongCue}px`;
  cueStickElement.style.height = `${hitHeight}px`;
  cueStickElement.style.transform = `rotate(${screenAngle}rad)`;
  cueStickElement.style.setProperty('--cue-bar-inset', `${cueGrabTolerance * scaleAlongCue}px`);
  cueStickElement.style.setProperty('--cue-bar-length', `${cueLength * scaleAlongCue}px`);
  cueStickElement.style.setProperty('--cue-art-height', `${artHeight}px`);
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
      ball.move(step);
      ball.resolveCushionCollisions(cushionSegments);
    }

    // Two passes make tightly grouped ball contacts more stable.
    handleBallCollisions();
    handleBallCollisions();

    for (const ball of balls) {
      if (!ball.sinking) {
        ball.resolveCushionCollisions(cushionSegments);
      }
    }

    handlePockets();
  }

  const damping = Math.pow(friction, deltaFrames);
  for (const ball of balls) {
    if (!ball.sinking) {
      ball.dampen(damping);
    }
  }
}

function handleBallCollisions() {
  for (let i = 0; i < balls.length; i += 1) {
    const first = balls[i];
    if (first.sinking) {
      continue;
    }

    for (let j = i + 1; j < balls.length; j += 1) {
      const second = balls[j];
      if (!second.sinking) {
        first.collideWith(second);
      }
    }
  }
}

function handlePockets() {
  for (const ball of balls) {
    ball.checkPockets(pockets);
  }
}

function updateSinkingBalls(deltaFrames) {
  const survivors = [];

  for (const ball of balls) {
    if (ball.updateSink(deltaFrames)) {
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

  updateCueAnimation(timestamp);
  updateBalls(deltaFrames);
  if (shootButton) {
    shootButton.disabled = Boolean(cueAnimation) || !ballsAreStationary() ||
      draggingCue || !getPlayableCueBall();
  }
  drawTableBase();

  // Sinking balls are drawn behind the cushions so the jaw lips occlude them
  // as they drop. Active balls remain above the felt and cushions as normal.
  drawBalls(true);
  drawTableTop();
  updateCueStick();
  drawBalls(false);
  requestAnimationFrame(gameLoop);
}

/* -------------------------------
   Dragging the cue, shot power and firing
--------------------------------*/
function getCanvasPointer(event) {
  const rect = canvas.getBoundingClientRect();
  const style = getComputedStyle(canvas);
  const borderLeft = parseFloat(style.borderLeftWidth) || 0;
  const borderRight = parseFloat(style.borderRightWidth) || 0;
  const borderTop = parseFloat(style.borderTopWidth) || 0;
  const borderBottom = parseFloat(style.borderBottomWidth) || 0;

  // Account for both the canvas's responsive size and its visible border.
  return {
    x: (event.clientX - rect.left - borderLeft) * canvas.width /
      (rect.width - borderLeft - borderRight),
    y: (event.clientY - rect.top - borderTop) * canvas.height /
      (rect.height - borderTop - borderBottom)
  };
}

// Cue dimensions are defined above, alongside its tapered SVG silhouette.
// aimAngle points FROM the cue ball TOWARD the stick.
let draggingCue = false;
let dragPointerId = null;
let dragStartPointerAngle = 0;
let dragStartAimAngle = 0;

function getPlayableCueBall() {
  return balls.find(ball => ball.isCue && !ball.sinking);
}

function stopCueDrag(event) {
  if (!draggingCue || event.pointerId !== dragPointerId) return;
  draggingCue = false;
  dragPointerId = null;
  if (cueStickElement.hasPointerCapture(event.pointerId)) {
    cueStickElement.releasePointerCapture(event.pointerId);
  }
  cueStickElement.classList.remove('is-dragging');
}

// Events are attached to the visible cue's own overlay rather than the table.
// Therefore the cue remains draggable even where it extends beyond the canvas.
cueStickElement.addEventListener('pointerdown', event => {
  if ((event.pointerType === 'mouse' && event.button !== 0) ||
      !ballsAreStationary() || cueAnimation) return;
  const cue = getPlayableCueBall();
  if (!cue) return;
  const pointer = getCanvasPointer(event);
  draggingCue = true;
  dragPointerId = event.pointerId;
  dragStartPointerAngle = Math.atan2(pointer.y - cue.y, pointer.x - cue.x);
  dragStartAimAngle = aimAngle;
  cueStickElement.setPointerCapture(event.pointerId);
  cueStickElement.classList.add('is-dragging');
  event.preventDefault();
});

cueStickElement.addEventListener('pointermove', event => {
  if (!draggingCue || event.pointerId !== dragPointerId) return;
  const cue = getPlayableCueBall();
  if (!cue) return;
  const pointer = getCanvasPointer(event);
  const pointerAngle = Math.atan2(pointer.y - cue.y, pointer.x - cue.x);
  // Keep the original grabbed section under the cursor, without jumping.
  const change = pointerAngle - dragStartPointerAngle;
  aimAngle = dragStartAimAngle + Math.atan2(Math.sin(change), Math.cos(change));
});

cueStickElement.addEventListener('pointerup', stopCueDrag);
cueStickElement.addEventListener('pointercancel', stopCueDrag);
cueStickElement.addEventListener('lostpointercapture', event => {
  if (event.pointerId === dragPointerId) {
    draggingCue = false;
    dragPointerId = null;
    cueStickElement.classList.remove('is-dragging');
  }
});

// The only way to shoot is the button to the right of the table.
if (shootButton) {
  shootButton.addEventListener('click', () => {
    if (!ballsAreStationary() || draggingCue || cueAnimation) return;
    const cue = getPlayableCueBall();
    if (!cue) return;

    // Snapshot power and aim for the entire stroke. The current power-meter
    // selection stays where it is for the next shot; there is no reset.
    const power = shotPower / 100;
    const backDistance = 12 + 78 * power; // 12px at 0%, 90px at 100%
    const forwardSpeed = cueForwardMinSpeed + cueForwardPowerGain * power;
    cueAnimation = {
      cueBall: cue,
      x: cue.x,
      y: cue.y,
      angle: aimAngle,
      power,
      startTime: performance.now(),
      backDistance,
      backDuration: backDistance / cueBackSpeed * 1000,
      // Greater power means a quicker forward stroke, even though that stroke
      // must cover the longer backswing distance.
      forwardDuration: (backDistance + cueContactTravel) / forwardSpeed * 1000,
      displacement: 0,
      opacity: 1,
      fired: false
    };
    shootButton.disabled = true;
  });
}

// Keep the entire color spectrum at the meter's full height and reveal it
// from the bottom. The unfilled portion stays light gray.
function setShotPower(value) {
  shotPower = Math.max(0, Math.min(100, Math.round(value)));
  powerMeter.style.setProperty('--power-unfilled', `${100 - shotPower}%`);
  powerMeter.style.setProperty('--power-level', `${shotPower}%`);
  powerMeter.setAttribute('aria-valuenow', String(shotPower));
  powerOutput.value = `${shotPower}%`;
}

function setShotPowerFromY(clientY) {
  const bounds = powerMeter.getBoundingClientRect();
  setShotPower((bounds.bottom - clientY) / bounds.height * 100);
}

// Clicking any part of the rectangular track jumps directly to that power.
powerMeter.addEventListener('pointerdown', event => {
  if (event.target === powerHandle ||
      (event.pointerType === 'mouse' && event.button !== 0)) return;
  setShotPowerFromY(event.clientY);
  powerMeter.focus({ preventScroll: true });
  event.preventDefault();
});

// The handle overlaps the track by just a few pixels. Dragging it keeps its
// initial grab offset, so it does not jump when grabbed near one edge.
let handleDragPointer = null;
let handleDragOffsetY = 0;

powerHandle.addEventListener('pointerdown', event => {
  if (event.pointerType === 'mouse' && event.button !== 0) return;
  event.stopPropagation();
  event.preventDefault();
  const bounds = powerMeter.getBoundingClientRect();
  const handleY = bounds.bottom - shotPower / 100 * bounds.height;
  handleDragOffsetY = event.clientY - handleY;
  handleDragPointer = event.pointerId;
  powerHandle.setPointerCapture(event.pointerId);
  powerMeter.classList.add('is-dragging');
});

powerHandle.addEventListener('pointermove', event => {
  if (event.pointerId !== handleDragPointer) return;
  setShotPowerFromY(event.clientY - handleDragOffsetY);
});

function stopPowerHandleDrag(event) {
  if (event.pointerId !== handleDragPointer) return;
  handleDragPointer = null;
  powerMeter.classList.remove('is-dragging');
  if (powerHandle.hasPointerCapture(event.pointerId)) {
    powerHandle.releasePointerCapture(event.pointerId);
  }
}

powerHandle.addEventListener('pointerup', stopPowerHandleDrag);
powerHandle.addEventListener('pointercancel', stopPowerHandleDrag);
powerHandle.addEventListener('lostpointercapture', stopPowerHandleDrag);

// Keyboard operation for the vertical slider (up = more power).
powerMeter.addEventListener('keydown', event => {
  let next = shotPower;
  switch (event.key) {
    case 'ArrowUp':
    case 'ArrowRight': next += 1; break;
    case 'ArrowDown':
    case 'ArrowLeft': next -= 1; break;
    case 'PageUp': next += 10; break;
    case 'PageDown': next -= 10; break;
    case 'Home': next = 0; break;
    case 'End': next = 100; break;
    default: return;
  }
  event.preventDefault();
  setShotPower(next);
});

// Initialize the meter to 50%; subsequent shots retain the selected power.
setShotPower(50);

// Read-only handles are useful while tuning jaw geometry in the browser console.
window.poolDebug = {
  Ball,
  CueBall,
  get aimAngle() {
    return aimAngle;
  },
  get cueAnimation() {
    return cueAnimation;
  },
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
