// game.js - 游戏初始化配置

const DESIGN_WIDTH = 720;
const DESIGN_HEIGHT = 1280;

const config = {
    type: Phaser.AUTO,
    parent: 'game-container',
    scale: {
        mode: Phaser.Scale.FIT,
        autoCenter: Phaser.Scale.CENTER_BOTH,
        width: DESIGN_WIDTH,
        height: DESIGN_HEIGHT
    },
    scene: [HomeScene, GameScene, ResultsScene, EditorScene],
    backgroundColor: '#2c3e50'
};

const game = new Phaser.Game(config);