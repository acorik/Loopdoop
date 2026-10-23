// Modo Grabación: captura por micrófono, recorte, y ajuste automático al BPM del proyecto.
const ModeRecord = (() => {
  let root = null;
  let stream = null;
  let recorder = null;
  let chunks = [];
  let lastBuffer = null;
  let trimStart = 0, trimEnd = 0;
  let targetTrack = null;

  function render(container) {
    root = container;
    root.innerHTML = '';
    root.className = 'mode-record';

    const bar = document.createElement('div');
    bar.className = 'rec-toolbar';

    const armBtn = document.createElement('button');
    armBtn.className = 'mini-btn';
    armBtn.textContent = '🎙 Activar micro';
    armBtn.onclick = arm;
    bar.appendChild(armBtn);

    const recBtn = document.createElement('button');
    recBtn.className = 'mini-btn rec-btn';
    recBtn.textContent = '● Grabar';
    recBtn.onclick = () => toggleRecord(recBtn);
    bar.appendChild(recBtn);

    root.appendChild(bar);

    const targetRow = document.createElement('div');
    targetRow.className = 'rec-target';
    targetRow.innerHTML = '<span>Destino:</span>';
    const sel = document.createElement('select');
    State.padTracks().forEach(t => {
      const opt = document.createElement('option'); opt.value = t.id; opt.textContent = t.name;
      sel.appendChild(opt);
    });
    sel.onchange = () => { targetTrack = State.trackById(sel.value); };
    targetTrack = State.trackById(sel.value);
    targetRow.appendChild(sel);
    root.appendChild(targetRow);

    const canvas = document.createElement('canvas');
    canvas.className = 'rec-waveform';
    canvas.width = 900; canvas.height = 160;
    root.appendChild(canvas);

    const syncRow = document.createElement('div');
    syncRow.className = 'rec-sync';
    syncRow.innerHTML = `
      <label><input type="radio" name="syncmode" value="oneshot" checked> One-shot</label>
      <label><input type="radio" name="syncmode" value="loop"> Loop sincronizado</label>
      <span>Compases: </span>
      <select id="rec-bars"><option>1</option><option>2</option><option selected>4</option><option>8</option></select>
      <button class="mini-btn" id="rec-assign">Asignar al pad</button>
    `;
    root.appendChild(syncRow);

    if (lastBuffer) drawWaveform(canvas, lastBuffer);

    root.querySelector('#rec-assign').onclick = assignToPad;
  }

  async function arm() {
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch (e) {
      alert('No se pudo acceder al micrófono: ' + e.message);
    }
  }

  async function toggleRecord(btn) {
    if (!stream) await arm();
    if (!stream) return;
    if (recorder && recorder.state === 'recording') {
      recorder.stop();
      btn.classList.remove('active');
      return;
    }
    chunks = [];
    recorder = new MediaRecorder(stream);
    recorder.ondataavailable = (e) => chunks.push(e.data);
    recorder.onstop = onRecordStop;
    recorder.start();
    btn.classList.add('active');
  }

  async function onRecordStop() {
    const blob = new Blob(chunks, { type: 'audio/webm' });
    const arrBuf = await blob.arrayBuffer();
    try {
      lastBuffer = await AudioEngine.decodeFile(arrBuf);
      trimStart = 0; trimEnd = lastBuffer.duration;
      render(root);
    } catch (e) {
      alert('No se pudo decodificar la grabación.');
    }
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

  function assignToPad() {
    if (!lastBuffer || !targetTrack) return;
    const syncMode = root.querySelector('input[name="syncmode"]:checked').value;
    const bars = parseInt(root.querySelector('#rec-bars').value, 10);
    let playbackRate = 1;
    if (syncMode === 'loop') {
      const stepsPerBar = State.project.patternLength;
      const barSeconds = Clock.stepSeconds() * stepsPerBar;
      const targetDuration = barSeconds * bars;
      playbackRate = lastBuffer.duration / targetDuration;
    }
    targetTrack.sample = {
      buffer: lastBuffer,
      name: 'grabación ' + new Date().toLocaleTimeString(),
      trimStart, trimEnd,
      syncMode, playbackRate
    };
    alert('Muestra asignada a ' + targetTrack.name);
  }

  return { render };
})();
