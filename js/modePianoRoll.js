// Modo Piano Roll: editor de notas para un track synth seleccionado.
const ModePianoRoll = (() => {
  let root = null;
  let currentTrack = null;
  const LOW = 48, HIGH = 84; // C3..C6 aprox
  const NOTE_NAMES = ['C','C#','D','D#','E','F','F#','G','G#','A','A#','B'];

  function pitchName(p) { return NOTE_NAMES[p % 12] + (Math.floor(p / 12) - 1); }
  function isBlack(p) { return NOTE_NAMES[p % 12].includes('#'); }

  function render(container) {
    root = container;
    root.innerHTML = '';
    root.className = 'mode-pianoroll';

    const synths = State.synthTracks();
    if (!currentTrack || !synths.find(t => t.id === currentTrack.id)) currentTrack = synths[0];

    const toolbar = document.createElement('div');
    toolbar.className = 'pr-toolbar';
    const select = document.createElement('select');
    synths.forEach(t => {
      const opt = document.createElement('option');
      opt.value = t.id; opt.textContent = t.name;
      if (currentTrack && t.id === currentTrack.id) opt.selected = true;
      select.appendChild(opt);
    });
    select.onchange = () => { currentTrack = State.trackById(select.value); render(root); UI.renderInspector(currentTrack); };
    toolbar.appendChild(select);

    const addBtn = document.createElement('button');
    addBtn.className = 'mini-btn';
    addBtn.textContent = '+ Track synth';
    addBtn.onclick = () => { currentTrack = State.addSynthTrack(); render(root); };
    toolbar.appendChild(addBtn);

    const waveSel = document.createElement('select');
    ['sine','square','sawtooth','triangle'].forEach(w => {
      const opt = document.createElement('option'); opt.value = w; opt.textContent = w;
      if (currentTrack && currentTrack.synth.waveform === w) opt.selected = true;
      waveSel.appendChild(opt);
    });
    waveSel.onchange = () => { currentTrack.synth.waveform = waveSel.value; };
    toolbar.appendChild(waveSel);

    root.appendChild(toolbar);

    if (!currentTrack) {
      const msg = document.createElement('div');
      msg.className = 'empty-msg';
      msg.textContent = 'Crea un track synth para empezar.';
      root.appendChild(msg);
      return;
    }

    root.appendChild(buildGrid());
  }

  function buildGrid() {
    const wrap = document.createElement('div');
    wrap.className = 'pr-grid-wrap';
    const grid = document.createElement('div');
    grid.className = 'pr-grid';

    const scene = State.activeScene();
    const pat = scene.patterns[currentTrack.id];
    const steps = State.project.patternLength;

    for (let p = HIGH; p >= LOW; p--) {
      const row = document.createElement('div');
      row.className = 'pr-row' + (isBlack(p) ? ' black' : '');

      const label = document.createElement('div');
      label.className = 'pr-row-label';
      label.textContent = pitchName(p);
      row.appendChild(label);

      const cells = document.createElement('div');
      cells.className = 'pr-row-cells';
      for (let s = 0; s < steps; s++) {
        const cell = document.createElement('div');
        cell.className = 'pr-cell' + (s % 4 === 0 ? ' beat' : '');
        const existing = pat.notes.find(n => n.pitch === p && s >= n.step && s < n.step + n.length);
        if (existing) cell.classList.add('note');
        cell.onclick = () => {
          const idx = pat.notes.findIndex(n => n.pitch === p && s >= n.step && s < n.step + n.length);
          if (idx >= 0) {
            pat.notes.splice(idx, 1);
          } else {
            pat.notes.push({ step: s, pitch: p, length: 1, vel: 0.9 });
            Sequencer.previewNote(currentTrack, p, 0.9);
          }
          render(root);
        };
        cells.appendChild(cell);
      }
      row.appendChild(cells);
      grid.appendChild(row);
    }

    Sequencer.onStepUpdate((step) => {
      grid.querySelectorAll('.pr-row-cells').forEach(rc => {
        rc.querySelectorAll('.pr-cell').forEach((c, i) => c.classList.toggle('playhead', i === step));
      });
    });

    wrap.appendChild(grid);
    return wrap;
  }

  function selectTrack(track) {
    currentTrack = track;
    if (root) render(root);
  }

  return { render, selectTrack, get currentTrack() { return currentTrack; } };
})();
