// 家の中を歩くオーバーワールド(2階建て・タイルセット描画・タイルベース移動)
const Overworld = (() => {
  const TILE = 32; // 表示タイルサイズ(px)
  const SRC_T = 16; // タイルセット内のソースタイルサイズ(px)

  const NPC_SPRITES = {
    nanako: 'images/nanako_normal.png',
    hiroshi: 'images/hiroshi_normal.png',
    ikuko: 'images/ikuko_normal.png',
  };

  let canvas, ctx;
  let dialogueBox, dialogueText;
  let sheetImages = {};
  let npcImages = {};
  let playerImg;
  let floorKey, floor;
  let player = { col: 0, row: 0, x: 0, y: 0, dir: 'down', moving: false, targetCol: 0, targetRow: 0 };
  let heldDir = null;
  let rafId = null;
  let lastTime = 0;
  let t = 0;
  let dialogueWaiting = false;
  let pendingAdvance = null;
  let callbacks = {};

  function init(canvasEl, opts) {
    canvas = canvasEl;
    ctx = canvas.getContext('2d');
    ctx.imageSmoothingEnabled = false;
    dialogueBox = document.getElementById('dialogue-box');
    dialogueText = document.getElementById('dialogue-text');
    callbacks = opts;

    Object.entries(Maps.SHEETS).forEach(([key, src]) => {
      const img = new Image();
      img.src = src;
      sheetImages[key] = img;
    });
    Object.entries(NPC_SPRITES).forEach(([id, src]) => {
      const img = new Image();
      img.src = src;
      npcImages[id] = img;
    });
    playerImg = new Image();
    playerImg.src = 'images/erina_normal.png';

    dialogueBox.classList.add('hidden');
    dialogueBox.onclick = () => advanceDialogue();
  }

  function enterFloor(key, atCol, atRow) {
    floorKey = key;
    floor = key === 'FLOOR_1' ? Maps.FLOOR_1 : Maps.FLOOR_2;
    canvas.width = floor.cols * TILE;
    canvas.height = floor.rows * TILE;
    const start = (atCol != null) ? { col: atCol, row: atRow } : floor.playerStart;
    player.col = start.col;
    player.row = start.row;
    player.x = start.col * TILE;
    player.y = start.row * TILE;
    player.dir = 'down';
    player.moving = false;
    heldDir = null;
  }

  function objectAt(col, row) {
    for (const obj of floor.objects) {
      const def = Maps.OBJECT_DEFS[obj.key];
      if (col >= obj.col && col < obj.col + def.tw && row >= obj.row && row < obj.row + def.th) return obj;
    }
    return null;
  }
  function npcAt(col, row) {
    return floor.npcs.find(n => n.col === col && n.row === row) || null;
  }
  function stairsAt(col, row) {
    return floor.stairs.find(s => s.col === col && s.row === row) || null;
  }

  function isWalkable(col, row) {
    if (row < 0 || row >= floor.rows || col < 0 || col >= floor.cols) return false;
    if (floor.ground[row][col] === Maps.GROUND.WALL) return false;
    if (objectAt(col, row)) return false;
    if (npcAt(col, row)) return false;
    return true;
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

  function showDialogue(text, onAdvance) {
    dialogueText.textContent = text;
    dialogueBox.classList.remove('hidden');
    dialogueWaiting = true;
    pendingAdvance = onAdvance || null;
  }
  function advanceDialogue() {
    if (!dialogueWaiting) return;
    dialogueWaiting = false;
    dialogueBox.classList.add('hidden');
    const fn = pendingAdvance;
    pendingAdvance = null;
    if (fn) fn();
  }

  function tryInteract() {
    if (dialogueWaiting) { advanceDialogue(); return; }
    if (player.moving) return;
    let { col, row, dir } = player;
    if (dir === 'up') row--;
    else if (dir === 'down') row++;
    else if (dir === 'left') col--;
    else if (dir === 'right') col++;
    const npc = npcAt(col, row);
    if (npc && callbacks.onTalk) {
      AudioEngine.playConfirm();
      callbacks.onTalk(npc.id);
      return;
    }
    const obj = objectAt(col, row);
    if (obj) {
      const def = Maps.OBJECT_DEFS[obj.key];
      if (obj.item && callbacks.onChestOpen) {
        AudioEngine.playConfirm();
        callbacks.onChestOpen(obj, floorKey);
        return;
      }
      if (def && def.custom === 'phone' && callbacks.onPhoneUse) {
        AudioEngine.playConfirm();
        callbacks.onPhoneUse();
      }
    }
  }

  const SPEED = 220;

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
        const stair = stairsAt(player.col, player.row);
        if (stair) {
          enterFloor('FLOOR_' + stair.toFloor, stair.toCol, stair.toRow);
          if (callbacks.onFloorChange) callbacks.onFloorChange(floorKey);
        }
      } else {
        player.x += (dx / dist) * move;
        player.y += (dy / dist) * move;
      }
    } else if (heldDir && !dialogueWaiting) {
      tryStep(heldDir);
    }
  }

  function drawGroundTile(col, row, value) {
    const x = col * TILE, y = row * TILE;
    if (value === Maps.GROUND.WALL) {
      ctx.fillStyle = '#5b4636';
      ctx.fillRect(x, y, TILE, TILE);
      ctx.fillStyle = 'rgba(0,0,0,0.18)';
      ctx.fillRect(x, y + TILE - 5, TILE, 5);
      return;
    }
    const src = Maps.GROUND_SRC[value];
    const img = sheetImages[src.sheet];
    if (img && img.complete && img.naturalWidth > 0) {
      ctx.drawImage(img, src.sx, src.sy, SRC_T, SRC_T, x, y, TILE, TILE);
    } else {
      ctx.fillStyle = '#cbb994';
      ctx.fillRect(x, y, TILE, TILE);
    }
  }

  function drawPhoneIcon(col, row) {
    const x = col * TILE, y = row * TILE;
    ctx.fillStyle = '#3a3a45';
    ctx.fillRect(x + 7, y + 6, TILE - 14, TILE - 12);
    ctx.fillStyle = '#ffd54a';
    ctx.fillRect(x + 10, y + 10, TILE - 20, 6);
    const bob = Math.sin(t * 4) * 3;
    ctx.font = 'bold 12px sans-serif';
    ctx.textAlign = 'center';
    ctx.lineWidth = 3;
    ctx.strokeStyle = 'rgba(0,0,0,0.7)';
    ctx.strokeText('☎ でんわ', x + TILE / 2, y - 6 + bob);
    ctx.fillStyle = '#fff8e0';
    ctx.fillText('☎ でんわ', x + TILE / 2, y - 6 + bob);
    ctx.textAlign = 'left';
  }

  function drawObject(obj) {
    const def = Maps.OBJECT_DEFS[obj.key];
    if (def.custom === 'phone') { drawPhoneIcon(obj.col, obj.row); return; }
    const img = sheetImages[def.sheet];
    const dx = obj.col * TILE, dy = obj.row * TILE, dw = def.tw * TILE, dh = def.th * TILE;
    if (img && img.complete && img.naturalWidth > 0) {
      ctx.drawImage(img, def.sx, def.sy, def.tw * SRC_T, def.th * SRC_T, dx, dy, dw, dh);
    } else {
      ctx.fillStyle = '#a98058';
      ctx.fillRect(dx, dy, dw, dh);
    }
  }

  function drawStairsIcon(stair) {
    const col = stair.col, row = stair.row;
    const x = col * TILE, y = row * TILE;
    const currentFloorNum = floorKey === 'FLOOR_1' ? 1 : 2;
    const goingUp = stair.toFloor > currentFloorNum;
    const pulse = 0.5 + 0.5 * Math.sin(t * 3);

    ctx.save();
    ctx.globalAlpha = 0.3 + 0.25 * pulse;
    ctx.fillStyle = '#ffe27a';
    ctx.beginPath();
    ctx.ellipse(x + TILE / 2, y + TILE / 2, TILE * 0.65, TILE * 0.65, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    ctx.fillStyle = 'rgba(20,20,30,0.85)';
    ctx.fillRect(x + 3, y + 3, TILE - 6, TILE - 6);
    ctx.fillStyle = '#e8d9a0';
    for (let i = 0; i < 4; i++) {
      ctx.fillRect(x + 4, y + 4 + i * 6, TILE - 8 - i * 5, 4);
    }

    const bob = Math.sin(t * 4) * 3;
    const labelY = y - 8 + bob;
    const label = (goingUp ? '▲' : '▼') + ' かいだん';
    ctx.font = 'bold 13px sans-serif';
    ctx.textAlign = 'center';
    ctx.lineWidth = 3;
    ctx.strokeStyle = 'rgba(0,0,0,0.7)';
    ctx.strokeText(label, x + TILE / 2, labelY);
    ctx.fillStyle = '#fff8e0';
    ctx.fillText(label, x + TILE / 2, labelY);
    ctx.textAlign = 'left';
  }

  function drawCharSprite(img, px, py, bobOffset, flip) {
    if (!img || !img.complete || img.naturalWidth === 0) return;
    const h = TILE * 3.4;
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

  function render() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    for (let r = 0; r < floor.rows; r++) {
      for (let c = 0; c < floor.cols; c++) drawGroundTile(c, r, floor.ground[r][c]);
    }
    floor.stairs.forEach(drawStairsIcon);
    floor.objects.forEach(drawObject);

    floor.npcs.forEach(npc => {
      const bob = Math.sin(t * 2.2 + npc.col) * 2;
      drawCharSprite(npcImages[npc.id], npc.col * TILE, npc.row * TILE, bob, npc.facing === 'right');
    });

    const playerBob = player.moving ? Math.abs(Math.sin(t * 10)) * 3 : 0;
    drawCharSprite(playerImg, player.x, player.y, -playerBob, player.dir === 'right');
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

  function debugPos() { return { floorKey, col: player.col, row: player.row, dir: player.dir, moving: player.moving }; }

  return { init, enterFloor, start, stop, setHeldDir, clearHeldDir, tryStep, tryInteract, showDialogue, debugPos };
})();
