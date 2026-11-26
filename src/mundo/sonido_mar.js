// ── MAR SONORO: océano, gaviotas y campana de puerto, 100% sintetizados con WebAudio ──
// Cero assets: el rumor del mar es ruido marrón filtrado con respiración lenta; las
// gaviotas son barridos de onda triangular; la campana, tres armónicos que decaen.
// El sonido exige un gesto del usuario: nada suena hasta el primer clic en el toggle.
(function (G) {
  'use strict';
  const SON = G.MARSON = { activo: false, _ctx: null, _master: null, _olas: null };
  let ruidoBuf = null, temporizador = null, ultimaIsla = null, ultimoCuerpo = '';

  function ctxAudio() {
    if (!SON._ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return null;
      SON._ctx = new AC();
      SON._master = SON._ctx.createGain();
      SON._master.gain.value = 0.5;
      SON._master.connect(SON._ctx.destination);
    }
    return SON._ctx;
  }

  // ruido marrón en bucle: la base del rumor del mar
  function bufferOlas(ac) {
    const dur = 4, b = ac.createBuffer(1, ac.sampleRate * dur, ac.sampleRate), d = b.getChannelData(0);
    let ult = 0;
    for (let i = 0; i < d.length; i++) {
      const bl = Math.random() * 2 - 1;
      ult = (ult + 0.02 * bl) / 1.02;
      d[i] = ult * 3.2;
    }
    return b;
  }

  function arrancaOlas() {
    const ac = ctxAudio();
    if (!ac || SON._olas) return;
    const fuente = ac.createBufferSource();
    fuente.buffer = ruidoBuf || (ruidoBuf = bufferOlas(ac));
    fuente.loop = true;
    const filtro = ac.createBiquadFilter(); filtro.type = 'lowpass'; filtro.frequency.value = 520;
    const gain = ac.createGain(); gain.gain.value = 0.16;
    fuente.connect(filtro); filtro.connect(gain); gain.connect(SON._master);
    fuente.start();
    // la respiración del mar: el filtro y el volumen suben y bajan despacio
    const lfo1 = ac.createOscillator(), lg1 = ac.createGain();
    lfo1.frequency.value = 0.07; lg1.gain.value = 260;
    lfo1.connect(lg1); lg1.connect(filtro.frequency); lfo1.start();
    const lfo2 = ac.createOscillator(), lg2 = ac.createGain();
    lfo2.frequency.value = 0.045; lg2.gain.value = 0.05;
    lfo2.connect(lg2); lg2.connect(gain.gain); lfo2.start();
    SON._olas = { fuente, filtro, gain };
  }

  function gaviota() { // tres notas descendentes, lejos sobre la cubierta
    const ac = ctxAudio();
    if (!ac) return;
    const t0 = ac.currentTime + 0.05;
    for (let k = 0; k < 3; k++) {
      const o = ac.createOscillator(), g = ac.createGain(), f = ac.createBiquadFilter();
      f.type = 'bandpass'; f.frequency.value = 1400; f.Q.value = 2;
      o.type = 'triangle';
      const base = 1250 - k * 130, ini = t0 + k * 0.16;
      o.frequency.setValueAtTime(base, ini);
      o.frequency.exponentialRampToValueAtTime(base * 0.82, ini + 0.13);
      g.gain.setValueAtTime(0, ini);
      g.gain.linearRampToValueAtTime(0.055, ini + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, ini + 0.15);
      o.connect(f); f.connect(g); g.connect(SON._master);
      o.start(ini); o.stop(ini + 0.16);
    }
  }

  function campana() { // llegada a puerto: golpe de campana con decaimiento largo
    const ac = ctxAudio();
    if (!ac) return;
    const t0 = ac.currentTime;
    [660, 1320, 1980].forEach((hz, k) => {
      const o = ac.createOscillator(), g = ac.createGain();
      o.type = 'sine'; o.frequency.value = hz;
      g.gain.setValueAtTime(k ? 0.05 / k : 0.14, t0);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + 1.6 - k * 0.4);
      o.connect(g); g.connect(SON._master);
      o.start(t0); o.stop(t0 + 1.7);
    });
  }
  SON.campana = campana;

  function latido() { // el reloj del mar: gaviotas al azar + campana al cambiar de isla
    if (!SON.activo) return;
    if (Math.random() < 0.42) gaviota();
    const sim = G.JUEGO && G.JUEGO.sim, isl = sim && sim.user && sim.user.isl;
    if (isl && ultimaIsla && isl !== ultimaIsla) campana();
    ultimaIsla = isl;
  }

  SON.alternar = function () {
    SON.activo = !SON.activo;
    try { localStorage.setItem('mar-sonido', SON.activo ? '1' : '0'); } catch (e) { /* privado */ }
    if (SON.activo) {
      const ac = ctxAudio();
      if (ac && ac.state === 'suspended') ac.resume();
      if (SON._master) SON._master.gain.value = 0.5;
      arrancaOlas();
      if (!temporizador) temporizador = setInterval(latido, 9000);
      latido();
    } else if (SON._master) {
      SON._master.gain.value = 0;
    }
    pintaBoton();
    return SON.activo;
  };

  // el toggle: un chip flotante, hermano del engranaje, vivo solo en el modo mundo
  function pintaBoton() {
    let b = document.getElementById('mar-sonido-btn');
    if (!b) {
      b = document.createElement('button');
      b.id = 'mar-sonido-btn';
      b.type = 'button';
      b.setAttribute('aria-label', 'Sonido del mar');
      b.title = 'Sonido del mar (olas, gaviotas, campana)';
      b.style.cssText = 'position:fixed;top:64px;right:14px;z-index:2100;width:44px;height:44px;border-radius:12px;' +
        'border:1px solid rgba(244,180,26,.35);background:rgba(11,19,41,.9);color:#f4b41a;font-size:17px;' +
        'line-height:1;cursor:pointer;transition:background .2s,color .2s,opacity .3s';
      b.addEventListener('click', SON.alternar);
      const pegar = () => { if (document.body) document.body.append(b); else setTimeout(pegar, 400); };
      pegar();
    }
    b.textContent = SON.activo ? '🔊' : '🔇';
    const vivo = document.body && document.body.classList.contains('mil-live-mode');
    b.style.opacity = vivo ? '1' : '0';
    b.style.pointerEvents = vivo ? 'auto' : 'none';
  }

  if (SON.activo) { SON.activo = false; } // nunca arrancar sonido sin gesto: el toggle lo enciende
  try { if (localStorage.getItem('mar-sonido') === '1') SON.activo = false; } catch (e) { /* privado */ }
  pintaBoton();
  setInterval(pintaBoton, 1200);
})(typeof window !== 'undefined' ? window : globalThis);
