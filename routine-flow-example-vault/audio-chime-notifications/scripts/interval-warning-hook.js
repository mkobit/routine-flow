// Interval warning alert tone hook
// Synthesizes alert pings for milestone notifications or skipped intervals.

const AudioContextClass = window.AudioContext || window.webkitAudioContext;
if (AudioContextClass) {
  const ctx = new AudioContextClass();
  const tone = typeof context.params.tone === 'string' ? context.params.tone : 'warning';
  const freq = tone === 'skip' ? 329.63 : 880.0;
  const now = ctx.currentTime;

  const osc = ctx.createOscillator();
  const gain = ctx.createGain();

  osc.type = tone === 'skip' ? 'triangle' : 'sine';
  osc.frequency.setValueAtTime(freq, now);

  gain.gain.setValueAtTime(0.001, now);
  gain.gain.exponentialRampToValueAtTime(0.15, now + 0.02);
  gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.35);

  osc.connect(gain);
  gain.connect(ctx.destination);

  osc.start(now);
  osc.stop(now + 0.4);
}

return [];
