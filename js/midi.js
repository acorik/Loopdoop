// MIDI: conexión Web MIDI + mapeo del Akai MPD218 (pads, knobs) + modo "learn".
const Midi = (() => {
  let input = null;
  let output = null;
  let onNote = null;   // (note, velocity, isOn) => {}
  let onCC = null;     // (cc, value) => {}
  let learning = null; // {kind:'note'|'cc', callback}
  let connected = false;

  // Mapeo por defecto del MPD218 de fábrica (banco A, notas 36-51; CC 1-6/7-12/13-18 según banco).
  const DEFAULT_MAP = {
    padNotes: [36,37,38,39,40,41,42,43,44,45,46,47,48,49,50,51],
    knobCCs: [1,2,3,4,5,6]
  };

  let map = JSON.parse(localStorage.getItem('loopdoop_midimap') || 'null') || JSON.parse(JSON.stringify(DEFAULT_MAP));

  function saveMap() {
    localStorage.setItem('loopdoop_midimap', JSON.stringify(map));
  }

  function handleMessage(ev) {
    const [status, d1, d2] = ev.data;
    const type = status & 0xf0;
    if (type === 0x90 || type === 0x80) { // note on/off
      const isOn = type === 0x90 && d2 > 0;
      if (learning && learning.kind === 'note') {
        learning.callback(d1);
        learning = null;
        return;
      }
      onNote && onNote(d1, d2 / 127, isOn);
    } else if (type === 0xb0) { // control change
      if (learning && learning.kind === 'cc') {
        learning.callback(d1);
        learning = null;
        return;
      }
      onCC && onCC(d1, d2 / 127);
    }
  }

  async function init() {
    if (!navigator.requestMIDIAccess) {
      console.warn('Web MIDI no disponible en este navegador.');
      return false;
    }
    try {
      const access = await navigator.requestMIDIAccess();
      attachInputs(access);
      access.onstatechange = () => attachInputs(access);
      return true;
    } catch (e) {
      console.warn('MIDI denegado', e);
      return false;
    }
  }

  function attachInputs(access) {
    for (const inp of access.inputs.values()) {
      inp.onmidimessage = handleMessage;
    }
    const inputs = [...access.inputs.values()];
    connected = inputs.length > 0;
    document.dispatchEvent(new CustomEvent('midi:status', { detail: { connected, names: inputs.map(i=>i.name) } }));
  }

  function learn(kind, callback) {
    learning = { kind, callback };
  }

  function cancelLearn() { learning = null; }

  function padIndexFromNote(note) {
    return map.padNotes.indexOf(note);
  }
  function knobIndexFromCC(cc) {
    return map.knobCCs.indexOf(cc);
  }

  function setPadNote(padIndex, note) {
    map.padNotes[padIndex] = note;
    saveMap();
  }
  function setKnobCC(knobIndex, cc) {
    map.knobCCs[knobIndex] = cc;
    saveMap();
  }
  function resetDefault() {
    map = JSON.parse(JSON.stringify(DEFAULT_MAP));
    saveMap();
  }

  return {
    init, learn, cancelLearn,
    set onNote(fn) { onNote = fn; },
    set onCC(fn) { onCC = fn; },
    padIndexFromNote, knobIndexFromCC,
    setPadNote, setKnobCC, resetDefault,
    get map() { return map; },
    get isConnected() { return connected; }
  };
})();
