// 画面遷移・合言葉ゲート・入力まわりの結線
(() => {
  // sha256("菜々子ザムライ")
  const PASSPHRASE_HASH = 'c86b167078f5ca451d035b8ee71af423e662d497288b3c750b2db1b9fade3881';

  let currentScreen = 'lock-screen';

  async function sha256Hex(text) {
    const enc = new TextEncoder().encode(text);
    const buf = await crypto.subtle.digest('SHA-256', enc);
    return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
  }

  function showTopScreen(id) {
    document.getElementById('lock-screen').classList.toggle('hidden', id !== 'lock-screen');
    document.getElementById('game-root').classList.toggle('hidden', id !== 'game-root');
  }

  function showGameScreen(id) {
    ['title-screen', 'overworld-screen', 'battle-screen', 'ending-screen'].forEach(s => {
      document.getElementById(s).classList.toggle('hidden', s !== id);
    });
    currentScreen = id;
  }

  function enterGame() {
    showTopScreen('game-root');
    showGameScreen('title-screen');
  }

  async function checkPassphrase() {
    const input = document.getElementById('passphrase-input');
    const val = input.value.trim();
    if (!val) return;
    const hash = await sha256Hex(val);
    if (hash === PASSPHRASE_HASH) {
      sessionStorage.setItem('nb_unlocked', '1');
      document.getElementById('passphrase-error').classList.add('hidden');
      enterGame();
    } else {
      document.getElementById('passphrase-error').classList.remove('hidden');
      input.select();
    }
  }

  function startOverworld() {
    showGameScreen('overworld-screen');
    Overworld.start();
    AudioEngine.playOverworldTheme();
  }

  function enterBattle() {
    Overworld.stop();
    showGameScreen('battle-screen');
    Battle.start();
  }

  function handleBattleEnd(result) {
    if (result === 'ran') {
      startOverworld();
      return;
    }
    AudioEngine.stopMusic();
    const img = document.getElementById('ending-image');
    const img2 = document.getElementById('ending-image-2');
    const heart = document.getElementById('ending-heart');
    const text = document.getElementById('ending-text');
    img2.classList.add('hidden');
    heart.classList.add('hidden');
    if (result === 'caught') {
      img.src = 'images/nanako_normal.png';
      img2.src = 'images/erina_heart.png';
      img2.classList.remove('hidden');
      heart.classList.remove('hidden');
      text.textContent = 'ナナコを なかよく つかまえた！\n\n「あなたと なかよしに なったよ♪」';
    } else if (result === 'defeated') {
      img.src = 'images/nanako_angry.png';
      text.textContent = 'ナナコは すっかり おこってしまった…\n\n「ばぶーっ！！」';
    } else {
      img.src = 'images/erina_normal.png';
      text.textContent = 'エリナは あそびすぎて ねむってしまった…\n\nもう一度 ちょうせんしよう！';
    }
    showGameScreen('ending-screen');
  }

  function wireTouchControls() {
    document.querySelectorAll('.dpad-btn').forEach(btn => {
      const dir = btn.dataset.dir;
      const press = (e) => { e.preventDefault(); Overworld.setHeldDir(dir); Overworld.tryStep(dir); };
      const release = () => Overworld.clearHeldDir(dir);
      btn.addEventListener('touchstart', press, { passive: false });
      btn.addEventListener('touchend', release);
      btn.addEventListener('touchcancel', release);
      btn.addEventListener('mousedown', press);
      btn.addEventListener('mouseup', release);
      btn.addEventListener('mouseleave', release);
    });
    document.getElementById('action-button').addEventListener('click', () => Overworld.tryInteract());

    const KEY_DIR = { ArrowUp: 'up', ArrowDown: 'down', ArrowLeft: 'left', ArrowRight: 'right' };
    window.addEventListener('keydown', (e) => {
      if (currentScreen !== 'overworld-screen') return;
      if (KEY_DIR[e.key]) { Overworld.setHeldDir(KEY_DIR[e.key]); Overworld.tryStep(KEY_DIR[e.key]); }
      if (e.key === 'z' || e.key === 'Z' || e.key === ' ' || e.key === 'Enter') Overworld.tryInteract();
    });
    window.addEventListener('keyup', (e) => {
      if (KEY_DIR[e.key]) Overworld.clearHeldDir(KEY_DIR[e.key]);
    });
  }

  window.addEventListener('DOMContentLoaded', () => {
    document.getElementById('passphrase-submit').addEventListener('click', checkPassphrase);
    document.getElementById('passphrase-input').addEventListener('keydown', (e) => {
      if (e.key === 'Enter') checkPassphrase();
    });

    Overworld.init(document.getElementById('overworld-canvas'), { onTalk: enterBattle });
    Battle.init({ onEnd: handleBattleEnd });
    wireTouchControls();

    document.getElementById('start-button').addEventListener('click', () => {
      AudioEngine.ensureContext();
      AudioEngine.playConfirm();
      startOverworld();
    });
    document.getElementById('retry-button').addEventListener('click', () => {
      AudioEngine.playSelect();
      showGameScreen('title-screen');
    });

    if (sessionStorage.getItem('nb_unlocked') === '1') {
      enterGame();
    } else {
      showTopScreen('lock-screen');
    }
  });
})();
