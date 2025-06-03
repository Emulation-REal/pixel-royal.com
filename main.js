const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");

const keys = {};
const bullets = [];

let mouseX = 0;
let mouseY = 0;

const player = {
  x: 300,
  y: 300,
  width: 40,
  height: 40,
  speed: 4,
  angle: 0,
  health: 100,
  shield: 0,
  color: "#00aaff"
};

document.addEventListener("keydown", e => keys[e.key.toLowerCase()] = true);
document.addEventListener("keyup", e => keys[e.key.toLowerCase()] = false);

canvas.addEventListener("mousemove", e => {
  const rect = canvas.getBoundingClientRect();
  mouseX = e.clientX - rect.left;
  mouseY = e.clientY - rect.top;

  const dx = mouseX - canvas.width / 2;
  const dy = mouseY - canvas.height / 2;
  player.angle = Math.atan2(dy, dx);
});

canvas.addEventListener("mousedown", () => {
  shootBullet();
});

function shootBullet() {
  bullets.push({
    x: player.x + player.width / 2,
    y: player.y + player.height / 2,
    angle: player.angle,
    speed: 10
  });
}

function updatePlayer() {
  if (keys["w"]) player.y -= player.speed;
  if (keys["s"]) player.y += player.speed;
  if (keys["a"]) player.x -= player.speed;
  if (keys["d"]) player.x += player.speed;
}

function updateBullets() {
  for (let i = bullets.length - 1; i >= 0; i--) {
    const b = bullets[i];
    b.x += Math.cos(b.angle) * b.speed;
    b.y += Math.sin(b.angle) * b.speed;

    if (b.x < 0 || b.x > 5000 || b.y < 0 || b.y > 5000) {
      bullets.splice(i, 1);
    }
  }
}

function drawPlayer() {
  ctx.save();
  ctx.translate(canvas.width / 2, canvas.height / 2);
  ctx.rotate(player.angle);
  ctx.fillStyle = player.color;
  ctx.fillRect(-player.width / 2, -player.height / 2, player.width, player.height);
  ctx.restore();
}

function drawBullets() {
  for (const b of bullets) {
    ctx.fillStyle = "#ff0";
    ctx.beginPath();
    ctx.arc(b.x - player.x + canvas.width / 2, b.y - player.y + canvas.height / 2, 5, 0, Math.PI * 2);
    ctx.fill();
  }
}

function updateUI() {
  document.getElementById("health").innerText = `HP: ${player.health}`;
  document.getElementById("shield").innerText = `Shield: ${player.shield}`;
}

function gameLoop() {
  updatePlayer();
  updateBullets();
  updateUI();

  ctx.clearRect(0, 0, canvas.width, canvas.height);

  drawBullets();
  drawPlayer();

  requestAnimationFrame(gameLoop);
}

gameLoop();
