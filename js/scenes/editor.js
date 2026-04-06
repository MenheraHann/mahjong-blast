// editor.js - 关卡编辑器场景
// 支持三种位置类型：正格(single)、边位(edge)、角位(corner)
// 层数据使用 Map 结构，key 为 "row_col" 字符串
// 使用真实麻将牌图片渲染，点位模式（碰撞检测排除冲突点）

class EditorScene extends Phaser.Scene {
    constructor() {
        super({ key: 'EditorScene' });
    }

    init(data) {
        this.currentLevel = data.level || 1;
        this.symmetry = data.symmetry || 'horizontal';
        this.activeTool = 'white';
        this.currentLayer = 0;
        this.layers = [];
        this.boardParams = {};
    }

    preload() {
        this.load.image('editor_tile_white', 'assets/pixelMajong/48.png');
        this.load.image('editor_tile_back', 'assets/pixelMajong/00.png');
        this.load.image('editor_tile_shadow', 'assets/pixelMajong/shadow.png');
        this.load.audio('sfx-button', 'assets/wav/按钮点击.WAV');
    }

    create() {
        this.w = this.cameras.main.width;
        this.h = this.cameras.main.height;

        this.add.rectangle(0, 0, this.w, this.h, 0x2c3e50).setOrigin(0);

        this.calculateGridParams();
        this.layers = [new Map()];
        this.loadLevel(this.currentLevel);

        this.createTopBar();
        this.createGrid();
        this.createBottomBar();

        this.renderCurrentLayer();
    }

    // ==================== 网格参数计算 ====================

    calculateGridParams() {
        const cols = 7;
        const rows = 8;
        const topBarH = 110;
        const bottomBarH = 120;
        const padding = 15;

        const availW = this.w - padding * 2;
        const availH = this.h - topBarH - bottomBarH - padding * 2;
        const tileRatio = 51 / 76;

        // 7 张完整牌宽 × 8 张完整牌高
        const tileByW = availW / cols;
        const tileByH = (availH / rows) * tileRatio;
        const tileSize = Math.floor(Math.min(tileByW, tileByH));
        const tileHeight = Math.round(tileSize / tileRatio);

        const actualBoardW = cols * tileSize;
        const actualBoardH = rows * tileHeight;
        const startX = (this.w - actualBoardW) / 2 + tileSize / 2;
        const startY = topBarH + (this.h - topBarH - bottomBarH) / 2 - actualBoardH / 2 + tileHeight / 2;

        this.boardParams = {
            cols, rows, tileSize, tileHeight,
            startX, startY,
            topBarH, bottomBarH,
            imgOrigW: 100,
            imgOrigH: 138,
            layerOffsetX: -10,
            layerOffsetY: -12
        };
    }

    // ==================== 层数据管理 ====================

    ensureLayer(layer) {
        while (this.layers.length <= layer) {
            this.layers.push(new Map());
        }
    }

    posToKey(row, col) {
        return `${row}_${col}`;
    }

    keyToPos(key) {
        const parts = key.split('_');
        return { row: parseFloat(parts[0]), col: parseFloat(parts[1]) };
    }

    getTileAt(layer, row, col) {
        if (layer < 0 || layer >= this.layers.length) return null;
        const key = this.posToKey(row, col);
        const val = this.layers[layer].get(key);
        return val !== undefined ? val : null;
    }

    setTileAt(layer, row, col, data) {
        this.ensureLayer(layer);
        const key = this.posToKey(row, col);
        if (data === null) {
            this.layers[layer].delete(key);
        } else {
            this.layers[layer].set(key, data);
        }
    }

    // ==================== 位置类型判断 ====================

    isSinglePos(row, col) {
        return Number.isInteger(row) && Number.isInteger(col);
    }

    isEdgePos(row, col) {
        const rowIsInt = Number.isInteger(row);
        const colIsInt = Number.isInteger(col);
        if (rowIsInt && !colIsInt && col % 1 === 0.5) return true;
        if (!rowIsInt && colIsInt && row % 1 === 0.5) return true;
        return false;
    }

    isCornerPos(row, col) {
        return (row % 1 === 0.5) && (col % 1 === 0.5);
    }

    // ==================== 对称逻辑 ====================

    isEditableCell(row, col) {
        if (this.symmetry === 'horizontal') {
            return row >= 3.5;
        } else {
            return col <= 3;
        }
    }

    getMirrorCell(row, col) {
        if (this.symmetry === 'horizontal') {
            return { row: 7 - row, col: col };
        } else {
            return { row: row, col: 6 - col };
        }
    }

    // ==================== 碰撞检测 ====================

    // 检查在 (row, col) 位置放一张牌，是否会和当前层已有牌重叠
    isOverlapping(row, col) {
        const { tileSize, tileHeight } = this.boardParams;

        // 新牌的矩形范围（以中心为原点）
        const newLeft = col * tileSize - tileSize / 2;
        const newRight = col * tileSize + tileSize / 2;
        const newTop = row * tileHeight - tileHeight / 2;
        const newBottom = row * tileHeight + tileHeight / 2;

        let hasOverlap = false;
        this.layers[this.currentLayer].forEach((tile, key) => {
            if (tile === null) return;
            if (hasOverlap) return;

            const pos = this.keyToPos(key);
            const existLeft = pos.col * tileSize - tileSize / 2;
            const existRight = pos.col * tileSize + tileSize / 2;
            const existTop = pos.row * tileHeight - tileHeight / 2;
            const existBottom = pos.row * tileHeight + tileHeight / 2;

            // 检查矩形重叠
            const overlapX = !(newRight <= existLeft || newLeft >= existRight);
            const overlapY = !(newBottom <= existTop || newTop >= existBottom);
            if (overlapX && overlapY) hasOverlap = true;
        });

        return hasOverlap;
    }

    // ==================== 支撑检测 ====================

    hasSupport(layer, row, col) {
        if (layer <= 0) return true;
        const below = this.getTileAt(layer - 1, row, col);
        return below !== null;
    }

    // ==================== 位置范围验证 ====================

    isValidPosition(row, col) {
        if (this.isSinglePos(row, col)) {
            return row >= 0 && row <= 7 && col >= 0 && col <= 6;
        }
        if (Number.isInteger(row) && col % 1 === 0.5) {
            return row >= 0 && row <= 7 && col >= 0.5 && col <= 5.5;
        }
        if (row % 1 === 0.5 && Number.isInteger(col)) {
            return row >= 0.5 && row <= 6.5 && col >= 0 && col <= 6;
        }
        if (this.isCornerPos(row, col)) {
            return row >= 0.5 && row <= 6.5 && col >= 0.5 && col <= 5.5;
        }
        return false;
    }

    // ==================== 像素坐标 ====================

    getPixelPos(row, col, layer) {
        const { tileSize, tileHeight, startX, startY, layerOffsetX, layerOffsetY } = this.boardParams;
        const x = startX + col * tileSize + layer * layerOffsetX;
        const y = startY + row * tileHeight + layer * layerOffsetY;
        return { x, y };
    }

    getTileScale() {
        const { tileSize, tileHeight, imgOrigW, imgOrigH } = this.boardParams;
        return Math.min((tileSize - 2) / imgOrigW, (tileHeight - 2) / imgOrigH);
    }

    // ==================== 顶部栏 ====================

    createTopBar() {
        const { topBarH } = this.boardParams;
        const topY = topBarH / 2;

        this.add.rectangle(0, 0, this.w, topBarH, 0x1a252f).setOrigin(0);

        const backBtn = this.add.text(20, topY - 15, '< 返回', {
            fontSize: '20px',
            color: '#ffffff',
            backgroundColor: '#e74c3c',
            padding: { x: 12, y: 8 }
        }).setOrigin(0, 0.5).setInteractive({ useHandCursor: true });

        backBtn.on('pointerdown', () => {
            this.sound.play('sfx-button');
            this.scene.start('HomeScene');
        });

        const levelBtnY = topY - 30;
        const levelStartX = this.w / 2 - (10 * 36) / 2;
        this.levelButtons = [];

        for (let i = 1; i <= 10; i++) {
            const x = levelStartX + (i - 1) * 36;
            const isActive = i === this.currentLevel;
            const btn = this.add.text(x, levelBtnY, `${i}`, {
                fontSize: '18px',
                color: isActive ? '#ffffff' : '#bdc3c7',
                backgroundColor: isActive ? '#3498db' : '#34495e',
                padding: { x: 10, y: 6 }
            }).setInteractive({ useHandCursor: true });

            btn.on('pointerdown', () => {
                this.switchLevel(i);
            });

            this.levelButtons.push(btn);
        }

        this.symmetryBtn = this.add.text(this.w - 20, topY - 15, this.getSymmetryLabel(), {
            fontSize: '18px',
            color: '#ffffff',
            backgroundColor: '#8e44ad',
            padding: { x: 12, y: 8 }
        }).setOrigin(1, 0.5).setInteractive({ useHandCursor: true });

        this.symmetryBtn.on('pointerdown', () => {
            this.toggleSymmetry();
        });

        const layerY = topY + 25;
        this.add.text(this.w / 2 - 80, layerY, '层:', {
            fontSize: '18px',
            color: '#ecf0f1'
        }).setOrigin(0.5);

        this.layerDownBtn = this.add.text(this.w / 2 - 45, layerY, '▼', {
            fontSize: '20px',
            color: '#ffffff',
            backgroundColor: '#2980b9',
            padding: { x: 8, y: 4 }
        }).setOrigin(0.5).setInteractive({ useHandCursor: true });

        this.layerDownBtn.on('pointerdown', () => {
            if (this.currentLayer > 0) {
                this.currentLayer--;
                this.renderCurrentLayer();
                this.updateLayerDisplay();
            }
        });

        this.layerText = this.add.text(this.w / 2, layerY, `Layer ${this.currentLayer}`, {
            fontSize: '18px',
            color: '#f1c40f',
            fontStyle: 'bold'
        }).setOrigin(0.5);

        this.layerUpBtn = this.add.text(this.w / 2 + 45, layerY, '▲', {
            fontSize: '20px',
            color: '#ffffff',
            backgroundColor: '#2980b9',
            padding: { x: 8, y: 4 }
        }).setOrigin(0.5).setInteractive({ useHandCursor: true });

        this.layerUpBtn.on('pointerdown', () => {
            this.currentLayer++;
            this.ensureLayer(this.currentLayer);
            this.renderCurrentLayer();
            this.updateLayerDisplay();
        });
    }

    getSymmetryLabel() {
        return this.symmetry === 'horizontal' ? '横对称' : '纵对称';
    }

    toggleSymmetry() {
        this.symmetry = this.symmetry === 'horizontal' ? 'vertical' : 'horizontal';
        this.symmetryBtn.setText(this.getSymmetryLabel());
        this.renderCurrentLayer();
    }

    updateLayerDisplay() {
        this.layerText.setText(`Layer ${this.currentLayer}`);
    }

    // ==================== 底部栏 ====================

    createBottomBar() {
        const { bottomBarH } = this.boardParams;
        const bottomY = this.h - bottomBarH / 2;

        this.add.rectangle(0, this.h - bottomBarH, this.w, bottomBarH, 0x1a252f).setOrigin(0);

        const toolLabels = [
            { key: 'white', label: '白牌', color: '#27ae60' },
            { key: 'faceDown', label: '暗扣', color: '#2980b9' },
            { key: 'eraser', label: '橡皮', color: '#e67e22' }
        ];

        this.toolButtons = {};
        const toolStartX = 30;
        const toolSpacing = 100;
        const toolY = bottomY - 25;

        toolLabels.forEach((tool, idx) => {
            const x = toolStartX + idx * toolSpacing;
            const isActive = tool.key === this.activeTool;
            const btn = this.add.text(x, toolY, tool.label, {
                fontSize: '18px',
                color: isActive ? '#ffffff' : '#bdc3c7',
                backgroundColor: isActive ? tool.color : '#34495e',
                padding: { x: 14, y: 8 }
            }).setOrigin(0, 0.5).setInteractive({ useHandCursor: true });

            btn.on('pointerdown', () => {
                this.setActiveTool(tool.key);
            });

            this.toolButtons[tool.key] = { btn, color: tool.color };
        });

        const saveBtn = this.add.text(this.w - 30, toolY, '保存', {
            fontSize: '18px',
            color: '#ffffff',
            backgroundColor: '#e74c3c',
            padding: { x: 16, y: 8 }
        }).setOrigin(1, 0.5).setInteractive({ useHandCursor: true });

        saveBtn.on('pointerdown', () => {
            this.saveLevel();
        });

        this.tileCountText = this.add.text(this.w - 130, toolY, '', {
            fontSize: '16px',
            color: '#ecf0f1'
        }).setOrigin(0.5);

        this.updateTileCount();
    }

    setActiveTool(toolKey) {
        this.activeTool = toolKey;
        Object.keys(this.toolButtons).forEach(key => {
            const { btn, color } = this.toolButtons[key];
            if (key === toolKey) {
                btn.setBackgroundColor(color);
                btn.setColor('#ffffff');
            } else {
                btn.setBackgroundColor('#34495e');
                btn.setColor('#bdc3c7');
            }
        });
    }

    updateTileCount() {
        let count = 0;
        this.layers.forEach(layerMap => {
            layerMap.forEach((val) => {
                if (val !== null) count++;
            });
        });
        this.tileCountText.setText(`牌数: ${count}`);
    }

    // ==================== 渲染 ====================

    createGrid() {
        this.gridContainer = this.add.container(0, 0);
    }

    // 绘制一个带柔光的小圆点
    drawAnchorDot(x, y, color, alpha = 0.8, radius = 4) {
        const glow = this.add.circle(x, y, radius + 4, color, alpha * 0.12);
        const outer = this.add.circle(x, y, radius, color, alpha * 0.4);
        const inner = this.add.circle(x, y, radius - 1, color, alpha);
        this.gridContainer.add(glow);
        this.gridContainer.add(outer);
        this.gridContainer.add(inner);
    }

    renderCurrentLayer() {
        this.gridContainer.removeAll(true);
        const { tileSize, tileHeight } = this.boardParams;
        const scale = this.getTileScale();

        // ========== 第一步：绘制所有层的牌（已放置的真实牌） ==========
        for (let layer = 0; layer <= this.currentLayer; layer++) {
            const isCurrentLayer = layer === this.currentLayer;

            this.layers[layer].forEach((tile, key) => {
                if (tile === null) return;

                const pos = this.keyToPos(key);
                const { x, y } = this.getPixelPos(pos.row, pos.col, layer);

                const textureKey = tile.faceDown ? 'editor_tile_back' : 'editor_tile_white';
                const img = this.add.image(x, y, textureKey).setScale(scale).setOrigin(0.5);
                if (!isCurrentLayer) img.setAlpha(0.4);

                const shadow = this.add.image(x, y, 'editor_tile_shadow').setScale(scale).setOrigin(0.5);
                shadow.setDepth(-1);
                shadow.setAlpha(isCurrentLayer ? 0.5 : 0.15);

                this.gridContainer.add(shadow);
                this.gridContainer.add(img);

                // 已有牌：透明点击区（橡皮用）
                const zone = this.add.rectangle(x, y, tileSize, tileHeight)
                    .setOrigin(0.5).setInteractive({ useHandCursor: true }).setAlpha(0.01);
                zone.on('pointerdown', () => {
                    this.onCellClick(pos.row, pos.col);
                });
                this.gridContainer.add(zone);
            });
        }

        // ========== 第二步：遍历所有候选中心点，判断是否可放 ==========
        const allCenters = this.getAllCenters();

        allCenters.forEach(ctr => {
            const { row, col } = ctr;
            const { x, y } = this.getPixelPos(row, col, this.currentLayer);

            // 已经有牌的位置跳过（上面已经画了）
            if (this.getTileAt(this.currentLayer, row, col) !== null) return;

            // 碰撞检测：这个点如果放一张完整牌，会不会和当前层已有牌重叠
            if (this.isOverlapping(row, col)) {
                // 被挡住的点：不显示
                return;
            }

            if (this.isEditableCell(row, col)) {
                // 当前可编辑区：亮蓝白点
                this.drawAnchorDot(x, y, 0xd6eaf8, 0.85, 4);
                const zone = this.add.rectangle(x, y, tileSize, tileHeight)
                    .setOrigin(0.5).setInteractive({ useHandCursor: true }).setAlpha(0.01);
                zone.on('pointerdown', () => {
                    this.onCellClick(row, col);
                });
                this.gridContainer.add(zone);

            } else if (this.currentLayer === 0) {
                const mirror = this.getMirrorCell(row, col);
                const mirrorTile = this.getTileAt(this.currentLayer, mirror.row, mirror.col);

                if (mirrorTile !== null) {
                    // 镜像有牌 → 半透明预览
                    const texKey = mirrorTile.faceDown ? 'editor_tile_back' : 'editor_tile_white';
                    const img = this.add.image(x, y, texKey).setScale(scale).setOrigin(0.5).setAlpha(0.3);
                    this.gridContainer.add(img);
                } else {
                    // 镜像区：淡灰点
                    this.drawAnchorDot(x, y, 0x8fa6b8, 0.3, 3);
                }

            } else if (this.hasSupport(this.currentLayer, row, col)) {
                // 上层可支撑区：偏青色点
                this.drawAnchorDot(x, y, 0x7ed6df, 0.7, 4);
                const zone = this.add.rectangle(x, y, tileSize, tileHeight)
                    .setOrigin(0.5).setInteractive({ useHandCursor: true }).setAlpha(0.01);
                zone.on('pointerdown', () => {
                    this.onCellClick(row, col);
                });
                this.gridContainer.add(zone);
            }
        });

        // ========== 第三步：对称分界线 ==========
        this.drawSymmetryLine();
    }

    // 获取所有可能的中心点位置（格位 + 边位 + 角位）
    getAllCenters() {
        const positions = [];
        const { rows, cols } = this.boardParams;
        const seen = new Set();

        const addPos = (row, col) => {
            if (!this.isValidPosition(row, col)) return;
            const key = this.posToKey(row, col);
            if (seen.has(key)) return;
            seen.add(key);
            positions.push({ row, col });
        };

        // 正格（7×8 = 56 个）
        for (let r = 0; r < rows; r++) {
            for (let c = 0; c < cols; c++) {
                addPos(r, c);
            }
        }

        // 水平边位：相邻两格之间
        for (let r = 0; r < rows; r++) {
            for (let c = 0.5; c <= cols - 1.5; c += 1) {
                addPos(r, c);
            }
        }

        // 垂直边位：相邻两行之间
        for (let r = 0.5; r <= rows - 1.5; r += 1) {
            for (let c = 0; c < cols; c++) {
                addPos(r, c);
            }
        }

        // 角位：四格交汇处
        for (let r = 0.5; r <= rows - 1.5; r += 1) {
            for (let c = 0.5; c <= cols - 1.5; c += 1) {
                addPos(r, c);
            }
        }

        return positions;
    }

    // 对称分界线
    drawSymmetryLine() {
        const { tileSize, tileHeight, startX, startY, cols, rows } = this.boardParams;
        const graphics = this.add.graphics();
        graphics.lineStyle(2, 0xf1c40f, 0.5);

        if (this.symmetry === 'horizontal') {
            const lineY = startY + 3.5 * tileHeight;
            graphics.lineBetween(startX - tileSize / 2 - 10, lineY, startX + (cols - 1) * tileSize + tileSize / 2 + 10, lineY);
        } else {
            const lineX = startX + 3 * tileSize;
            graphics.lineBetween(lineX, startY - tileHeight / 2 - 10, lineX, startY + (rows - 1) * tileHeight + tileHeight / 2 + 10);
        }

        this.gridContainer.add(graphics);
    }

    // ==================== 交互 ====================

    onCellClick(row, col) {
        const tile = this.getTileAt(this.currentLayer, row, col);

        if (this.activeTool === 'eraser') {
            if (tile !== null) {
                this.setTileAt(this.currentLayer, row, col, null);
                const mirror = this.getMirrorCell(row, col);
                this.setTileAt(this.currentLayer, mirror.row, mirror.col, null);
                this.cleanupUnsupportedTiles();
                this.renderCurrentLayer();
                this.updateTileCount();
            }
        } else if (this.activeTool === 'white') {
            // 放牌前再做一次碰撞检测（防镜像导致重复）
            if (this.isOverlapping(row, col)) return;
            this.setTileAt(this.currentLayer, row, col, { faceDown: false });
            const mirror = this.getMirrorCell(row, col);
            this.setTileAt(this.currentLayer, mirror.row, mirror.col, { faceDown: false });
            this.renderCurrentLayer();
            this.updateTileCount();
        } else if (this.activeTool === 'faceDown') {
            if (this.isOverlapping(row, col)) return;
            this.setTileAt(this.currentLayer, row, col, { faceDown: true });
            const mirror = this.getMirrorCell(row, col);
            this.setTileAt(this.currentLayer, mirror.row, mirror.col, { faceDown: true });
            this.renderCurrentLayer();
            this.updateTileCount();
        }
    }

    cleanupUnsupportedTiles() {
        for (let layer = 1; layer < this.layers.length; layer++) {
            const toRemove = [];
            this.layers[layer].forEach((val, key) => {
                if (val !== null) {
                    const pos = this.keyToPos(key);
                    if (!this.hasSupport(layer, pos.row, pos.col)) {
                        toRemove.push(key);
                    }
                }
            });
            toRemove.forEach(key => {
                this.layers[layer].delete(key);
            });
        }
    }

    // ==================== 关卡切换 ====================

    switchLevel(level) {
        this.currentLevel = level;
        this.layers = [new Map()];
        this.loadLevel(level);
        this.levelButtons.forEach((btn, idx) => {
            const isActive = (idx + 1) === level;
            btn.setBackgroundColor(isActive ? '#3498db' : '#34495e');
            btn.setColor(isActive ? '#ffffff' : '#bdc3c7');
        });
        this.currentLayer = 0;
        this.updateLayerDisplay();
        this.renderCurrentLayer();
        this.updateTileCount();
    }

    // ==================== 加载/保存 ====================

    loadLevel(level) {
        const key = `mahjongLevel_${level}`;
        const saved = localStorage.getItem(key);
        if (!saved) return;

        try {
            const data = JSON.parse(saved);
            this.symmetry = data.symmetry || 'horizontal';
            this.symmetryBtn.setText(this.getSymmetryLabel());

            this.layers = [new Map()];
            if (data.tiles && Array.isArray(data.tiles)) {
                data.tiles.forEach(t => {
                    this.ensureLayer(t.layer);
                    const mapKey = this.posToKey(t.row, t.col);
                    this.layers[t.layer].set(mapKey, { faceDown: t.faceDown });
                });
            }
        } catch (e) {
            console.error('加载关卡数据失败:', e);
        }
    }

    saveLevel() {
        const tiles = [];
        for (let layer = 0; layer < this.layers.length; layer++) {
            this.layers[layer].forEach((val, key) => {
                if (val !== null) {
                    const pos = this.keyToPos(key);
                    tiles.push({
                        row: pos.row,
                        col: pos.col,
                        layer: layer,
                        faceDown: val.faceDown
                    });
                }
            });
        }

        const levelData = {
            level: this.currentLevel,
            symmetry: this.symmetry,
            tiles: tiles
        };

        const jsonStr = JSON.stringify(levelData, null, 2);
        console.log(`[编辑器] 关卡 ${this.currentLevel} 数据:`, jsonStr);

        const key = `mahjongLevel_${this.currentLevel}`;
        localStorage.setItem(key, jsonStr);

        alert(`关卡 ${this.currentLevel} 已保存！\n共 ${tiles.length} 张牌\n\n${jsonStr}`);
    }
}
