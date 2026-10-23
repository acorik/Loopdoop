// UI: cabecera/transporte, pestañas de modo, panel inspector, MIDI learn, guardado/carga.
const UI = (() => {
  let currentMode = 'rack';
  const modes = {
    rack: ModeRack, piano: ModePianoRoll, record: ModeRecord, mute: ModeMute, mixer: Mixer
  };

  function init() {
    buildHeader();
    buildTabs();
    PadSidebar.render(document.getElementById('pad-sidebar'));
    renderMode();
    bindMidi();
    Sequencer.init();

    document.addEventListener('scene:changed', renderMode);
    document.addEventListener('sample:loaded', () => PadSidebar.render(document.getElementById('pad-sidebar')));
    document.getElementById('app-root').addEventListener('click', () => AudioEngine.resume(), { once: true });
  }

  function gotoPianoRoll(track) {
    currentMode = 'piano';
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.toggle('active', b.dataset.mode === 'piano'));
    ModePianoRoll.selectTrack(track);
    renderMode();
  }

  function buildHeader() {
    const header = document.getElementById('header');
    header.innerHTML = `
      <div class="brand">LoopDoop</div>
      <input id="proj-name" class="proj-name" value="${State.project.name}">
      <div class="transport">
        <button id="play-btn" class="transport-btn">▶</button>
        <button id="stop-btn" class="transport-btn">■</button>
      </div>
      <label class="hdr-field">BPM <input id="bpm-input" type="number" min="40" max="300" value="${State.project.bpm}"></label>
      <label class="hdr-field">Swing <input id="swing-input" type="range" min="0" max="0.75" step="0.01" value="${State.project.swing}"></label>
      <label class="hdr-field">Pasos
        <select id="steps-input">
          <option value="16">16</option>
          <option value="32">32</option>
        </select>
      </label>
      <span id="midi-status" class="midi-status">MIDI: ...</span>
      <button id="midi-learn-btn" class="mini-btn">MIDI Learn</button>
      <button id="save-btn" class="mini-btn">Guardar</button>
      <button id="load-btn" class="mini-btn">Cargar</button>
      <button id="export-btn" class="mini-btn">Exportar</button>
      <button id="import-btn" class="mini-btn">Importar</button>
      <input type="file" id="import-file" accept=".loopdoop,application/json" style="display:none">
    `;

    header.querySelector('#proj-name').onchange = (e) => { State.project.name = e.target.value; };
    header.querySelector('#play-btn').onclick = () => { AudioEngine.resume(); Clock.start(); };
    header.querySelector('#stop-btn').onclick = () => Clock.stop();
    header.querySelector('#bpm-input').oninput = (e) => { State.project.bpm = parseInt(e.target.value, 10) || 120; Clock.setBpm(State.project.bpm); };
    header.querySelector('#swing-input').oninput = (e) => { State.project.swing = parseFloat(e.target.value); Clock.setSwing(State.project.swing); };
    header.querySelector('#steps-input').value = String(State.project.patternLength);
    header.querySelector('#steps-input').onchange = (e) => {
      const len = parseInt(e.target.value, 10);
      State.setPatternLength(len);
      Clock.setStepsPerBar(len);
      renderMode();
    };
    header.querySelector('#midi-learn-btn').onclick = openMidiLearn;
    header.querySelector('#save-btn').onclick = async () => { await Project.save(); flash('Proyecto guardado'); };
    header.querySelector('#load-btn').onclick = openLoadDialog;
    header.querySelector('#export-btn').onclick = () => Project.exportFile();
    header.querySelector('#import-btn').onclick = () => header.querySelector('#import-file').click();
    header.querySelector('#import-file').onchange = async (e) => {
      const file = e.target.files[0];
      if (!file) return;
      const data = await Project.importFile(file);
      State.project = data;
      Clock.setBpm(data.bpm); Clock.setSwing(data.swing); Clock.setStepsPerBar(data.patternLength);
      buildHeader(); renderMode();
    };

    document.addEventListener('midi:status', (e) => {
      const el = document.getElementById('midi-status');
      el.textContent = 'MIDI: ' + (e.detail.connected ? ('conectado (' + e.detail.names.join(', ') + ')') : 'sin conectar');
      el.classList.toggle('connected', e.detail.connected);
    });
  }

  function flash(msg) {
    const el = document.createElement('div');
    el.className = 'flash-msg';
    el.textContent = msg;
    document.body.appendChild(el);
    setTimeout(() => el.remove(), 1800);
  }

  async function openLoadDialog() {
    const list = await Project.listSaved();
    if (!list.length) return flash('No hay proyectos guardados aún');
    const choice = prompt('Proyectos guardados:\n' + list.map((p, i) => `${i + 1}. ${p.name}`).join('\n') + '\n\nEscribe el número:');
    const idx = parseInt(choice, 10) - 1;
    if (isNaN(idx) || !list[idx]) return;
    const data = await Project.loadById(list[idx].id);
    State.project = data;
    Clock.setBpm(data.bpm); Clock.setSwing(data.swing); Clock.setStepsPerBar(data.patternLength);
    buildHeader(); renderMode();
  }

  function buildTabs() {
    const tabs = document.getElementById('tabs');
    tabs.innerHTML = `
      <button class="tab-btn active" data-mode="rack">Rack</button>
      <button class="tab-btn" data-mode="piano">Piano Roll</button>
      <button class="tab-btn" data-mode="record">Grabar</button>
      <button class="tab-btn" data-mode="mute">Mute/Secciones</button>
      <button class="tab-btn" data-mode="mixer">Mixer</button>
    `;
    tabs.querySelectorAll('.tab-btn').forEach(btn => {
      btn.onclick = () => {
        tabs.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        currentMode = btn.dataset.mode;
        renderMode();
      };
    });
  }

  function renderMode() {
    const container = document.getElementById('mode-container');
    modes[currentMode].render(container);
  }

  function renderInspector(track) {
    const panel = document.getElementById('inspector');
    if (!track) { panel.innerHTML = ''; return; }
    if (track.type === 'pad') {
      panel.innerHTML = `
        <div class="section-title">${track.name}</div>
        <label>Choke group <input id="insp-choke" type="number" min="0" max="8" value="${track.chokeGroup}"></label>
        <label>Modo <select id="insp-sync">
          <option value="oneshot" ${track.sample && track.sample.syncMode === 'oneshot' ? 'selected' : ''}>One-shot</option>
          <option value="loop" ${track.sample && track.sample.syncMode === 'loop' ? 'selected' : ''}>Loop</option>
        </select></label>
      `;
      panel.querySelector('#insp-choke').oninput = (e) => { track.chokeGroup = parseInt(e.target.value, 10) || 0; };
      panel.querySelector('#insp-sync').onchange = (e) => { if (track.sample) track.sample.syncMode = e.target.value; };
    } else {
      const s = track.synth;
      panel.innerHTML = `
        <div class="section-title">${track.name}</div>
        <label>Attack <input id="insp-a" type="range" min="0" max="1" step="0.01" value="${s.attack}"></label>
        <label>Decay <input id="insp-d" type="range" min="0" max="1" step="0.01" value="${s.decay}"></label>
        <label>Sustain <input id="insp-s" type="range" min="0" max="1" step="0.01" value="${s.sustain}"></label>
        <label>Release <input id="insp-r" type="range" min="0" max="2" step="0.01" value="${s.release}"></label>
        <label>Filtro <input id="insp-f" type="range" min="40" max="12000" step="10" value="${s.filterFreq}"></label>
      `;
      panel.querySelector('#insp-a').oninput = (e) => s.attack = parseFloat(e.target.value);
      panel.querySelector('#insp-d').oninput = (e) => s.decay = parseFloat(e.target.value);
      panel.querySelector('#insp-s').oninput = (e) => s.sustain = parseFloat(e.target.value);
      panel.querySelector('#insp-r').oninput = (e) => s.release = parseFloat(e.target.value);
      panel.querySelector('#insp-f').oninput = (e) => s.filterFreq = parseFloat(e.target.value);
    }
  }

  function openMidiLearn() {
    const padIdx = prompt('Número de pad a mapear (1-16), o CC de knob escribiendo "k1".."k6":');
    if (!padIdx) return;
    if (padIdx.startsWith('k')) {
      const knobIdx = parseInt(padIdx.slice(1), 10) - 1;
      flash('Mueve el knob ' + (knobIdx + 1) + ' en tu MPD218...');
      Midi.learn('cc', (cc) => { Midi.setKnobCC(knobIdx, cc); flash('Knob ' + (knobIdx + 1) + ' -> CC ' + cc); });
    } else {
      const i = parseInt(padIdx, 10) - 1;
      flash('Golpea el pad para mapear la posición ' + (i + 1) + '...');
      Midi.learn('note', (note) => { Midi.setPadNote(i, note); flash('Pad ' + (i + 1) + ' -> nota ' + note); });
    }
  }

  function bindMidi() {
    Midi.onNote = (note, vel, isOn) => PadSidebar.handleMidiNote(note, vel, isOn);
    Midi.onCC = (cc, val) => {
      const idx = Midi.knobIndexFromCC(cc);
      if (idx < 0) return;
      // Knob 1 por defecto controla el volumen máster; el resto quedan libres para mapear a FX desde el mixer.
      if (idx === 0) {
        const m = AudioEngine.master;
        if (m) m.gain.value = val;
      }
    };
  }

  return { init, renderInspector, gotoPianoRoll };
})();
