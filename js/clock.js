// Reloj de reproducción: técnica de lookahead ("A Tale of Two Clocks") para timing preciso con poca CPU.
const Clock = (() => {
  let bpm = 120;
  let swing = 0; // 0..1
  let stepsPerBar = 16;
  let playing = false;
  let currentStep = 0;
  let nextStepTime = 0;
  let timerId = null;
  let onStep = null; // (stepIndex, time) => {}
  let onBar = null;  // (barIndex) => {}
  let barIndex = 0;

  const LOOKAHEAD_MS = 25;
  const SCHEDULE_AHEAD_S = 0.1;

  function stepDuration() {
    const secondsPerBeat = 60 / bpm;
    const stepsPerBeat = stepsPerBar / 4;
    return secondsPerBeat / stepsPerBeat;
  }

  function scheduler() {
    const ctx = AudioEngine.context;
    if (!ctx) return;
    while (nextStepTime < ctx.currentTime + SCHEDULE_AHEAD_S) {
      let t = nextStepTime;
      const isOdd = currentStep % 2 === 1;
      if (isOdd && swing > 0) t += stepDuration() * swing * 0.5;
      onStep && onStep(currentStep, t);
      nextStepTime += stepDuration();
      currentStep++;
      if (currentStep >= stepsPerBar) {
        currentStep = 0;
        barIndex++;
        onBar && onBar(barIndex);
      }
    }
    timerId = setTimeout(scheduler, LOOKAHEAD_MS);
  }

  function start() {
    if (playing) return;
    AudioEngine.resume();
    playing = true;
    currentStep = 0;
    barIndex = 0;
    nextStepTime = AudioEngine.context.currentTime + 0.05;
    scheduler();
  }

  function stop() {
    playing = false;
    clearTimeout(timerId);
  }

  function setBpm(v) { bpm = Math.max(40, Math.min(300, v)); }
  function setSwing(v) { swing = Math.max(0, Math.min(0.75, v)); }
  function setStepsPerBar(n) { stepsPerBar = n; }

  return {
    start, stop,
    setBpm, setSwing, setStepsPerBar,
    get bpm() { return bpm; },
    get swing() { return swing; },
    get stepsPerBar() { return stepsPerBar; },
    get isPlaying() { return playing; },
    get step() { return currentStep; },
    stepSeconds: stepDuration,
    set onStep(fn) { onStep = fn; },
    set onBar(fn) { onBar = fn; }
  };
})();
