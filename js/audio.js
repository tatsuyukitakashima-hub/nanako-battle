// Web Audio APIで生成するオリジナルBGM/SFX(外部音源は使用しない)
const AudioEngine = (() => {
  let ctx = null;
  let masterGain = null;
  let currentLoopId = 0;
  let activeLoopToken = null;

  function ensureContext() {
    if (!ctx) {
      ctx = new (window.AudioContext || window.webkitAudioContext)();
      masterGain = ctx.createGain();
      masterGain.gain.value = 0.35;
      masterGain.connect(ctx.destination);
    }
    if (ctx.state === 'suspended') ctx.resume();
    return ctx;
  }

  const NOTE_SEMITONES = {
    'C3': -21, 'D3': -19, 'E3': -17, 'F3': -16, 'G3': -14, 'A3': -12, 'B3': -10,
    'C4': -9, 'D4': -7, 'E4': -5, 'F4': -4, 'G4': -2, 'A4': 0, 'B4': 2,
    'C5': 3, 'D5': 5, 'E5': 7, 'F5': 8, 'G5': 10, 'A5': 12, 'B5': 14, 'C6': 15
  };
  function freqOf(name) {
    if (!name || name === '-') return null;
    return 440 * Math.pow(2, NOTE_SEMITONES[name] / 12);
  }

  function playOsc(freq, startAt, dur, type, peakGain) {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(0.0001, startAt);
    gain.gain.linearRampToValueAtTime(peakGain, startAt + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.001, startAt + dur);
    osc.connect(gain);
    gain.connect(masterGain);
    osc.start(startAt);
    osc.stop(startAt + dur + 0.02);
  }

  function beep(freq, dur, type, gain) {
    ensureContext();
    playOsc(freq, ctx.currentTime, dur, type, gain);
  }

  function playSelect() { beep(660, 0.06, 'square', 0.25); }
  function playConfirm() { beep(880, 0.09, 'square', 0.3); }
  function playHit() {
    ensureContext();
    const t = ctx.currentTime;
    playOsc(180, t, 0.18, 'sawtooth', 0.35);
    playOsc(90, t, 0.18, 'square', 0.25);
  }
  function playFaint() {
    ensureContext();
    const t = ctx.currentTime;
    [600, 500, 400, 300, 200].forEach((f, i) => playOsc(f, t + i * 0.09, 0.14, 'square', 0.25));
  }
  function playCatchJingle() {
    ensureContext();
    const t = ctx.currentTime;
    [392, 494, 587, 784, 987].forEach((f, i) => playOsc(f, t + i * 0.12, 0.2, 'triangle', 0.3));
  }
  function playBallThrow() { beep(300, 0.12, 'triangle', 0.25); }

  function noiseHit(startAt, dur, peakGain) {
    const bufferSize = Math.max(1, Math.floor(ctx.sampleRate * dur));
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / bufferSize);
    const src = ctx.createBufferSource();
    src.buffer = buffer;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(peakGain, startAt);
    gain.gain.exponentialRampToValueAtTime(0.001, startAt + dur);
    const filter = ctx.createBiquadFilter();
    filter.type = 'highpass';
    filter.frequency.value = 1200;
    src.connect(filter);
    filter.connect(gain);
    gain.connect(masterGain);
    src.start(startAt);
    src.stop(startAt + dur + 0.01);
  }

  // ループ再生(先読みスケジューリング)
  function scheduleLoop(loop, token) {
    if (!ctx || token.id !== currentLoopId) return;
    const beatDur = 60 / loop.tempo;
    const startAt = ctx.currentTime + 0.05;

    function scheduleLine(line, type, gain) {
      let t = startAt;
      line.forEach(step => {
        const dur = step.beats * beatDur;
        const f = freqOf(step.note);
        if (f) playOsc(f, t, dur * 0.9, type, gain);
        t += dur;
      });
      return t - startAt;
    }

    function schedulePercussion(line, gain) {
      let t = startAt;
      line.forEach(step => {
        const dur = step.beats * beatDur;
        if (step.hit) noiseHit(t, Math.min(dur * 0.6, 0.12), gain);
        t += dur;
      });
      return t - startAt;
    }

    const lens = [scheduleLine(loop.melody, loop.melodyType || 'square', loop.melodyGain ?? 0.22)];
    if (loop.bassline) lens.push(scheduleLine(loop.bassline, loop.bassType || 'triangle', loop.bassGain ?? 0.2));
    if (loop.harmony) lens.push(scheduleLine(loop.harmony, loop.harmonyType || 'triangle', loop.harmonyGain ?? 0.14));
    if (loop.percussion) lens.push(schedulePercussion(loop.percussion, loop.percussionGain ?? 0.3));
    const loopLen = Math.max(...lens);

    token.timeoutId = setTimeout(() => {
      if (token.id === currentLoopId) scheduleLoop(loop, token);
    }, Math.max(50, loopLen * 1000 - 60));
  }

  function playLoop(loop) {
    ensureContext();
    currentLoopId++;
    if (activeLoopToken) clearTimeout(activeLoopToken.timeoutId);
    activeLoopToken = { id: currentLoopId, timeoutId: null };
    scheduleLoop(loop, activeLoopToken);
  }
  function stopMusic() {
    currentLoopId++;
    if (activeLoopToken) clearTimeout(activeLoopToken.timeoutId);
    activeLoopToken = null;
  }

  // オーバーワールド: ハ長調・やわらかい音色のんびり歩く曲(4小節/16拍)
  const OVERWORLD_THEME = {
    tempo: 108,
    melodyType: 'sine', melodyGain: 0.22,
    bassType: 'sine', bassGain: 0.15,
    harmonyType: 'triangle', harmonyGain: 0.1,
    percussionGain: 0.12,
    melody: [
      { note: 'C4', beats: 1 }, { note: 'D4', beats: 1 }, { note: 'E4', beats: 1 }, { note: 'G4', beats: 1 },
      { note: 'F4', beats: 1 }, { note: 'E4', beats: 1 }, { note: 'D4', beats: 1 }, { note: 'C4', beats: 1 },
      { note: 'A4', beats: 1 }, { note: 'G4', beats: 1 }, { note: 'F4', beats: 1 }, { note: 'E4', beats: 1 },
      { note: 'D4', beats: 2 }, { note: 'C4', beats: 2 }
    ],
    bassline: [
      { note: 'C3', beats: 2 }, { note: 'C3', beats: 2 },
      { note: 'F3', beats: 2 }, { note: 'F3', beats: 2 },
      { note: 'G3', beats: 2 }, { note: 'G3', beats: 2 },
      { note: 'C3', beats: 4 }
    ],
    harmony: [
      { note: 'E4', beats: 2 }, { note: 'G4', beats: 2 },
      { note: 'A4', beats: 2 }, { note: 'G4', beats: 2 },
      { note: 'C5', beats: 2 }, { note: 'B4', beats: 2 },
      { note: 'G4', beats: 4 }
    ],
    percussion: [
      { hit: true, beats: 1 }, { hit: false, beats: 3 },
      { hit: true, beats: 1 }, { hit: false, beats: 3 },
      { hit: true, beats: 1 }, { hit: false, beats: 3 },
      { hit: true, beats: 1 }, { hit: false, beats: 3 }
    ]
  };

  // 通常バトル(ナナコ戦): ト長調・コミカルで軽快な曲(3小節/12拍)
  const BATTLE_THEME = {
    tempo: 174,
    melodyType: 'square', melodyGain: 0.2,
    bassType: 'square', bassGain: 0.16,
    harmonyType: 'triangle', harmonyGain: 0.1,
    percussionGain: 0.26,
    melody: [
      { note: 'G4', beats: 0.5 }, { note: 'A4', beats: 0.5 }, { note: 'B4', beats: 0.5 }, { note: 'G4', beats: 0.5 },
      { note: 'D5', beats: 0.5 }, { note: 'B4', beats: 0.5 }, { note: 'G4', beats: 0.5 }, { note: '-', beats: 0.5 },
      { note: 'A4', beats: 0.5 }, { note: 'B4', beats: 0.5 }, { note: 'C5', beats: 0.5 }, { note: 'A4', beats: 0.5 },
      { note: 'E5', beats: 0.5 }, { note: 'C5', beats: 0.5 }, { note: 'A4', beats: 0.5 }, { note: '-', beats: 0.5 },
      { note: 'B4', beats: 1 }, { note: 'A4', beats: 1 }, { note: 'G4', beats: 2 }
    ],
    bassline: [
      { note: 'G3', beats: 1 }, { note: 'G3', beats: 1 }, { note: 'D3', beats: 1 }, { note: 'D3', beats: 1 },
      { note: 'A3', beats: 1 }, { note: 'A3', beats: 1 }, { note: 'E3', beats: 1 }, { note: 'E3', beats: 1 },
      { note: 'G3', beats: 2 }, { note: 'G3', beats: 2 }
    ],
    harmony: [
      { note: 'B4', beats: 4 }, { note: 'C5', beats: 4 }, { note: 'D5', beats: 4 }
    ],
    percussion: [
      { hit: false, beats: 1 }, { hit: true, beats: 1 }, { hit: false, beats: 1 }, { hit: true, beats: 1 },
      { hit: false, beats: 1 }, { hit: true, beats: 1 }, { hit: false, beats: 1 }, { hit: true, beats: 1 },
      { hit: false, beats: 1 }, { hit: true, beats: 1 }, { hit: false, beats: 1 }, { hit: true, beats: 1 }
    ]
  };

  // ボス戦(ヒロシ・イクコ): イ短調・ノコギリ波でドラマチックな四天王風の新曲(4小節/16拍)
  const BOSS_THEME = {
    tempo: 200,
    melodyType: 'sawtooth', melodyGain: 0.16,
    bassType: 'square', bassGain: 0.18,
    harmonyType: 'triangle', harmonyGain: 0.13,
    percussionGain: 0.34,
    melody: [
      { note: 'A4', beats: 0.5 }, { note: 'C5', beats: 0.5 }, { note: 'A4', beats: 0.5 }, { note: 'E4', beats: 0.5 },
      { note: 'F4', beats: 0.5 }, { note: 'A4', beats: 0.5 }, { note: 'F4', beats: 0.5 }, { note: 'C4', beats: 0.5 },
      { note: 'A4', beats: 0.5 }, { note: 'C5', beats: 0.5 }, { note: 'D5', beats: 0.5 }, { note: 'C5', beats: 0.5 },
      { note: 'B4', beats: 1 }, { note: '-', beats: 1 },
      { note: 'E5', beats: 0.5 }, { note: 'D5', beats: 0.5 }, { note: 'C5', beats: 0.5 }, { note: 'B4', beats: 0.5 },
      { note: 'A4', beats: 0.5 }, { note: 'G4', beats: 0.5 }, { note: 'A4', beats: 0.5 }, { note: '-', beats: 0.5 },
      { note: 'B4', beats: 1 }, { note: 'C5', beats: 1 },
      { note: 'A4', beats: 2 }
    ],
    bassline: [
      { note: 'A3', beats: 1 }, { note: 'A3', beats: 1 }, { note: 'A3', beats: 1 }, { note: 'A3', beats: 1 },
      { note: 'F3', beats: 1 }, { note: 'F3', beats: 1 }, { note: 'F3', beats: 1 }, { note: 'F3', beats: 1 },
      { note: 'D3', beats: 1 }, { note: 'D3', beats: 1 }, { note: 'D3', beats: 1 }, { note: 'D3', beats: 1 },
      { note: 'E3', beats: 1 }, { note: 'E3', beats: 1 }, { note: 'E3', beats: 1 }, { note: 'E3', beats: 1 }
    ],
    harmony: [
      { note: 'C5', beats: 2 }, { note: 'A4', beats: 2 },
      { note: 'A4', beats: 2 }, { note: 'F4', beats: 2 },
      { note: 'F4', beats: 2 }, { note: 'D4', beats: 2 },
      { note: 'E4', beats: 4 }
    ],
    percussion: [
      { hit: true, beats: 0.5 }, { hit: false, beats: 0.5 }, { hit: true, beats: 0.5 }, { hit: true, beats: 0.5 },
      { hit: true, beats: 0.5 }, { hit: false, beats: 0.5 }, { hit: true, beats: 0.5 }, { hit: true, beats: 0.5 },
      { hit: true, beats: 0.5 }, { hit: false, beats: 0.5 }, { hit: true, beats: 0.5 }, { hit: true, beats: 0.5 },
      { hit: true, beats: 0.5 }, { hit: false, beats: 0.5 }, { hit: true, beats: 0.5 }, { hit: true, beats: 0.5 },
      { hit: true, beats: 0.5 }, { hit: false, beats: 0.5 }, { hit: true, beats: 0.5 }, { hit: true, beats: 0.5 },
      { hit: true, beats: 0.5 }, { hit: false, beats: 0.5 }, { hit: true, beats: 0.5 }, { hit: true, beats: 0.5 },
      { hit: true, beats: 0.5 }, { hit: false, beats: 0.5 }, { hit: true, beats: 0.5 }, { hit: true, beats: 0.5 },
      { hit: true, beats: 0.5 }, { hit: false, beats: 0.5 }, { hit: true, beats: 0.5 }, { hit: true, beats: 0.5 }
    ]
  };

  return {
    ensureContext,
    playSelect, playConfirm, playHit, playFaint, playCatchJingle, playBallThrow,
    playOverworldTheme: () => playLoop(OVERWORLD_THEME),
    playBattleTheme: (boss) => playLoop(boss ? BOSS_THEME : BATTLE_THEME),
    stopMusic,
  };
})();
