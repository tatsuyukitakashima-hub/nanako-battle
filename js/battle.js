// バトルロジック(コマンド/4技/捕獲/HP)とDOMアニメーション
const Battle = (() => {
  const MAX_HP = 100;

  const ERINA_MOVES = [
    { name: '鋭い眼光', power: 18, accuracy: 1.0, anim: 'glare', flavor: '瑛里奈の 鋭い眼光！' },
    { name: '投げキッス', power: 8, accuracy: 1.0, anim: 'kiss', effect: 'charm', effectChance: 0.5, flavor: '瑛里奈は そっと投げキッスをした！' },
    { name: '子守唄', power: 0, accuracy: 1.0, anim: 'lullaby', effect: 'sleep', flavor: '瑛里奈は やさしく子守唄をうたった…' },
    { name: 'だっこ攻撃', power: 26, accuracy: 0.9, anim: 'hug', flavor: '瑛里奈の だっこ攻撃！' },
  ];
  const NANAKO_MOVES = [
    { name: 'おしっこビーム', power: 16, accuracy: 1.0, anim: 'pee', flavor: 'ナナコの おしっこビーム！' },
    { name: 'うんちなげ', power: 10, accuracy: 0.95, anim: 'poop', effect: 'poison', effectChance: 0.6, flavor: 'ナナコは うんちを投げつけた！' },
    { name: 'なきごえアタック', power: 24, accuracy: 0.9, anim: 'cry', flavor: 'ナナコの なきごえアタック！' },
    { name: 'はいはいタックル', power: 18, accuracy: 1.0, anim: 'crawl', flavor: 'ナナコの はいはいタックル！' },
  ];

  let playerHP, babyHP, babyStatus, babySleepTurns, playerPoisonTurns, turnLock;
  let onEndCallback = null;

  let stage, fx, babySprite, playerSprite, ballSprite;
  let babyHpFill, playerHpFill;
  let msgBox, msgText, commandMenu, moveMenu;

  function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }
  function wait(ms) { return new Promise(r => setTimeout(r, ms)); }
  function rollDamage(power) { return Math.max(1, Math.round(power + (Math.random() * 8 - 4))); }

  function init(opts) {
    onEndCallback = opts.onEnd;
    stage = document.getElementById('battle-stage');
    fx = document.getElementById('fx-layer');
    babySprite = document.getElementById('baby-sprite');
    playerSprite = document.getElementById('player-sprite');
    ballSprite = document.getElementById('ball-sprite');
    babyHpFill = document.getElementById('baby-hp-fill');
    playerHpFill = document.getElementById('player-hp-fill');
    msgBox = document.getElementById('battle-message-box');
    msgText = document.getElementById('battle-message-text');
    commandMenu = document.getElementById('command-menu');
    moveMenu = document.getElementById('move-menu');

    commandMenu.querySelectorAll('.cmd-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        AudioEngine.playSelect();
        const cmd = btn.dataset.cmd;
        if (cmd === 'fight') openMoveMenu();
        else if (cmd === 'catch') attemptCatch();
        else if (cmd === 'run') attemptRun();
      });
    });
  }

  async function start() {
    playerHP = MAX_HP;
    babyHP = MAX_HP;
    babyStatus = null;
    babySleepTurns = 0;
    playerPoisonTurns = 0;
    turnLock = false;
    babySprite.src = 'images/nanako_normal.png';
    playerSprite.src = 'images/erina_normal.png';
    updateHPBar('baby');
    updateHPBar('player');
    hideMoveMenu();
    ballSprite.classList.add('hidden');
    ballSprite.className = 'ball-sprite hidden';
    AudioEngine.playBattleTheme();
    await showMessage('ナナコが あらわれた！');
    showCommandMenu();
  }

  function stopMusic() { AudioEngine.stopMusic(); }

  function showCommandMenu() {
    msgBox.classList.add('hidden');
    moveMenu.classList.add('hidden');
    commandMenu.classList.remove('hidden');
  }
  function hideCommandMenu() { commandMenu.classList.add('hidden'); }
  function hideMoveMenu() { moveMenu.classList.add('hidden'); moveMenu.innerHTML = ''; }

  function openMoveMenu() {
    hideCommandMenu();
    moveMenu.innerHTML = '';
    ERINA_MOVES.forEach((move, i) => {
      const btn = document.createElement('button');
      btn.className = 'move-btn erina';
      btn.textContent = move.name;
      btn.addEventListener('click', () => {
        AudioEngine.playSelect();
        playerUseMove(i);
      });
      moveMenu.appendChild(btn);
    });
    const back = document.createElement('button');
    back.className = 'move-btn';
    back.textContent = '← もどる';
    back.addEventListener('click', () => { AudioEngine.playSelect(); showCommandMenu(); });
    moveMenu.appendChild(back);
    moveMenu.classList.remove('hidden');
  }

  function showMessage(text) {
    return new Promise(resolve => {
      msgBox.classList.remove('hidden');
      msgText.textContent = text;
      let done = false;
      const finish = () => {
        if (done) return;
        done = true;
        msgBox.removeEventListener('click', finish);
        clearTimeout(timer);
        resolve();
      };
      const timer = setTimeout(finish, clamp(text.length * 70, 900, 2200));
      msgBox.addEventListener('click', finish);
    });
  }

  function updateHPBar(who) {
    const fill = who === 'baby' ? babyHpFill : playerHpFill;
    const hp = who === 'baby' ? babyHP : playerHP;
    const pct = clamp(hp / MAX_HP * 100, 0, 100);
    fill.style.width = pct + '%';
    fill.classList.remove('low', 'critical');
    if (pct <= 20) fill.classList.add('critical');
    else if (pct <= 50) fill.classList.add('low');
  }

  function flinch(who) {
    const el = who === 'baby' ? babySprite : playerSprite;
    el.classList.add('hit-flinch');
    setTimeout(() => el.classList.remove('hit-flinch'), 320);
  }

  function relPos(el, container) {
    const r = el.getBoundingClientRect();
    const c = container.getBoundingClientRect();
    return { x: r.left - c.left + r.width / 2, y: r.top - c.top + r.height / 2 };
  }

  function spawnParticles(emoji, originEl, animClass, count) {
    const pos = relPos(originEl, fx);
    for (let i = 0; i < count; i++) {
      const el = document.createElement('div');
      el.className = 'fx-particle' + (animClass ? ' ' + animClass : '');
      el.textContent = emoji;
      el.style.left = (pos.x + (Math.random() * 40 - 20)) + 'px';
      el.style.top = (pos.y + (Math.random() * 20 - 10)) + 'px';
      fx.appendChild(el);
      setTimeout(() => el.remove(), 1150);
    }
  }

  function spawnBeam(fromEl, toEl, color) {
    const from = relPos(fromEl, fx);
    const to = relPos(toEl, fx);
    const dx = to.x - from.x, dy = to.y - from.y;
    const len = Math.hypot(dx, dy);
    const angle = Math.atan2(dy, dx) * 180 / Math.PI;
    const beam = document.createElement('div');
    beam.className = 'fx-beam';
    beam.style.left = from.x + 'px';
    beam.style.top = from.y + 'px';
    beam.style.width = len + 'px';
    beam.style.background = `linear-gradient(90deg, rgba(255,255,255,0), ${color})`;
    beam.style.transform = `rotate(${angle}deg)`;
    fx.appendChild(beam);
    setTimeout(() => beam.remove(), 450);
  }

  function spawnRing(originEl, delay) {
    setTimeout(() => {
      const pos = relPos(originEl, fx);
      const ring = document.createElement('div');
      ring.className = 'fx-ring';
      ring.style.left = pos.x + 'px';
      ring.style.top = pos.y + 'px';
      fx.appendChild(ring);
      setTimeout(() => ring.remove(), 750);
    }, delay || 0);
  }

  function shakeScreen(duration) {
    stage.classList.add('shake-screen');
    setTimeout(() => stage.classList.remove('shake-screen'), duration || 400);
  }

  function playAnim(name) {
    return new Promise(resolve => {
      let duration = 500;
      switch (name) {
        case 'glare': {
          const g = document.createElement('div'); g.className = 'fx-glare'; fx.appendChild(g);
          shakeScreen(300);
          duration = 420;
          setTimeout(() => g.remove(), duration);
          break;
        }
        case 'kiss':
          spawnParticles('💋', playerSprite, 'fly-to-baby', 5);
          duration = 650;
          break;
        case 'lullaby':
          spawnParticles('♪', babySprite, '', 6);
          duration = 950;
          break;
        case 'hug':
          playerSprite.classList.add('lunge-right');
          spawnParticles('✨', babySprite, '', 4);
          duration = 470;
          setTimeout(() => playerSprite.classList.remove('lunge-right'), duration);
          break;
        case 'pee':
          spawnBeam(babySprite, playerSprite, 'rgba(255,224,102,0.85)');
          duration = 450;
          break;
        case 'poop':
          spawnParticles('💩', babySprite, 'fly-to-player', 3);
          duration = 650;
          break;
        case 'cry':
          spawnRing(babySprite, 0);
          spawnRing(babySprite, 150);
          shakeScreen(450);
          duration = 700;
          break;
        case 'crawl':
          babySprite.classList.add('lunge-left');
          spawnParticles('💨', babySprite, '', 3);
          duration = 470;
          setTimeout(() => babySprite.classList.remove('lunge-left'), duration);
          break;
      }
      setTimeout(resolve, duration);
    });
  }

  async function playerUseMove(index) {
    if (turnLock) return;
    turnLock = true;
    hideMoveMenu();
    const move = ERINA_MOVES[index];
    await showMessage(move.flavor);
    await playAnim(move.anim);
    const hit = Math.random() < move.accuracy;
    if (!hit) {
      await showMessage('しかし こうげきは はずれた！');
    } else {
      if (move.power > 0) {
        babyHP = Math.max(0, babyHP - rollDamage(move.power));
        updateHPBar('baby');
        AudioEngine.playHit();
        flinch('baby');
      }
      if (move.effect === 'charm' && !babyStatus && Math.random() < move.effectChance) {
        babyStatus = 'charm';
        await showMessage('ナナコは メロメロに なった♡');
      } else if (move.effect === 'sleep') {
        babyStatus = 'sleep';
        babySleepTurns = 2 + Math.floor(Math.random() * 2);
        await showMessage('ナナコは ねむって しまった…');
      }
    }
    if (babyHP <= 0) { await onBabyFainted(); return; }
    await wait(350);
    await babyTurn();
  }

  async function babyTurn() {
    if (babyStatus === 'sleep' && babySleepTurns > 0) {
      babySleepTurns--;
      await showMessage('ナナコは ねむっている…');
      if (babySleepTurns <= 0) babyStatus = null;
      await endTurnCycle();
      return;
    }
    if (babyStatus === 'charm') {
      babyStatus = null;
      await showMessage('ナナコは メロメロで うごけない！');
      await endTurnCycle();
      return;
    }
    const move = NANAKO_MOVES[Math.floor(Math.random() * NANAKO_MOVES.length)];
    await showMessage(move.flavor);
    await playAnim(move.anim);
    const hit = Math.random() < move.accuracy;
    if (!hit) {
      await showMessage('しかし こうげきは はずれた！');
    } else {
      playerHP = Math.max(0, playerHP - rollDamage(move.power));
      updateHPBar('player');
      AudioEngine.playHit();
      flinch('player');
      if (move.effect === 'poison' && playerPoisonTurns === 0 && Math.random() < move.effectChance) {
        playerPoisonTurns = 3;
        await showMessage('エリナは どくを 浴びてしまった…');
      }
    }
    if (playerHP <= 0) { await onPlayerFainted(); return; }
    await endTurnCycle();
  }

  async function endTurnCycle() {
    if (playerPoisonTurns > 0) {
      playerPoisonTurns--;
      playerHP = Math.max(0, playerHP - 6);
      updateHPBar('player');
      await showMessage('エリナは どくの ダメージを受けている…');
      if (playerHP <= 0) { await onPlayerFainted(); return; }
    }
    turnLock = false;
    showCommandMenu();
  }

  async function attemptCatch() {
    if (turnLock) return;
    turnLock = true;
    hideCommandMenu();
    await showMessage('なかよしボールを 投げた！');
    AudioEngine.playBallThrow();
    ballSprite.className = 'ball-sprite throwing';
    ballSprite.classList.remove('hidden');
    await wait(600);
    const chance = clamp(0.15 + 0.7 * (1 - babyHP / MAX_HP), 0.15, 0.9);
    const success = Math.random() < chance;
    ballSprite.className = 'ball-sprite wiggle';
    await wait(success ? 900 : 600);
    if (success) {
      ballSprite.className = 'ball-sprite hidden';
      AudioEngine.playCatchJingle();
      await showMessage('やった！ ナナコを つかまえた！');
      onEndCallback('caught');
    } else {
      ballSprite.className = 'ball-sprite pop';
      await wait(320);
      ballSprite.className = 'ball-sprite hidden';
      await showMessage('あ！ ボールから 飛び出して しまった！');
      await wait(300);
      await babyTurn();
    }
  }

  async function attemptRun() {
    if (turnLock) return;
    turnLock = true;
    hideCommandMenu();
    await showMessage('瑛里奈は そそくさと にげだした…');
    onEndCallback('ran');
  }

  async function onBabyFainted() {
    babySprite.src = 'images/nanako_angry.png';
    stage.classList.add('flash-red');
    await wait(350);
    stage.classList.remove('flash-red');
    AudioEngine.playFaint();
    await showMessage('ナナコ は はらを たてた！ 「ばぶーっ！！」');
    onEndCallback('defeated');
  }

  async function onPlayerFainted() {
    AudioEngine.playFaint();
    await showMessage('エリナは つかれて ねむってしまった…');
    onEndCallback('lost');
  }

  return { init, start, stopMusic };
})();
