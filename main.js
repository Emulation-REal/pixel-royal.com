const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");

const TILE_SIZE = 64;
const MAP_WIDTH = 30;
const MAP_HEIGHT = 20;

const keys = {};
let mouseX = 0;
let mouseY = 0;
let mouseDown = false;

// --- MAP DATA ---
// 0 = empty
// 1 = ground
// 2 = wall (built or house wall)
// 3 = chest
// 4 = house floor (just visual)
const map = [];
for(let y=0; y<MAP_HEIGHT; y++){
  map[y] = [];
  for(let x=0; x<MAP_WIDTH; x++){
    // Make ground by default
    map[y][x] = 1;
  }
}
// Add some houses with chests inside
function buildHouse(x,y,w,h){
  for(let i=y; i<y+h; i++){
    for(let j=x; j<x+w; j++){
      if(i === y || i === y+h-1 || j === x || j === x+w-1){
        map[i][j] = 2; // walls
      } else {
        map[i][j] = 4; // floor
      }
    }
  }
  // Put a chest inside at center
  const chestX = x + Math.floor(w/2);
  const chestY = y + Math.floor(h/2);
  map[chestY][chestX] = 3;
}
// Build 3 houses
buildHouse(5,5,6,6);
buildHouse(15,3,8,7);
buildHouse(22,12,7,6);

// --- PLAYER ---
const player = {
  x: MAP_WIDTH * TILE_SIZE / 2,
  y: MAP_HEIGHT * TILE_SIZE / 2,
  width: 40,
  height: 40,
  speed: 4,
  angle: 0,
  health: 100,
  shield: 0,
  maxHealth: 100,
  maxShield: 100,
  color: "#00aaff",
  inventory: [
    { type: "pistol", name: "Pistol", ammo: 15 },
    { type: "shield", name: "Shield Potion", count: 2 },
    { type: "medkit", name: "Medkit", count: 1 },
    null,
    null
  ],
  selectedIndex: 0,
  isBuilding: false
};

const bullets = [];
const builds = []; // walls built by player

// --- AI BOTS ---
const bots = [];
function spawnBot(x,y){
  bots.push({
    x, y,
    width: 40,
    height: 40,
    color: "#ff5555",
    speed: 2,
    health: 100,
    shield: 0,
    angle: 0,
    shootCooldown: 0
  });
}
// Spawn 3 bots
spawnBot(200,200);
spawnBot(700,600);
spawnBot(1100,500);

// --- CHEST LOOT TABLE ---
const chestLoot = [
  { type: "pistol", name: "Pistol", ammo: 15 },
  { type: "shield", name: "Shield Potion", count: 1 },
  { type: "medkit", name: "Medkit", count: 1 },
];

// --- STORM ---
let storm = {
  centerX: MAP_WIDTH * TILE_SIZE / 2,
  centerY: MAP_HEIGHT * TILE_SIZE / 2,
  radius: Math.min(MAP_WIDTH, MAP_HEIGHT) * TILE_SIZE / 2,
  shrinkRate: 0.1,
  minRadius: 100
};

let stormDamageTick = 0;

// --- INPUT ---
document.addEventListener("keydown", e => {
  keys[e.key.toLowerCase()] = true;

  // Number keys switch inventory slots 1-5
  if (e.key >= '1' && e.key <= '5') {
    const idx = parseInt(e.key) - 1;
    if (player.inventory[idx]) {
      player.selectedIndex = idx;
    }
  }

  // Build wall with 'B' key if not holding weapon or heal/shield
  if (e.key.toLowerCase() === 'b') {
    player.isBuilding = !player.isBuilding;
  }

  // Use item with 'E' key
  if (e.key.toLowerCase() === 'e') {
    useItem();
  }
});
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
  mouseDown = true;
  if (!player.isBuilding) shootBullet();
});
canvas.addEventListener("mouseup", () => {
  mouseDown = false;
});

// --- FUNCTIONS ---
function useItem(){
  const item = player.inventory[player.selectedIndex];
  if (!item) return;

  if (item.type === "shield" && item.count > 0){
    // Use shield potion
    const shieldGain = 25;
    player.shield = Math.min(player.shield + shieldGain, player.maxShield);
    item.count--;
    if (item.count === 0) player.inventory[player.selectedIndex] = null;
  }
  else if (item.type === "medkit" && item.count > 0){
    // Use medkit
    const healthGain = 30;
    player.health = Math.min(player.health + healthGain, player.maxHealth);
    item.count--;
    if (item.count === 0) player.inventory[player.selectedIndex] = null;
  }
}

function shootBullet() {
  const item = player.inventory[player.selectedIndex];
  if (!item || !item.ammo) return; // only shoot if weapon with ammo

  if (item.ammo <= 0) return;

  bullets.push({
    x: player.x + player.width / 2,
    y: player.y + player.height / 2,
    angle: player.angle,
    speed: 12,
    owner: "player",
    damage: 20
  });
  item.ammo--;
}

function updatePlayer() {
  let moveX = 0;
  let moveY = 0;

  if (keys["w"]) moveY -= 1;
  if (keys["s"]) moveY += 1;
  if (keys["a"]) moveX -= 1;
  if (keys["d"]) moveX += 1;

  // Normalize diagonal movement
  if (moveX !== 0 && moveY !== 0) {
    moveX *= Math.SQRT1_2;
    moveY *= Math.SQRT1_2;
  }

  player.x += moveX * player.speed;
  player.y += moveY * player.speed;

  // Clamp to map bounds
  player.x = Math.max(0, Math.min(player.x, MAP_WIDTH * TILE_SIZE - player.width));
  player.y = Math.max(0, Math.min(player.y, MAP_HEIGHT * TILE_SIZE - player.height));

  // Building placement (on mouse click + 'B' mode)
  if (player.isBuilding && mouseDown) {
    placeWall();
  }
}

function placeWall() {
  // Convert mouse pos to map coords
  const worldMouseX = player.x - canvas.width / 2 + mouseX;
  const worldMouseY = player.y - canvas.height / 2 + mouseY;
  const tileX = Math.floor(worldMouseX / TILE_SIZE);
  const tileY = Math.floor(worldMouseY / TILE_SIZE);

  // Check if within bounds and tile empty (1 = ground only)
  if (
    tileX >= 0 && tileX < MAP_WIDTH &&
    tileY >= 0 && tileY < MAP_HEIGHT &&
    map[tileY][tileX] === 1
  ) {
    // Add build wall
    builds.push({ x: tileX, y: tileY, type: 2 });
    // Mark map so no double build on same tile
    map[tileY][tileX] = 2;
  }
}

function updateBullets() {
  for (let i = bullets.length - 1; i >= 0; i--) {
    const b = bullets[i];
    b.x += Math.cos(b.angle) * b.speed;
    b.y += Math.sin(b.angle) * b.speed;

    // Check collisions with map walls or builds
    const tileX = Math.floor(b.x / TILE_SIZE);
    const tileY = Math.floor(b.y / TILE_SIZE);

    if (
      tileX < 0 || tileX >= MAP_WIDTH || tileY < 0 || tileY >= MAP_HEIGHT ||
      map[tileY][tileX] === 2 // wall tile
    ) {
      bullets.splice(i, 1);
      continue;
    }

    // Check collisions with bots
    for (const bot of bots) {
      if (collides(b.x, b.y, 5, bot.x, bot.y, bot.width, bot.height)) {
        bot.health -= b.damage;
        bullets.splice(i, 1);
        break;
      }
    }

    // Check collision with player (if bullet owner is bot)
    if (b.owner === "bot" && collides(b.x, b.y, 5, player.x, player.y, player.width, player.height)) {
      damagePlayer(b.damage);
      bullets.splice(i, 1);
    }
  }
}

function collides(x1, y1, r1, x2, y2, w2, h2){
  // Circle to rectangle collision
  const distX = Math.abs(x1 - (x2 + w2/2));
  const distY = Math.abs(y1 - (y2 + h2/2));

  if(distX > (w2/2 + r1)) return false;
  if(distY > (h2/2 + r1)) return false;

  if(distX <= (w2/2)) return true;
  if(distY <= (h2/2)) return true;

  const dx = distX - w2/2;
  const dy = distY - h2/2;
  return (dx*dx + dy*dy <= (r1*r1));
}

function damagePlayer(amount){
  if(player.shield > 0){
    const shieldDamage = Math.min(amount, player.shield);
    player.shield -= shieldDamage;
    amount -= shieldDamage;
  }
  player.health -= amount;
  if(player.health <= 0){
    alert("You died! Refresh to restart.");
    player.health = player.maxHealth;
    player.shield = 0;
    player.x = MAP_WIDTH * TILE_SIZE / 2;
    player.y = MAP_HEIGHT * TILE_SIZE / 2;
  }
}

// --- AI BOTS LOGIC ---
function updateBots(){
  for(const bot of bots){
    if(bot.health <= 0) continue;

    // Simple AI: move randomly, shoot if player close

    // Move randomly
    if(Math.random() < 0.01){
      bot.moveDirX = (Math.random() - 0.5) * 2;
      bot.moveDirY = (Math.random() - 0.5) * 2;
    }
    if(bot.moveDirX === undefined) bot.moveDirX = 0;
    if(bot.moveDirY === undefined) bot.moveDirY = 0;

    bot.x += bot.moveDirX * bot.speed;
    bot.y += bot.moveDirY * bot.speed;

    // Clamp inside map
    bot.x = Math.max(0, Math.min(bot.x, MAP_WIDTH * TILE_SIZE - bot.width));
    bot.y = Math.max(0, Math.min(bot.y, MAP_HEIGHT * TILE_SIZE - bot.height));

    // Face player
    const dx = player.x - bot.x;
    const dy = player.y - bot.y;
    bot.angle = Math.atan2(dy, dx);

    // Shoot cooldown
    bot.shootCooldown = Math.max(0, bot.shootCooldown - 1);

    if(bot.shootCooldown === 0){
      // Check distance to player for shooting
      const dist = Math.sqrt(dx*dx + dy*dy);
      if(dist < 400){
        bullets.push({
          x: bot.x + bot.width/2,
          y: bot.y + bot.height/2,
          angle: bot.angle,
          speed: 10,
          owner: "bot",
          damage: 10
        });
        bot.shootCooldown = 60; // 1 second cooldown
      }
    }
  }
}

// --- CHESTS ---
function checkChestPickup(){
  // Player in chest tile?
  const playerTileX = Math.floor((player.x + player.width/2) / TILE_SIZE);
  const playerTileY = Math.floor((player.y + player.height/2) / TILE_SIZE);

  if(map[playerTileY] && map[playerTileY][playerTileX] === 3){
    // Loot the chest
    // Add a random item to first empty inventory slot
    for(const loot of chestLoot){
      if(addToInventory(loot)){
        break;
      }
    }
    // Remove chest from map
    map[playerTileY][playerTileX] = 4; // floor
    console.log("Chest looted!");
  }
}

function addToInventory(item){
  for(let i=0; i<player.inventory.length; i++){
    let slot = player.inventory[i];
    if(slot === null){
      player.inventory[i] = JSON.parse(JSON.stringify(item)); // deep copy
      return true;
    }
    // Stack if same type and has count or ammo
    if(slot.type === item.type){
      if(slot.count !== undefined){
        slot.count += item.count;
        return true;
      }
      if(slot.ammo !== undefined){
        slot.ammo += item.ammo;
        return true;
      }
    }
  }
  return false;
}

// --- STORM ---
function updateStorm(){
  storm.radius -= storm.shrinkRate;
  if(storm.radius < storm.minRadius) storm.radius = storm.minRadius;

  // Damage player if outside storm circle
  const dx = player.x + player.width/2 - storm.centerX;
  const dy = player.y + player.height/2 - storm.centerY;
  const dist = Math.sqrt(dx*dx + dy*dy);
  if(dist > storm.radius){
    stormDamageTick++;
    if(stormDamageTick >= 30){
      damagePlayer(2);
      stormDamageTick = 0;
    }
  } else {
    stormDamageTick = 0;
  }
}

// --- DRAW ---
function drawMap(){
  for(let y=0; y<MAP_HEIGHT; y++){
    for(let x=0; x<MAP_WIDTH; x++){
      const tile = map[y][x];
      let color = "#77aa77"; // grass default
      if(tile === 1) color = "#77aa77"; // ground
      else if(tile === 2) color = "#555555"; // wall
      else if(tile === 3) color = "#aa7722"; // chest
      else if(tile === 4) color = "#ccaa88"; // house floor

      // Draw tile
      const drawX = x * TILE_SIZE - player.x + canvas.width / 2 - player.width / 2;
      const drawY = y * TILE_SIZE - player.y + canvas.height / 2 - player.height / 2;

      ctx.fillStyle = color;
      ctx.fillRect(drawX, drawY, TILE_SIZE, TILE_SIZE);

      // Draw chest icon for chests
      if(tile === 3){
        ctx.fillStyle = "yellow";
        ctx.fillRect(drawX + TILE_SIZE/4, drawY + TILE_SIZE/4, TILE_SIZE/2, TILE_SIZE/2);
      }
    }
  }
  // Draw player built walls
  for(const b of builds){
    const drawX = b.x * TILE_SIZE - player.x + canvas.width / 2 - player.width / 2;
    const drawY = b.y * TILE_SIZE - player.y + canvas.height / 2 - player.height / 2;
    ctx.fillStyle = "#888888";
    ctx.fillRect(drawX, drawY, TILE_SIZE, TILE_SIZE);
  }
}

function drawPlayer(){
  const drawX = canvas.width / 2 - player.width / 2;
  const drawY = canvas.height / 2 - player.height / 2;

  ctx.save();
  ctx.translate(drawX + player.width / 2, drawY + player.height / 2);
  ctx.rotate(player.angle);
  ctx.fillStyle = player.color;
  ctx.fillRect(-player.width/2, -player.height/2, player.width, player.height);

  // Draw weapon/item in player's hand
  const heldItem = player.inventory[player.selectedIndex];
  if(heldItem){
    ctx.fillStyle = "#222222";
    ctx.fillRect(10, -10, 30, 10); // simple rectangle weapon/held item
    ctx.fillStyle = "white";
    ctx.font = "12px Arial";
    ctx.fillText(heldItem.name, 10, -15);
    if(heldItem.ammo !== undefined) {
      ctx.fillText("Ammo: "+heldItem.ammo, 10, 0);
    } else if(heldItem.count !== undefined){
      ctx.fillText("Count: "+heldItem.count, 10, 0);
    }
  }

  ctx.restore();

  // Draw health and shield bars
  ctx.fillStyle = "red";
  ctx.fillRect(20, canvas.height - 40, 200 * (player.health / player.maxHealth), 15);
  ctx.strokeStyle = "black";
  ctx.strokeRect(20, canvas.height - 40, 200, 15);

  ctx.fillStyle = "blue";
  ctx.fillRect(20, canvas.height - 20, 200 * (player.shield / player.maxShield), 10);
  ctx.strokeStyle = "black";
  ctx.strokeRect(20, canvas.height - 20, 200, 10);
}

function drawBots(){
  for(const bot of bots){
    if(bot.health <= 0) continue;
    const drawX = bot.x - player.x + canvas.width / 2 - bot.width / 2;
    const drawY = bot.y - player.y + canvas.height / 2 - bot.height / 2;

    ctx.save();
    ctx.translate(drawX + bot.width/2, drawY + bot.height/2);
    ctx.rotate(bot.angle);
    ctx.fillStyle = bot.color;
    ctx.fillRect(-bot.width/2, -bot.height/2, bot.width, bot.height);
    ctx.restore();

    // Draw health bar
    ctx.fillStyle = "red";
    ctx.fillRect(drawX, drawY - 10, bot.width * (bot.health / 100), 5);
    ctx.strokeStyle = "black";
    ctx.strokeRect(drawX, drawY - 10, bot.width, 5);
  }
}

function drawBullets(){
  ctx.fillStyle = "black";
  for(const b of bullets){
    const drawX = b.x - player.x + canvas.width / 2;
    const drawY = b.y - player.y + canvas.height / 2;
    ctx.beginPath();
    ctx.arc(drawX, drawY, 5, 0, 2 * Math.PI);
    ctx.fill();
  }
}

function drawStorm(){
  ctx.beginPath();
  ctx.strokeStyle = "rgba(255,0,0,0.7)";
  ctx.lineWidth = 10;
  ctx.arc(
    canvas.width/2 + (storm.centerX - player.x),
    canvas.height/2 + (storm.centerY - player.y),
    storm.radius,
    0,
    Math.PI * 2
  );
  ctx.stroke();
}

// --- MAIN LOOP ---
function gameLoop(){
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  updatePlayer();
  updateBots();
  updateBullets();
  updateStorm();
  checkChestPickup();

  drawMap();
  drawBullets();
  drawPlayer();
  drawBots();
  drawStorm();

  requestAnimationFrame(gameLoop);
}

// --- INIT ---
gameLoop();
