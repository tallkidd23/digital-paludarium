// ---------- Configuration ----------
const WIDTH = 50;
const HEIGHT = 35;
const CELL_SIZE = 14;

const TICK_MS = 75;        // Fluid simulation speed
const EPOCH_EVERY = 250;   // Chronicle epoch window

const INITIAL_PLANT_DENSITY = 0.22;
const INITIAL_HERBIVORE_COUNT = 20;
const INITIAL_CARNIVORE_COUNT = 5;

// ---------- State ----------
let grid = createGrid();
let soilNutrients = createSoil();
let detritusField = createSoil();
let entities = [];
let tick = 0;
let epoch = 0;

// High-resolution timeseries history for continuous sparkline rendering
const MAX_GRAPH_POINTS = 160;
let timeSeriesHistory = [];
let epochHistory = [];

// Interactive stewardship tool state ('plant' | 'grazer' | 'predator' | 'nutrient')
let activeTool = "plant";

// Visual feedback ripples from user interactions
let activeRipples = [];

// ---------- Grid & Field Helpers ----------
function createGrid() {
  return Array.from({ length: WIDTH }, () => Array(HEIGHT).fill(null));
}

function createSoil() {
  return Array.from({ length: WIDTH }, () => Array(HEIGHT).fill(3.0));
}

function getNeighbors(x, y) {
  const deltas = [
    [1, 0], [-1, 0], [0, 1], [0, -1],
    [1, 1], [-1, -1], [1, -1], [-1, 1]
  ];
  const neighbors = [];
  for (const [dx, dy] of deltas) {
    const nx = (x + dx + WIDTH) % WIDTH;
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

// Find nearest unoccupied cell if target is occupied
function findNearestEmptyCell(targetX, targetY, maxRadius = 4) {
  if (!grid[targetX][targetY]) return [targetX, targetY];
  for (let r = 1; r <= maxRadius; r++) {
    for (let dx = -r; dx <= r; dx++) {
      for (let dy = -r; dy <= r; dy++) {
        const nx = (targetX + dx + WIDTH) % WIDTH;
        const ny = (targetY + dy + HEIGHT) % HEIGHT;
        if (!grid[nx][ny]) return [nx, ny];
      }
    }
  }
  return null;
}

// ---------- Genomes & Heritable Traits ----------
function defaultPlantGenome() {
  return {
    growthRate: 1.35,
    nutrientUptake: 0.5,
    maintenanceCost: 0.35,
    reproThreshold: 6.5,
    reproCost: 3.5,
    maxAge: 320,
    crowdingTolerance: 5,
    mutationRate: 0.08,
  };
}

function defaultHerbivoreGenome() {
  return {
    baseMetabolism: 0.40,
    movementCost: 0.25,
    sensoryRadius: 4,
    maxSatiation: 24.0,
    reproThreshold: 14.0,
    reproCost: 7.0,
    biteEfficiency: 5.0,
    maxAge: 260,
    mutationRate: 0.08,
  };
}

function defaultCarnivoreGenome() {
  return {
    baseMetabolism: 0.50,
    movementCost: 0.30,
    huntRadius: 5,
    maxSatiation: 32.0,
    reproThreshold: 20.0,
    reproCost: 11.0,
    huntEfficiency: 15.0,
    maxAge: 300,
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
      val = Math.max(0.08, Math.min(2.5, val));
    } else if (key === "growthRate" || key === "nutrientUptake" || key === "biteEfficiency" || key === "huntEfficiency") {
      val = Math.max(0.3, Math.min(20.0, val));
    } else if (key === "reproThreshold" || key === "reproCost" || key === "maxSatiation") {
      val = Math.max(3.0, Math.min(45.0, val));
    } else if (key === "crowdingTolerance" || key === "sensoryRadius" || key === "huntRadius") {
      val = Math.max(1, Math.min(8, Math.round(val)));
    } else if (key === "maxAge") {
      val = Math.max(60, Math.min(650, Math.round(val)));
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
    energy: 5.0,
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
    energy: 14.0,
    age: 0,
    genome: genome ? mutateGenome(genome) : defaultHerbivoreGenome(),
    alive: true,
  };
}

function createCarnivore(x, y, genome = null) {
  return {
    type: "carnivore",
    x,
    y,
    energy: 18.0,
    age: 0,
    genome: genome ? mutateGenome(genome) : defaultCarnivoreGenome(),
    alive: true,
  };
}

// ---------- Lifecycle & Physics ----------
function initWorld() {
  grid = createGrid();
  soilNutrients = createSoil();
  detritusField = createSoil();
  entities = [];
  timeSeriesHistory = [];
  epochHistory = [];
  activeRipples = [];

  for (let x = 0; x < WIDTH; x++) {
    for (let y = 0; y < HEIGHT; y++) {
      detritusField[x][y] = 0.0;
      soilNutrients[x][y] = 2.5 + Math.random() * 3.5;
      if (Math.random() < INITIAL_PLANT_DENSITY) {
        const p = createPlant(x, y);
        grid[x][y] = p;
        entities.push(p);
      }
    }
  }

  let placedH = 0;
  while (placedH < INITIAL_HERBIVORE_COUNT) {
    const x = Math.floor(Math.random() * WIDTH);
    const y = Math.floor(Math.random() * HEIGHT);
    if (grid[x][y]) continue;
    const h = createHerbivore(x, y);
    grid[x][y] = h;
    entities.push(h);
    placedH++;
  }

  let placedC = 0;
  while (placedC < INITIAL_CARNIVORE_COUNT) {
    const x = Math.floor(Math.random() * WIDTH);
    const y = Math.floor(Math.random() * HEIGHT);
    if (grid[x][y]) continue;
    const c = createCarnivore(x, y);
    grid[x][y] = c;
    entities.push(c);
    placedC++;
  }

  tick = 0;
  epoch = 0;
  clearLog();
  logLine("🌱 Epoch 0 — Three-tier trophic web active: Foliage, Grazers, and Apex Predators.", "epoch");
  updateEpochBadge();
}

function shuffle(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[j], arr[i]] = [arr[j], arr[i]];
  }
}

function cycleSoilAndDetritus() {
  for (let x = 0; x < WIDTH; x++) {
    for (let y = 0; y < HEIGHT; y++) {
      if (detritusField[x][y] > 0.05) {
        const decomposed = detritusField[x][y] * 0.05;
        detritusField[x][y] -= decomposed;
        soilNutrients[x][y] = Math.min(10.0, soilNutrients[x][y] + decomposed * 1.3);
      }
      soilNutrients[x][y] = Math.min(10.0, soilNutrients[x][y] + 0.004);
    }
  }
}

function updatePlant(p) {
  const g = p.genome;
  const neighbors = getNeighbors(p.x, p.y);
  const plantNeighbors = neighbors.filter(([nx, ny]) => grid[nx][ny]?.type === "plant").length;

  const availableSoil = soilNutrients[p.x][p.y];
  const soilBonus = Math.min(availableSoil, g.nutrientUptake);
  soilNutrients[p.x][p.y] = Math.max(0.0, availableSoil - soilBonus * 0.4);

  if (plantNeighbors >= g.crowdingTolerance) {
    p.energy -= g.maintenanceCost * 1.4;
  } else {
    p.energy += (g.growthRate + soilBonus) * (1 - plantNeighbors / 9.0);
    p.energy -= g.maintenanceCost;
  }
  p.age++;

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
    detritusField[p.x][p.y] = Math.min(8.0, detritusField[p.x][p.y] + 1.2);
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

  // 1. Graze plant
  if (h.energy < g.maxSatiation) {
    for (const [nx, ny] of immediateNeighbors) {
      const cell = grid[nx][ny];
      if (cell && cell.type === "plant" && cell.alive) {
        const bite = Math.min(cell.energy, g.biteEfficiency);
        cell.energy -= bite;
        h.energy = Math.min(g.maxSatiation, h.energy + bite);
        if (cell.energy <= 0.6) {
          cell.alive = false;
          grid[nx][ny] = null;
          detritusField[nx][ny] = Math.min(8.0, detritusField[nx][ny] + 0.9);
        }
        ate = true;
        break;
      }
    }
  }

  // 2. Olfactory navigation
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
      const stepX = bestTarget.dx !== 0 ? (bestTarget.dx > 0 ? 1 : -1) : 0;
      const stepY = bestTarget.dy !== 0 ? (bestTarget.dy > 0 ? 1 : -1) : 0;
      const candX = (h.x + stepX + WIDTH) % WIDTH;
      const candY = (h.y + stepY + HEIGHT) % HEIGHT;

      if (!grid[candX][candY]) {
        movePos = [candX, candY];
      }
    }

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
    detritusField[h.x][h.y] = Math.min(10.0, detritusField[h.x][h.y] + 3.0);
  }
}

function updateCarnivore(c) {
  const g = c.genome;
  const immediateNeighbors = [
    [(c.x + 1) % WIDTH, c.y],
    [(c.x - 1 + WIDTH) % WIDTH, c.y],
    [c.x, (c.y + 1) % HEIGHT],
    [c.x, (c.y - 1 + HEIGHT) % HEIGHT],
  ];

  let hunted = false;

  // 1. Hunt adjacent herbivore
  for (const [nx, ny] of immediateNeighbors) {
    const prey = grid[nx][ny];
    if (prey && prey.type === "herbivore" && prey.alive) {
      prey.alive = false;
      grid[nx][ny] = null;
      c.energy = Math.min(g.maxSatiation, c.energy + g.huntEfficiency);
      detritusField[nx][ny] = Math.min(10.0, detritusField[nx][ny] + 2.5);
      hunted = true;
      break;
    }
  }

  // 2. Stalk nearest grazer
  if (!hunted) {
    let preyTarget = null;
    let minDist = Infinity;
    const r = Math.floor(g.huntRadius);

    for (let dx = -r; dx <= r; dx++) {
      for (let dy = -r; dy <= r; dy++) {
        if (dx === 0 && dy === 0) continue;
        const sx = (c.x + dx + WIDTH) % WIDTH;
        const sy = (c.y + dy + HEIGHT) % HEIGHT;
        if (grid[sx][sy]?.type === "herbivore" && grid[sx][sy].alive) {
          const dist = Math.abs(dx) + Math.abs(dy);
          if (dist < minDist) {
            minDist = dist;
            preyTarget = { dx, dy };
          }
        }
      }
    }

    let movePos = null;
    if (preyTarget) {
      const stepX = preyTarget.dx !== 0 ? (preyTarget.dx > 0 ? 1 : -1) : 0;
      const stepY = preyTarget.dy !== 0 ? (preyTarget.dy > 0 ? 1 : -1) : 0;
      const candX = (c.x + stepX + WIDTH) % WIDTH;
      const candY = (c.y + stepY + HEIGHT) % HEIGHT;

      if (!grid[candX][candY]) {
        movePos = [candX, candY];
      }
    }

    if (!movePos) {
      const openSpots = immediateNeighbors.filter(([nx, ny]) => !grid[nx][ny]);
      if (openSpots.length > 0) {
        movePos = openSpots[Math.floor(Math.random() * openSpots.length)];
      }
    }

    if (movePos) {
      grid[c.x][c.y] = null;
      c.x = movePos[0];
      c.y = movePos[1];
      grid[c.x][c.y] = c;
      c.energy -= g.movementCost;
    }
  }

  c.energy -= g.baseMetabolism;
  c.age++;

  if (c.energy >= g.reproThreshold) {
    const pos = randomEmptyNeighbor(c.x, c.y);
    if (pos) {
      const [nx, ny] = pos;
      const child = createCarnivore(nx, ny, g);
      grid[nx][ny] = child;
      entities.push(child);
      c.energy -= g.reproCost;
    }
  }

  if (c.energy <= 0 || c.age > g.maxAge) {
    c.alive = false;
    detritusField[c.x][c.y] = Math.min(10.0, detritusField[c.x][c.y] + 4.0);
  }
}

// Continuous background ecological replenishment
function environmentalBalance() {
  const plantCount = entities.filter(e => e.type === "plant").length;
  const herbCount = entities.filter(e => e.type === "herbivore").length;
  const carnCount = entities.filter(e => e.type === "carnivore").length;

  if (plantCount < 25 && Math.random() < 0.25) {
    const rx = Math.floor(Math.random() * WIDTH);
    const ry = Math.floor(Math.random() * HEIGHT);
    if (!grid[rx][ry] && soilNutrients[rx][ry] > 2.0) {
      const p = createPlant(rx, ry);
      grid[rx][ry] = p;
      entities.push(p);
    }
  }

  // Consistent grazer colonization whenever foliage is healthy
  if (herbCount < 4 && plantCount > 40 && Math.random() < 0.12) {
    const rx = Math.floor(Math.random() * WIDTH);
    const ry = Math.floor(Math.random() * HEIGHT);
    if (!grid[rx][ry]) {
      const h = createHerbivore(rx, ry);
      grid[rx][ry] = h;
      entities.push(h);
      logLine("🐾 Grazer Migration: Pioneer grazers arrived on lush canopy islands.", "event");
    }
  }

  // Apex entry when grazer herd swells
  if (carnCount === 0 && herbCount > 45 && Math.random() < 0.08) {
    const rx = Math.floor(Math.random() * WIDTH);
    const ry = Math.floor(Math.random() * HEIGHT);
    if (!grid[rx][ry]) {
      const c = createCarnivore(rx, ry);
      grid[rx][ry] = c;
      entities.push(c);
      logLine("🐺 Apex Scent: A predator entered the territory pursuing dense grazer herds.", "event");
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

function recordTimeSeries() {
  const pCount = entities.filter(e => e.type === "plant").length;
  const hCount = entities.filter(e => e.type === "herbivore").length;
  const cCount = entities.filter(e => e.type === "carnivore").length;

  timeSeriesHistory.push({ p: pCount, h: hCount, c: cCount });
  if (timeSeriesHistory.length > MAX_GRAPH_POINTS) {
    timeSeriesHistory.shift();
  }
}

function step() {
  tick++;
  cycleSoilAndDetritus();
  shuffle(entities);

  for (const e of entities) {
    if (!e.alive) continue;
    if (e.type === "plant") updatePlant(e);
    else if (e.type === "herbivore") updateHerbivore(e);
    else if (e.type === "carnivore") updateCarnivore(e);
  }

  environmentalBalance();
  cleanupDead();

  if (tick % 4 === 0) {
    recordTimeSeries();
  }

  if (tick % EPOCH_EVERY === 0) {
    epoch++;
    updateEpochBadge();
    logEpoch();
  }
}

// ---------- Chronicle Logging ----------
const logEl = document.getElementById("log");
const epochBadge = document.getElementById("epochBadge");

function updateEpochBadge() {
  if (epochBadge) epochBadge.textContent = `Epoch ${epoch} (Tick ${tick})`;
}

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
  const carns = entities.filter(e => e.type === "carnivore");

  const pCount = plants.length;
  const hCount = herbs.length;
  const cCount = carns.length;

  const avgGrowth = pCount > 0 ? (plants.reduce((s, p) => s + p.genome.growthRate, 0) / pCount).toFixed(2) : 0;
  const avgScent = hCount > 0 ? (herbs.reduce((s, h) => s + h.genome.sensoryRadius, 0) / hCount).toFixed(1) : 0;

  epochHistory.push({ epoch, pCount, hCount, cCount });
  if (epochHistory.length > 20) epochHistory.shift();

  logLine(`Epoch ${epoch} (Tick ${tick}) — Canopy: ${pCount} | Grazers: ${hCount} | Predators: ${cCount}`, "epoch");

  if (epochHistory.length >= 6) {
    const recent = epochHistory.slice(-6);
    const pTrend = recent[recent.length - 1].pCount - recent[0].pCount;
    const hTrend = recent[recent.length - 1].hCount - recent[0].hCount;

    if (cCount > 2 && hTrend < -15) {
      logLine("⚡ Apex Pressure: Predators regulating grazer population; foliage rebounding.", "event");
    } else if (pTrend > 25 && hTrend > 8 && cCount > 0) {
      logLine("⚖️ Tri-Trophic Harmony: Balanced energy flow across foliage, herd, and pack.", "event");
    }
  }
}

// ---------- Visual Rendering & Interactivity ----------
const canvas = document.getElementById("sim");
const ctx = canvas.getContext("2d");

canvas.width = WIDTH * CELL_SIZE;
canvas.height = HEIGHT * CELL_SIZE;

const graphCanvas = document.getElementById("graphCanvas");
const gCtx = graphCanvas ? graphCanvas.getContext("2d") : null;

function resizeGraph() {
  if (graphCanvas) {
    graphCanvas.width = graphCanvas.parentElement.clientWidth - 32;
    graphCanvas.height = 90;
  }
}
window.addEventListener("resize", resizeGraph);

// --- User Interaction ("God Hand" Seeding with Displace/Fallback) ---
function handleCanvasPointer(clientX, clientY) {
  const rect = canvas.getBoundingClientRect();
  const scaleX = canvas.width / rect.width;
  const scaleY = canvas.height / rect.height;

  const canvasX = (clientX - rect.left) * scaleX;
  const canvasY = (clientY - rect.top) * scaleY;

  const gridX = Math.floor(canvasX / CELL_SIZE);
  const gridY = Math.floor(canvasY / CELL_SIZE);

  if (gridX < 0 || gridX >= WIDTH || gridY < 0 || gridY >= HEIGHT) return;

  // Add visual glow ripple at tap coordinate
  activeRipples.push({
    x: canvasX,
    y: canvasY,
    radius: 4,
    maxRadius: 28,
    alpha: 0.9,
    tool: activeTool
  });

  if (activeTool === "plant") {
    // If cell occupied by another type, overwrite or find neighbor
    const emptyPos = findNearestEmptyCell(gridX, gridY);
    if (emptyPos) {
      const [ex, ey] = emptyPos;
      const p = createPlant(ex, ey);
      grid[ex][ey] = p;
      entities.push(p);
      logLine(`🌱 Hand of the Steward: Seeded canopy spore near (${ex}, ${ey}).`, "event");
    } else {
      // Overwrite current cell with fresh plant
      const old = grid[gridX][gridY];
      if (old) old.alive = false;
      const p = createPlant(gridX, gridY);
      grid[gridX][gridY] = p;
      entities.push(p);
      logLine(`🌱 Hand of the Steward: Planted canopy root at (${gridX}, ${gridY}).`, "event");
    }
  } else if (activeTool === "grazer") {
    const emptyPos = findNearestEmptyCell(gridX, gridY);
    if (emptyPos) {
      const [ex, ey] = emptyPos;
      const h = createHerbivore(ex, ey);
      grid[ex][ey] = h;
      entities.push(h);
      logLine(`🟠 Hand of the Steward: Introduced pioneer grazer near (${ex}, ${ey}).`, "event");
    } else {
      const old = grid[gridX][gridY];
      if (old) old.alive = false;
      const h = createHerbivore(gridX, gridY);
      grid[gridX][gridY] = h;
      entities.push(h);
      logLine(`🟠 Hand of the Steward: Introduced pioneer grazer at (${gridX}, ${gridY}).`, "event");
    }
  } else if (activeTool === "predator") {
    const emptyPos = findNearestEmptyCell(gridX, gridY);
    if (emptyPos) {
      const [ex, ey] = emptyPos;
      const c = createCarnivore(ex, ey);
      grid[ex][ey] = c;
      entities.push(c);
      logLine(`🔴 Hand of the Steward: Summoned apex predator near (${ex}, ${ey}).`, "event");
    } else {
      const old = grid[gridX][gridY];
      if (old) old.alive = false;
      const c = createCarnivore(gridX, gridY);
      grid[gridX][gridY] = c;
      entities.push(c);
      logLine(`🔴 Hand of the Steward: Summoned apex predator at (${gridX}, ${gridY}).`, "event");
    }
  } else if (activeTool === "nutrient") {
    // Enrich local 3x3 substrate
    for (let dx = -1; dx <= 1; dx++) {
      for (let dy = -1; dy <= 1; dy++) {
        const nx = (gridX + dx + WIDTH) % WIDTH;
        const ny = (gridY + dy + HEIGHT) % HEIGHT;
        soilNutrients[nx][ny] = Math.min(10.0, soilNutrients[nx][ny] + 5.0);
      }
    }
    logLine(`✨ Hand of the Steward: Enriched soil mineral pocket around (${gridX}, ${gridY}).`, "event");
  }
}

canvas.addEventListener("pointerdown", (e) => {
  handleCanvasPointer(e.clientX, e.clientY);
});

// Setup tool buttons
document.querySelectorAll(".tool-btn").forEach((btn) => {
  btn.addEventListener("click", () => {
    document.querySelectorAll(".tool-btn").forEach((b) => b.classList.remove("active"));
    btn.classList.add("active");
    activeTool = btn.getAttribute("data-tool");
    const activeLabel = document.getElementById("activeToolName");
    if (activeLabel) {
      activeLabel.textContent = btn.textContent.trim();
    }
  });
});

function renderWorld() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  for (let x = 0; x < WIDTH; x++) {
    for (let y = 0; y < HEIGHT; y++) {
      const e = grid[x][y];
      const px = x * CELL_SIZE;
      const py = y * CELL_SIZE;

      const detritus = detritusField[x][y];
      const nutrient = soilNutrients[x][y];

      if (!e) {
        if (detritus > 0.8) {
          const detritusTone = Math.min(22, 10 + detritus * 2);
          ctx.fillStyle = `hsl(30, 45%, ${detritusTone}%)`;
        } else if (nutrient > 5.0) {
          ctx.fillStyle = "#0a1324";
        } else {
          ctx.fillStyle = "#070a18";
        }
        ctx.fillRect(px, py, CELL_SIZE, CELL_SIZE);
        continue;
      }

      if (e.type === "plant") {
        const hue = 125 + Math.min(25, (e.genome.growthRate - 1.0) * 15);
        const energyTone = Math.min(48, 22 + e.energy * 2.8);
        ctx.fillStyle = `hsl(${hue}, 68%, ${energyTone}%)`;
        ctx.fillRect(px + 1, py + 1, CELL_SIZE - 2, CELL_SIZE - 2);
      } else if (e.type === "herbivore") {
        const scentOffset = (e.genome.sensoryRadius - 3) * 12;
        const hue = Math.max(14, Math.min(45, 28 - scentOffset));
        const energyTone = Math.min(60, 38 + e.energy * 1.4);
        ctx.fillStyle = `hsl(${hue}, 92%, ${energyTone}%)`;
        ctx.fillRect(px + 2, py + 2, CELL_SIZE - 4, CELL_SIZE - 4);
      } else if (e.type === "carnivore") {
        const energyTone = Math.min(65, 42 + e.energy * 1.2);
        ctx.fillStyle = `hsl(345, 95%, ${energyTone}%)`;
        ctx.fillRect(px + 1, py + 1, CELL_SIZE - 2, CELL_SIZE - 2);
      }
    }
  }

  // Render glowing ripple effects from user taps
  for (let i = activeRipples.length - 1; i >= 0; i--) {
    const r = activeRipples[i];
    ctx.beginPath();
    ctx.arc(r.x, r.y, r.radius, 0, Math.PI * 2);
    
    let strokeColor = "rgba(56, 189, 248, ";
    if (r.tool === "plant") strokeColor = "rgba(34, 197, 94, ";
    else if (r.tool === "grazer") strokeColor = "rgba(249, 115, 22, ";
    else if (r.tool === "predator") strokeColor = "rgba(244, 63, 94, ";
    else if (r.tool === "nutrient") strokeColor = "rgba(250, 204, 21, ";

    ctx.strokeStyle = strokeColor + r.alpha + ")";
    ctx.lineWidth = 2.5;
    ctx.stroke();

    r.radius += 1.8;
    r.alpha -= 0.05;

    if (r.alpha <= 0) {
      activeRipples.splice(i, 1);
    }
  }
}

function renderSparkline() {
  if (!gCtx || timeSeriesHistory.length < 2) return;

  const w = graphCanvas.width;
  const h = graphCanvas.height;

  gCtx.clearRect(0, 0, w, h);

  gCtx.strokeStyle = "#131d31";
  gCtx.lineWidth = 1;
  gCtx.beginPath();
  gCtx.moveTo(0, h * 0.33); gCtx.lineTo(w, h * 0.33);
  gCtx.moveTo(0, h * 0.66); gCtx.lineTo(w, h * 0.66);
  gCtx.stroke();

  let maxVal = 100;
  for (const pt of timeSeriesHistory) {
    if (pt.p > maxVal) maxVal = pt.p;
    if (pt.h > maxVal) maxVal = pt.h;
    if (pt.c * 3 > maxVal) maxVal = pt.c * 3;
  }
  maxVal *= 1.1;

  function drawSeries(key, color, scaleFactor = 1.0) {
    gCtx.strokeStyle = color;
    gCtx.lineWidth = 2;
    gCtx.beginPath();

    const stepX = w / (MAX_GRAPH_POINTS - 1);
    const offset = MAX_GRAPH_POINTS - timeSeriesHistory.length;

    for (let i = 0; i < timeSeriesHistory.length; i++) {
      const val = timeSeriesHistory[i][key] * scaleFactor;
      const x = (i + offset) * stepX;
      const y = h - (val / maxVal) * (h - 8) - 4;

      if (i === 0) gCtx.moveTo(x, y);
      else gCtx.lineTo(x, y);
    }
    gCtx.stroke();
  }

  drawSeries("p", "#22c55e", 1.0);
  drawSeries("h", "#f97316", 1.0);
  drawSeries("c", "#f43f5e", 2.5);
}

// ---------- Engine Loop ----------
let lastTime = 0;
function loop(timestamp) {
  if (!lastTime) lastTime = timestamp;
  const elapsed = timestamp - lastTime;

  if (elapsed > TICK_MS) {
    step();
    renderWorld();
    renderSparkline();
    lastTime = timestamp;
  }

  requestAnimationFrame(loop);
}

resizeGraph();
initWorld();
requestAnimationFrame(loop);
