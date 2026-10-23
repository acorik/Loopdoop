// Modelo de datos del proyecto: tracks (pad/synth), patrones por escena, bpm, swing.
const State = (() => {
  const PAD_COUNT = 16;
  const SCENE_COUNT = 8;

  function uid() { return Math.random().toString(36).slice(2, 10); }

  function emptySteps(len) {
    return new Array(len).fill(null).map(() => ({ on: false, vel: 1.0 }));
  }

  function newPadTrack(index) {
    return {
      id: uid(),
      type: 'pad',
      name: 'Pad ' + (index + 1),
      color: PAD_COLORS[index % PAD_COLORS.length],
      padIndex: index,
      volume: 0.9,
      pan: 0,
      mute: false,
      solo: false,
      chokeGroup: 0,
      sample: null, // { buffer, name, trimStart, trimEnd, syncMode }
      fx: AudioEngine.defaultFx(),
      nodes: null
    };
  }

  function newSynthTrack(name) {
    return {
      id: uid(),
      type: 'synth',
      name: name || 'Synth',
      color: '#7ad1ff',
      volume: 0.8,
      pan: 0,
      mute: false,
      solo: false,
      synth: { waveform: 'sawtooth', attack: 0.01, decay: 0.15, sustain: 0.6, release: 0.2, filterFreq: 4000 },
      notes: [], // {step, pitch, length, vel}
      fx: AudioEngine.defaultFx(),
      nodes: null
    };
  }

  function newScene(name, tracks) {
    const patterns = {};
    tracks.forEach(t => {
      if (t.type === 'pad') patterns[t.id] = { steps: emptySteps(proj.patternLength) };
      else patterns[t.id] = { notes: [] };
    });
    return { id: uid(), name, patterns };
  }

  const PAD_COLORS = ['#ff5d73','#ff9f43','#ffd23f','#9bf06f','#4fd1c5','#4f8dff','#9b6bff','#ff6bcf',
                       '#ff8a8a','#ffbf80','#f0e68f','#c2f0a0','#8feee0','#9ac2ff','#c7a8ff','#ffa8e4'];

  let proj = null;

  function newProject(name) {
    const tracks = [];
    for (let i = 0; i < PAD_COUNT; i++) tracks.push(newPadTrack(i));
    tracks.push(newSynthTrack('Synth 1'));
    proj = {
      id: uid(),
      name: name || 'Proyecto sin título',
      bpm: 120,
      swing: 0,
      patternLength: 16,
      masterVolume: 0.9,
      tracks,
      scenes: [],
      arrangement: [], // lista de ids de escena para modo canción
      activeSceneIndex: 0,
      mutes: {} // override de mute en vivo por track.id
    };
    for (let i = 0; i < SCENE_COUNT; i++) proj.scenes.push(newScene('Escena ' + (i + 1), tracks));
    return proj;
  }

  function addSynthTrack() {
    const t = newSynthTrack('Synth ' + (proj.tracks.filter(x=>x.type==='synth').length + 1));
    proj.tracks.push(t);
    proj.scenes.forEach(s => { s.patterns[t.id] = { notes: [] }; });
    return t;
  }

  function removeTrack(trackId) {
    proj.tracks = proj.tracks.filter(t => t.id !== trackId);
    proj.scenes.forEach(s => { delete s.patterns[trackId]; });
  }

  function activeScene() { return proj.scenes[proj.activeSceneIndex]; }

  function trackById(id) { return proj.tracks.find(t => t.id === id); }

  function padTracks() { return proj.tracks.filter(t => t.type === 'pad'); }
  function synthTracks() { return proj.tracks.filter(t => t.type === 'synth'); }

  function setPatternLength(len) {
    proj.patternLength = len;
    proj.scenes.forEach(s => {
      padTracks().forEach(t => {
        const pat = s.patterns[t.id];
        if (!pat) return;
        const steps = emptySteps(len);
        for (let i = 0; i < Math.min(len, pat.steps.length); i++) steps[i] = pat.steps[i];
        pat.steps = steps;
      });
    });
  }

  return {
    get project() { return proj; },
    set project(p) { proj = p; },
    newProject, addSynthTrack, removeTrack, activeScene, trackById,
    padTracks, synthTracks, setPatternLength, newScene, PAD_COUNT, SCENE_COUNT, PAD_COLORS, uid
  };
})();
