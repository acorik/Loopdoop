// Modo Grabación: un botón graba lo que quieras, al parar se ajusta solo al grid y se asigna al pad. Pa'lante.
const ModeRecord = (() => {
  let root = null;
  let stream = null;
  let recorder = null;
  let chunks = [];
  let lastBuffer = null;
  let lastInfo = null;
  let targetTrack = null;
  let recording = false;
  let recStartTime = 0;
  let timerInterval = null;

  function render(container) {
    root = container;
    root.innerHTML = '';
    root.className = 'mode-record';

    const bar = document.createElement('div');
    bar.className = 'rec-toolbar';

    const recBtn = document.createElement('button');
    recBtn.className = 'mini-btn rec-btn' + (recording ? ' active' : '');
    recBtn.textContent = recording ? '■ Detener' : '● Grabar';
    recBtn.onclick = () => toggleRecord(recBtn);
    bar.appendChild(recBtn);

    const timer = document.createElement('span');
    timer.className = 'rec-timer';
    timer.id = 'rec-timer';
    timer.textContent = '0:00';
    bar.appendChild(timer);

    root.appendChild(bar);

    const targetRow = document.createElement('div');
    targetRow.className = 'rec-target';
    targetRow.innerHTML = '<span>Destino:</span>';
    const sel = document.createElement('select');
    State.padTracks().forEach(t => {
      const opt = document.createElement('option'); opt.value = t.id; opt.textContent = t.name;
      sel.appendChild(opt);
    });
    if (!targetTrack) targetTrack = State.padTracks()[0];
    sel.value = targetTrack.id;
    sel.onchange = () => { targetTrack = State.trackById(sel.value); };
    targetRow.appendChild(sel);
    root.appendChild(targetRow);

    const canvas = document.createElement('canvas');
    canvas.className = 'rec-waveform';
    canvas.width = 900; canvas.height = 160;
    root.appendChild(canvas);

    const infoRow = document.createElement('div');
    infoRow.className = 'rec-info';
    infoRow.id = 'rec-info';
    root.appendChild(infoRow);

    if (lastBuffer) {
      drawWaveform(canvas, lastBuffer);
      showInfo();
    }
  }

  async function ensureStream() {
    if (stream) return stream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch (e) {
      alert('No se pudo acceder al micrófono: ' + e.message);
    }
    return stream;
  }

  async function toggleRecord(btn) {
    if (recording) {
      recorder.stop();
      recording = false;
      clearInterval(timerInterval);
      btn.classList.remove('active');
      btn.textContent = '● Grabar';
      return;
    }
    await ensureStream();
    if (!stream) return;
    chunks = [];
    recorder = new MediaRecorder(stream);
    recorder.ondataavailable = (e) => chunks.push(e.data);
    recorder.onstop = onRecordStop;
    recorder.start();
    recording = true;
    recStartTime = performance.now();
    btn.classList.add('active');
    btn.textContent = '■ Detener';
    timerInterval = setInterval(() => {
      const el = document.getElementById('rec-timer');
      if (!el) return;
      const secs = Math.floor((performance.now() - recStartTime) / 1000);
      el.textContent = Math.floor(secs / 60) + ':' + String(secs % 60).padStart(2, '0');
    }, 250);
  }

  async function onRecordStop() {
    const blob = new Blob(chunks, { type: 'audio/webm' });
    const arrBuf = await blob.arrayBuffer();
    try {
      lastBuffer = await AudioEngine.decodeFile(arrBuf);
      autoAssign();
      render(root);
    } catch (e) {
      alert('No se pudo decodificar la grabación.');
    }
  }

  // Ajusta automáticamente la toma al grid: detecta cuántos "compases" (vueltas del loop) caben
  // y calcula la velocidad de reproducción para que encaje exacto, al estilo looper en vivo.
  function autoFit(buffer) {
    const loopSeconds = Clock.stepSeconds() * State.project.patternLength;
    const loops = Math.max(1, Math.round(buffer.duration / loopSeconds));
    const isShort = buffer.duration < loopSeconds * 0.6;
    if (isShort) {
      return { syncMode: 'oneshot', playbackRate: 1, loops: 0 };
    }
    return { syncMode: 'loop', playbackRate: buffer.duration / (loops * loopSeconds), loops };
  }

  function autoAssign(forceMode) {
    if (!lastBuffer || !targetTrack) return;
    let info = autoFit(lastBuffer);
    if (forceMode === 'oneshot') info = { syncMode: 'oneshot', playbackRate: 1, loops: 0 };
    if (forceMode === 'loop' && info.syncMode !== 'loop') {
      const loopSeconds = Clock.stepSeconds() * State.project.patternLength;
      const loops = Math.max(1, Math.round(lastBuffer.duration / loopSeconds));
      info = { syncMode: 'loop', playbackRate: lastBuffer.duration / (loops * loopSeconds), loops };
    }
    lastInfo = info;
    targetTrack.sample = {
      buffer: lastBuffer,
      name: 'grabación ' + new Date().toLocaleTimeString(),
      trimStart: 0, trimEnd: lastBuffer.duration,
      syncMode: info.syncMode, playbackRate: info.playbackRate
    };
    document.dispatchEvent(new CustomEvent('sample:loaded', { detail: { track: targetTrack } }));

    // Pa'lante: salta al siguiente pad vacío para que la próxima toma no pise esta.
    const pads = State.padTracks();
    const curIdx = pads.findIndex(t => t.id === targetTrack.id);
    const next = pads.slice(curIdx + 1).find(t => !t.sample) || pads.find(t => !t.sample);
    if (next) targetTrack = next;
  }

  function showInfo() {
    const el = document.getElementById('rec-info');
    if (!el || !lastInfo) return;
    const desc = lastInfo.syncMode === 'loop'
      ? `Loop sincronizado · ${lastInfo.loops} vuelta(s) del grid`
      : 'One-shot (toma corta, sin estirar)';
    el.innerHTML = `<span>${desc}</span>
      <button class="mini-btn" id="force-oneshot">Forzar one-shot</button>
      <button class="mini-btn" id="force-loop">Forzar loop</button>`;
    el.querySelector('#force-oneshot').onclick = () => { autoAssign('oneshot'); showInfo(); };
    el.querySelector('#force-loop').onclick = () => { autoAssign('loop'); showInfo(); };
  }

  function drawWaveform(canvas, buffer) {
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = '#1b1f2a';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    const data = buffer.getChannelData(0);
    const step = Math.ceil(data.length / canvas.width);
    const mid = canvas.height / 2;
    ctx.strokeStyle = '#7ad1ff';
    ctx.beginPath();
    for (let x = 0; x < canvas.width; x++) {
      let min = 1, max = -1;
      for (let i = 0; i < step; i++) {
        const v = data[x * step + i] || 0;
        if (v < min) min = v;
        if (v > max) max = v;
      }
      ctx.moveTo(x, mid + min * mid);
      ctx.lineTo(x, mid + max * mid);
    }
    ctx.stroke();
  }

  return { render };
})();
