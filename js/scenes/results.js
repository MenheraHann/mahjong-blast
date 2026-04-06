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

        // 夸奖四字词语列表
        this.praiseWords = [
            '神乎其技', '炉火纯青', '出神入化', '登峰造极',
            '一骑绝尘', '独占鳌头', '鹤立鸡群', '无与伦比',
            '完美通关', '惊为天人', '技惊四座', '叹为观止'
        ];
    }

    // 根据时间计算击败玩家百分比（0秒=99.99%，5分钟=85%，线性插值）
    calcBeatPercent(seconds) {
        const maxTime = 300; // 5分钟
        const maxPercent = 99.99;
        const minPercent = 85;
        if (seconds >= maxTime) return minPercent;
        const ratio = seconds / maxTime;
        return (maxPercent - (maxPercent - minPercent) * ratio).toFixed(2);
    }

    // 随机获取夸奖词
    getRandomPraise() {
        return this.praiseWords[Math.floor(Math.random() * this.praiseWords.length)];
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
            this.add.image(w / 2, h * 0.12, 'icon-trophy').setScale(1.0);

            // 夸奖词语
            const praise = this.getRandomPraise();
            this.add.text(w / 2, h * 0.24, praise, {
                fontSize: '36px',
                color: '#f1c40f',
                fontFamily: 'Arial, sans-serif',
                fontStyle: 'bold'
            }).setOrigin(0.5);

            // 第X关完成
            this.add.text(w / 2, h * 0.33, `第 ${this.level} 关完成！`, {
                fontSize: '28px',
                color: '#2ecc71',
                fontFamily: 'Arial, sans-serif'
            }).setOrigin(0.5);

            // 击败玩家百分比
            const beatPercent = this.calcBeatPercent(this.elapsedTime);
            this.add.text(w / 2, h * 0.42, `击败了 ${beatPercent}% 的玩家`, {
                fontSize: '26px',
                color: '#9b59b6'
            }).setOrigin(0.5);

            // 统计信息区域
            const statY = h * 0.54;
            const statSpacing = 45;

            // 分数
            this.add.text(w / 2, statY, `分数: ${this.score}`, {
                fontSize: '22px',
                color: '#f1c40f'
            }).setOrigin(0.5);

            // 连击
            this.add.text(w / 2, statY + statSpacing, `最大连击: ${this.maxCombo}`, {
                fontSize: '22px',
                color: '#e74c3c'
            }).setOrigin(0.5);

            // 通关用时
            this.add.text(w / 2, statY + statSpacing * 2, `用时: ${formatTime(this.elapsedTime)}`, {
                fontSize: '22px',
                color: '#3498db'
            }).setOrigin(0.5);

            if (this.level < 20) {
                const nextBtn = this.add.text(w / 2, h * 0.74, `下一关 - 第 ${this.level + 1} 关`, {
                    fontSize: '28px',
                    color: '#ffffff',
                    backgroundColor: '#27ae60',
                    padding: { x: 50, y: 18 }
                }).setOrigin(0.5).setInteractive({ useHandCursor: true });

                nextBtn.on('pointerdown', () => {
                    this.sound.play('sfx-button');
                    this.scene.start('GameScene', { level: this.level + 1 });
                });
            } else {
                this.add.text(w / 2, h * 0.74, '恭喜通关全部20关！', {
                    fontSize: '26px',
                    color: '#f1c40f'
                }).setOrigin(0.5);
            }
        } else {
            // 失败图标
            this.add.image(w / 2, h * 0.22, 'icon-fail').setScale(1.0);

            this.add.text(w / 2, h * 0.38, `第 ${this.level} 关未完成`, {
                fontSize: '32px',
                color: '#e74c3c',
                fontFamily: 'Arial, sans-serif'
            }).setOrigin(0.5);

            const retryBtn = this.add.text(w / 2, h * 0.52, '重新挑战', {
                fontSize: '28px',
                color: '#ffffff',
                backgroundColor: '#e74c3c',
                padding: { x: 50, y: 18 }
            }).setOrigin(0.5).setInteractive({ useHandCursor: true });

            retryBtn.on('pointerdown', () => {
                this.sound.play('sfx-button');
                this.scene.start('GameScene', { level: this.level });
            });
        }

        // 返回首页按钮
        const homeBtn = this.add.text(w / 2, h * 0.86, '返回首页', {
            fontSize: '26px',
            color: '#ffffff',
            backgroundColor: '#3498db',
            padding: { x: 40, y: 12 }
        }).setOrigin(0.5).setInteractive({ useHandCursor: true });

        homeBtn.on('pointerdown', () => {
            this.sound.play('sfx-button');
            this.scene.start('HomeScene');
        });

        // 进度提示
        this.add.text(w / 2, h * 0.92, `进度: 第 ${this.level}/20 关`, {
            fontSize: '18px',
            color: '#95a5a6'
        }).setOrigin(0.5);
    }
}
