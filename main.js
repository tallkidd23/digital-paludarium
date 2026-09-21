// ---------- Configuration ----------
const WIDTH = 50;
const HEIGHT = 35;
const CELL_SIZE = 14;

const TICK_MS = 120;       // speed of simulation
const EPOCH_EVERY = 500;   // log stats every N ticks

const INITIAL_PLANT_DENSITY = 0.25;
const INITIAL_HERBIVORE_COUNT = 12;

// ---------- Types ----------
// Entity: { type, x, y, energy, age, genome, alive }
// Genome (plant): { growthRate, maintenanceCost, reproThreshold, reproCost, maxAge, mutationRate }
// Genome (herbivore): { baseMetabolism, movementCost, reproThreshold, reproCost, maxAge, mutationRate }

// ---------- State ----------
let grid = createGrid();
let nutrients = createNutrients();
let entities = [];
let tick = 0;
let epoch = 0;

// ---------- Grid helpers ----------
function createGrid() {
  return Array.from({ length: WIDTH }, () =>
    Array(HEIGHT).fill(null)
  );
}

function createNutrients() {
  // Simple nutrient field, can be used later for plant growth modulation
  return Array.from({ length: WIDTH }, () =>
    Array(HEIGHT).fill(5)
  );
}

function emptyNeighbors(x, y) {
  const neighbors = [
    [x + 1, y],
    [x - 1, y],
    [x, y + 1],
    [x, y - 1],
  ];
  const result = [];
  for (const [nx, ny] of neighbors) {
    if (nx < 0 || ny < 0 || nx >= WIDTH || ny >= HEIGHT) continue;
    if (!grid[nx][ny]) result.push([nx, ny]);
  }
  return result;
}

function randomEmptyNeighbor(x, y) {
  const opts = emptyNeighbors(x, y);
  if (opts.length === 0) return null;
  return opts[Math.floor(Math.random() * opts.length)];
}

// ---------- Genome helpers ----------
function defaultPlantGenome() {
  return {
    growthRate: 2,
    maintenanceCost: 1,
    reproThreshold: 10,
    reproCost: 6,
    maxAge: 200,
    mutationRate: 0.08,
  };
}

function defaultHerbivoreGenome() {
  return {
    baseMetabolism: 1.0,
    movementCost: 1.0,
    reproThreshold: 12,
    reproCost: 7,
    maxAge: 150,
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
    // ±10% mutation
    const factor = 1 + (Math.random() * 0.2 - 0.1);
    let val = g[key] * factor;
    // Clamp to sane ranges
    if (key.includes("Cost") || key === "maintenanceCost" || key === "baseMetabolism" || key === "movementCost") {
      val = Math.max(0.2, Math.min(5, val));
    } else if (key === "growthRate") {
      val = Math.max(0.5, Math.min(6, val));
    } else if (key === "reproThreshold" || key === "reproCost") {
      val = Math.max(2, Math.min(40, val));
    } else if (key === "maxAge") {
      val = Math.max(50, Math.min(400, Math.round(val)));
    }
    g[key] = val;
  }
  return g;
}

// ---------- Entity creation ----------
function createPlant(x, y, genome = null) {
  return {
    type: "plant",
    x,
    y,
    energy: 6,
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
    energy: 10,
    age: 0,
    genome: genome ? mutateGenome(genome) : defaultHerbivoreGenome(),
    alive: true,
  };
}

// ---------- Initialization ----------
function initWorld() {
  grid = createGrid();
  nutrients = createNutrients();
  entities = [];

  // Seed plants
  for (let x = 0; x < WIDTH; x++) {
    for (let y = 0; y < HEIGHT; y++) {
      if (Math.random() < INITIAL_PLANT_DENSITY) {
        const p = createPlant(x, y);
        grid[x][y] = p;
        entities.push(p);
      }
    }
  }

  // Seed herbivores
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
  logLine("Epoch 0 – World initialized.");
}

// ---------- Simulation ----------
function shuffle(array) {
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
}

function step() {
  tick++;
  shuffle(entities);

  for (const e of entities) {
    if (!e.alive) continue;
    if (e.type === "plant") updatePlant(e);
    else if (e.type === "herbivore") updateHerbivore(e);
  }

  cleanupDead();

  if (tick % EPOCH_EVERY === 0) {
    epoch++;
    logEpoch();
  }
}

function updatePlant(p) {
  const g = p.genome;
  p.energy += g.growthRate;
  p.energy -= g.maintenanceCost;
  p.age++;

  // Reproduction
  if (p.energy >= g.reproThreshold) {
    const pos = randomEmptyNeighbor(p.x, p.y);
    if (pos) {
      const [nx, ny] = pos;
      const child = createPlant(nx, ny, g);
      grid[nx][ny] = child;
      entities.push(child);
      p.energy -= g.reproCost;
    }
  }

  // Death
  if (p.energy <= 0 || p.age > g.maxAge) {
    p.alive = false;
  }
}

function updateHerbivore(h) {
  const g = h.genome;

  // Look for adjacent plant
  const neighbors = [
    [h.x + 1, h.y],
    [h.x - 1, h.y],
    [h.x, h.y + 1],
    [h.x, h.y - 1],
  ].filter(([x, y]) => x >= 0 && y >= 0 && x < WIDTH && y < HEIGHT);

  let ate = false;
  for (const [nx, ny] of neighbors) {
    const cell = grid[nx][ny];
    if (cell && cell.type === "plant" && cell.alive) {
      // Eat
      cell.alive = false;
      grid[nx][ny] = null;
      h.energy += 8; // eatGain
      ate = true;
      break;
    }
  }

  // Move if no food
  if (!ate) {
    const emptyOpts = neighbors.filter(([x, y]) => !grid[x][y]);
    if (emptyOpts.length > 0) {
      const [nx, ny] = emptyOpts[Math.floor(Math.random() * emptyOpts.length)];
      grid[h.x][h.y] = null;
      h.x = nx;
      h.y = ny;
      grid[nx][ny] = h;
    }
  }

  h.energy -= (g.baseMetabolism + g.movementCost);
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

  // Death
  if (h.energy <= 0 || h.age > g.maxAge) {
    h.alive = false;
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

// ---------- Logging / Chronicle ----------
const logEl = document.getElementById("log");

function clearLog() {
  logEl.textContent = "";
}

function logLine(text, cls = "event") {
  const div = document.createElement("div");
  div.className = cls;
  div.textContent = text;
  logEl.appendChild(div);
  // Keep log from growing forever
  if (logEl.childElementCount > 200) {
    logEl.removeChild(logEl.firstChild);
  }
}

function logEpoch() {
  const plantCount = entities.filter(e => e.type === "plant").length;
  const herbCount = entities.filter(e => e.type === "herbivore").length;

  const avgPlantGrowth =
    entities.filter(e => e.type === "plant").reduce((s, e) => s + e.genome.growthRate, 0) /
    Math.max(1, plantCount);

  const avgHerbMetab =
    entities.filter(e => e.type === "herbivore").reduce((s, e) => s + e.genome.baseMetabolism, 0) /
    Math.max(1, herbCount);

  logLine(`Epoch ${epoch} (tick ${tick}) – Plants: ${plantCount}, Herbivores: ${herbCount}`, "epoch");

  // Simple event detection
  if (plantCount === 0 && herbCount > 0) {
    logLine("Event: Plants extinct – herbivores facing collapse.", "event");
  }
  if (herbCount === 0 && plantCount > 0) {
    logLine("Event: Herbivores extinct – plants ungrazed.", "event");
  }
  if (plantCount > 80 && epoch % 3 === 0) {
    logLine("Event: Plant bloom – dense vegetation.", "event");
  }

  // Trait trend hints (very naive)
  if (epoch > 2) {
    if (avgHerbMetab > 1.3) {
      logLine("Observation: Herbivores trending toward higher metabolism.", "event");
    }
    if (avgPlantGrowth < 1.5) {
      logLine("Observation: Plants trending toward slower growth.", "event");
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
        ctx.fillStyle = "#0b1020";
        ctx.fillRect(px, py, CELL_SIZE, CELL_SIZE);
        continue;
      }

      if (e.type === "plant") {
        const brightness = 25 + Math.min(35, e.energy * 2);
        ctx.fillStyle = `hsl(130, 60%, ${brightness}%)`;
      } else if (e.type === "herbivore") {
        const brightness = 35 + Math.min(35, e.energy * 2);
        ctx.fillStyle = `hsl(18, 80%, ${brightness}%)`;
      }

      ctx.fillRect(px, py, CELL_SIZE, CELL_SIZE);
    }
  }
}

// ---------- Main loop ----------
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

// ---------- Start ----------
initWorld();
requestAnimationFrame(loop);
