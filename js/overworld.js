// 家の中を歩くオーバーワールド(Canvas描画・タイルベース移動)
const Overworld = (() => {
  const TILE = 32;
  // 0:床 1:かべ 2:ベッド(進入不可) 3:テーブル(進入不可) 4:ラグ(床)
  const MAP = [
    [1,1,1,1,1,1,1,1,1],
    [1,0,0,0,0,0,0,2,1],
    [1,0,0,0,0,0,0,2,1],
    [1,0,0,0,0,0,0,0,1],
    [1,0,3,3,0,0,0,0,1],
    [1,0,3,3,0,0,0,0,1],
    [1,0,0,0,0,0,0,0,1],
    [1,0,0,4,4,0,0,0,1],
    [1,0,0,4,4,0,0,0,1],
    [1,0,0,0,0,0,0,0,1],
    [1,0,0,0,0,0,0,0,1],
    [1,0,0,0,0,0,0,0,1],
    [1,1,1,1,1,1,1,1,1],
  ];
  const ROWS = MAP.length;
  const COLS = MAP[0].length;
  const BABY_TILE = { row: 2, col: 7 };
  const START_TILE = { row: 10, col: 4 };
  const SOLID = new Set([1, 2, 3]);

  let canvas, ctx;
  let dialogueBox, dialogueText;
  let babyImg, playerImg;
  let player = { col: START_TILE.col, row: START_TILE.row, x: 0, y: 0, dir: 'up', moving: false };
  let heldDir = null;
  let rafId = null;
  let lastTime = 0;
  let talkCallback = null;
  let dialogueWaiting = false;

  function isWalkable(col, row) {
    if (row < 0 || row >= ROWS || col < 0 || col >= COLS) return false;
    if (col === BABY_TILE.col && row === BABY_TILE.row) return false;
    return !SOLID.has(MAP[row][col]);
  }

  function init(canvasEl, opts) {
    canvas = canvasEl;
    ctx = canvas.getContext('2d');
    canvas.width = COLS * TILE;
    canvas.height = ROWS * TILE;
    dialogueBox = document.getElementById('dialogue-box');
    dialogueText = document.getElementById('dialogue-text');
    talkCallback = opts.onTalk;

    babyImg = new Image();
    babyImg.src = 'images/nanako_normal.png';
    playerImg = new Image();
    playerImg.src = 'images/erina_normal.png';

    player.col = START_TILE.col;
    player.row = START_TILE.row;
    player.x = player.col * TILE;
    player.y = player.row * TILE;
    player.dir = 'up';
    player.moving = false;

    dialogueBox.classList.add('hidden');
    dialogueWaiting = false;

    dialogueBox.onclick = () => advanceDialogue();
  }

  function setHeldDir(dir) { heldDir = dir; }
  function clearHeldDir(dir) { if (heldDir === dir) heldDir = null; }

  function tryStep(dir) {
    if (player.moving || dialogueWaiting) { player.dir = dir; return; }
    player.dir = dir;
    let { col, row } = player;
    if (dir === 'up') row--;
    else if (dir === 'down') row++;
    else if (dir === 'left') col--;
    else if (dir === 'right') col++;
    if (isWalkable(col, row)) {
      player.targetCol = col;
      player.targetRow = row;
      player.moving = true;
    }
  }

  function advanceDialogue() {
    if (!dialogueWaiting) return;
    dialogueWaiting = false;
    dialogueBox.classList.add('hidden');
    if (talkCallback) talkCallback();
  }

  function tryInteract() {
    if (dialogueWaiting) { advanceDialogue(); return; }
    if (player.moving) return;
    let { col, row, dir } = player;
    if (dir === 'up') row--;
    else if (dir === 'down') row++;
    else if (dir === 'left') col--;
    else if (dir === 'right') col++;
    if (col === BABY_TILE.col && row === BABY_TILE.row) {
      AudioEngine.playConfirm();
      dialogueText.textContent = 'ナナコ「ばぶばぶ！」';
      dialogueBox.classList.remove('hidden');
      dialogueWaiting = true;
    }
  }

  const SPEED = 220; // px/sec

  function update(dt) {
    if (player.moving) {
      const targetX = player.targetCol * TILE;
      const targetY = player.targetRow * TILE;
      const dx = targetX - player.x;
      const dy = targetY - player.y;
      const dist = Math.hypot(dx, dy);
      const move = SPEED * dt;
      if (dist <= move) {
        player.x = targetX;
        player.y = targetY;
        player.col = player.targetCol;
        player.row = player.targetRow;
        player.moving = false;
      } else {
        player.x += (dx / dist) * move;
        player.y += (dy / dist) * move;
      }
    } else if (heldDir && !dialogueWaiting) {
      tryStep(heldDir);
    }
  }

  function drawTile(col, row, type) {
    const x = col * TILE, y = row * TILE;
    if (type === 1) {
      ctx.fillStyle = '#8a5a3c';
      ctx.fillRect(x, y, TILE, TILE);
      ctx.fillStyle = '#7a4c30';
      ctx.fillRect(x, y + TILE - 6, TILE, 6);
    } else if (type === 2) {
      ctx.fillStyle = '#ffd3e1';
      ctx.fillRect(x, y, TILE, TILE);
      ctx.fillStyle = '#fff';
      ctx.fillRect(x + 4, y + 4, TILE - 8, TILE * 0.45);
    } else if (type === 3) {
      ctx.fillStyle = '#b9824f';
      ctx.fillRect(x + 2, y + 2, TILE - 4, TILE - 4);
    } else {
      ctx.fillStyle = ((col + row) % 2 === 0) ? '#bfe8b0' : '#b3e0a4';
      ctx.fillRect(x, y, TILE, TILE);
      if (type === 4) {
        ctx.fillStyle = 'rgba(255,200,120,0.55)';
        ctx.fillRect(x + 2, y + 2, TILE - 4, TILE - 4);
      }
    }
  }

  function drawSprite(img, px, py, bobOffset, flip) {
    if (!img.complete || img.naturalWidth === 0) return;
    const h = TILE * 1.6;
    const w = h * (img.naturalWidth / img.naturalHeight);
    const dx = px + TILE / 2 - w / 2;
    const dy = py + TILE - h + bobOffset;
    ctx.save();
    ctx.beginPath();
    ctx.ellipse(px + TILE / 2, py + TILE - 2, TILE * 0.32, TILE * 0.14, 0, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    ctx.fill();
    if (flip) {
      ctx.translate(dx + w, dy);
      ctx.scale(-1, 1);
      ctx.drawImage(img, 0, 0, w, h);
    } else {
      ctx.drawImage(img, dx, dy, w, h);
    }
    ctx.restore();
  }

  let t = 0;
  function render() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) drawTile(c, r, MAP[r][c]);
    }
    const babyBob = Math.sin(t * 2.2) * 2;
    drawSprite(babyImg, BABY_TILE.col * TILE, BABY_TILE.row * TILE, babyBob, false);

    const playerBob = player.moving ? Math.abs(Math.sin(t * 10)) * 3 : 0;
    drawSprite(playerImg, player.x, player.y, -playerBob, player.dir === 'right');
  }

  function loop(timestamp) {
    if (!lastTime) lastTime = timestamp;
    const dt = Math.min(0.05, (timestamp - lastTime) / 1000);
    lastTime = timestamp;
    t += dt;
    update(dt);
    render();
    rafId = requestAnimationFrame(loop);
  }

  function start() {
    lastTime = 0;
    rafId = requestAnimationFrame(loop);
  }
  function stop() {
    if (rafId) cancelAnimationFrame(rafId);
    rafId = null;
  }

  return { init, start, stop, setHeldDir, clearHeldDir, tryStep, tryInteract };
})();
