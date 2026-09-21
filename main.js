// ---------- Configuration ----------
const WIDTH = 50;
const HEIGHT = 35;
const CELL_SIZE = 14;

const TICK_MS = 80;        // Fluid simulation cadence
const EPOCH_EVERY = 250;   // Epoch chronicle interval

const INITIAL_PLANT_DENSITY = 0.18;
const INITIAL_HERBIVORE_COUNT = 18;

// ---------- State ----------
let grid = createGrid();           // Primary biological occupancy
let soilNutrients = createSoil();  // Continuous soil mineral field (0.0 to 10.0)
let detritusField = createSoil();  // Organic decay matter
let entities = [];
let tick = 0;
let epoch = 0;

let populationHistory = [];

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

// ---------- Genomes & Heritable Variation ----------
function defaultPlantGenome() {
  return {
    growthRate: 1.1,
    nutrientUptake: 0.4,       // Converts soil nutrients into extra vitality
    maintenanceCost: 0.45,
    reproThreshold: 7.5,
    reproCost: 4.0,
    maxAge: 280,
    crowdingTolerance: 5,
    mutationRate: 0.08,
  };
}

function defaultHerbivoreGenome() {
  return {
    baseMetabolism: 0.45,
    movementCost: 0.30,
    sensoryRadius: 3,          // Scent foraging range
    maxSatiation: 22.0,        // Stomach capacity: avoids instantaneous over-grazing
    reproThreshold: 15.0,
    reproCost: 8.0,
    biteEfficiency: 7.0,
    maxAge: 240,
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
    } else if (key === "growthRate" || key === "nutrientUptake" || key === "biteEfficiency") {
      val = Math.max(0.2, Math.min(12.0, val));
    } else if (key === "reproThreshold" || key === "reproCost" || key === "maxSatiation") {
      val = Math.max(3.0, Math.min(35.0, val));
    } else if (key === "crowdingTolerance" || key === "sensoryRadius") {
      val = Math.max(1, Math.min(7, Math.round(val)));
    } else if (key === "maxAge") {
      val = Math.max(60, Math.min(600, Math.round(val)));
    }
    g[key] = val;
  }
  return g;
}

// ---------- Constructors ----------
function createPlant(x, y, genome = null) {
  return {
    type: "plant",
    x,
    y,
    energy: 4.5,
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
    energy: 11.0,
    age: 0,
    genome: genome ? mutateGenome(genome) : defaultHerbivoreGenome(),
    alive: true,
  };
}

// ---------- Lifecycle & Physics ----------
function initWorld() {
  grid = createGrid();
  soilNutrients = createSoil();
  detritusField = createSoil();
  entities = [];
  populationHistory = [];

  for (let x = 0; x < WIDTH; x++) {
    for (let y = 0; y < HEIGHT; y++) {
      detritusField[x][y] = 0.0;
      soilNutrients[x][y] = 2.0 + Math.random() * 3.0;
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
  logLine("🌱 Epoch 0 — Microbial decomposition and metabolic homeostasis active.", "epoch");
}

function shuffle(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[j], arr[i]] = [arr[j], arr[i]];
  }
}

function cycleSoilAndDetritus() {
  // Microbial decomposition loop: detritus breaks down into rich mineral soil
  for (let x = 0; x < WIDTH; x++) {
    for (let y = 0; y < HEIGHT; y++) {
      if (detritusField[x][y] > 0.05) {
        const decomposed = detritusField[x][y] * 0.04;
        detritusField[x][y] -= decomposed;
        soilNutrients[x][y] = Math.min(10.0, soilNutrients[x][y] + decomposed * 1.2);
      }
      // Natural mineral diffusion across neighboring ground
      soilNutrients[x][y] = Math.min(10.0, soilNutrients[x][y] + 0.003);
    }
  }
}

function updatePlant(p) {
  const g = p.genome;
  const neighbors = getNeighbors(p.x, p.y);
  const plantNeighbors = neighbors.filter(([nx, ny]) => grid[nx][ny]?.type === "plant").length;

  // Root uptake from soil
  const availableSoil = soilNutrients[p.x][p.y];
  const soilBonus = Math.min(availableSoil, g.nutrientUptake);
  soilNutrients[p.x][p.y] = Math.max(0.0, availableSoil - soilBonus * 0.5);

  // Canopy shading dynamics
  if (plantNeighbors >= g.crowdingTolerance) {
    p.energy -= g.maintenanceCost * 1.6;
  } else {
    p.energy += (g.growthRate + soilBonus) * (1 - plantNeighbors / 8.5);
    p.energy -= g.maintenanceCost;
  }
  p.age++;

  // Proliferation
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

  // Mortality leaves leaf litter in detritus
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

  // 1. Satiation-gated grazing: grazers take bites rather than instantly decimating plants if full
  if (h.energy < g.maxSatiation) {
    for (const [nx, ny] of immediateNeighbors) {
      const cell = grid[nx][ny];
      if (cell && cell.type === "plant" && cell.alive) {
        // Graze plant
        const bite = Math.min(cell.energy, g.biteEfficiency);
        cell.energy -= bite;
        h.energy = Math.min(g.maxSatiation, h.energy + bite);
        if (cell.energy <= 0.5) {
          cell.alive = false;
          grid[nx][ny] = null;
          detritusField[nx][ny] = Math.min(8.0, detritusField[nx][ny] + 0.8);
        }
        ate = true;
        break;
      }
    }
  }

  // 2. Sensory foraging scan
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

  // Mortality deposits biomass into detritus
  if (h.energy <= 0 || h.age > g.maxAge) {
    h.alive = false;
    detritusField[h.x][h.y] = Math.min(10.0, detritusField[h.x][h.y] + 3.0);
  }
}

function environmentalBalance() {
  const plantCount = entities.filter(e => e.type === "plant").length;
  const herbCount = entities.filter(e => e.type === "herbivore").length;

  // Gentle spore germination on rich nutrient soil
  if (plantCount < 20 && Math.random() < 0.2) {
    const rx = Math.floor(Math.random() * WIDTH);
    const ry = Math.floor(Math.random() * HEIGHT);
    if (!grid[rx][ry] && soilNutrients[rx][ry] > 2.5) {
      const p = createPlant(rx, ry);
      grid[rx][ry] = p;
      entities.push(p);
    }
  }

  // Ecological re-entry when canopy recovers
  if (herbCount === 0 && plantCount > 70 && Math.random() < 0.04) {
    const rx = Math.floor(Math.random() * WIDTH);
    const ry = Math.floor(Math.random() * HEIGHT);
    if (!grid[rx][ry]) {
      const h = createHerbivore(rx, ry);
      grid[rx][ry] = h;
      entities.push(h);
      logLine("🐾 Pioneer Lineage: A new grazer lineage colonized the nutrient-dense foliage.", "event");
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
  cycleSoilAndDetritus();
  shuffle(entities);

  for (const e of entities) {
    if (!e.alive) continue;
    if (e.type === "plant") updatePlant(e);
    else if (e.type === "herbivore") updateHerbivore(e);
  }

  environmentalBalance();
  cleanupDead();

  if (tick % EPOCH_EVERY === 0) {
    epoch++;
    logEpoch();
  }
}

// ---------- Chronicle Logging ----------
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
  const avgBite = hCount > 0 ? (herbs.reduce((s, h) => s + h.genome.biteEfficiency, 0) / hCount).toFixed(1) : 0;

  populationHistory.push({ epoch, pCount, hCount });
  if (populationHistory.length > 20) populationHistory.shift();

  logLine(`Epoch ${epoch} (Tick ${tick}) — Canopy: ${pCount} (growth: ${avgGrowth}) | Grazer Kin: ${hCount} (scent: ${avgScent}, bite: ${avgBite})`, "epoch");

  // Higher-order emergent trajectory detectors
  if (populationHistory.length >= 6) {
    const recent = populationHistory.slice(-6);
    const pTrend = recent[recent.length - 1].pCount - recent[0].pCount;
    const hTrend = recent[recent.length - 1].hCount - recent[0].hCount;

    if (Math.abs(pTrend) < 15 && Math.abs(hTrend) < 10 && pCount > 40 && hCount > 10) {
      logLine("⚖️ Dynamic Equilibrium: Co-existing steady-state established between foliage and grazers.", "event");
    } else if (pTrend < -35 && hTrend > 15) {
      logLine("🌊 Grazing Front: High bite efficiency driving localized vegetation clearing.", "event");
    } else if (pTrend > 35 && hTrend < -8) {
      logLine("🌿 Soil Enrichment: Microbial decomposition stimulating canopy expansion.", "event");
    }
  }
}

// ---------- Visual Rendering ----------
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

      // Base soil: render dark earth with subtle nutrient/detritus shading
      const detritus = detritusField[x][y];
      const nutrient = soilNutrients[x][y];

      if (!e) {
        if (detritus > 0.8) {
          // Rich compost brown
          const detritusTone = Math.min(22, 10 + detritus * 2);
          ctx.fillStyle = `hsl(30, 45%, ${detritusTone}%)`;
        } else if (nutrient > 5.0) {
          // Deep fertile substrate
          ctx.fillStyle = "#0a1324";
        } else {
          ctx.fillStyle = "#070a18";
        }
        ctx.fillRect(px, py, CELL_SIZE, CELL_SIZE);
        continue;
      }

      if (e.type === "plant") {
        // Foliage hue shifts with growth rate; brightness with energy
        const hue = 125 + Math.min(25, (e.genome.growthRate - 1.0) * 15);
        const energyTone = Math.min(48, 22 + e.energy * 2.8);
        ctx.fillStyle = `hsl(${hue}, 68%, ${energyTone}%)`;
        ctx.fillRect(px + 1, py + 1, CELL_SIZE - 2, CELL_SIZE - 2);
      } else if (e.type === "herbivore") {
        // Lineage trait coloring: sensory specialization shifts towards magenta/crimson; bite efficiency towards golden amber
        const scentOffset = (e.genome.sensoryRadius - 3) * 12;
        const hue = Math.max(8, Math.min(45, 24 - scentOffset));
        const energyTone = Math.min(60, 38 + e.energy * 1.4);

        ctx.fillStyle = `hsl(${hue}, 92%, ${energyTone}%)`;
        ctx.fillRect(px + 2, py + 2, CELL_SIZE - 4, CELL_SIZE - 4);
      }
    }
  }
}

// ---------- Simulation Engine Loop ----------
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
