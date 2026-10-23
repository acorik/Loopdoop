// Barra lateral de pads: disparo en vivo (MIDI o clic), siempre visible sin importar el modo activo.
const PadSidebar = (() => {
  let root = null;

  function render(container) {
    root = container;
    root.innerHTML = '';
    root.className = 'pad-sidebar';

    const title = document.createElement('div');
    title.className = 'pad-sidebar-title';
    title.textContent = 'PADS';
    root.appendChild(title);

    const grid = document.createElement('div');
    grid.className = 'pad-grid';
    State.padTracks().forEach(track => grid.appendChild(buildPadCell(track)));
    root.appendChild(grid);
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
    cell.addEventListener('pointerdown', () => {
      cell.classList.add('hit');
      Sequencer.previewNote(track, 60, 1);
      selectTrack(track, cell);
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

  function selectTrack(track, cell) {
    root.querySelectorAll('.pad-cell.selected').forEach(c => c.classList.remove('selected'));
    if (cell) cell.classList.add('selected');
    UI.renderInspector(track);
    document.dispatchEvent(new CustomEvent('track:selected', { detail: { track } }));
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
    document.dispatchEvent(new CustomEvent('sample:loaded', { detail: { track } }));
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

  return { render, handleMidiNote, loadSampleIntoTrack };
})();
