// Conecta el reloj con el patrón activo: dispara pads y notas de synth paso a paso.
const Sequencer = (() => {
  let pendingSceneIndex = null;
  let songMode = false;
  let arrangementPos = 0;
  let listeners = [];

  function onStepUpdate(fn) { listeners.push(fn); }
  function emit(step) { listeners.forEach(fn => fn(step)); }

  function init() {
    Clock.onStep = (step, time) => {
      triggerStep(step, time);
      emit(step);
    };
    Clock.onBar = () => {
      if (pendingSceneIndex != null) {
        State.project.activeSceneIndex = pendingSceneIndex;
        pendingSceneIndex = null;
        document.dispatchEvent(new CustomEvent('scene:changed'));
      } else if (songMode && State.project.arrangement.length) {
        arrangementPos = (arrangementPos + 1) % State.project.arrangement.length;
        const sceneId = State.project.arrangement[arrangementPos];
        const idx = State.project.scenes.findIndex(s => s.id === sceneId);
        if (idx >= 0) {
          State.project.activeSceneIndex = idx;
          document.dispatchEvent(new CustomEvent('scene:changed'));
        }
      }
    };
  }

  function triggerStep(step, time) {
    const scene = State.activeScene();
    if (!scene) return;
    State.padTracks().forEach(track => {
      const pat = scene.patterns[track.id];
      if (!pat) return;
      const s = pat.steps[step];
      if (s && s.on) Tracks.playPad(track, time, s.vel);
    });
    State.synthTracks().forEach(track => {
      const pat = scene.patterns[track.id];
      if (!pat) return;
      pat.notes.filter(n => n.step === step).forEach(n => {
        const dur = n.length * Clock.stepSeconds();
        Tracks.playSynthNote(track, n.pitch, time, dur, n.vel);
      });
    });
  }

  function queueScene(index) {
    if (!Clock.isPlaying) {
      State.project.activeSceneIndex = index;
      document.dispatchEvent(new CustomEvent('scene:changed'));
      return;
    }
    pendingSceneIndex = index;
  }

  function setSongMode(on) {
    songMode = on;
    arrangementPos = -1;
  }

  function toggleStep(track, stepIndex) {
    const scene = State.activeScene();
    const pat = scene.patterns[track.id];
    pat.steps[stepIndex].on = !pat.steps[stepIndex].on;
  }

  function previewNote(track, pitch = 60, velocity = 1) {
    const ctx = AudioEngine.context;
    if (track.type === 'pad') Tracks.playPad(track, ctx.currentTime, velocity);
    else Tracks.playSynthNote(track, pitch, ctx.currentTime, 0.25, velocity);
  }

  return { init, queueScene, setSongMode, toggleStep, previewNote, onStepUpdate,
           get pendingSceneIndex() { return pendingSceneIndex; },
           get songMode() { return songMode; } };
})();
