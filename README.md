# Synapse Reef 🪸🧠

> **Live Simulation:** [synapsereef.tallkidd.com](https://synapsereef.tallkidd.com)  
> *An open-source, zero-dependency browser experiment in artificial life, self-organizing geometry, and trophic emergence.*

---

## 🌊 Overview

**Synapse Reef** is a digital paludarium where complex macroscopic patterns emerge from purely local, decentralized biological rules. 

Rather than scripting shapes or animation paths, the ecosystem models low-level cellular interactions—canopy competition, satiation-gated grazing, heritable genetic variation, and closed-loop soil decomposition. Over thousands of ticks, the grid self-organizes into organic dendritic labyrinths that mirror the branching sulci of the human cortex and the calcified ridges of marine **brain coral**.

---

## 🧬 Core Emergent Mechanics

### 1. Brain Coral Geometry (Canopy Shading)
Plants absorb light and soil minerals to reproduce into adjacent cells. However, when surrounded by dense clusters, mutual canopy shading imposes an energy penalty. This negative feedback prevents runaway solid monocultures and forces vegetation to grow along its perimeter, generating winding, serpentine reef patterns.

### 2. Satiation-Gated Predation & Wave Dynamics
Herbivorous grazers use olfactory scanning to detect and navigate toward vegetation. Instead of instantaneous wipeouts, grazers consume foliage in measured bites based on stomach capacity (`maxSatiation`) and heritable `biteEfficiency`, allowing plant root systems to persist and producing sweeping, rhythmic grazing fronts.

### 3. Closed-Loop Substrate Memory
When organisms die, their biomass settles as organic detritus. Over time, microbial decomposition breaks this detritus down into fertile soil minerals. These rich compost patches persist long after populations migrate, creating an environmental memory that dictates where the next generation of spores will flourish.

### 4. Genetic Lineage Adaptation
Offspring inherit parent genomes with a mutation rate, allowing lineages to specialize over epochs:
- **Foliage:** Shifts between deep emerald and vibrant lime based on photosynthetic vitality.
- **Grazers:** Specialization in long-range scent tracking or efficient root grazing expresses along a dynamic amber-to-crimson spectrum.

### 5. Self-Chronicling Observer
The built-in Chronicle engine analyzes multi-epoch rolling population trends, autonomously detecting and recording macroscopic state shifts:
- `⚖️ Dynamic Equilibrium`
- `🌊 Grazing Fronts`
- `🌾 Canopy Rebounds`
- `⚡ Predator Wave Pulses`

---

## 🛠️ Architecture & Setup

Synapse Reef is built with vanilla HTML5, Canvas, and pure modern JavaScript—no libraries, no build tools, no frameworks.

```bash
git clone https://github.com/tallkidd23/digital-paludarium.git
cd digital-paludarium
# Open index.html in any modern browser
open index.html
```

---

## 🌐 Open-Source & Community Use

This project is created to be freely studied, forked, modified, and used for educational explorations into systems thinking, biology, and emergence. 

Feel free to customize rule sets, introduce new trophic layers, or build your own digital ecosystems.
