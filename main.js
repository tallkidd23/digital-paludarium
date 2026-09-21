// ---------- Configuration ----------
const WIDTH = 50;
const HEIGHT = 35;
const CELL_SIZE = 14;

const TICK_MS = 90;        // Simulation tick speed
const EPOCH_EVERY = 300;    // Epoch length for chronicle logs

const INITIAL_PLANT_DENSITY = 0.20;
const INITIAL_HERBIVORE_COUNT = 24;

// ---------- State ----------
let grid = createGrid();
let entities = [];
let tick = 0;
let epoch = 0;

// Track population history to detect oscillations and macro shifts
let populationHistory = [];

// ---------- Grid Helpers ----------
function createGrid() {
  return Array.from({ length: WIDTH }, () => Array(HEIGHT).fill(null));
}

function getNeighbors(x, y) {
  const deltas = [
    [1, 0], [-1, 0], [0, 1], [0, -1],
    [1, 1], [-1, -1], [1, -1], [-1, 1]
  ];
  const neighbors = [];
  for (const [dx, dy] of deltas) {
    const nx = (x + dx + WIDTH) % WIDTH;   // Toroidal wrap
    const ny = (y + dy + HEIGHT) % HEIGHT;
    neighbors.push([nx, ny]);
  }
  return neighbors;
}

function emptyNeighbors(x, y) {
  return getNeighbors(x, y).filter(([nx, ny]) => !grid[nx][ny]);
}

function randomEmptyNeighbor(x, y) {
  const opts = emptyNeighbors(x, y);
  if (opts.length === 0) return null;
  return opts[Math.floor(Math.random() * opts.length)];
}

// ---------- Genomes & Mutation ----------
function defaultPlantGenome() {
  return {
    growthRate: 1.2,
    maintenanceCost: 0.5,
    reproThreshold: 8.0,
    reproCost: 4.5,
    maxAge: 250,
    crowdingTolerance: 5,   // Dies/fails to grow if surrounded by > N plants
    mutationRate: 0.08,
  };
}

function defaultHerbivoreGenome() {
  return {
    baseMetabolism: 0.55,
    movementCost: 0.35,
    sensoryRadius: 3,       // Can sniff food up to 3 cells away
    reproThreshold: 14.0,
    reproCost: 7.0,
    eatGain: 10.0,
    maxAge: 220,
    mutationRate: 0.08,
  };
}

function mutateGenome(genome) {
  const g = { ...genome };
  const rate = genome.mutationRate || 0.08;
  for (const key of Object.keys(g)) {
    if (key === "mutationRate") continue;
    if (typeof g[key] !== "number") continue;
    if (Math.random() > rate) continue;

    const factor = 1 + (Math.random() * 0.2 - 0.1);
    let val = g[key] * factor;

    if (key.includes("Cost") || key === "baseMetabolism" || key === "movementCost") {
      val = Math.max(0.1, Math.min(3.0, val));
    } else if (key === "growthRate") {
      val = Math.max(0.3, Math.min(4.0, val));
    } else if (key === "reproThreshold" || key === "reproCost" || key === "eatGain") {
      val = Math.max(2.0, Math.min(30.0, val));
    } else if (key === "crowdingTolerance" || key === "sensoryRadius") {
      val = Math.max(1, Math.min(8, Math.round(val)));
    } else if (key === "maxAge") {
      val = Math.max(60, Math.min(500, Math.round(val)));
    }
    g[key] = val;
  }
  return g;
}

// ---------- Entity Constructors ----------
function createPlant(x, y, genome = null) {
  return {
    type: "plant",
    x,
    y,
    energy: 5,
    age: 0,
    genome: genome ? mutateGenome(genome) : defaultPlantGenome(),
    alive: true,
  };
}

function createHerbivore(x, y, genome = null) {
  return {
    type: "herbivore",
    x,
    y,
    energy: 12,
    age: 0,
    genome: genome ? mutateGenome(genome) : defaultHerbivoreGenome(),
    alive: true,
  };
}

// ---------- World Initialization ----------
function initWorld() {
  grid = createGrid();
  entities = [];
  populationHistory = [];

  for (let x = 0; x < WIDTH; x++) {
    for (let y = 0; y < HEIGHT; y++) {
      if (Math.random() < INITIAL_PLANT_DENSITY) {
        const p = createPlant(x, y);
        grid[x][y] = p;
        entities.push(p);
      }
    }
  }

  let placed = 0;
  while (placed < INITIAL_HERBIVORE_COUNT) {
    const x = Math.floor(Math.random() * WIDTH);
    const y = Math.floor(Math.random() * HEIGHT);
    if (grid[x][y]) continue;
    const h = createHerbivore(x, y);
    grid[x][y] = h;
    entities.push(h);
    placed++;
  }

  tick = 0;
  epoch = 0;
  clearLog();
  logLine("🌱 Epoch 0 – Ecosystem seeded with self-regulating canopy and scent tracking.", "epoch");
}

// ---------- Update Rules ----------
function shuffle(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
}

function updatePlant(p) {
  const g = p.genome;
  const neighbors = getNeighbors(p.x, p.y);
  const plantNeighbors = neighbors.filter(([nx, ny]) => grid[nx][ny]?.type === "plant").length;

  // Crowding mechanic: Shading reduces light absorption
  if (plantNeighbors >= g.crowdingTolerance) {
    p.energy -= g.maintenanceCost * 1.5;
  } else {
    p.energy += g.growthRate * (1 - plantNeighbors / 8);
    p.energy -= g.maintenanceCost;
  }
  p.age++;

  // Reproduction with space check
  if (p.energy >= g.reproThreshold && plantNeighbors < g.crowdingTolerance) {
    const pos = randomEmptyNeighbor(p.x, p.y);
    if (pos) {
      const [nx, ny] = pos;
      const child = createPlant(nx, ny, g);
      grid[nx][ny] = child;
      entities.push(child);
      p.energy -= g.reproCost;
    }
  }

  if (p.energy <= 0 || p.age > g.maxAge) {
    p.alive = false;
  }
}

function updateHerbivore(h) {
  const g = h.genome;
  const immediateNeighbors = [
    [(h.x + 1) % WIDTH, h.y],
    [(h.x - 1 + WIDTH) % WIDTH, h.y],
    [h.x, (h.y + 1) % HEIGHT],
    [h.x, (h.y - 1 + HEIGHT) % HEIGHT],
  ];

  let ate = false;

  // 1. Eat adjacent plant if present
  for (const [nx, ny] of immediateNeighbors) {
    const cell = grid[nx][ny];
    if (cell && cell.type === "plant" && cell.alive) {
      cell.alive = false;
      grid[nx][ny] = null;
      h.energy += g.eatGain;
      ate = true;
      break;
    }
  }

  // 2. Sensory navigation: scan within sensoryRadius for closest plant
  if (!ate) {
    let bestTarget = null;
    let minDist = Infinity;
    const r = Math.floor(g.sensoryRadius);

    for (let dx = -r; dx <= r; dx++) {
      for (let dy = -r; dy <= r; dy++) {
        if (dx === 0 && dy === 0) continue;
        const sx = (h.x + dx + WIDTH) % WIDTH;
        const sy = (h.y + dy + HEIGHT) % HEIGHT;
        if (grid[sx][sy]?.type === "plant" && grid[sx][sy].alive) {
          const dist = Math.abs(dx) + Math.abs(dy);
          if (dist < minDist) {
            minDist = dist;
            bestTarget = { dx, dy };
          }
        }
      }
    }

    let movePos = null;
    if (bestTarget) {
      // Step towards target
      const stepX = bestTarget.dx !== 0 ? (bestTarget.dx > 0 ? 1 : -1) : 0;
      const stepY = bestTarget.dy !== 0 ? (bestTarget.dy > 0 ? 1 : -1) : 0;
      const candX = (h.x + stepX + WIDTH) % WIDTH;
      const candY = (h.y + stepY + HEIGHT) % HEIGHT;

      if (!grid[candX][candY]) {
        movePos = [candX, candY];
      }
    }

    // Fallback: random move
    if (!movePos) {
      const openSpots = immediateNeighbors.filter(([nx, ny]) => !grid[nx][ny]);
      if (openSpots.length > 0) {
        movePos = openSpots[Math.floor(Math.random() * openSpots.length)];
      }
    }

    if (movePos) {
      grid[h.x][h.y] = null;
      h.x = movePos[0];
      h.y = movePos[1];
      grid[h.x][h.y] = h;
      h.energy -= g.movementCost;
    }
  }

  h.energy -= g.baseMetabolism;
  h.age++;

  // Reproduction
  if (h.energy >= g.reproThreshold) {
    const pos = randomEmptyNeighbor(h.x, h.y);
    if (pos) {
      const [nx, ny] = pos;
      const child = createHerbivore(nx, ny, g);
      grid[nx][ny] = child;
      entities.push(child);
      h.energy -= g.reproCost;
    }
  }

  if (h.energy <= 0 || h.age > g.maxAge) {
    h.alive = false;
  }
}

// Environmental influx: Spores and wanderers maintain open-system equilibrium
function environmentalInflux() {
  const plantCount = entities.filter(e => e.type === "plant").length;
  const herbCount = entities.filter(e => e.type === "herbivore").length;

  // Spore drift if plant population dips critically low
  if (plantCount < 15 && Math.random() < 0.15) {
    const rx = Math.floor(Math.random() * WIDTH);
    const ry = Math.floor(Math.random() * HEIGHT);
    if (!grid[rx][ry]) {
      const p = createPlant(rx, ry);
      grid[rx][ry] = p;
      entities.push(p);
    }
  }

  // Wandering migrant if herbivore population collapses but plants thrive
  if (herbCount === 0 && plantCount > 60 && Math.random() < 0.05) {
    const rx = Math.floor(Math.random() * WIDTH);
    const ry = Math.floor(Math.random() * HEIGHT);
    if (!grid[rx][ry]) {
      const h = createHerbivore(rx, ry);
      grid[rx][ry] = h;
      entities.push(h);
      logLine("🌿 Distant Migration: An herbivore drifted into lush grazing grounds.", "event");
    }
  }
}

function cleanupDead() {
  const alive = [];
  for (let x = 0; x < WIDTH; x++) {
    for (let y = 0; y < HEIGHT; y++) {
      const e = grid[x][y];
      if (!e) continue;
      if (!e.alive) {
        grid[x][y] = null;
      } else {
        alive.push(e);
      }
    }
  }
  entities = alive;
}

function step() {
  tick++;
  shuffle(entities);

  for (const e of entities) {
    if (!e.alive) continue;
    if (e.type === "plant") updatePlant(e);
    else if (e.type === "herbivore") updateHerbivore(e);
  }

  environmentalInflux();
  cleanupDead();

  if (tick % EPOCH_EVERY === 0) {
    epoch++;
    logEpoch();
  }
}

// ---------- Chronicle & Analysis ----------
const logEl = document.getElementById("log");

function clearLog() {
  logEl.textContent = "";
}

function logLine(text, cls = "event") {
  const div = document.createElement("div");
  div.className = cls;
  div.textContent = text;
  logEl.appendChild(div);
  if (logEl.childElementCount > 150) {
    logEl.removeChild(logEl.firstChild);
  }
  logEl.scrollTop = logEl.scrollHeight;
}

function logEpoch() {
  const plants = entities.filter(e => e.type === "plant");
  const herbs = entities.filter(e => e.type === "herbivore");

  const pCount = plants.length;
  const hCount = herbs.length;

  const avgGrowth = pCount > 0 ? (plants.reduce((s, p) => s + p.genome.growthRate, 0) / pCount).toFixed(2) : 0;
  const avgScent = hCount > 0 ? (herbs.reduce((s, h) => s + h.genome.sensoryRadius, 0) / hCount).toFixed(1) : 0;
  const avgSpeed = hCount > 0 ? (herbs.reduce((s, h) => s + h.genome.movementCost, 0) / hCount).toFixed(2) : 0;

  populationHistory.push({ epoch, pCount, hCount });
  if (populationHistory.length > 20) populationHistory.shift();

  logLine(`Epoch ${epoch} (Tick ${tick}) — Plants: ${pCount} (avg growth: ${avgGrowth}) | Herbivores: ${hCount} (avg scent: ${avgScent})`, "epoch");

  // Emergent Pattern Detectors
  if (populationHistory.length >= 6) {
    const recent = populationHistory.slice(-6);
    const pTrend = recent[recent.length - 1].pCount - recent[0].pCount;
    const hTrend = recent[recent.length - 1].hCount - recent[0].hCount;

    if (pTrend < -40 && hTrend > 15) {
      logLine("⚡ Predator Wave: Herbivores surging; heavy grazing pressure reducing canopy.", "event");
    } else if (pTrend > 40 && hTrend < -10) {
      logLine("🌾 Canopy Rebound: Vegetation expanding across sparse grazer territory.", "event");
    }
  }
}

// ---------- Rendering ----------
const canvas = document.getElementById("sim");
const ctx = canvas.getContext("2d");

canvas.width = WIDTH * CELL_SIZE;
canvas.height = HEIGHT * CELL_SIZE;

function render() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  for (let x = 0; x < WIDTH; x++) {
    for (let y = 0; y < HEIGHT; y++) {
      const e = grid[x][y];
      const px = x * CELL_SIZE;
      const py = y * CELL_SIZE;

      if (!e) {
        ctx.fillStyle = "#070a18";
        ctx.fillRect(px, py, CELL_SIZE, CELL_SIZE);
        continue;
      }

      if (e.type === "plant") {
        const energyTone = Math.min(45, 20 + e.energy * 2.5);
        ctx.fillStyle = `hsl(135, 65%, ${energyTone}%)`;
        ctx.fillRect(px + 1, py + 1, CELL_SIZE - 2, CELL_SIZE - 2);
      } else if (e.type === "herbivore") {
        const energyTone = Math.min(55, 35 + e.energy * 1.5);
        ctx.fillStyle = `hsl(24, 90%, ${energyTone}%)`;
        ctx.fillRect(px + 2, py + 2, CELL_SIZE - 4, CELL_SIZE - 4);
      }
    }
  }
}

// ---------- Loop ----------
let lastTime = 0;
function loop(timestamp) {
  if (!lastTime) lastTime = timestamp;
  const elapsed = timestamp - lastTime;

  if (elapsed > TICK_MS) {
    step();
    render();
    lastTime = timestamp;
  }

  requestAnimationFrame(loop);
}

initWorld();
requestAnimationFrame(loop);
