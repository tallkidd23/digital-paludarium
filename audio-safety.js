// Synapse Reef — defensive master audio bus.
// Keeps the simulation untouched while preventing additive bloom events
// from producing dangerous output spikes or hard clipping.
(function () {
  const state = {
    context: null,
    input: null,
    userGain: null,
    limiter: null,
    analyser: null,
    output: null,
    safetyDb: -6,
    ceilingDb: -3,
    ducking: 0,
    peak: 0,
    enabled: true,
    lastPeakAt: 0
  };

  const dbToGain = db => Math.pow(10, db / 20);
  const clamp = (n, min, max) => Math.min(max, Math.max(min, n));

  function createAudioSafetyBus(audioContext) {
    if (!audioContext || state.context) return state;
    state.context = audioContext;
    state.input = audioContext.createGain();
    state.userGain = audioContext.createGain();
    state.limiter = audioContext.createDynamicsCompressor();
    state.analyser = audioContext.createAnalyser();
    state.output = audioContext.createGain();

    state.userGain.gain.value = 0.7;
    state.limiter.threshold.value = -10;
    state.limiter.knee.value = 20;
    state.limiter.ratio.value = 20;
    state.limiter.attack.value = 0.003;
    state.limiter.release.value = 0.12;
    state.output.gain.value = dbToGain(state.ceilingDb);
    state.analyser.fftSize = 1024;
    state.analyser.smoothingTimeConstant = 0.8;

    state.input.connect(state.userGain).connect(state.limiter).connect(state.analyser).connect(state.output).connect(audioContext.destination);
    return state;
  }

  function connectSource(sourceNode) {
    if (!state.input) throw new Error("Audio safety bus must be created before connecting a source.");
    sourceNode.connect(state.input);
    return state.input;
  }

  function setMasterVolume(value) {
    if (!state.userGain || !state.context) return;
    const target = clamp(Number(value) || 0, 0, 1);
    state.userGain.gain.setTargetAtTime(target, state.context.currentTime, 0.03);
  }

  function setEnabled(enabled) {
    state.enabled = Boolean(enabled);
    if (!state.userGain || !state.context) return;
    const target = state.enabled ? 1 : 0;
    state.userGain.gain.setTargetAtTime(target * 0.7, state.context.currentTime, 0.04);
  }

  function setBloomPressure(pressure) {
    if (!state.userGain || !state.context) return;
    const p = clamp(Number(pressure) || 0, 0, 1);
    // Gentle program-dependent ducking. The limiter remains the final defense.
    const target = 0.7 * (1 - p * 0.55);
    state.ducking = p;
    state.userGain.gain.setTargetAtTime(target, state.context.currentTime, 0.08);
  }

  function readPeak() {
    if (!state.analyser) return state.peak;
    const buffer = new Float32Array(state.analyser.fftSize);
    state.analyser.getFloatTimeDomainData(buffer);
    let peak = 0;
    for (const sample of buffer) peak = Math.max(peak, Math.abs(sample));
    state.peak = peak;
    if (peak >= 0.98) state.lastPeakAt = performance.now();
    return peak;
  }

  function getStatus() {
    const peak = readPeak();
    return {
      enabled: state.enabled,
      peak,
      peakDb: peak > 0 ? 20 * Math.log10(peak) : -Infinity,
      ducking: state.ducking,
      limiterReduction: state.limiter ? state.limiter.reduction : 0,
      hardCeilingDb: state.ceilingDb,
      recentClipRisk: performance.now() - state.lastPeakAt < 1000
    };
  }

  window.SynapseAudioSafety = {
    createAudioSafetyBus,
    connectSource,
    setMasterVolume,
    setEnabled,
    setBloomPressure,
    readPeak,
    getStatus,
    state
  };
})();
