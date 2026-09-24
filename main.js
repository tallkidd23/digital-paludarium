// =====================================================================
// SYNAPSE REEF v0.6 — Neural Marine Automata & Generative Bio-Computer
// Turing Reaction-Diffusion + Lotka-Volterra + Ramón y Cajal Neural Net
// Long-Term Substrate Memory + Real-Time Web Audio Generative Synthesis
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
const INITIAL_BENTHIC_COUNT = 4;

// ---------- State ----------
let grid = createGrid();
let soilNutrients = createField(2.0);
let detritusField = createField(0.0);
let substrateMemory = createField(0.0); // Long-term reinforced mycelial bio-memory pathways
let entities = [];
let tick = 0;
let epoch = 0;

// High-speed visual action potential particles that travel along synaptic axons
let synapticSparks = [];

// Environmental Climate & Seasonal Cycle System
const CLIMATES = [
  { name: "Verdant Solstice", icon: "☀️", sunFactor: 1.05, moistureBonus: 0.005, desc: "Optimal sunlight and rapid root mineral synthesis.", rootFreq: 130.81, scale: [261.63, 293.66, 329.63, 392.00, 440.00, 523.25] }, // C Major Pentatonic
  { name: "Nutrient Monsoon", icon: "🌧️", sunFactor: 0.85, moistureBonus: 0.015, desc: "High rainfall accelerating detritus breakdown into fertile loam.", rootFreq: 110.00, scale: [220.00, 246.94, 277.18, 329.63, 369.99, 440.00] }, // A Lydian / Open
  { name: "Arid Eclipse", icon: "🌘", sunFactor: 0.65, moistureBonus: 0.001, desc: "Dimmed canopy light; organisms rely on stored metabolism.", rootFreq: 98.00, scale: [196.00, 233.08, 261.63, 293.66, 349.23, 392.00] }, // G Minor Pentatonic
  { name: "Bioluminescent Bloom", icon: "✨", sunFactor: 1.25, moistureBonus: 0.008, desc: "High energetic excitation stimulating spore proliferation.", rootFreq: 146.83, scale: [293.66, 329.63, 369.99, 440.00, 493.88, 587.33] } // D Major Shimmer
];
let currentClimateIndex = 0;
let climateTicksRemaining = 600;

// High-resolution timeseries history for continuous sparkline rendering
const MAX_GRAPH_POINTS = 160;
let timeSeriesHistory = [];
let epochHistory = [];

// Interactive stewardship tool state ('plant' | 'grazer' | 'predator' | 'benthic' | 'nutrient')
let activeTool = "plant";
let activeRipples = [];
let mathScopeOpen = false;
let audioEnabled = false;

// ---------- Web Audio Generative Synthesis Engine ----------
let audioCtx = null;
let masterGain = null;
let droneOsc1 = null;
let droneOsc2 = null;
let droneGain = null;
let droneFilter = null;

function initAudioEngine() {
  if (audioCtx) return;
  try {
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    audioCtx = new AudioContextClass();

    masterGain = audioCtx.createGain();
    masterGain.gain.setValueAtTime(0.4, audioCtx.currentTime);

    // Warm Ambient Low-Pass Filter
    droneFilter = audioCtx.createBiquadFilter();
    droneFilter.type = "lowpass";
    droneFilter.frequency.setValueAtTime(320, audioCtx.currentTime);
    droneFilter.Q.setValueAtTime(2.5, audioCtx.currentTime);

    droneGain = audioCtx.createGain();
    droneGain.gain.setValueAtTime(0.08, audioCtx.currentTime);

    // Dual Detuned Drone Oscillators for Sub-Benthic Resonance
    droneOsc1 = audioCtx.createOscillator();
    droneOsc2 = audioCtx.createOscillator();

    droneOsc1.type = "sine";
    droneOsc2.type = "triangle";

    const currentClimate = CLIMATES[currentClimateIndex];
    droneOsc1.frequency.setValueAtTime(currentClimate.rootFreq, audioCtx.currentTime);
    droneOsc2.frequency.setValueAtTime(currentClimate.rootFreq * 1.503, audioCtx.currentTime); // Perfect fifth + micro-detune

    droneOsc1.connect(droneGain);
    droneOsc2.connect(droneGain);
    droneGain.connect(droneFilter);
    droneFilter.connect(masterGain);
    masterGain.connect(audioCtx.destination);

    droneOsc1.start();
    droneOsc2.start();
  } catch (err) {
    console.warn("Web Audio initialization deferred until user interaction.", err);
  }
}

function updateAudioClimate() {
  if (!audioCtx || !audioEnabled || !droneOsc1 || !droneOsc2) return;
  const climate = CLIMATES[currentClimateIndex];
  const now = audioCtx.currentTime;

  droneOsc1.frequency.exponentialRampToValueAtTime(climate.rootFreq, now + 3.0);
  droneOsc2.frequency.exponentialRampToValueAtTime(climate.rootFreq * 1.503, now + 3.0);

  if (climate.name === "Arid Eclipse") {
    droneFilter.frequency.exponentialRampToValueAtTime(220, now + 2.5);
  } else if (climate.name === "Bioluminescent Bloom") {
    droneFilter.frequency.exponentialRampToValueAtTime(560, now + 2.5);
  } else {
    droneFilter.frequency.exponentialRampToValueAtTime(340, now + 2.5);
  }
}

function playSynapticChime(pitchMultiplier = 1.0) {
  if (!audioCtx || !audioEnabled) return;
  try {
    const climate = CLIMATES[currentClimateIndex];
    const scale = climate.scale;
    const freq = scale[Math.floor(Math.random() * scale.length)] * pitchMultiplier;

    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    const now = audioCtx.currentTime;

    osc.type = "sine";
    osc.frequency.setValueAtTime(freq, now);

    gain.gain.setValueAtTime(0.06, now);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.55);

    osc.connect(gain);
    gain.connect(masterGain);

    osc.start(now);
    osc.stop(now + 0.6);
  } catch (e) {}
}

function playBenthicPercussion() {
  if (!audioCtx || !audioEnabled) return;
  try {
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    const now = audioCtx.currentTime;

    osc.type = "triangle";
    osc.frequency.setValueAtTime(95, now);
    osc.frequency.exponentialRampToValueAtTime(38, now + 0.08);

    gain.gain.setValueAtTime(0.08, now);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.09);

    osc.connect(gain);
    gain.connect(masterGain);

    osc.start(now);
    osc.stop(now + 0.1);
  } catch (e) {}
}

// ---------- Grid & Field Helpers ----------
function createGrid() {
  return Array.from({ length: WIDTH }, () => Array(HEIGHT).fill(null));
}

function createField(initialVal = 0.0) {
  return Array.from({ length: WIDTH }, () => Array(HEIGHT).fill(initialVal));
}

function getNeighbors(x, y) {
  const neighbors = [];
  for (let dx = -1; dx <= 1; dx++) {
    for (let dy = -1; dy <= 1; dy++) {
      if (dx === 0 && dy === 0) continue;
      const nx = (x + dx + WIDTH) % WIDTH;
      const ny = (y + dy + HEIGHT) % HEIGHT;
      neighbors.push([nx, ny]);
    }
  }
  return neighbors;
}

function randomEmptyNeighbor(x, y) {
  const opts = getNeighbors(x, y).filter(([nx, ny]) => !grid[nx][ny]);
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

// ---------- Genome Templates & Mutation ----------
function defaultPlantGenome() {
  return {
    growthRate: 1.0,
    crowdingTolerance: 5,
    nutrientUptake: 0.8,
    reproThreshold: 7.0,
    reproCost: 3.5,
    maintenanceCost: 0.28,
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

function defaultBenthicGenome() {
  return {
    baseMetabolism: 0.32,
    movementCost: 0.18,
    sensoryRadius: 4,
    scavengeEfficiency: 3.5,
    maxSatiation: 20.0,
    reproThreshold: 13.0,
    reproCost: 6.5,
    maxAge: 280,
    mutationRate: 0.08,
  };
}

function mutateGenome(genome) {
  const g = { ...genome };
  const rate = g.mutationRate || 0.08;
  for (const key of Object.keys(g)) {
    if (key === "mutationRate") continue;
    if (Math.random() < rate) {
      const factor = 1.0 + (Math.random() * 0.24 - 0.12);
      let val = g[key] * factor;

      if (key.includes("Cost") || key === "baseMetabolism" || key === "movementCost") {
        val = Math.max(0.08, Math.min(2.5, val));
      } else if (key === "growthRate" || key === "nutrientUptake" || key === "biteEfficiency" || key === "huntEfficiency" || key === "scavengeEfficiency") {
        val = Math.max(0.3, Math.min(20.0, val));
      } else if (key === "reproThreshold" || key === "reproCost" || key === "maxSatiation") {
        val = Math.max(3.0, Math.min(60.0, val));
      } else if (key === "crowdingTolerance" || key === "sensoryRadius" || key === "huntRadius") {
        val = Math.max(1, Math.min(8, Math.round(val)));
      } else if (key === "maxAge") {
        val = Math.max(60, Math.min(600, Math.round(val)));
      }
      g[key] = val;
    }
  }
  return g;
}

// ---------- Entity Factories ----------
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

  // Reinforce long-term substrate memory along the active axonal filament
  substrateMemory[fromX][fromY] = Math.min(10.0, substrateMemory[fromX][fromY] + 0.4);
  substrateMemory[toX][toY] = Math.min(10.0, substrateMemory[toX][toY] + 0.4);

  if (Math.random() < 0.15) {
    playSynapticChime(1.0);
  }
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

function createBenthic(x, y, genome = null) {
  return {
    type: "benthic",
    x,
    y,
    energy: 12.0,
    age: 0,
    genome: genome ? mutateGenome(genome) : defaultBenthicGenome(),
    alive: true,
  };
}

// ---------- World Initialization ----------
function initWorld() {
  grid = createGrid();
  soilNutrients = createField(2.0);
  detritusField = createField(0.0);
  substrateMemory = createField(0.0);
  entities = [];
  timeSeriesHistory = [];
  epochHistory = [];
  activeRipples = [];
  synapticSparks = [];

  for (let x = 0; x < WIDTH; x++) {
    for (let y = 0; y < HEIGHT; y++) {
      if (Math.random() < INITIAL_PLANT_DENSITY) {
        const p = createPlant(x, y);
        grid[x][y] = p;
        entities.push(p);
      }
    }
  }

  for (let i = 0; i < INITIAL_HERBIVORE_COUNT; i++) {
    const rx = Math.floor(Math.random() * WIDTH);
    const ry = Math.floor(Math.random() * HEIGHT);
    if (!grid[rx][ry]) {
      const h = createHerbivore(rx, ry);
      grid[rx][ry] = h;
      entities.push(h);
    }
  }

  for (let i = 0; i < INITIAL_CARNIVORE_COUNT; i++) {
    const rx = Math.floor(Math.random() * WIDTH);
    const ry = Math.floor(Math.random() * HEIGHT);
    if (!grid[rx][ry]) {
      const c = createCarnivore(rx, ry);
      grid[rx][ry] = c;
      entities.push(c);
    }
  }

  for (let i = 0; i < INITIAL_BENTHIC_COUNT; i++) {
    const rx = Math.floor(Math.random() * WIDTH);
    const ry = Math.floor(Math.random() * HEIGHT);
    if (!grid[rx][ry]) {
      const b = createBenthic(rx, ry);
      grid[rx][ry] = b;
      entities.push(b);
    }
  }

  tick = 0;
  epoch = 0;
  currentClimateIndex = 0;
  climateTicksRemaining = 600;
  clearLog();
  logLine("🌱 Epoch 0 — Synapse Reef v0.6 active: Generative Web Audio, Substrate Bio-Memory & Telemetry.", "epoch");
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
    updateAudioClimate();
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

      // Substrate memory slow passive decay
      if (substrateMemory[x][y] > 0.01) {
        substrateMemory[x][y] -= 0.002;
      }
    }
  }
}

function updatePlant(p) {
  const g = p.genome;
  const climate = CLIMATES[currentClimateIndex];
  const neighbors = getNeighbors(p.x, p.y);
  const plantNeighbors = neighbors.filter(([nx, ny]) => grid[nx][ny]?.type === "plant").length;

  const soil = soilNutrients[p.x][p.y];
  const memBonus = substrateMemory[p.x][p.y] * 0.08; // Bio-memory accelerates root uptake
  const soilBonus = (soil * g.nutrientUptake * 0.15) + memBonus;
  soilNutrients[p.x][p.y] = Math.max(0, soil - 0.015 * g.nutrientUptake);

  if (plantNeighbors >= g.crowdingTolerance) {
    p.energy -= g.maintenanceCost * 1.4;
  } else {
    p.energy += (g.growthRate * climate.sunFactor + soilBonus) * (1 - plantNeighbors / 9.0);
    p.energy -= g.maintenanceCost;
  }
  p.age++;

  if (p.energy <= 0) {
    p.alive = false;
    grid[p.x][p.y] = null;
    detritusField[p.x][p.y] = Math.min(10.0, detritusField[p.x][p.y] + 1.2);
    return;
  }

  if (p.energy >= g.reproThreshold) {
    const empty = randomEmptyNeighbor(p.x, p.y);
    if (empty) {
      const [ex, ey] = empty;
      p.energy -= g.reproCost;
      const offspring = createPlant(ex, ey, p.genome);
      grid[ex][ey] = offspring;
      entities.push(offspring);
      if (Math.random() < 0.4) {
        spawnSynapticSpark(p.x, p.y, ex, ey, "#10b981");
      }
    }
  }
}

function updateHerbivore(h) {
  const g = h.genome;
  h.energy -= g.baseMetabolism;
  h.age++;

  if (h.energy <= 0 || h.age > g.maxAge) {
    h.alive = false;
    grid[h.x][h.y] = null;
    detritusField[h.x][h.y] = Math.min(10.0, detritusField[h.x][h.y] + 2.0);
    return;
  }

  const immediateNeighbors = getNeighbors(h.x, h.y);
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
          detritusField[nx][ny] = Math.min(10.0, detritusField[nx][ny] + 0.8);
        }
        ate = true;
        break;
      }
    }
  }

  if (!ate) {
    let bestTarget = null;
    let minDist = Infinity;
    const sRad = Math.round(g.sensoryRadius);

    for (let dx = -sRad; dx <= sRad; dx++) {
      for (let dy = -sRad; dy <= sRad; dy++) {
        const sx = (h.x + dx + WIDTH) % WIDTH;
        const sy = (h.y + dy + HEIGHT) % HEIGHT;
        const cell = grid[sx][sy];
        if (cell && cell.type === "plant" && cell.alive) {
          const dist = Math.abs(dx) + Math.abs(dy);
          if (dist < minDist) {
            minDist = dist;
            bestTarget = [sx, sy];
          }
        }
      }
    }

    const empties = immediateNeighbors.filter(([nx, ny]) => !grid[nx][ny]);
    if (empties.length > 0) {
      let chosenMove = empties[Math.floor(Math.random() * empties.length)];

      if (bestTarget) {
        let bestMoveDist = Infinity;
        for (const [ex, ey] of empties) {
          const d = Math.abs(ex - bestTarget[0]) + Math.abs(ey - bestTarget[1]);
          if (d < bestMoveDist) {
            bestMoveDist = d;
            chosenMove = [ex, ey];
          }
        }
      }

      grid[h.x][h.y] = null;
      h.x = chosenMove[0];
      h.y = chosenMove[1];
      grid[h.x][h.y] = h;
      h.energy -= g.movementCost;
    }
  }

  if (h.energy >= g.reproThreshold) {
    const empty = randomEmptyNeighbor(h.x, h.y);
    if (empty) {
      const [ex, ey] = empty;
      h.energy -= g.reproCost;
      const offspring = createHerbivore(ex, ey, h.genome);
      grid[ex][ey] = offspring;
      entities.push(offspring);
    }
  }
}

function updateCarnivore(c) {
  const g = c.genome;
  c.energy -= g.baseMetabolism;
  c.age++;

  if (c.energy <= 0 || c.age > g.maxAge) {
    c.alive = false;
    grid[c.x][c.y] = null;
    detritusField[c.x][c.y] = Math.min(10.0, detritusField[c.x][c.y] + 3.0);
    return;
  }

  const immediateNeighbors = getNeighbors(c.x, c.y);
  let hunted = false;

  for (const [nx, ny] of immediateNeighbors) {
    const prey = grid[nx][ny];
    if (prey && (prey.type === "herbivore" || prey.type === "benthic") && prey.alive) {
      prey.alive = false;
      grid[nx][ny] = null;
      c.energy = Math.min(g.maxSatiation, c.energy + g.huntEfficiency);
      detritusField[nx][ny] = Math.min(10.0, detritusField[nx][ny] + 2.5);
      triggerPlantPulse(nx, ny, 1.0, 5);
      playSynapticChime(1.5);
      hunted = true;
      break;
    }
  }

  if (!hunted) {
    let preyTarget = null;
    let minDist = Infinity;
    const hRad = Math.round(g.huntRadius);

    for (let dx = -hRad; dx <= hRad; dx++) {
      for (let dy = -hRad; dy <= hRad; dy++) {
        const sx = (c.x + dx + WIDTH) % WIDTH;
        const sy = (c.y + dy + HEIGHT) % HEIGHT;
        const target = grid[sx][sy];
        if (target && (target.type === "herbivore" || target.type === "benthic") && target.alive) {
          const dist = Math.abs(dx) + Math.abs(dy);
          if (dist < minDist) {
            minDist = dist;
            preyTarget = [sx, sy];
          }
        }
      }
    }

    const empties = immediateNeighbors.filter(([nx, ny]) => !grid[nx][ny]);
    if (empties.length > 0) {
      let chosenMove = empties[Math.floor(Math.random() * empties.length)];

      if (preyTarget) {
        let bestMoveDist = Infinity;
        for (const [ex, ey] of empties) {
          const d = Math.abs(ex - preyTarget[0]) + Math.abs(ey - preyTarget[1]);
          if (d < bestMoveDist) {
            bestMoveDist = d;
            chosenMove = [ex, ey];
          }
        }
      }

      grid[c.x][c.y] = null;
      c.x = chosenMove[0];
      c.y = chosenMove[1];
      grid[c.x][c.y] = c;
      c.energy -= g.movementCost;
    }
  }

  if (c.energy >= g.reproThreshold) {
    const empty = randomEmptyNeighbor(c.x, c.y);
    if (empty) {
      const [ex, ey] = empty;
      c.energy -= g.reproCost;
      const offspring = createCarnivore(ex, ey, c.genome);
      grid[ex][ey] = offspring;
      entities.push(offspring);
    }
  }
}

function updateBenthic(b) {
  const g = b.genome;
  b.energy -= g.baseMetabolism;
  b.age++;

  if (b.energy <= 0 || b.age > g.maxAge) {
    b.alive = false;
    grid[b.x][b.y] = null;
    detritusField[b.x][b.y] = Math.min(10.0, detritusField[b.x][b.y] + 1.5);
    return;
  }

  if (detritusField[b.x][b.y] > 0.2) {
    const scavenged = Math.min(detritusField[b.x][b.y], g.scavengeEfficiency);
    detritusField[b.x][b.y] -= scavenged;
    b.energy = Math.min(g.maxSatiation, b.energy + scavenged * 1.5);
    soilNutrients[b.x][b.y] = Math.min(10.0, soilNutrients[b.x][b.y] + scavenged * 0.8);
    playBenthicPercussion();
  }

  const immediateNeighbors = getNeighbors(b.x, b.y);
  const empties = immediateNeighbors.filter(([nx, ny]) => !grid[nx][ny]);

  if (empties.length > 0 && Math.random() < 0.7) {
    let bestMove = empties[0];
    let maxDet = -1;
    for (const [ex, ey] of empties) {
      if (detritusField[ex][ey] > maxDet) {
        maxDet = detritusField[ex][ey];
        bestMove = [ex, ey];
      }
    }

    grid[b.x][b.y] = null;
    b.x = bestMove[0];
    b.y = bestMove[1];
    grid[b.x][b.y] = b;
    b.energy -= g.movementCost;
  }

  if (b.energy >= g.reproThreshold) {
    const empty = randomEmptyNeighbor(b.x, b.y);
    if (empty) {
      const [ex, ey] = empty;
      b.energy -= g.reproCost;
      const offspring = createBenthic(ex, ey, b.genome);
      grid[ex][ey] = offspring;
      entities.push(offspring);
    }
  }
}

function environmentalBalance() {
  const plantCount = entities.filter(e => e.type === "plant").length;
  const herbCount = entities.filter(e => e.type === "herbivore").length;
  const carnCount = entities.filter(e => e.type === "carnivore").length;
  const benthicCount = entities.filter(e => e.type === "benthic").length;

  // Bio-memory driven recolonization: prefer sprouting along historic neural pathways
  if (plantCount < 15) {
    for (let k = 0; k < 6; k++) {
      let rx = Math.floor(Math.random() * WIDTH);
      let ry = Math.floor(Math.random() * HEIGHT);

      // Search for highest bio-memory node near random point
      let bestX = rx, bestY = ry, maxMem = -1;
      for (let dx = -2; dx <= 2; dx++) {
        for (let dy = -2; dy <= 2; dy++) {
          const nx = (rx + dx + WIDTH) % WIDTH;
          const ny = (ry + dy + HEIGHT) % HEIGHT;
          if (!grid[nx][ny] && substrateMemory[nx][ny] > maxMem) {
            maxMem = substrateMemory[nx][ny];
            bestX = nx;
            bestY = ny;
          }
        }
      }

      if (!grid[bestX][bestY]) {
        const p = createPlant(bestX, bestY);
        grid[bestX][bestY] = p;
        entities.push(p);
      }
    }
  }

  if (herbCount < 4 && plantCount > 40 && Math.random() < 0.12) {
    const rx = Math.floor(Math.random() * WIDTH);
    const ry = Math.floor(Math.random() * HEIGHT);
    if (!grid[rx][ry]) {
      const h = createHerbivore(rx, ry);
      grid[rx][ry] = h;
      entities.push(h);
      logLine("🌊 Pioneer grazer migrated from outer reef shelf.", "event");
    }
  }

  if (carnCount === 0 && (herbCount + benthicCount) > 40 && Math.random() < 0.08) {
    const rx = Math.floor(Math.random() * WIDTH);
    const ry = Math.floor(Math.random() * HEIGHT);
    if (!grid[rx][ry]) {
      const c = createCarnivore(rx, ry);
      grid[rx][ry] = c;
      entities.push(c);
      logLine("⚡ Apex stalker emerged from deep hydrothermal trench.", "event");
    }
  }

  if (benthicCount < 2 && Math.random() < 0.05) {
    const rx = Math.floor(Math.random() * WIDTH);
    const ry = Math.floor(Math.random() * HEIGHT);
    if (!grid[rx][ry]) {
      const b = createBenthic(rx, ry);
      grid[rx][ry] = b;
      entities.push(b);
    }
  }
}

function cleanupDead() {
  entities = entities.filter((e) => e.alive);
}

function recordTimeSeries() {
  let p = 0, h = 0, c = 0, b = 0;
  for (const e of entities) {
    if (e.type === "plant") p++;
    else if (e.type === "herbivore") h++;
    else if (e.type === "carnivore") c++;
    else if (e.type === "benthic") b++;
  }
  timeSeriesHistory.push({ p, h, c, b });
  if (timeSeriesHistory.length > MAX_GRAPH_POINTS) {
    timeSeriesHistory.shift();
  }
}

function updateMathScopeDiagnostics() {
  if (!mathScopeOpen) return;

  const totalCells = WIDTH * HEIGHT;
  let pCount = 0, hCount = 0, cCount = 0, bCount = 0, activePulses = 0;
  let totalNutrients = 0, totalDetritus = 0, memoryNodes = 0;

  for (let x = 0; x < WIDTH; x++) {
    for (let y = 0; y < HEIGHT; y++) {
      totalNutrients += soilNutrients[x][y];
      totalDetritus += detritusField[x][y];
      if (substrateMemory[x][y] > 1.0) memoryNodes++;
    }
  }

  for (const e of entities) {
    if (e.type === "plant") {
      pCount++;
      if ((e.pulse || 0) > 0.05) activePulses++;
    } else if (e.type === "herbivore") hCount++;
    else if (e.type === "carnivore") cCount++;
    else if (e.type === "benthic") bCount++;
  }

  const totalPop = pCount + hCount + cCount + bCount;
  let entropy = 0;
  if (totalPop > 0) {
    const counts = [pCount, hCount, cCount, bCount].filter(c => c > 0);
    for (const c of counts) {
      const prob = c / totalPop;
      entropy -= prob * Math.log2(prob);
    }
  }

  const entropyPct = Math.min(100, (entropy / 2.0) * 100);
  const pulsePct = pCount > 0 ? Math.min(100, (activePulses / pCount) * 100) : 0;

  let stabilityState = "Equilibrium";
  let stabilityPct = 50;
  if (pCount > 500) {
    stabilityState = "Canopy Overgrowth";
    stabilityPct = 85;
  } else if (hCount > 70) {
    stabilityState = "Overgrazing Surge";
    stabilityPct = 75;
  } else if (cCount > 15) {
    stabilityState = "Apex Predation Peak";
    stabilityPct = 30;
  } else if (pCount < 40) {
    stabilityState = "Ecosystem Stress";
    stabilityPct = 15;
  }

  const entropyEl = document.getElementById("scopeEntropy");
  const barEntropyEl = document.getElementById("barEntropy");
  const actEl = document.getElementById("scopeActivity");
  const barActEl = document.getElementById("barActivity");
  const stabEl = document.getElementById("scopeStability");
  const barStabEl = document.getElementById("barStability");
  const memEl = document.getElementById("scopeMemory");
  const barMemEl = document.getElementById("barMemory");
  const bioEl = document.getElementById("scopeBiomass");
  const barBioEl = document.getElementById("barBioEl");

  if (entropyEl) entropyEl.textContent = `${entropy.toFixed(3)} bits`;
  if (barEntropyEl) barEntropyEl.style.width = `${entropyPct}%`;

  if (actEl) actEl.textContent = `${pulsePct.toFixed(1)}%`;
  if (barActEl) barActEl.style.width = `${pulsePct}%`;

  if (stabEl) stabEl.textContent = stabilityState;
  if (barStabEl) barStabEl.style.width = `${stabilityPct}%`;

  if (memEl) memEl.textContent = `${memoryNodes} Nodes`;
  if (barMemEl) barMemEl.style.width = `${Math.min(100, (memoryNodes / (totalCells * 0.4)) * 100)}%`;

  if (bioEl) bioEl.textContent = `${Math.round(totalNutrients)} / ${Math.round(totalDetritus)}`;
  if (barBioEl) barBioEl.style.width = `${Math.min(100, (totalNutrients / (totalCells * 3)) * 100)}%`;
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
    else if (e.type === "benthic") updateBenthic(e);
  }

  environmentalBalance();
  cleanupDead();

  if (tick % 4 === 0) {
    recordTimeSeries();
  }

  if (tick % 10 === 0) {
    updateMathScopeDiagnostics();
  }

  if (tick % EPOCH_EVERY === 0) {
    epoch++;
    updateEpochBadge();
    logEpoch();
  }
}

// ---------- Chronicle Logging ----------
const terminal = document.getElementById("logTerminal");
const epochBadge = document.getElementById("epochBadge");

function updateEpochBadge() {
  if (epochBadge) epochBadge.textContent = `Epoch ${epoch}`;
}

function clearLog() {
  if (terminal) terminal.innerHTML = "";
}

function logLine(text, type = "normal") {
  if (!terminal) return;
  const line = document.createElement("div");
  line.className = `log-line ${type}`;
  line.textContent = `[T+${tick}] ${text}`;
  terminal.appendChild(line);
  terminal.scrollTop = terminal.scrollHeight;

  while (terminal.children.length > 50) {
    terminal.removeChild(terminal.firstChild);
  }
}

function logEpoch() {
  const plants = entities.filter((e) => e.type === "plant");
  const herbs = entities.filter((e) => e.type === "herbivore");
  const carns = entities.filter((e) => e.type === "carnivore");
  const benth = entities.filter((e) => e.type === "benthic");

  const pCount = plants.length;
  const hCount = herbs.length;
  const cCount = carns.length;
  const bCount = benth.length;

  epochHistory.push({ epoch, pCount, hCount, cCount, bCount });
  if (epochHistory.length > 20) epochHistory.shift();

  logLine(
    `📜 Epoch ${epoch} Summary — Flora: ${pCount} | Grazers: ${hCount} | Apex: ${cCount} | Benthic: ${bCount}`,
    "epoch"
  );

  if (epochHistory.length >= 2) {
    const recent = epochHistory.slice(-2);
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
const gCtx = graphCanvas.getContext("2d");

function resizeGraph() {
  const rect = graphCanvas.getBoundingClientRect();
  graphCanvas.width = rect.width * window.devicePixelRatio;
  graphCanvas.height = 60 * window.devicePixelRatio;
}
window.addEventListener("resize", resizeGraph);

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
    }
  } else if (activeTool === "predator") {
    const emptyPos = findNearestEmptyCell(gridX, gridY);
    if (emptyPos) {
      const [ex, ey] = emptyPos;
      const c = createCarnivore(ex, ey);
      grid[ex][ey] = c;
      entities.push(c);
      logLine(`🔴 Hand of the Steward: Summoned apex predator near (${ex}, ${ey}).`, "event");
    }
  } else if (activeTool === "benthic") {
    const emptyPos = findNearestEmptyCell(gridX, gridY);
    if (emptyPos) {
      const [ex, ey] = emptyPos;
      const b = createBenthic(ex, ey);
      grid[ex][ey] = b;
      entities.push(b);
      logLine(`🟣 Hand of the Steward: Released benthic crab near (${ex}, ${ey}).`, "event");
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

// Setup tool buttons
document.querySelectorAll(".tool-btn").forEach((btn) => {
  btn.addEventListener("click", () => {
    document.querySelectorAll(".tool-btn").forEach((b) => b.classList.remove("active"));
    btn.classList.add("active");
    activeTool = btn.getAttribute("data-tool");
    const activeLabel = document.getElementById("activeToolName");
    if (activeLabel) {
      activeLabel.textContent = btn.textContent.replace(/^[^\\s]+\\s*/, "").trim();
    }
  });
});

// Audio Toggle Button
const audioToggleBtn = document.getElementById("audioToggleBtn");
const audioIcon = document.getElementById("audioIcon");
const audioLabel = document.getElementById("audioLabel");

if (audioToggleBtn) {
  audioToggleBtn.addEventListener("click", () => {
    initAudioEngine();
    if (audioCtx && audioCtx.state === "suspended") {
      audioCtx.resume();
    }
    audioEnabled = !audioEnabled;
    audioToggleBtn.classList.toggle("active", audioEnabled);
    if (audioIcon) audioIcon.textContent = audioEnabled ? "🔊" : "🔇";
    if (audioLabel) audioLabel.textContent = audioEnabled ? "AUDIO ON" : "AUDIO OFF";

    if (masterGain) {
      masterGain.gain.setValueAtTime(audioEnabled ? 0.35 : 0.0, audioCtx.currentTime);
    }
  });
}

// Math Scope toggle button
const mathScopeBtn = document.getElementById("mathScopeBtn");
const mathScopePanel = document.getElementById("mathScopePanel");

if (mathScopeBtn && mathScopePanel) {
  mathScopeBtn.addEventListener("click", () => {
    mathScopeOpen = !mathScopeOpen;
    mathScopeBtn.classList.toggle("active", mathScopeOpen);
    mathScopePanel.classList.toggle("open", mathScopeOpen);
    if (mathScopeOpen) {
      updateMathScopeDiagnostics();
    }
  });
}

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

function renderWorld() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  for (let x = 0; x < WIDTH; x++) {
    for (let y = 0; y < HEIGHT; y++) {
      const px = x * CELL_SIZE;
      const py = y * CELL_SIZE;

      const nut = Math.min(10.0, soilNutrients[x][y]);
      const det = Math.min(10.0, detritusField[x][y]);
      const mem = Math.min(10.0, substrateMemory[x][y]);

      const bgR = Math.min(48, Math.round(12 + det * 3.2 + mem * 1.2));
      const bgG = Math.min(52, Math.round(16 + nut * 3.4));
      const bgB = Math.min(75, Math.round(26 + det * 2.0 + mem * 3.5));

      ctx.fillStyle = `rgb(${bgR}, ${bgG}, ${bgB})`;
      ctx.fillRect(px, py, CELL_SIZE, CELL_SIZE);

      // Substrate memory bio-channel glowing borders
      if (mem > 1.2) {
        ctx.strokeStyle = `rgba(168, 85, 247, ${Math.min(0.4, mem * 0.045)})`;
        ctx.lineWidth = 1;
        ctx.strokeRect(px + 0.5, py + 0.5, CELL_SIZE - 1, CELL_SIZE - 1);
      } else {
        ctx.strokeStyle = "rgba(255, 255, 255, 0.02)";
        ctx.strokeRect(px, py, CELL_SIZE, CELL_SIZE);
      }

      const e = grid[x][y];
      if (!e) continue;

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
        ctx.fillStyle = `hsl(${hue}, 92%, 52%)`;
        ctx.fillRect(px + 2, py + 2, CELL_SIZE - 4, CELL_SIZE - 4);
      } else if (e.type === "carnivore") {
        ctx.fillStyle = "#f43f5e";
        ctx.fillRect(px + 1.5, py + 1.5, CELL_SIZE - 3, CELL_SIZE - 3);
      } else if (e.type === "benthic") {
        ctx.fillStyle = "#a855f7";
        ctx.fillRect(px + 2.5, py + 2.5, CELL_SIZE - 5, CELL_SIZE - 5);
      }
    }
  }

  renderSynapticFilaments();
  renderSynapticSparks();

  for (let i = activeRipples.length - 1; i >= 0; i--) {
    const r = activeRipples[i];
    ctx.beginPath();
    ctx.arc(r.x, r.y, r.radius, 0, Math.PI * 2);

    let rippleColor = "rgba(56, 189, 248, ";
    if (r.tool === "grazer") rippleColor = "rgba(249, 115, 22, ";
    else if (r.tool === "predator") rippleColor = "rgba(244, 63, 94, ";
    else if (r.tool === "benthic") rippleColor = "rgba(168, 85, 247, ";
    else if (r.tool === "nutrient") rippleColor = "rgba(234, 179, 8, ";

    ctx.strokeStyle = `${rippleColor}${r.alpha})`;
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
  const w = graphCanvas.width;
  const h = graphCanvas.height;
  if (w === 0 || h === 0 || timeSeriesHistory.length === 0) return;

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
    if (pt.c * 2.5 > maxVal) maxVal = pt.c * 2.5;
    if (pt.b * 2.5 > maxVal) maxVal = pt.b * 2.5;
  }

  const stepX = w / Math.max(MAX_GRAPH_POINTS - 1, 1);
  const startIdx = MAX_GRAPH_POINTS - timeSeriesHistory.length;

  function drawSeries(key, color, scale = 1.0) {
    gCtx.strokeStyle = color;
    gCtx.lineWidth = 1.6;
    gCtx.beginPath();

    for (let i = 0; i < timeSeriesHistory.length; i++) {
      const x = (startIdx + i) * stepX;
      const val = timeSeriesHistory[i][key] * scale;
      const y = h - (val / maxVal) * (h - 6) - 3;
      if (i === 0) gCtx.moveTo(x, y);
      else gCtx.lineTo(x, y);
    }
    gCtx.stroke();
  }

  drawSeries("p", "#22c55e", 1.0);
  drawSeries("h", "#f97316", 1.0);
  drawSeries("c", "#f43f5e", 2.5);
  drawSeries("b", "#a855f7", 2.5);
}

// ---------- Simulation Lifecycle ----------
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

  requestAnimationFrame(loop);
}

// Boot
resizeGraph();
initWorld();
requestAnimationFrame(loop);