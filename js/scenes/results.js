// results.js - 结果场景

class ResultsScene extends Phaser.Scene {
    constructor() {
        super({ key: 'ResultsScene' });
    }

    init(data) {
        this.level = data.level || 1;
        this.completed = data.completed || false;
        this.score = data.score || 0;
        this.maxCombo = data.maxCombo || 0;
        this.elapsedTime = data.elapsedTime || 0;
    }

    preload() {
        this.load.svg('icon-trophy', 'assets/icons/trophy.svg');
        this.load.svg('icon-fail', 'assets/icons/fail.svg');
        this.load.audio('sfx-button', 'assets/wav/按钮点击.WAV');
    }

    create() {
        const w = this.cameras.main.width;
        const h = this.cameras.main.height;

        // 背景
        this.add.rectangle(0, 0, w, h, 0x2c3e50).setOrigin(0);

        // 格式化时间
        const formatTime = (seconds) => {
            const mins = Math.floor(seconds / 60);
            const secs = seconds % 60;
            return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
        };

        if (this.completed) {
            // 成功图标
            this.add.image(w / 2, h * 0.18, 'icon-trophy').setScale(1.0);

            this.add.text(w / 2, h * 0.32, `第 ${this.level} 关完成！`, {
                fontSize: '32px',
                color: '#2ecc71',
                fontFamily: 'Arial, sans-serif'
            }).setOrigin(0.5);

            // 统计信息区域
            const statY = h * 0.44;
            const statSpacing = 50;

            // 分数
            this.add.text(w / 2, statY, `分数: ${this.score}`, {
                fontSize: '24px',
                color: '#f1c40f'
            }).setOrigin(0.5);

            // 连击
            this.add.text(w / 2, statY + statSpacing, `最大连击: ${this.maxCombo}`, {
                fontSize: '24px',
                color: '#e74c3c'
            }).setOrigin(0.5);

            // 通关用时
            this.add.text(w / 2, statY + statSpacing * 2, `用时: ${formatTime(this.elapsedTime)}`, {
                fontSize: '24px',
                color: '#3498db'
            }).setOrigin(0.5);

            if (this.level < 20) {
                const nextBtn = this.add.text(w / 2, h * 0.70, `下一关 - 第 ${this.level + 1} 关`, {
                    fontSize: '30px',
                    color: '#ffffff',
                    backgroundColor: '#27ae60',
                    padding: { x: 50, y: 20 }
                }).setOrigin(0.5).setInteractive({ useHandCursor: true });

                nextBtn.on('pointerdown', () => {
                    this.sound.play('sfx-button');
                    this.scene.start('GameScene', { level: this.level + 1 });
                });
            } else {
                this.add.text(w / 2, h * 0.70, '恭喜通关全部20关！', {
                    fontSize: '28px',
                    color: '#f1c40f'
                }).setOrigin(0.5);
            }
        } else {
            // 失败图标
            this.add.image(w / 2, h * 0.22, 'icon-fail').setScale(1.0);

            this.add.text(w / 2, h * 0.38, `第 ${this.level} 关未完成`, {
                fontSize: '36px',
                color: '#e74c3c',
                fontFamily: 'Arial, sans-serif'
            }).setOrigin(0.5);

            const retryBtn = this.add.text(w / 2, h * 0.50, '重新挑战', {
                fontSize: '30px',
                color: '#ffffff',
                backgroundColor: '#e74c3c',
                padding: { x: 50, y: 20 }
            }).setOrigin(0.5).setInteractive({ useHandCursor: true });

            retryBtn.on('pointerdown', () => {
                this.sound.play('sfx-button');
                this.scene.start('GameScene', { level: this.level });
            });
        }

        // 返回首页按钮
        const homeBtn = this.add.text(w / 2, h * 0.82, '返回首页', {
            fontSize: '28px',
            color: '#ffffff',
            backgroundColor: '#3498db',
            padding: { x: 40, y: 15 }
        }).setOrigin(0.5).setInteractive({ useHandCursor: true });

        homeBtn.on('pointerdown', () => {
            this.sound.play('sfx-button');
            this.scene.start('HomeScene');
        });

        // 进度提示
        this.add.text(w / 2, h * 0.90, `进度: 第 ${this.level}/20 关`, {
            fontSize: '20px',
            color: '#95a5a6'
        }).setOrigin(0.5);
    }
}
