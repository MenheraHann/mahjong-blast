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
        this.shuffleCount = 10;
        this.hintTiles = [];
        this.boardGrid = []; // 12×14 交点网格，存储每交点各层牌引用 [layer0, layer1, layer2, layer3]
        // 连击相关
        this.combo = 0;
        this.maxCombo = 0;
        this.startTime = Date.now();
        // 快速连击相关
        this.lastClickTile = null;
        this.lastClickTime = 0;
    }

    preload() {
        this.load.svg('icon-back', 'assets/icons/back.svg');
        this.load.svg('icon-menu', 'assets/icons/menu.svg');
        this.load.svg('icon-shuffle', 'assets/icons/shuffle.svg');
        this.load.svg('icon-hint', 'assets/icons/hint.svg');

        // 加载pixelMajong麻将牌图片
        // 加载34种麻将牌（tile_0~tile_33）
        // tile_0~8: 万(1-9), tile_9~17: 饼(11-19), tile_18~26: 条(31-39), tile_27~33: 字(41-47)
        const tileMap = [
            1,2,3,4,5,6,7,8,9,       // tile_0~8: 万
            11,12,13,14,15,16,17,18,19,  // tile_9~17: 饼
            31,32,33,34,35,36,37,38,39,  // tile_18~26: 条
            41,42,43,44,45,46,47        // tile_27~33: 字
        ];
        tileMap.forEach((num, idx) => {
            this.load.image(`tile_${idx}`, `assets/pixelMajong/${String(num).padStart(2, '0')}.png`);
        });
        // 加载暗扣牌背
        this.load.image('tile_00', 'assets/pixelMajong/00.png');
        // 加载阴影素材
        this.load.image('tile_shadow', 'assets/pixelMajong/shadow.png');
        // 加载锁定提示图标
        this.load.image('red_cross', 'assets/icons/red_cross.png');

        // 加载音效
        this.load.audio('sfx-click01', 'assets/wav/点击01.WAV');
        this.load.audio('sfx-click02', 'assets/wav/点击02.WAV');
        this.load.audio('sfx-click03', 'assets/wav/点击03.WAV');
        this.load.audio('sfx-putdown', 'assets/wav/放下.WAV');
        this.load.audio('sfx-collision', 'assets/wav/碰撞音效.WAV');
        this.load.audio('sfx-hint', 'assets/wav/提示.WAV');
        this.load.audio('sfx-shuffle', 'assets/wav/重新排列.WAV');
        this.load.audio('sfx-start', 'assets/wav/开局音效.WAV');
        this.load.audio('sfx-levelComplete', 'assets/wav/过关.WAV');
        this.load.audio('sfx-button', 'assets/wav/按钮点击.WAV');
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

        // 临时调试网格辅助线（按D键开关）
        this.debugGridGraphics = null;
        this.input.keyboard.on('keydown-D', () => {
            this.toggleDebugGrid();
        });

        // 多点触控检测
        this.setupMultiTouch();
    }

    // 设置多点触控
    setupMultiTouch() {
        this.multiTouchTiles = [];
        this.isMultiTouchActive = false;

        // 使用 capture 模式确保在 Phaser 之前捕获触摸事件
        const canvas = this.sys.game.canvas;
        const captureTouch = (e) => {
            if (e.touches.length >= 2) {
                e.preventDefault();
                this.handleNativeTouch(e.touches);
            }
        };
        canvas.addEventListener('touchstart', captureTouch, { passive: false, capture: true });

        // 同时监听 pointerdown 作为后备（用于检测多指针）
        this.input.on('pointerdown', (ptr) => {
            const activePtrs = this.input.pointers.filter(p => p.isDown);
            console.log(`pointerdown: active pointers = ${activePtrs.length}`);
            if (activePtrs.length >= 2) {
                console.log('Multi-touch detected via pointerdown!');
                const touchedTiles = [];
                for (const p of activePtrs) {
                    const gameObjects = this.input.hitTest(p.x, p.y);
                    for (const obj of gameObjects) {
                        let tile = obj;
                        while (tile && !this.tiles.includes(tile)) {
                            tile = tile.parent;
                        }
                        if (tile && !tile.getData('matched') && this.isTileFree(tile)) {
                            touchedTiles.push(tile);
                            break;
                        }
                    }
                }
                // 找到匹配的一对
                for (let i = 0; i < touchedTiles.length; i++) {
                    for (let j = i + 1; j < touchedTiles.length; j++) {
                        const tileA = touchedTiles[i];
                        const tileB = touchedTiles[j];
                        if (tileA.getData('type') === tileB.getData('type') &&
                            !tileA.getData('matched') && !tileB.getData('matched')) {
                            console.log('MATCH via pointerdown!');
                            this.executeQuickMatch(tileA, tileB);
                            return;
                        }
                    }
                }
            }
        });
    }

    // 处理原生多点触摸
    handleNativeTouch(touches) {
        console.log('handleNativeTouch called, touches:', touches.length);

        if (this.isProcessing) return;

        const touchedTiles = [];

        for (let i = 0; i < touches.length; i++) {
            const touch = touches[i];
            const rect = this.sys.game.canvas.getBoundingClientRect();

            // 计算触摸位置（考虑缩放和设备像素比）
            const scaleX = this.sys.game.canvas.width / rect.width;
            const scaleY = this.sys.game.canvas.height / rect.height;
            const x = (touch.clientX - rect.left) * scaleX;
            const y = (touch.clientY - rect.top) * scaleY;

            console.log(`Touch ${i}: clientX=${touch.clientX}, clientY=${touch.clientY}, calc x=${x}, y=${y}`);

            // 使用 Phaser 的 hitTest
            const gameObjects = this.input.hitTest(x, y);
            console.log(`Touch ${i}: hitTest found ${gameObjects.length} objects`);

            for (const obj of gameObjects) {
                let tile = obj;
                while (tile && !this.tiles.includes(tile)) {
                    tile = tile.parent;
                }
                if (tile && !tile.getData('matched') && this.isTileFree(tile)) {
                    touchedTiles.push(tile);
                    console.log(`Touch ${i}: found tile type=${tile.getData('type')}`);
                    break;
                }
            }
        }

        console.log(`Total touchedTiles: ${touchedTiles.length}`);

        // 找到匹配的一对牌
        if (touchedTiles.length >= 2) {
            for (let i = 0; i < touchedTiles.length; i++) {
                for (let j = i + 1; j < touchedTiles.length; j++) {
                    const tileA = touchedTiles[i];
                    const tileB = touchedTiles[j];

                    console.log(`Checking pair: typeA=${tileA.getData('type')}, typeB=${tileB.getData('type')}`);

                    if (tileA.getData('type') === tileB.getData('type') &&
                        !tileA.getData('matched') && !tileB.getData('matched')) {
                        console.log('MATCH! Executing quick match');
                        this.executeQuickMatch(tileA, tileB);
                        return;
                    }
                }
            }
        }
    }

    // 执行快速匹配消除
    executeQuickMatch(tileA, tileB) {
        this.isProcessing = true;

        // 清除提示状态
        this.stopHintSwing(tileA);
        this.stopHintSwing(tileB);

        // 直接执行碰撞消除
        this.animateCollision(tileA, tileB, () => {
            tileA.setData('matched', true);
            tileB.setData('matched', true);

            if (this.hintTiles.includes(tileA) || this.hintTiles.includes(tileB)) {
                this.clearHint();
            }

            if (tileA.getData('layer') > 0 || tileB.getData('layer') > 0) {
                this.refreshCoveredState();
            }

            this.matchedPairs++;
            this.score += 200;
            this.combo++;
            if (this.combo > this.maxCombo) {
                this.maxCombo = this.combo;
            }
            this.scoreText.setText(`${this.score}`);

            this.isProcessing = false;
            this.recalculateAllFreeStatus();

            if (this.remainingPairs === 0) {
                this.smartShuffle();
            }

            const remaining = this.tiles.filter(t => !t.getData('matched'));
            if (remaining.length === 0) {
                this.time.delayedCall(500, () => this.levelComplete());
            }
        });
    }

    // 禁用多点触控检测（场景关闭时调用）
    disableMultiTouch() {
        // 清理由 this.sys.canvas 添加的监听器
    }

    createTopBar() {
        const topY = 45;

        // 1. 返回按钮
        const backBtn = this.add.image(30, topY, 'icon-back').setScale(1.4).setInteractive({ useHandCursor: true });
        backBtn.on('pointerdown', () => {
            this.sound.play('sfx-button');
            this.showConfirmDialog('确定要返回主菜单吗？', () => {
                this.scene.start('HomeScene');
            });
        });

        // 2. 关卡数
        this.levelText = this.add.text(0, 0, `${this.currentLevel}`, {
            fontSize: '44px',
            color: '#ffffff',
            fontStyle: 'bold'
        }).setOrigin(0.5, 0);

        const levelLabel = this.add.text(0, -18, '关卡', {
            fontSize: '32px',
            color: '#bdc3c7'
        }).setOrigin(0.5, 0);

        // 3. 分数
        this.scoreText = this.add.text(0, 0, '0', {
            fontSize: '44px',
            color: '#f1c40f',
            fontStyle: 'bold'
        }).setOrigin(0.5, 0);

        const scoreLabel = this.add.text(0, -18, '分数', {
            fontSize: '32px',
            color: '#bdc3c7'
        }).setOrigin(0.5, 0);

        // 4. 匹配数
        this.matchText = this.add.text(0, 0, '0', {
            fontSize: '44px',
            color: '#2ecc71',
            fontStyle: 'bold'
        }).setOrigin(0.5, 0);

        const matchLabel = this.add.text(0, -18, '匹配', {
            fontSize: '32px',
            color: '#bdc3c7'
        }).setOrigin(0.5, 0);

        // 三组居中排列
        const spacing = 240;
        const groupCenterX = this.w / 2;
        const groupY = topY - 5;

        levelLabel.x = groupCenterX - spacing;
        this.levelText.x = groupCenterX - spacing;
        levelLabel.y = groupY - 8;
        this.levelText.y = groupY + 35;

        scoreLabel.x = groupCenterX;
        this.scoreText.x = groupCenterX;
        scoreLabel.y = groupY - 8;
        this.scoreText.y = groupY + 35;

        matchLabel.x = groupCenterX + spacing;
        this.matchText.x = groupCenterX + spacing;
        matchLabel.y = groupY - 8;
        this.matchText.y = groupY + 35;

        // 5. 菜单按钮
        const menuBtn = this.add.image(this.w - 35, topY, 'icon-menu').setScale(1.5).setInteractive({ useHandCursor: true });
        menuBtn.on('pointerdown', () => {
            this.sound.play('sfx-button');
            this.showMenu();
        });
    }

    showConfirmDialog(message, onConfirm) {
        const overlay = this.add.rectangle(this.w / 2, this.h / 2, this.w, this.h, 0x000000, 0.5)
            .setInteractive().setDepth(6000);

        const dialogBg = this.add.rectangle(this.w / 2, this.h / 2 - 40, 400, 200, 0x2c3e50)
            .setStrokeStyle(2, 0x7f8c8d).setDepth(6001);

        const msgText = this.add.text(this.w / 2, this.h / 2 - 90, message, {
            fontSize: '44px',
            color: '#ecf0f1',
            wordWrap: { width: 700 },
            align: 'center'
        }).setOrigin(0.5).setDepth(6001);

        const confirmBtn = this.add.text(this.w / 2 - 80, this.h / 2, '确定', {
            fontSize: '44px',
            color: '#ffffff',
            backgroundColor: '#e74c3c',
            padding: { x: 50, y: 20 }
        }).setOrigin(0.5).setInteractive({ useHandCursor: true }).setDepth(6001);

        confirmBtn.on('pointerdown', () => {
            this.sound.play('sfx-button');
            this.destroyDialog(overlay, dialogBg, msgText, confirmBtn, cancelBtn);
            onConfirm();
        });

        const cancelBtn = this.add.text(this.w / 2 + 80, this.h / 2, '取消', {
            fontSize: '44px',
            color: '#ffffff',
            backgroundColor: '#3498db',
            padding: { x: 50, y: 20 }
        }).setOrigin(0.5).setInteractive({ useHandCursor: true }).setDepth(6001);

        cancelBtn.on('pointerdown', () => {
            this.sound.play('sfx-button');
            this.destroyDialog(overlay, dialogBg, msgText, confirmBtn, cancelBtn);
        });
    }

    showMenu() {
        const overlay = this.add.rectangle(this.w / 2, this.h / 2, this.w, this.h, 0x000000, 0.5)
            .setInteractive().setDepth(6000);

        const dialogBg = this.add.rectangle(this.w / 2, this.h / 2, 600, 400, 0x2c3e50)
            .setStrokeStyle(2, 0x7f8c8d).setDepth(6001);

        const title = this.add.text(this.w / 2, this.h / 2 - 160, '菜单', {
            fontSize: '56px',
            color: '#ecf0f1',
            fontStyle: 'bold'
        }).setOrigin(0.5).setDepth(6001);

        const restartBtn = this.add.text(this.w / 2, this.h / 2 - 40, '重新开始', {
            fontSize: '48px',
            color: '#ffffff',
            backgroundColor: '#e67e22',
            padding: { x: 80, y: 24 }
        }).setOrigin(0.5).setInteractive({ useHandCursor: true }).setDepth(6001);

        restartBtn.on('pointerdown', () => {
            this.sound.play('sfx-button');
            this.destroyDialog(overlay, dialogBg, title, restartBtn, menuBtn2);
            this.scene.restart({ level: this.currentLevel });
        });

        const menuBtn2 = this.add.text(this.w / 2, this.h / 2 + 60, '返回主菜单', {
            fontSize: '48px',
            color: '#ffffff',
            backgroundColor: '#3498db',
            padding: { x: 80, y: 24 }
        }).setOrigin(0.5).setInteractive({ useHandCursor: true }).setDepth(6001);

        menuBtn2.on('pointerdown', () => {
            this.sound.play('sfx-button');
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
        this.shuffleBtn = this.add.image(this.w / 2 - 100, bottomY, 'icon-shuffle').setScale(1.8).setInteractive({ useHandCursor: true });
        this.shuffleCountText = this.add.text(this.w / 2 - 80, bottomY - 25, `${this.shuffleCount}`, {
            fontSize: '32px',
            color: '#ffffff',
            backgroundColor: '#e74c3c',
            padding: { x: 12, y: 4 }
        }).setOrigin(0.5);
        this.shuffleBtn.on('pointerdown', () => {
            this.shuffleBoard();
        });

        // 提示按钮
        this.hintBtn = this.add.image(this.w / 2 + 100, bottomY, 'icon-hint').setScale(1.8).setInteractive({ useHandCursor: true });

        // 提示次数角标
        this.hintCountText = this.add.text(this.w / 2 + 120, bottomY - 25, `${this.hintCount}`, {
            fontSize: '32px',
            color: '#ffffff',
            backgroundColor: '#e74c3c',
            padding: { x: 12, y: 4 }
        }).setOrigin(0.5);

        this.hintBtn.on('pointerdown', () => {
            this.useHint();
        });

        // 左下角更新日期
        this.add.text(10, this.h - 10, '更新: 2026-04-07 15:34', {
            fontSize: '14px',
            color: '#7f8c8d'
        }).setOrigin(0, 1);
    }

    useHint() {
        if (this.hintCount <= 0) return;
        if (this.hintTiles.length > 0) return;

        // 使用提示打断连击
        this.combo = 0;

        // 播放提示音效
        this.sound.play('sfx-hint');

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
            // 暗扣牌被提示时，永久翻正为正面（带动画）
            if (tile.getData('isFaceDown')) {
                tile.setData('isFaceDown', false);
                const tileImg = tile.list[0];
                if (tileImg) {
                    const faceTexture = `tile_${tile.getData('type') % 34}`;
                    const baseScale = tile.getData('imgScale');

                    // 水平缩小到0 → 换正面图 → 水平放大回原始大小
                    this.tweens.add({
                        targets: tileImg,
                        scaleX: 0,
                        duration: 120,
                        ease: 'Sine.easeIn',
                        onComplete: () => {
                            tileImg.setTexture(faceTexture);
                            this.tweens.add({
                                targets: tileImg,
                                scaleX: baseScale,
                                duration: 120,
                                ease: 'Sine.easeOut'
                            });
                        }
                    });
                }
            }

            const tileImg = tile.list[0];
            if (tileImg && tileImg.setTint) {
                tileImg.setTint(0xf1c40f); // 黄色蒙版
            }
            tile.setData('hintTint', true);

            // 提示牌钟摆摇晃动画：每3秒摇一次
            this.startHintSwing(tile);
        });
        this.hintTiles = pair;
    }

    // 提示牌钟摆摇晃效果：三次摇晃，第二次最大，前后有弹性
    startHintSwing(tile) {
        const tileImg = tile.list[0];
        const shadowEntry = this.shadowLayer.find(s => s.tile === tile);
        const shadowImg = shadowEntry ? shadowEntry.shadow : null;
        if (!tileImg) return;

        const doSwing = () => {
            // 三次摇晃序列：小(-4°) → 大(-8°~8°) → 小(-4°)，每次200ms，共600ms
            const seq = [
                { angle: -4, duration: 100, ease: 'Sine.easeOut' },
                { angle: 8, duration: 100, ease: 'Sine.easeIn' },
                { angle: -8, duration: 200, ease: 'Sine.easeInOut' },
                { angle: 4, duration: 100, ease: 'Sine.easeOut' },
                { angle: 0, duration: 100, ease: 'Sine.easeIn' }
            ];

            let totalDelay = 0;
            seq.forEach(step => {
                this.tweens.add({
                    targets: tileImg,
                    angle: step.angle,
                    duration: step.duration,
                    ease: step.ease,
                    delay: totalDelay
                });
                if (shadowImg) {
                    this.tweens.add({
                        targets: shadowImg,
                        angle: step.angle,
                        duration: step.duration,
                        ease: step.ease,
                        delay: totalDelay
                    });
                }
                totalDelay += step.duration;
            });
        };

        // 首次立即摇晃
        doSwing();
        tile.setData('hintSwingTween', true);

        // 间隔600ms后重复
        const timer = this.time.addEvent({
            delay: 1200, // 600ms摇晃 + 600ms间隔
            callback: () => {
                if (!tile.getData('hintTint') || tile.getData('matched')) {
                    timer.remove();
                    return;
                }
                doSwing();
            },
            loop: true
        });
        tile.setData('hintSwingTimer', timer);
    }

    // 停止提示牌摇晃
    stopHintSwing(tile) {
        const tileImg = tile.list[0];
        if (tileImg) {
            this.tweens.killTweensOf(tileImg);
            tileImg.setAngle(0);
        }
        const shadowEntry = this.shadowLayer.find(s => s.tile === tile);
        if (shadowEntry && shadowEntry.shadow) {
            this.tweens.killTweensOf(shadowEntry.shadow);
            shadowEntry.shadow.setAngle(0);
        }
        const timer = tile.getData('hintSwingTimer');
        if (timer) {
            timer.remove();
        }
        tile.setData('hintSwingTween', null);
        tile.setData('hintSwingTimer', null);
    }

    clearHint() {
        this.hintTiles.forEach(tile => {
            tile.setData('hintTint', false);
            this.stopHintSwing(tile);
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

    // 洗牌弹性动画：收拢到中心 → 执行逻辑 → 展开回原位
    animateShuffleBoard(callback) {
        const unmatchedTiles = this.tiles.filter(t => !t.getData('matched'));
        if (unmatchedTiles.length === 0) return;

        // 禁用所有牌的交互
        unmatchedTiles.forEach(t => t.disableInteractive());
        this.isProcessing = true;

        // 播放重新排列音效
        this.sound.play('sfx-shuffle');

        const centerX = this.w / 2;
        const centerY = this.h / 2;
        const duration = 600;

        // 收集每张牌的原始位置和对应阴影
        const items = unmatchedTiles.map(tile => {
            const shadowEntry = this.shadowLayer.find(s => s.tile === tile);
            return {
                tile,
                shadow: shadowEntry ? shadowEntry.shadow : null,
                origX: tile.x,
                origY: tile.y,
                origDepth: tile.depth
            };
        });

        // 找出距离中心最近且最高层级的牌，设为最顶层
        let topItem = items[0];
        let minDist = Infinity;
        items.forEach(item => {
            const dist = Math.hypot(item.origX - centerX, item.origY - centerY);
            if (dist < minDist || (dist === minDist && item.origDepth > topItem.origDepth)) {
                minDist = dist;
                topItem = item;
            }
        });

        // 收拢阶段：所有牌移动到中心
        let gatherCount = items.length;
        const onGatherComplete = () => {
            gatherCount--;
            if (gatherCount > 0) return;

            // 收拢完成，执行洗牌逻辑
            if (callback) callback();

            // 顿 400ms 后再展开
            this.time.delayedCall(400, () => {
                // 展开阶段：所有牌回到原位，阴影恢复alpha
                let spreadCount = items.length;
                const onSpreadComplete = () => {
                    spreadCount--;
                    if (spreadCount > 0) return;

                    // 展开完成，恢复交互
                    items.forEach(item => {
                        item.tile.setInteractive({ useHandCursor: true });
                        item.tile.setDepth(item.origDepth);
                        if (item.shadow) {
                            item.shadow.x = item.origX;
                            item.shadow.y = item.origY;
                        }
                    });
                    this.isProcessing = false;
                };

                items.forEach(item => {
                    // 阴影恢复alpha到1
                    if (item.shadow) {
                        this.tweens.add({
                            targets: item.shadow,
                            alpha: 1,
                            duration: duration,
                            ease: 'Sine.easeOut'
                        });
                    }
                    this.tweens.add({
                        targets: [item.tile],
                        x: item.origX,
                        y: item.origY,
                        duration: duration,
                        ease: 'Back.easeOut',
                        onUpdate: () => {
                            if (item.shadow) {
                                item.shadow.x = item.tile.x;
                                item.shadow.y = item.tile.y;
                            }
                        },
                        onComplete: onSpreadComplete
                    });
                });
            });
        };

        items.forEach(item => {
            // 收拢前，最近的牌设为最高层
            if (item === topItem) {
                item.tile.setDepth(9999);
            }

            // 阴影渐变alpha：topItem维持1，其余随机延时降低到0
            if (item.shadow && item !== topItem) {
                const randomDelay = Math.random() * duration * 0.6; // 随机延时0~360ms
                this.tweens.add({
                    targets: item.shadow,
                    alpha: 0,
                    duration: duration - randomDelay,
                    delay: randomDelay,
                    ease: 'Sine.easeIn'
                });
            }

            this.tweens.add({
                targets: [item.tile],
                x: centerX,
                y: centerY,
                duration: duration,
                ease: 'Back.easeIn',
                onUpdate: () => {
                    if (item.shadow) {
                        item.shadow.x = item.tile.x;
                        item.shadow.y = item.tile.y;
                    }
                },
                onComplete: onGatherComplete
            });
        });
    }

    // 洗牌
    shuffleBoard() {
        if (this.shuffleCount <= 0) return;
        this.shuffleCount--;
        this.shuffleCountText.setText(`${this.shuffleCount}`);
        if (this.shuffleCount <= 0) {
            this.shuffleBtn.setAlpha(0.3);
            this.shuffleBtn.disableInteractive();
        }

        // 手动刷新打断连击
        this.combo = 0;

        // 保存未消除的牌的引用（动画会移动它们，但引用不变）
        const unmatchedTiles = this.tiles.filter(t => !t.getData('matched'));
        this.clearHint();

        this.animateShuffleBoard(() => {
            // 收集所有未消除牌的当前牌面类型
            const types = unmatchedTiles.map(t => t.getData('type'));

            // 最多50次尝试，找到洗牌后有至少一对可配对的结果
            let bestTypes = null;
            for (let attempt = 0; attempt < 50; attempt++) {
                // 打乱牌面类型顺序
                const shuffled = [...types];
                for (let i = shuffled.length - 1; i > 0; i--) {
                    const j = Math.floor(Math.random() * (i + 1));
                    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
                }

                // 临时分配测试
                unmatchedTiles.forEach((tile, i) => {
                    tile.setData('type', shuffled[i]);
                });
                this.recalculateAllFreeStatus();

                // 检查是否有至少一对可配对
                if (this.hasFreePairs()) {
                    bestTypes = shuffled;
                    break;
                }
            }

            // 如果50次都没找到可用配对，重新生成牌面类型（维持数量）
            if (!bestTypes) {
                this.doSmartShuffleLogic();
                return;
            }

            // 最终应用最佳洗牌结果
            bestTypes.forEach((type, i) => {
                unmatchedTiles[i].setData('type', type);
                const tileImg = unmatchedTiles[i].list[0];
                if (tileImg && tileImg.setTexture && !unmatchedTiles[i].getData('isFaceDown')) {
                    tileImg.setTexture(`tile_${type % 34}`);
                }
                unmatchedTiles[i].setData('hintTint', false);
                this.clearTileSelection(unmatchedTiles[i]);
            });
            this.recalculateAllFreeStatus();
        });
    }

    // 生成指定层的牌布局（基于 14×16 交点网格 + 支撑规则 + 互斥区）
    generateLayerN(layerIndex) {
        const tryPlacement = () => {
            // Step 1: 计算下层所有牌的 3×3 互斥区域并集（= 支撑点集合）
            const lowerLayer = layerIndex - 1;
            const lowerLayerTiles = this.tiles.filter(t => t.getData('layer') === lowerLayer);
            const supportPoints = new Set();
            lowerLayerTiles.forEach(tile => {
                const tr = tile.getData('tileRow');
                const tc = tile.getData('tileCol');
                for (let dr = -1; dr <= 1; dr++) {
                    for (let dc = -1; dc <= 1; dc++) {
                        const rr = tr + dr;
                        const cc = tc + dc;
                        if (rr >= 0 && rr <= 13 && cc >= 0 && cc <= 11) {
                            supportPoints.add(`${rr},${cc}`);
                        }
                    }
                }
            });

            // Step 2: 收集所有有效候选位置（有支撑点 + 不与自身 3×3 互斥区冲突）
            const candidates = [];
            for (let r = 0; r <= 13; r++) {
                for (let c = 0; c <= 11; c++) {
                    if (!supportPoints.has(`${r},${c}`)) continue;
                    candidates.push({ row: r, col: c });
                }
            }

            // 打乱候选顺序
            for (let i = candidates.length - 1; i > 0; i--) {
                const j = Math.floor(Math.random() * (i + 1));
                [candidates[i], candidates[j]] = [candidates[j], candidates[i]];
            }

            // Step 3: 贪心选择 8-12 个不重叠 3×3 互斥区的候选
            const targetCount = 8 + Math.floor(Math.random() * 5); // 8-12
            const usedPoints = new Set();
            const placed = [];

            for (const cand of candidates) {
                if (placed.length >= targetCount) break;

                // 检查该牌的 3×3 互斥区是否与已放置牌的互斥区冲突
                let conflict = false;
                for (let dr = -1; dr <= 1 && !conflict; dr++) {
                    for (let dc = -1; dc <= 1 && !conflict; dc++) {
                        if (usedPoints.has(`${cand.row + dr},${cand.col + dc}`)) {
                            conflict = true;
                        }
                    }
                }
                if (conflict) continue;

                // 标记该牌的 3×3 互斥区
                for (let dr = -1; dr <= 1; dr++) {
                    for (let dc = -1; dc <= 1; dc++) {
                        usedPoints.add(`${cand.row + dr},${cand.col + dc}`);
                    }
                }
                placed.push({
                    row: cand.row,
                    col: cand.col
                });
            }

            // Step 4: 至少需要放置 2 张（1 对）
            if (placed.length < 2) return null;

            return placed;
        };

        // 最多重试 3 次
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

        // 如果被上层牌覆盖（压边、正压、压角），则锁定（任何层都适用）
        if (tile.getData('isCovered')) return false;

        // 同层左右都被挡住 → 锁定
        const leftBlocked = this.hasSideNeighbor(tile, 'left');
        const rightBlocked = this.hasSideNeighbor(tile, 'right');
        return !(leftBlocked && rightBlocked);
    }

    // 检查是否有牌挡住左右侧，基于网格坐标（同层内检查）
    // 左侧3个点：(r-1,c-2)、(r,c-2)、(r+1,c-2)
    // 右侧3个点：(r-1,c+2)、(r,c+2)、(r+1,c+2)
    hasSideNeighbor(tile, side) {
        const layer = tile.getData('layer');
        const row = tile.getData('tileRow');
        const col = tile.getData('tileCol');

        return this.tiles.some(other => {
            if (other === tile) return false;
            if (other.getData('matched')) return false;
            if (other.getData('layer') !== layer) return false;

            const otherRow = other.getData('tileRow');
            const otherCol = other.getData('tileCol');

            if (side === 'left') {
                return col - otherCol === 2 &&
                       Math.abs(row - otherRow) <= 1;
            } else { // 'right'
                return otherCol - col === 2 &&
                       Math.abs(row - otherRow) <= 1;
            }
        });
    }

    // 根据位置坐标判断覆盖关系（基于 14×16 交点网格的 3×3 互斥区）
    // 上层牌覆盖下层牌：下层牌中心在上层牌的 3×3 互斥区域内
    refreshCoveredState() {
        const allTiles = this.tiles.filter(t => !t.getData('matched'));

        // 先重置所有牌的 isCovered
        allTiles.forEach(t => t.setData('isCovered', false));

        // 对每张上层牌，找到其 3×3 互斥区域内下层的牌
        const upperTiles = allTiles.filter(t => t.getData('layer') > 0);

        upperTiles.forEach(upper => {
            const upperLayer = upper.getData('layer');
            const uRow = upper.getData('tileRow');
            const uCol = upper.getData('tileCol');
            if (uRow === undefined || uCol === undefined) return;

            // 在该牌的 3×3 互斥区内，找到下层的牌
            // 注意：t.row/t.col 可能是 .5 值，需要取整后比较
            for (let dr = -1; dr <= 1; dr++) {
                for (let dc = -1; dc <= 1; dc++) {
                    const rr = Math.round(uRow) + dr;
                    const cc = Math.round(uCol) + dc;
                    const lower = allTiles.find(t =>
                        t.getData('layer') === upperLayer - 1 &&
                        Math.round(t.getData('tileRow')) === rr &&
                        Math.round(t.getData('tileCol')) === cc
                    );
                    if (lower) {
                        lower.setData('isCovered', true);
                    }
                }
            }
        });
    }

    // 检查指定交点位置在指定层是否有未消除的牌
    hasTileAt(row, col, layer) {
        const gridRow = Math.round(row);
        const gridCol = Math.round(col);
        if (gridRow < 0 || gridRow > 13 || gridCol < 0 || gridCol > 11) return false;
        if (layer < 0 || layer > 3) return false;

        const cell = this.boardGrid[gridRow][gridCol];
        if (!cell) return false;

        const tile = cell[layer];
        return tile && !tile.getData('matched');
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
                } else if (tile.getData('hintTint')) {
                    tileImg.setTint(0xf1c40f); // 提示牌保持黄色
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

    // 牌面整体居中 —— 14×16 交点网格坐标系
    createBoard() {
        const gridCols = 12; // 交点列数
        const gridRows = 14; // 交点行数
        const topBarH = 90;
        const bottomBarH = 90;
        const padding = 15;

        // 可用区域
        const availW = this.w - padding * 2;
        const availH = this.h - topBarH - bottomBarH - padding * 2;
        const tileRatio = 51 / 76; // 宽/高

        // 动态计算牌尺寸：牌占据 3×3 互斥区域时覆盖 2 个交点间距
        // 相邻交点的像素距离 = 牌宽 / 2
        // 底层牌占偶数行偶数列，共 6 列(7行)的有效占用区
        // 有效区域 = (gridCols - 1) / 2 * tileSize（偶数列 × 牌宽）
        // 有效区域 = (gridRows - 1) / 2 * tileHeight（偶数行 × 牌高）
        const effCols = (gridCols) / 2; // 6 列底层牌列数
        const effRows = (gridRows) / 2; // 7 行底层牌行数
        const tileByW = availW / effCols;
        const tileByH = (availH / effRows) / tileRatio;
        const rawSize = Math.floor(Math.min(tileByW, tileByH));
        const tileSize = 54; // 固定牌宽（放大15%）
        const tileHeight = 79; // 固定牌高（放大15%）

        // 牌面整体居中
        // 底层偶数列跨度 = 10 * stepX（col 0 到 col 10，6列偶数）
        // 底层偶数行跨度 = 12 * stepY（row 0 到 row 12，7行偶数）
        const stepX = 48; // 横向间距42px（放大15%）
        const stepY = 68; // 纵向间距59px（放大15%）
        const boardW = 10 * stepX; // 牌面实际跨度
        const boardH = 12 * stepY;
        const startX = (this.w - boardW) / 2;
        const startY = topBarH + (this.h - topBarH - bottomBarH) / 2 - boardH / 2;

        this.tiles = [];
        this.shadowLayer = []; // 独立的阴影层

        // 初始化12×14交点网格，每个交点存 [layer0, layer1, layer2, layer3]
        this.boardGrid = Array.from({length: gridRows}, () =>
            Array.from({length: gridCols}, () => [null, null, null, null])
        );

        // 存储计算参数供后续使用
        this.boardParams = { gridCols, gridRows, tileSize, tileHeight, startX, startY, stepX, stepY, effCols, effRows };

        // 检查是否有定制关卡配置
        const levelConfig = this.loadLevelConfig(this.currentLevel);
        if (levelConfig) {
            this.generateLevelLayout(levelConfig);
        } else {
            this.generateRandomLayout();
        }
    }

    // 加载定制关卡配置
    loadLevelConfig(level) {
        // 优先从 localStorage 加载（自定义关卡）
        const key = `mahjongLevel_${level}`;
        const saved = localStorage.getItem(key);
        if (saved) {
            try {
                return JSON.parse(saved);
            } catch (e) {
                console.error('[游戏] 加载自定义关卡配置失败:', e);
            }
        }
        // 回退到预设关卡文件（通过 fetch 加载）
        return window.LEVELS ? window.LEVELS[level] || null : null;
    }

    // 根据定制配置生成关卡布局（基于 14×16 交点网格）
    generateLevelLayout(config) {
        const { tileSize, tileHeight, startX, startY, stepX, stepY } = this.boardParams;
        const tiles = config.tiles || [];

        // 为所有位置生成成对的牌面值
        const allPositions = tiles.map(t => `${t.layer}_${t.row}_${t.col}`);
        const pairCount = Math.floor(allPositions.length / 2);
        const types = [];
        for (let i = 0; i < pairCount; i++) {
            const type = Math.floor(Math.random() * 34);
            types.push(type, type);
        }
        for (let i = types.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [types[i], types[j]] = [types[j], types[i]];
        }

        let tileIdx = 0;
        const layerOffsetX = -10;
        const layerOffsetY = -10;

        const maxLayer = Math.max(...tiles.map(t => t.layer), 0);
        for (let layer = 0; layer <= maxLayer; layer++) {
            const layerTiles = tiles.filter(t => t.layer === layer).sort((a, b) => {
                if (a.row !== b.row) return a.row - b.row;
                return a.col - b.col;
            });

            layerTiles.forEach(t => {
                const type = types[tileIdx % types.length];
                // 坐标 = 交点坐标 × 步长 + 层偏移
                const x = startX + t.col * stepX + layer * layerOffsetX;
                const y = startY + t.row * stepY + layer * layerOffsetY;

                const container = this.add.container(x, y);
                const imgKey = `tile_${type % 34}`;
                const tileImg = this.add.image(0, 0, imgKey);
                const imgScale = Math.min(tileSize / 51, tileHeight / 76);
                tileImg.setScale(imgScale);
                const imgW = 51 * imgScale;
                const imgH = 76 * imgScale;

                if (t.faceDown) {
                    tileImg.setTexture('tile_00');
                }

                container.add(tileImg);
                container.setData('type', type);
                container.setData('matched', false);
                container.setData('tileW', tileSize);
                container.setData('tileH', tileHeight);
                container.setData('imgScale', imgScale);
                container.setData('layer', layer);
                // 存储该牌覆盖的下层牌位置（Layer 0 不覆盖任何下层，为空）
                // covered 用整数索引（用于 boardGrid 查找）
                const covered = [];
                if (layer > 0) {
                    for (let dr = -1; dr <= 1; dr++) {
                        for (let dc = -1; dc <= 1; dc++) {
                            const rr = Math.round(t.row) + dr;
                            const cc = Math.round(t.col) + dc;
                            if (rr >= 0 && rr <= 13 && cc >= 0 && cc <= 11) {
                                covered.push([rr, cc]);
                            }
                        }
                    }
                }
                container.setData('coveredPositions', covered);
                container.setData('tileRow', t.row);
                container.setData('tileCol', t.col);
                container.setData('isCovered', false);
                container.setData('isFree', true);
                container.setData('baseImgScale', imgScale);
                container.setData('isFaceDown', t.faceDown || false);
                container.setInteractive(new Phaser.Geom.Rectangle(-25.5 * imgScale * 2, -38 * imgScale * 2, 51 * imgScale * 2, 76 * imgScale * 2), Phaser.Geom.Rectangle.Contains, { useHandCursor: true });
                container.on('pointerdown', () => this.onTileClick(container));

                // 深度规则：右压左、下压上
                const defaultDepth = layer * 1000 + (t.row + t.col) * 10;
                container.setDepth(defaultDepth);
                container.setData('defaultDepth', defaultDepth);

                this.tiles.push(container);

                // 注册到 boardGrid（将 .5 坐标转为整数索引）
                const gridRow = Math.round(t.row);
                const gridCol = Math.round(t.col);
                if (layer >= 0 && layer <= 3 && gridRow >= 0 && gridRow <= 13 && gridCol >= 0 && gridCol <= 11) {
                    this.boardGrid[gridRow][gridCol][layer] = container;
                }

                const shadowImg = this.add.image(x, y, 'tile_shadow');
                shadowImg.setScale(imgScale);
                shadowImg.setDepth(layer * 1000 - 500);
                shadowImg.setData('origScale', imgScale);
                this.shadowLayer.push({ shadow: shadowImg, tile: container });

                tileIdx++;
            });
        }

        this.refreshCoveredState();
        this.totalPairs = this.tiles.length / 2;
        this.remainingPairs = this.totalPairs;
        this.recalculateAllFreeStatus();

        const animTypes = ['slideLeftRight', 'scaleBottomRight', 'scaleBottomLeft', 'scaleTopRight', 'scaleTopLeft', 'slideDown', 'slideUp'];
        const animType = animTypes[Math.floor(Math.random() * animTypes.length)];
        this.playEntryAnimation(animType, () => {
            this.recalculateAllFreeStatus();
        });
    }

    // 生成随机关卡布局（基于 12×14 交点网格，底层牌在偶数×偶数交点）
    generateRandomLayout() {
        const { tileSize, tileHeight, startX, startY, stepX, stepY } = this.boardParams;

        // Layer 0 底层牌：偶数行(0,2,...,12) × 偶数列(0,2,...,10)，共 7×6=42 个位置
        const layer0Positions = [];
        for (let r = 0; r <= 12; r += 2) {
            for (let c = 0; c <= 10; c += 2) {
                layer0Positions.push([r, c]);
            }
        }
        const totalTiles = layer0Positions.length; // 42

        // 第一层牌类型：先生成，保证偶数对（类型范围0-33，共34种牌）
        const layer1Types = [];
        for (let i = 0; i < totalTiles / 2; i++) {
            const type = i % 34; // 0-33循环
            layer1Types.push(type, type);
        }
        // 打乱第一层牌序
        for (let i = layer1Types.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [layer1Types[i], layer1Types[j]] = [layer1Types[j], layer1Types[i]];
        }

        layer0Positions.forEach((pos, idx) => {
            const [row, col] = pos;
            if (idx >= layer1Types.length) return;

            const type = layer1Types[idx];
            // 坐标 = 交点坐标 × 步长
            const x = startX + col * stepX;
            const y = startY + row * stepY;

            const container = this.add.container(x, y);

            // 麻将牌图片，等比缩放
            const imgKey = `tile_${type % 34}`;
            const tileImg = this.add.image(0, 0, imgKey);
            const imgScale = Math.min(tileSize / 51, tileHeight / 76);
            tileImg.setScale(imgScale);
            const imgW = 51 * imgScale;
            const imgH = 76 * imgScale;
            container.add(tileImg);

            container.setData('type', type);
            container.setData('matched', false);
            container.setData('tileW', tileSize);
            container.setData('tileH', tileHeight);
            container.setData('imgScale', imgScale);
            container.setData('layer', 0);
            container.setData('coveredPositions', []);
            container.setData('tileRow', row);
            container.setData('tileCol', col);
            container.setData('isCovered', false);
            container.setData('isFree', true);
            container.setData('baseImgScale', imgScale);

            // 暗扣标记（后续随机分配）
            container.setData('isFaceDown', false);

            container.setInteractive(new Phaser.Geom.Rectangle(-25.5 * imgScale * 2, -38 * imgScale * 2, 51 * imgScale * 2, 76 * imgScale * 2), Phaser.Geom.Rectangle.Contains, { useHandCursor: true });
            container.on('pointerdown', () => this.onTileClick(container));

            // 第一层：右压左、下压上
            const defaultDepth = (row + col) * 10;
            container.setDepth(defaultDepth);
            container.setData('defaultDepth', defaultDepth);

            this.tiles.push(container);
            // 注册到 boardGrid
            this.boardGrid[row][col][0] = container;

            // 创建独立阴影（第一层阴影在depth -1，在所有第一层牌之下）
            const shadowImg = this.add.image(x, y, 'tile_shadow');
            const shadowScale = Math.min(tileSize / 51, tileHeight / 76);
            shadowImg.setScale(shadowScale);
            shadowImg.setDepth(-5000);
            shadowImg.setData('origScale', shadowScale);
            this.shadowLayer.push({ shadow: shadowImg, tile: container });
        });

        // 生成并渲染上层牌（Layer 1~3）
        const maxLayer = 3;
        for (let layerIndex = 1; layerIndex <= maxLayer; layerIndex++) {
            const layerPlan = this.generateLayerN(layerIndex);
            if (layerPlan.length === 0) continue;

            // 生成该层牌面类型（偶数张）
            const layerCount = layerPlan.length;
            const layerTypes = [];
            for (let i = 0; i < layerCount / 2; i++) {
                const type = Math.floor(Math.random() * 34);
                layerTypes.push(type, type);
            }
            if (layerCount % 2 !== 0) {
                layerTypes.pop();
            }

            // 层间偏移
            const layerOffsetX = -10;
            const layerOffsetY = -10;

            layerPlan.forEach((item, idx) => {
                // 坐标 = 交点坐标 × 步长 + 层偏移
                const x = startX + item.col * stepX + layerOffsetX;
                const y = startY + item.row * stepY + layerOffsetY;

                const container = this.add.container(x, y);

                const type = layerTypes[idx];
                const imgKey = `tile_${type % 34}`;
                const tileImg = this.add.image(0, 0, imgKey);
                const imgScale = Math.min(tileSize / 51, tileHeight / 76);
                tileImg.setScale(imgScale);
                const imgW = 51 * imgScale;
                const imgH = 76 * imgScale;
                container.add(tileImg);

                container.setData('type', type);
                container.setData('matched', false);
                container.setData('tileW', tileSize);
                container.setData('tileH', tileHeight);
                container.setData('imgScale', imgScale);
                container.setData('layer', layerIndex);
                // 存储牌覆盖的 3×3 互斥区内的下层牌
                const covered = [];
                for (let dr = -1; dr <= 1; dr++) {
                    for (let dc = -1; dc <= 1; dc++) {
                        const rr = item.row + dr;
                        const cc = item.col + dc;
                        if (rr >= 0 && rr <= 13 && cc >= 0 && cc <= 11) {
                            covered.push([rr, cc]);
                        }
                    }
                }
                container.setData('coveredPositions', covered);
                container.setData('tileRow', item.row);
                container.setData('tileCol', item.col);
                container.setData('isCovered', false);
                container.setData('isFree', true);
                container.setData('baseImgScale', imgScale);

                container.setInteractive(new Phaser.Geom.Rectangle(-25.5 * imgScale * 2, -38 * imgScale * 2, 51 * imgScale * 2, 76 * imgScale * 2), Phaser.Geom.Rectangle.Contains, { useHandCursor: true });
                container.on('pointerdown', () => this.onTileClick(container));

                // 层深度：根据层级设置基础深度
                const baseDepth = layerIndex * 1000;
                const defaultDepth = baseDepth + (item.row + item.col) * 10;
                container.setDepth(defaultDepth);
                container.setData('defaultDepth', defaultDepth);

                this.tiles.push(container);
                // 注册到 boardGrid
                if (!this.boardGrid[item.row][item.col]) {
                    this.boardGrid[item.row][item.col] = [null, null, null, null];
                }
                this.boardGrid[item.row][item.col][layerIndex] = container;

                // 创建独立阴影
                const shadowImg = this.add.image(x, y, 'tile_shadow');
                const shadowScale = Math.min(tileSize / 51, tileHeight / 76);
                shadowImg.setScale(shadowScale);
                shadowImg.setDepth(baseDepth - 1);
                shadowImg.setData('origScale', shadowScale);
                this.shadowLayer.push({ shadow: shadowImg, tile: container });

                // 标记被覆盖的下层牌
                covered.forEach(([r, c]) => {
                    if (r < 0 || r > 13 || c < 0 || c > 15) return;
                    const lowerTile = this.boardGrid[r][c][layerIndex - 1];
                    if (lowerTile) {
                        lowerTile.setData('isCovered', true);
                        lowerTile.setData('isFree', false);
                        lowerTile.disableInteractive();
                    }
                });
            });
        }

        // 更新总对数（确保偶数）
        if (this.tiles.length % 2 !== 0) {
            // 找到一张上层牌移除
            let lastTile = this.tiles.filter(t => t.getData('layer') >= 1).pop();
            if (!lastTile) lastTile = this.tiles[this.tiles.length - 1];

            // 清理被移除牌覆盖的下层牌状态
            const covered = lastTile.getData('coveredPositions');
            const removedLayer = lastTile.getData('layer');
            if (covered && removedLayer > 0) {
                covered.forEach(([r, c]) => {
                    const lowerTile = this.boardGrid[r][c][removedLayer - 1];
                    if (lowerTile) {
                        lowerTile.setData('isCovered', false);
                        lowerTile.setData('isFree', true);
                        lowerTile.setInteractive({ useHandCursor: true });
                    }
                });
            }
            // 清理 boardGrid 引用（用 tileRow/tileCol 而非 layer）
            const tr = Math.round(lastTile.getData('tileRow'));
            const tc = Math.round(lastTile.getData('tileCol'));
            const layer = lastTile.getData('layer');
            if (tr !== undefined && tc !== undefined && layer !== undefined) {
                this.boardGrid[tr][tc][layer] = null;
            }
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

        // 随机分配暗扣牌（保证偶数张，以便配对消除）
        this.assignFaceDownTiles();

        // 入场动画：随机选择一种动画，完成后才初始化自由状态和启用交互
        const animTypes = ['slideLeftRight', 'scaleBottomRight', 'scaleBottomLeft', 'scaleTopRight', 'scaleTopLeft', 'slideDown', 'slideUp'];
        const animType = animTypes[Math.floor(Math.random() * animTypes.length)];

        this.playEntryAnimation(animType, () => {
            this.recalculateAllFreeStatus();
        });
    }

    // 随机分配暗扣牌
    assignFaceDownTiles() {
        // 随机数量：总牌数的 1/6 到 1/3，保证偶数
        const minCount = Math.floor(this.tiles.length / 6);
        const maxCount = Math.floor(this.tiles.length / 3);
        let faceDownCount = minCount + Math.floor(Math.random() * (maxCount - minCount + 1));
        if (faceDownCount % 2 !== 0) faceDownCount++; // 保证偶数

        // 随机选择牌设为暗扣
        const shuffled = [...this.tiles].sort(() => Math.random() - 0.5);
        const faceDownTiles = shuffled.slice(0, faceDownCount);

        faceDownTiles.forEach(tile => {
            tile.setData('isFaceDown', true);
            const tileImg = tile.list[0];
            if (tileImg) {
                tileImg.setTexture('tile_00');
            }
        });
    }

    // 入场动画统一入口
    playEntryAnimation(type, onComplete) {
        // 播放开局音效
        this.sound.play('sfx-start');

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
            const row = tile.getData('tileRow');
            const col = tile.getData('tileCol');
            return { tile, row, col, origX: tile.x, origY: tile.y };
        });

        let maxEndTime = 0;

        allEntries.forEach(entry => {
            const { tile, row, col, origX } = entry;

            const fromLeft = col % 2 === 0;
            const animStartX = fromLeft ? -offscreenX : this.w + offscreenX;
            const overshootX = fromLeft ? origX + bounceDist : origX - bounceDist;

            const delay = row * rowDelay;
            const endTime = delay + duration + 80;
            if (endTime > maxEndTime) maxEndTime = endTime;

            tile.x = animStartX;

            const shadowEntry = this.shadowLayer.find(s => s.tile === tile);
            if (shadowEntry) {
                shadowEntry.shadow.x = animStartX;
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
            case 'scaleBottomRight': cornerRow = 13; cornerCol = 15; break;
            case 'scaleBottomLeft':  cornerRow = 13; cornerCol = 0; break;
            case 'scaleTopRight':    cornerRow = 0; cornerCol = 15; break;
            case 'scaleTopLeft':     cornerRow = 0; cornerCol = 0; break;
        }

        let maxEndTime = 0;

        this.tiles.forEach(tile => {
            const row = tile.getData('tileRow');
            const col = tile.getData('tileCol');
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
            // 动画延时用 14×16 网格 row 值，不再取 coveredPositions
            const row = tile.getData('tileRow');
            return { tile, row, origX: tile.x, origY: tile.y };
        });

        let maxEndTime = 0;

        allEntries.forEach(entry => {
            const { tile, row, origY } = entry;

            // 从上到下：从屏幕上方飞入；从下到上：从屏幕下方飞入
            const fromTop = type === 'slideDown';
            const startAnimY = fromTop ? -offscreenY : this.h + offscreenY;
            const overshootY = fromTop ? origY + bounceDist : origY - bounceDist;

            const delay = row * rowDelay;
            const endTime = delay + duration + 80;
            if (endTime > maxEndTime) maxEndTime = endTime;

            tile.y = startAnimY;

            const shadowEntry = this.shadowLayer.find(s => s.tile === tile);
            if (shadowEntry) {
                shadowEntry.shadow.y = startAnimY;
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
    // 注意：点击选中时暗扣牌已经翻正，这里直接执行碰撞动画
    animateCollision(tileA, tileB, onComplete) {
        this._runCollisionAnimation(tileA, tileB, onComplete);
    }

    // 翻正暗扣牌（水平翻转动画，翻完后执行回调）
    flipFaceUp(tile, onComplete) {
        tile.setData('isFaceDown', false);
        const tileImg = tile.list[0];
        const baseScale = tile.getData('imgScale');
        const faceTexture = `tile_${tile.getData('type') % 34}`;

        this.tweens.add({
            targets: tileImg,
            scaleX: 0,
            duration: 120,
            ease: 'Sine.easeIn',
            onComplete: () => {
                tileImg.setTexture(faceTexture);
                this.tweens.add({
                    targets: tileImg,
                    scaleX: baseScale,
                    duration: 120,
                    ease: 'Sine.easeOut',
                    onComplete: () => {
                        if (onComplete) onComplete();
                    }
                });
            }
        });
    }

    // 实际碰撞动画（翻正后调用）
    _runCollisionAnimation(tileA, tileB, onComplete) {
        const ax = tileA.x;
        const ay = tileA.y;
        const bx = tileB.x;
        const by = tileB.y;

        // 碰撞点：两牌连线中点
        const cx = (ax + bx) / 2;
        const cy = (ay + by) / 2;

        // 判断左右关系：x小的在左，偏移负；x大的在右，偏移正
        const tileW = tileA.getData('tileW');
        const halfTile = tileW / 2;
        const maxOffset = 200;
        // 向左偏移不能超过左边缘，向右偏移不能超过右边缘
        const leftOffset = Math.min(maxOffset, cx - halfTile);
        const rightOffset = Math.min(maxOffset, this.w - cx - halfTile);
        const aIsLeft = ax <= bx;
        const aOffX = aIsLeft ? -leftOffset : rightOffset;
        const bOffX = aIsLeft ? rightOffset : -leftOffset;

        // 起飞目标位置（碰撞点两侧）
        const aFlyX = cx + aOffX;
        const aFlyY = cy;
        const bFlyX = cx + bOffX;
        const bFlyY = cy;

        // 牌的尺寸（用于计算接触点）
        // tileW 已在上面声明

        // 确保在最上层
        tileA.setDepth(5500);
        tileB.setDepth(5500);
        const seA = this.shadowLayer.find(s => s.tile === tileA);
        const seB = this.shadowLayer.find(s => s.tile === tileB);
        if (seA) seA.shadow.setDepth(5499);
        if (seB) seB.shadow.setDepth(5499);

        // 碰撞前将两张牌的图片和阴影都恢复到正常缩放（取消选中放大效果）
        [tileA, tileB].forEach(t => {
            const img = t.list[0];
            if (img) {
                const baseScale = t.getData('imgScale');
                img.setScale(baseScale);
            }
        });
        [seA, seB].forEach(entry => {
            if (entry && entry.shadow) {
                const origScale = entry.shadow.getData('origScale');
                entry.shadow.setScale(origScale);
            }
        });

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
                        // 阶段3：缩小消失（300ms，Sine.easeIn）+ 碰撞音效
                        this.sound.play('sfx-collision');
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
        // 随机播放点击音效（01~03）
        this.sound.play(`sfx-click0${Math.floor(Math.random() * 3) + 1}`);

        const tileImg = tile.list[0];
        const isFaceDown = tile.getData('isFaceDown');
        const shadowEntry = this.shadowLayer.find(s => s.tile === tile);
        const shadowImg = shadowEntry ? shadowEntry.shadow : null;

        if (tileImg) {
            tileImg.setOrigin(0.5);

            if (isFaceDown) {
                // 暗扣牌：先水平缩小到0，换正面图，再水平放大
                const faceTexture = `tile_${tile.getData('type') % 34}`;
                const targetScale = tile.getData('baseImgScale') * 1.15;

                // 第一阶段：水平缩小到0
                this.tweens.add({
                    targets: tileImg,
                    scaleX: 0,
                    duration: 120,
                    ease: 'Sine.easeIn',
                    onComplete: () => {
                        // 换正面图
                        tileImg.setTexture(faceTexture);
                        // 第二阶段：水平放大到目标
                        this.tweens.add({
                            targets: tileImg,
                            scaleX: targetScale,
                            duration: 120,
                            ease: 'Sine.easeOut'
                        });
                    }
                });
                // 垂直缩放正常放大
                this.tweens.add({
                    targets: tileImg,
                    scaleY: targetScale,
                    duration: 240,
                    ease: 'Sine.easeInOut'
                });

                // 阴影同步水平翻转
                if (shadowImg) {
                    shadowImg.setOrigin(0.5);
                    const shadowBaseScale = shadowImg.getData('origScale');
                    const shadowTarget = shadowBaseScale * 1.15;

                    this.tweens.add({
                        targets: shadowImg,
                        scaleX: 0,
                        duration: 120,
                        ease: 'Sine.easeIn',
                        onComplete: () => {
                            this.tweens.add({
                                targets: shadowImg,
                                scaleX: shadowTarget,
                                duration: 120,
                                ease: 'Sine.easeOut'
                            });
                        }
                    });
                    this.tweens.add({
                        targets: shadowImg,
                        scaleY: shadowTarget,
                        duration: 240,
                        ease: 'Sine.easeInOut'
                    });
                }

                // 暗扣牌翻正后加绿色tint（提示牌保持黄色）
                if (tileImg.setTint) {
                    if (tile.getData('hintTint')) {
                        tileImg.setTint(0xf1c40f);
                    } else {
                        tileImg.setTint(0x90ee90);
                    }
                }
            } else {
                // 普通牌：正常放大
                const targetScale = tile.getData('baseImgScale') * 1.15;
                this.tweens.add({
                    targets: tileImg,
                    scaleX: targetScale,
                    scaleY: targetScale,
                    duration: 150,
                    ease: 'Sine.easeInOut'
                });

                // 提示牌选中时变绿色，否则加绿色tint
                if (tileImg.setTint) {
                    tileImg.setTint(0x90ee90);
                }
            }
        }
        tile.setDepth(5000);
        if (shadowEntry) {
            shadowEntry.shadow.setDepth(4999);
        }

        // 提示牌选中时不停止摇晃，保持摇晃
    }

    // 取消选中牌的动画效果（缓入缓出缩小）
    animateDeselectTile(tile) {
        // 播放放下音效
        this.sound.play('sfx-putdown');

        const tileImg = tile.list[0];
        const isFaceDown = tile.getData('isFaceDown');
        const shadowEntry = this.shadowLayer.find(s => s.tile === tile);
        const shadowImg = shadowEntry ? shadowEntry.shadow : null;

        if (tileImg) {
            tileImg.setOrigin(0.5);

            if (isFaceDown) {
                // 暗扣牌：水平缩小到0，换回00背图，再水平放大
                const targetScale = tile.getData('imgScale');

                this.tweens.add({
                    targets: tileImg,
                    scaleX: 0,
                    duration: 120,
                    ease: 'Sine.easeIn',
                    onComplete: () => {
                        tileImg.setTexture('tile_00');
                        this.tweens.add({
                            targets: tileImg,
                            scaleX: targetScale,
                            duration: 120,
                            ease: 'Sine.easeOut'
                        });
                    }
                });
                this.tweens.add({
                    targets: tileImg,
                    scaleY: targetScale,
                    duration: 240,
                    ease: 'Sine.easeInOut'
                });

                // 阴影同步水平翻转回原始
                if (shadowImg) {
                    shadowImg.setOrigin(0.5);
                    const shadowBaseScale = shadowImg.getData('origScale');

                    this.tweens.add({
                        targets: shadowImg,
                        scaleX: 0,
                        duration: 120,
                        ease: 'Sine.easeIn',
                        onComplete: () => {
                            this.tweens.add({
                                targets: shadowImg,
                                scaleX: shadowBaseScale,
                                duration: 120,
                                ease: 'Sine.easeOut'
                            });
                        }
                    });
                    this.tweens.add({
                        targets: shadowImg,
                        scaleY: shadowBaseScale,
                        duration: 240,
                        ease: 'Sine.easeInOut'
                    });
                }
            } else {
                // 普通牌：正常缩小
                const targetScale = tile.getData('imgScale');
                this.tweens.add({
                    targets: tileImg,
                    scaleX: targetScale,
                    scaleY: targetScale,
                    duration: 150,
                    ease: 'Sine.easeInOut'
                });
            }

            // 恢复 tint：暗扣牌清除绿色tint，锁定牌灰色，提示牌黄色，自由牌清除
            if (isFaceDown) {
                tileImg.clearTint();
            } else if (!tile.getData('isFree')) {
                tileImg.setTint(0x999999);
            } else if (tile.getData('hintTint')) {
                tileImg.setTint(0xf1c40f);
            } else {
                tileImg.clearTint();
            }
        }
        tile.setDepth(tile.getData('defaultDepth'));

        // 阴影恢复该层的阴影层
        if (shadowEntry) {
            const layer = tile.getData('layer');
            shadowEntry.shadow.setDepth(layer === 0 ? -1 : 999);
        }

        // 提示牌取消选中时恢复摇晃
        if (tile.getData('hintTint')) {
            this.startHintSwing(tile);
        }
    }

    // 点击锁定牌时抖动效果
    shakeLockedTile(tile) {
        const tilesToShake = [tile];
        const layer = tile.getData('layer');
        const row = tile.getData('tileRow');
        const col = tile.getData('tileCol');
        let leftNeighbor = null;
        let rightNeighbor = null;

        // 检查是否被左右夹住锁定
        const leftBlocked = this.hasSideNeighbor(tile, 'left');
        const rightBlocked = this.hasSideNeighbor(tile, 'right');

        if (leftBlocked && rightBlocked) {
            // 左右都被挡住 → 找左右两侧的牌一起抖动
            const allTiles = this.tiles.filter(t => !t.getData('matched') && t.getData('layer') === layer);
            for (const other of allTiles) {
                if (other === tile) continue;
                const otherRow = other.getData('tileRow');
                const otherCol = other.getData('tileCol');
                if (col - otherCol === 2 && Math.abs(row - otherRow) <= 1) {
                    tilesToShake.push(other); // left neighbor
                    leftNeighbor = other;
                }
                if (otherCol - col === 2 && Math.abs(row - otherRow) <= 1) {
                    tilesToShake.push(other); // right neighbor
                    rightNeighbor = other;
                }
            }
        } else if (tile.getData('isCovered')) {
            // 被压住锁定 → 找压住它的上层牌一起抖动
            for (const other of this.tiles) {
                if (other.getData('matched')) continue;
                if (other.getData('layer') !== layer + 1) continue;
                const otherRow = other.getData('tileRow');
                const otherCol = other.getData('tileCol');
                if (Math.abs(row - otherRow) <= 1 && Math.abs(col - otherCol) <= 1) {
                    tilesToShake.push(other);
                }
            }
        }

        // 执行抖动动画（左右弹性抖动，持续500ms）
        tilesToShake.forEach(t => {
            const tileImg = t.list[0];
            if (!tileImg) return;

            const shadowEntry = this.shadowLayer.find(s => s.tile === t);
            const shadowImg = shadowEntry ? shadowEntry.shadow : null;

            // 抖动序列：-6° → 6° → -6° → 6° → 0°
            const seq = [
                { angle: -6, duration: 80, ease: 'Sine.easeOut' },
                { angle: 6, duration: 80, ease: 'Sine.easeInOut' },
                { angle: -6, duration: 80, ease: 'Sine.easeInOut' },
                { angle: 6, duration: 80, ease: 'Sine.easeInOut' },
                { angle: 0, duration: 80, ease: 'Sine.easeIn' }
            ];

            let totalDelay = 0;
            seq.forEach(step => {
                this.tweens.add({
                    targets: tileImg,
                    angle: step.angle,
                    duration: step.duration,
                    ease: step.ease,
                    delay: totalDelay
                });
                if (shadowImg) {
                    this.tweens.add({
                        targets: shadowImg,
                        angle: step.angle,
                        duration: step.duration,
                        ease: step.ease,
                        delay: totalDelay
                    });
                }
                totalDelay += step.duration;
            });
        });

        // 如果是被压住锁定，显示气泡提示
        if (tile.getData('isCovered')) {
            const tileImg = tile.list[0];
            if (tileImg) {
                // 气泡背景
                const bubbleWidth = 280;
                const bubbleHeight = 60;
                const bubbleX = tileImg.x;
                const bubbleY = tileImg.y - 70;

                const bubbleBg = this.add.graphics();
                bubbleBg.fillStyle(0x000000, 0.85);
                bubbleBg.fillRoundedRect(
                    bubbleX - bubbleWidth / 2,
                    bubbleY - bubbleHeight / 2,
                    bubbleWidth,
                    bubbleHeight,
                    12
                );
                bubbleBg.setDepth(9999);

                // 气泡文字
                const bubbleText = this.add.text(bubbleX, bubbleY, '需要移除上面的牌', {
                    fontSize: '24px',
                    color: '#ffffff',
                    fontFamily: 'Arial, sans-serif'
                }).setOrigin(0.5).setDepth(9999);

                // 1.5秒后气泡消失
                this.time.delayedCall(1500, () => {
                    this.tweens.add({
                        targets: [bubbleBg, bubbleText],
                        alpha: 0,
                        scaleX: 0.8,
                        scaleY: 0.8,
                        duration: 300,
                        ease: 'Sine.easeIn',
                        onComplete: () => {
                            bubbleBg.destroy();
                            bubbleText.destroy();
                        }
                    });
                });
            }
        }

        // 如果是左右夹住锁定，显示红色叉叉在点位左右各一张牌宽度位置
        if (leftBlocked && rightBlocked) {
            const imgScale = tile.getData('imgScale') || 0.8;
            const tileWidth = 47 * imgScale;
            const layer = tile.getData('layer');

            // 获取牌的点位（container位置，即交点坐标）
            const pointX = tile.x;
            const pointY = tile.y;

            // 点位左偏移一张牌，点位右偏移一张牌
            const leftCrossX = pointX - tileWidth;
            const rightCrossX = pointX + tileWidth;

            // 创建红色叉叉图标（左右各一个），作为独立元素，层级设为当前层最高
            // 缩小20%：原为 imgScale * 0.6 * 6 = imgScale * 3.6，缩小20% = imgScale * 2.88
            const crossImages = [];
            [leftCrossX, rightCrossX].forEach((crossX) => {
                const crossImg = this.add.image(crossX, pointY, 'red_cross');
                crossImg.setScale(imgScale * 2.88); // 缩小20%后的大小
                crossImg.setDepth(layer * 1000 + 999); // 本层最高
                crossImg.setAngle(0);
                crossImages.push(crossImg);

                // 500ms后开始缩小消失
                this.time.delayedCall(500, () => {
                    this.tweens.add({
                        targets: crossImg,
                        scaleX: 0,
                        scaleY: 0,
                        alpha: 0,
                        duration: 300,
                        ease: 'Sine.easeIn',
                        onComplete: () => crossImg.destroy()
                    });
                });
            });

            // 让叉跟随抖动（与牌面图tile.list[0]保持相同的角度动画）
            const tileImg = tile.list[0];
            const seq = [
                { angle: -6, duration: 80, ease: 'Sine.easeOut' },
                { angle: 6, duration: 80, ease: 'Sine.easeInOut' },
                { angle: -6, duration: 80, ease: 'Sine.easeInOut' },
                { angle: 6, duration: 80, ease: 'Sine.easeInOut' },
                { angle: 0, duration: 80, ease: 'Sine.easeIn' }
            ];
            let totalDelay = 0;
            seq.forEach(step => {
                // 牌的图片抖动
                this.tweens.add({
                    targets: tileImg,
                    angle: step.angle,
                    duration: step.duration,
                    ease: step.ease,
                    delay: totalDelay
                });
                // 叉也抖动同样的角度
                crossImages.forEach(crossImg => {
                    this.tweens.add({
                        targets: crossImg,
                        angle: step.angle,
                        duration: step.duration,
                        ease: step.ease,
                        delay: totalDelay
                    });
                });
                totalDelay += step.duration;
            });
        }


        // 播放音效
        this.sound.play('sfx-click01');
    }

    onTileClick(tile) {
        if (this.isProcessing) return;
        if (tile.getData('matched')) return;

        // 自由牌检查：被锁定的牌不可选中，但打断连击并抖动
        if (!this.isTileFree(tile)) {
            this.combo = 0;
            this.shakeLockedTile(tile);
            return;
        }

        const now = Date.now();
        const QUICK_CLICK_THRESHOLD = 150; // 150ms内快速连点

        // 检查是否快速连点匹配（直接消除，跳过选中动画）
        if (this.lastClickTile && this.lastClickTile !== tile) {
            const timeDiff = now - this.lastClickTime;
            if (timeDiff <= QUICK_CLICK_THRESHOLD &&
                this.lastClickTile.getData('type') === tile.getData('type') &&
                !this.lastClickTile.getData('matched')) {
                // 快速连点匹配，直接消除
                const firstTile = this.lastClickTile; // 先保存引用
                this.isProcessing = true;
                this.lastClickTile = null;
                this.lastClickTime = 0;

                // 清除提示状态
                this.stopHintSwing(firstTile);
                this.stopHintSwing(tile);

                // 直接执行碰撞消除
                this.animateCollision(firstTile, tile, () => {
                    firstTile.setData('matched', true);
                    tile.setData('matched', true);

                    if (this.hintTiles.includes(firstTile) || this.hintTiles.includes(tile)) {
                        this.clearHint();
                    }

                    if (firstTile.getData('layer') > 0 || tile.getData('layer') > 0) {
                        this.refreshCoveredState();
                    }

                    this.matchedPairs++;
                    this.score += 200;
                    this.combo++;
                    if (this.combo > this.maxCombo) {
                        this.maxCombo = this.combo;
                    }
                    this.scoreText.setText(`${this.score}`);

                    this.isProcessing = false;
                    this.recalculateAllFreeStatus();

                    if (this.remainingPairs === 0) {
                        this.smartShuffle();
                    }

                    const remaining = this.tiles.filter(t => !t.getData('matched'));
                    if (remaining.length === 0) {
                        this.time.delayedCall(500, () => this.levelComplete());
                    }
                });
                return;
            }
        }

        // 记录本次点击
        this.lastClickTile = tile;
        this.lastClickTime = now;

        // 再次点击已选中的牌 → 取消选中
        if (this.selectedTiles.includes(tile)) {
            this.animateDeselectTile(tile);
            this.selectedTiles = this.selectedTiles.filter(t => t !== tile);
            this.lastClickTile = null; // 清除快速连点记录
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

                // 等待翻转动画完成（暗扣牌240ms，普通牌即时）后再执行消除
                const delay = tile.getData('isFaceDown') ? 250 : 50;
                this.time.delayedCall(delay, () => {
                    // 清除两张牌的绿色选中效果（提示牌保持黄色）
                    const clearGreen = (t) => {
                        const img = t.list[0];
                        if (img && img.clearTint) {
                            img.clearTint();
                            if (t.getData('hintTint')) {
                                img.setTint(0xf1c40f);
                            }
                        }
                    };
                    clearGreen(selectedTile);
                    clearGreen(tile);

                    // 碰撞前清除提示状态（黄色+摇晃）
                    this.stopHintSwing(selectedTile);
                    this.stopHintSwing(tile);
                    [selectedTile, tile].forEach(t => {
                        t.setData('hintTint', false);
                        const img = t.list[0];
                        if (img && img.clearTint) {
                            img.clearTint();
                        }
                    });
                    // 重置角度防止摇晃残留
                    selectedTile.list[0].setAngle(0);
                    tile.list[0].setAngle(0);

                    // 碰撞消除动画，动画结束后执行消除逻辑
                    this.animateCollision(selectedTile, tile, () => {
                        selectedTile.setData('matched', true);
                        tile.setData('matched', true);

                        if (this.hintTiles.includes(selectedTile) || this.hintTiles.includes(tile)) {
                            this.clearHint();
                        }

                        // 如果消除的是上层牌，刷新第一层覆盖状态
                        if (selectedTile.getData('layer') > 0 || tile.getData('layer') > 0) {
                            this.refreshCoveredState();
                        }

                        this.matchedPairs++;
                        this.score += 200;
                        this.combo++;
                        if (this.combo > this.maxCombo) {
                            this.maxCombo = this.combo;
                        }
                        this.scoreText.setText(`${this.score}`);

                        this.selectedTiles = [];
                        this.isProcessing = false;

                        // 重新计算所有牌的自由状态
                        this.recalculateAllFreeStatus();

                        // 消除后检查匹配数是否为0，为0则自动洗牌
                        if (this.remainingPairs === 0) {
                            this.smartShuffle();
                        }

                        // 检查是否通关
                        const remaining = this.tiles.filter(t => !t.getData('matched'));
                        if (remaining.length === 0) {
                            this.time.delayedCall(500, () => this.levelComplete());
                        }
                    });
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
        // 暗扣牌恢复背面
        if (tile.getData('isFaceDown')) {
            const tileImg = tile.list[0];
            if (tileImg && tileImg.setTexture) {
                tileImg.setTexture('tile_00');
            }
        }
        // 恢复锁定蒙版（如果被锁定）
        if (!tile.getData('isFree')) {
            const tileImg = tile.list[0];
            if (tileImg && tileImg.setTint) {
                tileImg.setTint(0x999999);
            }
        }
    }

    levelComplete() {
        this.sound.play('sfx-levelComplete');
        const nextLevel = this.currentLevel + 1;
        localStorage.setItem('mahjongLevel', nextLevel.toString());
        const elapsedTime = Math.floor((Date.now() - this.startTime) / 1000);

        this.scene.start('ResultsScene', {
            level: this.currentLevel,
            completed: true,
            score: this.score,
            maxCombo: this.maxCombo,
            elapsedTime: elapsedTime
        });
    }

    // 获取洗牌后的牌面类型，保证每种类型成对出现
    getShuffledTypesForLayer2(unmatchedTiles) {
        // 收集所有类型
        const allTypes = unmatchedTiles.map(t => t.getData('type'));

        // 确保总数为偶数（如果奇数则移除一张第二层牌）
        if (allTypes.length % 2 !== 0) {
            const layer2Tiles = unmatchedTiles.filter(t => t.getData('layer') >= 1);
            if (layer2Tiles.length > 0) {
                const lastL2 = layer2Tiles[layer2Tiles.length - 1];
                const idx = unmatchedTiles.indexOf(lastL2);
                if (idx !== -1) {
                    unmatchedTiles.splice(idx, 1);
                    allTypes.pop();
                    // 解锁被移除牌覆盖的位置
                    const covered = lastL2.getData('coveredPositions');
                    const removedLayer = lastL2.getData('layer');
                    if (covered && removedLayer > 0) {
                        covered.forEach(([r, c]) => {
                            const tile = this.boardGrid[r][c][removedLayer - 1];
                            if (tile) {
                                tile.setData('isCovered', false);
                                tile.setData('isFree', true);
                                tile.setInteractive({ useHandCursor: true });
                            }
                        });
                    }
                    // 清理 boardGrid 引用（需要取整）
                    const tr = Math.round(lastL2.getData('tileRow'));
                    const tc = Math.round(lastL2.getData('tileCol'));
                    if (tr !== undefined && tc !== undefined) {
                        this.boardGrid[tr][tc][lastL2.getData('layer')] = null;
                    }
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

    // 检查当前自由牌中是否有可配对的（至少1对）
    hasFreePairs() {
        const freeTiles = this.tiles.filter(t => !t.getData('matched') && this.isTileFree(t));
        const typeCounts = {};
        freeTiles.forEach(t => {
            const type = t.getData('type');
            typeCounts[type] = (typeCounts[type] || 0) + 1;
        });
        const pairs = Object.values(typeCounts).reduce((acc, count) => acc + Math.floor(count / 2), 0);
        return pairs >= 1; // 洗牌后必须保证至少1对自由牌
    }

    // 智能洗牌：带动画版本，被外部调用（消除后无配对、提示无配对）
    smartShuffle() {
        this.animateShuffleBoard(() => this.doSmartShuffleLogic());
    }

    // 智能洗牌纯逻辑：50次尝试，维持牌的种类和数量，只调换位置，保证至少一对自由牌可配对
    doSmartShuffleLogic() {
        const maxAttempts = 50;
        for (let attempt = 0; attempt < maxAttempts; attempt++) {
            const unmatchedTiles = this.tiles.filter(t => !t.getData('matched'));

            // 收集当前所有牌的牌面类型（保持种类和数量不变）
            const types = unmatchedTiles.map(t => t.getData('type'));
            // 打乱牌面类型顺序
            for (let i = types.length - 1; i > 0; i--) {
                const j = Math.floor(Math.random() * (i + 1));
                [types[i], types[j]] = [types[j], types[i]];
            }

            // 重新分配牌面类型
            unmatchedTiles.forEach((tile, i) => {
                tile.setData('type', types[i]);
                const tileImg = tile.list[0];
                if (tileImg && tileImg.setTexture) {
                    // 暗扣牌洗牌后保持背面，否则更新正面
                    if (!tile.getData('isFaceDown')) {
                        tileImg.setTexture(`tile_${types[i] % 34}`);
                    }
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

    // 调试：切换 14×16 交点网格辅助线
    toggleDebugGrid() {
        if (this.debugGridGraphics) {
            const texts = this.debugGridGraphics.getData('debugTexts');
            if (texts) texts.forEach(t => t.destroy());
            this.debugGridGraphics.destroy();
            this.debugGridGraphics = null;
            return;
        }

        const { startX, startY, stepX, stepY, effCols, effRows } = this.boardParams;
        const g = this.add.graphics();
        g.setDepth(99999);
        const debugTexts = [];

        // 画棋盘边框（底层牌占用区域：从 (0,0) 到 ((effRows-1)*2, (effCols-1)*2) 的交点范围）
        const lastBaseRow = (effRows - 1) * 2; // 12
        const lastBaseCol = (effCols - 1) * 2; // 10
        const boardX1 = startX - stepX * 0.5;
        const boardY1 = startY - stepY * 0.5;
        const boardX2 = startX + lastBaseCol * stepX + stepX * 0.5;
        const boardY2 = startY + lastBaseRow * stepY + stepY * 0.5;
        g.lineStyle(1, 0xffffff, 0.3);
        g.strokeRect(boardX1, boardY1, boardX2 - boardX1, boardY2 - boardY1);

        // 画所有 12×14 交点
        for (let r = 0; r <= 13; r++) {
            for (let c = 0; c <= 11; c++) {
                const x = startX + c * stepX;
                const y = startY + r * stepY;

                // 偶数×偶数交点（底层牌位置）用绿色，其他用灰色
                const isBase = (r % 2 === 0 && c % 2 === 0);
                const color = isBase ? 0x00ff00 : 0x888888;
                const radius = isBase ? 4 : 2;

                g.fillStyle(color, 0.8);
                g.fillCircle(x, y, radius);

                // 标注坐标
                const txt = this.add.text(x, y - 8, `${r},${c}`, {
                    fontSize: '8px',
                    color: isBase ? '#00ff00' : '#888888'
                }).setOrigin(0.5).setDepth(99999);
                debugTexts.push(txt);
            }
        }

        this.debugGridGraphics = g;
        g.setData('debugTexts', debugTexts);
    }

    // 场景关闭时清理
    shutdown() {
        this.disableMultiTouch();
    }
}