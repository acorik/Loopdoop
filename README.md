# LoopDoop

Estación de looping y sampler para navegador, pensada para controlarse con un **Akai MPD218** y correr fluida en Chromebooks de 4GB de RAM. Sin frameworks, sin build step: HTML + CSS + JS puro con Web Audio API y Web MIDI API.

## Cómo usarla

Ábrela sirviendo la carpeta con cualquier servidor estático (no funciona con `file://` por las APIs del navegador):

```bash
python3 -m http.server 8080
# abre http://localhost:8080
```

o súbela a GitHub Pages / Netlify / Vercel tal cual, es estática.

Conecta el MPD218 por USB antes de abrir la pestaña (o reconéctalo y recarga). Chrome pedirá permiso de MIDI.

## Modos

- **Drum Pad**: 16 pads tipo MPC. Doble clic o arrastra un audio para cargar una muestra en un pad. Los pads responden al MIDI del MPD218 (mapeo de fábrica por defecto: notas 36-51) y a clic/touch. Debajo, el grid de pasos programa el patrón de batería sincronizado al BPM.
- **Piano Roll**: editor de notas para tracks de sintetizador (osciladores con ADSR + filtro). Crea tracks synth nuevos con "+ Track synth".
- **Grabar**: activa el micrófono, graba, y asigna la toma a un pad. Puedes dejarla como *one-shot* o como *loop sincronizado*, que ajusta automáticamente la velocidad de reproducción para que encaje en 1/2/4/8 compases del proyecto — así cualquier captura de voz o instrumento cae en el grid "como si nada", al estilo looping de Fred again.
- **Mute/Secciones**: lanza escenas (patrones alternativos) en vivo —se encolan al siguiente compás—, silencia tracks sobre la marcha, y arma un "modo canción" encadenando escenas automáticamente.
- **Mixer**: fader, pan, mute/solo y una cadena de efectos por canal (filtro, drive, delay sincronizable, reverb, compresor) — el equivalente ligero a insertar plugins por canal.

## MIDI Learn

El botón "MIDI Learn" de la cabecera permite remapear cualquier pad (escribe el número 1-16) o knob (escribe `k1`..`k6`) a la nota o CC real que mande tu controlador, por si tu MPD218 tiene un mapeo de fábrica distinto al estándar.

## Proyectos

- **Guardar/Cargar**: persistencia local en IndexedDB (incluye las muestras grabadas).
- **Exportar/Importar**: genera un archivo `.loopdoop` (JSON) con todo el proyecto, para moverlo entre dispositivos o hacer backup.

## Rendimiento

Un único `AudioContext`, cadenas de efectos reutilizadas por canal, scheduler con técnica de *lookahead* (sin `setInterval` de alta frecuencia) y sin dependencias externas — pensado para ir fino incluso con 4GB de RAM.
