// バトルロジック(コマンド/4技/捕獲/HP/レベル/状態異常)とDOMアニメーション
const Battle = (() => {
  function maxHpForLevel(level) { return 80 + level * 4; }

  let player, enemy; // { name, level, sprite, moves, defeatedSprite? }
  let allowCatch = false;
  let playerHP, playerMaxHP, enemyHP, enemyMaxHP;
  let enemyStatus, enemySleepTurns, playerPoisonTurns, turnLock;
  let onEndCallback = null;

  let stage, fx, babySprite, playerSprite, ballSprite;
  let babyHpFill, playerHpFill, babyNameEl, playerNameEl, babyLevelEl, playerLevelEl;
  let babyStatusBadges, playerStatusBadges;
  let msgBox, msgText, commandMenu, moveMenu, catchBtn;

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
    babyNameEl = document.getElementById('baby-name');
    playerNameEl = document.getElementById('player-name');
    babyLevelEl = document.getElementById('baby-level');
    playerLevelEl = document.getElementById('player-level');
    babyStatusBadges = document.getElementById('baby-status-badges');
    playerStatusBadges = document.getElementById('player-status-badges');
    msgBox = document.getElementById('battle-message-box');
    msgText = document.getElementById('battle-message-text');
    commandMenu = document.getElementById('command-menu');
    moveMenu = document.getElementById('move-menu');
    catchBtn = commandMenu.querySelector('[data-cmd="catch"]');

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

  async function start(config) {
    player = config.player;
    enemy = config.enemy;
    allowCatch = !!config.allowCatch;
    playerMaxHP = maxHpForLevel(player.level);
    enemyMaxHP = maxHpForLevel(enemy.level);
    playerHP = playerMaxHP;
    enemyHP = enemyMaxHP;
    enemyStatus = null;
    enemySleepTurns = 0;
    playerPoisonTurns = 0;
    turnLock = false;

    babySprite.src = enemy.sprite;
    playerSprite.src = player.sprite;
    babyNameEl.textContent = enemy.name;
    playerNameEl.textContent = player.name;
    babyLevelEl.textContent = 'Lv.' + enemy.level;
    playerLevelEl.textContent = 'Lv.' + player.level;
    updateHPBar('baby');
    updateHPBar('player');
    updateStatusBadges('baby');
    updateStatusBadges('player');
    hideMoveMenu();
    catchBtn.classList.toggle('hidden', !allowCatch);
    ballSprite.className = 'ball-sprite hidden';

    AudioEngine.playBattleTheme(enemy.bossTheme);
    await showMessage(`${enemy.name} が あらわれた！`);
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
    player.moves.forEach((move, i) => {
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
    const hp = who === 'baby' ? enemyHP : playerHP;
    const maxHp = who === 'baby' ? enemyMaxHP : playerMaxHP;
    const pct = clamp(hp / maxHp * 100, 0, 100);
    fill.style.width = pct + '%';
    fill.classList.remove('low', 'critical');
    if (pct <= 20) fill.classList.add('critical');
    else if (pct <= 50) fill.classList.add('low');
  }

  const STATUS_LABEL = { sleep: 'ねむり', poison: 'どく', charm: 'メロメロ' };
  function updateStatusBadges(who) {
    const container = who === 'baby' ? babyStatusBadges : playerStatusBadges;
    const status = who === 'baby' ? enemyStatus : (playerPoisonTurns > 0 ? 'poison' : null);
    container.innerHTML = '';
    if (status && STATUS_LABEL[status]) {
      const badge = document.createElement('span');
      badge.className = 'status-badge ' + status;
      badge.textContent = STATUS_LABEL[status];
      container.appendChild(badge);
    }
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

  function spawnRing(originEl, delay, color) {
    setTimeout(() => {
      const pos = relPos(originEl, fx);
      const ring = document.createElement('div');
      ring.className = 'fx-ring';
      if (color) ring.style.borderColor = color;
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
        case 'glare': case 'xray': {
          const g = document.createElement('div');
          g.className = 'fx-glare';
          if (name === 'xray') g.style.background = 'radial-gradient(circle at 75% 25%, rgba(120,200,255,0.9), rgba(120,200,255,0) 55%)';
          fx.appendChild(g);
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
        case 'cry': case 'scold':
          spawnRing(babySprite, 0, name === 'scold' ? 'rgba(255,210,80,0.9)' : undefined);
          spawnRing(babySprite, 150, name === 'scold' ? 'rgba(255,210,80,0.9)' : undefined);
          shakeScreen(name === 'scold' ? 550 : 450);
          duration = name === 'scold' ? 800 : 700;
          break;
        case 'crawl': case 'vacuum':
          babySprite.classList.add('lunge-left');
          spawnParticles(name === 'vacuum' ? '🌀' : '💨', babySprite, '', 3);
          duration = 470;
          setTimeout(() => babySprite.classList.remove('lunge-left'), duration);
          break;
        case 'drill':
          spawnParticles('🦷', playerSprite, 'fly-to-player', 4);
          shakeScreen(280);
          duration = 600;
          break;
        case 'injection':
          spawnParticles('💉', babySprite, 'fly-to-player', 3);
          duration = 550;
          break;
        case 'bike':
          babySprite.classList.add('lunge-left');
          spawnParticles('💨', babySprite, '', 5);
          shakeScreen(400);
          duration = 520;
          setTimeout(() => babySprite.classList.remove('lunge-left'), duration);
          break;
        case 'flyer':
          spawnParticles('📄', babySprite, 'fly-to-player', 4);
          duration = 600;
          break;
        case 'spicy':
          spawnParticles('🌶️', babySprite, 'fly-to-player', 4);
          shakeScreen(280);
          duration = 600;
          break;
      }
      setTimeout(resolve, duration);
    });
  }

  async function playerUseMove(index) {
    if (turnLock) return;
    turnLock = true;
    hideMoveMenu();
    const move = player.moves[index];
    await showMessage(move.flavor);
    await playAnim(move.anim);
    const hit = Math.random() < move.accuracy;
    if (!hit) {
      await showMessage('しかし こうげきは はずれた！');
    } else {
      if (move.power > 0) {
        enemyHP = Math.max(0, enemyHP - rollDamage(move.power));
        updateHPBar('baby');
        AudioEngine.playHit();
        flinch('baby');
      }
      if (move.effect === 'charm' && !enemyStatus && Math.random() < move.effectChance) {
        enemyStatus = 'charm';
        updateStatusBadges('baby');
        await showMessage(`${enemy.name}は メロメロに なった♡`);
      } else if (move.effect === 'sleep') {
        enemyStatus = 'sleep';
        enemySleepTurns = 2 + Math.floor(Math.random() * 2);
        updateStatusBadges('baby');
        await showMessage(`${enemy.name}は ねむって しまった…`);
      }
    }
    if (enemyHP <= 0) { await onEnemyFainted(); return; }
    await wait(350);
    await enemyTurn();
  }

  async function enemyTurn() {
    if (enemyStatus === 'sleep' && enemySleepTurns > 0) {
      enemySleepTurns--;
      await showMessage(`${enemy.name}は ねむっている…`);
      if (enemySleepTurns <= 0) { enemyStatus = null; updateStatusBadges('baby'); }
      await endTurnCycle();
      return;
    }
    if (enemyStatus === 'charm') {
      enemyStatus = null;
      updateStatusBadges('baby');
      await showMessage(`${enemy.name}は メロメロで うごけない！`);
      await endTurnCycle();
      return;
    }
    const move = enemy.moves[Math.floor(Math.random() * enemy.moves.length)];
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
        updateStatusBadges('player');
        await showMessage(`${player.name}は ダメージ状態に なってしまった…`);
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
      if (playerPoisonTurns === 0) updateStatusBadges('player');
      await showMessage(`${player.name}は ダメージで くるしんでいる…`);
      if (playerHP <= 0) { await onPlayerFainted(); return; }
    }
    turnLock = false;
    showCommandMenu();
  }

  async function attemptCatch() {
    if (turnLock || !allowCatch) return;
    turnLock = true;
    hideCommandMenu();
    await showMessage('なかよしボールを 投げた！');
    AudioEngine.playBallThrow();
    ballSprite.className = 'ball-sprite throwing';
    ballSprite.classList.remove('hidden');
    await wait(600);
    const chance = clamp(0.15 + 0.7 * (1 - enemyHP / enemyMaxHP), 0.15, 0.9);
    const success = Math.random() < chance;
    ballSprite.className = 'ball-sprite wiggle';
    await wait(success ? 900 : 600);
    if (success) {
      ballSprite.className = 'ball-sprite hidden';
      AudioEngine.playCatchJingle();
      await showMessage(`やった！ ${enemy.shortName || enemy.name}を つかまえた！`);
      onEndCallback('caught');
    } else {
      ballSprite.className = 'ball-sprite pop';
      await wait(320);
      ballSprite.className = 'ball-sprite hidden';
      await showMessage('あ！ ボールから 飛び出して しまった！');
      await wait(300);
      await enemyTurn();
    }
  }

  async function attemptRun() {
    if (turnLock) return;
    turnLock = true;
    hideCommandMenu();
    await showMessage(`${player.name}は そそくさと にげだした…`);
    onEndCallback('ran');
  }

  async function onEnemyFainted() {
    if (enemy.defeatedSprite) babySprite.src = enemy.defeatedSprite;
    stage.classList.add('flash-red');
    await wait(350);
    stage.classList.remove('flash-red');
    AudioEngine.playFaint();
    await showMessage(enemy.faintLine || `${enemy.name} を たおした！`);
    onEndCallback('defeated');
  }

  async function onPlayerFainted() {
    AudioEngine.playFaint();
    await showMessage(`${player.name}は つかれて うごけなくなった…`);
    onEndCallback('lost');
  }

  return { init, start, stopMusic };
})();
