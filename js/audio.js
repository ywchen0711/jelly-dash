// Little synthesized sounds and a bouncy music loop, all made with WebAudio.
export class Sound {
  constructor() { this.ctx = null; this.vol = 0.7; this.musicOn = true; }
  init() {
    if (this.ctx) { if (this.ctx.state === 'suspended') this.ctx.resume(); return; }
    try { this.ctx = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { return; }
    this.master = this.ctx.createGain(); this.master.gain.value = this.vol; this.master.connect(this.ctx.destination);
    this.mus = this.ctx.createGain(); this.mus.gain.value = 0.22; this.mus.connect(this.master);
  }
  tone(f, d, type = 'sine', v = 0.3, slide = 0, delay = 0, dest) {
    const c = this.ctx; if (!c) return; const t = c.currentTime + delay;
    const o = c.createOscillator(), g = c.createGain(); o.type = type; o.frequency.setValueAtTime(f, t); if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(30, f * slide), t + d);
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(v, t + 0.01); g.gain.exponentialRampToValueAtTime(0.001, t + d);
    o.connect(g); g.connect(dest || this.master); o.start(t); o.stop(t + d + 0.05);
  }
  noise(d, v = 0.2, f = 1200, delay = 0) {
    const c = this.ctx; if (!c) return; const t = c.currentTime + delay;
    const b = c.createBuffer(1, Math.ceil(c.sampleRate * d), c.sampleRate), a = b.getChannelData(0); for (let i = 0; i < a.length; i++) a[i] = (Math.random() * 2 - 1) * (1 - i / a.length);
    const s = c.createBufferSource(); s.buffer = b; const fl = c.createBiquadFilter(); fl.type = 'bandpass'; fl.frequency.value = f; const g = c.createGain(); g.gain.value = v;
    s.connect(fl); fl.connect(g); g.connect(this.master); s.start(t);
  }
  sfx(k) {
    if (!this.ctx) return;
    switch (k) {
      case 'jump': this.tone(380, 0.18, 'sine', 0.25, 2.2); break;
      case 'dive': this.tone(600, 0.25, 'triangle', 0.2, 0.4); this.noise(0.2, 0.08, 2000); break;
      case 'land': this.tone(140, 0.08, 'sine', 0.18, 0.6); break;
      case 'bonk': this.tone(220, 0.25, 'square', 0.14, 0.35); this.noise(0.15, 0.15, 600); break;
      case 'boing': this.tone(200, 0.4, 'sine', 0.3, 3.5); break;
      case 'fall': this.tone(700, 0.8, 'sine', 0.2, 0.15); break;
      case 'count': this.tone(660, 0.18, 'square', 0.15); break;
      case 'go': this.tone(990, 0.4, 'square', 0.18); this.tone(1320, 0.4, 'square', 0.1, 0, 0.05); break;
      case 'qual': [523, 659, 784, 1046].forEach((f, i) => this.tone(f, 0.25, 'triangle', 0.22, 0, i * 0.08)); break;
      case 'out': [392, 330, 262].forEach((f, i) => this.tone(f, 0.3, 'triangle', 0.2, 0, i * 0.15)); break;
      case 'win': [523, 659, 784, 1046, 784, 1046, 1318].forEach((f, i) => this.tone(f, 0.3, 'triangle', 0.22, 0, i * 0.12)); break;
      case 'click': this.tone(880, 0.06, 'square', 0.1); break;
      case 'door': this.noise(0.3, 0.3, 400); this.tone(120, 0.3, 'sine', 0.2, 0.5); break;
      case 'tile': this.tone(520, 0.1, 'triangle', 0.08, 0.7); break;
    }
  }
  // a looping bouncy tune; restarts at each round
  music(on, fast) {
    if (!this.ctx) return;
    clearInterval(this.mt); if (!on || !this.musicOn) return;
    const notes = fast ? [0, 4, 7, 12, 7, 4, 0, 4, 5, 9, 12, 9, 7, 4, 2, 4] : [0, 7, 4, 7, 5, 9, 7, 4, 0, 7, 4, 7, 2, 5, 7, 11];
    const bass = [0, 0, 5, 5, 7, 7, 0, 0]; let i = 0; const step = fast ? 0.14 : 0.18, base = 392;
    this.mt = setInterval(() => {
      const f = base * Math.pow(2, notes[i % 16] / 12); this.tone(f, step * 0.9, 'triangle', 0.18, 0, 0, this.mus);
      if (i % 2 === 0) this.tone(base / 4 * Math.pow(2, bass[(i / 2) % 8] / 12), step * 1.8, 'sine', 0.35, 0, 0, this.mus);
      if (i % 4 === 2) this.noise(0.05, 0.05, 5000);
      i++;
    }, step * 1000);
  }
}
