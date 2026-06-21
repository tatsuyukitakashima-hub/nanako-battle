// 2階建てマップのデータ定義(タイルセット座標・部屋配置・NPC・階段)
const Maps = (() => {
  const T = 16; // タイルセット内のソース1タイルのpx

  const SHEETS = {
    indoors: 'images/tileset/indoors.png',
    floors: 'images/tileset/floors.png',
    buildings: 'images/tileset/buildings.png',
  };

  const GROUND = { WALL: 0, WOOD: 1, WOOD_DARK: 2, STONE: 3, TILE: 4, RUG: 5 };
  const GROUND_SRC = {
    [GROUND.WOOD]: { sheet: 'floors', sx: 2 * T, sy: 6 * T },
    [GROUND.WOOD_DARK]: { sheet: 'floors', sx: 8 * T, sy: 6 * T },
    [GROUND.STONE]: { sheet: 'floors', sx: 14 * T, sy: 6 * T },
    [GROUND.TILE]: { sheet: 'floors', sx: 2 * T, sy: 10 * T },
    [GROUND.RUG]: { sheet: 'floors', sx: 8 * T, sy: 10 * T },
  };

  const OBJECT_DEFS = {
    bedSingle: { sheet: 'indoors', sx: 0 * T, sy: 12 * T, tw: 2, th: 2 },
    bedDouble: { sheet: 'indoors', sx: 2 * T, sy: 12 * T, tw: 2, th: 2 },
    wardrobe: { sheet: 'indoors', sx: 0 * T, sy: 8 * T, tw: 2, th: 2 },
    bookshelf: { sheet: 'indoors', sx: 6 * T, sy: 8 * T, tw: 2, th: 2 },
    diningTable: { sheet: 'indoors', sx: 6 * T, sy: 13 * T, tw: 4, th: 3 },
    counterPlain: { sheet: 'indoors', sx: 10 * T, sy: 9 * T, tw: 6, th: 1 },
    equipment: { sheet: 'indoors', sx: 12 * T, sy: 19 * T, tw: 2, th: 2 },
    armchair: { sheet: 'indoors', sx: 18 * T, sy: 19 * T, tw: 2, th: 2 },
    chest: { sheet: 'indoors', sx: 8 * T, sy: 18 * T, tw: 2, th: 2 },
    roundTable: { sheet: 'indoors', sx: 18 * T, sy: 16 * T, tw: 2, th: 2 },
  };

  function blankGrid(cols, rows, fill) {
    return Array.from({ length: rows }, () => Array.from({ length: cols }, () => fill));
  }
  function fillRect(grid, x0, y0, x1, y1, value) {
    for (let r = y0; r <= y1; r++) for (let c = x0; c <= x1; c++) {
      if (grid[r] && grid[r][c] !== undefined) grid[r][c] = value;
    }
  }

  const COLS = 15, ROWS = 30;

  function buildFloor1() {
    const ground = blankGrid(COLS, ROWS, GROUND.WALL);
    // 中央の縦通路
    fillRect(ground, 6, 1, 8, 28, GROUND.STONE);
    // 院長室(NW) / 診察室C(NE)
    fillRect(ground, 1, 2, 4, 8, GROUND.WOOD_DARK);
    fillRect(ground, 10, 2, 13, 8, GROUND.TILE);
    // 診察室A(SW) / 診察室B(SE)
    fillRect(ground, 1, 10, 4, 15, GROUND.TILE);
    fillRect(ground, 10, 10, 13, 15, GROUND.TILE);
    // 受付・待合室(下部、全幅)
    fillRect(ground, 1, 18, 13, 26, GROUND.WOOD);
    // 通路への出入り口(壁に隙間)
    fillRect(ground, 5, 4, 5, 5, GROUND.STONE);   // 院長室↔通路
    fillRect(ground, 9, 4, 9, 5, GROUND.STONE);   // 診察室C↔通路
    fillRect(ground, 5, 12, 5, 13, GROUND.STONE); // 診察室A↔通路
    fillRect(ground, 9, 12, 9, 13, GROUND.STONE); // 診察室B↔通路

    const objects = [
      { key: 'bookshelf', col: 1, row: 2 },
      { key: 'armchair', col: 2, row: 5 },
      { key: 'equipment', col: 11, row: 3 },
      { key: 'armchair', col: 11, row: 6 },
      { key: 'equipment', col: 2, row: 11 },
      { key: 'armchair', col: 3, row: 13 },
      { key: 'equipment', col: 11, row: 11 },
      { key: 'armchair', col: 11, row: 13 },
      { key: 'counterPlain', col: 4, row: 19 },
      { key: 'armchair', col: 2, row: 23 },
      { key: 'armchair', col: 11, row: 23 },
      { key: 'roundTable', col: 6, row: 23 },
    ];

    return {
      name: '1F 大沢歯科',
      cols: COLS, rows: ROWS, ground, objects,
      npcs: [
        { id: 'ikuko', col: 6, row: 20, facing: 'up' },
        { id: 'hiroshi', col: 3, row: 6, facing: 'down', requires: 'nanakoRecruited' },
      ],
      stairs: [{ col: 12, row: 25, toFloor: 2, toCol: 12, toRow: 8 }],
      playerStart: { col: 7, row: 27 },
    };
  }

  function buildFloor2() {
    const ground = blankGrid(COLS, ROWS, GROUND.WALL);
    // LDK(上部、全幅)
    fillRect(ground, 1, 2, 13, 10, GROUND.WOOD);
    // 中央の縦通路
    fillRect(ground, 6, 11, 8, 29, GROUND.STONE);
    // 主寝室(SW) / 子供部屋(SE)
    fillRect(ground, 1, 13, 4, 18, GROUND.RUG);
    fillRect(ground, 10, 13, 13, 18, GROUND.RUG);
    // 和室(SW下) / 書斎(SE下)
    fillRect(ground, 1, 21, 4, 26, GROUND.TILE);
    fillRect(ground, 10, 21, 13, 26, GROUND.WOOD_DARK);
    // 出入り口の隙間
    fillRect(ground, 5, 15, 5, 16, GROUND.STONE); // 主寝室↔通路
    fillRect(ground, 9, 15, 9, 16, GROUND.STONE); // 子供部屋↔通路
    fillRect(ground, 5, 23, 5, 24, GROUND.STONE); // 和室↔通路
    fillRect(ground, 9, 23, 9, 24, GROUND.STONE); // 書斎↔通路

    const objects = [
      { key: 'counterPlain', col: 1, row: 2 },
      { key: 'diningTable', col: 7, row: 5 },
      { key: 'roundTable', col: 2, row: 7 },
      { key: 'bedDouble', col: 1, row: 14 },
      { key: 'wardrobe', col: 3, row: 14 },
      { key: 'bedSingle', col: 11, row: 14 },
      { key: 'roundTable', col: 2, row: 22 },
      { key: 'chest', col: 2, row: 24, item: 'diaper' },
      { key: 'bookshelf', col: 11, row: 22 },
      { key: 'chest', col: 11, row: 24, item: 'mizotakuSticker' },
    ];

    return {
      name: '2F 4LDK',
      cols: COLS, rows: ROWS, ground, objects,
      npcs: [
        { id: 'nanako', col: 11, row: 16, facing: 'down' },
      ],
      stairs: [{ col: 12, row: 9, toFloor: 1, toCol: 12, toRow: 25 }],
      playerStart: { col: 7, row: 8 },
    };
  }

  return {
    SHEETS, GROUND, GROUND_SRC, OBJECT_DEFS,
    FLOOR_1: buildFloor1(),
    FLOOR_2: buildFloor2(),
  };
})();
