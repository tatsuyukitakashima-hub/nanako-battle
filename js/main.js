// 画面遷移・合言葉ゲート・ストーリー進行・入力まわりの結線
(() => {
  // sha256("菜々子ザムライ")
  const PASSPHRASE_HASH = 'c86b167078f5ca451d035b8ee71af423e662d497288b3c750b2db1b9fade3881';

  let currentScreen = 'lock-screen';
  let currentEncounter = null; // 'nanako' | 'hiroshi' | 'ikuko'

  const flags = { nanakoRecruited: false, tomonoriRecruited: false, hiroshiDefeated: false, ikukoDefeated: false };

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
  const HIROSHI_MOVES = [
    { name: '電動ドリルラッシュ', power: 20, accuracy: 0.95, anim: 'drill', flavor: 'ヒロシの 電動ドリルラッシュ！' },
    { name: '麻酔注射', power: 6, accuracy: 1.0, anim: 'injection', effect: 'sleep', flavor: 'ヒロシの 麻酔注射！' },
    { name: 'レントゲン凝視', power: 18, accuracy: 1.0, anim: 'xray', flavor: 'ヒロシの レントゲン凝視！' },
    { name: 'バイク特攻', power: 28, accuracy: 0.85, anim: 'bike', flavor: 'ヒロシの バイク特攻！' },
  ];
  const IKUKO_MOVES = [
    { name: '掃除機タックル', power: 18, accuracy: 1.0, anim: 'vacuum', flavor: 'イクコの 掃除機タックル！' },
    { name: '特売チラシビンタ', power: 8, accuracy: 1.0, anim: 'flyer', effect: 'poison', effectChance: 0.6, flavor: 'イクコの 特売チラシビンタ！' },
    { name: 'げきから手作り料理', power: 22, accuracy: 0.9, anim: 'spicy', flavor: 'イクコの げきから手作り料理！' },
    { name: 'カミナリ説教', power: 26, accuracy: 0.85, anim: 'scold', flavor: 'イクコの カミナリ説教！' },
  ];
  const TOMONORI_MOVES = [
    { name: '名刺ストレート', power: 18, accuracy: 1.0, anim: 'cardthrow', flavor: 'とものりの 名刺ストレート！' },
    { name: '満員電車プレッシャー', power: 22, accuracy: 0.9, anim: 'crowd', flavor: 'とものりの 満員電車プレッシャー！' },
    { name: '残業ラリアット', power: 26, accuracy: 0.85, anim: 'lariat', flavor: 'とものりの 残業ラリアット！' },
    { name: '飲み会の愚痴', power: 4, accuracy: 1.0, anim: 'complain', effect: 'sleep', flavor: 'とものりの 飲み会の愚痴…' },
  ];
  const TRIO_MOVES = [
    ERINA_MOVES[0],
    NANAKO_MOVES[2],
    TOMONORI_MOVES[2],
    { name: 'トリプルファミリーアタック', power: 36, accuracy: 1.0, anim: 'combo', flavor: 'エリナ・ナナコ・とものりの トリプルファミリーアタック！！' },
  ];

  const ROSTER = {
    erina: { name: 'エリナ', level: 5, sprite: 'images/erina_normal.png', moves: ERINA_MOVES },
    nanako: { name: 'ナナコ', level: 5, sprite: 'images/nanako_normal.png', moves: NANAKO_MOVES },
    tomonori: { name: 'とものり', level: 5, sprite: 'images/tomonori_normal.png', moves: TOMONORI_MOVES },
    trio: {
      name: 'エリナ&ナナコ&とものり', level: 10, sprite: 'images/erina_normal.png',
      teamSprites: ['images/erina_normal.png', 'images/nanako_normal.png', 'images/tomonori_normal.png'],
      moves: TRIO_MOVES,
    },
  };
  const ENEMIES = {
    nanako: {
      name: 'ヤンチャな ナナコ', shortName: 'ナナコ', level: 5,
      sprite: 'images/nanako_normal.png', defeatedSprite: 'images/nanako_angry.png',
      moves: NANAKO_MOVES, faintLine: 'ナナコ は はらを たてた！ 「ばぶーっ！！」',
    },
    hiroshi: {
      name: '院長 ヒロシ', level: 5, sprite: 'images/hiroshi_normal.png', moves: HIROSHI_MOVES,
      bossTheme: true, faintLine: 'ヒロシ「・・・まいった。腕を 上げたな。」',
      enrageMove: { name: 'バイク式ドリル爆走', power: 30, accuracy: 0.9, anim: 'bikeDrill', flavor: 'ヒロシは バイクを 走らせながら 歯科治療器具で 攻撃してきた！！' },
      enrageThreshold: 0.3,
    },
    ikuko: {
      name: 'イクコ', level: 5, sprite: 'images/ikuko_normal.png', moves: IKUKO_MOVES,
      bossTheme: true, faintLine: 'イクコ「あらあら、やられちゃったわ。ヒロシさんは 強いわよ、気をつけてね。」',
    },
  };

  const ITEMS = {
    diaper: {
      pickupLines: [
        '宝箱を あけた！',
        'オムツを 見つけた！',
        'オムツは ナナコに 履かせた方が よさそうね。',
      ],
      apply: () => { ROSTER.nanako.defenseBonus = (ROSTER.nanako.defenseBonus || 0) + 4; },
      resultLine: () => 'ナナコの ぼうぎょりょくが あがった！',
    },
    mizotakuSticker: {
      pickupLines: [
        '宝箱を あけた！',
        'ミゾタクの ステッカーを 見つけた！',
        'これが あれば なんでも できるわ！',
      ],
      apply: () => { ROSTER.erina.level += 1; },
      resultLine: () => `エリナは Lv.${ROSTER.erina.level} に あがった！`,
    },
  };
  const openedChests = new Set();

  function showDialogueSequence(lines, onDone) {
    let i = 0;
    function next() {
      if (i >= lines.length) { if (onDone) onDone(); return; }
      Overworld.showDialogue(lines[i++], next);
    }
    next();
  }

  function onChestOpen(obj, floorKey) {
    const key = floorKey + ':' + obj.col + ':' + obj.row;
    if (openedChests.has(key)) {
      Overworld.showDialogue('もう なにも 入っていない…', null);
      return;
    }
    openedChests.add(key);
    const item = ITEMS[obj.item];
    showDialogueSequence(item.pickupLines, () => {
      item.apply();
      Overworld.showDialogue(item.resultLine(), null);
    });
  }

  function onPhoneUse() {
    if (flags.tomonoriRecruited) {
      Overworld.showDialogue('とものり「呼んでくれれば いつでも 駆けつけるよ！」', null);
      return;
    }
    showDialogueSequence([
      'エリナは とものりに 電話を かけた。',
      'とものり「もしもし？ ……新社会人で 今 忙しいんだけど。」',
      'とものり「姉ちゃんの 頼みなら……分かった、すぐ 行くよ！」',
    ], () => {
      flags.tomonoriRecruited = true;
      Overworld.showDialogue('とものりが やってきた！ なかまに なった！', null);
    });
  }

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
    ['title-screen', 'overworld-screen', 'select-screen', 'battle-screen', 'ending-screen'].forEach(s => {
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

  function resetFlags() {
    flags.nanakoRecruited = false;
    flags.tomonoriRecruited = false;
    flags.hiroshiDefeated = false;
    flags.ikukoDefeated = false;
  }

  const INTRO_LINES = [
    'わたしは ベビートレーナーの エリナ。',
    '今日も 菜々子を トレーニングしないとだわ。',
    'まずは 2階の 菜々子を てなずけて、',
    'そのあとは パパと ママに 相手してもらおうかしら。',
    '十字キーで うごいて、Aボタンで 話しかけよう。かいだんで 階を移動できるわ。',
  ];

  function startNewGame() {
    resetFlags();
    Overworld.enterFloor('FLOOR_2');
    resumeOverworld();
    showDialogueSequence(INTRO_LINES, null);
  }

  function resumeOverworld() {
    showGameScreen('overworld-screen');
    Overworld.start();
    AudioEngine.playOverworldTheme();
  }

  function onTalk(npcId) {
    if (npcId === 'nanako') {
      if (!flags.nanakoRecruited) {
        Overworld.showDialogue('ナナコ「ばぶばぶ！」', () => startStoryBattle('erina', 'nanako'));
      } else {
        Overworld.showDialogue('ナナコ「ばぶー♪」(なかよし)', null);
      }
      return;
    }
    if (npcId === 'hiroshi') {
      if (!flags.nanakoRecruited) {
        Overworld.showDialogue('ヒロシ「今は診察中だ。また後で来てくれ」', null);
      } else if (!flags.hiroshiDefeated) {
        Overworld.showDialogue('ヒロシ「ほう、なかまを連れてきたか。かかってきなさい」', () => openSelectScreen('hiroshi'));
      } else {
        Overworld.showDialogue('ヒロシ「いやはや、完敗だよ」', null);
      }
      return;
    }
    if (npcId === 'ikuko') {
      if (!flags.nanakoRecruited) {
        Overworld.showDialogue('イクコ「あらあら、今は手が離せないのよ」', null);
      } else if (!flags.ikukoDefeated) {
        Overworld.showDialogue('イクコ「あなた、わたしとも勝負よ！」', () => openSelectScreen('ikuko'));
      } else {
        Overworld.showDialogue('イクコ「もう、やられちゃったわ」', null);
      }
      return;
    }
  }

  function openSelectScreen(enemyKey) {
    const cards = document.getElementById('select-cards');
    cards.innerHTML = '';
    const keys = ['erina'];
    if (flags.nanakoRecruited) keys.push('nanako');
    if (flags.tomonoriRecruited) keys.push('tomonori');
    if (flags.nanakoRecruited && flags.tomonoriRecruited) keys.push('trio');
    keys.forEach(key => {
      const fighter = ROSTER[key];
      const card = document.createElement('button');
      card.className = 'select-card';
      card.innerHTML = `<img src="${fighter.sprite}" alt=""><div class="select-name">${fighter.name}</div><div class="select-level">Lv.${fighter.level}</div>`;
      card.addEventListener('click', () => {
        AudioEngine.playConfirm();
        startStoryBattle(key, enemyKey);
      });
      cards.appendChild(card);
    });
    showGameScreen('select-screen');
  }

  function startStoryBattle(fighterKey, enemyKey) {
    currentEncounter = enemyKey;
    Overworld.stop();
    showGameScreen('battle-screen');
    Battle.start({
      player: ROSTER[fighterKey],
      enemy: ENEMIES[enemyKey],
      allowCatch: enemyKey === 'nanako' && !flags.nanakoRecruited,
    });
  }

  function showStoryBeat(imageSrc, text, buttonLabel, onContinue, image2Src) {
    const img = document.getElementById('ending-image');
    const img2 = document.getElementById('ending-image-2');
    const heart = document.getElementById('ending-heart');
    const retry = document.getElementById('retry-button');
    img.src = imageSrc;
    if (image2Src) {
      img2.src = image2Src;
      img2.classList.remove('hidden');
      heart.classList.remove('hidden');
    } else {
      img2.classList.add('hidden');
      heart.classList.add('hidden');
    }
    document.getElementById('ending-text').textContent = text;
    retry.textContent = buttonLabel;
    retry.onclick = () => { AudioEngine.playSelect(); onContinue(); };
    showGameScreen('ending-screen');
  }

  function showFinalEnding() {
    showStoryBeat(
      'images/hiroshi_normal.png',
      'ヒロシを たおした！\n\nヒロシ「みんな 強かったな……お詫びに 魚太郎で 奢らせてくれ！」\n\nみんなで 魚太郎へ ごちそうに 行きました。\n\n――― THE END ―――',
      'タイトルへ',
      () => { resetFlags(); showGameScreen('title-screen'); },
      'images/erina_heart.png'
    );
  }

  function handleBattleEnd(result) {
    const enc = currentEncounter;
    AudioEngine.stopMusic();

    if (result === 'ran') { resumeOverworld(); return; }

    if (enc === 'nanako') {
      if (result === 'lost') {
        showStoryBeat('images/erina_normal.png', 'エリナは あそびすぎて ねむってしまった…\n\nもう一度 ちょうせんしよう！', 'つづける', resumeOverworld);
        return;
      }
      flags.nanakoRecruited = true;
      if (result === 'caught') {
        showStoryBeat('images/nanako_normal.png', 'ナナコを なかよく つかまえた！\n\n「ナナコは なかまに なった！」', 'つづける', resumeOverworld, 'images/erina_heart.png');
      } else {
        showStoryBeat('images/nanako_angry.png', 'ナナコ は はらを たてた！\n\n…でも、すこし仲直りして なかまに なった！', 'つづける', resumeOverworld);
      }
      return;
    }

    if (enc === 'hiroshi' || enc === 'ikuko') {
      if (result === 'lost') {
        const text = enc === 'hiroshi' && !flags.tomonoriRecruited
          ? 'やられてしまった…\n\nエリナ「とものりを 呼びに 2階の 電話に 行かないと……」'
          : 'やられてしまった…\n\n出直して 再挑戦しよう。';
        showStoryBeat('images/erina_normal.png', text, 'つづける', resumeOverworld);
        return;
      }
      flags[enc + 'Defeated'] = true;
      if (flags.hiroshiDefeated && flags.ikukoDefeated) {
        showFinalEnding();
      } else {
        showStoryBeat(ENEMIES[enc].sprite, `${ENEMIES[enc].name} を たおした！`, 'つづける', resumeOverworld);
      }
    }
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

    Overworld.init(document.getElementById('overworld-canvas'), { onTalk, onChestOpen, onPhoneUse });
    Overworld.enterFloor('FLOOR_2');
    Battle.init({ onEnd: handleBattleEnd });
    wireTouchControls();

    document.getElementById('start-button').addEventListener('click', () => {
      AudioEngine.ensureContext();
      AudioEngine.playConfirm();
      startNewGame();
    });

    if (sessionStorage.getItem('nb_unlocked') === '1') {
      enterGame();
    } else {
      showTopScreen('lock-screen');
    }
  });
})();
