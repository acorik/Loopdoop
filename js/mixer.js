// Mixer: fader/pan por canal + FX (filtro, drive, delay, reverb, compresor) por canal.
const Mixer = (() => {
  let root = null;

  function render(container) {
    root = container;
    root.innerHTML = '';
    root.className = 'mode-mixer';
    State.project.tracks.forEach(t => root.appendChild(buildStrip(t)));
  }

  function buildStrip(track) {
    const strip = document.createElement('div');
    strip.className = 'mixer-strip';
    strip.style.setProperty('--pad-color', track.color);

    strip.innerHTML = `<div class="mixer-name">${track.name}</div>`;

    const vol = document.createElement('input');
    vol.type = 'range'; vol.min = 0; vol.max = 1; vol.step = 0.01; vol.value = track.volume;
    vol.className = 'fader';
    vol.oninput = () => { track.volume = parseFloat(vol.value); Tracks.refreshAllVolumes(); };
    strip.appendChild(vol);

    const pan = document.createElement('input');
    pan.type = 'range'; pan.min = -1; pan.max = 1; pan.step = 0.01; pan.value = track.pan;
    pan.className = 'pan-knob';
    pan.oninput = () => { track.pan = parseFloat(pan.value); Tracks.refreshAllVolumes(); };
    strip.appendChild(pan);

    const btnRow = document.createElement('div');
    btnRow.className = 'mixer-btn-row';
    const muteBtn = document.createElement('button');
    muteBtn.className = 'mini-btn' + (track.mute ? ' active' : '');
    muteBtn.textContent = 'M';
    muteBtn.onclick = () => { track.mute = !track.mute; Tracks.refreshAllVolumes(); muteBtn.classList.toggle('active', track.mute); };
    const soloBtn = document.createElement('button');
    soloBtn.className = 'mini-btn' + (track.solo ? ' active' : '');
    soloBtn.textContent = 'S';
    soloBtn.onclick = () => { track.solo = !track.solo; Tracks.refreshAllVolumes(); soloBtn.classList.toggle('active', track.solo); };
    btnRow.append(muteBtn, soloBtn);
    strip.appendChild(btnRow);

    strip.appendChild(buildFxPanel(track));
    return strip;
  }

  function fxRow(labelText, checked, onToggle, controls) {
    const row = document.createElement('div');
    row.className = 'fx-row';
    const label = document.createElement('label');
    const chk = document.createElement('input');
    chk.type = 'checkbox'; chk.checked = checked;
    chk.onchange = () => onToggle(chk.checked);
    label.append(chk, ' ' + labelText);
    row.appendChild(label);
    controls.forEach(c => row.appendChild(c));
    return row;
  }

  function slider(min, max, step, value, onChange) {
    const s = document.createElement('input');
    s.type = 'range'; s.min = min; s.max = max; s.step = step; s.value = value;
    s.className = 'fx-slider';
    s.oninput = () => onChange(parseFloat(s.value));
    return s;
  }

  function buildFxPanel(track) {
    const panel = document.createElement('div');
    panel.className = 'fx-panel';
    const fx = track.fx;

    panel.appendChild(fxRow('Filtro', fx.filter.on, v => { fx.filter.on = v; Tracks.updateFx(track); }, [
      (() => {
        const sel = document.createElement('select');
        ['lowpass','highpass','bandpass'].forEach(t => {
          const opt = document.createElement('option'); opt.value = t; opt.textContent = t;
          if (fx.filter.type === t) opt.selected = true;
          sel.appendChild(opt);
        });
        sel.onchange = () => { fx.filter.type = sel.value; Tracks.updateFx(track); };
        return sel;
      })(),
      slider(40, 20000, 1, fx.filter.freq, v => { fx.filter.freq = v; Tracks.updateFx(track); })
    ]));

    panel.appendChild(fxRow('Drive', fx.drive.on, v => { fx.drive.on = v; Tracks.updateFx(track); }, [
      slider(0, 1, 0.01, fx.drive.amount, v => { fx.drive.amount = v; Tracks.updateFx(track); }),
      slider(0, 1, 0.01, fx.drive.mix, v => { fx.drive.mix = v; Tracks.updateFx(track); })
    ]));

    panel.appendChild(fxRow('Delay', fx.delay.on, v => { fx.delay.on = v; Tracks.updateFx(track); }, [
      slider(0.02, 1.5, 0.01, fx.delay.time, v => { fx.delay.time = v; Tracks.updateFx(track); }),
      slider(0, 0.95, 0.01, fx.delay.feedback, v => { fx.delay.feedback = v; Tracks.updateFx(track); }),
      slider(0, 1, 0.01, fx.delay.mix, v => { fx.delay.mix = v; Tracks.updateFx(track); })
    ]));

    panel.appendChild(fxRow('Reverb', fx.reverb.on, v => { fx.reverb.on = v; Tracks.updateFx(track); }, [
      slider(0, 1, 0.01, fx.reverb.mix, v => { fx.reverb.mix = v; Tracks.updateFx(track); })
    ]));

    panel.appendChild(fxRow('Comp', fx.comp.on, v => { fx.comp.on = v; Tracks.updateFx(track); }, [
      slider(-60, 0, 1, fx.comp.threshold, v => { fx.comp.threshold = v; Tracks.updateFx(track); }),
      slider(1, 20, 1, fx.comp.ratio, v => { fx.comp.ratio = v; Tracks.updateFx(track); })
    ]));

    return panel;
  }

  return { render };
})();
