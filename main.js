// Integration patch: call SynapseAudioSafety.createAudioSafetyBus(audioContext)
// immediately after creating the existing AudioContext, then route every existing
// source/master node through SynapseAudioSafety.connectSource(sourceNode).
// In the simulation update loop, call:
// SynapseAudioSafety.setBloomPressure(Math.min(1, (activePredictors + activeBioluminescent) / 80));
// and update the UI from SynapseAudioSafety.getStatus().
(function () {
  function initSynapseAudioSafety(audioContext) {
    if (!window.SynapseAudioSafety || !audioContext) return null;
    return window.SynapseAudioSafety.createAudioSafetyBus(audioContext);
  }

  function routeSynapseSource(sourceNode) {
    if (!window.SynapseAudioSafety || !sourceNode) return sourceNode;
    return window.SynapseAudioSafety.connectSource(sourceNode);
  }

  function updateSynapseBloomProtection(activePredictors, activeBioluminescent) {
    if (!window.SynapseAudioSafety) return null;
    const predictorLoad = Number(activePredictors) || 0;
    const bioluminescentLoad = Number(activeBioluminescent) || 0;
    const pressure = Math.min(1, (predictorLoad + bioluminescentLoad) / 80);
    window.SynapseAudioSafety.setBloomPressure(pressure);
    return window.SynapseAudioSafety.getStatus();
  }

  window.SynapseReefAudio = {
    initSynapseAudioSafety,
    routeSynapseSource,
    updateSynapseBloomProtection
  };
})();
