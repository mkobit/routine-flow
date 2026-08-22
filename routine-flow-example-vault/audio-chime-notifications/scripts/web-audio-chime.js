// Web Audio synthesizer chime hook
// Synthesizes pleasant multi-oscillator chords with exponential gain decay.

const AudioContextClass = window.AudioContext || window.webkitAudioContext;
if (AudioContextClass) {
  const ctx = new AudioContextClass();
  const baseFreq = typeof context.params.baseFreq === 'number' ? context.params.baseFreq : 523.25;
  const chordType = typeof context.params.chord === 'string' ? context.params.chord : 'major';

  // Define frequency intervals based on requested chord type
  const intervals = chordType === 'fanfare'
    ? [1.0, 1.25, 1.5, 2.0] // Major arpeggio + octave
    : chordType === 'restorative'
      ? [1.0, 1.333, 1.5] // Subdominant fifth
      : chordType === 'soft'
        ? [1.0, 1.2] // Minor third
        : [1.0, 1.25, 1.5]; // Major triad

  const now = ctx.currentTime;
  intervals.forEach((ratio, index) => {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(baseFreq * ratio, now + index * 0.08);

    // Envelope: quick attack followed by natural exponential decay
    gain.gain.setValueAtTime(0.001, now + index * 0.08);
    gain.gain.exponentialRampToValueAtTime(0.2 / intervals.length, now + index * 0.08 + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + index * 0.08 + 0.8);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(now + index * 0.08);
    osc.stop(now + index * 0.08 + 0.85);
  });
}

return [];
