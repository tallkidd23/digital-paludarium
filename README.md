# Digital Paludarium

A minimal emergent life sim — plants, herbivores, evolution, bioluminescence, and self-chronicling.

## Audio safety patch

The simulation remains fully active during predictor and bioluminescence blooms. Audio now has a defensive master bus available through `audio-safety.js`:

- Smooth master gain control.
- Program-dependent ducking during high-density bloom events.
- A DynamicsCompressorNode configured as a final limiter.
- Analyser-based peak monitoring.
- A conservative output ceiling before the browser audio destination.

The limiter is not a guarantee against every hardware or operating-system problem, so users should still begin at a low system volume. The patch is designed to prevent additive in-app event spikes without slowing or simplifying the underlying ecological calculations.

If the existing audio engine creates an `AudioContext`, initialize the bus with:

```js
SynapseAudioSafety.createAudioSafetyBus(audioContext);
sourceNode.disconnect();
SynapseAudioSafety.connectSource(sourceNode);
```

During simulation updates, pass a normalized bloom pressure from `0` to `1`:

```js
SynapseAudioSafety.setBloomPressure(Math.min(1, activePredictors / 80));
```

The Web Audio API provides modular audio routing, GainNode volume control, AnalyserNode monitoring, and DynamicsCompressorNode peak reduction for this architecture. Always start playback at a conservative system volume.

## License

CC0 1.0 Universal.
