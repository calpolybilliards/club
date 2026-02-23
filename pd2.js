/***************************************************
 * pool.js (Final Realistic Version)
 * - Rails drawn outside felt
 * - Pockets inset inside rails
 * - Diamonds added
 * - Collisions, friction, aiming, pocket detection
 ***************************************************/

const canvas = document.getElementById('poolCanvas');
const ctx = canvas.getContext('2d');
const width = canvas.width 
const height = canvas.height 

// Table setup
const railThickness = 32; //32
const ballRadius = 10
const pocketRadius = 2 * ballRadius; //18


// Ball setup (cue ball + 3 balls for demo)
const headSpotX = (6 * width) / 8     // width/1.4+ballRadius*4-5
const headSpotY = height/2
const ballDiffX = 3*ballRadius/Math.sqrt(3) 
const ballDiffY = ballRadius

let balls = [
  {x:300,y:headSpotY,vx:0,vy:0,color:'white', radius:ballRadius, isCue:true},

  {x:headSpotX,y:height/2,vx:0,vy:0,color:'red',   radius:ballRadius, isCue:false},

  {x:headSpotX + ballDiffX,y:headSpotY + ballDiffY,vx:0,vy:0,color:'yellow',  radius:ballRadius, isCue:false},
  {x:headSpotX + ballDiffX,y:headSpotY - ballDiffY,vx:0,vy:0,color:'red',radius:ballRadius, isCue:false},

  {x:headSpotX + 2*ballDiffX ,y:headSpotY + 2*ballDiffY,vx:0,vy:0,color:'red',  radius:ballRadius, isCue:false},
  {x:headSpotX + 2*ballDiffX ,y:headSpotY ,vx:0,vy:0,color:'blue',radius:ballRadius, isCue:false},
  {x:headSpotX + 2*ballDiffX, y:headSpotY - 2*ballDiffY,vx:0,vy:0,color:'yellow',radius:ballRadius, isCue:false},

  {x:headSpotX + 3*ballDiffX,y:headSpotY + 3*ballDiffY,vx:0,vy:0,color:'yellow',  radius:ballRadius, isCue:false},
  {x:headSpotX + 3*ballDiffX,y:headSpotY + ballDiffY,vx:0,vy:0,color:'red',radius:ballRadius, isCue:false},
  {x:headSpotX + 3*ballDiffX,y:headSpotY - ballDiffY,vx:0,vy:0,color:'yellow',radius:ballRadius, isCue:false},
  {x:headSpotX + 3*ballDiffX,y:headSpotY - 3*ballDiffY,vx:0,vy:0,color:'red',  radius:ballRadius, isCue:false},

  {x:headSpotX + 4*ballDiffX,y:headSpotY + 4*ballDiffY,vx:0,vy:0,color:'red',radius:ballRadius, isCue:false},
  {x:headSpotX + 4*ballDiffX,y:headSpotY + 2*ballDiffY,vx:0,vy:0,color:'yellow',radius:ballRadius, isCue:false},
  {x:headSpotX + 4*ballDiffX,y:headSpotY ,vx:0,vy:0,color:'yellow',  radius:ballRadius, isCue:false},
  {x:headSpotX + 4*ballDiffX,y:headSpotY - 2*ballDiffY,vx:0,vy:0,color:'red',radius:ballRadius, isCue:false},
  {x:headSpotX + 4*ballDiffX,y:headSpotY - 4*ballDiffY,vx:0,vy:0,color:'yellow',radius:ballRadius, isCue:false}


];

const cueSpawn = {x:150,y:height/2}; 
const friction = 0.985; 
let isAiming = false;
let aimStart = null;
let currentMouse = null;

/* -------------------------------
   Drawing the Table
--------------------------------*/
function drawTable() {
  // Fill background with wood rails
  ctx.fillStyle = '#8B4513'; 
  ctx.fillRect(0, 0, width, height);

  // Draw felt (inset inside rails)
  ctx.fillStyle = '#006400'; 
  ctx.fillRect(
    railThickness, 
    railThickness, 
    width - 2 * railThickness, 
    height - 2 * railThickness
  );

  // Draw pockets inside the rails
  ctx.fillStyle = 'black';
  // Corner pockets
  ctx.beginPath(); ctx.arc(railThickness, railThickness, pocketRadius, 0, Math.PI*2); ctx.fill();
  ctx.beginPath(); ctx.arc(width - railThickness, railThickness, pocketRadius, 0, Math.PI*2); ctx.fill();
  ctx.beginPath(); ctx.arc(railThickness, height - railThickness, pocketRadius, 0, Math.PI*2); ctx.fill();
  ctx.beginPath(); ctx.arc(width - railThickness, height - railThickness, pocketRadius, 0, Math.PI*2); ctx.fill();
  // Side pockets
  ctx.beginPath(); ctx.arc(width/2, railThickness, pocketRadius, 0, Math.PI*2); ctx.fill();
  ctx.beginPath(); ctx.arc(width/2, height - railThickness, pocketRadius, 0, Math.PI*2); ctx.fill();

  // Rail diamonds (white markers)
  ctx.fillStyle = 'white';
  const diamondRadius = 3;

  // Top/bottom rails
  for (i = 1; i <= 7; i++) {
    ctx.beginPath();
    ctx.arc((i * width) / 8, railThickness/2, diamondRadius, 0, Math.PI*2);

    if (i != 4){
      ctx.fill();
    }

    ctx.beginPath();
    ctx.arc((i * width) / 8, height - railThickness/2, diamondRadius, 0, Math.PI*2);
    if (i != 4){
      ctx.fill();
    }
  }

  // Left/right rails
  for (let i = 1; i <= 3; i++) {
    ctx.beginPath();
    ctx.arc(railThickness/2, (i * height) / 4, diamondRadius, 0, Math.PI*2);
    ctx.fill();

    ctx.beginPath();
    ctx.arc(width - railThickness/2, (i * height) / 4, diamondRadius, 0, Math.PI*2);
    ctx.fill();
  }
}

/* -------------------------------
   Drawing Balls & Aiming
--------------------------------*/
function drawBalls() {
  //if button is pressed
  balls.forEach(b => {
    ctx.beginPath();
    ctx.arc(b.x, b.y, b.radius, 0, Math.PI*2);
    ctx.fillStyle = b.color;
    ctx.fill();
    ctx.closePath();
  });
}

function drawAimingLine() {
  if (isAiming && aimStart && currentMouse) {
    const cue = balls.find(b => b.isCue);
    if (!cue) return;
    ctx.beginPath();
    ctx.moveTo(cue.x, cue.y);
    ctx.lineTo(currentMouse.x, currentMouse.y);
    ctx.strokeStyle = "rgba(255,255,255,0.7)";
    ctx.lineWidth = 2;
    ctx.setLineDash([5, 5]);
    ctx.stroke();
    ctx.setLineDash([]);
  }
}

/* -------------------------------
   Physics
--------------------------------*/
function updateBalls() {
  balls.forEach(b => {
    b.x += b.vx;
    b.y += b.vy;

    b.vx *= friction;
    b.vy *= friction;

    if (Math.hypot(b.vx, b.vy) < 0.1) {
      b.vx = b.vy = 0;
    }

    // Bounce off inner felt edges (inside rails)
    if (b.x < railThickness + b.radius || b.x > width - railThickness - b.radius) {
      b.vx *= -1;
      b.x = Math.max(railThickness + b.radius, Math.min(width - railThickness - b.radius, b.x));
    }
    if (b.y < railThickness + b.radius || b.y > height - railThickness - b.radius) {
      b.vy *= -1;
      b.y = Math.max(railThickness + b.radius, Math.min(height - railThickness - b.radius, b.y));
    }
  });

  handleCollisions();
  handlePockets();
}

// Ball collisions
function handleCollisions() {
  for (let i = 0; i < balls.length; i++) {
    for (let j = i+1; j < balls.length; j++) {
      const b1 = balls[i], b2 = balls[j];
      const dx = b2.x - b1.x;
      const dy = b2.y - b1.y;
      const dist = Math.hypot(dx, dy);
      const minDist = b1.radius + b2.radius;

      if (dist < minDist) {
        const overlap = (minDist - dist) / 2;
        const nx = dx / dist, ny = dy / dist;

        b1.x -= nx * overlap;
        b1.y -= ny * overlap;
        b2.x += nx * overlap;
        b2.y += ny * overlap;

        const kx = (b1.vx - b2.vx);
        const ky = (b1.vy - b2.vy);
        const p = 2 * (nx * kx + ny * ky) / 2;

        b1.vx -= p * nx;
        b1.vy -= p * ny;
        b2.vx += p * nx;
        b2.vy += p * ny;
      }
    }
  }
}

// Pocket detection
function handlePockets() {
  balls = balls.filter(b => {
    // Corner & side pocket positions
    const pocketCenters = [
      {x: railThickness, y: railThickness},
      {x: width - railThickness, y: railThickness},
      {x: railThickness, y: height - railThickness},
      {x: width - railThickness, y: height - railThickness},
      {x: width/2, y: railThickness},
      {x: width/2, y: height - railThickness}
    ];

    for (let p of pocketCenters) {
      const dx = b.x - p.x;
      const dy = b.y - p.y;
      if (Math.hypot(dx, dy) < pocketRadius) {
        if (b.isCue) {
          // Respawn cue ball if scratched
          b.x = cueSpawn.x;
          b.y = cueSpawn.y;
          b.vx = b.vy = 0;
          return true;
        }
        return false; // remove sunk object ball
      }
    }
    return true;
  });
}

/* -------------------------------
   Game Loop
--------------------------------*/
function gameLoop() {
  drawTable();
  updateBalls();
  drawBalls();
  drawAimingLine();
  requestAnimationFrame(gameLoop);
}

/* -------------------------------
   Mouse Controls
--------------------------------*/
canvas.addEventListener('mousedown', e => {
  const cue = balls.find(b => b.isCue);
  if (!cue) return;
  const rect = canvas.getBoundingClientRect();
  const mx = e.clientX - rect.left, my = e.clientY - rect.top;

  if (Math.hypot(mx - cue.x, my - cue.y) < cue.radius + 5) {
    isAiming = true;
    aimStart = {x: mx, y: my};
    currentMouse = {x: mx, y: my};
  }
});

canvas.addEventListener('mousemove', e => {
  if (isAiming) {
    const rect = canvas.getBoundingClientRect();
    currentMouse = {x: e.clientX - rect.left, y: e.clientY - rect.top};
  }
});

canvas.addEventListener('mouseup', e => {
  if (isAiming) {
    const cue = balls.find(b => b.isCue);
    const rect = canvas.getBoundingClientRect();
    const mx = e.clientX - rect.left, my = e.clientY - rect.top;

    cue.vx = (cue.x - mx) / 10;
    cue.vy = (cue.y - my) / 10;
  }
  isAiming = false;
  aimStart = null;
  currentMouse = null;
});

/* -------------------------------
   Start
--------------------------------*/
gameLoop();