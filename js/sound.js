// Synthesised sound design: no audio files. Off until the visitor turns it on.
let ctx = null, master = null, ambient = null;
export const sound = {
  on: false,
  async toggle() {
    this.on = !this.on;
    if (this.on) {
      if (!ctx) init();
      if (ctx.state === 'suspended') await ctx.resume();
      master.gain.cancelScheduledValues(ctx.currentTime);
      master.gain.linearRampToValueAtTime(0.9, ctx.currentTime + 0.4);
      this.clink(0.5);
    } else if (ctx) {
      master.gain.linearRampToValueAtTime(0, ctx.currentTime + 0.3);
    }
    return this.on;
  },
  // bell-like glass clink: inharmonic partials with fast decay
  clink(vel = 1, pitch = 1) {
    if (!this.on || !ctx) return;
    const t = ctx.currentTime;
    [[2280, 1], [3420, 0.6], [5190, 0.35], [6910, 0.2], [1610, 0.25]].forEach(([f, a], i) => {
      const o = ctx.createOscillator(), g = ctx.createGain();
      o.type = 'sine';
      o.frequency.value = f * pitch * (1 + (Math.random() - 0.5) * 0.01);
      g.gain.setValueAtTime(0, t);
      g.gain.linearRampToValueAtTime(0.16 * a * vel, t + 0.002);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.9 + 0.5 / (i + 1));
      o.connect(g).connect(master);
      o.start(t); o.stop(t + 1.6);
    });
  },
  ice() { this.clink(0.5, 0.55); setTimeout(() => this.clink(0.25, 0.62), 90); },
  // a short filtered-noise pour
  pour(dur = 1.2) {
    if (!this.on || !ctx) return;
    const t = ctx.currentTime;
    const src = ctx.createBufferSource(); src.buffer = noiseBuf(dur + 0.2);
    const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.Q.value = 1.4;
    bp.frequency.setValueAtTime(700, t); bp.frequency.linearRampToValueAtTime(1500, t + dur);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(0.18, t + 0.08);
    g.gain.setValueAtTime(0.18, t + dur - 0.2); g.gain.linearRampToValueAtTime(0, t + dur);
    src.connect(bp).connect(g).connect(master);
    src.start(t); src.stop(t + dur + 0.1);
  },
  tick() {
    if (!this.on || !ctx) return;
    const t = ctx.currentTime, o = ctx.createOscillator(), g = ctx.createGain();
    o.frequency.value = 3200; o.type = 'triangle';
    g.gain.setValueAtTime(0.03, t); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.05);
    o.connect(g).connect(master); o.start(t); o.stop(t + 0.06);
  },
  whoosh() {
    if (!this.on || !ctx) return;
    const t = ctx.currentTime, src = ctx.createBufferSource(); src.buffer = noiseBuf(0.8);
    const f = ctx.createBiquadFilter(); f.type = 'lowpass';
    f.frequency.setValueAtTime(300, t); f.frequency.exponentialRampToValueAtTime(2400, t + 0.35); f.frequency.exponentialRampToValueAtTime(200, t + 0.7);
    const g = ctx.createGain(); g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(0.12, t + 0.25); g.gain.linearRampToValueAtTime(0, t + 0.7);
    src.connect(f).connect(g).connect(master); src.start(t); src.stop(t + 0.8);
  },
};

function init() {
  ctx = new (window.AudioContext || window.webkitAudioContext)();
  master = ctx.createGain(); master.gain.value = 0;
  const comp = ctx.createDynamicsCompressor();
  // small room reverb
  const conv = ctx.createConvolver(); conv.buffer = impulse(1.8);
  const wet = ctx.createGain(); wet.gain.value = 0.28;
  master.connect(comp); master.connect(conv).connect(wet).connect(comp);
  comp.connect(ctx.destination);
  // warm ambient bed: two detuned low tones through a lowpass
  ambient = ctx.createGain(); ambient.gain.value = 0.018;
  const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 420;
  [110, 164.8, 220.4].forEach((f) => {
    const o = ctx.createOscillator(); o.type = 'sawtooth'; o.frequency.value = f;
    const lfo = ctx.createOscillator(), lg = ctx.createGain(); lfo.frequency.value = 0.07 + Math.random() * 0.05; lg.gain.value = 1.5;
    lfo.connect(lg).connect(o.frequency); lfo.start(); o.connect(lp); o.start();
  });
  lp.connect(ambient).connect(master);
}
function noiseBuf(sec) {
  const b = ctx.createBuffer(1, ctx.sampleRate * sec, ctx.sampleRate), d = b.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  return b;
}
function impulse(sec) {
  const len = ctx.sampleRate * sec, b = ctx.createBuffer(2, len, ctx.sampleRate);
  for (let c = 0; c < 2; c++) { const d = b.getChannelData(c); for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 3); }
  return b;
}
