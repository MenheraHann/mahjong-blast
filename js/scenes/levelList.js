// levelList.js - 关卡选择列表场景

class LevelListScene extends Phaser.Scene {
    constructor() {
        super({ key: 'LevelListScene' });
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

        // 顶部栏背景
        this.add.rectangle(0, 0, w, 90, 0x2c3e50).setOrigin(0);

        // 返回按钮
        const backBtn = this.add.image(30, 45, 'icon-back').setScale(1.2).setInteractive({ useHandCursor: true });
        backBtn.on('pointerdown', () => {
            this.sound.play('sfx-button');
            this.scene.start('HomeScene');
        });

        // 标题
        this.add.text(w / 2, 45, '选择关卡', {
            fontSize: '36px',
            color: '#ffffff',
            fontFamily: 'Arial, sans-serif',
            fontStyle: 'bold'
        }).setOrigin(0.5);

        // 关卡列表
        this.createLevelList();
    }

    createLevelList() {
        const w = this.cameras.main.width;
        const h = this.cameras.main.height;
        const startY = 120;
        const itemHeight = 70;
        const cols = 2; // 两列

        for (let i = 1; i <= 20; i++) {
            const col = (i - 1) % cols;
            const row = Math.floor((i - 1) / cols);
            const x = w / 4 + col * (w / 2);
            const y = startY + row * itemHeight;

            // 检查是否有自定义关卡
            const hasCustom = localStorage.getItem(`mahjong_custom_level_${i}`) !== null;

            // 关卡卡片背景
            const cardBg = this.add.rectangle(x, y, w / 2 - 30, itemHeight - 10, 0x34495e)
                .setOrigin(0.5)
                .setInteractive({ useHandCursor: true });

            // 关卡文字
            const star = hasCustom ? '★ ' : '';
            const levelText = this.add.text(x - 60, y, `${star}第 ${i} 关`, {
                fontSize: '28px',
                color: '#ffffff'
            }).setOrigin(0.5);

            // 编辑按钮
            const editBtn = this.add.text(x + 60, y, '编辑', {
                fontSize: '24px',
                color: '#ffffff',
                backgroundColor: '#3498db',
                padding: { x: 20, y: 8 }
            }).setOrigin(0.5).setInteractive({ useHandCursor: true });

            // 点击卡片进入游戏
            cardBg.on('pointerdown', () => {
                this.sound.play('sfx-button');
                this.scene.start('GameScene', { level: i });
            });

            levelText.on('pointerdown', () => {
                this.sound.play('sfx-button');
                this.scene.start('GameScene', { level: i });
            });

            // 点击编辑按钮进入编辑器
            editBtn.on('pointerdown', () => {
                this.sound.play('sfx-button');
                this.scene.start('EditorScene', { level: i });
            });
        }
    }
}
