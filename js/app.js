// Arranque de la aplicación.
(function () {
  State.project = State.newProject('Nuevo proyecto');
  Clock.setBpm(State.project.bpm);
  Clock.setSwing(State.project.swing);
  Clock.setStepsPerBar(State.project.patternLength);
  UI.init();
  Midi.init();
})();
