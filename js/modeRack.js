// Rack central estilo FL Studio: todos los tracks (pad o synth) como filas iguales con su grid de pasos.
const ModeRack = (() => {
  let root = null;

  function render(container) {
    root = container;
    root.innerHTML = '';
    root.className = 'mode-rack';

    const rack = document.createElement('div');
    rack.className = 'rack';
    State.project.tracks.forEach(track => rack.appendChild(buildRow(track)));
    root.appendChild(rack);

    const addBtn = document.createElement('button');
    addBtn.className = 'mini-btn add-synth-btn';
    addBtn.textContent = '+ Track synth';
    addBtn.onclick = () => { State.addSynthTrack(); render(root); };
    root.appendChild(addBtn);

    Sequencer.onStepUpdate((step) => {
      rack.querySelectorAll('.rack-row').forEach(row => {
        row.querySelectorAll('.step-cell').forEach((c, i) => c.classList.toggle('playhead', i === step));
      });
    });
  }

  function buildRow(track) {
    const row = document.createElement('div');
    row.className = 'rack-row';
    row.style.setProperty('--pad-color', track.color);

    const header = document.createElement('div');
    header.className = 'rack-row-header';

    const name = document.createElement('span');
    name.className = 'rack-row-name';
    name.textContent = track.name;
    name.title = track.type === 'synth' ? 'Doble clic: editar en Piano Roll' : 'Doble clic: cargar muestra';
    name.ondblclick = () => {
      if (track.type === 'synth') {
        UI.gotoPianoRoll(track);
      } else {
        PadSidebar.loadSampleIntoTrack ? openFilePicker(track) : null;
      }
    };
    name.onclick = () => UI.renderInspector(track);
    header.appendChild(name);

    const muteBtn = document.createElement('button');
    muteBtn.className = 'mini-btn' + (track.mute ? ' active' : '');
    muteBtn.textContent = 'M';
    muteBtn.onclick = () => { track.mute = !track.mute; Tracks.refreshAllVolumes(); muteBtn.classList.toggle('active', track.mute); };
    header.appendChild(muteBtn);

    row.appendChild(header);

    const cellsWrap = document.createElement('div');
    cellsWrap.className = 'step-cells';
    const scene = State.activeScene();
    const pat = scene.patterns[track.id];
    const steps = State.project.patternLength;

    if (track.type === 'pad') {
      pat.steps.forEach((s, i) => {
        const cell = document.createElement('div');
        cell.className = 'step-cell' + (s.on ? ' on' : '') + (i % 4 === 0 ? ' beat' : '');
        cell.onclick = () => { s.on = !s.on; cell.classList.toggle('on', s.on); };
        cellsWrap.appendChild(cell);
      });
    } else {
      for (let i = 0; i < steps; i++) {
        const cell = document.createElement('div');
        const hasNote = pat.notes.some(n => n.step === i);
        cell.className = 'step-cell' + (hasNote ? ' on' : '') + (i % 4 === 0 ? ' beat' : '');
        cell.onclick = () => {
          const idx = pat.notes.findIndex(n => n.step === i);
          if (idx >= 0) {
            pat.notes.splice(idx, 1);
          } else {
            pat.notes.push({ step: i, pitch: 60, length: 1, vel: 0.9 });
            Sequencer.previewNote(track, 60, 0.9);
          }
          cell.classList.toggle('on', pat.notes.some(n => n.step === i));
        };
        cellsWrap.appendChild(cell);
      }
    }
    row.appendChild(cellsWrap);
    return row;
  }

  function openFilePicker(track) {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'audio/*';
    input.onchange = async () => {
      if (!input.files[0]) return;
      const buf = await input.files[0].arrayBuffer();
      const audioBuf = await AudioEngine.decodeFile(buf);
      track.sample = { buffer: audioBuf, name: input.files[0].name, trimStart: 0, trimEnd: audioBuf.duration, syncMode: 'oneshot' };
      render(root);
      document.dispatchEvent(new CustomEvent('sample:loaded', { detail: { track } }));
    };
    input.click();
  }

  return { render };
})();
