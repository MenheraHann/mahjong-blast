// editor.js - 关卡编辑器场景

class EditorScene extends Phaser.Scene {
    constructor() {
        super({ key: 'EditorScene' });
    }

    init(data) {
        this.currentLevel = data.level || 1;
        this.currentLayer = 0;
        this.tool = 'faceUp'; // 'faceUp', 'faceDown', 'eraser'
        this.mirror = 'none'; // 'none', 'horizontal', 'vertical'

        // 编辑器中的牌数据
        this.tiles = [];
        // 12×14 网格
        this.gridCols = 12;
        this.gridRows = 14;
    }

    preload() {
        this.load.svg('icon-back', 'assets/icons/back.svg');
        this.load.audio('sfx-button', 'assets/wav/按钮点击.WAV');

        // 加载麻将牌
        const tileMap = [
            1,2,3,4,5,6,7,8,9,       // tile_0~8: 万
            11,12,13,14,15,16,17,18,19,  // tile_9~17: 饼
            31,32,33,34,35,36,37,38,39,  // tile_18~26: 条
            41,42,43,44,45,46,47        // tile_27~33: 字
        ];
        tileMap.forEach((num, idx) => {
            this.load.image(`tile_${idx}`, `assets/pixelMajong/${String(num).padStart(2, '0')}.png`);
        });
        // 牌背
        this.load.image('tile_00', 'assets/pixelMajong/00.png');
    }

    create() {
        const w = this.cameras.main.width;
        const h = this.cameras.main.height;

        // 背景
        this.add.rectangle(0, 0, w, h, 0x2c3e50).setOrigin(0);

        // 加载该关卡的配置（自定义或默认）
        this.loadLevelConfig();

        // 创建设置
        this.createSettings();

        // 创建网格
        this.createGrid();

        // 创建工具栏
        this.createToolbar();

        // 创建层选择器
        this.createLayerSelector();

        // 创建底部按钮
        this.createBottomButtons();
    }

    loadLevelConfig() {
        // 优先加载自定义关卡
        const saved = localStorage.getItem(`mahjong_custom_level_${this.currentLevel}`);
        if (saved) {
            try {
                const config = JSON.parse(saved);
                this.tiles = config.tiles || [];
                return;
            } catch (e) {
                console.error('[编辑器] 加载自定义关卡失败:', e);
            }
        }

        // 加载默认关卡
        const defaultConfig = window.LEVELS ? window.LEVELS[this.currentLevel] : null;
        if (defaultConfig) {
            this.tiles = defaultConfig.tiles || [];
        } else {
            this.tiles = [];
        }
    }

    createSettings() {
        const w = this.cameras.main.width;
        const topY = 45;

        // 返回按钮
        const backBtn = this.add.image(30, topY, 'icon-back').setScale(1.2).setInteractive({ useHandCursor: true });
        backBtn.on('pointerdown', () => {
            this.sound.play('sfx-button');
            this.scene.start('LevelListScene');
        });

        // 标题
        this.add.text(w / 2, topY, `第 ${this.currentLevel} 关编辑`, {
            fontSize: '32px',
            color: '#ffffff',
            fontFamily: 'Arial, sans-serif',
            fontStyle: 'bold'
        }).setOrigin(0.5);

        // 保存按钮
        const saveBtn = this.add.text(w - 30, topY, '保存', {
            fontSize: '24px',
            color: '#ffffff',
            backgroundColor: '#27ae60',
            padding: { x: 20, y: 8 }
        }).setOrigin(0.5).setInteractive({ useHandCursor: true });
        saveBtn.on('pointerdown', () => {
            this.sound.play('sfx-button');
            this.saveLevel();
        });
    }

    createToolbar() {
        const w = this.cameras.main.width;
        const toolbarY = 110;

        // 工具栏背景
        this.add.rectangle(w / 2, toolbarY, w, 60, 0x2c3e50).setOrigin(0.5);

        const tools = [
            { id: 'faceUp', label: '正面' },
            { id: 'faceDown', label: '扣着' },
            { id: 'eraser', label: '橡皮' }
        ];

        const mirrors = [
            { id: 'none', label: '无' },
            { id: 'horizontal', label: '水平' },
            { id: 'vertical', label: '垂直' }
        ];

        // 工具按钮
        const toolStartX = 60;
        tools.forEach((tool, idx) => {
            const x = toolStartX + idx * 100;
            const btn = this.add.text(x, toolbarY, tool.label, {
                fontSize: '20px',
                color: this.tool === tool.id ? '#f1c40f' : '#ffffff',
                backgroundColor: this.tool === tool.id ? '#34495e' : '#2c3e50',
                padding: { x: 15, y: 8 }
            }).setOrigin(0.5).setInteractive({ useHandCursor: true });

            btn.on('pointerdown', () => {
                this.sound.play('sfx-button');
                this.tool = tool.id;
                this.updateToolbarUI();
            });
        });

        // 镜像按钮
        const mirrorStartX = w / 2 + 20;
        mirrors.forEach((mirror, idx) => {
            const x = mirrorStartX + idx * 90;
            const btn = this.add.text(x, toolbarY, mirror.label, {
                fontSize: '20px',
                color: this.mirror === mirror.id ? '#f1c40f' : '#ffffff',
                backgroundColor: this.mirror === mirror.id ? '#34495e' : '#2c3e50',
                padding: { x: 15, y: 8 }
            }).setOrigin(0.5).setInteractive({ useHandCursor: true });

            btn.on('pointerdown', () => {
                this.sound.play('sfx-button');
                this.mirror = mirror.id;
                this.updateToolbarUI();
            });
        });
    }

    updateToolbarUI() {
        // 简单处理：刷新整个界面
        this.scene.restart({ level: this.currentLevel });
    }

    createGrid() {
        const w = this.cameras.main.width;
        const h = this.cameras.main.height;

        // 计算网格参数
        const topBarH = 170;
        const bottomBarH = 120;
        const gridWidth = w;
        const gridHeight = h - topBarH - bottomBarH;

        const stepX = gridWidth / this.gridCols;
        const stepY = gridHeight / this.gridRows;

        // 存储网格参数
        this.gridParams = {
            startX: 0,
            startY: topBarH,
            stepX: stepX,
            stepY: stepY,
            tileWidth: stepX * 0.8,
            tileHeight: stepY * 0.9
        };

        // 绘制网格
        this.gridGraphics = this.add.graphics();
        this.gridGraphics.lineStyle(1, 0x34495e, 0.3);

        for (let row = 0; row <= this.gridRows; row++) {
            const y = topBarH + row * stepY;
            this.gridGraphics.moveTo(0, y);
            this.gridGraphics.lineTo(w, y);
        }
        for (let col = 0; col <= this.gridCols; col++) {
            const x = col * stepX;
            this.gridGraphics.moveTo(x, topBarH);
            this.gridGraphics.lineTo(x, topBarH + gridHeight);
        }
        this.gridGraphics.strokePath();

        // 绘制可放置位置的半透明绿色指示
        this.updatePlaceableIndicators();

        // 绘制已放置的牌
        this.drawTiles();

        // 设置为可点击
        this.input.on('pointerdown', (pointer) => {
            this.handleGridClick(pointer);
        });
    }

    updatePlaceableIndicators() {
        // 移除旧的指示器
        if (this.placeableGraphics) {
            this.placeableGraphics.destroy();
        }

        this.placeableGraphics = this.add.graphics();
        const { startX, startY, stepX, stepY } = this.gridParams;

        // 绘制当前层可放置位置（半透明绿色）
        this.placeableGraphics.fillStyle(0x2ecc71, 0.15);

        for (let row = 0; row < this.gridRows; row++) {
            for (let col = 0; col < this.gridCols; col++) {
                if (!this.hasTileAt(row, col, this.currentLayer)) {
                    if (this.canPlace(row, col, this.currentLayer)) {
                        const x = startX + col * stepX + stepX / 2;
                        const y = startY + row * stepY + stepY / 2;
                        this.placeableGraphics.fillCircle(x, y, stepX * 0.3);
                    }
                }
            }
        }
    }

    drawTiles() {
        // 移除旧的牌
        if (this.tileContainer) {
            this.tileContainer.destroy();
        }

        this.tileContainer = this.add.container();
        const { startX, startY, stepX, stepY, tileWidth, tileHeight } = this.gridParams;

        // 只显示当前层的牌
        const layerTiles = this.tiles.filter(t => t.layer === this.currentLayer);

        layerTiles.forEach(tile => {
            const x = startX + tile.col * stepX + stepX / 2;
            const y = startY + tile.row * stepY + stepY / 2;

            const texture = tile.faceDown ? 'tile_00' : `tile_${tile.type % 34}`;
            const img = this.add.image(x, y, texture);
            img.setScale(tileWidth / 51, tileHeight / 76);
            this.tileContainer.add(img);
        });
    }

    handleGridClick(pointer) {
        const { startX, startY, stepX, stepY } = this.gridParams;

        const col = Math.floor((pointer.x - startX) / stepX);
        const row = Math.floor((pointer.y - startY) / stepY);

        // 边界检查
        if (row < 0 || row >= this.gridRows || col < 0 || col >= this.gridCols) {
            return;
        }

        const hasTile = this.hasTileAt(row, col, this.currentLayer);

        if (hasTile) {
            // 点击已有牌
            if (this.tool === 'eraser') {
                // 橡皮模式：移除牌
                this.tryRemoveTile(row, col);
            } else {
                // 正面/扣着模式：切换朝向
                this.toggleTileFaceDown(row, col);
            }
        } else {
            // 点击空位
            if (this.tool === 'eraser') {
                // 橡皮模式下点击空位无操作
            } else {
                // 正面/扣着模式：放置牌
                this.tryPlaceTile(row, col);
            }
        }

        // 刷新显示
        this.updatePlaceableIndicators();
        this.drawTiles();
    }

    hasTileAt(row, col, layer) {
        return this.tiles.some(t =>
            Math.round(t.row) === Math.round(row) &&
            Math.round(t.col) === Math.round(col) &&
            t.layer === layer
        );
    }

    canPlace(row, col, layer) {
        if (layer === 0) return true;
        // 检查下层是否有支撑
        return this.hasTileAt(row, col, layer - 1);
    }

    canRemove(row, col, layer) {
        // 检查上层是否有依赖
        return !this.hasTileAt(row, col, layer + 1);
    }

    getMirrorPosition(row, col) {
        if (this.mirror === 'none') {
            return null;
        } else if (this.mirror === 'horizontal') {
            return { row: row, col: 11 - col };
        } else if (this.mirror === 'vertical') {
            return { row: 13 - row, col: col };
        }
        return null;
    }

    tryPlaceTile(row, col) {
        const faceDown = this.tool === 'faceDown';
        const mirrorPos = this.getMirrorPosition(row, col);

        // 检查主位置
        if (!this.canPlace(row, col, this.currentLayer)) {
            this.showBubble('需要先放置支撑牌');
            return;
        }

        // 检查镜像位置
        if (mirrorPos && !this.canPlace(mirrorPos.row, mirrorPos.col, this.currentLayer)) {
            this.showBubble('对称位置需要支撑牌');
            return;
        }

        // 检查是否已有牌
        if (this.hasTileAt(row, col, this.currentLayer)) {
            return;
        }
        if (mirrorPos && this.hasTileAt(mirrorPos.row, mirrorPos.col, this.currentLayer)) {
            return;
        }

        // 放置牌（随机类型，便于区分）
        const type = Math.floor(Math.random() * 34);
        this.tiles.push({
            row: row,
            col: col,
            layer: this.currentLayer,
            faceDown: faceDown,
            type: type
        });

        // 镜像放置
        if (mirrorPos) {
            this.tiles.push({
                row: mirrorPos.row,
                col: mirrorPos.col,
                layer: this.currentLayer,
                faceDown: faceDown,
                type: type
            });
        }
    }

    tryRemoveTile(row, col) {
        const mirrorPos = this.getMirrorPosition(row, col);

        // 检查主位置
        if (!this.canRemove(row, col, this.currentLayer)) {
            this.showBubble('需要先移除上面的牌');
            return;
        }

        // 检查镜像位置
        if (mirrorPos && !this.canRemove(mirrorPos.row, mirrorPos.col, this.currentLayer)) {
            this.showBubble('对称位置需要先移除上面的牌');
            return;
        }

        // 移除牌
        this.tiles = this.tiles.filter(t => {
            if (t.layer !== this.currentLayer) return true;
            const rowMatch = Math.round(t.row) === Math.round(row);
            const colMatch = Math.round(t.col) === Math.round(col);
            if (rowMatch && colMatch) return false;

            if (mirrorPos) {
                const mirrorRowMatch = Math.round(t.row) === Math.round(mirrorPos.row);
                const mirrorColMatch = Math.round(t.col) === Math.round(mirrorPos.col);
                if (mirrorRowMatch && mirrorColMatch) return false;
            }

            return true;
        });
    }

    toggleTileFaceDown(row, col) {
        this.tiles.forEach(t => {
            if (t.layer === this.currentLayer &&
                Math.round(t.row) === Math.round(row) &&
                Math.round(t.col) === Math.round(col)) {
                t.faceDown = !t.faceDown;
            }
        });

        // 镜像位置也切换
        const mirrorPos = this.getMirrorPosition(row, col);
        if (mirrorPos) {
            this.tiles.forEach(t => {
                if (t.layer === this.currentLayer &&
                    Math.round(t.row) === Math.round(mirrorPos.row) &&
                    Math.round(t.col) === Math.round(mirrorPos.col)) {
                    t.faceDown = !t.faceDown;
                }
            });
        }
    }

    showBubble(message) {
        const w = this.cameras.main.width;
        const h = this.cameras.main.height;

        const bubbleWidth = 300;
        const bubbleHeight = 50;
        const bubbleX = w / 2;
        const bubbleY = h / 2;

        const bubbleBg = this.add.graphics();
        bubbleBg.fillStyle(0x000000, 0.85);
        bubbleBg.fillRoundedRect(
            bubbleX - bubbleWidth / 2,
            bubbleY - bubbleHeight / 2,
            bubbleWidth,
            bubbleHeight,
            10
        );
        bubbleBg.setDepth(9999);

        const bubbleText = this.add.text(bubbleX, bubbleY, message, {
            fontSize: '22px',
            color: '#ffffff',
            fontFamily: 'Arial, sans-serif'
        }).setOrigin(0.5).setDepth(9999);

        this.time.delayedCall(1500, () => {
            bubbleBg.destroy();
            bubbleText.destroy();
        });
    }

    saveLevel() {
        const config = {
            level: this.currentLevel,
            tiles: this.tiles
        };
        localStorage.setItem(`mahjong_custom_level_${this.currentLevel}`, JSON.stringify(config));
        this.showBubble('保存成功');
    }

    resetLevel() {
        localStorage.removeItem(`mahjong_custom_level_${this.currentLevel}`);
        // 重新加载默认关卡
        const defaultConfig = window.LEVELS ? window.LEVELS[this.currentLevel] : null;
        if (defaultConfig) {
            this.tiles = defaultConfig.tiles || [];
        } else {
            this.tiles = [];
        }
        this.showBubble('已恢复默认');
        this.updatePlaceableIndicators();
        this.drawTiles();
    }

    createLayerSelector() {
        const w = this.cameras.main.width;
        const layerY = this.cameras.main.height - 180;

        // 背景
        this.add.rectangle(w / 2, layerY, w, 50, 0x2c3e50).setOrigin(0.5);

        // 层按钮
        const layers = [0, 1, 2, 3];
        layers.forEach((layer, idx) => {
            const x = w / 2 - 150 + idx * 100;
            const btn = this.add.text(x, layerY, `层 ${layer}`, {
                fontSize: '22px',
                color: this.currentLayer === layer ? '#f1c40f' : '#ffffff',
                backgroundColor: this.currentLayer === layer ? '#34495e' : '#2c3e50',
                padding: { x: 20, y: 8 }
            }).setOrigin(0.5).setInteractive({ useHandCursor: true });

            btn.on('pointerdown', () => {
                this.sound.play('sfx-button');
                this.currentLayer = layer;
                this.updatePlaceableIndicators();
                this.drawTiles();
                this.updateLayerButtons();
            });
        });
    }

    updateLayerButtons() {
        // 简单刷新
        this.createLayerSelector();
    }

    createBottomButtons() {
        const w = this.cameras.main.width;
        const h = this.cameras.main.height;
        const bottomY = h - 80;

        // 预览按钮
        const previewBtn = this.add.text(w / 2 - 200, bottomY, '预览', {
            fontSize: '24px',
            color: '#ffffff',
            backgroundColor: '#3498db',
            padding: { x: 30, y: 12 }
        }).setOrigin(0.5).setInteractive({ useHandCursor: true });
        previewBtn.on('pointerdown', () => {
            this.sound.play('sfx-button');
            this.scene.start('GameScene', { level: this.currentLevel });
        });

        // 清空当前层按钮
        const clearLayerBtn = this.add.text(w / 2, bottomY, '清空当前层', {
            fontSize: '24px',
            color: '#ffffff',
            backgroundColor: '#e74c3c',
            padding: { x: 30, y: 12 }
        }).setOrigin(0.5).setInteractive({ useHandCursor: true });
        clearLayerBtn.on('pointerdown', () => {
            this.sound.play('sfx-button');
            this.tiles = this.tiles.filter(t => t.layer !== this.currentLayer);
            this.updatePlaceableIndicators();
            this.drawTiles();
        });

        // 重置为默认按钮
        const resetBtn = this.add.text(w / 2 + 200, bottomY, '重置为默认', {
            fontSize: '24px',
            color: '#ffffff',
            backgroundColor: '#e67e22',
            padding: { x: 30, y: 12 }
        }).setOrigin(0.5).setInteractive({ useHandCursor: true });
        resetBtn.on('pointerdown', () => {
            this.sound.play('sfx-button');
            this.resetLevel();
        });
    }
}
