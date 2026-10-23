// Motor de audio: AudioContext único, bus máster, limitador, y construcción de cadenas de FX por canal.
const AudioEngine = (() => {
  let ctx = null;
  let master = null;
  let limiter = null;

  function ensureCtx() {
    if (ctx) return ctx;
    ctx = new (window.AudioContext || window.webkitAudioContext)({ latencyHint: 'interactive' });
    limiter = ctx.createDynamicsCompressor();
    limiter.threshold.value = -6;
    limiter.knee.value = 0;
    limiter.ratio.value = 20;
    limiter.attack.value = 0.001;
    limiter.release.value = 0.1;
    master = ctx.createGain();
    master.gain.value = 0.9;
    master.connect(limiter);
    limiter.connect(ctx.destination);
    return ctx;
  }

  function resume() {
    ensureCtx();
    if (ctx.state === 'suspended') ctx.resume();
  }

  // Impulso sintético para la reverb (sin archivos externos, barato en CPU).
  function makeImpulse(duration = 1.6, decay = 2.2) {
    const c = ensureCtx();
    const rate = c.sampleRate;
    const len = Math.max(1, Math.floor(rate * duration));
    const buf = c.createBuffer(2, len, rate);
    for (let ch = 0; ch < 2; ch++) {
      const data = buf.getChannelData(ch);
      for (let i = 0; i < len; i++) {
        data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, decay);
      }
    }
    return buf;
  }

  function makeDistortionCurve(amount) {
    const n = 2048;
    const curve = new Float32Array(n);
    const k = amount * 100;
    for (let i = 0; i < n; i++) {
      const x = (i * 2) / n - 1;
      curve[i] = ((1 + k) * x) / (1 + k * Math.abs(x));
    }
    return curve;
  }

  // Construye la cadena de FX de un canal: entrada -> filtro -> drive -> delay -> reverb -> comp -> gain(vol/pan) -> master
  function buildChannel(fx) {
    const c = ensureCtx();
    const input = c.createGain();
    const filter = c.createBiquadFilter();
    const drive = c.createWaveShaper();
    const driveWet = c.createGain();
    const driveDry = c.createGain();
    const delay = c.createDelay(2.0);
    const delayFeedback = c.createGain();
    const delayWet = c.createGain();
    const reverbConv = c.createConvolver();
    reverbConv.buffer = makeImpulse();
    const reverbWet = c.createGain();
    const comp = c.createDynamicsCompressor();
    const pan = c.createStereoPanner();
    const vol = c.createGain();

    input.connect(filter);

    // Drive en paralelo (dry/wet)
    filter.connect(driveDry);
    filter.connect(drive);
    drive.connect(driveWet);
    const postDrive = c.createGain();
    driveDry.connect(postDrive);
    driveWet.connect(postDrive);

    // Delay en paralelo
    const postDelay = c.createGain();
    postDrive.connect(postDelay);
    postDrive.connect(delay);
    delay.connect(delayFeedback);
    delayFeedback.connect(delay);
    delay.connect(delayWet);
    delayWet.connect(postDelay);

    // Reverb en paralelo
    const postReverb = c.createGain();
    postDelay.connect(postReverb);
    postDelay.connect(reverbConv);
    reverbConv.connect(reverbWet);
    reverbWet.connect(postReverb);

    postReverb.connect(comp);
    comp.connect(pan);
    pan.connect(vol);
    vol.connect(master);

    const nodes = {
      input, filter, drive, driveWet, driveDry, delay, delayFeedback, delayWet,
      reverbConv, reverbWet, comp, pan, vol
    };
    applyFx(nodes, fx);
    return nodes;
  }

  function applyFx(nodes, fx) {
    const c = ensureCtx();
    const f = fx.filter, d = fx.delay, r = fx.reverb, dr = fx.drive, cp = fx.comp;

    nodes.filter.type = f.type || 'allpass';
    nodes.filter.frequency.setTargetAtTime(f.on ? f.freq : (f.type === 'lowpass' ? 20000 : 20), c.currentTime, 0.01);
    nodes.filter.Q.setTargetAtTime(f.q, c.currentTime, 0.01);

    nodes.drive.curve = makeDistortionCurve(dr.amount);
    const driveWetAmt = dr.on ? dr.mix : 0;
    nodes.driveWet.gain.setTargetAtTime(driveWetAmt, c.currentTime, 0.01);
    nodes.driveDry.gain.setTargetAtTime(1 - driveWetAmt, c.currentTime, 0.01);

    nodes.delay.delayTime.setTargetAtTime(d.time, c.currentTime, 0.01);
    nodes.delayFeedback.gain.setTargetAtTime(d.on ? d.feedback : 0, c.currentTime, 0.01);
    nodes.delayWet.gain.setTargetAtTime(d.on ? d.mix : 0, c.currentTime, 0.01);

    nodes.reverbWet.gain.setTargetAtTime(r.on ? r.mix : 0, c.currentTime, 0.01);

    nodes.comp.threshold.setTargetAtTime(cp.on ? cp.threshold : 0, c.currentTime, 0.01);
    nodes.comp.ratio.setTargetAtTime(cp.on ? cp.ratio : 1, c.currentTime, 0.01);
  }

  function setVolPan(nodes, volume, pan) {
    const c = ensureCtx();
    nodes.vol.gain.setTargetAtTime(volume, c.currentTime, 0.01);
    nodes.pan.pan.setTargetAtTime(pan, c.currentTime, 0.01);
  }

  async function decodeFile(arrayBuffer) {
    const c = ensureCtx();
    return await c.decodeAudioData(arrayBuffer);
  }

  function defaultFx() {
    return {
      filter: { on: false, type: 'lowpass', freq: 18000, q: 0.7 },
      drive: { on: false, amount: 0.3, mix: 0.5 },
      delay: { on: false, time: 0.25, feedback: 0.3, mix: 0.25 },
      reverb: { on: false, mix: 0.2 },
      comp: { on: false, threshold: -24, ratio: 4 }
    };
  }

  return {
    ensureCtx, resume, buildChannel, applyFx, setVolPan, decodeFile, defaultFx,
    get context() { return ctx; },
    get master() { return master; }
  };
})();
