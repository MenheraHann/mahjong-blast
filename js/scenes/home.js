// home.js - 启动场景

class HomeScene extends Phaser.Scene {
    constructor() {
        super({ key: 'HomeScene' });
    }

    preload() {
        this.load.audio('sfx-button', 'assets/wav/按钮点击.WAV');
    }

    create() {
        const w = this.cameras.main.width;
        const h = this.cameras.main.height;

        // 背景
        this.add.rectangle(0, 0, w, h, 0x2c3e50).setOrigin(0);

        // 标题 - 居中偏上
        this.add.text(w / 2, h * 0.18, '乐信圣文麻将', {
            fontSize: '52px',
            color: '#f1c40f',
            fontFamily: 'Arial, sans-serif',
            fontStyle: 'bold'
        }).setOrigin(0.5);

        // 开始按钮 - 居中
        const startBtn = this.add.text(w / 2, h * 0.48, '开始游戏', {
            fontSize: '36px',
            color: '#ffffff',
            backgroundColor: '#3498db',
            padding: { x: 80, y: 28 }
        }).setOrigin(0.5);

        startBtn.setInteractive({ useHandCursor: true });
        startBtn.on('pointerdown', () => {
            this.sound.play('sfx-button');
            this.scene.start('GameScene', { level: 1 });
        });

        // 继续按钮（如果有保存进度）
        const savedLevel = localStorage.getItem('mahjongLevel');
        if (savedLevel && parseInt(savedLevel) > 1) {
            const continueBtn = this.add.text(w / 2, h * 0.62, `继续游戏 - 第 ${savedLevel} 关`, {
                fontSize: '28px',
                color: '#ffffff',
                backgroundColor: '#27ae60',
                padding: { x: 50, y: 22 }
            }).setOrigin(0.5);

            continueBtn.setInteractive({ useHandCursor: true });
            continueBtn.on('pointerdown', () => {
                this.sound.play('sfx-button');
                this.scene.start('GameScene', { level: parseInt(savedLevel) });
            });
        }

        // 左下角更新日期
        this.add.text(10, h - 10, '更新: 2026-04-07', {
            fontSize: '14px',
            color: '#7f8c8d'
        }).setOrigin(0, 1);
    }
}
