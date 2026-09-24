// =====================================================================
// SYNAPSE REEF v0.4 — Real-Time Math Scope & Phase-Space Attractor Engine
// =====================================================================

// ---------- Configuration ----------
const WIDTH = 50;
const HEIGHT = 35;
const CELL_SIZE = 14;

const TICK_MS = 75;        // Fluid simulation cadence
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

// High-speed visual action potential particles that travel along synaptic axons
let synapticSparks = [];

// Environmental Climate & Seasonal Cycle System
const CLIMATES = [
  { name: "Verdant Solstice", icon: "☀️", sunFactor: 1.05, moistureBonus: 0.005, desc: "Optimal sunlight and rapid root mineral synthesis." },
  { name: "Nutrient Monsoon", icon: "🌧️", sunFactor: 0.85, moistureBonus: 0.015, desc: "High rainfall accelerating detritus breakdown into fertile loam." },
  { name: "Arid Eclipse", icon: "🌘", sunFactor: 0.65, moistureBonus: 0.001, desc: "Dimmed canopy light; grazers and predators rely on stored metabolism." },
  { name: "Bioluminescent Bloom", icon: "✨", sunFactor: 1.25, moistureBonus: 0.008, desc: "High energetic excitation stimulating spore proliferation." }
];
let currentClimateIndex = 0;
let climateTicksRemaining = 600;

// High-resolution timeseries history for continuous sparkline rendering
const MAX_GRAPH_POINTS = 160;
let timeSeriesHistory = [];
let epochHistory = [];

// Math Scope state
let mathScopeActive = false;
const MAX_PHASE_POINTS = 140;
let phaseOrbitHistory = []; // { p, h, c }
let lastPCount = 0;
let lastHCount = 0;

// Interactive stewardship tool state ('plant' | 'grazer' | 'predator' | 'nutrient')
let activeTool = "plant";
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
    pulse: 0,
    defenseTimer: 0,
    alive: true,
  };
}

function spawnSynapticSpark(fromX, fromY, toX, toY, color = "#00f0ff") {
  const px1 = fromX * CELL_SIZE + CELL_SIZE / 2;
  const py1 = fromY * CELL_SIZE + CELL_SIZE / 2;
  const px2 = toX * CELL_SIZE + CELL_SIZE / 2;
  const py2 = toY * CELL_SIZE + CELL_SIZE / 2;

  synapticSparks.push({
    x: px1,
    y: py1,
    targetX: px2,
    targetY: py2,
    progress: 0,
    speed: 0.18 + Math.random() * 0.12,
    color,
    radius: 2.2 + Math.random() * 1.5,
  });
}

function triggerPlantPulse(startX, startY, strength = 1.0, depth = 4) {
  const visited = new Set();
  const queue = [{ x: startX, y: startY, s: strength, d: depth }];

  while (queue.length > 0) {
    const { x, y, s, d } = queue.shift();
    const key = `${x},${y}`;
    if (visited.has(key)) continue;
    visited.add(key);

    const cell = grid[x]?.[y];
    if (cell && cell.type === "plant" && cell.alive) {
      cell.pulse = Math.max(cell.pulse || 0, s);
      cell.defenseTimer = Math.min(180, (cell.defenseTimer || 0) + Math.round(s * 80));

      if (d > 1 && s > 0.15) {
        for (const [nx, ny] of getNeighbors(x, y)) {
          if (!visited.has(`${nx},${ny}`) && grid[nx]?.[ny]?.type === "plant") {
            queue.push({ x: nx, y: ny, s: s * 0.82, d: d - 1 });
            if (Math.random() < 0.85) {
              spawnSynapticSpark(x, y, nx, ny, s > 0.6 ? "#00f0ff" : "#38bdf8");
            }
          }
        }
      }
    }
  }
}

function decayPlantPulses() {
  for (const entity of entities) {
    if (entity.type !== "plant") continue;
    entity.pulse = Math.max(0, (entity.pulse || 0) - 0.035);
    if (entity.defenseTimer > 0) {
      entity.defenseTimer--;
    }
  }
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
  phaseOrbitHistory = [];
  epochHistory = [];
  activeRipples = [];
  synapticSparks = [];

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
  currentClimateIndex = 0;
  climateTicksRemaining = 600;
  clearLog();
  logLine("🌱 Epoch 0 — Synapse Reef v0.4 active: Real-Time Mathematical Scope & Attractor Engine.", "epoch");
  updateEpochBadge();
  updateClimateHUD();
}

function shuffle(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[j], arr[i]] = [arr[j], arr[i]];
  }
}

function updateClimateCycle() {
  climateTicksRemaining--;
  if (climateTicksRemaining <= 0) {
    currentClimateIndex = (currentClimateIndex + 1) % CLIMATES.length;
    climateTicksRemaining = 600 + Math.floor(Math.random() * 300);
    const climate = CLIMATES[currentClimateIndex];
    logLine(`🌍 Climate Shift: Entered '${climate.name}' ${climate.icon} — ${climate.desc}`, "epoch");
    updateClimateHUD();
  }
}

function updateClimateHUD() {
  const climate = CLIMATES[currentClimateIndex];
  const iconEl = document.getElementById("climateIcon");
  const nameEl = document.getElementById("climateName");
  const sunEl = document.getElementById("sunStat");
  const soilEl = document.getElementById("soilStat");

  if (iconEl) iconEl.textContent = climate.icon;
  if (nameEl) nameEl.textContent = climate.name;
  if (sunEl) sunEl.textContent = `${Math.round(climate.sunFactor * 100)}%`;
  if (soilEl) {
    if (climate.moistureBonus > 0.01) soilEl.textContent = "High Loam";
    else if (climate.moistureBonus < 0.003) soilEl.textContent = "Arid";
    else soilEl.textContent = "Optimal";
  }
}

function cycleSoilAndDetritus() {
  const climate = CLIMATES[currentClimateIndex];
  for (let x = 0; x < WIDTH; x++) {
    for (let y = 0; y < HEIGHT; y++) {
      if (detritusField[x][y] > 0.05) {
        const decomposed = detritusField[x][y] * 0.05;
        detritusField[x][y] -= decomposed;
        soilNutrients[x][y] = Math.min(10.0, soilNutrients[x][y] + decomposed * 1.3);
      }
      soilNutrients[x][y] = Math.min(10.0, soilNutrients[x][y] + climate.moistureBonus);
    }
  }
}

function updatePlant(p) {
  const g = p.genome;
  const climate = CLIMATES[currentClimateIndex];
  const neighbors = getNeighbors(p.x, p.y);
  const plantNeighbors = neighbors.filter(([nx, ny]) => grid[nx][ny]?.type === "plant").length;

  const availableSoil = soilNutrients[p.x][p.y];
  const soilBonus = Math.min(availableSoil, g.nutrientUptake);
  soilNutrients[p.x][p.y] = Math.max(0.0, availableSoil - soilBonus * 0.4);

  if (plantNeighbors >= g.crowdingTolerance) {
    p.energy -= g.maintenanceCost * 1.4;
  } else {
    p.energy += (g.growthRate * climate.sunFactor + soilBonus) * (1 - plantNeighbors / 9.0);
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

  if (h.energy < g.maxSatiation) {
    for (const [nx, ny] of immediateNeighbors) {
      const cell = grid[nx][ny];
      if (cell && cell.type === "plant" && cell.alive) {
        const isDefending = (cell.defenseTimer || 0) > 0;
        const effectiveBite = isDefending ? g.biteEfficiency * 0.5 : g.biteEfficiency;
        const bite = Math.min(cell.energy, effectiveBite);

        triggerPlantPulse(nx, ny, 1.0, 4);

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

  for (const [nx, ny] of immediateNeighbors) {
    const prey = grid[nx][ny];
    if (prey && prey.type === "herbivore" && prey.alive) {
      prey.alive = false;
      grid[nx][ny] = null;
      c.energy = Math.min(g.maxSatiation, c.energy + g.huntEfficiency);
      detritusField[nx][ny] = Math.min(10.0, detritusField[nx][ny] + 2.5);
      triggerPlantPulse(nx, ny, 1.0, 5);
      hunted = true;
      break;
    }
  }

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

function updateMathTelemetry(pCount, hCount, cCount) {
  const dp = ((pCount - lastPCount) / 4).toFixed(2);
  const dh = ((hCount - lastHCount) / 4).toFixed(2);
  lastPCount = pCount;
  lastHCount = hCount;

  let totalPulse = 0;
  let plantCount = 0;
  let totalSoil = 0;

  for (let x = 0; x < WIDTH; x++) {
    for (let y = 0; y < HEIGHT; y++) {
      totalSoil += soilNutrients[x][y];
      const e = grid[x][y];
      if (e && e.type === "plant") {
        totalPulse += (e.pulse || 0);
        plantCount++;
      }
    }
  }

  const meanPhi = plantCount > 0 ? (totalPulse / plantCount).toFixed(3) : "0.000";

  const dpEl = document.getElementById("mathDP");
  const dhEl = document.getElementById("mathDH");
  const phiEl = document.getElementById("mathMeanPhi");
  const soilEl = document.getElementById("mathSoilMass");

  if (dpEl) dpEl.textContent = `${dp >= 0 ? "+" : ""}${dp} / tick`;
  if (dhEl) dhEl.textContent = `${dh >= 0 ? "+" : ""}${dh} / tick`;
  if (phiEl) phiEl.textContent = `${meanPhi} V`;
  if (soilEl) soilEl.textContent = `${Math.round(totalSoil)}`;

  phaseOrbitHistory.push({ p: pCount, h: hCount, c: cCount });
  if (phaseOrbitHistory.length > MAX_PHASE_POINTS) {
    phaseOrbitHistory.shift();
  }

  const attractorEl = document.getElementById("orbitAttractorStatus");
  if (attractorEl && phaseOrbitHistory.length > 20) {
    const recent = phaseOrbitHistory.slice(-20);
    const varP = Math.max(...recent.map(r => r.p)) - Math.min(...recent.map(r => r.p));
    const varH = Math.max(...recent.map(r => r.h)) - Math.min(...recent.map(r => r.h));
    if (varP > 200 || varH > 120) {
      attractorEl.textContent = "Chaotic Trajectory";
      attractorEl.style.color = "#f43f5e";
    } else {
      attractorEl.textContent = "Stable Limit Cycle";
      attractorEl.style.color = "#38bdf8";
    }
  }
}

function recordTimeSeries() {
  const pCount = entities.filter(e => e.type === "plant").length;
  const hCount = entities.filter(e => e.type === "herbivore").length;
  const cCount = entities.filter(e => e.type === "carnivore").length;

  timeSeriesHistory.push({ p: pCount, h: hCount, c: cCount });
  if (timeSeriesHistory.length > MAX_GRAPH_POINTS) {
    timeSeriesHistory.shift();
  }

  updateMathTelemetry(pCount, hCount, cCount);
}

function step() {
  tick++;
  updateClimateCycle();
  cycleSoilAndDetritus();
  decayPlantPulses();
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

const phaseCanvas = document.getElementById("phaseCanvas");
const pCtx = phaseCanvas ? phaseCanvas.getContext("2d") : null;

function resizeGraph() {
  if (graphCanvas) {
    graphCanvas.width = graphCanvas.parentElement.clientWidth - 32;
    graphCanvas.height = 70;
  }
  if (phaseCanvas) {
    phaseCanvas.width = phaseCanvas.parentElement.clientWidth - 20;
    phaseCanvas.height = 120;
  }
}
window.addEventListener("resize", resizeGraph);

// Math Scope Toggle
const mathToggleBtn = document.getElementById("mathToggleBtn");
const mathScopePanel = document.getElementById("mathScopePanel");

if (mathToggleBtn && mathScopePanel) {
  mathToggleBtn.addEventListener("click", () => {
    mathScopeActive = !mathScopeActive;
    if (mathScopeActive) {
      mathToggleBtn.classList.add("active");
      mathScopePanel.classList.add("open");
      resizeGraph();
      logLine("📐 Math Scope Engaged: Vector fields and Phase-Space attractor active.", "epoch");
    } else {
      mathToggleBtn.classList.remove("active");
      mathScopePanel.classList.remove("open");
    }
  });
}

function handleCanvasPointer(clientX, clientY) {
  const rect = canvas.getBoundingClientRect();
  const scaleX = canvas.width / rect.width;
  const scaleY = canvas.height / rect.height;

  const canvasX = (clientX - rect.left) * scaleX;
  const canvasY = (clientY - rect.top) * scaleY;

  const gridX = Math.floor(canvasX / CELL_SIZE);
  const gridY = Math.floor(canvasY / CELL_SIZE);

  if (gridX < 0 || gridX >= WIDTH || gridY < 0 || gridY >= HEIGHT) return;

  activeRipples.push({
    x: canvasX,
    y: canvasY,
    radius: 4,
    maxRadius: 36,
    alpha: 0.95,
    tool: activeTool
  });

  if (activeTool === "plant") {
    const emptyPos = findNearestEmptyCell(gridX, gridY);
    if (emptyPos) {
      const [ex, ey] = emptyPos;
      const p = createPlant(ex, ey);
      grid[ex][ey] = p;
      entities.push(p);
      triggerPlantPulse(ex, ey, 1.0, 4);
      logLine(`🌱 Hand of the Steward: Seeded canopy spore near (${ex}, ${ey}).`, "event");
    } else {
      const old = grid[gridX][gridY];
      if (old) old.alive = false;
      const p = createPlant(gridX, gridY);
      grid[gridX][gridY] = p;
      entities.push(p);
      triggerPlantPulse(gridX, gridY, 1.0, 4);
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
    for (let dx = -1; dx <= 1; dx++) {
      for (let dy = -1; dy <= 1; dy++) {
        const nx = (gridX + dx + WIDTH) % WIDTH;
        const ny = (gridY + dy + HEIGHT) % HEIGHT;
        soilNutrients[nx][ny] = Math.min(10.0, soilNutrients[nx][ny] + 5.0);
        triggerPlantPulse(nx, ny, 1.0, 4);
      }
    }
    logLine(`✨ Hand of the Steward: Enriched soil mineral pocket around (${gridX}, ${gridY}).`, "event");
  }
}

canvas.addEventListener("pointerdown", (e) => {
  handleCanvasPointer(e.clientX, e.clientY);
});

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

function renderSynapticFilaments() {
  ctx.save();
  for (let x = 0; x < WIDTH; x++) {
    for (let y = 0; y < HEIGHT; y++) {
      const e = grid[x][y];
      if (!e || e.type !== "plant") continue;

      const px1 = x * CELL_SIZE + CELL_SIZE / 2;
      const py1 = y * CELL_SIZE + CELL_SIZE / 2;

      const cardinalTargets = [
        [(x + 1) % WIDTH, y],
        [x, (y + 1) % HEIGHT]
      ];

      for (const [nx, ny] of cardinalTargets) {
        const neighbor = grid[nx][ny];
        if (neighbor && neighbor.type === "plant") {
          const px2 = nx * CELL_SIZE + CELL_SIZE / 2;
          const py2 = ny * CELL_SIZE + CELL_SIZE / 2;

          if (Math.abs(px1 - px2) > CELL_SIZE * 2 || Math.abs(py1 - py2) > CELL_SIZE * 2) continue;

          const activePulse = Math.max(e.pulse || 0, neighbor.pulse || 0);

          if (activePulse > 0.05) {
            ctx.strokeStyle = `rgba(0, 240, 255, ${Math.min(1.0, activePulse * 0.95)})`;
            ctx.lineWidth = 1.6 + activePulse * 1.5;
            ctx.shadowColor = "#00f0ff";
            ctx.shadowBlur = 6 * activePulse;
          } else {
            ctx.strokeStyle = "rgba(16, 185, 129, 0.12)";
            ctx.lineWidth = 0.75;
            ctx.shadowBlur = 0;
          }

          ctx.beginPath();
          ctx.moveTo(px1, py1);
          ctx.lineTo(px2, py2);
          ctx.stroke();
        }
      }
    }
  }
  ctx.restore();
}

function renderSynapticSparks() {
  ctx.save();
  for (let i = synapticSparks.length - 1; i >= 0; i--) {
    const s = synapticSparks[i];
    s.progress += s.speed;

    const currentX = s.x + (s.targetX - s.x) * s.progress;
    const currentY = s.y + (s.targetY - s.y) * s.progress;

    ctx.beginPath();
    ctx.arc(currentX, currentY, s.radius, 0, Math.PI * 2);
    ctx.fillStyle = s.color;
    ctx.shadowColor = s.color;
    ctx.shadowBlur = 8;
    ctx.fill();

    if (s.progress >= 1.0) {
      synapticSparks.splice(i, 1);
    }
  }
  ctx.restore();
}

// Math Scope Visual Overlay: Vector fields & coordinate matrices
function renderMathScopeOverlay() {
  if (!mathScopeActive) return;

  ctx.save();
  ctx.font = "7px monospace";
  ctx.fillStyle = "rgba(167, 139, 250, 0.4)";
  ctx.strokeStyle = "rgba(167, 139, 250, 0.25)";
  ctx.lineWidth = 0.5;

  // Grid Coordinate Crosshairs & Vector Arrows
  for (let x = 0; x < WIDTH; x += 4) {
    for (let y = 0; y < HEIGHT; y += 4) {
      const px = x * CELL_SIZE;
      const py = y * CELL_SIZE;

      ctx.beginPath();
      ctx.moveTo(px - 2, py); ctx.lineTo(px + 2, py);
      ctx.moveTo(px, py - 2); ctx.lineTo(px, py + 2);
      ctx.stroke();

      const e = grid[x][y];
      if (e && e.type === "plant" && e.pulse > 0.1) {
        // Render Gradient Vector ∇Φ
        ctx.strokeStyle = "rgba(0, 240, 255, 0.7)";
        ctx.beginPath();
        ctx.moveTo(px + CELL_SIZE / 2, py + CELL_SIZE / 2);
        ctx.lineTo(px + CELL_SIZE / 2, py + CELL_SIZE / 2 - e.pulse * 10);
        ctx.stroke();
      }
    }
  }
  ctx.restore();
}

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
        const pulse = Math.max(0, Math.min(1, e.pulse || 0));

        ctx.fillStyle = `hsl(${hue}, 68%, ${energyTone}%)`;
        ctx.fillRect(px + 1, py + 1, CELL_SIZE - 2, CELL_SIZE - 2);

        if (pulse > 0.02) {
          ctx.save();
          ctx.fillStyle = `rgba(0, 240, 255, ${pulse * 0.75})`;
          ctx.fillRect(px + 1, py + 1, CELL_SIZE - 2, CELL_SIZE - 2);

          ctx.strokeStyle = `rgba(255, 255, 255, ${pulse * 0.95})`;
          ctx.lineWidth = 1.5;
          ctx.shadowColor = "#00f0ff";
          ctx.shadowBlur = 8 * pulse;
          ctx.strokeRect(px + 1, py + 1, CELL_SIZE - 2, CELL_SIZE - 2);
          ctx.restore();
        } else if (e.defenseTimer > 0) {
          ctx.strokeStyle = "rgba(56, 189, 248, 0.4)";
          ctx.lineWidth = 1;
          ctx.strokeRect(px + 1.5, py + 1.5, CELL_SIZE - 3, CELL_SIZE - 3);
        }
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

  renderSynapticFilaments();
  renderSynapticSparks();
  renderMathScopeOverlay();

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

    r.radius += 2.0;
    r.alpha -= 0.045;

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

// Render 2D Lotka-Volterra Phase-Space Orbit Attractor
function renderPhaseSpaceOrbit() {
  if (!pCtx || !mathScopeActive || phaseOrbitHistory.length < 2) return;

  const w = phaseCanvas.width;
  const h = phaseCanvas.height;

  pCtx.clearRect(0, 0, w, h);

  // Background coordinate grid
  pCtx.strokeStyle = "#10192e";
  pCtx.lineWidth = 1;
  pCtx.beginPath();
  pCtx.moveTo(w / 2, 0); pCtx.lineTo(w / 2, h);
  pCtx.moveTo(0, h / 2); pCtx.lineTo(w, h / 2);
  pCtx.stroke();

  // Axis Labels
  pCtx.fillStyle = "#64748b";
  pCtx.font = "8px monospace";
  pCtx.fillText("Canopy P(t) ──►", w - 85, h - 6);
  pCtx.fillText("▲ Grazer H(t)", 6, 12);

  let maxP = 600;
  let maxH = 250;

  for (const pt of phaseOrbitHistory) {
    if (pt.p > maxP) maxP = pt.p;
    if (pt.h > maxH) maxH = pt.h;
  }

  pCtx.lineWidth = 1.8;
  for (let i = 1; i < phaseOrbitHistory.length; i++) {
    const pt1 = phaseOrbitHistory[i - 1];
    const pt2 = phaseOrbitHistory[i];

    const x1 = (pt1.p / maxP) * (w - 20) + 10;
    const y1 = h - (pt1.h / maxH) * (h - 20) - 10;
    const x2 = (pt2.p / maxP) * (w - 20) + 10;
    const y2 = h - (pt2.h / maxH) * (h - 20) - 10;

    const alpha = (i / phaseOrbitHistory.length);
    pCtx.strokeStyle = `rgba(167, 139, 250, ${alpha * 0.9})`;
    pCtx.beginPath();
    pCtx.moveTo(x1, y1);
    pCtx.lineTo(x2, y2);
    pCtx.stroke();
  }

  // Current head state point
  const head = phaseOrbitHistory[phaseOrbitHistory.length - 1];
  const headX = (head.p / maxP) * (w - 20) + 10;
  const headY = h - (head.h / maxH) * (h - 20) - 10;

  pCtx.beginPath();
  pCtx.arc(headX, headY, 3.5, 0, Math.PI * 2);
  pCtx.fillStyle = "#38bdf8";
  pCtx.shadowColor = "#38bdf8";
  pCtx.shadowBlur = 8;
  pCtx.fill();
  pCtx.shadowBlur = 0;
}

// ---------- Engine Loop ----------
let lastTime = 0;
function loop(timestamp) {
  if (!lastTime) lastTime = timestamp;
  const elapsed = timestamp - lastTime;

  if (elapsed > TICK_MS) {
    step();
    lastTime = timestamp;
  }

  renderWorld();
  renderSparkline();
  renderPhaseSpaceOrbit();

  requestAnimationFrame(loop);
}

resizeGraph();
initWorld();
requestAnimationFrame(loop);
