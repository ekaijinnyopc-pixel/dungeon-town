/* =========================================================
   DUNGEON TOWN — audio
   เสียงทั้งหมด "สังเคราะห์" ด้วย WebAudio เอง ไม่ใช้ไฟล์เสียงภายนอก
   → ไฟล์เกมเดียวเล่นออฟไลน์ได้ ไม่ต้องโหลด asset เพิ่ม
   ========================================================= */
(function (root) {
  'use strict';
  var DT = root.DT || (root.DT = {});

  var ctx = null;         // AudioContext
  var master = null;      // master gain
  var sfxGain = null;     // เสียงผล
  var ambGain = null;     // เสียงบรรยากาศ
  var muted = false;
  var ready = false;
  var noiseBuf = null;    // buffer เสียงฝนสุ่ม (ใช้ซ้ำ)
  var ambNodes = [];      // node ของเสียงบรรยากาศที่กำลังเล่น
  var lastPlay = {};      // กันเสียงซ้ำติดกันเกินไป

  /* ---------- ตั้งค่าครั้งแรก (ต้องเรียกหลัง user gesture) ---------- */
  function init() {
    if (ready) return true;
    try {
      var AC = root.AudioContext || root.webkitAudioContext;
      if (!AC) return false;
      ctx = new AC();
      master = ctx.createGain();
      master.gain.value = 0.85;
      master.connect(ctx.destination);

      sfxGain = ctx.createGain();
      sfxGain.gain.value = 0.7;
      sfxGain.connect(master);

      ambGain = ctx.createGain();
      ambGain.gain.value = 0.0;
      ambGain.connect(master);

      /* buffer ฝน (2 วินาที) */
      var len = Math.floor(ctx.sampleRate * 2);
      noiseBuf = ctx.createBuffer(1, len, ctx.sampleRate);
      var d = noiseBuf.getChannelData(0);
      for (var i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;

      ready = true;
      return true;
    } catch (e) {
      ready = false;
      return false;
    }
  }

  function resume() {
    if (!ctx) return;
    if (ctx.state === 'suspended') {
      try { ctx.resume(); } catch (e) { }
    }
  }

  /* ---------- เครื่องมือเสียงพื้นฐาน ---------- */

  /* เสียง "บี๊บ" สั้น (เสียงกระทบ) */
  function tone(freq, dur, type, vol, slideTo, delay) {
    if (!ready || muted) return;
    resume();
    var t0 = ctx.currentTime + (delay || 0);
    var o = ctx.createOscillator();
    var g = ctx.createGain();
    o.type = type || 'sine';
    o.frequency.setValueAtTime(freq, t0);
    if (slideTo) o.frequency.exponentialRampToValueAtTime(Math.max(20, slideTo), t0 + dur);
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(Math.max(0.0002, vol || 0.2), t0 + Math.min(0.02, dur * 0.3));
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    o.connect(g); g.connect(sfxGain);
    o.start(t0); o.stop(t0 + dur + 0.02);
  }

  /* เสียงหยาบ (ตี/ขุด) */
  function noise(dur, vol, filterFreq, delay) {
    if (!ready || muted) return;
    resume();
    var t0 = ctx.currentTime + (delay || 0);
    var s = ctx.createBufferSource();
    s.buffer = noiseBuf;
    s.loop = true;
    var f = ctx.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.setValueAtTime(filterFreq || 1200, t0);
    f.frequency.exponentialRampToValueAtTime(Math.max(80, (filterFreq || 1200) * 0.25), t0 + dur);
    var g = ctx.createGain();
    g.gain.setValueAtTime(vol || 0.15, t0);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    s.connect(f); f.connect(g); g.connect(sfxGain);
    s.start(t0); s.stop(t0 + dur + 0.02);
  }

  /* เสียงต้นไม้กระพริบ / เสียงหายใบ */
  function leafRustle(vol) {
    if (!ready || muted) return;
    resume();
    var t0 = ctx.currentTime;
    var s = ctx.createBufferSource();
    s.buffer = noiseBuf;
    s.loop = true;
    s.playbackRate.value = 1.6 + Math.random() * 0.5;
    var f = ctx.createBiquadFilter();
    f.type = 'bandpass';
    f.frequency.value = 2400 + Math.random() * 900;
    f.Q.value = 1.2;
    var g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(vol || 0.05, t0 + 0.03);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.35);
    s.connect(f); f.connect(g); g.connect(sfxGain);
    s.start(t0); s.stop(t0 + 0.4);
  }

  /* ---------- เสียงฝน (บรรยากาศ) ---------- */
  function startRain() {
    if (!ready || muted) return;
    stopAmbience();
    var s = ctx.createBufferSource();
    s.buffer = noiseBuf; s.loop = true;
    var f = ctx.createBiquadFilter();
    f.type = 'highpass'; f.frequency.value = 700;
    var g = ctx.createGain();
    g.gain.value = 0.09;
    s.connect(f); f.connect(g); g.connect(ambGain);
    s.start();
    ambGain.gain.cancelScheduledValues(ctx.currentTime);
    ambGain.gain.setValueAtTime(ambGain.gain.value, ctx.currentTime);
    ambGain.gain.linearRampToValueAtTime(0.5, ctx.currentTime + 1.2);
    ambNodes.push(s, g);
  }

  /* เสียงกลางคืน (แมลง + wind) */
  function startNight() {
    if (!ready || muted) return;
    stopAmbience();
    var s = ctx.createBufferSource();
    s.buffer = noiseBuf; s.loop = true;
    s.playbackRate.value = 0.35;
    var f = ctx.createBiquadFilter();
    f.type = 'lowpass'; f.frequency.value = 320;
    var g = ctx.createGain();
    g.gain.value = 0.14;
    s.connect(f); f.connect(g); g.connect(ambGain);
    s.start();
    ambGain.gain.cancelScheduledValues(ctx.currentTime);
    ambGain.gain.setValueAtTime(ambGain.gain.value, ctx.currentTime);
    ambGain.gain.linearRampToValueAtTime(0.45, ctx.currentTime + 2.0);
    ambNodes.push(s, g);
    /* แมลงกริ่งเป็นจังหวะ */
    var chirp = setInterval(function () {
      if (!ready || muted) return;
      var f0 = 2200 + Math.random() * 1400;
      tone(f0, 0.05, 'sine', 0.035, f0 * 1.3);
      tone(f0 * 1.3, 0.05, 'sine', 0.03, f0 * 0.9, 0.09);
    }, 2200 + Math.random() * 2500);
    ambNodes.push(chirp);
  }

  function stopAmbience() {
    for (var i = 0; i < ambNodes.length; i++) {
      var n = ambNodes[i];
      try {
        if (typeof n === 'number' && n.clearInterval) clearInterval(n);
        else if (n.stop) n.stop();
        else if (n.disconnect) n.disconnect();
      } catch (e) { }
    }
    ambNodes = [];
    if (ambGain && ctx) {
      try {
        ambGain.gain.cancelScheduledValues(ctx.currentTime);
        ambGain.gain.linearRampToValueAtTime(0, ctx.currentTime + 0.4);
      } catch (e) { }
    }
  }

  /* ---------- ตารางเสียงผล ---------- */
  var SFX = {
    /* เดิน — เสียงฝุ่นเบาๆ */
    step: function () {
      noise(0.08, 0.045, 900 + Math.random() * 500);
    },
    /* เก็บของ */
    gather: function () {
      noise(0.16, 0.12, 1800);
      tone(320 + Math.random() * 120, 0.1, 'triangle', 0.07, 200);
    },
    /* ตีต้นไม้ */
    chop: function () {
      noise(0.14, 0.2, 2400);
      tone(150, 0.13, 'square', 0.1, 80);
    },
    /* ขุดหิน */
    mine: function () {
      noise(0.1, 0.16, 700);
      tone(90, 0.09, 'square', 0.08, 55);
    },
    /* โจมตี (การตีลม) */
    swing: function () {
      noise(0.13, 0.09, 3000);
    },
    /* โดนตี */
    hurt: function () {
      tone(280, 0.2, 'sawtooth', 0.16, 90);
      noise(0.12, 0.1, 800);
    },
    /* ตีมอนส์โดน */
    hitMob: function () {
      tone(420, 0.1, 'square', 0.11, 180);
      noise(0.09, 0.11, 1600);
    },
    /* มอนส์ตาย */
    mobDie: function () {
      tone(360, 0.26, 'sawtooth', 0.13, 70);
      noise(0.22, 0.12, 1100);
    },
    /* คราฟต์สำเร็จ */
    craft: function () {
      tone(520, 0.1, 'triangle', 0.11, 700);
      tone(780, 0.12, 'triangle', 0.1, 980, 0.08);
      tone(1040, 0.16, 'sine', 0.09, 1200, 0.17);
    },
    /* เสียงผิดพลาด */
    error: function () {
      tone(200, 0.13, 'square', 0.09, 140);
    },
    /* ซื้อของ */
    buy: function () {
      tone(880, 0.07, 'sine', 0.1, 1200);
      tone(1320, 0.1, 'sine', 0.08, 1500, 0.06);
    },
    /* ขายของ */
    sell: function () {
      tone(700, 0.08, 'sine', 0.09, 900);
      tone(500, 0.1, 'sine', 0.07, 380, 0.07);
    },
    /* ได้เหรียญ */
    coin: function () {
      tone(1050, 0.06, 'square', 0.06, 1400);
      tone(1400, 0.09, 'square', 0.05, 1700, 0.05);
    },
    /* เลเวลขึ้น */
    levelup: function () {
      var f = [523, 659, 784, 1046];
      for (var i = 0; i < f.length; i++) tone(f[i], 0.3, 'triangle', 0.12, f[i] * 1.02, i * 0.11);
      noise(0.5, 0.05, 3000, 0.1);
    },
    /* รับรางวัลเควสต์ */
    quest: function () {
      tone(660, 0.12, 'sine', 0.1, 880);
      tone(880, 0.14, 'sine', 0.1, 1100, 0.1);
      tone(1100, 0.22, 'triangle', 0.1, 1320, 0.21);
    },
    /* กินของ */
    eat: function () {
      noise(0.09, 0.09, 700);
      tone(240, 0.11, 'sine', 0.08, 320);
    },
    /* ยา/ฟื้น HP */
    heal: function () {
      tone(500, 0.22, 'sine', 0.1, 900);
      tone(760, 0.28, 'sine', 0.08, 1180, 0.1);
    },
    /* วางกองไฟ */
    fire: function () {
      noise(0.5, 0.13, 700);
      tone(120, 0.4, 'sawtooth', 0.07, 60);
    },
    /* เปิด/ปิดแผง */
    ui: function () {
      tone(620, 0.05, 'sine', 0.06, 780);
    },
    /* แชท */
    chat: function () {
      tone(880, 0.06, 'sine', 0.07, 1100);
    },
    /* เข้า/ออกอาคาร */
    door: function () {
      noise(0.2, 0.09, 400);
      tone(180, 0.24, 'sawtooth', 0.07, 120);
    },
    /* ตาย */
    death: function () {
      tone(300, 0.5, 'sawtooth', 0.15, 70);
      noise(0.4, 0.1, 500);
    },
    /* เกิดใหม่ */
    respawn: function () {
      tone(400, 0.2, 'sine', 0.1, 700);
      tone(700, 0.3, 'triangle', 0.09, 900, 0.12);
    }
  };

  DT.Audio = {
    /* เรียกครั้งแรกหลังผู้ใช้แตะปุ่ม */
    init: function () {
      var okv = init();
      resume();
      return okv;
    },
    isReady: function () { return ready; },

    /* เล่นเสียง */
    play: function (name, opts) {
      if (!ready || muted) return;
      var f = SFX[name];
      if (!f) return;
      /* กันเสียงซ้ำติดกัน (เช่น step) */
      var now = Date.now();
      var gap = (name === 'step') ? 120 : 40;
      if (lastPlay[name] && now - lastPlay[name] < gap) return;
      lastPlay[name] = now;
      try { f(opts || {}); } catch (e) { }
    },

    /* เสียงฝน/กลางคืน */
    setAmbience: function (kind) {
      if (!ready) return;
      if (kind === 'rain') startRain();
      else if (kind === 'night') startNight();
      else stopAmbience();
    },
    stopAmbience: stopAmbience,

    /* ใบไม้กระพริบ */
    leaf: function () { leafRustle(0.045); },

    /* เปิด/ปิดเสียง */
    setMuted: function (m) {
      muted = !!m;
      if (muted) stopAmbience();
      if (master && ctx) {
        try {
          master.gain.cancelScheduledValues(ctx.currentTime);
          master.gain.linearRampToValueAtTime(muted ? 0 : 0.85, ctx.currentTime + 0.15);
        } catch (e) { }
      }
      return muted;
    },
    toggleMute: function () { return this.setMuted(!muted); },
    isMuted: function () { return muted; }
  };
})(window);
