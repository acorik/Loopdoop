// Modo Drum Pad: grid 4x4 de pads + secuenciador de pasos para los tracks tipo pad.
const ModePads = (() => {
  let root = null;
  let selectedPadTrack = null;

  function render(container) {
    root = container;
    root.innerHTML = '';
    root.className = 'mode-pads';

    const padGrid = document.createElement('div');
    padGrid.className = 'pad-grid';
    State.padTracks().forEach(track => padGrid.appendChild(buildPadCell(track)));
    root.appendChild(padGrid);

    const stepArea = document.createElement('div');
    stepArea.className = 'step-area';
    stepArea.appendChild(buildStepGrid());
    root.appendChild(stepArea);
  }

  function buildPadCell(track) {
    const cell = document.createElement('div');
    cell.className = 'pad-cell';
    cell.style.setProperty('--pad-color', track.color);
    cell.dataset.trackId = track.id;
    cell.innerHTML = `
      <div class="pad-label">${track.name}</div>
      <div class="pad-sample-name">${track.sample ? track.sample.name : '(vacío)'}</div>
    `;
    cell.addEventListener('pointerdown', (e) => {
      cell.classList.add('hit');
      Sequencer.previewNote(track, 60, 1);
      openPadEditorIfSelected(track, cell);
    });
    cell.addEventListener('pointerup', () => cell.classList.remove('hit'));
    cell.addEventListener('pointerleave', () => cell.classList.remove('hit'));
    cell.addEventListener('dblclick', () => promptLoadSample(track));
    cell.addEventListener('dragover', (e) => e.preventDefault());
    cell.addEventListener('drop', (e) => {
      e.preventDefault();
      const file = e.dataTransfer.files[0];
      if (file) loadSampleIntoTrack(track, file);
    });
    return cell;
  }

  function openPadEditorIfSelected(track, cell) {
    document.querySelectorAll('.pad-cell.selected').forEach(c => c.classList.remove('selected'));
    cell.classList.add('selected');
    selectedPadTrack = track;
    UI.renderInspector(track);
  }

  function promptLoadSample(track) {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'audio/*';
    input.onchange = () => { if (input.files[0]) loadSampleIntoTrack(track, input.files[0]); };
    input.click();
  }

  async function loadSampleIntoTrack(track, file) {
    const buf = await file.arrayBuffer();
    const audioBuf = await AudioEngine.decodeFile(buf);
    track.sample = { buffer: audioBuf, name: file.name, trimStart: 0, trimEnd: audioBuf.duration, syncMode: 'oneshot' };
    render(root);
  }

  function buildStepGrid() {
    const table = document.createElement('div');
    table.className = 'step-grid';
    const scene = State.activeScene();
    State.padTracks().forEach(track => {
      const row = document.createElement('div');
      row.className = 'step-row';

      const label = document.createElement('div');
      label.className = 'step-row-label';
      label.style.setProperty('--pad-color', track.color);
      label.innerHTML = `<span>${track.name}</span>`;
      const muteBtn = document.createElement('button');
      muteBtn.className = 'mini-btn' + (track.mute ? ' active' : '');
      muteBtn.textContent = 'M';
      muteBtn.onclick = () => { track.mute = !track.mute; Tracks.refreshAllVolumes(); muteBtn.classList.toggle('active', track.mute); };
      label.appendChild(muteBtn);
      row.appendChild(label);

      const cellsWrap = document.createElement('div');
      cellsWrap.className = 'step-cells';
      const pat = scene.patterns[track.id];
      pat.steps.forEach((s, i) => {
        const cell = document.createElement('div');
        cell.className = 'step-cell' + (s.on ? ' on' : '') + (i % 4 === 0 ? ' beat' : '');
        cell.style.setProperty('--pad-color', track.color);
        cell.onclick = () => {
          s.on = !s.on;
          cell.classList.toggle('on', s.on);
        };
        cellsWrap.appendChild(cell);
      });
      row.appendChild(cellsWrap);
      table.appendChild(row);
    });

    Sequencer.onStepUpdate((step) => {
      table.querySelectorAll('.step-row').forEach(row => {
        row.querySelectorAll('.step-cell').forEach((c, i) => c.classList.toggle('playhead', i === step));
      });
    });
    return table;
  }

  function handleMidiNote(note, velocity, isOn) {
    const idx = Midi.padIndexFromNote(note);
    if (idx < 0) return;
    const track = State.padTracks()[idx];
    if (!track) return;
    if (isOn) {
      Tracks.playPad(track, AudioEngine.context.currentTime, velocity);
      const cell = root && root.querySelector(`.pad-cell[data-track-id="${track.id}"]`);
      if (cell) { cell.classList.add('hit'); setTimeout(() => cell.classList.remove('hit'), 120); }
    }
  }

  return { render, handleMidiNote, get selectedPadTrack() { return selectedPadTrack; } };
})();
