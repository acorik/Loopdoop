// Persistencia: guardar/cargar proyectos en IndexedDB y exportar/importar como archivo .loopdoop (JSON).
const Project = (() => {
  const DB_NAME = 'loopdoop';
  const STORE = 'projects';
  let db = null;

  function openDb() {
    return new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, 1);
      req.onupgradeneeded = () => {
        req.result.createObjectStore(STORE, { keyPath: 'id' });
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }

  async function getDb() {
    if (!db) db = await openDb();
    return db;
  }

  function audioBufferToWavBase64(buffer) {
    const numCh = buffer.numberOfChannels;
    const len = buffer.length;
    const sampleRate = buffer.sampleRate;
    const bytesPerSample = 2;
    const blockAlign = numCh * bytesPerSample;
    const dataSize = len * blockAlign;
    const bufOut = new ArrayBuffer(44 + dataSize);
    const view = new DataView(bufOut);
    function writeStr(off, s) { for (let i = 0; i < s.length; i++) view.setUint8(off + i, s.charCodeAt(i)); }
    writeStr(0, 'RIFF'); view.setUint32(4, 36 + dataSize, true); writeStr(8, 'WAVE');
    writeStr(12, 'fmt '); view.setUint32(16, 16, true); view.setUint16(20, 1, true);
    view.setUint16(22, numCh, true); view.setUint32(24, sampleRate, true);
    view.setUint32(28, sampleRate * blockAlign, true); view.setUint16(32, blockAlign, true);
    view.setUint16(34, 16, true); writeStr(36, 'data'); view.setUint32(40, dataSize, true);

    const channels = [];
    for (let c = 0; c < numCh; c++) channels.push(buffer.getChannelData(c));
    let offset = 44;
    for (let i = 0; i < len; i++) {
      for (let c = 0; c < numCh; c++) {
        let s = Math.max(-1, Math.min(1, channels[c][i]));
        s = s < 0 ? s * 0x8000 : s * 0x7fff;
        view.setInt16(offset, s, true);
        offset += 2;
      }
    }
    const bytes = new Uint8Array(bufOut);
    let binary = '';
    const chunk = 0x8000;
    for (let i = 0; i < bytes.length; i += chunk) {
      binary += String.fromCharCode.apply(null, bytes.subarray(i, i + chunk));
    }
    return 'data:audio/wav;base64,' + btoa(binary);
  }

  async function base64WavToAudioBuffer(dataUrl) {
    const resp = await fetch(dataUrl);
    const arrBuf = await resp.arrayBuffer();
    return AudioEngine.decodeFile(arrBuf);
  }

  async function serialize() {
    const proj = State.project;
    const clone = JSON.parse(JSON.stringify(proj, (key, val) => (key === 'nodes' || key === 'buffer') ? undefined : val));
    for (let i = 0; i < proj.tracks.length; i++) {
      const t = proj.tracks[i];
      if (t.type === 'pad' && t.sample && t.sample.buffer) {
        clone.tracks[i].sample.audioData = audioBufferToWavBase64(t.sample.buffer);
      }
    }
    return clone;
  }

  async function deserialize(clone) {
    for (const t of clone.tracks) {
      if (t.type === 'pad' && t.sample && t.sample.audioData) {
        t.sample.buffer = await base64WavToAudioBuffer(t.sample.audioData);
        delete t.sample.audioData;
      }
      t.nodes = null;
    }
    return clone;
  }

  async function save() {
    const data = await serialize();
    const d = await getDb();
    return new Promise((resolve, reject) => {
      const tx = d.transaction(STORE, 'readwrite');
      tx.objectStore(STORE).put(data);
      tx.oncomplete = () => resolve(true);
      tx.onerror = () => reject(tx.error);
    });
  }

  async function listSaved() {
    const d = await getDb();
    return new Promise((resolve, reject) => {
      const tx = d.transaction(STORE, 'readonly');
      const req = tx.objectStore(STORE).getAll();
      req.onsuccess = () => resolve(req.result.map(p => ({ id: p.id, name: p.name })));
      req.onerror = () => reject(req.error);
    });
  }

  async function loadById(id) {
    const d = await getDb();
    return new Promise((resolve, reject) => {
      const tx = d.transaction(STORE, 'readonly');
      const req = tx.objectStore(STORE).get(id);
      req.onsuccess = async () => {
        if (!req.result) return resolve(null);
        resolve(await deserialize(req.result));
      };
      req.onerror = () => reject(req.error);
    });
  }

  async function exportFile() {
    const data = await serialize();
    const blob = new Blob([JSON.stringify(data)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = (data.name || 'proyecto') + '.loopdoop';
    a.click();
    URL.revokeObjectURL(url);
  }

  function importFile(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = async () => {
        try {
          const data = JSON.parse(reader.result);
          resolve(await deserialize(data));
        } catch (e) { reject(e); }
      };
      reader.onerror = reject;
      reader.readAsText(file);
    });
  }

  return { save, listSaved, loadById, exportFile, importFile };
})();
