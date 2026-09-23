// main.js — Synapse Reef v2.0 (Bioluminescent Neural Pulses)

const canvas = document.getElementById('reefCanvas');
const ctx = canvas.getContext('2d');

// Configuration
const CONFIG = {
    GRID_W: 120,
    GRID_H: 80,
    CELL_SIZE: 6,
    INITIAL_PLANTS: 600,
    INITIAL_GRAZERS: 25,
    INITIAL_APEX: 3,
    PLANT_GROWTH_CHANCE: 0.018,
    PLANT_SPREAD_RANGE: 2,
    GRAZER_ENERGY_GAIN: 35,
    GRAZER_MOVE_CHANCE: 0.22,
    GRAZER_REPRODUCE_CHANCE: 0.012,
    APEX_ENERGY_GAIN: 55,
    APEX_MOVE_CHANCE: 0.35,
    APEX_REPRODUCE_CHANCE: 0.008,
    APEX_PREDATION_RANGE: 2,
    NEURAL_PULSE_DECAY: 0.88,
    NEURAL_PULSE_THRESHOLD: 0.25,
    NEURAL_PULSE_SPREAD_CHANCE: 0.72
};

let grid = [];
let grazers = [];
let apexPredators = [];
let epoch = 0;
let chronicle = [];
let climateState = 'stable';
let climateTimer = 0;

// Initialize grid
function initGrid() {
    grid = [];
    for (let y = 0; y < CONFIG.GRID_H; y++) {
        const row = [];
        for (let x = 0; x < CONFIG.GRID_W; x++) {
            row.push({
                type: 'water',
                age: 0,
                genome: { r: 0, g: 0, b: 0, complexity: 0 },
                voltage: 0 // NEW: neural membrane potential
            });
        }
        grid.push(row);
    }
}

// Seed initial brain-coral reef
function seedReef() {
    for (let i = 0; i < CONFIG.INITIAL_PLANTS; i++) {
        const x = Math.floor(Math.random() * CONFIG.GRID_W);
        const y = Math.floor(Math.random() * CONFIG.GRID_H);
        if (grid[y][x].type === 'water') {
            const hue = 140 + Math.random() * 40;
            grid[y][x] = {
                type: 'plant',
                age: 0,
                genome: {
                    r: Math.floor(50 + Math.random() * 80),
                    g: Math.floor(150 + Math.random() * 80),
                    b: Math.floor(50 + Math.random() * 60),
                    complexity: Math.random()
                },
                voltage: 0
            };
        }
    }
    for (let i = 0; i < CONFIG.INITIAL_GRAZERS; i++) {
        grazers.push({
            x: Math.floor(Math.random() * CONFIG.GRID_W),
            y: Math.floor(Math.random() * CONFIG.GRID_H),
            energy: 100,
            genome: { speed: 0.5 + Math.random() * 0.5, efficiency: 0.6 + Math.random() * 0.3 },
            age: 0
        });
    }
    for (let i = 0; i < CONFIG.INITIAL_APEX; i++) {
        apexPredators.push({
            x: Math.floor(Math.random() * CONFIG.GRID_W),
            y: Math.floor(Math.random() * CONFIG.GRID_H),
            energy: 100,
            genome: { speed: 0.7 + Math.random() * 0.3, efficiency: 0.7 + Math.random() * 0.25 },
            age: 0
        });
    }
}

// NEW: Propagate neural pulse through coral network
function propagateNeuralPulse(x, y, strength = 1.0) {
    if (x < 0 || x >= CONFIG.GRID_W || y < 0 || y >= CONFIG.GRID_H) return;
    const cell = grid[y][x];
    if (cell.type !== 'plant') return;
    
    // Boost voltage
    cell.voltage = Math.min(1.0, cell.voltage + strength);
    
    // Spread to neighbors with decay
    if (strength > CONFIG.NEURAL_PULSE_THRESHOLD && Math.random() < CONFIG.NEURAL_PULSE_SPREAD_CHANCE) {
        const neighbors = [
            { dx: -1, dy: 0 }, { dx: 1, dy: 0 },
            { dx: 0, dy: -1 }, { dx: 0, dy: 1 }
        ];
        for (const n of neighbors) {
            const nx = x + n.dx;
            const ny = y + n.dy;
            if (nx >= 0 && nx < CONFIG.GRID_W && ny >= 0 && ny < CONFIG.GRID_H) {
                if (grid[ny][nx].type === 'plant' && grid[ny][nx].voltage < 0.15) {
                    propagateNeuralPulse(nx, ny, strength * CONFIG.NEURAL_PULSE_DECAY);
                }
            }
        }
    }
}

// Decay all neural voltages each tick
function decayNeuralVoltages() {
    for (let y = 0; y < CONFIG.GRID_H; y++) {
        for (let x = 0; x < CONFIG.GRID_W; x++) {
            if (grid[y][x].type === 'plant') {
                grid[y][x].voltage *= 0.85; // Fast decay for visible pulse effect
                if (grid[y][x].voltage < 0.02) grid[y][x].voltage = 0;
            }
        }
    }
}

// Trigger pulse from grazing event
function grazerEatsPlant(grazer, plantX, plantY) {
    grid[plantY][plantX].type = 'water';
    grazers.push({
        x: plantX,
        y: plantY,
        energy: 100,
        genome: { ...grazer.genome },
        age: 0
    });
    // NEW: Trigger neural pulse wave from grazing
    propagateNeuralPulse(plantX, plantY, 0.95);
}

// Apex predator creates massive shockwave
function apexCreatesShockwave(x, y) {
    const radius = 8 + Math.floor(Math.random() * 6);
    for (let dy = -radius; dy <= radius; dy++) {
        for (let dx = -radius; dx <= radius; dx++) {
            const dist = Math.sqrt(dx*dx + dy*dy);
            if (dist <= radius) {
                const nx = x + dx;
                const ny = y + dy;
                if (nx >= 0 && nx < CONFIG.GRID_W && ny >= 0 && ny < CONFIG.GRID_H) {
                    const strength = (1 - dist / radius) * 0.85;
                    propagateNeuralPulse(nx, ny, strength);
                }
            }
        }
    }
}

// Update plant growth with Turing-like pattern bias
function updatePlants() {
    for (let y = 0; y < CONFIG.GRID_H; y++) {
        for (let x = 0; x < CONFIG.GRID_W; x++) {
            const cell = grid[y][x];
            if (cell.type === 'plant') {
                cell.age++;
                if (Math.random() < CONFIG.PLANT_GROWTH_CHANCE) {
                    const spread = Math.floor(Math.random() * CONFIG.PLANT_SPREAD_RANGE) + 1;
                    for (let i = 0; i < spread; i++) {
                        const nx = x + Math.floor(Math.random() * 3) - 1;
                        const ny = y + Math.floor(Math.random() * 3) - 1;
                        if (nx >= 0 && nx < CONFIG.GRID_W && ny >= 0 && ny < CONFIG.GRID_H) {
                            if (grid[ny][nx].type === 'water') {
                                const hueShift = (cell.genome.r + cell.genome.g + cell.genome.b) / 3;
                                grid[ny][nx] = {
                                    type: 'plant',
                                    age: 0,
                                    genome: {
                                        r: Math.max(0, Math.min(255, cell.genome.r + (Math.random() - 0.5) * 40)),
                                        g: Math.max(0, Math.min(255, cell.genome.g + (Math.random() - 0.5) * 40)),
                                        b: Math.max(0, Math.min(255, cell.genome.b + (Math.random() - 0.5) * 40)),
                                        complexity: cell.genome.complexity + (Math.random() - 0.5) * 0.15
                                    },
                                    voltage: 0
                                };
                            }
                        }
                    }
                }
            }
        }
    }
}

// Update grazers
function updateGrazers() {
    for (let i = grazers.length - 1; i >= 0; i--) {
        const g = grazers[i];
        g.energy -= 1.2;
        g.age++;
        if (g.energy <= 0 || g.age > 800) {
            grazers.splice(i, 1);
            continue;
        }
        if (Math.random() < CONFIG.GRAZER_MOVE_CHANCE) {
            const nx = g.x + Math.floor(Math.random() * 3) - 1;
            const ny = g.y + Math.floor(Math.random() * 3) - 1;
            if (nx >= 0 && nx < CONFIG.GRID_W && ny >= 0 && ny < CONFIG.GRID_H) {
                if (grid[ny][nx].type === 'plant') {
                    grazerEatsPlant(g, nx, ny);
                    g.x = nx;
                    g.y = ny;
                    g.energy += CONFIG.GRAZER_ENERGY_GAIN;
                } else {
                    g.x = nx;
                    g.y = ny;
                }
            }
        }
        if (g.energy > 160 && Math.random() < CONFIG.GRAZER_REPRODUCE_CHANCE) {
            grazers.push({
                x: g.x,
                y: g.y,
                energy: 70,
                genome: {
                    speed: g.genome.speed + (Math.random() - 0.5) * 0.12,
                    efficiency: g.genome.efficiency + (Math.random() - 0.5) * 0.08
                },
                age: 0
            });
            g.energy -= 50;
        }
    }
}

// Update apex predators
function updateApex() {
    for (let i = apexPredators.length - 1; i >= 0; i--) {
        const a = apexPredators[i];
        a.energy -= 2.5;
        a.age++;
        if (a.energy <= 0 || a.age > 1200) {
            apexPredators.splice(i, 1);
            continue;
        }
        if (Math.random() < CONFIG.APEX_MOVE_CHANCE) {
            let target = null;
            let minDist = Infinity;
            for (const g of grazers) {
                const dist = Math.hypot(g.x - a.x, g.y - a.y);
                if (dist < minDist && dist < 12) {
                    minDist = dist;
                    target = g;
                }
            }
            if (target) {
                const dx = Math.sign(target.x - a.x);
                const dy = Math.sign(target.y - a.y);
                const nx = a.x + dx;
                const ny = a.y + dy;
                if (nx >= 0 && nx < CONFIG.GRID_W && ny >= 0 && ny < CONFIG.GRID_H) {
                    a.x = nx;
                    a.y = ny;
                    if (Math.abs(target.x - a.x) <= 1 && Math.abs(target.y - a.y) <= 1) {
                        const idx = grazers.indexOf(target);
                        if (idx !== -1) {
                            grazers.splice(idx, 1);
                            a.energy += CONFIG.APEX_ENERGY_GAIN;
                            // NEW: Apex predation triggers massive neural shockwave
                            apexCreatesShockwave(a.x, a.y);
                        }
                    }
                }
            } else {
                const nx = a.x + Math.floor(Math.random() * 5) - 2;
                const ny = a.y + Math.floor(Math.random() * 5) - 2;
                if (nx >= 0 && nx < CONFIG.GRID_W && ny >= 0 && ny < CONFIG.GRID_H) {
                    a.x = nx;
                    a.y = ny;
                }
            }
        }
        if (a.energy > 180 && Math.random() < CONFIG.APEX_REPRODUCE_CHANCE) {
            apexPredators.push({
                x: a.x,
                y: a.y,
                energy: 90,
                genome: {
                    speed: a.genome.speed + (Math.random() - 0.5) * 0.1,
                    efficiency: a.genome.efficiency + (Math.random() - 0.5) * 0.06
                },
                age: 0
            });
            a.energy -= 70;
        }
    }
}

// Climate cycle
function updateClimate() {
    climateTimer++;
    if (climateTimer > 800 + Math.random() * 600) {
        climateTimer = 0;
        const states = ['stable', 'drought', 'bloom', 'stress'];
        const prevState = climateState;
        climateState = states[Math.floor(Math.random() * states.length)];
        if (climateState !== prevState) {
            chronicle.push({
                epoch: epoch,
                event: `Climate shifted to ${climateState}`,
                plantCount: grid.flat().filter(c => c.type === 'plant').length,
                grazerCount: grazers.length,
                apexCount: apexPredators.length
            });
            if (chronicle.length > 50) chronicle.shift();
        }
    }
}

// Render with bioluminescent pulses
function render() {
    ctx.fillStyle = '#001122';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    for (let y = 0; y < CONFIG.GRID_H; y++) {
        for (let x = 0; x < CONFIG.GRID_W; x++) {
            const cell = grid[y][x];
            if (cell.type === 'plant') {
                const baseR = cell.genome.r;
                const baseG = cell.genome.g;
                const baseB = cell.genome.b;
                
                // NEW: Add bioluminescent glow based on voltage
                const glowIntensity = cell.voltage;
                const glowR = Math.floor(baseR * (1 - glowIntensity) + 0 * glowIntensity);
                const glowG = Math.floor(baseG * (1 - glowIntensity) + 220 * glowIntensity);
                const glowB = Math.floor(baseB * (1 - glowIntensity) + 255 * glowIntensity);
                
                ctx.fillStyle = `rgb(${glowR},${glowG},${glowB})`;
                ctx.fillRect(x * CONFIG.CELL_SIZE, y * CONFIG.CELL_SIZE, CONFIG.CELL_SIZE - 1, CONFIG.CELL_SIZE - 1);
            }
        }
    }
    
    for (const g of grazers) {
        ctx.fillStyle = '#ffaa00';
        ctx.beginPath();
        ctx.arc(g.x * CONFIG.CELL_SIZE + CONFIG.CELL_SIZE/2, g.y * CONFIG.CELL_SIZE + CONFIG.CELL_SIZE/2, CONFIG.CELL_SIZE/2 + 1, 0, Math.PI * 2);
        ctx.fill();
    }
    
    for (const a of apexPredators) {
        ctx.fillStyle = '#ff3366';
        ctx.beginPath();
        ctx.arc(a.x * CONFIG.CELL_SIZE + CONFIG.CELL_SIZE/2, a.y * CONFIG.CELL_SIZE + CONFIG.CELL_SIZE/2, CONFIG.CELL_SIZE/2 + 2, 0, Math.PI * 2);
        ctx.fill();
    }
    
    // HUD
    ctx.fillStyle = 'rgba(0, 0, 0, 0.65)';
    ctx.fillRect(10, 10, 260, 145);
    ctx.fillStyle = '#ffffff';
    ctx.font = '13px monospace';
    ctx.fillText(`Epoch: ${epoch}`, 20, 32);
    ctx.fillText(`Plants: ${grid.flat().filter(c => c.type === 'plant').length}`, 20, 52);
    ctx.fillText(`Grazers: ${grazers.length}`, 20, 72);
    ctx.fillText(`Apex: ${apexPredators.length}`, 20, 92);
    ctx.fillText(`Climate: ${climateState}`, 20, 112);
    ctx.fillText(`Neural Pulses: ACTIVE`, 20, 135);
    
    // Chronicle
    ctx.fillStyle = 'rgba(0, 0, 0, 0.55)';
    ctx.fillRect(10, canvas.height - 160, 260, 150);
    ctx.fillStyle = '#aaaaaa';
    ctx.font = '11px monospace';
    chronicle.slice(-6).forEach((entry, i) => {
        ctx.fillText(`E${entry.epoch}: ${entry.event}`, 20, canvas.height - 140 + i * 20);
    });
}

// Main loop
function loop() {
    updatePlants();
    updateGrazers();
    updateApex();
    updateClimate();
    decayNeuralVoltages();
    render();
    epoch++;
    requestAnimationFrame(loop);
}

// Click interactions
canvas.addEventListener('click', (e) => {
    const rect = canvas.getBoundingClientRect();
    const x = Math.floor((e.clientX - rect.left) / CONFIG.CELL_SIZE);
    const y = Math.floor((e.clientY - rect.top) / CONFIG.CELL_SIZE);
    if (x >= 0 && x < CONFIG.GRID_W && y >= 0 && y < CONFIG.GRID_H) {
        if (grid[y][x].type === 'water') {
            const hue = 140 + Math.random() * 40;
            grid[y][x] = {
                type: 'plant',
                age: 0,
                genome: {
                    r: Math.floor(50 + Math.random() * 80),
                    g: Math.floor(150 + Math.random() * 80),
                    b: Math.floor(50 + Math.random() * 60),
                    complexity: Math.random()
                },
                voltage: 0.85 // NEW: Fresh plantings start with a pulse
            };
        } else if (grid[y][x].type === 'plant') {
            // NEW: Tap existing plant to trigger manual neural pulse
            propagateNeuralPulse(x, y, 1.0);
        }
    }
});

// Start
canvas.width = CONFIG.GRID_W * CONFIG.CELL_SIZE;
canvas.height = CONFIG.GRID_H * CONFIG.CELL_SIZE;
initGrid();
seedReef();
loop();
