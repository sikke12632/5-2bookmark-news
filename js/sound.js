// 소리: 파일 없이 Web Audio로 그때그때 만든다. 기본은 꺼짐(교실).
window.SND = (() => {
  let ctx = null, on = false;
  function ac() {
    if (!ctx) ctx = new (window.AudioContext || window.webkitAudioContext)();
    if (ctx.state === 'suspended') ctx.resume();
    return ctx;
  }
  function noise(dur, filterFreq, gain, type = 'lowpass') {
    const a = ac(), n = Math.floor(a.sampleRate * dur);
    const buf = a.createBuffer(1, n, a.sampleRate), d = buf.getChannelData(0);
    for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / n);
    const src = a.createBufferSource(); src.buffer = buf;
    const f = a.createBiquadFilter(); f.type = type; f.frequency.value = filterFreq;
    const g = a.createGain(); g.gain.value = gain;
    src.connect(f).connect(g).connect(a.destination); src.start();
  }
  function tone(freq, dur, gain, type = 'sine', slide = 0) {
    const a = ac(), t = a.currentTime;
    const o = a.createOscillator(); o.type = type; o.frequency.setValueAtTime(freq, t);
    if (slide) o.frequency.exponentialRampToValueAtTime(slide, t + dur);
    const g = a.createGain(); g.gain.setValueAtTime(gain, t); g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    o.connect(g).connect(a.destination); o.start(t); o.stop(t + dur);
  }
  const fx = {
    stamp() { tone(120, 0.25, 0.5, 'sine', 50); noise(0.12, 900, 0.5); },
    pen() { noise(0.18, 3200, 0.12, 'bandpass'); },
    tick() { tone(1800, 0.03, 0.08, 'square'); },
    paper() { noise(0.3, 1800, 0.15, 'bandpass'); },
    good() { tone(660, 0.15, 0.15, 'triangle'); setTimeout(() => tone(880, 0.2, 0.15, 'triangle'), 110); },
    bad() { tone(220, 0.25, 0.15, 'triangle', 160); },
    bell() { tone(1046, 0.8, 0.12, 'triangle'); setTimeout(() => tone(784, 1, 0.12, 'triangle'), 180); },
  };
  return {
    get on() { return on; },
    toggle() { on = !on; if (on) { ac(); fx.paper(); } return on; },
    play(name) { if (on && fx[name]) try { fx[name](); } catch (e) {} },
  };
})();
