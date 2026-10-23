// Reproducción de audio por track: disparo de samples (pads) y notas de sintetizador.
const Tracks = (() => {
  const chokeActive = {}; // chokeGroup -> {source, gainNode}

  function ensureNodes(track) {
    if (!track.nodes) {
      track.nodes = AudioEngine.buildChannel(track.fx);
      AudioEngine.setVolPan(track.nodes, trackEffectiveVolume(track), track.pan);
    }
    return track.nodes;
  }

  function trackEffectiveVolume(track) {
    const proj = State.project;
    const anySolo = proj.tracks.some(t => t.solo);
    const liveMute = proj.mutes[track.id];
    const muted = track.mute || liveMute || (anySolo && !track.solo);
    return muted ? 0 : track.volume;
  }

  function refreshAllVolumes() {
    State.project.tracks.forEach(t => {
      if (t.nodes) AudioEngine.setVolPan(t.nodes, trackEffectiveVolume(t), t.pan);
    });
  }

  function updateFx(track) {
    ensureNodes(track);
    AudioEngine.applyFx(track.nodes, track.fx);
  }

  function playPad(track, time, velocity = 1, durationOverride = null) {
    if (!track.sample || !track.sample.buffer) return;
    const ctx = AudioEngine.context;
    const nodes = ensureNodes(track);
    const src = ctx.createBufferSource();
    src.buffer = track.sample.buffer;
    src.playbackRate.value = track.sample.playbackRate || 1;
    const gain = ctx.createGain();
    gain.gain.value = velocity;
    src.connect(gain);
    gain.connect(nodes.input);

    const start = track.sample.trimStart || 0;
    const end = track.sample.trimEnd != null ? track.sample.trimEnd : track.sample.buffer.duration;
    const dur = durationOverride || (end - start);

    if (track.sample.syncMode === 'loop') {
      src.loop = true;
      src.loopStart = start;
      src.loopEnd = end;
    }

    if (track.chokeGroup) {
      const prev = chokeActive[track.chokeGroup];
      if (prev) { try { prev.stop(time); } catch (e) {} }
      chokeActive[track.chokeGroup] = src;
    }

    src.start(time, start, track.sample.syncMode === 'loop' ? undefined : dur);
    return src;
  }

  function stopPad(track, time) {
    // Para one-shots no suele hacer falta; se deja para muestras en loop.
  }

  // Sintetizador simple: oscilador + envolvente ADSR + filtro
  function playSynthNote(track, pitch, time, duration, velocity = 1) {
    const ctx = AudioEngine.context;
    const nodes = ensureNodes(track);
    const s = track.synth;
    const osc = ctx.createOscillator();
    osc.type = s.waveform;
    osc.frequency.value = midiToFreq(pitch);
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = s.filterFreq;
    const env = ctx.createGain();
    env.gain.value = 0;

    osc.connect(filter);
    filter.connect(env);
    env.connect(nodes.input);

    const a = s.attack, d = s.decay, sus = s.sustain, r = s.release;
    const peak = velocity;
    env.gain.setValueAtTime(0, time);
    env.gain.linearRampToValueAtTime(peak, time + a);
    env.gain.linearRampToValueAtTime(peak * sus, time + a + d);
    const releaseStart = time + Math.max(duration, a + d);
    env.gain.setValueAtTime(peak * sus, releaseStart);
    env.gain.linearRampToValueAtTime(0, releaseStart + r);

    osc.start(time);
    osc.stop(releaseStart + r + 0.02);
    return osc;
  }

  function midiToFreq(midi) {
    return 440 * Math.pow(2, (midi - 69) / 12);
  }

  return { ensureNodes, updateFx, playPad, stopPad, playSynthNote, refreshAllVolumes, trackEffectiveVolume, midiToFreq };
})();
