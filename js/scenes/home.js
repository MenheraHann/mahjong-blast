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

        // 标题
        this.add.text(w / 2, h * 0.15, '乐信圣文麻将', {
            fontSize: '48px',
            color: '#ecf0f1',
            fontFamily: 'Arial, sans-serif'
        }).setOrigin(0.5);

        // 开始按钮
        const startBtn = this.add.text(w / 2, h * 0.4, '开始游戏', {
            fontSize: '36px',
            color: '#ffffff',
            backgroundColor: '#3498db',
            padding: { x: 60, y: 25 }
        }).setOrigin(0.5);

        startBtn.setInteractive({ useHandCursor: true });
        startBtn.on('pointerdown', () => {
            this.sound.play('sfx-button');
            this.scene.start('GameScene', { level: 1 });
        });

        // 继续按钮（如果有保存进度）
        const savedLevel = localStorage.getItem('mahjongLevel');
        if (savedLevel && parseInt(savedLevel) > 1) {
            const continueBtn = this.add.text(w / 2, h * 0.55, `继续游戏 - 第 ${savedLevel} 关`, {
                fontSize: '28px',
                color: '#ffffff',
                backgroundColor: '#27ae60',
                padding: { x: 40, y: 18 }
            }).setOrigin(0.5);

            continueBtn.setInteractive({ useHandCursor: true });
            continueBtn.on('pointerdown', () => {
                this.sound.play('sfx-button');
                this.scene.start('GameScene', { level: parseInt(savedLevel) });
            });
        }

        // 底部说明
        this.add.text(w / 2, h * 0.85, '点击两张相同图案的牌即可消除\n完成所有配对即可过关', {
            fontSize: '20px',
            color: '#bdc3c7',
            align: 'center',
            lineSpacing: 8
        }).setOrigin(0.5);
    }
}
