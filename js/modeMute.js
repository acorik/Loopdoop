// Modo Mute/Secciones: lanzar escenas en vivo, silenciar tracks por sección, armar el arreglo de la canción.
const ModeMute = (() => {
  let root = null;

  function render(container) {
    root = container;
    root.innerHTML = '';
    root.className = 'mode-mute';

    root.appendChild(buildSceneLauncher());
    root.appendChild(buildMuteMatrix());
    root.appendChild(buildArrangement());
  }

  function buildSceneLauncher() {
    const wrap = document.createElement('div');
    wrap.className = 'scene-launcher';
    const title = document.createElement('div');
    title.className = 'section-title';
    title.textContent = 'Escenas (clic para lanzar, se encola al siguiente compás)';
    wrap.appendChild(title);

    const row = document.createElement('div');
    row.className = 'scene-buttons';
    State.project.scenes.forEach((scene, i) => {
      const btn = document.createElement('button');
      btn.className = 'scene-btn' +
        (i === State.project.activeSceneIndex ? ' active' : '') +
        (Sequencer.pendingSceneIndex === i ? ' pending' : '');
      btn.textContent = scene.name;
      btn.ondblclick = () => {
        const name = prompt('Nombre de la escena', scene.name);
        if (name) { scene.name = name; render(root); }
      };
      btn.onclick = () => { Sequencer.queueScene(i); setTimeout(() => render(root), 50); };
      row.appendChild(btn);
    });
    wrap.appendChild(row);
    return wrap;
  }

  function buildMuteMatrix() {
    const wrap = document.createElement('div');
    wrap.className = 'mute-matrix';
    const title = document.createElement('div');
    title.className = 'section-title';
    title.textContent = 'Mute en vivo por track (afecta a todas las escenas)';
    wrap.appendChild(title);

    const row = document.createElement('div');
    row.className = 'mute-row';
    State.project.tracks.forEach(t => {
      const btn = document.createElement('button');
      btn.className = 'mute-tile' + (State.project.mutes[t.id] ? ' muted' : '');
      btn.style.setProperty('--pad-color', t.color);
      btn.textContent = t.name;
      btn.onclick = () => {
        State.project.mutes[t.id] = !State.project.mutes[t.id];
        Tracks.refreshAllVolumes();
        btn.classList.toggle('muted', State.project.mutes[t.id]);
      };
      row.appendChild(btn);
    });
    wrap.appendChild(row);
    return wrap;
  }

  function buildArrangement() {
    const wrap = document.createElement('div');
    wrap.className = 'arrangement';
    const title = document.createElement('div');
    title.className = 'section-title';
    title.textContent = 'Modo canción (arreglo de escenas)';
    wrap.appendChild(title);

    const toggleRow = document.createElement('div');
    const songToggle = document.createElement('label');
    const chk = document.createElement('input');
    chk.type = 'checkbox';
    chk.checked = Sequencer.songMode;
    chk.onchange = () => Sequencer.setSongMode(chk.checked);
    songToggle.appendChild(chk);
    songToggle.append(' Activar modo canción (encadena escenas automáticamente)');
    toggleRow.appendChild(songToggle);
    wrap.appendChild(toggleRow);

    const list = document.createElement('div');
    list.className = 'arrangement-list';
    State.project.arrangement.forEach((sceneId, i) => {
      const scene = State.project.scenes.find(s => s.id === sceneId);
      const chip = document.createElement('span');
      chip.className = 'arr-chip';
      chip.textContent = (scene ? scene.name : '?') ;
      chip.title = 'Clic para quitar';
      chip.onclick = () => { State.project.arrangement.splice(i, 1); render(root); };
      list.appendChild(chip);
    });
    wrap.appendChild(list);

    const addRow = document.createElement('div');
    addRow.className = 'scene-buttons';
    State.project.scenes.forEach(scene => {
      const btn = document.createElement('button');
      btn.className = 'mini-btn';
      btn.textContent = '+ ' + scene.name;
      btn.onclick = () => { State.project.arrangement.push(scene.id); render(root); };
      addRow.appendChild(btn);
    });
    wrap.appendChild(addRow);

    return wrap;
  }

  return { render };
})();
