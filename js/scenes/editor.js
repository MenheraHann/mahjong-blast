// editor.js - 关卡编辑器场景

class EditorScene extends Phaser.Scene {
    constructor() {
        super({ key: 'EditorScene' });
    }

    init(data) {
        this.currentLevel = data.level || 1;
        this.currentLayer = 0;
        this.tool = 'faceUp';
        this.mirror = 'none';
        this.tiles = [];
        this.gridCols = 11;  // col 0-10，只用偶数位
        this.gridRows = 13;  // row 0-12，只用偶数位
    }

    preload() {
        this.load.svg('icon-back', 'assets/icons/back.svg');
        this.load.audio('sfx-button', 'assets/wav/按钮点击.WAV');
    }

    create() {
        const w = this.cameras.main.width;
        const h = this.cameras.main.height;

        // 背景
        this.add.rectangle(0, 0, w, h, 0x2c3e50).setOrigin(0);

        // 加载关卡配置
        this.loadLevelConfig();

        // 顶部栏
        this.createTopBar(w);

        // 工具栏
        this.createToolbar(w);

        // 网格
        this.createGrid(w, h);

        // 层选择器
        this.createLayerSelector(w, h);

        // 底部按钮
        this.createBottomButtons(w, h);
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
                console.error('[编辑器] 加载自定义关卡配置失败:', e);
            }
        }

        // 加载默认关卡
        if (window.LEVELS && window.LEVELS[this.currentLevel]) {
            this.tiles = window.LEVELS[this.currentLevel].tiles || [];
        } else {
            this.tiles = [];
        }
    }

    createTopBar(w) {
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
            fontStyle: 'bold'
        }).setOrigin(0.5);

        // 保存按钮
        const saveBtn = this.add.text(w - 60, topY, '保存', {
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

    createToolbar(w) {
        const toolbarY = 100;

        this.add.rectangle(0, toolbarY, w, 50, 0x34495e).setOrigin(0);

        const tools = [
            { id: 'faceUp', label: '正面' },
            { id: 'faceDown', label: '扣着' },
            { id: 'eraser', label: '橡皮' }
        ];

        tools.forEach((tool, idx) => {
            const x = 40 + idx * 90;
            const btn = this.add.text(x, toolbarY, tool.label, {
                fontSize: '18px',
                color: '#ffffff',
                backgroundColor: this.tool === tool.id ? '#3498db' : '#2c3e50',
                padding: { x: 12, y: 6 }
            }).setOrigin(0.5).setInteractive({ useHandCursor: true });

            btn.on('pointerdown', () => {
                this.sound.play('sfx-button');
                this.tool = tool.id;
                this.refreshToolbar();
            });
        });

        // 镜像模式
        const mirrors = [
            { id: 'none', label: '无' },
            { id: 'horizontal', label: '水平' },
            { id: 'vertical', label: '垂直' }
        ];

        mirrors.forEach((mirror, idx) => {
            const x = w / 2 + 20 + idx * 70;
            const btn = this.add.text(x, toolbarY, mirror.label, {
                fontSize: '18px',
                color: '#ffffff',
                backgroundColor: this.mirror === mirror.id ? '#e74c3c' : '#2c3e50',
                padding: { x: 12, y: 6 }
            }).setOrigin(0.5).setInteractive({ useHandCursor: true });

            btn.on('pointerdown', () => {
                this.sound.play('sfx-button');
                this.mirror = mirror.id;
                this.refreshToolbar();
            });
        });
    }

    refreshToolbar() {
        this.scene.restart({ level: this.currentLevel });
    }

    createGrid(w, h) {
        const topBarH = 150;
        const bottomBarH = 130;
        const gridHeight = h - topBarH - bottomBarH;

        const stepX = w / this.gridCols;
        const stepY = gridHeight / this.gridRows;

        this.gridParams = {
            startX: 0,
            startY: topBarH,
            stepX: stepX,
            stepY: stepY,
            tileWidth: stepX * 0.8,
            tileHeight: stepY * 0.85
        };

        // 绘制网格背景
        const gridBg = this.add.rectangle(
            w / 2,
            topBarH + gridHeight / 2,
            w,
            gridHeight,
            0x1a252f
        ).setOrigin(0.5);

        // 绘制网格线
        const graphics = this.add.graphics();
        graphics.lineStyle(1, 0x34495e, 0.5);

        for (let row = 0; row <= this.gridRows; row++) {
            const y = topBarH + row * stepY;
            graphics.moveTo(0, y);
            graphics.lineTo(w, y);
        }
        for (let col = 0; col <= this.gridCols; col++) {
            const x = col * stepX;
            graphics.moveTo(x, topBarH);
            graphics.lineTo(x, topBarH + gridHeight);
        }
        graphics.strokePath();

        // 绘制可放置指示器
        this.updateIndicators();

        // 绘制已有牌
        this.drawTiles();

        // 点击事件
        this.input.on('pointerdown', (pointer) => {
            this.handleClick(pointer);
        });
    }

    updateIndicators() {
        if (this.indicators) {
            this.indicators.destroy();
        }

        this.indicators = this.add.graphics();
        const { startX, startY, stepX, stepY } = this.gridParams;

        this.indicators.fillStyle(0x2ecc71, 0.3);

        for (let row = 0; row < this.gridRows; row++) {
            for (let col = 0; col < this.gridCols; col++) {
                if (!this.hasTileAt(row, col, this.currentLayer)) {
                    if (this.canPlace(row, col, this.currentLayer)) {
                        const x = startX + col * stepX + stepX / 2;
                        const y = startY + row * stepY + stepY / 2;
                        this.indicators.fillCircle(x, y, stepX * 0.25);
                    }
                }
            }
        }
    }

    drawTiles() {
        if (this.tileContainer) {
            this.tileContainer.destroy();
        }

        this.tileContainer = this.add.container();
        const { startX, startY, stepX, stepY, tileWidth, tileHeight } = this.gridParams;

        const layerTiles = this.tiles.filter(t => t.layer === this.currentLayer);

        layerTiles.forEach(tile => {
            const x = startX + tile.col * stepX + stepX / 2;
            const y = startY + tile.row * stepY + stepY / 2;

            // 用圆形背景代替麻将牌图片
            const color = tile.faceDown ? 0x34495e : 0xf1c40f;
            const bg = this.add.circle(x, y, tileWidth / 2, color);
            this.tileContainer.add(bg);

            const text = this.add.text(x, y, tile.faceDown ? '扣' : '正', {
                fontSize: '14px',
                color: tile.faceDown ? '#ffffff' : '#2c3e50'
            }).setOrigin(0.5);
            this.tileContainer.add(text);
        });
    }

    handleClick(pointer) {
        const { startX, startY, stepX, stepY } = this.gridParams;

        const col = Math.floor((pointer.x - startX) / stepX);
        const row = Math.floor((pointer.y - startY) / stepY);

        if (row < 0 || row >= this.gridRows || col < 0 || col >= this.gridCols) {
            return;
        }

        const hasTile = this.hasTileAt(row, col, this.currentLayer);

        if (hasTile) {
            if (this.tool === 'eraser') {
                this.tryRemove(row, col);
            } else {
                this.toggleFaceDown(row, col);
            }
        } else {
            if (this.tool !== 'eraser') {
                this.tryPlace(row, col);
            }
        }

        this.updateIndicators();
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
        return this.hasTileAt(row, col, layer - 1);
    }

    canRemove(row, col, layer) {
        return !this.hasTileAt(row, col, layer + 1);
    }

    getMirror(row, col) {
        if (this.mirror === 'none') return null;
        if (this.mirror === 'horizontal') return { row, col: 10 - col };
        if (this.mirror === 'vertical') return { row: 12 - row, col };
        return null;
    }

    tryPlace(row, col) {
        const faceDown = this.tool === 'faceDown';
        const mirrorPos = this.getMirror(row, col);

        if (!this.canPlace(row, col, this.currentLayer)) {
            this.showToast('需要先放置支撑牌');
            return;
        }

        if (mirrorPos && !this.canPlace(mirrorPos.row, mirrorPos.col, this.currentLayer)) {
            this.showToast('对称位置需要支撑牌');
            return;
        }

        if (this.hasTileAt(row, col, this.currentLayer)) return;
        if (mirrorPos && this.hasTileAt(mirrorPos.row, mirrorPos.col, this.currentLayer)) return;

        this.tiles.push({
            row, col,
            layer: this.currentLayer,
            faceDown,
            type: Math.floor(Math.random() * 34)
        });

        if (mirrorPos) {
            this.tiles.push({
                row: mirrorPos.row,
                col: mirrorPos.col,
                layer: this.currentLayer,
                faceDown,
                type: this.tiles[this.tiles.length - 1].type
            });
        }
    }

    tryRemove(row, col) {
        const mirrorPos = this.getMirror(row, col);

        if (!this.canRemove(row, col, this.currentLayer)) {
            this.showToast('需要先移除上面的牌');
            return;
        }

        if (mirrorPos && !this.canRemove(mirrorPos.row, mirrorPos.col, this.currentLayer)) {
            this.showToast('对称位置需要先移除上面的牌');
            return;
        }

        this.tiles = this.tiles.filter(t => {
            if (t.layer !== this.currentLayer) return true;
            if (Math.round(t.row) === Math.round(row) && Math.round(t.col) === Math.round(col)) return false;
            if (mirrorPos && Math.round(t.row) === Math.round(mirrorPos.row) && Math.round(t.col) === Math.round(mirrorPos.col)) return false;
            return true;
        });
    }

    toggleFaceDown(row, col) {
        const mirrorPos = this.getMirror(row, col);

        this.tiles.forEach(t => {
            if (t.layer === this.currentLayer &&
                Math.round(t.row) === Math.round(row) &&
                Math.round(t.col) === Math.round(col)) {
                t.faceDown = !t.faceDown;
            }
            if (mirrorPos && t.layer === this.currentLayer &&
                Math.round(t.row) === Math.round(mirrorPos.row) &&
                Math.round(t.col) === Math.round(mirrorPos.col)) {
                t.faceDown = !t.faceDown;
            }
        });
    }

    showToast(message) {
        const w = this.cameras.main.width;
        const h = this.cameras.main.height;

        const toast = this.add.text(w / 2, h / 2, message, {
            fontSize: '24px',
            color: '#ffffff',
            backgroundColor: '#000000',
            padding: { x: 20, y: 10 }
        }).setOrigin(0.5).setDepth(9999);

        this.time.delayedCall(1500, () => {
            toast.destroy();
        });
    }

    saveLevel() {
        const config = {
            level: this.currentLevel,
            tiles: this.tiles
        };
        localStorage.setItem(`mahjong_custom_level_${this.currentLevel}`, JSON.stringify(config));
        this.showToast('保存成功');
    }

    createLayerSelector(w, h) {
        const y = h - 110;

        this.add.rectangle(0, y, w, 40, 0x34495e).setOrigin(0);

        [0, 1, 2, 3].forEach((layer, idx) => {
            const x = 60 + idx * 80;
            const btn = this.add.text(x, y + 20, `层${layer}`, {
                fontSize: '20px',
                color: this.currentLayer === layer ? '#f1c40f' : '#ffffff',
                backgroundColor: this.currentLayer === layer ? '#2c3e50' : '#34495e',
                padding: { x: 15, y: 5 }
            }).setOrigin(0.5).setInteractive({ useHandCursor: true });

            btn.on('pointerdown', () => {
                this.sound.play('sfx-button');
                this.currentLayer = layer;
                this.scene.restart({ level: this.currentLevel });
            });
        });
    }

    createBottomButtons(w, h) {
        const y = h - 50;

        // 预览
        const previewBtn = this.add.text(w / 2 - 160, y, '预览', {
            fontSize: '20px',
            color: '#ffffff',
            backgroundColor: '#3498db',
            padding: { x: 20, y: 8 }
        }).setOrigin(0.5).setInteractive({ useHandCursor: true });
        previewBtn.on('pointerdown', () => {
            this.sound.play('sfx-button');
            this.scene.start('GameScene', { level: this.currentLevel });
        });

        // 清空当前层
        const clearBtn = this.add.text(w / 2, y, '清空当前层', {
            fontSize: '20px',
            color: '#ffffff',
            backgroundColor: '#e74c3c',
            padding: { x: 20, y: 8 }
        }).setOrigin(0.5).setInteractive({ useHandCursor: true });
        clearBtn.on('pointerdown', () => {
            this.sound.play('sfx-button');
            this.tiles = this.tiles.filter(t => t.layer !== this.currentLayer);
            this.updateIndicators();
            this.drawTiles();
        });

        // 重置为默认
        const resetBtn = this.add.text(w / 2 + 160, y, '重置', {
            fontSize: '20px',
            color: '#ffffff',
            backgroundColor: '#e67e22',
            padding: { x: 20, y: 8 }
        }).setOrigin(0.5).setInteractive({ useHandCursor: true });
        resetBtn.on('pointerdown', () => {
            this.sound.play('sfx-button');
            localStorage.removeItem(`mahjong_custom_level_${this.currentLevel}`);
            this.loadLevelConfig();
            this.updateIndicators();
            this.drawTiles();
            this.showToast('已恢复默认');
        });
    }
}
