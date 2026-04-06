// game.js - 游戏主场景

class GameScene extends Phaser.Scene {
    constructor() {
        super({ key: 'GameScene' });
    }

    init(data) {
        this.currentLevel = data.level || 1;
        this.selectedTiles = [];
        this.matchedPairs = 0;
        this.totalPairs = 0;
        this.isProcessing = false;
        this.score = 0;
        this.hintCount = 10;
        this.hintTiles = [];
        this.boardGrid = []; // 7x8 网格，存储每格的牌信息
    }

    preload() {
        this.load.svg('icon-back', 'assets/icons/back.svg');
        this.load.svg('icon-menu', 'assets/icons/menu.svg');
        this.load.svg('icon-shuffle', 'assets/icons/shuffle.svg');
        this.load.svg('icon-hint', 'assets/icons/hint.svg');

        // 加载pixelMajong麻将牌图片
        // 一万到九万 01~09, 一饼到九饼 11~19, 一条到九条 31~39, 北西南东发中白板 41~47
        const tileFiles = [];
        for (let i = 1; i <= 9; i++) tileFiles.push(i);        // 万 01-09
        for (let i = 11; i <= 19; i++) tileFiles.push(i);      // 饼 11-19
        for (let i = 31; i <= 39; i++) tileFiles.push(i);      // 条 31-39
        for (let i = 41; i <= 47; i++) tileFiles.push(i);      // 字 41-47
        tileFiles.forEach((num, idx) => {
            this.load.image(`tile_${idx}`, `assets/pixelMajong/${String(num).padStart(2, '0')}.png`);
        });
        // 加载阴影素材
        this.load.image('tile_shadow', 'assets/pixelMajong/shadow.png');
    }

    create() {
        this.w = this.cameras.main.width;
        this.h = this.cameras.main.height;

        // 背景（最底层）
        this.add.rectangle(0, 0, this.w, this.h, 0x34495e).setOrigin(0).setDepth(-9999);

        // 顶部信息栏背景
        this.add.rectangle(0, 0, this.w, 90, 0x2c3e50).setOrigin(0);

        // 创建顶部信息栏
        this.createTopBar();

        // 创建游戏区域
        this.createBoard();

        // 创建底部功能栏
        this.createBottomBar();
    }

    createTopBar() {
        const topY = 45;

        // 1. 返回按钮
        const backBtn = this.add.image(30, topY, 'icon-back').setScale(0.4).setInteractive({ useHandCursor: true });
        backBtn.on('pointerdown', () => {
            this.showConfirmDialog('确定要返回主菜单吗？', () => {
                this.scene.start('HomeScene');
            });
        });

        // 2. 关卡数
        this.add.text(85, topY - 14, '关卡', {
            fontSize: '16px',
            color: '#bdc3c7'
        }).setOrigin(0, 0.5);

        this.levelText = this.add.text(85, topY + 12, `${this.currentLevel}`, {
            fontSize: '22px',
            color: '#ffffff',
            fontStyle: 'bold'
        }).setOrigin(0, 0.5);

        // 3. 分数
        this.add.text(225, topY - 14, '分数', {
            fontSize: '16px',
            color: '#bdc3c7'
        }).setOrigin(0, 0.5);

        this.scoreText = this.add.text(225, topY + 12, '0', {
            fontSize: '22px',
            color: '#f1c40f',
            fontStyle: 'bold'
        }).setOrigin(0, 0.5);

        // 4. 匹配数
        this.add.text(365, topY - 14, '匹配', {
            fontSize: '16px',
            color: '#bdc3c7'
        }).setOrigin(0, 0.5);

        this.matchText = this.add.text(365, topY + 12, '0', {
            fontSize: '22px',
            color: '#2ecc71',
            fontStyle: 'bold'
        }).setOrigin(0, 0.5);

        // 5. 菜单按钮
        const menuBtn = this.add.image(this.w - 35, topY, 'icon-menu').setScale(0.45).setInteractive({ useHandCursor: true });
        menuBtn.on('pointerdown', () => {
            this.showMenu();
        });
    }

    showConfirmDialog(message, onConfirm) {
        const overlay = this.add.rectangle(this.w / 2, this.h / 2, this.w, this.h, 0x000000, 0.5)
            .setInteractive().setDepth(5000);

        const dialogBg = this.add.rectangle(this.w / 2, this.h / 2 - 40, 400, 200, 0x2c3e50)
            .setStrokeStyle(2, 0x7f8c8d).setDepth(5001);

        const msgText = this.add.text(this.w / 2, this.h / 2 - 90, message, {
            fontSize: '22px',
            color: '#ecf0f1',
            wordWrap: { width: 350 },
            align: 'center'
        }).setOrigin(0.5).setDepth(5001);

        const confirmBtn = this.add.text(this.w / 2 - 80, this.h / 2, '确定', {
            fontSize: '22px',
            color: '#ffffff',
            backgroundColor: '#e74c3c',
            padding: { x: 25, y: 10 }
        }).setOrigin(0.5).setInteractive({ useHandCursor: true }).setDepth(5001);

        confirmBtn.on('pointerdown', () => {
            this.destroyDialog(overlay, dialogBg, msgText, confirmBtn, cancelBtn);
            onConfirm();
        });

        const cancelBtn = this.add.text(this.w / 2 + 80, this.h / 2, '取消', {
            fontSize: '22px',
            color: '#ffffff',
            backgroundColor: '#3498db',
            padding: { x: 25, y: 10 }
        }).setOrigin(0.5).setInteractive({ useHandCursor: true }).setDepth(5001);

        cancelBtn.on('pointerdown', () => {
            this.destroyDialog(overlay, dialogBg, msgText, confirmBtn, cancelBtn);
        });
    }

    showMenu() {
        const overlay = this.add.rectangle(this.w / 2, this.h / 2, this.w, this.h, 0x000000, 0.5)
            .setInteractive().setDepth(5000);

        const dialogBg = this.add.rectangle(this.w / 2, this.h / 2, 350, 250, 0x2c3e50)
            .setStrokeStyle(2, 0x7f8c8d).setDepth(5001);

        const title = this.add.text(this.w / 2, this.h / 2 - 90, '菜单', {
            fontSize: '28px',
            color: '#ecf0f1',
            fontStyle: 'bold'
        }).setOrigin(0.5).setDepth(5001);

        const restartBtn = this.add.text(this.w / 2, this.h / 2 - 20, '重新开始', {
            fontSize: '24px',
            color: '#ffffff',
            backgroundColor: '#e67e22',
            padding: { x: 40, y: 12 }
        }).setOrigin(0.5).setInteractive({ useHandCursor: true }).setDepth(5001);

        restartBtn.on('pointerdown', () => {
            this.destroyDialog(overlay, dialogBg, title, restartBtn, menuBtn2);
            this.scene.restart({ level: this.currentLevel });
        });

        const menuBtn2 = this.add.text(this.w / 2, this.h / 2 + 50, '返回主菜单', {
            fontSize: '24px',
            color: '#ffffff',
            backgroundColor: '#3498db',
            padding: { x: 40, y: 12 }
        }).setOrigin(0.5).setInteractive({ useHandCursor: true }).setDepth(5001);

        menuBtn2.on('pointerdown', () => {
            this.destroyDialog(overlay, dialogBg, title, restartBtn, menuBtn2);
            this.scene.start('HomeScene');
        });
    }

    destroyDialog(...elements) {
        elements.forEach(el => el.destroy());
    }

    createBottomBar() {
        const bottomY = this.h - 60;

        // 底部背景条
        this.add.rectangle(this.w / 2, bottomY, this.w, 90, 0x2c3e50).setOrigin(0.5);

        // 重新洗牌按钮
        const shuffleBtn = this.add.image(this.w / 2 - 100, bottomY, 'icon-shuffle').setScale(0.6).setInteractive({ useHandCursor: true });
        shuffleBtn.on('pointerdown', () => {
            this.shuffleBoard();
        });

        // 提示按钮
        this.hintBtn = this.add.image(this.w / 2 + 100, bottomY, 'icon-hint').setScale(0.6).setInteractive({ useHandCursor: true });

        // 提示次数角标
        this.hintCountText = this.add.text(this.w / 2 + 120, bottomY - 25, `${this.hintCount}`, {
            fontSize: '16px',
            color: '#ffffff',
            backgroundColor: '#e74c3c',
            padding: { x: 6, y: 2 }
        }).setOrigin(0.5);

        this.hintBtn.on('pointerdown', () => {
            this.useHint();
        });
    }

    useHint() {
        if (this.hintCount <= 0) return;
        if (this.hintTiles.length > 0) return;

        const unmatched = this.tiles.filter(t => !t.getData('matched'));
        const freeTiles = unmatched.filter(t => this.isTileFree(t));
        let pair = null;
        for (let i = 0; i < freeTiles.length; i++) {
            for (let j = i + 1; j < freeTiles.length; j++) {
                if (freeTiles[i].getData('type') === freeTiles[j].getData('type')) {
                    pair = [freeTiles[i], freeTiles[j]];
                    break;
                }
            }
            if (pair) break;
        }

        if (!pair) {
            // 没有可用配对，自动智能洗牌
            this.smartShuffle();
            return;
        }

        this.hintCount--;
        this.hintCountText.setText(`${this.hintCount}`);

        if (this.hintCount <= 0) {
            this.hintBtn.setAlpha(0.3);
            this.hintBtn.disableInteractive();
        }

        pair.forEach(tile => {
            const tileImg = tile.list[0];
            if (tileImg && tileImg.setTint) {
                tileImg.setTint(0xf1c40f); // 黄色蒙版
            }
            tile.setData('hintTint', true);
        });
        this.hintTiles = pair;
    }

    clearHint() {
        this.hintTiles.forEach(tile => {
            tile.setData('hintTint', false);
            // 如果牌未被选中，清除黄色蒙版
            if (!this.selectedTiles.includes(tile)) {
                const tileImg = tile.list[0];
                if (tileImg && tileImg.clearTint) {
                    tileImg.clearTint();
                }
            }
        });
        this.hintTiles = [];
    }

    shuffleBoard() {
        const unmatchedTiles = this.tiles.filter(t => !t.getData('matched'));
        const types = this.getShuffledTypesForLayer2(unmatchedTiles);

        unmatchedTiles.forEach((tile, i) => {
            const newType = types[i];
            tile.setData('type', newType);
            // 更新牌面图片
            const tileImg = tile.list[0]; // 第一个子元素是图片
            if (tileImg && tileImg.setTexture) {
                tileImg.setTexture(`tile_${newType % 34}`);
            }
            // 清除残留的高亮/选中效果
            tile.setData('hintTint', false);
            // 清除蒙版色调
            this.clearTileSelection(tile);
        });

        this.clearHint();
        this.recalculateAllFreeStatus();

        // 洗牌后检查是否还有自由配对，没有则重新洗牌
        if (!this.hasFreePairs()) {
            this.smartShuffle();
        }
    }

    // 生成第二层牌的布局（基于第一层牌的几何接触关系）
    generateLayer2() {
        const cols = 7;
        const rows = 8;
        const corners = [[0,0],[0,6],[7,0],[7,6]];
        const cornerKey = (r,c) => `${r},${c}`;
        const cornerSet = new Set(corners.map(([r,c]) => cornerKey(r,c)));

        const tryPlacement = () => {
            // Step 1: 扫描所有候选放置位置
            const candidates = [];

            // 正压：每个第一层牌位置的正上方
            for (let r = 0; r < rows; r++) {
                for (let c = 0; c < cols; c++) {
                    candidates.push({
                        type: 'single',
                        coverage: [[r, c]],
                        renderRow: r,
                        renderCol: c
                    });
                }
            }

            // 边压：水平相邻
            for (let r = 0; r < rows; r++) {
                for (let c = 0; c < cols - 1; c++) {
                    candidates.push({
                        type: 'edge',
                        coverage: [[r, c], [r, c + 1]],
                        renderRow: r,
                        renderCol: c + 0.5
                    });
                }
            }

            // 边压：垂直相邻
            for (let r = 0; r < rows - 1; r++) {
                for (let c = 0; c < cols; c++) {
                    candidates.push({
                        type: 'edge',
                        coverage: [[r, c], [r + 1, c]],
                        renderRow: r + 0.5,
                        renderCol: c
                    });
                }
            }

            // 角压：左上到右下对角（2×2网格，4个位置全部纳入coverage，过滤由后续步骤处理）
            for (let r = 0; r < rows - 1; r++) {
                for (let c = 0; c < cols - 1; c++) {
                    const positions = [[r, c], [r, c + 1], [r + 1, c], [r + 1, c + 1]];
                    candidates.push({
                        type: 'corner',
                        coverage: positions,
                        renderRow: r + 0.5,
                        renderCol: c + 0.5
                    });
                }
            }

            // 角压：右上到左下对角（2×2网格，4个位置全部纳入coverage）
            for (let r = 0; r < rows - 1; r++) {
                for (let c = 1; c < cols; c++) {
                    const positions = [[r, c - 1], [r, c], [r + 1, c - 1], [r + 1, c]];
                    candidates.push({
                        type: 'corner',
                        coverage: positions,
                        renderRow: r + 0.5,
                        renderCol: c - 0.5
                    });
                }
            }

            // Step 2: 过滤 — 移除覆盖角位的候选，移除coverage不足2个的角压候选
            const filtered = candidates.filter(cand => {
                // 不能覆盖四角
                if (cand.coverage.some(([r,c]) => cornerSet.has(cornerKey(r,c)))) return false;
                // 角压候选必须覆盖至少2个位置（过滤掉因四角过滤后只剩1个的情况）
                if (cand.type === 'corner' && cand.coverage.length < 2) return false;
                return true;
            });

            // 打乱候选顺序
            for (let i = filtered.length - 1; i > 0; i--) {
                const j = Math.floor(Math.random() * (i + 1));
                [filtered[i], filtered[j]] = [filtered[j], filtered[i]];
            }

            // Step 3: 贪心选择 8-12 个不重叠的候选
            const targetCount = 8 + Math.floor(Math.random() * 5); // 8-12
            const usedPositions = new Set();
            const placed = [];

            for (const cand of filtered) {
                if (placed.length >= targetCount) break;

                // 检查是否与已选候选有 coverage 重叠
                const hasOverlap = cand.coverage.some(([r,c]) => usedPositions.has(cornerKey(r,c)));
                if (hasOverlap) continue;

                // 标记已使用位置
                cand.coverage.forEach(([r,c]) => usedPositions.add(cornerKey(r,c)));
                placed.push({
                    coverage: cand.coverage,
                    renderRow: cand.renderRow,
                    renderCol: cand.renderCol
                });
            }

            // Step 4: 检查至少20个位置未被覆盖
            let uncovered = rows * cols;
            usedPositions.forEach(() => uncovered--);
            if (uncovered < 20) return null;

            return placed;
        };

        // 最多重试3次
        for (let retry = 0; retry < 3; retry++) {
            const result = tryPlacement();
            if (result) return result;
        }
        return []; // 兜底返回空
    }

    // 判断牌是否自由（可选中）
    isTileFree(tile) {
        if (tile.getData('matched')) return false;

        const layer = tile.getData('layer');
        const coveredPositions = tile.getData('coveredPositions');

        // 如果被上层牌覆盖（压边、正压、压角），则锁定
        if (layer === 0 && tile.getData('isCovered')) return false;

        // 第二层牌始终自由（除非被匹配）
        if (layer === 1) return true;

        // 计算牌的左右边界
        const cols = 7;
        const rows = 8;
        const minCol = Math.min(...coveredPositions.map(p => p[1]));
        const maxCol = Math.max(...coveredPositions.map(p => p[1]));
        const minRow = Math.min(...coveredPositions.map(p => p[0]));
        const maxRow = Math.max(...coveredPositions.map(p => p[0]));

        // 检查左侧是否有相邻的同层牌（所有行都有才算挡住）
        let leftBlocked = (minCol > 0);
        for (let r = minRow; r <= maxRow && leftBlocked; r++) {
            if (!this.hasTileAt(r, minCol - 1, layer)) {
                leftBlocked = false;
            }
        }

        // 检查右侧是否有相邻的同层牌（所有行都有才算挡住）
        let rightBlocked = (maxCol < cols - 1);
        for (let r = minRow; r <= maxRow && rightBlocked; r++) {
            if (!this.hasTileAt(r, maxCol + 1, layer)) {
                rightBlocked = false;
            }
        }

        // 左右都被挡住 → 锁定
        if (leftBlocked && rightBlocked) return false;

        return true;
    }

    // 检查指定网格位置在指定层是否有未消除的牌
    hasTileAt(row, col, layer) {
        if (row < 0 || row > 7 || col < 0 || col > 6) return false;

        const cell = this.boardGrid[row][col];
        if (!cell) return false;

        if (layer === 0) {
            // 第一层：检查 layer1Tile 是否存在且未消除（被覆盖的牌也算物理存在，会挡住邻居）
            return cell.layer1Tile && !cell.layer1Tile.getData('matched');
        } else {
            // 第二层：检查 layer2Tile 是否存在且未消除
            return cell.layer2Tile && !cell.layer2Tile.getData('matched');
        }
    }

    // 重新计算所有牌的自由状态
    recalculateAllFreeStatus() {
        this.tiles.forEach(tile => {
            if (tile.getData('matched')) return;
            const free = this.isTileFree(tile);
            tile.setData('isFree', free);

            // 管理锁定蒙版（降低亮度40%）
            const tileImg = tile.list[0];
            if (tileImg && tileImg.setTint) {
                if (!free) {
                    tileImg.setTint(0x999999);
                } else {
                    tileImg.clearTint();
                }
            }
        });

        // 动态更新可匹配数：只统计自由牌中能配对的数量
        this.recalculateRemainingPairs();
    }

    // 计算当前自由牌中可配对的数量
    recalculateRemainingPairs() {
        const freeTiles = this.tiles.filter(t => !t.getData('matched') && this.isTileFree(t));
        const typeCounts = {};
        freeTiles.forEach(t => {
            const type = t.getData('type');
            typeCounts[type] = (typeCounts[type] || 0) + 1;
        });
        let pairs = 0;
        Object.values(typeCounts).forEach(count => {
            pairs += Math.floor(count / 2);
        });
        this.remainingPairs = pairs;
        this.matchText.setText(`${this.remainingPairs}`);
    }

    // 牌面整体居中
    createBoard() {
        const cols = 7;
        const rows = 8;
        const topBarH = 90;
        const bottomBarH = 90;
        const padding = 15;

        // 可用区域
        const availW = this.w - padding * 2;
        const availH = this.h - topBarH - bottomBarH - padding * 2;
        const tileRatio = 51 / 76; // 宽/高

        // 动态计算牌尺寸，保持51:76比例
        const tileByW = availW / cols;
        const tileByH = (availH / rows) / tileRatio;
        const rawSize = Math.floor(Math.min(tileByW, tileByH));
        const tileSize = Math.floor(rawSize * 0.9);
        const tileHeight = Math.round(tileSize / tileRatio);
        const gap = 0;

        const totalTiles = rows * cols;

        // 第一层牌类型：先生成，保证偶数对（类型范围0-33，共34种牌）
        const layer1Count = totalTiles; // 56张
        const layer1Types = [];
        for (let i = 0; i < layer1Count / 2; i++) {
            const type = i % 34; // 0-33循环
            layer1Types.push(type, type);
        }
        // 打乱第一层牌序
        for (let i = layer1Types.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [layer1Types[i], layer1Types[j]] = [layer1Types[j], layer1Types[i]];
        }

        // 牌面整体居中
        const actualBoardW = cols * tileSize + (cols - 1) * (-10);
        const actualBoardH = rows * tileHeight + (rows - 1) * (-20);
        const startX = (this.w - actualBoardW) / 2 + tileSize / 2;
        const startY = topBarH + (this.h - topBarH - bottomBarH) / 2 - actualBoardH / 2 + tileHeight / 2;

        this.tiles = [];
        this.shadowLayer = []; // 独立的阴影层

        // 初始化7x8网格
        this.boardGrid = Array.from({length: rows}, () =>
            Array.from({length: cols}, () => ({ layer1Tile: null, layer2Tile: null }))
        );

        for (let row = 0; row < rows; row++) {
            for (let col = 0; col < cols; col++) {
                const idx = row * cols + col;
                if (idx >= layer1Types.length) continue;

                const type = layer1Types[idx];
                const x = startX + col * (tileSize - 10);
                const y = startY + row * (tileHeight - 20);

                const container = this.add.container(x, y);

                // 麻将牌图片，等比缩放
                const imgKey = `tile_${type % 34}`;
                const tileImg = this.add.image(0, 0, imgKey);
                const imgScale = Math.min((tileSize - 2) / 100, (tileHeight - 2) / 138);
                tileImg.setScale(imgScale);
                container.add(tileImg);

                container.setData('type', type);
                container.setData('matched', false);
                container.setData('tileW', tileSize);
                container.setData('tileH', tileHeight);
                container.setData('imgScale', imgScale);
                container.setData('layer', 0);
                container.setData('coveredPositions', [[row, col]]);
                container.setData('isCovered', false);
                container.setData('isFree', true);
                container.setData('baseImgScale', imgScale);

                container.setSize(tileSize, tileHeight);
                container.setInteractive({ useHandCursor: true });
                container.on('pointerdown', () => this.onTileClick(container));

                // 默认层级：右压左，下压上
                const defaultDepth = row * cols + col;
                container.setDepth(defaultDepth);
                container.setData('defaultDepth', defaultDepth);

                this.tiles.push(container);
                this.boardGrid[row][col].layer1Tile = container;

                // 创建独立阴影（第一层阴影在depth -1，在所有第一层牌之下）
                const shadowImg = this.add.image(x, y, 'tile_shadow');
                const shadowScale = Math.min((tileSize - 2) / 100, (tileHeight - 2) / 138);
                shadowImg.setScale(shadowScale);
                shadowImg.setDepth(-1);
                shadowImg.setData('origScale', shadowScale);
                this.shadowLayer.push({ shadow: shadowImg, tile: container });
            }
        }

        // 生成并渲染第二层牌
        const layer2Plan = this.generateLayer2();

        // 第二层牌也必须成对：生成偶数张牌，每种类型成对
        const layer2Count = layer2Plan.length;
        const layer2Types = [];
        // 生成成对的类型（从34种牌中随机取）
        for (let i = 0; i < layer2Count / 2; i++) {
            const type = Math.floor(Math.random() * 34);
            layer2Types.push(type, type);
        }
        // 如果是奇数，补一张（会在后面偶数校验时被移除）
        if (layer2Count % 2 !== 0) {
            layer2Types.push(Math.floor(Math.random() * 34));
        }
        // 打乱第二层牌序
        for (let i = layer2Types.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [layer2Types[i], layer2Types[j]] = [layer2Types[j], layer2Types[i]];
        }

        layer2Plan.forEach((item, idx) => {
            const positions = item.coverage;

            // 所有第二层牌尺寸与第一层相同，用 renderRow/renderCol 定位
            const renderW = tileSize;
            const renderH = tileHeight;
            // n+1层相对于n层：横向偏移-10px，纵向偏移-12px
            const layerOffsetX = -10;
            const layerOffsetY = -12;
            const x = startX + item.renderCol * (tileSize - 10) + layerOffsetX;
            const y = startY + item.renderRow * (tileHeight - 20) + layerOffsetY;

            const container = this.add.container(x, y);

            // 从成对的类型列表中取牌面
            const type = layer2Types[idx];
            const imgKey = `tile_${type % 34}`;
            const tileImg = this.add.image(0, 0, imgKey);
            const imgScale = Math.min((renderW - 2) / 100, (renderH - 2) / 138);
            tileImg.setScale(imgScale);
            container.add(tileImg);

            container.setData('type', type);
            container.setData('matched', false);
            container.setData('tileW', renderW);
            container.setData('tileH', renderH);
            container.setData('imgScale', imgScale);
            container.setData('layer', 1);
            container.setData('coveredPositions', positions);
            container.setData('isCovered', false);
            container.setData('isFree', true);
            container.setData('baseImgScale', imgScale);

            container.setSize(renderW, renderH);
            container.setInteractive({ useHandCursor: true });
            container.on('pointerdown', () => this.onTileClick(container));

            // 第二层深度：基于 renderRow/renderCol，右压左、下压上
            const defaultDepth = 1000 + Math.round(item.renderRow) * cols + Math.round(item.renderCol);
            container.setDepth(defaultDepth);
            container.setData('defaultDepth', defaultDepth);

            this.tiles.push(container);

            // 创建独立阴影（第二层阴影在depth 999）
            const shadowImg = this.add.image(x, y, 'tile_shadow');
            const shadowScale = Math.min((renderW - 2) / 100, (renderH - 2) / 138);
            shadowImg.setScale(shadowScale);
            shadowImg.setDepth(999);
            shadowImg.setData('origScale', shadowScale);
            this.shadowLayer.push({ shadow: shadowImg, tile: container });

            // 标记被覆盖的第一层牌
            positions.forEach(([r, c]) => {
                const l1Tile = this.boardGrid[r][c].layer1Tile;
                if (l1Tile) {
                    l1Tile.setData('isCovered', true);
                    l1Tile.setData('isFree', false);
                    l1Tile.disableInteractive();
                }
                this.boardGrid[r][c].layer2Tile = container;
            });
        });

        // 更新总对数（确保偶数）
        if (this.tiles.length % 2 !== 0) {
            // 找到一张第二层牌移除
            let lastTile = this.tiles.filter(t => t.getData('layer') === 1).pop();
            if (!lastTile) lastTile = this.tiles[this.tiles.length - 1];

            // 清理该牌覆盖的位置
            lastTile.getData('coveredPositions').forEach(([r, c]) => {
                const l1Tile = this.boardGrid[r][c].layer1Tile;
                if (l1Tile) {
                    l1Tile.setData('isCovered', false);
                    l1Tile.setData('isFree', true);
                    l1Tile.setInteractive({ useHandCursor: true });
                }
                this.boardGrid[r][c].layer2Tile = null;
            });
            // 移除对应的阴影
            const shadowEntry = this.shadowLayer.find(s => s.tile === lastTile);
            if (shadowEntry) {
                shadowEntry.shadow.destroy();
                this.shadowLayer = this.shadowLayer.filter(s => s !== shadowEntry);
            }
            lastTile.destroy();
            this.tiles = this.tiles.filter(t => t !== lastTile);
        }

        this.totalPairs = Math.floor(this.tiles.length / 2);
        this.matchText.setText(`${this.totalPairs}`);

        // 入场动画：随机选择一种动画，完成后才初始化自由状态和启用交互
        const animTypes = ['slideLeftRight', 'scaleBottomRight', 'scaleBottomLeft', 'scaleTopRight', 'scaleTopLeft', 'slideDown', 'slideUp'];
        const animType = animTypes[Math.floor(Math.random() * animTypes.length)];

        this.playEntryAnimation(animType, () => {
            this.recalculateAllFreeStatus();
        });
    }

    // 入场动画统一入口
    playEntryAnimation(type, onComplete) {
        // 动画开始前：所有阴影设为透明
        this.shadowLayer.forEach(({ shadow }) => {
            shadow.setAlpha(0);
        });

        // 动画开始前：先计算所有牌的自由状态，再显示锁定效果
        this.tiles.forEach(tile => {
            if (tile.getData('matched')) return;
            const free = this.isTileFree(tile);
            tile.setData('isFree', free);

            const tileImg = tile.list[0];
            if (tileImg && tileImg.setTint) {
                if (!free) {
                    tileImg.setTint(0x999999);
                } else {
                    tileImg.clearTint();
                }
            }
        });

        if (type === 'slideLeftRight') {
            this.playSlideEntry(onComplete);
        } else if (type === 'slideDown' || type === 'slideUp') {
            this.playVerticalEntry(type, onComplete);
        } else {
            this.playScaleEntry(type, onComplete);
        }
    }

    // 入场动画：牌按列交替从左右飞入，按行从上到下延迟20ms
    playSlideEntry(onComplete) {
        this.isProcessing = true;

        const rowDelay = 20;
        const duration = 350;
        const offscreenX = 350;
        const bounceDist = 15; // 弹性过冲距离（原来的一半）

        const allEntries = this.tiles.map(tile => {
            const coveredPositions = tile.getData('coveredPositions');
            const row = coveredPositions[0][0];
            const col = coveredPositions[0][1];
            return { tile, row, col, origX: tile.x, origY: tile.y };
        });

        let maxEndTime = 0;

        allEntries.forEach(entry => {
            const { tile, row, col, origX } = entry;

            const fromLeft = col % 2 === 0;
            const startX = fromLeft ? -offscreenX : this.w + offscreenX;
            const overshootX = fromLeft ? origX + bounceDist : origX - bounceDist;

            const delay = row * rowDelay;
            const endTime = delay + duration + 80;
            if (endTime > maxEndTime) maxEndTime = endTime;

            tile.x = startX;

            const shadowEntry = this.shadowLayer.find(s => s.tile === tile);
            if (shadowEntry) {
                shadowEntry.shadow.x = startX;
            }

            this.time.delayedCall(delay, () => {
                // 阶段1：飞到过冲位置
                this.tweens.add({
                    targets: tile,
                    x: overshootX,
                    duration: duration,
                    ease: 'Sine.easeOut',
                    onUpdate: () => {
                        if (shadowEntry) {
                            shadowEntry.shadow.x = tile.x;
                        }
                    },
                    onComplete: () => {
                        // 阶段2：弹回终点
                        this.tweens.add({
                            targets: tile,
                            x: origX,
                            duration: 80,
                            ease: 'Sine.easeInOut',
                            onUpdate: () => {
                                if (shadowEntry) {
                                    shadowEntry.shadow.x = tile.x;
                                }
                            }
                        });
                    }
                });
            });
        });

        this.playShadowFadeIn(maxEndTime, onComplete);
    }

    // 入场动画：从角落弹性放大出现
    // corner取值：'scaleBottomRight', 'scaleBottomLeft', 'scaleTopRight', 'scaleTopLeft'
    playScaleEntry(corner, onComplete) {
        this.isProcessing = true;

        const rowDelay = 15;
        const duration = 350;
        const bounceScale = 1.07; // 弹性过冲缩放（原来的一半，原来是1.14左右）

        // 根据角落类型确定距离计算方向
        // 每张牌到角落的距离 = |row - cornerRow| + |col - cornerCol|
        let cornerRow, cornerCol;
        switch (corner) {
            case 'scaleBottomRight': cornerRow = 7; cornerCol = 6; break;
            case 'scaleBottomLeft':  cornerRow = 7; cornerCol = 0; break;
            case 'scaleTopRight':    cornerRow = 0; cornerCol = 6; break;
            case 'scaleTopLeft':     cornerRow = 0; cornerCol = 0; break;
        }

        let maxEndTime = 0;

        this.tiles.forEach(tile => {
            const coveredPositions = tile.getData('coveredPositions');
            const row = coveredPositions[0][0];
            const col = coveredPositions[0][1];
            const dist = Math.abs(row - cornerRow) + Math.abs(col - cornerCol);

            // 延迟按距离计算：离角落越远越晚出现
            const delay = dist * rowDelay;
            const endTime = delay + duration + 80;
            if (endTime > maxEndTime) maxEndTime = endTime;

            // 初始缩放为0
            const tileImg = tile.list[0];
            if (tileImg) {
                const origScale = tile.getData('baseImgScale');
                const overshootScale = origScale * bounceScale;
                tileImg.setScale(0);

                const shadowEntry = this.shadowLayer.find(s => s.tile === tile);
                if (shadowEntry) {
                    shadowEntry.shadow.setScale(0);
                }

                this.time.delayedCall(delay, () => {
                    // 阶段1：放大到过冲
                    this.tweens.add({
                        targets: tileImg,
                        scaleX: overshootScale,
                        scaleY: overshootScale,
                        duration: duration,
                        ease: 'Sine.easeOut',
                        onUpdate: () => {
                            if (shadowEntry) {
                                shadowEntry.shadow.setScale(tileImg.scaleX / origScale * shadowEntry.shadow.getData('origScale'));
                            }
                        },
                        onComplete: () => {
                            // 阶段2：弹回原始大小
                            this.tweens.add({
                                targets: tileImg,
                                scaleX: origScale,
                                scaleY: origScale,
                                duration: 80,
                                ease: 'Sine.easeInOut',
                                onUpdate: () => {
                                    if (shadowEntry) {
                                        shadowEntry.shadow.setScale(tileImg.scaleX / origScale * shadowEntry.shadow.getData('origScale'));
                                    }
                                }
                            });
                        }
                    });
                });
            }
        });

        this.playShadowFadeIn(maxEndTime, onComplete);
    }

    // 入场动画：从上到下或从下到上飞入
    playVerticalEntry(type, onComplete) {
        this.isProcessing = true;

        const rowDelay = 20;
        const duration = 350;
        const offscreenY = 400;
        const bounceDist = 15; // 弹性过冲距离（原来的一半）

        const allEntries = this.tiles.map(tile => {
            const coveredPositions = tile.getData('coveredPositions');
            const row = coveredPositions[0][0];
            const col = coveredPositions[0][1];
            return { tile, row, col, origX: tile.x, origY: tile.y };
        });

        let maxEndTime = 0;

        allEntries.forEach(entry => {
            const { tile, row, origY } = entry;

            // 从上到下：从屏幕上方飞入；从下到上：从屏幕下方飞入
            const fromTop = type === 'slideDown';
            const startY = fromTop ? -offscreenY : this.h + offscreenY;
            const overshootY = fromTop ? origY + bounceDist : origY - bounceDist;

            const delay = row * rowDelay;
            const endTime = delay + duration + 80;
            if (endTime > maxEndTime) maxEndTime = endTime;

            tile.y = startY;

            const shadowEntry = this.shadowLayer.find(s => s.tile === tile);
            if (shadowEntry) {
                shadowEntry.shadow.y = startY;
            }

            this.time.delayedCall(delay, () => {
                // 阶段1：飞到过冲位置
                this.tweens.add({
                    targets: tile,
                    y: overshootY,
                    duration: duration,
                    ease: 'Sine.easeOut',
                    onUpdate: () => {
                        if (shadowEntry) {
                            shadowEntry.shadow.y = tile.y;
                        }
                    },
                    onComplete: () => {
                        // 阶段2：弹回终点
                        this.tweens.add({
                            targets: tile,
                            y: origY,
                            duration: 80,
                            ease: 'Sine.easeInOut',
                            onUpdate: () => {
                                if (shadowEntry) {
                                    shadowEntry.shadow.y = tile.y;
                                }
                            }
                        });
                    }
                });
            });
        });

        this.playShadowFadeIn(maxEndTime, onComplete);
    }

    // 阴影渐显 + 回调
    playShadowFadeIn(maxEndTime, onComplete) {
        this.time.delayedCall(maxEndTime + 50, () => {
            this.shadowLayer.forEach(({ shadow }) => {
                this.tweens.add({
                    targets: shadow,
                    alpha: 1,
                    duration: 300,
                    ease: 'Sine.easeOut'
                });
            });

            this.time.delayedCall(300, () => {
                this.isProcessing = false;
                if (onComplete) onComplete();
            });
        });
    }

    // 碰撞消除动画：起飞 → 靠近 → 缩小消失
    animateCollision(tileA, tileB, onComplete) {
        const ax = tileA.x;
        const ay = tileA.y;
        const bx = tileB.x;
        const by = tileB.y;

        // 碰撞点：两牌连线中点
        const cx = (ax + bx) / 2;
        const cy = (ay + by) / 2;

        // 判断左右关系：x小的在左，偏移负；x大的在右，偏移正
        const offset = 200;
        const aIsLeft = ax <= bx;
        const aOffX = aIsLeft ? -offset : offset;
        const bOffX = aIsLeft ? offset : -offset;

        // 起飞目标位置（碰撞点两侧）
        const aFlyX = cx + aOffX;
        const aFlyY = cy;
        const bFlyX = cx + bOffX;
        const bFlyY = cy;

        // 牌的尺寸（用于计算接触点）
        const tileW = tileA.getData('tileW');

        // 确保在最上层
        tileA.setDepth(3000);
        tileB.setDepth(3000);
        const seA = this.shadowLayer.find(s => s.tile === tileA);
        const seB = this.shadowLayer.find(s => s.tile === tileB);
        if (seA) seA.shadow.setDepth(2999);
        if (seB) seB.shadow.setDepth(2999);

        // 阶段1：起飞（330ms，Sine.easeOut）
        this.tweens.add({
            targets: [tileA],
            x: aFlyX,
            y: aFlyY,
            duration: 330,
            ease: 'Sine.easeOut',
            onUpdate: () => {
                if (seA) { seA.shadow.x = tileA.x; seA.shadow.y = tileA.y; }
            }
        });

        this.tweens.add({
            targets: [tileB],
            x: bFlyX,
            y: bFlyY,
            duration: 330,
            ease: 'Sine.easeOut',
            onUpdate: () => {
                if (seB) { seB.shadow.x = tileB.x; seB.shadow.y = tileB.y; }
            },
            onComplete: () => {
                // 阶段2：靠近（30ms，Sine.easeInOut）
                // 接触点：左牌右边缘 = 右牌左边缘
                // 左牌中心 = 接触点 - tileW/2，右牌中心 = 接触点 + tileW/2
                const contactX = aIsLeft ? (aFlyX + bFlyX) / 2 : (aFlyX + bFlyX) / 2;
                const leftContactX = contactX - tileW / 2;
                const rightContactX = contactX + tileW / 2;

                const aApproachX = aIsLeft ? leftContactX : rightContactX;
                const bApproachX = aIsLeft ? rightContactX : leftContactX;

                this.tweens.add({
                    targets: [tileA],
                    x: aApproachX,
                    duration: 30,
                    ease: 'Sine.easeInOut',
                    onUpdate: () => {
                        if (seA) { seA.shadow.x = tileA.x; seA.shadow.y = tileA.y; }
                    }
                });

                this.tweens.add({
                    targets: [tileB],
                    x: bApproachX,
                    duration: 30,
                    ease: 'Sine.easeInOut',
                    onUpdate: () => {
                        if (seB) { seB.shadow.x = tileB.x; seB.shadow.y = tileB.y; }
                    },
                    onComplete: () => {
                        // 阶段3：缩小消失（300ms，Sine.easeIn）
                        this.tweens.add({
                            targets: [tileA],
                            scaleX: 0,
                            scaleY: 0,
                            duration: 300,
                            ease: 'Sine.easeIn'
                        });
                        this.tweens.add({
                            targets: [tileB],
                            scaleX: 0,
                            scaleY: 0,
                            duration: 300,
                            ease: 'Sine.easeIn'
                        });
                        if (seA) {
                            this.tweens.add({
                                targets: [seA.shadow],
                                scaleX: 0,
                                scaleY: 0,
                                alpha: 0,
                                duration: 300,
                                ease: 'Sine.easeIn'
                            });
                        }
                        if (seB) {
                            this.tweens.add({
                                targets: [seB.shadow],
                                scaleX: 0,
                                scaleY: 0,
                                alpha: 0,
                                duration: 300,
                                ease: 'Sine.easeIn',
                                onComplete: () => {
                                    // 阶段4：隐藏并回调
                                    if (seA) { seA.shadow.setVisible(false); }
                                    if (seB) { seB.shadow.setVisible(false); }
                                    tileA.setVisible(false);
                                    tileB.setVisible(false);
                                    tileA.disableInteractive();
                                    tileB.disableInteractive();
                                    if (onComplete) onComplete();
                                }
                            });
                        }
                    }
                });
            }
        });
    }
    animateSelectTile(tile) {
        const tileImg = tile.list[0];
        if (tileImg && tileImg.setTint) {
            tileImg.setTint(0x90ee90);
        }
        if (tileImg) {
            tileImg.setOrigin(0.5);
            const targetScale = tile.getData('baseImgScale') * 1.15;
            this.tweens.add({
                targets: tileImg,
                scaleX: targetScale,
                scaleY: targetScale,
                duration: 150,
                ease: 'Sine.easeInOut'
            });
        }
        tile.setDepth(2000);
        const shadowEntry = this.shadowLayer.find(s => s.tile === tile);
        if (shadowEntry) {
            shadowEntry.shadow.setDepth(1999);
        }
    }

    // 取消选中牌的动画效果（缓入缓出缩小）
    animateDeselectTile(tile) {
        const tileImg = tile.list[0];
        if (tileImg) {
            tileImg.setOrigin(0.5);
            const targetScale = tile.getData('imgScale');
            this.tweens.add({
                targets: tileImg,
                scaleX: targetScale,
                scaleY: targetScale,
                duration: 150,
                ease: 'Sine.easeInOut'
            });
            // 恢复 tint：锁定牌灰色，提示牌黄色，自由牌清除
            if (!tile.getData('isFree')) {
                tileImg.setTint(0x999999);
            } else if (tile.getData('hintTint')) {
                tileImg.setTint(0xf1c40f);
            } else {
                tileImg.clearTint();
            }
        }
        tile.setDepth(tile.getData('defaultDepth'));

        // 阴影恢复该层的阴影层
        const shadowEntry = this.shadowLayer.find(s => s.tile === tile);
        if (shadowEntry) {
            const layer = tile.getData('layer');
            shadowEntry.shadow.setDepth(layer === 0 ? -1 : 999);
        }
    }

    onTileClick(tile) {
        if (this.isProcessing) return;
        if (tile.getData('matched')) return;

        // 自由牌检查：被锁定的牌不可选中
        if (!this.isTileFree(tile)) return;

        // 再次点击已选中的牌 → 取消选中
        if (this.selectedTiles.includes(tile)) {
            this.animateDeselectTile(tile);
            this.selectedTiles = this.selectedTiles.filter(t => t !== tile);
            return;
        }

        // 如果已有一张牌被选中
        if (this.selectedTiles.length === 1) {
            const selectedTile = this.selectedTiles[0];

            // 类型相同 → 消除
            if (selectedTile.getData('type') === tile.getData('type')) {
                this.isProcessing = true;

                // 选中第二张牌的视觉效果
                this.animateSelectTile(tile);
                this.selectedTiles.push(tile);

                // 清除两张牌的绿色选中效果
                const clearGreen = (t) => {
                    const img = t.list[0];
                    if (img && img.clearTint) img.clearTint();
                };
                clearGreen(selectedTile);
                clearGreen(tile);

                // 碰撞消除动画，动画结束后执行消除逻辑
                this.animateCollision(selectedTile, tile, () => {
                    selectedTile.setData('matched', true);
                    tile.setData('matched', true);

                    if (this.hintTiles.includes(selectedTile) || this.hintTiles.includes(tile)) {
                        this.clearHint();
                    }

                    // 如果消除的是第二层牌，解锁对应的第一层牌
                    [selectedTile, tile].forEach(t => {
                        if (t.getData('layer') === 1) {
                            const coveredPositions = t.getData('coveredPositions');
                            coveredPositions.forEach(([r, c]) => {
                                const cell = this.boardGrid[r][c];
                                if (cell && cell.layer1Tile) {
                                    cell.layer1Tile.setData('isCovered', false);
                                    cell.layer1Tile.setData('isFree', true);
                                    cell.layer1Tile.setInteractive({ useHandCursor: true });
                                }
                                cell.layer2Tile = null;
                            });
                        }
                    });

                    this.matchedPairs++;
                    this.score += 200;
                    this.scoreText.setText(`${this.score}`);

                    this.selectedTiles = [];
                    this.isProcessing = false;

                    // 重新计算所有牌的自由状态
                    this.recalculateAllFreeStatus();

                    // 消除后检查是否还有自由配对，没有则自动洗牌
                    if (!this.hasFreePairs()) {
                        this.smartShuffle();
                    }

                    // 检查是否通关
                    const remaining = this.tiles.filter(t => !t.getData('matched'));
                    if (remaining.length === 0) {
                        this.time.delayedCall(500, () => this.levelComplete());
                    }
                });
            } else {
                // 类型不同 → 取消前一张，选中新牌
                this.animateDeselectTile(selectedTile);
                this.selectedTiles = [];

                // 选中新牌
                this.animateSelectTile(tile);
                this.selectedTiles.push(tile);
            }
            return;
        }

        // 没有选中牌 → 选中这张
        this.animateSelectTile(tile);
        this.selectedTiles.push(tile);
    }

    clearTileSelection(tile) {
        this.animateDeselectTile(tile);
    }

    resetTileState(tile) {
        this.clearTileSelection(tile);
        // 恢复锁定蒙版（如果被锁定）
        if (!tile.getData('isFree')) {
            const tileImg = tile.list[0];
            if (tileImg && tileImg.setTint) {
                tileImg.setTint(0x999999);
            }
        }
    }

    levelComplete() {
        const nextLevel = this.currentLevel + 1;
        localStorage.setItem('mahjongLevel', nextLevel.toString());

        this.scene.start('ResultsScene', {
            level: this.currentLevel,
            completed: true,
            score: this.score
        });
    }

    // 获取洗牌后的牌面类型，保证每种类型成对出现
    getShuffledTypesForLayer2(unmatchedTiles) {
        // 收集所有类型
        const allTypes = unmatchedTiles.map(t => t.getData('type'));

        // 确保总数为偶数（如果奇数则移除一张第二层牌）
        if (allTypes.length % 2 !== 0) {
            const layer2Tiles = unmatchedTiles.filter(t => t.getData('layer') === 1);
            if (layer2Tiles.length > 0) {
                const lastL2 = layer2Tiles[layer2Tiles.length - 1];
                const idx = unmatchedTiles.indexOf(lastL2);
                if (idx !== -1) {
                    unmatchedTiles.splice(idx, 1);
                    allTypes.pop();
                    // 解锁被移除牌覆盖的位置
                    lastL2.getData('coveredPositions').forEach(([r, c]) => {
                        const cell = this.boardGrid[r][c];
                        if (cell && cell.layer1Tile) {
                            cell.layer1Tile.setData('isCovered', false);
                            cell.layer1Tile.setData('isFree', true);
                            cell.layer1Tile.setInteractive({ useHandCursor: true });
                        }
                        cell.layer2Tile = null;
                    });
                    // 移除阴影
                    const shadowEntry = this.shadowLayer.find(s => s.tile === lastL2);
                    if (shadowEntry) {
                        shadowEntry.shadow.destroy();
                        this.shadowLayer = this.shadowLayer.filter(s => s !== shadowEntry);
                    }
                    lastL2.destroy();
                    this.tiles = this.tiles.filter(t => t !== lastL2);
                }
            }
        }

        // 重新生成成对类型：每种类型出现偶数次
        const pairCount = allTypes.length / 2;
        const newTypes = [];
        for (let i = 0; i < pairCount; i++) {
            const type = Math.floor(Math.random() * 34);
            newTypes.push(type, type);
        }
        // 打乱
        for (let i = newTypes.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [newTypes[i], newTypes[j]] = [newTypes[j], newTypes[i]];
        }

        return newTypes;
    }

    // 检查当前自由牌中是否有可配对的
    hasFreePairs() {
        const freeTiles = this.tiles.filter(t => !t.getData('matched') && this.isTileFree(t));
        const typeCounts = {};
        freeTiles.forEach(t => {
            const type = t.getData('type');
            typeCounts[type] = (typeCounts[type] || 0) + 1;
        });
        return Object.values(typeCounts).some(count => count >= 2);
    }

    // 智能洗牌：保证洗完后至少有一对自由牌可配对，且所有牌成对
    smartShuffle() {
        const maxAttempts = 50;
        for (let attempt = 0; attempt < maxAttempts; attempt++) {
            // 执行一次普通洗牌
            const unmatchedTiles = this.tiles.filter(t => !t.getData('matched'));

            // 重新生成成对类型
            const pairCount = unmatchedTiles.length / 2;
            const newTypes = [];
            for (let i = 0; i < pairCount; i++) {
                const type = Math.floor(Math.random() * 34);
                newTypes.push(type, type);
            }
            // 打乱
            for (let i = newTypes.length - 1; i > 0; i--) {
                const j = Math.floor(Math.random() * (i + 1));
                [newTypes[i], newTypes[j]] = [newTypes[j], newTypes[i]];
            }

            unmatchedTiles.forEach((tile, i) => {
                const newType = newTypes[i];
                tile.setData('type', newType);
                const tileImg = tile.list[0];
                if (tileImg && tileImg.setTexture) {
                    tileImg.setTexture(`tile_${newType % 34}`);
                }
                tile.setData('hintTint', false);
                this.clearTileSelection(tile);
            });

            this.recalculateAllFreeStatus();

            // 检查是否有自由配对
            if (this.hasFreePairs()) {
                return; // 找到有效洗牌，退出
            }
        }

        // 如果50次都没找到，至少做一次洗牌（兜底）
        this.recalculateAllFreeStatus();
    }
}